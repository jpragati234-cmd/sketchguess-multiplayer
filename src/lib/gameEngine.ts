import { supabase } from "./supabase";
import { pickRandomWord } from "./words";
import type { Player, Room } from "../types/game";

export const ROUND_DURATION_MS = 80000;
export const SUMMARY_DURATION_MS = 5000;
export const LEADERBOARD_DURATION_MS = 0; // 0 = stays until user clicks
export const DEFAULT_TOTAL_ROUNDS = 3;

/**
 * Create a new room and insert the host as the first player.
 */
export async function createRoom(
  player: { id: string; name: string; avatarColor: string },
  totalRounds: number = DEFAULT_TOTAL_ROUNDS,
): Promise<{ room: Room; player: Player }> {
  // Generate a unique room code (retry on rare collision).
  let code = "";
  let attempts = 0;
  while (attempts < 5) {
    code = makeRoomCode();
    const { error } = await supabase.from("rooms").insert({
      code,
      host_id: player.id,
      status: "lobby",
      total_rounds: totalRounds,
      round_duration_ms: ROUND_DURATION_MS,
    });
    if (!error) break;
    if (error.code === "23505") {
      // unique violation — code collision, retry
      attempts++;
      continue;
    }
    throw error;
  }

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (roomErr || !room) throw roomErr ?? new Error("Room insert failed");
  await ensurePlayer(room.id, player);
  const { data: playerRow } = await supabase
    .from("players")
    .select("*")
    .eq("id", player.id)
    .maybeSingle();
  return { room: room as Room, player: playerRow as Player };
}

/**
 * Join an existing room by code. If the player was previously in the room
 * (same id), mark them reconnected; otherwise insert a new player row.
 */
export async function joinRoom(
  code: string,
  player: { id: string; name: string; avatarColor: string },
): Promise<{ room: Room; player: Player }> {
  const { data: room, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!room) throw new Error(`Room ${code} not found`);
  await ensurePlayer((room as Room).id, player);
  const { data: playerRow } = await supabase
    .from("players")
    .select("*")
    .eq("id", player.id)
    .maybeSingle();
  return { room: room as Room, player: playerRow as Player };
}

async function ensurePlayer(
  roomId: string,
  player: { id: string; name: string; avatarColor: string },
): Promise<void> {
  // Try insert; on conflict (same id), update name/color and reconnect.
  const { error } = await supabase.from("players").upsert(
    {
      id: player.id,
      room_id: roomId,
      name: player.name,
      avatar_color: player.avatarColor,
      is_connected: true,
    },
    { onConflict: "id" },
  );
  if (error) {
    // Could be a name collision within the room. Surface a friendly error.
    if (error.code === "23505") {
      throw new Error(`Name "${player.name}" is already taken in this room`);
    }
    throw error;
  }
}

/**
 * Mark a player as disconnected (preserves their score for reconnect).
 */
export async function setPlayerConnected(
  playerId: string,
  connected: boolean,
): Promise<void> {
  await supabase
    .from("players")
    .update({ is_connected: connected })
    .eq("id", playerId);
}

/**
 * Start the game: pick first drawer, first word, set round_started_at.
 * Only the host calls this.
 */
export async function startGame(roomId: string): Promise<void> {
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) throw new Error("Room not found");

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (!players || players.length === 0) throw new Error("No players in room");

  const firstDrawer = players[0] as Player;
  const word = pickRandomWord([]);

  await supabase.from("strokes").delete().eq("room_id", roomId);
  await supabase.from("guesses").delete().eq("room_id", roomId);
  await supabase.from("rounds").delete().eq("room_id", roomId);

  await supabase
    .from("rooms")
    .update({
      status: "playing",
      current_round: 0,
      current_word: word,
      drawer_id: firstDrawer.id,
      round_started_at: new Date().toISOString(),
      round_ended_at: null,
      used_words: [word],
    })
    .eq("id", roomId);
}

/**
 * End the current round (correct guess or timeout). Records the round summary,
 * clears the canvas for the next round, and either advances to the next
 * drawer or marks the game finished.
 *
 * Returns the round summary payload for UI display.
 */
export async function endRound(
  roomId: string,
  reason: "correct" | "timeout",
  winnerId: string | null,
  guessTimeMs: number | null,
): Promise<void> {
  // Lock: only one end-round per round. Use round_ended_at as the guard.
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) return;
  if (room.round_ended_at) return; // already ended

  const now = new Date().toISOString();
  const roundIndex = room.current_round;
  const word = room.current_word ?? "—";
  const drawerId = room.drawer_id;

  // Compute points. Faster guesses earn more.
  let pointsAwarded = 0;
  let drawingBonus = 0;
  if (reason === "correct" && winnerId && guessTimeMs != null) {
    const elapsedMs = guessTimeMs;
    const totalMs = room.round_duration_ms;
    // Linear: 100% of 100 pts at 0s, 10 pts at timeout.
    const ratio = Math.max(0, 1 - elapsedMs / totalMs);
    pointsAwarded = Math.round(10 + ratio * 90);
    // Drawer gets a flat bonus per correct guess.
    drawingBonus = 25;
  }

  // Insert round summary.
  await supabase.from("rounds").insert({
    room_id: roomId,
    round_index: roundIndex,
    drawer_id: drawerId,
    word,
    winner_id: winnerId,
    points_awarded: pointsAwarded,
    guess_time_ms: guessTimeMs,
    ended_at: now,
  });

  // Update scores atomically.
  if (winnerId) {
    const { data: winner } = await supabase
      .from("players")
      .select("*")
      .eq("id", winnerId)
      .maybeSingle();
    if (winner) {
      const fastest = winner.fastest_guess_ms;
      const newFastest =
        fastest == null ? guessTimeMs : Math.min(fastest, guessTimeMs ?? fastest);
      await supabase
        .from("players")
        .update({
          score: winner.score + pointsAwarded,
          correct_guesses: winner.correct_guesses + 1,
          fastest_guess_ms: newFastest,
        })
        .eq("id", winnerId);
    }
  }
  if (drawerId && drawingBonus > 0) {
    const { data: drawer } = await supabase
      .from("players")
      .select("*")
      .eq("id", drawerId)
      .maybeSingle();
    if (drawer) {
      await supabase
        .from("players")
        .update({
          score: drawer.score + drawingBonus,
          drawing_bonus: drawer.drawing_bonus + drawingBonus,
        })
        .eq("id", drawerId);
    }
  }

  // Mark round ended.
  await supabase
    .from("rooms")
    .update({ round_ended_at: now })
    .eq("id", roomId);
}

/**
 * Advance to the next round: pick next drawer, new word, clear canvas.
 * If no more rounds, mark game finished.
 */
export async function advanceRound(roomId: string): Promise<void> {
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) return;

  const nextRound = room.current_round + 1;
  if (nextRound >= room.total_rounds) {
    await supabase
      .from("rooms")
      .update({ status: "finished", round_ended_at: new Date().toISOString() })
      .eq("id", roomId);
    return;
  }

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (!players || players.length === 0) return;

  // Rotate drawer: next player after current drawer, wrapping around.
  const currentIdx = Math.max(
    0,
    players.findIndex((p) => p.id === room.drawer_id),
  );
  const nextIdx = (currentIdx + 1) % players.length;
  const nextDrawer = players[nextIdx] as Player;

  const used = Array.isArray(room.used_words) ? room.used_words : [];
  const word = pickRandomWord(used);
  const newUsed = [...used, word];

  // Clear canvas for the new round.
  await supabase
    .from("strokes")
    .delete()
    .eq("room_id", roomId)
    .eq("round_index", room.current_round);

  await supabase
    .from("rooms")
    .update({
      current_round: nextRound,
      drawer_id: nextDrawer.id,
      current_word: word,
      used_words: newUsed,
      round_started_at: new Date().toISOString(),
      round_ended_at: null,
    })
    .eq("id", roomId);
}

/**
 * Reset the room back to lobby for "Play Again". Keeps players, clears
 * scores, strokes, guesses, rounds.
 */
export async function playAgain(roomId: string): Promise<void> {
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId);
  if (players) {
    for (const p of players) {
      await supabase
        .from("players")
        .update({
          score: 0,
          correct_guesses: 0,
          drawing_bonus: 0,
          fastest_guess_ms: null,
          is_connected: true,
        })
        .eq("id", p.id);
    }
  }
  await supabase.from("strokes").delete().eq("room_id", roomId);
  await supabase.from("guesses").delete().eq("room_id", roomId);
  await supabase.from("rounds").delete().eq("room_id", roomId);
  await supabase
    .from("rooms")
    .update({
      status: "lobby",
      current_round: 0,
      current_word: null,
      drawer_id: null,
      round_started_at: null,
      round_ended_at: null,
      used_words: [],
    })
    .eq("id", roomId);
}

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
