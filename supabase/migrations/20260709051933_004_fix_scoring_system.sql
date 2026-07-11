/*
# Fix scoring system with atomic guess submission and round advancement

## Problem
The leaderboard score was not updating when a player guessed the correct word.
In the application code (useGame.ts, sendMessage), the entire scoring block was
gated behind a check for `timerRef.current`, which is only set on the host's
client. Since the host is typically the drawer (who cannot submit guesses),
the scoring database updates never executed for actual guessers, so player
scores were never written and the realtime leaderboard never updated.

## Solution
Move scoring and round-advancement logic into PostgreSQL RPC functions that
execute atomically on the server, independent of which client triggers them.
This ensures scoring works regardless of whether a timer is running locally.

## Changes

### New Columns
1. `players.has_guessed_this_round` (boolean, default false)
   Tracks whether a player has already correctly guessed in the current round.
   Prevents duplicate point awards. Reset to false at the start of each round.

2. `rooms.drawer_awarded_this_round` (boolean, default false)
   Tracks whether the drawer has already received their +50 points this round.
   Ensures the drawer gets points only once per round. Reset to false at the
   start of each round.

### New Functions
1. `submit_guess(p_room_id uuid, p_player_id uuid, p_content text)` -> jsonb
   - Inserts the chat message with is_correct_guess flag
   - If the guess matches the current secret word (case-insensitive):
     - If the player has NOT already guessed this round: awards +100 to the
       guesser and +50 to the drawer (only if not already awarded this round)
     - If the player HAS already guessed: no points (duplicate ignored)
   - Returns { is_correct, awarded, all_guessed }

2. `advance_round(p_room_id uuid, p_new_word text)` -> jsonb
   - Advances to the next drawer in round-robin order (by joined_at)
   - Resets has_guessed_this_round for all players
   - Resets drawer_awarded_this_round on the room
   - Clears drawing strokes and messages
   - Sets the new word, resets timer to 60, increments round number
   - Ends the game (status = 'ended') if all rounds are complete
   - Guard: only advances if timer expired (time_remaining <= 0) OR all
     non-drawer players have guessed correctly
   - Returns { advanced, game_ended }

### Security
- Both functions use SECURITY DEFINER with SET search_path = public
- Existing RLS policies on all tables remain unchanged
- EXECUTE granted to anon and authenticated roles

## Scoring Rules Implemented
- Correct guess: +100 points to guesser
- Drawer receives: +50 points when at least one player guesses correctly
- One award per player per round (duplicate correct guesses ignored)
- Scores persist between rounds (stored in players.score)
- Scores reset to 0 only when a new game starts (handled in application layer)

## Round Advancement
- Round advances when the timer reaches 0 OR all non-drawer players guess correctly
- The advance_round function is idempotent: its guard prevents double-advancement
  when multiple clients trigger it simultaneously
*/

-- Add has_guessed_this_round column to players
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'has_guessed_this_round'
  ) THEN
    ALTER TABLE players ADD COLUMN has_guessed_this_round boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add drawer_awarded_this_round column to rooms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'drawer_awarded_this_round'
  ) THEN
    ALTER TABLE rooms ADD COLUMN drawer_awarded_this_round boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create submit_guess function
CREATE OR REPLACE FUNCTION submit_guess(p_room_id uuid, p_player_id uuid, p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room RECORD;
  v_player RECORD;
  v_is_correct boolean;
  v_total_guessers int;
  v_correct_guessers int;
  v_all_guessed boolean;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.status != 'playing' THEN
    RETURN jsonb_build_object('error', 'Game is not playing');
  END IF;

  SELECT * INTO v_player FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  IF v_player.is_drawer THEN
    RETURN jsonb_build_object('error', 'Drawer cannot guess');
  END IF;

  v_is_correct := lower(btrim(p_content)) = lower(btrim(v_room.current_word));

  INSERT INTO messages (room_id, player_id, player_nickname, content, is_correct_guess)
  VALUES (p_room_id, p_player_id, v_player.nickname, p_content, v_is_correct);

  IF NOT v_is_correct THEN
    RETURN jsonb_build_object('is_correct', false, 'awarded', false);
  END IF;

  IF v_player.has_guessed_this_round THEN
    RETURN jsonb_build_object('is_correct', true, 'awarded', false, 'duplicate', true);
  END IF;

  UPDATE players SET score = score + 100, has_guessed_this_round = true
  WHERE id = p_player_id;

  IF NOT v_room.drawer_awarded_this_round THEN
    UPDATE players SET score = score + 50 WHERE id = v_room.current_drawer_id;
    UPDATE rooms SET drawer_awarded_this_round = true WHERE id = p_room_id;
  END IF;

  SELECT count(*) INTO v_total_guessers
  FROM players WHERE room_id = p_room_id AND is_drawer = false;
  SELECT count(*) INTO v_correct_guessers
  FROM players WHERE room_id = p_room_id AND is_drawer = false AND has_guessed_this_round = true;

  v_all_guessed := v_total_guessers > 0 AND v_correct_guessers = v_total_guessers;

  RETURN jsonb_build_object(
    'is_correct', true,
    'awarded', true,
    'guesser_points', 100,
    'all_guessed', v_all_guessed
  );
END;
$$;

-- Create advance_round function
CREATE OR REPLACE FUNCTION advance_round(p_room_id uuid, p_new_word text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room RECORD;
  v_player_count int;
  v_current_drawer_index int;
  v_next_drawer_index int;
  v_next_drawer_id uuid;
  v_new_round int;
  v_total_guessers int;
  v_correct_guessers int;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.status != 'playing' THEN
    RETURN jsonb_build_object('advanced', false, 'reason', 'not_playing');
  END IF;

  SELECT count(*) INTO v_total_guessers
  FROM players WHERE room_id = p_room_id AND is_drawer = false;
  SELECT count(*) INTO v_correct_guessers
  FROM players WHERE room_id = p_room_id AND is_drawer = false AND has_guessed_this_round = true;

  -- Guard: only advance if timer expired OR all non-drawer players guessed
  IF v_room.time_remaining > 0 AND NOT (v_total_guessers > 0 AND v_correct_guessers = v_total_guessers) THEN
    RETURN jsonb_build_object('advanced', false, 'reason', 'not_ready');
  END IF;

  SELECT count(*) INTO v_player_count FROM players WHERE room_id = p_room_id;
  IF v_player_count = 0 THEN
    RETURN jsonb_build_object('advanced', false, 'reason', 'no_players');
  END IF;

  -- Find current drawer's index in join-order
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY joined_at) - 1 AS idx
    FROM players WHERE room_id = p_room_id
  )
  SELECT idx INTO v_current_drawer_index FROM ordered WHERE id = v_room.current_drawer_id;

  IF v_current_drawer_index IS NULL THEN
    v_current_drawer_index := 0;
  END IF;

  v_next_drawer_index := (v_current_drawer_index + 1) % v_player_count;

  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY joined_at) - 1 AS idx
    FROM players WHERE room_id = p_room_id
  )
  SELECT id INTO v_next_drawer_id FROM ordered WHERE idx = v_next_drawer_index;

  IF v_next_drawer_id IS NULL THEN
    RAISE EXCEPTION 'Could not determine next drawer';
  END IF;

  v_new_round := CASE
    WHEN v_next_drawer_index = 0 THEN v_room.round_number + 1
    ELSE v_room.round_number
  END;

  IF v_new_round > v_room.max_rounds THEN
    UPDATE rooms SET status = 'ended' WHERE id = p_room_id;
    RETURN jsonb_build_object('advanced', true, 'game_ended', true);
  END IF;

  UPDATE players SET is_drawer = false WHERE room_id = p_room_id;
  UPDATE players SET is_drawer = true WHERE id = v_next_drawer_id;
  UPDATE players SET has_guessed_this_round = false WHERE room_id = p_room_id;

  DELETE FROM drawing_strokes WHERE room_id = p_room_id;
  DELETE FROM messages WHERE room_id = p_room_id;

  UPDATE rooms SET
    current_drawer_id = v_next_drawer_id,
    current_word = p_new_word,
    time_remaining = 60,
    round_number = v_new_round,
    drawer_awarded_this_round = false
  WHERE id = p_room_id;

  RETURN jsonb_build_object('advanced', true, 'game_ended', false, 'new_round', v_new_round);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION submit_guess(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION advance_round(uuid, text) TO anon, authenticated;