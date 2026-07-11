import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Player, Room, ChatMessage, WORDS, ROUND_DURATION, ROUND_ENDING_DURATION } from '../lib/types';
import { generateRoomCode, getPlayerId, getNickname, setNickname as setStoredNickname } from '../lib/utils';

interface DrawingStroke {
  points: { x: number; y: number }[];
  color: string;
  brushSize: number;
}

export function useGame() {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [drawingData, setDrawingData] = useState<DrawingStroke[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPlayerId = getPlayerId();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceLockRef = useRef(false);
  const lastDrawerRef = useRef<string | null>(null);

  // ─── Create Room ──────────────────────────────────────────────
  const createRoom = useCallback(async (nickname: string) => {
    setIsLoading(true);
    setError(null);
    setStoredNickname(nickname);

    try {
      await supabase.from('players').delete().eq('id', currentPlayerId);

      const code = generateRoomCode();

      // Room and players have a circular FK (rooms.host_id → players.id,
      // players.room_id → rooms.id). Insert room with null host_id first,
      // then create the player, then set host_id on the room.
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({ code, host_id: null })
        .select()
        .single();

      if (roomError || !roomData) throw roomError;

      const { error: playerError } = await supabase.from('players').insert({
        id: currentPlayerId,
        nickname,
        room_id: roomData.id,
        is_host: true,
        is_drawer: false,
      });

      if (playerError) throw playerError;

      await supabase
        .from('rooms')
        .update({ host_id: currentPlayerId })
        .eq('id', roomData.id);

      setRoom({ ...roomData, host_id: currentPlayerId });
      setPlayers([{
        id: currentPlayerId,
        nickname,
        room_id: roomData.id,
        score: 0,
        is_drawer: false,
        is_host: true,
        joined_at: new Date().toISOString(),
        has_guessed_this_round: false,
        correct_guesses: 0,
        times_as_drawer: 0,
      }]);

      localStorage.setItem('sketchguess_room_id', roomData.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  }, [currentPlayerId]);

  // ─── Join Room ────────────────────────────────────────────────
  const joinRoom = useCallback(async (nickname: string, roomCode: string) => {
    setIsLoading(true);
    setError(null);
    setStoredNickname(nickname);

    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select()
        .eq('code', roomCode.toUpperCase())
        .maybeSingle();

      if (roomError) throw roomError;
      if (!roomData) throw new Error('Room not found');
      if (roomData.status === 'ended') throw new Error('Game has already ended');

      const { data: existingPlayers } = await supabase
        .from('players')
        .select()
        .eq('room_id', roomData.id);

      if (existingPlayers && existingPlayers.some((p) => p.id === currentPlayerId)) {
        setRoom(roomData);
        setPlayers(existingPlayers as Player[]);
        localStorage.setItem('sketchguess_room_id', roomData.id);
        return;
      }

      if (existingPlayers && existingPlayers.length >= 8) {
        throw new Error('Room is full (max 8 players)');
      }

      const { error: playerError } = await supabase.from('players').insert({
        id: currentPlayerId,
        nickname,
        room_id: roomData.id,
        is_host: false,
        is_drawer: false,
      });

      if (playerError) throw playerError;

      const { data: allPlayers } = await supabase
        .from('players')
        .select()
        .eq('room_id', roomData.id);

      setRoom(roomData);
      setPlayers((allPlayers || []) as Player[]);
      localStorage.setItem('sketchguess_room_id', roomData.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  }, [currentPlayerId]);

  // ─── Leave Room ───────────────────────────────────────────────
  const leaveRoom = useCallback(async () => {
    if (!room) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await supabase.from('players').delete().eq('id', currentPlayerId).eq('room_id', room.id);

      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id);

      if (count === 0) {
        await supabase.from('drawing_strokes').delete().eq('room_id', room.id);
        await supabase.from('messages').delete().eq('room_id', room.id);
        await supabase.from('rooms').delete().eq('id', room.id);
      } else if (room.host_id === currentPlayerId) {
        const { data: remaining } = await supabase
          .from('players')
          .select()
          .eq('room_id', room.id)
          .order('joined_at')
          .limit(1)
          .single();

        if (remaining) {
          await supabase.from('rooms').update({ host_id: remaining.id }).eq('id', room.id);
          await supabase.from('players').update({ is_host: true }).eq('id', remaining.id);
        }
      }

      localStorage.removeItem('sketchguess_room_id');
      setRoom(null);
      setPlayers([]);
      setMessages([]);
      setDrawingData([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave room');
    }
  }, [room, currentPlayerId]);

  // ─── Start Game ───────────────────────────────────────────────
  const startGame = useCallback(async () => {
    if (!room || players.length < room.min_players) return;
    const currentPlayer = players.find((p) => p.id === currentPlayerId);
    if (!currentPlayer?.is_host) return;

    advanceLockRef.current = false;

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const firstDrawer = shuffled[0];
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];

    await supabase.from('players')
      .update({ score: 0, has_guessed_this_round: false, is_drawer: false, correct_guesses: 0, times_as_drawer: 0 })
      .eq('room_id', room.id);

    await supabase.from('players')
      .update({ is_drawer: true, times_as_drawer: 1 })
      .eq('id', firstDrawer.id);

    await supabase.from('drawing_strokes').delete().eq('room_id', room.id);
    await supabase.from('messages').delete().eq('room_id', room.id);

    await supabase.from('rooms').update({
      status: 'playing',
      round_number: 1,
      current_word: word,
      time_remaining: ROUND_DURATION,
      current_drawer_id: firstDrawer.id,
      drawer_awarded_this_round: false,
      round_ending: false,
    }).eq('id', room.id);

    setDrawingData([]);
    setMessages([]);
  }, [room, players, currentPlayerId]);

  // ─── Play Again ───────────────────────────────────────────────
  const playAgain = useCallback(async () => {
    if (!room) return;
    const currentPlayer = players.find((p) => p.id === currentPlayerId);
    if (!currentPlayer?.is_host) return;

    advanceLockRef.current = false;

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const firstDrawer = shuffled[0];
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];

    await supabase.from('players')
      .update({ score: 0, has_guessed_this_round: false, is_drawer: false, correct_guesses: 0, times_as_drawer: 0 })
      .eq('room_id', room.id);

    await supabase.from('players')
      .update({ is_drawer: true, times_as_drawer: 1 })
      .eq('id', firstDrawer.id);

    await supabase.from('drawing_strokes').delete().eq('room_id', room.id);
    await supabase.from('messages').delete().eq('room_id', room.id);

    await supabase.from('rooms').update({
      status: 'playing',
      round_number: 1,
      current_word: word,
      time_remaining: ROUND_DURATION,
      current_drawer_id: firstDrawer.id,
      drawer_awarded_this_round: false,
      round_ending: false,
    }).eq('id', room.id);

    setDrawingData([]);
    setMessages([]);
  }, [room, players, currentPlayerId]);

  // ─── Return to Lobby ──────────────────────────────────────────
  const returnToLobby = useCallback(async () => {
    if (!room) return;
    const currentPlayer = players.find((p) => p.id === currentPlayerId);
    if (!currentPlayer?.is_host) return;

    await supabase.from('players')
      .update({ is_drawer: false, has_guessed_this_round: false })
      .eq('room_id', room.id);

    await supabase.from('drawing_strokes').delete().eq('room_id', room.id);
    await supabase.from('messages').delete().eq('room_id', room.id);

    await supabase.from('rooms').update({
      status: 'waiting',
      round_number: 0,
      current_word: null,
      current_drawer_id: null,
      time_remaining: ROUND_DURATION,
      drawer_awarded_this_round: false,
      round_ending: false,
    }).eq('id', room.id);

    setDrawingData([]);
    setMessages([]);
  }, [room, players, currentPlayerId]);

  // ─── Update Settings ──────────────────────────────────────────
  const updateSettings = useCallback(async (minPlayers: number, maxRounds: number) => {
    if (!room) return;
    const currentPlayer = players.find((p) => p.id === currentPlayerId);
    if (!currentPlayer?.is_host) return;

    await supabase.from('rooms').update({
      min_players: minPlayers,
      max_rounds: maxRounds,
    }).eq('id', room.id);
  }, [room, players, currentPlayerId]);

  // ─── Send Guess ───────────────────────────────────────────────
  const sendMessage = useCallback(async (content: string) => {
    if (!room || room.round_ending) return;

    const player = players.find((p) => p.id === currentPlayerId);
    if (!player || player.is_drawer || player.has_guessed_this_round) return;

    const { data, error } = await supabase.rpc('submit_guess', {
      p_room_id: room.id,
      p_player_id: currentPlayerId,
      p_content: content,
    });

    if (error) {
      console.error('submit_guess error:', error);
      return;
    }

    const result = data as { is_correct: boolean; awarded: boolean; all_guessed: boolean };

    if (result.is_correct && result.all_guessed && !room.round_ending) {
      const currentPlayer = players.find((p) => p.id === currentPlayerId);
      if (currentPlayer?.is_host && !advanceLockRef.current) {
        advanceLockRef.current = true;
        await supabase.from('rooms').update({ round_ending: true, time_remaining: 0 }).eq('id', room.id);
        await new Promise((r) => setTimeout(r, ROUND_ENDING_DURATION * 1000));
        const newWord = WORDS[Math.floor(Math.random() * WORDS.length)];
        await supabase.rpc('advance_round', { p_room_id: room.id, p_new_word: newWord });
        advanceLockRef.current = false;
      }
    }
  }, [room, players, currentPlayerId]);

  // ─── Send Draw Stroke ─────────────────────────────────────────
  const sendDraw = useCallback(async (points: { x: number; y: number }[], color: string, brushSize: number) => {
    if (!room || room.round_ending) return;
    const player = players.find((p) => p.id === currentPlayerId);
    if (!player || !player.is_drawer) return;

    await supabase.from('drawing_strokes').insert({
      room_id: room.id,
      player_id: currentPlayerId,
      points,
      color,
      brush_size: brushSize,
    });
  }, [room, players, currentPlayerId]);

  // ─── Clear Canvas ─────────────────────────────────────────────
  const clearCanvas = useCallback(async () => {
    if (!room) return;
    const player = players.find((p) => p.id === currentPlayerId);
    if (!player || !player.is_drawer) return;

    await supabase.from('drawing_strokes').delete().eq('room_id', room.id);
    setDrawingData([]);
  }, [room, players, currentPlayerId]);

  // ─── Global Timer (Host Only) ─────────────────────────────────
  useEffect(() => {
    if (!room || room.status !== 'playing') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const currentPlayer = players.find((p) => p.id === currentPlayerId);
    if (!currentPlayer?.is_host) return;

    if (room.round_ending) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(async () => {
      const { data: latest, error } = await supabase
        .from('rooms')
        .select('time_remaining, status, round_ending')
        .eq('id', room.id)
        .single();

      if (error || !latest) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      if (latest.status !== 'playing' || latest.round_ending) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      const newTime = latest.time_remaining - 1;

      if (newTime <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (advanceLockRef.current) return;
        advanceLockRef.current = true;

        await supabase.from('rooms')
          .update({ time_remaining: 0, round_ending: true })
          .eq('id', room.id);

        await new Promise((r) => setTimeout(r, ROUND_ENDING_DURATION * 1000));

        const newWord = WORDS[Math.floor(Math.random() * WORDS.length)];
        await supabase.rpc('advance_round', { p_room_id: room.id, p_new_word: newWord });
        advanceLockRef.current = false;
        return;
      }

      await supabase.from('rooms')
        .update({ time_remaining: newTime })
        .eq('id', room.id);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [room?.id, room?.status, room?.round_ending, room?.round_number, room?.current_drawer_id, players, currentPlayerId]);

  // ─── Stuck Round Recovery ────────────────────────────────────
  useEffect(() => {
    if (!room || room.status !== 'playing' || !room.round_ending) return;
    if (room.time_remaining > 0) return;

    const currentPlayer = players.find((p) => p.id === currentPlayerId);
    if (!currentPlayer?.is_host) return;
    if (advanceLockRef.current) return;

    advanceLockRef.current = true;
    const timeout = setTimeout(async () => {
      const newWord = WORDS[Math.floor(Math.random() * WORDS.length)];
      await supabase.rpc('advance_round', { p_room_id: room.id, p_new_word: newWord });
      advanceLockRef.current = false;
    }, ROUND_ENDING_DURATION * 1000);

    return () => clearTimeout(timeout);
  }, [room?.id, room?.status, room?.round_ending, room?.time_remaining, players, currentPlayerId]);

  // ─── Realtime Subscriptions ───────────────────────────────────
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`game:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          const newRoom = payload.new as Room;
          if (newRoom.current_drawer_id !== lastDrawerRef.current) {
            lastDrawerRef.current = newRoom.current_drawer_id;
            setDrawingData([]);
            setMessages([]);
          }
          setRoom(newRoom);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` },
        async () => {
          const { data } = await supabase.from('players').select().eq('room_id', room.id);
          if (data) setPlayers(data as Player[]);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as ChatMessage];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'drawing_strokes', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const data = payload.new as any;
          setDrawingData((prev) => [...prev, {
            points: data.points,
            color: data.color,
            brushSize: data.brush_size,
          }]);
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'drawing_strokes', filter: `room_id=eq.${room.id}` },
        () => setDrawingData([]),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        () => setMessages([]),
      )
      .subscribe();

    supabase.from('messages').select('*').eq('room_id', room.id).order('created_at', { ascending: true }).then(({ data }) => {
      if (data) setMessages(data as ChatMessage[]);
    });

    supabase.from('drawing_strokes').select('*').eq('room_id', room.id).order('created_at', { ascending: true }).then(({ data }) => {
      if (data) {
        setDrawingData(data.map((s) => ({
          points: s.points as { x: number; y: number }[],
          color: s.color,
          brushSize: s.brush_size,
        })));
      }
    });

    supabase.from('players').select().eq('room_id', room.id).then(({ data }) => {
      if (data) setPlayers(data as Player[]);
    });

    lastDrawerRef.current = room.current_drawer_id;

    return () => {
      supabase.removeChannel(channel);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [room?.id]);

  // ─── Restore room on page reload ──────────────────────────────
  useEffect(() => {
    const savedRoomId = localStorage.getItem('sketchguess_room_id');
    if (savedRoomId && !room) {
      supabase.from('rooms').select().eq('id', savedRoomId).maybeSingle().then(({ data }) => {
        if (data) {
          setRoom(data as Room);
          lastDrawerRef.current = data.current_drawer_id;
          supabase.from('players').select().eq('room_id', data.id).then(({ data: pData }) => {
            if (pData) setPlayers(pData as Player[]);
          });
        } else {
          localStorage.removeItem('sketchguess_room_id');
        }
      });
    }
  }, [currentPlayerId]);

  return {
    room,
    players,
    messages,
    drawingData,
    isLoading,
    error,
    currentPlayerId,
    currentNickname: getNickname(),
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    playAgain,
    returnToLobby,
    updateSettings,
    sendMessage,
    sendDraw,
    clearCanvas,
    clearDrawingData: () => setDrawingData([]),
  };
}
