import { useEffect, useRef, useState } from "react";

/**
 * Derives a synchronized countdown from a server-side start timestamp.
 * All clients compute remaining = duration - (now - startedAt), so every
 * client sees the same number regardless of when they joined. We use a single
 * interval (cleaned up on unmount) and never create duplicate intervals.
 */
export function useTimer(
  startedAt: string | null,
  durationMs: number,
  onExpire: () => void,
): number {
  const [remaining, setRemaining] = useState(durationMs);
  const onExpireRef = useRef(onExpire);
  const expiredRef = useRef(false);

  // Keep the latest onExpire without re-subscribing the interval.
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expiredRef.current = false;
    if (!startedAt) {
      setRemaining(durationMs);
      return;
    }

    const tick = () => {
      const start = new Date(startedAt).getTime();
      const now = Date.now();
      const elapsed = now - start;
      const left = Math.max(0, durationMs - elapsed);
      setRemaining(left);
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };

    tick();
    // 200ms cadence: smooth enough for a seconds display, cheap on CPU.
    const id = window.setInterval(tick, 200);
    return () => {
      window.clearInterval(id);
    };
  }, [startedAt, durationMs]);

  return remaining;
}
