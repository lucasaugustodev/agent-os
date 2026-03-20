import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';

export type AvatarState = 'idle' | 'walking' | 'sitting' | 'waving' | 'error' | 'working';

/** Habbo figure strings for different agent looks */
const AGENT_FIGURES = [
  'hd-180-1.ch-210-66.lg-280-110.sh-305-62.hr-828-61',            // Blue shirt, dark hair
  'hd-180-1.ch-255-80.lg-280-73.sh-305-62.hr-100-61',             // Green shirt
  'hd-600-1.ch-630-62.lg-695-110.sh-725-62.hr-515-61.he-1601-62', // Pink shirt, hat
  'hd-180-1.ch-3030-75.lg-275-110.sh-300-62.hr-831-37',           // Purple shirt
  'hd-195-1.ch-215-85.lg-285-82.sh-295-62.hr-155-37',             // Yellow shirt
  'hd-180-1.ch-210-92.lg-280-110.sh-305-62.hr-828-45',            // Cyan shirt
  'hd-600-3.ch-665-110.lg-695-62.sh-725-62.hr-500-35',            // Red shirt
  'hd-195-8.ch-225-62.lg-270-110.sh-290-80.hr-170-37',            // Orange shirt
];

export function getAgentFigure(index: number): string {
  return AGENT_FIGURES[index % AGENT_FIGURES.length];
}

/** Map state to Habbo gesture + action params */
function stateToParams(state: AvatarState): string {
  switch (state) {
    case 'sitting': return '&action=sit&gesture=sml';
    case 'waving': return '&action=wav&gesture=sml';
    case 'walking': return '&action=mv&gesture=sml';
    case 'working': return '&action=crr&gesture=srp';
    case 'error': return '&gesture=sad';
    case 'idle':
    default: return '&gesture=sml';
  }
}

/** Status dot color by state */
function statusColor(state: AvatarState): number {
  switch (state) {
    case 'working': return 0xa6e3a1;
    case 'walking': return 0xa6e3a1;
    case 'error': return 0xf38ba8;
    case 'waving': return 0xf9e2af;
    case 'sitting': return 0x89b4fa;
    case 'idle':
    default: return 0x6c7086;
  }
}

const textureCache = new Map<string, Texture>();

/** Load a Habbo avatar image as a Pixi texture */
async function loadAvatarTexture(figure: string, direction: number, state: AvatarState): Promise<Texture> {
  const params = stateToParams(state);
  const key = `${figure}_d${direction}_${state}`;

  if (textureCache.has(key)) return textureCache.get(key)!;

  const url = `https://www.habbo.com/habbo-imaging/avatarimage?figure=${figure}&direction=${direction}&head_direction=${direction}&size=l${params}`;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const texture = Texture.from(bitmap);
    textureCache.set(key, texture);
    return texture;
  } catch {
    // Fallback: return empty texture
    return Texture.EMPTY;
  }
}

const BODY_Y_OFFSET = -52;
const NAME_Y_OFFSET = -60;
const STATUS_Y_OFFSET = -70;
const BUBBLE_Y_OFFSET = -80;

/** Create a Habbo-style avatar container with real sprites */
export async function createAvatar(
  name: string,
  figure: string,
  state: AvatarState = 'idle',
  direction: number = 2
): Promise<Container> {
  const container = new Container();
  container.sortableChildren = true;

  // Shadow
  const shadow = new Graphics();
  shadow.ellipse(0, 4, 16, 7);
  shadow.fill({ color: 0x000000, alpha: 0.3 });
  shadow.zIndex = 0;
  container.addChild(shadow);

  // Load Habbo avatar sprite
  const texture = await loadAvatarTexture(figure, direction, state);
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 1);
  sprite.y = 6; // feet on ground
  sprite.zIndex = 1;
  sprite.label = 'avatar-sprite';
  container.addChild(sprite);

  // Name tag with background
  const nameText = new Text({
    text: name,
    style: {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: 10,
      fontWeight: '600',
      fill: 0xffffff,
      align: 'center',
    },
  });
  nameText.anchor.set(0.5, 0.5);
  nameText.y = NAME_Y_OFFSET;
  nameText.zIndex = 11;

  // Name background
  const nameBg = new Graphics();
  const nameW = nameText.width + 10;
  const nameH = 16;
  nameBg.roundRect(-nameW / 2, NAME_Y_OFFSET - nameH / 2, nameW, nameH, 4);
  nameBg.fill({ color: 0x000000, alpha: 0.6 });
  nameBg.zIndex = 10;
  container.addChild(nameBg);
  container.addChild(nameText);

  // Status indicator
  const statusDot = new Graphics();
  statusDot.circle(nameW / 2 + 2, NAME_Y_OFFSET, 4);
  statusDot.fill({ color: statusColor(state) });
  statusDot.circle(nameW / 2 + 2, NAME_Y_OFFSET, 4);
  statusDot.stroke({ color: 0x000000, width: 1, alpha: 0.4 });
  statusDot.zIndex = 12;
  container.addChild(statusDot);

  // State tag
  (container as any).__state = state;
  (container as any).__walkFrame = 0;

  return container;
}

/** Update avatar for walk animation (bob up and down) */
export function animateWalk(container: Container, frame: number): void {
  const sprite = container.children.find((c) => (c as any).label === 'avatar-sprite');
  if (!sprite) return;
  const bob = Math.sin(frame * 0.15) * 2;
  sprite.y = 6 + bob;
}
