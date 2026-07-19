import { memo } from "react";
import type { Player } from "../types/game";

interface ScoreboardProps {
  players: Player[];
  selfId: string;
  drawerId: string | null;
}

function ScoreboardImpl({ players, selfId, drawerId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="scoreboard">
      <div className="scoreboard__header">Scores</div>
      <ol className="scoreboard__list">
        {sorted.map((p) => {
          const isYou = p.id === selfId;
          const isDrawing = p.id === drawerId;
          return (
            <li
              key={p.id}
              className={`scoreboard__item ${isYou ? "is-you" : ""} ${isDrawing ? "is-drawing" : ""} ${!p.is_connected ? "is-offline" : ""}`}
            >
              <span className="scoreboard__avatar" style={{ background: p.avatar_color }}>
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span className="scoreboard__name">
                {p.name}
                {isYou && <span className="scoreboard__you-tag">you</span>}
                {isDrawing && <span className="scoreboard__drawing-tag">drawing</span>}
                {!p.is_connected && <span className="scoreboard__offline-tag">offline</span>}
              </span>
              <span className="scoreboard__score" key={p.score}>
                {p.score}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const Scoreboard = memo(ScoreboardImpl);
