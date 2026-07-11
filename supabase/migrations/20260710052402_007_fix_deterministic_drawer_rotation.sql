/*
# Fix deterministic drawer rotation in advance_round

## Problem
The `advance_round` function uses `ROW_NUMBER() OVER (ORDER BY joined_at)` to
determine drawer rotation order. When multiple players have the same
`joined_at` (e.g. bulk-inserted in testing, or joining within the same
millisecond), the order is non-deterministic. This causes the drawer to
wrap to index 0 unpredictably, incrementing the round counter too fast
and ending the game prematurely.

## Solution
Add `id` as a secondary sort key in both `ROW_NUMBER()` windows so the
order is always deterministic, even when `joined_at` values are identical.

## Changes
- `advance_round`: `ORDER BY joined_at` → `ORDER BY joined_at, id` (2 places)
- `submit_guess`: no changes needed (does not use drawer ordering)
*/

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

  IF v_room.time_remaining > 0 AND NOT (v_total_guessers > 0 AND v_correct_guessers = v_total_guessers) THEN
    RETURN jsonb_build_object('advanced', false, 'reason', 'not_ready');
  END IF;

  SELECT count(*) INTO v_player_count FROM players WHERE room_id = p_room_id;
  IF v_player_count = 0 THEN
    RETURN jsonb_build_object('advanced', false, 'reason', 'no_players');
  END IF;

  -- Deterministic ordering: joined_at, then id as tiebreaker
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

  v_new_round := CASE
    WHEN v_next_drawer_index = 0 THEN v_room.round_number + 1
    ELSE v_room.round_number
  END;

  IF v_new_round > v_room.max_rounds THEN
    UPDATE rooms SET status = 'ended', round_ending = false WHERE id = p_room_id;
    RETURN jsonb_build_object('advanced', true, 'game_ended', true);
  END IF;

  UPDATE players SET is_drawer = false WHERE room_id = p_room_id;
  UPDATE players SET is_drawer = true, times_as_drawer = times_as_drawer + 1 WHERE id = v_next_drawer_id;
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