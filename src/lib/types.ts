export interface Player {
  id: string;
  nickname: string;
  room_id: string;
  score: number;
  is_drawer: boolean;
  is_host: boolean;
  joined_at: string;
  has_guessed_this_round: boolean;
  correct_guesses: number;
  times_as_drawer: number;
}

export interface Room {
  id: string;
  code: string;
  host_id: string;
  current_drawer_id: string | null;
  current_word: string | null;
  round_number: number;
  max_rounds: number;
  min_players: number;
  time_remaining: number;
  status: 'waiting' | 'playing' | 'ended';
  created_at: string;
  drawer_awarded_this_round: boolean;
  round_ending: boolean;
}

export interface DrawingStroke {
  id: string;
  room_id: string;
  player_id: string;
  points: Point[];
  color: string;
  brush_size: number;
  created_at: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  player_id: string;
  player_nickname: string;
  content: string;
  is_correct_guess: boolean;
  created_at: string;
}

export interface GameState {
  room: Room | null;
  players: Player[];
  messages: ChatMessage[];
  isDrawer: boolean;
  currentWord: string | null;
  timeRemaining: number;
}

export const MIN_PLAYERS_OPTIONS = [2, 3, 4, 5, 6, 8];
export const MAX_ROUNDS_OPTIONS = [1, 3, 5, 7, 10];

export const WORDS = [
  'elephant', 'guitar', 'rainbow', 'pizza', 'bicycle',
  'astronaut', 'butterfly', 'camera', 'dragon', 'flower',
  'hamburger', 'icecream', 'jellyfish', 'kangaroo', 'lighthouse',
  'mountain', 'navigator', 'octopus', 'penguin', 'rocket',
  'sandcastle', 'telescope', 'umbrella', 'volcano', 'waterfall',
  'xylophone', 'hedgehog', 'snowflake', 'treasure', 'volleyball',
  'dinosaur', 'firework', 'giraffe', 'headphones', 'keyboard',
  'lamppost', 'microphone', 'notebook', 'parachute', 'rollercoaster',
  'scissors', 'typewriter', 'whisper', 'campfire', 'dolphin',
  'eagle', 'firetruck', 'glacier', 'hospital', 'island',
];

export const COLORS = [
  '#ffffff', '#1a1a25', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
];

export const BRUSH_SIZES = [2, 5, 10, 20];

export const ROUND_DURATION = 60;
export const ROUND_ENDING_DURATION = 3;
