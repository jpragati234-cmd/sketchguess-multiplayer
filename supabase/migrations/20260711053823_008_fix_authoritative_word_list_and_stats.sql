/*
# Fix game flow: authoritative word list, turn timing stats, correct_guesses tracking

## Problems
1. `advance_round` receives the new word from the client — any client could
   inject arbitrary words. The server should pick words authoritatively.
2. Words are picked randomly each turn with no tracking, so the same word
   can repeat immediately.
3. `submit_guess` never increments `players.correct_guesses`.
4. No tracking of guess timing (total_guess_time, successful_guess_count)
   for the "Average Guess Time" leaderboard stat.
5. `startGame` in the client picks a random first drawer, but `advance_round`
   increments the round when the drawer wraps to index 0. Starting at a
   random index causes the round to increment at the wrong time.

## Solution
1. Add `rooms.word_list` (text[]) and `rooms.current_word_index` (int) so
   the server tracks a shuffled word list and advances through it.
2. Add `rooms.turn_started_at` (timestamptz) so `submit_guess` can compute
   elapsed guess time.
3. Add `players.total_guess_time` (int, ms) and `players.successful_guess_count`
   (int) for average guess time calculation.
4. Create `start_game` RPC that shuffles the word list server-side, picks
   the first drawer by join-order index 0, and initializes all game state.
5. Rewrite `advance_round` to pick the next word from `word_list` instead
   of accepting it as a parameter.
6. Update `submit_guess` to increment `correct_guesses`, track guess time.

## New Columns
- rooms.word_list text[]          — shuffled word list for the game
- rooms.current_word_index int    — index into word_list
- rooms.turn_started_at timestamptz — when the current turn started
- players.total_guess_time int    — cumulative ms spent guessing correctly
- players.successful_guess_count int — number of correct guesses

## New/Modified Functions
- start_game(p_room_id) → shuffles words, sets first drawer, starts round 1
- advance_round(p_room_id) → picks next word from word_list, rotates drawer
- submit_guess(...) → now tracks correct_guesses, total_guess_time, successful_guess_count
*/

-- ─── New columns on rooms ─────────────────────────────────────
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS word_list text[] DEFAULT '{}';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_word_index integer NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS turn_started_at timestamptz;

-- ─── New columns on players ───────────────────────────────────
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_guess_time integer NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS successful_guess_count integer NOT NULL DEFAULT 0;

-- ─── start_game RPC ──────────────────────────────────────────
-- Shuffles the word list server-side, picks the first drawer by join-order
-- index 0, resets all player stats, and starts round 1.
CREATE OR REPLACE FUNCTION start_game(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_word_list text[];
  v_first_drawer_id uuid;
  v_min_players int;
  v_player_count int;
BEGIN
  SELECT min_players INTO v_min_players FROM rooms WHERE id = p_room_id;
  SELECT count(*) INTO v_player_count FROM players WHERE room_id = p_room_id;
  IF v_player_count < v_min_players THEN
    RETURN jsonb_build_object('started', false, 'reason', 'not_enough_players');
  END IF;

  -- Shuffle words using ORDER BY random()
  SELECT array_agg(word ORDER BY random()) INTO v_word_list
  FROM (SELECT unnest(ARRAY[
    'elephant','guitar','rainbow','pizza','bicycle',
    'astronaut','butterfly','camera','dragon','flower',
    'hamburger','icecream','jellyfish','kangaroo','lighthouse',
    'mountain','navigator','octopus','penguin','rocket',
    'sandcastle','telescope','umbrella','volcano','waterfall',
    'xylophone','hedgehog','snowflake','treasure','volleyball',
    'dinosaur','firework','giraffe','headphones','keyboard',
    'lamppost','microphone','notebook','parachute','rollercoaster',
    'scissors','typewriter','whisper','campfire','dolphin',
    'eagle','firetruck','glacier','hospital','island'
  ]) AS word) sub;

  -- First drawer = join-order index 0
  SELECT id INTO v_first_drawer_id
  FROM players WHERE room_id = p_room_id
  ORDER BY joined_at, id LIMIT 1;

  -- Reset all players
  UPDATE players SET
    score = 0,
    is_drawer = false,
    has_guessed_this_round = false,
    correct_guesses = 0,
    times_as_drawer = 0,
    total_guess_time = 0,
    successful_guess_count = 0
  WHERE room_id = p_room_id;

  -- Set first drawer
  UPDATE players SET is_drawer = true, times_as_drawer = 1
  WHERE id = v_first_drawer_id;

  -- Clear canvas and messages
  DELETE FROM drawing_strokes WHERE room_id = p_room_id;
  DELETE FROM messages WHERE room_id = p_room_id;

  -- Start round 1
  UPDATE rooms SET
    status = 'playing',
    round_number = 1,
    word_list = v_word_list,
    current_word_index = 0,
    current_word = v_word_list[1],
    time_remaining = 60,
    current_drawer_id = v_first_drawer_id,
    drawer_awarded_this_round = false,
    round_ending = false,
    turn_started_at = now()
  WHERE id = p_room_id;

  RETURN jsonb_build_object('started', true, 'word_count', array_length(v_word_list, 1));
END;
$$;

GRANT EXECUTE ON FUNCTION start_game(uuid) TO anon, authenticated;

-- ─── advance_round RPC (rewritten) ────────────────────────────
-- No longer accepts a word parameter. Picks the next word from word_list.
-- Rotates drawer deterministically by (joined_at, id) order.
CREATE OR REPLACE FUNCTION advance_round(p_room_id uuid)
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
  v_next_word_index int;
  v_next_word text;
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

  -- Find current drawer's index in join-order (deterministic: joined_at, id)
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY joined_at, id) - 1 AS idx
    FROM players WHERE room_id = p_room_id
  )
  SELECT idx INTO v_current_drawer_index FROM ordered WHERE id = v_room.current_drawer_id;

  IF v_current_drawer_index IS NULL THEN
    v_current_drawer_index := 0;
  END IF;

  v_next_drawer_index := (v_current_drawer_index + 1) % v_player_count;

  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY joined_at, id) - 1 AS idx
    FROM players WHERE room_id = p_room_id
  )
  SELECT id INTO v_next_drawer_id FROM ordered WHERE idx = v_next_drawer_index;

  IF v_next_drawer_id IS NULL THEN
    RAISE EXCEPTION 'Could not determine next drawer';
  END IF;

  -- Round increments when drawer wraps to index 0
  v_new_round := CASE
    WHEN v_next_drawer_index = 0 THEN v_room.round_number + 1
    ELSE v_room.round_number
  END;

  IF v_new_round > v_room.max_rounds THEN
    UPDATE rooms SET status = 'ended', round_ending = false WHERE id = p_room_id;
    RETURN jsonb_build_object('advanced', true, 'game_ended', true);
  END IF;

  -- Pick next word from the shuffled word_list
  v_next_word_index := v_room.current_word_index + 1;

  -- If we've exhausted the word list, reshuffle
  IF v_next_word_index > array_length(v_room.word_list, 1) THEN
    WITH shuffled AS (
      SELECT array_agg(word ORDER BY random()) AS wl
      FROM (SELECT unnest(v_room.word_list) AS word) sub
    )
    SELECT wl INTO v_next_word FROM shuffled;
    v_next_word_index := 1;
  ELSE
    v_next_word := v_room.word_list[v_next_word_index + 1]; -- arrays are 1-indexed
  END IF;

  -- Rotate drawer
  UPDATE players SET is_drawer = false WHERE room_id = p_room_id;
  UPDATE players SET is_drawer = true, times_as_drawer = times_as_drawer + 1
  WHERE id = v_next_drawer_id;
  UPDATE players SET has_guessed_this_round = false WHERE room_id = p_room_id;

  -- Clear canvas and messages
  DELETE FROM drawing_strokes WHERE room_id = p_room_id;
  DELETE FROM messages WHERE room_id = p_room_id;

  -- Update room state
  UPDATE rooms SET
    current_drawer_id = v_next_drawer_id,
    current_word = v_next_word,
    current_word_index = v_next_word_index - 1, -- 0-based for client
    time_remaining = 60,
    round_number = v_new_round,
    drawer_awarded_this_round = false,
    round_ending = false,
    turn_started_at = now()
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'advanced', true,
    'game_ended', false,
    'new_round', v_new_round,
    'new_drawer_id', v_next_drawer_id,
    'new_word', v_next_word
  );
END;
$$;

GRANT EXECUTE ON FUNCTION advance_round(uuid) TO anon, authenticated;

-- ─── submit_guess RPC (updated) ───────────────────────────────
-- Now increments correct_guesses and tracks guess timing.
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
  v_elapsed_ms int;
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

  -- Compute elapsed time since turn started
  v_elapsed_ms := EXTRACT(EPOCH FROM (now() - v_room.turn_started_at)) * 1000;

  -- Award points and track stats
  UPDATE players SET
    score = score + 100,
    has_guessed_this_round = true,
    correct_guesses = correct_guesses + 1,
    total_guess_time = total_guess_time + v_elapsed_ms,
    successful_guess_count = successful_guess_count + 1
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

GRANT EXECUTE ON FUNCTION submit_guess(uuid, uuid, text) TO anon, authenticated;