// Curated word bank for the drawing game. Medium difficulty, mostly nouns.
// If this list is ever empty/missing, callers fall back to FALLBACK_WORDS.
export const WORD_BANK: string[] = [
  "apple", "banana", "car", "house", "tree", "sun", "moon", "star", "cat",
  "dog", "fish", "bird", "boat", "chair", "table", "phone", "book", "lamp",
  "clock", "key", "door", "window", "bridge", "mountain", "river", "cloud",
  "rain", "snow", "fire", "hat", "shoe", "sock", "shirt", "pants", "glasses",
  "umbrella", "bicycle", "train", "airplane", "rocket", "robot", "castle",
  "pirate", "dragon", "ghost", "pumpkin", "snowman", "flower", "mushroom",
  "cactus", "pizza", "burger", "cake", "cookie", "donut", "coffee", "banana",
  "grape", "lemon", "carrot", "tomato", "potato", "bread", "cheese", "egg",
  "milk", "candle", "balloon", "guitar", "drum", "piano", "microphone",
  "telescope", "camera", "scissors", "hammer", "saw", "anchor", "compass",
  "map", "treasure", "sword", "shield", "crown", "ring", "diamond", "ghost",
  "spider", "snake", "turtle", "rabbit", "horse", "cow", "pig", "chicken",
  "elephant", "lion", "tiger", "bear", "monkey", "kangaroo", "penguin",
  "dolphin", "whale", "shark", "octopus", "butterfly", "rainbow", "volcano",
  "island", "desert", "forest", "city", "village", "tent", "windmill",
  "lighthouse", "pyramid", "skateboard", "scooter", "helicopter", "submarine",
];

// Fallback used if WORD_BANK is empty or all words have been used.
export const FALLBACK_WORDS: string[] = [
  "thing", "object", "shape", "color", "line", "circle", "square",
];

export function pickRandomWord(used: string[]): string {
  const pool = WORD_BANK.filter((w) => !used.includes(w));
  const source = pool.length > 0 ? pool : FALLBACK_WORDS;
  const idx = Math.floor(Math.random() * source.length);
  return source[idx] ?? FALLBACK_WORDS[0];
}

// Normalize a guess for comparison: lowercase, trim, collapse spaces, strip
// punctuation. "Apple!" and "  apple " both become "apple".
export function normalizeGuess(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "");
}

export function isCorrectGuess(guess: string, word: string): boolean {
  return normalizeGuess(guess) === normalizeGuess(word);
}
