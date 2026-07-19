import { useCallback, useEffect, useRef } from "react";
import type { Point, Stroke, Tool } from "../types/game";

interface UseCanvasOptions {
  canDraw: boolean;
  color: string;
  size: number;
  tool: Tool;
  onCommitStroke: (stroke: Omit<Stroke, "id" | "room_id" | "created_at">) => void;
}

/**
 * Drawing canvas hook. Handles pointer events for both mouse and touch
 * (pointer events unify them), draws to the 2D context immediately for low
 * latency, and commits completed strokes via onCommitStroke for broadcast.
 * Strokes are stored as normalized 0..1 points so canvas resizes don't break
 * replay.
 */
export function useCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseCanvasOptions,
) {
  const { canDraw, color, size, tool, onCommitStroke } = options;

  // Current in-progress stroke points (normalized).
  const currentStrokeRef = useRef<Point[]>([]);
  const drawingRef = useRef(false);
  // Snapshot of all committed strokes for undo + redraw.
  const strokesRef = useRef<Stroke[]>([]);
  // Live state mirrors (avoid stale closures in event handlers).
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  const toolRef = useRef(tool);
  const canDrawRef = useRef(canDraw);
  const onCommitRef = useRef(onCommitStroke);

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { canDrawRef.current = canDraw; }, [canDraw]);
  useEffect(() => { onCommitRef.current = onCommitStroke; }, [onCommitStroke]);

  // Convert a pointer event to a normalized point.
  const toPoint = useCallback(
    (e: PointerEvent | React.PointerEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
    },
    [canvasRef],
  );

  // Render a single stroke onto the canvas context.
  const renderStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.points.length === 0) return;
      const canvas = ctx.canvas;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = stroke.size;
      ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
      ctx.globalCompositeOperation =
        stroke.tool === "eraser" ? "destination-out" : "source-over";
      ctx.beginPath();
      const first = stroke.points[0];
      ctx.moveTo(first.x * canvas.width, first.y * canvas.height);
      for (let i = 1; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
      }
      // Single-dot strokes: draw a small circle so taps are visible.
      if (stroke.points.length === 1) {
        ctx.arc(first.x * canvas.width, first.y * canvas.height, stroke.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
        ctx.fill();
      }
      ctx.stroke();
      ctx.restore();
    },
    [],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current) renderStroke(ctx, s);
  }, [canvasRef, renderStroke]);

  // Resize the canvas backing store to match its CSS size, then redraw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      // After resize, canvas.width/height in CSS pixels is rect.width/height.
      // We render using canvas.width/height though; rescale to match.
      // Simpler: set canvas.width/height to rect size (no DPR) for normalized math.
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef, redraw]);

  // Pointer handlers. Using pointer events covers mouse, touch, and pen.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: PointerEvent) => {
      if (!canDrawRef.current) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      currentStrokeRef.current = [toPoint(e)];
      // Draw the first dot immediately for responsiveness.
      const ctx = canvas.getContext("2d");
      if (ctx) {
        renderStroke(ctx, {
          id: "",
          room_id: "",
          round_index: 0,
          points: currentStrokeRef.current,
          color: colorRef.current,
          size: sizeRef.current,
          tool: toolRef.current,
          created_at: "",
        });
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!drawingRef.current || !canDrawRef.current) return;
      e.preventDefault();
      const p = toPoint(e);
      const pts = currentStrokeRef.current;
      // Throttle: skip points that are too close to the previous one.
      const last = pts[pts.length - 1];
      if (last) {
        const dx = p.x - last.x;
        const dy = p.y - last.y;
        if (dx * dx + dy * dy < 0.0004) return; // ~2% of dimension
      }
      pts.push(p);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        renderStroke(ctx, {
          id: "",
          room_id: "",
          round_index: 0,
          points: pts,
          color: colorRef.current,
          size: sizeRef.current,
          tool: toolRef.current,
          created_at: "",
        });
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const pts = currentStrokeRef.current;
      currentStrokeRef.current = [];
      if (pts.length === 0) return;
      onCommitRef.current({
        round_index: 0, // set by caller via wrapper
        points: pts,
        color: colorRef.current,
        size: sizeRef.current,
        tool: toolRef.current,
      });
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onUp);
    };
  }, [canvasRef, toPoint, renderStroke]);

  // Append a remote stroke to the local snapshot and draw it.
  const applyRemoteStroke = useCallback(
    (stroke: Stroke) => {
      strokesRef.current = [...strokesRef.current, stroke];
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) renderStroke(ctx, stroke);
    },
    [canvasRef, renderStroke],
  );

  // Replace the full stroke list (used on round change / reconnect).
  const setStrokes = useCallback(
    (strokes: Stroke[]) => {
      strokesRef.current = strokes;
      redraw();
    },
    [redraw],
  );

  const undo = useCallback(() => {
    if (!canDrawRef.current) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    redraw();
  }, [redraw]);

  const clearLocal = useCallback(() => {
    strokesRef.current = [];
    redraw();
  }, [redraw]);

  return { applyRemoteStroke, setStrokes, undo, clearLocal };
}
