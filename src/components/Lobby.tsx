import { memo, useState } from "react";
import { AVATAR_COLORS } from "../lib/colors";
import { recallPlayer } from "../lib/playerId";

interface LobbyProps {
  onJoin: (name: string, color: string, code: string) => void;
  onCreate: (name: string, color: string) => void;
  initialCode?: string;
}

function LobbyImpl({ onJoin, onCreate, initialCode }: LobbyProps) {
  const recalled = recallPlayer();
  const [name, setName] = useState(recalled.name ?? "");
  const [color, setColor] = useState(recalled.color ?? AVATAR_COLORS[6]);
  const [code, setCode] = useState(initialCode ?? "");
  const [mode, setMode] = useState<"join" | "create">(initialCode ? "join" : "create");

  const validName = name.trim().length >= 2;

  const submit = () => {
    if (!validName) return;
    if (mode === "create") onCreate(name.trim(), color);
    else if (code.trim().length >= 4) onJoin(name.trim(), color, code.trim().toUpperCase());
  };

  return (
    <div className="lobby">
      <div className="lobby__card">
        <div className="lobby__brand">
          <span className="lobby__logo">✏️</span>
          <h1 className="lobby__title">Scribble</h1>
          <p className="lobby__subtitle">Draw it. Guess it. Win it.</p>
        </div>

        <div className="lobby__tabs">
          <button
            type="button"
            className={`lobby__tab ${mode === "create" ? "is-active" : ""}`}
            onClick={() => setMode("create")}
          >
            Create Room
          </button>
          <button
            type="button"
            className={`lobby__tab ${mode === "join" ? "is-active" : ""}`}
            onClick={() => setMode("join")}
          >
            Join Room
          </button>
        </div>

        <label className="lobby__field">
          <span>Nickname</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            placeholder="Your name"
            autoComplete="off"
          />
        </label>

        <div className="lobby__field">
          <span>Avatar color</span>
          <div className="lobby__colors">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`lobby__color ${color === c ? "is-active" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Avatar color ${c}`}
              />
            ))}
          </div>
        </div>

        {mode === "join" && (
          <label className="lobby__field">
            <span>Room code</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={4}
              placeholder="ABCD"
              autoComplete="off"
            />
          </label>
        )}

        <button
          type="button"
          className="btn btn--primary lobby__submit"
          onClick={submit}
          disabled={!validName || (mode === "join" && code.trim().length < 4)}
        >
          {mode === "create" ? "Create Room" : "Join Room"}
        </button>
      </div>
    </div>
  );
}

export const Lobby = memo(LobbyImpl);
