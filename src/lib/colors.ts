// Avatar color palette — no purple/indigo per design guidelines.
export const AVATAR_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#0ea5e9", // sky
  "#ec4899", // pink
  "#84cc16", // lime
];

export function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] ?? "#3b82f6";
}

// Brush palette for the drawing toolbar.
export const BRUSH_COLORS = [
  "#1f2937", "#ef4444", "#f97316", "#f59e0b", "#10b981",
  "#06b6d4", "#3b82f6", "#ec4899", "#ffffff", "#9ca3af",
];

export const BRUSH_SIZES = [2, 4, 8, 14, 22];
