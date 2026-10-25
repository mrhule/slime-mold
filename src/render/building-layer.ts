import { Container, Graphics } from 'pixi.js';
import type { World } from '../sim/types';
import { INK, moldColor } from './palette';
import { CELL } from './units';

const POT = 0x8a5a2b;
const POT_SHADE = 0x5e3a1b;
const POT_LIGHT = 0xc58a4e;
const SPOT = 0xfff6dc;
/** the farm is drawn a bit larger than one cell so it reads at a glance */
const FARM_SCALE = 1.35;

/** world-space center of a cell */
export const cellCenter = (cell: number, width: number): [number, number] => [(cell % width) * CELL + CELL / 2, Math.floor(cell / width) * CELL + CELL / 2];

/**
 * An inked nutrient farm: a round planter with three sprouting mushroom caps. Drawn with
 * hard offset shadow, flat two-band shading, and heavy outlines (FR-032). `ghost` draws it as a
 * see-through placement preview in the given outline color.
 */
export function drawFarm(g: Graphics, cx: number, cy: number, capColor: number, ghost?: number): void {
  const alpha = ghost === undefined ? 1 : 0.6;
  const ink = ghost ?? INK;
  const S = FARM_SCALE;
  const w = ghost === undefined ? 3 : 2.5;

  // hard offset shadow
  g.ellipse(cx + 2 * S, cy + 6 * S, 9.5 * S, 4.2 * S).fill({ color: INK, alpha: 0.45 * alpha });

  // stems and caps behind the pot rim
  const caps: [number, number, number][] = [[-5.5, -3, 3.6], [0.5, -6.5, 4.4], [6, -2.5, 3.4]];
  for (const [dx, dy, r] of caps) {
    g.roundRect(cx + (dx - 1.1) * S, cy + dy * S, 2.2 * S, 7 * S, 1).fill({ color: SPOT, alpha }).stroke({ width: 1.6, color: ink, alpha });
    g.ellipse(cx + dx * S, cy + dy * S, r * S, r * 0.75 * S).fill({ color: capColor, alpha }).stroke({ width: w, color: ink, alpha, join: 'round' });
    g.circle(cx + (dx - r * 0.3) * S, cy + (dy - r * 0.2) * S, Math.max(0.9, r * 0.22 * S)).fill({ color: SPOT, alpha });
  }

  // planter: dark lower band, lit upper band, thick rim
  g.ellipse(cx, cy + 3.4 * S, 9 * S, 5.6 * S).fill({ color: POT_SHADE, alpha }).stroke({ width: w, color: ink, alpha });
  g.ellipse(cx, cy + 2.6 * S, 9 * S, 4.1 * S).fill({ color: POT, alpha }).stroke({ width: w, color: ink, alpha });
  g.ellipse(cx - 2.4 * S, cy + 1.4 * S, 3.6 * S, 1.2 * S).fill({ color: POT_LIGHT, alpha });
}

/** Buildings drawn above the veins, redrawn only when the set of buildings changes. */
export class BuildingLayer {
  readonly container = new Container();
  private readonly g = new Graphics();
  private lastKey = '';

  constructor() {
    this.container.addChild(this.g);
  }

  update(world: Readonly<World>): void {
    let key = '';
    for (const b of world.buildings) key += b.destroyed ? 'x' : b.id + ',';
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.g.clear();
    for (const b of world.buildings) {
      if (b.destroyed) continue;
      const [x, y] = cellCenter(b.cell, world.width);
      const mold = world.molds[b.moldId - 1];
      drawFarm(this.g, x, y, moldColor(mold ? mold.color : 0));
    }
  }
}
