import { memo, useEffect, useState } from "react";
import type { Player, RoundSummary as RoundSummaryType } from "../types/game";

interface RoundSummaryProps {
  round: RoundSummaryType | null;
  players: Player[];
  drawerName: string;
  isLastRound: boolean;
  onDone: () => void;
}

function RoundSummaryImpl({
  round,
  players,
  drawerName,
  isLastRound,
  onDone,
}: RoundSummaryProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
  }, []);

  if (!round) return null;
  const winner = players.find((p) => p.id === round.winner_id) ?? null;
  const top = [...players].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className={`overlay ${visible ? "is-visible" : ""}`}>
      <div className="overlay__card round-summary">
        <div className="round-summary__title">
          {round.winner_id ? "Word guessed!" : "Time's up!"}
        </div>
        <div className="round-summary__word">
          The word was <span className="round-summary__word-text">{round.word}</span>
        </div>
        <div className="round-summary__meta">
          <div>Drawer: <strong>{drawerName}</strong></div>
          {winner && (
            <div>
              Winner: <strong>{winner.name}</strong> · +{round.points_awarded} pts
              {round.guess_time_ms != null && (
                <span className="round-summary__time">
                  {" "}· {(round.guess_time_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          )}
          {!winner && <div>No one guessed correctly.</div>}
        </div>
        <div className="round-summary__board">
          {top.map((p, i) => (
            <div key={p.id} className="round-summary__row">
              <span className="round-summary__rank">{i + 1}</span>
              <span className="round-summary__name">{p.name}</span>
              <span className="round-summary__score">{p.score}</span>
            </div>
          ))}
        </div>
        <div className="round-summary__next">
          {isLastRound ? "Final results coming up…" : "Next round starting…"}
        </div>
        <button type="button" className="btn btn--primary" onClick={onDone}>
          {isLastRound ? "Show Final Results" : "Continue"}
        </button>
      </div>
    </div>
  );
}

export const RoundSummary = memo(RoundSummaryImpl);
