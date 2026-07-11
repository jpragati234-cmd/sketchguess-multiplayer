/*
# Enable Realtime for Game Tables

This migration enables Supabase Realtime on all game tables for real-time multiplayer sync.

## Changes
- Enable realtime publication for: rooms, players, messages, drawing_strokes
- Required for real-time updates across connected clients
*/

-- Enable realtime for all game tables
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE drawing_strokes;
