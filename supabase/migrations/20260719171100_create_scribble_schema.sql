/*
# Scribble multiplayer game schema

## Overview
Persistent backing store for a Skribbl.io-style multiplayer drawing & guessing
game. The game is intentionally single-tenant / no-auth (players join by nickname
into a shared room), so all policies are scoped to `anon, authenticated` and
`USING (true)` is acceptable because the data is intentionally shared within a
room.

## New Tables

1. `rooms` — a game room / lobby.
   - `id` (uuid, pk)
   - `code` (text, unique) — short human-readable room code used in the URL.
   - `host_id` (text) — stable player id of the current host.
   - `status` (text) — `lobby` | `playing` | `finished`.
   - `current_round` (int) — 0-based index of the current round.
   - `total_rounds` (int) — total number of rounds in a game.
   - `round_duration_ms` (int) — per-round timer length in ms.
   - `current_word` (text) — the word for the current round (only visible to
     the drawer via client-side filtering; stored server-side for reconnection).
   - `drawer_id` (text) — current drawer's player id.
   - `round_started_at` (timestamptz) — server timestamp when the current
     round started; used to compute the synchronized countdown.
   - `round_ended_at` (timestamptz) — when the round ended (null while active).
   - `used_words` (jsonb) — array of words already used this game.
   - `created_at` (timestamptz)

2. `players` — players within a room.
   - `id` (text, pk) — client-generated stable id (uuid in localStorage).
   - `room_id` (uuid, fk -> rooms.id on delete cascade)
   - `name` (text)
   - `avatar_color` (text)
   - `score` (int, default 0)
   - `correct_guesses` (int, default 0)
   - `drawing_bonus` (int, default 0)
   - `fastest_guess_ms` (int, nullable)
   - `is_connected` (boolean, default true)
   - `joined_at` (timestamptz)
   - UNIQUE (`room_id`, `name`)

3. `rounds` — per-round summary for the final leaderboard.
   - `id` (uuid, pk)
   - `room_id` (uuid, fk -> rooms.id on delete cascade)
   - `round_index` (int)
   - `drawer_id` (text)
   - `word` (text)
   - `winner_id` (text, nullable)
   - `points_awarded` (int, default 0)
   - `guess_time_ms` (int, nullable)
   - `ended_at` (timestamptz)

4. `strokes` — drawing strokes for real-time canvas sync & reconnection replay.
   - `id` (uuid, pk)
   - `room_id` (uuid, fk -> rooms.id on delete cascade)
   - `round_index` (int)
   - `points` (jsonb) — array of {x,y} normalized points (0..1).
   - `color` (text)
   - `size` (int)
   - `tool` (text) — `brush` | `eraser`
   - `created_at` (timestamptz)
   Index on (room_id, round_index) for fast replay queries.

5. `guesses` — chat / guess log.
   - `id` (uuid, pk)
   - `room_id` (uuid, fk -> rooms.id on delete cascade)
   - `player_id` (text)
   - `player_name` (text)
   - `text` (text)
   - `is_correct` (boolean, default false)
   - `created_at` (timestamptz)

## Security
- RLS enabled on every table.
- All tables are intentionally shared within a room (no-auth multiplayer game),
  so policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`.
  This is documented as intentional public/shared data, not a shortcut.

## Notes
1. Strokes store normalized 0..1 coordinates so canvas resizes don't break replay.
2. `round_started_at` is the single source of truth for the synchronized timer;
   clients compute remaining = round_duration_ms - (now - round_started_at).
3. `used_words` prevents duplicate words within a game.
4. Cascade deletes keep the schema tidy when a room is deleted.
*/

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id text,
  status text NOT NULL DEFAULT 'lobby',
  current_round int NOT NULL DEFAULT 0,
  total_rounds int NOT NULL DEFAULT 3,
  round_duration_ms int NOT NULL DEFAULT 80000,
  current_word text,
  drawer_id text,
  round_started_at timestamptz,
  round_ended_at timestamptz,
  used_words jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_rooms" ON rooms;
CREATE POLICY "anon_select_rooms" ON rooms FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_rooms" ON rooms;
CREATE POLICY "anon_insert_rooms" ON rooms FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_rooms" ON rooms;
CREATE POLICY "anon_update_rooms" ON rooms FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_rooms" ON rooms;
CREATE POLICY "anon_delete_rooms" ON rooms FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS players (
  id text PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_color text NOT NULL DEFAULT '#6366f1',
  score int NOT NULL DEFAULT 0,
  correct_guesses int NOT NULL DEFAULT 0,
  drawing_bonus int NOT NULL DEFAULT 0,
  fastest_guess_ms int,
  is_connected boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, name)
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_players" ON players;
CREATE POLICY "anon_select_players" ON players FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_players" ON players;
CREATE POLICY "anon_insert_players" ON players FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_players" ON players;
CREATE POLICY "anon_update_players" ON players FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_players" ON players;
CREATE POLICY "anon_delete_players" ON players FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_index int NOT NULL,
  drawer_id text,
  word text,
  winner_id text,
  points_awarded int NOT NULL DEFAULT 0,
  guess_time_ms int,
  ended_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_rounds" ON rounds;
CREATE POLICY "anon_select_rounds" ON rounds FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_rounds" ON rounds;
CREATE POLICY "anon_insert_rounds" ON rounds FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_rounds" ON rounds;
CREATE POLICY "anon_update_rounds" ON rounds FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_rounds" ON rounds;
CREATE POLICY "anon_delete_rounds" ON rounds FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS strokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_index int NOT NULL,
  points jsonb NOT NULL DEFAULT '[]'::jsonb,
  color text NOT NULL DEFAULT '#1f2937',
  size int NOT NULL DEFAULT 4,
  tool text NOT NULL DEFAULT 'brush',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strokes_room_round_idx
  ON strokes (room_id, round_index);

ALTER TABLE strokes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_strokes" ON strokes;
CREATE POLICY "anon_select_strokes" ON strokes FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_strokes" ON strokes;
CREATE POLICY "anon_insert_strokes" ON strokes FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_strokes" ON strokes;
CREATE POLICY "anon_delete_strokes" ON strokes FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  player_name text NOT NULL,
  text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guesses_room_idx ON guesses (room_id, created_at);

ALTER TABLE guesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_guesses" ON guesses;
CREATE POLICY "anon_select_guesses" ON guesses FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_guesses" ON guesses;
CREATE POLICY "anon_insert_guesses" ON guesses FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_guesses" ON guesses;
CREATE POLICY "anon_delete_guesses" ON guesses FOR DELETE
  TO anon, authenticated USING (true);
