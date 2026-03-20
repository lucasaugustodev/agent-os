import { Graphics } from 'pixi.js';
import { TILE_WIDTH, TILE_HEIGHT } from './iso';

const hw = TILE_WIDTH / 2;
const hh = TILE_HEIGHT / 2;
const DEPTH = 6; // tile thickness

/** Draw an isometric floor tile with depth (Habbo-style) */
export function createFloorTile(color: number = 0x7b899a, borderColor: number = 0x8e9fad): Graphics {
  const g = new Graphics();

  // Top face
  g.poly([0, -hh, hw, 0, 0, hh, -hw, 0]);
  g.fill({ color });
  g.poly([0, -hh, hw, 0, 0, hh, -hw, 0]);
  g.stroke({ color: borderColor, width: 0.5, alpha: 0.4 });

  // Right face (darker)
  g.poly([0, hh, hw, 0, hw, DEPTH, 0, hh + DEPTH]);
  g.fill({ color: darken(color, 0.2) });

  // Left face (darkest)
  g.poly([0, hh, -hw, 0, -hw, DEPTH, 0, hh + DEPTH]);
  g.fill({ color: darken(color, 0.35) });

  return g;
}

/** Draw a highlighted tile (hover/selection) */
export function createHighlightTile(color: number = 0x89b4fa): Graphics {
  const g = new Graphics();

  // Highlight top
  g.poly([0, -hh, hw, 0, 0, hh, -hw, 0]);
  g.fill({ color, alpha: 0.25 });
  g.poly([0, -hh, hw, 0, 0, hh, -hw, 0]);
  g.stroke({ color, width: 1.5, alpha: 0.7 });

  return g;
}

/** Draw a wall segment (back walls of the room) */
export function createWallLeft(height: number = 120, color: number = 0x6078a0): Graphics {
  const g = new Graphics();

  // Wall face (left side of room)
  g.poly([-hw, 0, 0, -hh, 0, -hh - height, -hw, -height]);
  g.fill({ color });
  g.poly([-hw, 0, 0, -hh, 0, -hh - height, -hw, -height]);
  g.stroke({ color: darken(color, 0.15), width: 0.5 });

  return g;
}

export function createWallRight(height: number = 120, color: number = 0x506888): Graphics {
  const g = new Graphics();

  // Wall face (right/back side)
  g.poly([0, -hh, hw, 0, hw, -height, 0, -hh - height]);
  g.fill({ color });
  g.poly([0, -hh, hw, 0, hw, -height, 0, -hh - height]);
  g.stroke({ color: darken(color, 0.15), width: 0.5 });

  return g;
}

/** Darken a color by a factor (0-1) */
function darken(color: number, factor: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - factor)) | 0;
  const gr = Math.max(0, ((color >> 8) & 0xff) * (1 - factor)) | 0;
  const b = Math.max(0, (color & 0xff) * (1 - factor)) | 0;
  return (r << 16) | (gr << 8) | b;
}
