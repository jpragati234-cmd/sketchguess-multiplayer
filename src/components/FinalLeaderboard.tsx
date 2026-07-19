import { memo, useEffect, useState } from "react";
import type { Player } from "../types/game";

interface FinalLeaderboardProps {
  players: Player[];
  onPlayAgain: () => void;
  onExit: () => void;
}

function FinalLeaderboardImpl({ players, onPlayAgain, onExit }: FinalLeaderboardProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
  }, []);

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0] ?? null;

  return (
    <div className={`overlay ${visible ? "is-visible" : ""}`}>
      <div className="overlay__card leaderboard">
        <div className="leaderboard__title">Final Leaderboard</div>
        {winner && (
          <div className="leaderboard__winner">
            <span className="leaderboard__crown">★</span>
            <span className="leaderboard__winner-name">{winner.name}</span>
            <span className="leaderboard__winner-score">{winner.score} pts</span>
          </div>
        )}
        <div className="leaderboard__table">
          <div className="leaderboard__header-row">
            <span>#</span>
            <span>Player</span>
            <span>Score</span>
            <span>Correct</span>
            <span>Fastest</span>
            <span>Bonus</span>
          </div>
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`leaderboard__row ${i === 0 ? "is-winner" : ""}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="leaderboard__rank">{i + 1}</span>
              <span className="leaderboard__name">
                <span className="leaderboard__avatar" style={{ background: p.avatar_color }}>
                  {p.name.charAt(0).toUpperCase()}
                </span>
                {p.name}
              </span>
              <span className="leaderboard__score">{p.score}</span>
              <span className="leaderboard__correct">{p.correct_guesses}</span>
              <span className="leaderboard__fastest">
                {p.fastest_guess_ms != null ? `${(p.fastest_guess_ms / 1000).toFixed(1)}s` : "—"}
              </span>
              <span className="leaderboard__bonus">{p.drawing_bonus}</span>
            </div>
          ))}
        </div>
        <div className="leaderboard__actions">
          <button type="button" className="btn btn--primary" onClick={onPlayAgain}>
            Play Again
          </button>
          <button type="button" className="btn btn--ghost" onClick={onExit}>
            Exit to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

export const FinalLeaderboard = memo(FinalLeaderboardImpl);
