import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  advanceRound,
  endRound,
  joinRoom,
  playAgain,
  setPlayerConnected,
  startGame,
} from "../lib/gameEngine";
import { isCorrectGuess } from "../lib/words";
import type {
  Guess,
  Player,
  Room,
  RoundSummary,
  Stroke,
} from "../types/game";

interface UseGameRoomArgs {
  selfId: string;
  selfName: string;
  selfColor: string;
  roomCode: string | null;
}

interface GameState {
  room: Room | null;
  players: Player[];
  strokes: Stroke[];
  guesses: Guess[];
  rounds: RoundSummary[];
  loading: boolean;
  error: string | null;
}

export function useGameRoom({ selfId, selfName, selfColor, roomCode }: UseGameRoomArgs) {
  const [state, setState] = useState<GameState>({
    room: null,
    players: [],
    strokes: [],
    guesses: [],
    rounds: [],
    loading: true,
    error: null,
  });

  // Track whether we've already awarded a correct guess this round to prevent
  // duplicate scoring race conditions across clients.
  const roundEndedRef = useRef(false);
  // Track subscribed channels so we can clean them up exactly once on unmount.
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const mountedRef = useRef(true);

  // ---- Initial load / join ----
  useEffect(() => {
    mountedRef.current = true;
    if (!roomCode) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { room } = await joinRoom(roomCode, {
          id: selfId,
          name: selfName,
          avatarColor: selfColor,
        });
        if (cancelled || !mountedRef.current) return;

        const [playersRes, strokesRes, guessesRes, roundsRes] = await Promise.all([
          supabase.from("players").select("*").eq("room_id", room.id).order("joined_at", { ascending: true }),
          supabase.from("strokes").select("*").eq("room_id", room.id).order("created_at", { ascending: true }),
          supabase.from("guesses").select("*").eq("room_id", room.id).order("created_at", { ascending: true }).limit(100),
          supabase.from("rounds").select("*").eq("room_id", room.id).order("round_index", { ascending: true }),
        ]);

        if (cancelled || !mountedRef.current) return;

        roundEndedRef.current = room.round_ended_at != null;

        setState({
          room,
          players: (playersRes.data as Player[]) ?? [],
          strokes: (strokesRes.data as Stroke[]) ?? [],
          guesses: (guessesRes.data as Guess[]) ?? [],
          rounds: (roundsRes.data as RoundSummary[]) ?? [],
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to join room",
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomCode, selfId, selfName, selfColor]);

  // ---- Realtime subscriptions (created once, cleaned up on unmount) ----
  useEffect(() => {
    if (!state.room) return;

    const roomId = state.room.id;

    const playersCh = supabase
      .channel(`players:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        async () => {
          const { data } = await supabase
            .from("players")
            .select("*")
            .eq("room_id", roomId)
            .order("joined_at", { ascending: true });
          if (mountedRef.current) {
            setState((s) => ({ ...s, players: (data as Player[]) ?? [] }));
          }
        },
      )
      .subscribe();

    const roomCh = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        async (payload) => {
          const updated = payload.new as Room;
          roundEndedRef.current = updated.round_ended_at != null;
          if (mountedRef.current) {
            setState((s) => ({ ...s, room: updated }));
          }
        },
      )
      .subscribe();

    const strokesCh = supabase
      .channel(`strokes:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "strokes", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const stroke = payload.new as Stroke;
          if (mountedRef.current) {
            setState((s) => ({ ...s, strokes: [...s.strokes, stroke] }));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "strokes", filter: `room_id=eq.${roomId}` },
        async () => {
          const { data } = await supabase
            .from("strokes")
            .select("*")
            .eq("room_id", roomId)
            .order("created_at", { ascending: true });
          if (mountedRef.current) {
            setState((s) => ({ ...s, strokes: (data as Stroke[]) ?? [] }));
          }
        },
      )
      .subscribe();

    const guessesCh = supabase
      .channel(`guesses:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "guesses", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const guess = payload.new as Guess;
          if (mountedRef.current) {
            setState((s) => ({ ...s, guesses: [...s.guesses, guess].slice(-100) }));
          }
        },
      )
      .subscribe();

    const roundsCh = supabase
      .channel(`rounds:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rounds", filter: `room_id=eq.${roomId}` },
        async () => {
          const { data } = await supabase
            .from("rounds")
            .select("*")
            .eq("room_id", roomId)
            .order("round_index", { ascending: true });
          if (mountedRef.current) {
            setState((s) => ({ ...s, rounds: (data as RoundSummary[]) ?? [] }));
          }
        },
      )
      .subscribe();

    channelsRef.current = [playersCh, roomCh, strokesCh, guessesCh, roundsCh];

    return () => {
      for (const ch of channelsRef.current) {
        try {
          supabase.removeChannel(ch);
        } catch {
          /* ignore */
        }
      }
      channelsRef.current = [];
    };
  }, [state.room?.id]);

  // ---- Mark disconnected on unmount / pagehide ----
  useEffect(() => {
    const markOff = () => setPlayerConnected(selfId, false);
    window.addEventListener("pagehide", markOff);
    window.addEventListener("beforeunload", markOff);
    return () => {
      window.removeEventListener("pagehide", markOff);
      window.removeEventListener("beforeunload", markOff);
      markOff();
    };
  }, [selfId]);

  // ---- Actions ----

  const start = useCallback(async () => {
    if (!state.room) return;
    try {
      await startGame(state.room.id);
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : "Failed to start" }));
    }
  }, [state.room]);

  const submitGuess = useCallback(
    async (text: string) => {
      if (!state.room || !text.trim()) return;
      const room = state.room;
      // Don't accept guesses from the drawer or after the round ended.
      if (room.drawer_id === selfId) return;
      if (room.round_ended_at) return;
      if (!room.current_word) return;

      const correct = isCorrectGuess(text, room.current_word);
      const guessTimeMs =
        room.round_started_at != null
          ? Date.now() - new Date(room.round_started_at).getTime()
          : null;

      await supabase.from("guesses").insert({
        room_id: room.id,
        player_id: selfId,
        player_name: selfName,
        text: text.trim(),
        is_correct: correct,
      });

      if (correct && !roundEndedRef.current) {
        roundEndedRef.current = true;
        // End the round immediately — first correct guess wins.
        await endRound(room.id, "correct", selfId, guessTimeMs);
      }
    },
    [state.room, selfId, selfName],
  );

  const sendStroke = useCallback(
    async (stroke: Omit<Stroke, "id" | "room_id" | "created_at">) => {
      if (!state.room) return;
      if (state.room.round_ended_at) return; // no drawing after round end
      if (state.room.drawer_id !== selfId) return; // only drawer draws
      await supabase.from("strokes").insert({
        room_id: state.room.id,
        round_index: state.room.current_round,
        points: stroke.points,
        color: stroke.color,
        size: stroke.size,
        tool: stroke.tool,
      });
    },
    [state.room, selfId],
  );

  const clearCanvas = useCallback(async () => {
    if (!state.room) return;
    if (state.room.drawer_id !== selfId) return;
    if (state.room.round_ended_at) return;
    await supabase
      .from("strokes")
      .delete()
      .eq("room_id", state.room.id)
      .eq("round_index", state.room.current_round);
  }, [state.room, selfId]);

  const handleTimeout = useCallback(async () => {
    if (!state.room) return;
    if (roundEndedRef.current) return;
    roundEndedRef.current = true;
    await endRound(state.room.id, "timeout", null, null);
  }, [state.room]);

  const handleAdvance = useCallback(async () => {
    if (!state.room) return;
    await advanceRound(state.room.id);
  }, [state.room]);

  const handlePlayAgain = useCallback(async () => {
    if (!state.room) return;
    await playAgain(state.room.id);
  }, [state.room]);

  return {
    ...state,
    selfId,
    isHost: state.room?.host_id === selfId,
    isDrawer: state.room?.drawer_id === selfId,
    start,
    submitGuess,
    sendStroke,
    clearCanvas,
    handleTimeout,
    handleAdvance,
    handlePlayAgain,
  };
}
