// Isometric coordinate math
// Converts grid (col, row, height) to screen (x, y)

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const TILE_DEPTH = 8; // height per z level
export const WALL_HEIGHT = 120;

export interface GridPos {
  col: number;
  row: number;
  z: number;
}

export interface ScreenPos {
  x: number;
  y: number;
}

/** Convert grid position to screen position (isometric projection) */
export function gridToScreen(col: number, row: number, z: number = 0): ScreenPos {
  return {
    x: (col - row) * (TILE_WIDTH / 2),
    y: (col + row) * (TILE_HEIGHT / 2) - z * TILE_DEPTH,
  };
}

/** Convert screen position back to grid (approximate) */
export function screenToGrid(sx: number, sy: number, z: number = 0): GridPos {
  const adjustedY = sy + z * TILE_DEPTH;
  const col = (sx / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
  const row = (adjustedY / (TILE_HEIGHT / 2) - sx / (TILE_WIDTH / 2)) / 2;
  return { col: Math.round(col), row: Math.round(row), z };
}

/** Calculate z-index for sorting (items further back rendered first) */
export function calcZIndex(col: number, row: number, z: number, priority: number = 0): number {
  return (col + row) * 100 + z * 10 + priority;
}
