/*
# Add round-ending transition state

## Problem
When the timer reaches 0 or all players guess correctly, the round immediately
jumps to the next one with no transition. The requirements call for a 3-second
pause where the correct word is revealed and drawing is disabled before the
next round starts. There was also no way for non-host clients to know the
round was ending, since the timer only ran on the host.

## Solution
Add a `round_ending` boolean column to `rooms`. The host sets this to true
when the timer expires or all players guess, then waits 3 seconds before
calling `advance_round`. All clients see `round_ending` via realtime and can
reveal the word and disable drawing during the transition.

## Changes

### New Column
1. `rooms.round_ending` (boolean, default false)
   Set to true during the 3-second transition between rounds. When true,
   clients reveal the correct word and disable the canvas.

### Modified Function
1. `advance_round(p_room_id uuid, p_new_word text)`
   Now also sets `round_ending = false` when advancing to the next round,
   and when the game ends.

### Security
- No RLS policy changes.
- Existing policies remain unchanged.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'round_ending'
  ) THEN
    ALTER TABLE rooms ADD COLUMN round_ending boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Update advance_round to also reset round_ending
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
    UPDATE rooms SET status = 'ended', round_ending = false WHERE id = p_room_id;
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
    drawer_awarded_this_round = false,
    round_ending = false
  WHERE id = p_room_id;

  RETURN jsonb_build_object('advanced', true, 'game_ended', false, 'new_round', v_new_round);
END;
$$;

GRANT EXECUTE ON FUNCTION advance_round(uuid, text) TO anon, authenticated;