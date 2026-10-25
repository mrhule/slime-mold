import { Container, Graphics } from 'pixi.js';
import { hash2 } from '../sim/noise';
import type { FoodSource, World } from '../sim/types';
import { FOOD, INK } from './palette';
import { style } from './style';
import { CELL } from './units';

/** Outlined, cel-shaded food drawn procedurally; shrinks as it is eaten. */
export class FoodLayer {
  readonly container = new Container();
  private readonly g = new Graphics();
  /** an ink-tinted copy of every item shifted toward the lower right behind it: a heavier outline on the shadow side (A12) */
  private readonly rim = new Graphics();
  private lastKey = '';

  constructor() {
    this.rim.tint = INK;
    this.rim.position.set(style.outline.strokeShift[0], style.outline.strokeShift[1]);
    this.container.addChild(this.rim, this.g);
  }

  update(world: Readonly<World>): void {
    // redraw only when some amount changed visibly
    const vision = world.molds[0]?.vision;
    const memFood = world.molds[0]?.memFood;
    const known = (f: FoodSource): number | null => {
      if (!vision || !memFood) return f.remaining;
      let amount = 0;
      let seen = false;
      for (let y = f.y; y < f.y + f.h; y++) {
        for (let x = f.x; x < f.x + f.w; x++) {
          const c = y * world.width + x;
          const v = vision[c] as number;
          if (v > 0) seen = true;
          amount += v === 2 ? (world.food[c] as number) : v === 1 ? (memFood[c] as number) : 0;
        }
      }
      return seen ? amount : null;
    };
    const amounts = new Map<number, number>();
    let key = '';
    for (const f of world.foodSources) {
      const a = f.depleted ? null : known(f);
      if (a === null || a <= 0) {
        key += 'x';
        continue;
      }
      amounts.set(f.id, a);
      key += Math.round(Math.sqrt(a / f.total) * 12) + ',';
    }
    if (key === this.lastKey) return;
    this.lastKey = key;
    const g = this.g;
    g.clear();
    this.rim.clear();
    for (const f of world.foodSources) {
      const a = amounts.get(f.id);
      if (a === undefined) continue;
      this.draw(this.rim, f, a);
      this.draw(g, f, a);
    }
  }

  private draw(g: Graphics, f: FoodSource, remaining: number): void {
    const pal = FOOD[f.type];
    const amount = Math.sqrt(Math.max(0, remaining) / f.total);
    const scale = 0.55 + 0.45 * amount;
    const cx = (f.x + f.w / 2) * CELL;
    const cy = (f.y + f.h / 2) * CELL;
    const hw = (f.w * CELL * scale) / 2 - 1.5;
    const hh = (f.h * CELL * scale) / 2 - 1.5;
    const jag = (n: number): number => (hash2(f.id, n, 3) - 0.5) * 2.2;

    // wobbly outline polygon around the item
    const blob = (rx: number, ry: number, ox: number, oy: number, round: number): number[] => {
      const pts: number[] = [];
      const steps = 14;
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        // squarish "superellipse" so cubes and slices read as chunky shapes
        const px = Math.sign(c) * Math.pow(Math.abs(c), round) * rx;
        const py = Math.sign(sn) * Math.pow(Math.abs(sn), round) * ry;
        pts.push(cx + ox + px + jag(s), cy + oy + py + jag(s + 40));
      }
      return pts;
    };
    const round = f.type === 'sugarCube' ? 0.35 : f.type === 'fruitSlice' ? 0.7 : 0.55;

    // hard offset shadow, then outlined body, shade band, highlight
    g.poly(blob(hw, hh, style.shadow.groundOffset[0], style.shadow.groundOffset[1], round), true).fill({ color: INK, alpha: style.shadow.groundAlpha * 1.6 });
    g.poly(blob(hw, hh, 0, 0, round), true).fill(pal.base).stroke({ width: 3, color: INK, join: 'round' });
    g.poly(blob(hw * 0.8, hh * 0.4, hw * 0.2, hh * 0.52, round), true).fill(pal.shade);
    g.poly(blob(hw * 0.28, hh * 0.46, hw * 0.74, hh * 0.1, round), true).fill(pal.shade);
    g.poly(blob(hw * 0.45, hh * 0.2, -hw * 0.3, -hh * 0.45, 0.8), true).fill(pal.light);
    g.poly(blob(hw, hh, 0, 0, round), true).stroke({ width: 3, color: INK, join: 'round' });

    if (f.type === 'fruitSlice') {
      for (let s = 0; s < 5; s++) g.circle(cx + (s - 2) * hw * 0.32, cy + jag(s) * 2, 1.7).fill(INK);
    } else if (f.type === 'breadCrumb') {
      for (let s = 0; s < 4; s++) g.circle(cx + (hash2(f.id, s, 9) - 0.5) * hw, cy + (hash2(f.id, s, 8) - 0.5) * hh, 1.3).fill(INK);
    } else if (f.type === 'sugarCube') {
      g.moveTo(cx - hw * 0.1, cy - hh * 0.2).lineTo(cx + hw * 0.5, cy - hh * 0.2).stroke({ width: 1.6, color: INK });
    }
  }
}
