/*
# SketchGuess Initial Schema

This migration creates the core tables for the SketchGuess multiplayer drawing game.

## New Tables
1. **rooms** - Game rooms where players gather to play
   - id (uuid, primary key)
   - code (text, unique, 6-character room code)
   - host_id (uuid, references players)
   - current_drawer_id (uuid, references players)
   - current_word (text, the word being drawn/guessed)
   - round_number (integer, current round)
   - max_rounds (integer, maximum rounds per game)
   - time_remaining (integer, seconds left in round)
   - status (enum: waiting/playing/ended)
   - created_at (timestamp)

2. **players** - Players in the game
   - id (uuid, primary key)
   - nickname (text, display name)
   - room_id (uuid, references rooms)
   - score (integer, accumulated points)
   - is_drawer (boolean, whether currently drawing)
   - is_host (boolean, whether room creator)
   - joined_at (timestamp)

3. **drawing_strokes** - Drawing data for real-time canvas sync
   - id (uuid, primary key)
   - room_id (uuid, references rooms)
   - player_id (uuid, references players)
   - points (jsonb, array of {x, y} coordinates)
   - color (text, stroke color)
   - brush_size (integer, stroke thickness)
   - created_at (timestamp)

4. **messages** - Chat messages and guesses
   - id (uuid, primary key)
   - room_id (uuid, references rooms)
   - player_id (uuid, references players)
   - player_nickname (text, denormalized for display)
   - content (text, message content)
   - is_correct_guess (boolean, whether this was a correct guess)
   - created_at (timestamp)

## Security
- RLS enabled on all tables
- Policies allow anon + authenticated access (no sign-in required)
- All data is public within the game context

## Notes
1. This is a single-tenant, no-auth application
2. Anyone with a room code can join and participate
3. Drawing strokes are cleared between rounds
4. Messages persist for the duration of the game
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for room status
CREATE TYPE room_status AS ENUM ('waiting', 'playing', 'ended');

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id uuid,
  current_drawer_id uuid,
  current_word text,
  round_number integer NOT NULL DEFAULT 0,
  max_rounds integer NOT NULL DEFAULT 3,
  time_remaining integer NOT NULL DEFAULT 60,
  status room_status NOT NULL DEFAULT 'waiting',
  created_at timestamptz DEFAULT now()
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  is_drawer boolean NOT NULL DEFAULT false,
  is_host boolean NOT NULL DEFAULT false,
  joined_at timestamptz DEFAULT now()
);

-- Drawing strokes table
CREATE TABLE IF NOT EXISTS drawing_strokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  points jsonb NOT NULL,
  color text NOT NULL,
  brush_size integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_nickname text NOT NULL,
  content text NOT NULL,
  is_correct_guess boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_strokes ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Rooms policies
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

-- Players policies
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

-- Drawing strokes policies
DROP POLICY IF EXISTS "anon_select_strokes" ON drawing_strokes;
CREATE POLICY "anon_select_strokes" ON drawing_strokes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_strokes" ON drawing_strokes;
CREATE POLICY "anon_insert_strokes" ON drawing_strokes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_strokes" ON drawing_strokes;
CREATE POLICY "anon_delete_strokes" ON drawing_strokes FOR DELETE
  TO anon, authenticated USING (true);

-- Messages policies
DROP POLICY IF EXISTS "anon_select_messages" ON messages;
CREATE POLICY "anon_select_messages" ON messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
CREATE POLICY "anon_insert_messages" ON messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Add foreign key constraints after table creation
ALTER TABLE rooms 
  ADD CONSTRAINT fk_rooms_host FOREIGN KEY (host_id) REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_rooms_drawer FOREIGN KEY (current_drawer_id) REFERENCES players(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_strokes_room ON drawing_strokes(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
