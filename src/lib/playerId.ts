// Stable per-browser player id. Stored in localStorage so reconnects after
// a refresh or network drop restore the same player identity.
const KEY = "scribble.playerId";

export function getOrCreatePlayerId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // localStorage may be unavailable (private mode); fall back to a session id.
    return crypto.randomUUID();
  }
}

const NAME_KEY = "scribble.playerName";
const COLOR_KEY = "scribble.playerColor";

export function rememberPlayer(name: string, color: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(COLOR_KEY, color);
  } catch {
    /* ignore */
  }
}

export function recallPlayer(): { name: string | null; color: string | null } {
  try {
    return {
      name: localStorage.getItem(NAME_KEY),
      color: localStorage.getItem(COLOR_KEY),
    };
  } catch {
    return { name: null, color: null };
  }
}
