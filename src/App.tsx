import { useCallback, useEffect, useState } from "react";
import { Lobby } from "./components/Lobby";
import { GameScreen } from "./components/GameScreen";
import { createRoom } from "./lib/gameEngine";
import { getOrCreatePlayerId, rememberPlayer } from "./lib/playerId";

export default function App() {
  const [selfId] = useState(() => getOrCreatePlayerId());
  const [session, setSession] = useState<{ name: string; color: string; code: string } | null>(
    null,
  );

  // Parse room code from URL hash (#ABCD) so links can deep-link into a room.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "").toUpperCase();
    if (hash.length === 4 && /^[A-Z0-9]+$/.test(hash)) {
      // Pre-fill the join field via localStorage hint; Lobby reads its own initial.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleJoin = useCallback((name: string, color: string, code: string) => {
    rememberPlayer(name, color);
    setSession({ name, color, code });
  }, []);

  const handleCreate = useCallback(async (name: string, color: string) => {
    rememberPlayer(name, color);
    const { room } = await createRoom({ id: selfId, name, avatarColor: color });
    setSession({ name, color, code: room.code });
  }, [selfId]);

  const handleExit = useCallback(() => {
    setSession(null);
  }, []);

  if (!session) {
    return (
      <Lobby
        onJoin={handleJoin}
        onCreate={handleCreate}
        initialCode={window.location.hash.replace(/^#/, "").toUpperCase() || undefined}
      />
    );
  }

  return (
    <GameScreen
      selfId={selfId}
      selfName={session.name}
      selfColor={session.color}
      roomCode={session.code}
      onExit={handleExit}
    />
  );
}
