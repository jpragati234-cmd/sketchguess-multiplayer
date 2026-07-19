import { memo } from "react";
import { BRUSH_COLORS, BRUSH_SIZES } from "../lib/colors";
import type { Tool } from "../types/game";

interface ToolbarProps {
  color: string;
  size: number;
  tool: Tool;
  canDraw: boolean;
  onColor: (c: string) => void;
  onSize: (s: number) => void;
  onTool: (t: Tool) => void;
  onUndo: () => void;
  onClear: () => void;
}

function ToolbarImpl({
  color,
  size,
  tool,
  canDraw,
  onColor,
  onSize,
  onTool,
  onUndo,
  onClear,
}: ToolbarProps) {
  return (
    <div className={`toolbar ${canDraw ? "" : "toolbar--disabled"}`}>
      <div className="toolbar__group">
        {BRUSH_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`toolbar__color ${color === c ? "is-active" : ""}`}
            style={{ background: c }}
            onClick={() => onColor(c)}
            disabled={!canDraw}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>
      <div className="toolbar__group">
        {BRUSH_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            className={`toolbar__size ${size === s ? "is-active" : ""}`}
            onClick={() => onSize(s)}
            disabled={!canDraw}
            aria-label={`Brush size ${s}`}
          >
            <span style={{ width: s + 2, height: s + 2 }} />
          </button>
        ))}
      </div>
      <div className="toolbar__group">
        <button
          type="button"
          className={`toolbar__tool ${tool === "brush" ? "is-active" : ""}`}
          onClick={() => onTool("brush")}
          disabled={!canDraw}
        >
          Brush
        </button>
        <button
          type="button"
          className={`toolbar__tool ${tool === "eraser" ? "is-active" : ""}`}
          onClick={() => onTool("eraser")}
          disabled={!canDraw}
        >
          Eraser
        </button>
      </div>
      <div className="toolbar__group">
        <button type="button" onClick={onUndo} disabled={!canDraw} className="toolbar__btn">
          Undo
        </button>
        <button type="button" onClick={onClear} disabled={!canDraw} className="toolbar__btn">
          Clear
        </button>
      </div>
    </div>
  );
}

export const Toolbar = memo(ToolbarImpl);
