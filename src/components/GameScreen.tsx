import { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "./Canvas";
import { Chat } from "./Chat";
import { FinalLeaderboard } from "./FinalLeaderboard";
import { RoundSummary } from "./RoundSummary";
import { Scoreboard } from "./Scoreboard";
import { Timer } from "./Timer";
import { Toolbar } from "./Toolbar";
import { WordPrompt } from "./WordPrompt";
import { useGameRoom } from "../hooks/useGameRoom";
import { useTimer } from "../hooks/useTimer";
import { SUMMARY_DURATION_MS } from "../lib/gameEngine";
import { supabase } from "../lib/supabase";
import type { Tool } from "../types/game";

interface GameScreenProps {
  selfId: string;
  selfName: string;
  selfColor: string;
  roomCode: string;
  onExit: () => void;
}

export function GameScreen({ selfId, selfName, selfColor, roomCode, onExit }: GameScreenProps) {
  const game = useGameRoom({ selfId, selfName, selfColor, roomCode });
  const [color, setColor] = useState("#1f2937");
  const [size, setSize] = useState(4);
  const [tool, setTool] = useState<Tool>("brush");
  const [summaryDismissed, setSummaryDismissed] = useState(false);

  const room = game.room;
  const roundEnded = room?.round_ended_at != null;
  const isFinished = room?.status === "finished";

  // Synchronized timer. onExpire fires once when the round hits zero.
  const onExpire = useCallback(() => {
    void game.handleTimeout();
  }, [game]);
  const remaining = useTimer(room?.round_started_at ?? null, room?.round_duration_ms ?? 80000, onExpire);

  // Auto-advance after the round summary has been shown for a few seconds.
  useEffect(() => {
    if (!roundEnded || isFinished || !game.isHost) return;
    setSummaryDismissed(false);
    const id = window.setTimeout(() => {
      void game.handleAdvance();
    }, SUMMARY_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [roundEnded, isFinished, game.isHost, game]);

  // The most recent round summary for the current round.
  const currentRoundSummary = useMemo(() => {
    if (!room || !roundEnded) return null;
    return game.rounds.find((r) => r.round_index === room.current_round) ?? null;
  }, [game.rounds, room, roundEnded]);

  const drawerName = useMemo(() => {
    if (!room?.drawer_id) return "—";
    return game.players.find((p) => p.id === room.drawer_id)?.name ?? "—";
  }, [room?.drawer_id, game.players]);

  const isLastRound = room != null && room.current_round >= room.total_rounds - 1;

  const handleCommitStroke = useCallback(
    (stroke: Omit<Parameters<typeof game.sendStroke>[0], "room_id" | "id" | "created_at">) => {
      void game.sendStroke(stroke);
    },
    [game],
  );

  const handleClear = useCallback(() => {
    void game.clearCanvas();
  }, [game]);

  const handleContinue = useCallback(() => {
    setSummaryDismissed(true);
    if (game.isHost) void game.handleAdvance();
  }, [game]);

  if (game.loading) {
    return (
      <div className="screen screen--loading">
        <div className="spinner" />
        <p>Joining room {roomCode}…</p>
      </div>
    );
  }

  if (game.error) {
    return (
      <div className="screen screen--error">
        <div className="overlay__card">
          <h2>Couldn't join the room</h2>
          <p>{game.error}</p>
          <button type="button" className="btn btn--primary" onClick={onExit}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (!room) return null;

  if (isFinished) {
    return (
      <div className="screen">
        <FinalLeaderboard
          players={game.players}
          onPlayAgain={() => void game.handlePlayAgain()}
          onExit={onExit}
        />
      </div>
    );
  }

  // Lobby state — host can start when 2+ players.
  if (room.status === "lobby") {
    const canStart = game.isHost && game.players.length >= 2;
    return (
      <div className="screen screen--lobby-room">
        <div className="overlay__card lobby-room">
          <h2>Room {room.code}</h2>
          <p className="lobby-room__hint">
            Share this code with friends. {game.isHost ? "You are the host." : "Waiting for host to start…"}
          </p>
          <div className="lobby-room__players">
            {game.players.map((p) => (
              <div key={p.id} className="lobby-room__player">
                <span className="lobby-room__avatar" style={{ background: p.avatar_color }}>
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span>{p.name}{p.id === selfId ? " (you)" : ""}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void game.start()}
            disabled={!canStart}
          >
            {game.isHost
              ? canStart
                ? "Start Game"
                : "Need 2+ players"
              : "Waiting for host…"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onExit}>
            Leave
          </button>
        </div>
      </div>
    );
  }

  const canDraw = game.isDrawer && !roundEnded;
  const canGuess = !game.isDrawer && !roundEnded;

  return (
    <div className="screen screen--game">
      <header className="game-header">
        <div className="game-header__left">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onExit}>
            Leave
          </button>
          <span className="game-header__room">Room {room.code}</span>
          <span className="game-header__round">
            Round {room.current_round + 1} / {room.total_rounds}
          </span>
        </div>
        <WordPrompt
          word={room.current_word}
          isDrawer={game.isDrawer}
          roundEnded={roundEnded}
        />
        <Timer remainingMs={remaining} totalMs={room.round_duration_ms} />
      </header>

      <div className="game-body">
        <aside className="game-body__left">
          <Scoreboard players={game.players} selfId={selfId} drawerId={room.drawer_id} />
        </aside>

        <main className="game-body__center">
          <Toolbar
            color={color}
            size={size}
            tool={tool}
            canDraw={canDraw}
            onColor={setColor}
            onSize={setSize}
            onTool={setTool}
            onUndo={() => {
              // Undo: delete the last stroke from this round. Realtime DELETE
              // syncs the canvas clear/redraw to all clients.
              void (async () => {
                if (!game.isDrawer || roundEnded) return;
                const { data } = await supabase
                  .from("strokes")
                  .select("id")
                  .eq("room_id", room.id)
                  .eq("round_index", room.current_round)
                  .order("created_at", { ascending: false })
                  .limit(1);
                if (data && data.length > 0) {
                  await supabase.from("strokes").delete().eq("id", data[0].id);
                }
              })();
            }}
            onClear={handleClear}
          />
          <Canvas
            canDraw={canDraw}
            color={color}
            size={size}
            tool={tool}
            strokes={game.strokes}
            onCommitStroke={handleCommitStroke}
          />
          {!canDraw && !roundEnded && (
            <div className="game-body__hint">Watch and guess in the chat →</div>
          )}
        </main>

        <aside className="game-body__right">
          <Chat
            guesses={game.guesses}
            canGuess={canGuess}
            onSubmit={(t) => void game.submitGuess(t)}
          />
        </aside>
      </div>

      {roundEnded && currentRoundSummary && !summaryDismissed && (
        <RoundSummary
          round={currentRoundSummary}
          players={game.players}
          drawerName={drawerName}
          isLastRound={isLastRound}
          onDone={handleContinue}
        />
      )}
    </div>
  );
}
