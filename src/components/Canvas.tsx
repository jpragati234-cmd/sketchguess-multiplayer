import { memo, useEffect, useRef } from "react";
import { useCanvas } from "../hooks/useCanvas";
import type { Stroke, Tool } from "../types/game";

interface CanvasProps {
  canDraw: boolean;
  color: string;
  size: number;
  tool: Tool;
  strokes: Stroke[];
  onCommitStroke: (stroke: Omit<Stroke, "id" | "room_id" | "created_at">) => void;
}

function CanvasImpl({
  canDraw,
  color,
  size,
  tool,
  strokes,
  onCommitStroke,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { applyRemoteStroke, setStrokes } = useCanvas(canvasRef, {
    canDraw,
    color,
    size,
    tool,
    onCommitStroke,
  });

  // Sync external stroke changes. If exactly one stroke was appended, draw
  // just it (cheap). Otherwise full redraw (round change, undo, clear, reconnect).
  const lastCountRef = useRef(0);
  const lastIdRef = useRef<string | null>(null);
  useEffect(() => {
    const last = strokes[strokes.length - 1];
    const sameCount = strokes.length === lastCountRef.current;
    const sameLast = last?.id === lastIdRef.current;
    if (sameCount && sameLast) return;

    if (strokes.length === lastCountRef.current + 1 && last && last.id !== lastIdRef.current) {
      applyRemoteStroke(last);
    } else {
      setStrokes(strokes);
    }
    lastCountRef.current = strokes.length;
    lastIdRef.current = last?.id ?? null;
  }, [strokes, applyRemoteStroke, setStrokes]);

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        className="canvas"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}

export const Canvas = memo(CanvasImpl);
