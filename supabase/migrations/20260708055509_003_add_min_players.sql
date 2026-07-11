/*
# Add min_players column to rooms table

This migration adds a minimum players setting that the host can configure before starting the game.

## Changes
1. Add min_players column to rooms table
   - Type: integer
   - Default: 2 (minimum viable game)
   - Valid range: 2-8

## Notes
- The host can adjust this before game starts
- Start Game button is disabled until min_players is reached
- max_rounds already exists for round count configuration
*/

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS min_players integer NOT NULL DEFAULT 2;

-- Add constraint to ensure valid range
ALTER TABLE rooms ADD CONSTRAINT check_min_players 
  CHECK (min_players >= 2 AND min_players <= 8);
