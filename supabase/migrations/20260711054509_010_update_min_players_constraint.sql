/*
# Update min_players constraint to allow 1-10
*/
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS check_min_players;
ALTER TABLE rooms ADD CONSTRAINT check_min_players CHECK (min_players >= 1 AND min_players <= 10);