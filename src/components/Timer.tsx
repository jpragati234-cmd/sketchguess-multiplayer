import { memo } from "react";

interface TimerProps {
  remainingMs: number;
  totalMs: number;
}

function TimerImpl({ remainingMs, totalMs }: TimerProps) {
  const seconds = Math.ceil(remainingMs / 1000);
  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const danger = remainingMs <= 10000;
  const warn = remainingMs <= 20000 && !danger;

  return (
    <div className={`timer ${danger ? "timer--danger" : warn ? "timer--warn" : ""}`}>
      <div className="timer__ring" style={{ "--ratio": ratio } as React.CSSProperties}>
        <svg viewBox="0 0 36 36" className="timer__svg">
          <circle cx="18" cy="18" r="15.9" className="timer__track" />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            className="timer__progress"
            strokeDasharray={`${ratio * 100} 100`}
          />
        </svg>
        <div className="timer__label">{seconds}</div>
      </div>
    </div>
  );
}

export const Timer = memo(TimerImpl);
