export type RoomStatus = "lobby" | "playing" | "finished";

export type Tool = "brush" | "eraser";

export interface Point {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
}

export interface Stroke {
  id: string;
  room_id: string;
  round_index: number;
  points: Point[];
  color: string;
  size: number;
  tool: Tool;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  avatar_color: string;
  score: number;
  correct_guesses: number;
  drawing_bonus: number;
  fastest_guess_ms: number | null;
  is_connected: boolean;
  joined_at: string;
}

export interface Room {
  id: string;
  code: string;
  host_id: string | null;
  status: RoomStatus;
  current_round: number;
  total_rounds: number;
  round_duration_ms: number;
  current_word: string | null;
  drawer_id: string | null;
  round_started_at: string | null;
  round_ended_at: string | null;
  used_words: string[];
  created_at: string;
}

export interface RoundSummary {
  id: string;
  room_id: string;
  round_index: number;
  drawer_id: string | null;
  word: string | null;
  winner_id: string | null;
  points_awarded: number;
  guess_time_ms: number | null;
  ended_at: string;
}

export interface Guess {
  id: string;
  room_id: string;
  player_id: string;
  player_name: string;
  text: string;
  is_correct: boolean;
  created_at: string;
}

export interface RoundSummaryPayload {
  roundIndex: number;
  word: string;
  drawerId: string | null;
  drawerName: string;
  winnerId: string | null;
  winnerName: string | null;
  pointsAwarded: number;
  guessTimeMs: number | null;
  nextDrawerId: string | null;
  isLastRound: boolean;
}

export interface PlayerSelf {
  id: string;
  name: string;
  avatarColor: string;
}
