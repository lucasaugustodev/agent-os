import { Application, Container } from 'pixi.js';
import * as Tween from '@tweenjs/tween.js';
import { gridToScreen, calcZIndex, screenToGrid, TILE_WIDTH, TILE_HEIGHT } from './iso';
import { createFloorTile, createHighlightTile, createWallLeft, createWallRight } from './tiles';
import { createAvatar, animateWalk, type AvatarState, getAgentFigure } from './avatar';

export interface AgentData {
  id: string;
  name: string;
  state: AvatarState;
  col: number;
  row: number;
  z: number;
  figure?: string;       // Habbo figure string
  paletteIndex?: number; // index to pick a default figure
}

export interface RoomConfig {
  cols: number;
  rows: number;
  heightmap?: number[][];  // optional height per tile
  onAgentClick?: (agentId: string) => void;
  onTileClick?: (col: number, row: number) => void;
}

export class RoomEngine {
  public app: Application;
  public world: Container;
  public floorLayer: Container;
  public agentLayer: Container;
  private agents = new Map<string, { data: AgentData; container: Container; tween?: Tween.Tween<{ x: number; y: number }> }>();
  private config: RoomConfig;
  private highlight: Container | null = null;
  private animFrame = 0;
  private destroyed = false;

  constructor(config: RoomConfig) {
    this.config = config;
    this.app = new Application();
    this.world = new Container();
    this.floorLayer = new Container();
    this.agentLayer = new Container();
    this.agentLayer.sortableChildren = true;
  }

  async init(canvas: HTMLCanvasElement) {
    const parent = canvas.parentElement;
    const w = parent?.clientWidth ?? 800;
    const h = parent?.clientHeight ?? 600;

    await this.app.init({
      canvas,
      background: 0x1e1e2e,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      width: w,
      height: h,
    });

    this.world.x = this.app.screen.width / 2;
    this.world.y = 80;

    this.world.addChild(this.floorLayer);
    this.world.addChild(this.agentLayer);
    this.app.stage.addChild(this.world);

    this.buildFloor();

    // Animation loop
    this.app.ticker.add(() => {
      if (this.destroyed) return;
      Tween.update();
      this.animFrame++;
      // Animate walking agents
      for (const agent of this.agents.values()) {
        if (agent.data.state === 'walking' || agent.data.state === 'working') {
          animateWalk(agent.container, this.animFrame);
        }
      }
    });
  }

  private buildFloor() {
    const { cols, rows, heightmap } = this.config;

    // Build back walls
    this.buildWalls(cols, rows);

    // Build floor tiles
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const z = heightmap?.[r]?.[c] ?? 0;
        if (z < 0) continue;

        const color = (c + r) % 2 === 0 ? 0x7b9a6e : 0x6e8c62; // Habbo green floor
        const tile = createFloorTile(color, 0x8aad7c);
        const pos = gridToScreen(c, r, z);
        tile.x = pos.x;
        tile.y = pos.y;
        tile.zIndex = calcZIndex(c, r, z, 0);
        tile.eventMode = 'static';
        tile.cursor = 'pointer';

        tile.on('pointerover', () => this.showHighlight(c, r, z));
        tile.on('pointerout', () => this.hideHighlight());
        tile.on('pointertap', () => this.config.onTileClick?.(c, r));

        this.floorLayer.addChild(tile);
      }
    }
    this.floorLayer.sortableChildren = true;
  }

  private buildWalls(cols: number, rows: number) {
    const wallHeight = 100;

    // Left wall (along row=0, varying col)
    for (let c = 0; c < cols; c++) {
      const wall = createWallRight(wallHeight, 0x7d92b3);
      const pos = gridToScreen(c, 0, 0);
      wall.x = pos.x;
      wall.y = pos.y;
      wall.zIndex = calcZIndex(c, 0, 0, -1);
      this.floorLayer.addChild(wall);
    }

    // Back wall (along col=0, varying row)
    for (let r = 0; r < rows; r++) {
      const wall = createWallLeft(wallHeight, 0x8ba2c4);
      const pos = gridToScreen(0, r, 0);
      wall.x = pos.x;
      wall.y = pos.y;
      wall.zIndex = calcZIndex(0, r, 0, -1);
      this.floorLayer.addChild(wall);
    }
  }

  private showHighlight(col: number, row: number, z: number) {
    this.hideHighlight();
    this.highlight = createHighlightTile();
    const pos = gridToScreen(col, row, z);
    this.highlight.x = pos.x;
    this.highlight.y = pos.y;
    this.highlight.zIndex = 9999;
    this.floorLayer.addChild(this.highlight);
  }

  private hideHighlight() {
    if (this.highlight) {
      this.floorLayer.removeChild(this.highlight);
      this.highlight.destroy();
      this.highlight = null;
    }
  }

  /** Add or update an agent in the room */
  async addAgent(data: AgentData) {
    // Remove existing if present
    if (this.agents.has(data.id)) {
      this.removeAgent(data.id);
    }
    if (this.destroyed) return;

    const figure = data.figure ?? getAgentFigure(data.paletteIndex ?? this.agents.size);
    const container = await createAvatar(data.name, figure, data.state);
    if (this.destroyed) { container.destroy({ children: true }); return; }

    const pos = gridToScreen(data.col, data.row, data.z);
    container.x = pos.x;
    container.y = pos.y;
    container.zIndex = calcZIndex(data.col, data.row, data.z, 5);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', (e) => {
      e.stopPropagation();
      this.config.onAgentClick?.(data.id);
    });

    this.agentLayer.addChild(container);
    this.agents.set(data.id, { data: { ...data, figure }, container });
  }

  /** Move agent to a new tile with tween animation */
  moveAgent(agentId: string, toCol: number, toRow: number, toZ: number = 0, duration: number = 500) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Cancel existing tween
    agent.tween?.stop();

    const fromPos = { x: agent.container.x, y: agent.container.y };
    const toPos = gridToScreen(toCol, toRow, toZ);

    const tween = new Tween.Tween(fromPos)
      .to({ x: toPos.x, y: toPos.y }, duration)
      .easing(Tween.Easing.Quadratic.InOut)
      .onUpdate(({ x, y }) => {
        agent.container.x = x;
        agent.container.y = y;
      })
      .onComplete(() => {
        agent.data.col = toCol;
        agent.data.row = toRow;
        agent.data.z = toZ;
        agent.container.zIndex = calcZIndex(toCol, toRow, toZ, 5);
      })
      .start();

    agent.tween = tween;
  }

  /** Update agent state (rebuilds avatar sprite) */
  async updateAgentState(agentId: string, state: AvatarState) {
    const agent = this.agents.get(agentId);
    if (!agent || this.destroyed) return;

    agent.data.state = state;
    const oldPos = { x: agent.container.x, y: agent.container.y };
    const oldZIndex = agent.container.zIndex;
    this.agentLayer.removeChild(agent.container);
    agent.container.destroy({ children: true });

    const figure = agent.data.figure ?? getAgentFigure(agent.data.paletteIndex ?? 0);
    const newContainer = await createAvatar(agent.data.name, figure, state);
    if (this.destroyed) { newContainer.destroy({ children: true }); return; }

    newContainer.x = oldPos.x;
    newContainer.y = oldPos.y;
    newContainer.zIndex = oldZIndex;
    newContainer.eventMode = 'static';
    newContainer.cursor = 'pointer';
    newContainer.on('pointertap', (e) => {
      e.stopPropagation();
      this.config.onAgentClick?.(agentId);
    });

    this.agentLayer.addChild(newContainer);
    agent.container = newContainer;
  }

  /** Remove agent from room */
  removeAgent(agentId: string) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.tween?.stop();
    this.agentLayer.removeChild(agent.container);
    agent.container.destroy({ children: true });
    this.agents.delete(agentId);
  }

  /** Resize handler */
  resize() {
    if (this.destroyed) return;
    try {
      const canvas = this.app.canvas as HTMLCanvasElement;
      const parent = canvas?.parentElement;
      if (!parent || !this.app.renderer) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w <= 0 || h <= 0) return;
      this.app.renderer.resize(w, h);
      this.world.x = w / 2;
    } catch { /* renderer may be destroyed */ }
  }

  /** Cleanup */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    try { this.app.ticker.stop(); } catch { /* not started yet */ }
    for (const agent of this.agents.values()) {
      try { agent.tween?.stop(); } catch { /* ignore */ }
    }
    this.agents.clear();
    // Pixi v8 destroy can throw if resizeTo observer wasn't fully set up.
    // Safely tear down stage children first, then destroy the app.
    try {
      this.app.stage.removeChildren();
      this.world.destroy({ children: true });
    } catch { /* ignore */ }
    try {
      this.app.destroy(false);
    } catch { /* ignore */ }
  }
}
