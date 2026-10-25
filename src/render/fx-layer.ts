import { Container, Graphics } from 'pixi.js';
import type { Mold, World } from '../sim/types';
import { INK, moldColor } from './palette';
import { CELL } from './units';

interface Ping {
  x: number;
  y: number;
  age: number;
}

const STATE_COLOR = { growing: -1, starved: 0xe8872b, blocked: 0xe0432a, arrived: 0xffffff } as const;
const PING_SECONDS = 0.9;

/** Inked target markers with tip state, and the rough red "X" shown for a rejected command. */
export class FxLayer {
  readonly container = new Container();
  private readonly g = new Graphics();
  private pings: Ping[] = [];

  constructor() {
    this.container.addChild(this.g);
  }

  addRejectPing(cell: number, width: number): void {
    this.pings.push({ x: (cell % width) * CELL + CELL / 2, y: Math.floor(cell / width) * CELL + CELL / 2, age: 0 });
  }

  /** world position of a target marker, for hit-testing right-clicks */
  static markerPosition(cell: number, width: number): [number, number] {
    return [(cell % width) * CELL + CELL / 2, Math.floor(cell / width) * CELL + CELL / 2];
  }

  update(world: Readonly<World>, player: Mold | undefined, dt: number, timeSeconds: number): void {
    const g = this.g;
    g.clear();
    if (player) {
      for (const t of player.targets) {
        const [x, y] = FxLayer.markerPosition(t.cell, world.width);
        const tint = STATE_COLOR[t.state] === -1 ? moldColor(player.color) : STATE_COLOR[t.state];
        // dashed trail from the head to the target
        const head = t.path[t.pos] as number;
        const hx = (head % world.width) * CELL + CELL / 2;
        const hy = Math.floor(head / world.width) * CELL + CELL / 2;
        const dx = x - hx;
        const dy = y - hy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dots = Math.min(40, Math.floor(dist / 14));
        for (let s = 1; s < dots; s++) {
          const f = s / dots;
          g.circle(hx + dx * f, hy + dy * f, 1.8).fill({ color: INK, alpha: 0.7 });
        }
        // marker: inked diamond with a colored core, gently pulsing
        const r = 7 + Math.sin(timeSeconds * 5) * 1;
        const pts = [x, y - r, x + r, y, x, y + r, x - r, y];
        g.poly(pts, true).fill(tint).stroke({ width: 3, color: INK, join: 'round' });
        g.circle(x, y, 2).fill(INK);
      }
    }
    this.pings = this.pings.filter((p) => (p.age += dt) < PING_SECONDS);
    for (const p of this.pings) {
      const a = 1 - p.age / PING_SECONDS;
      const r = 6 + p.age * 8;
      g.moveTo(p.x - r, p.y - r).lineTo(p.x + r, p.y + r).moveTo(p.x + r, p.y - r).lineTo(p.x - r, p.y + r);
      g.stroke({ width: 5, color: INK, alpha: a, cap: 'round' });
      g.moveTo(p.x - r, p.y - r).lineTo(p.x + r, p.y + r).moveTo(p.x + r, p.y - r).lineTo(p.x - r, p.y + r);
      g.stroke({ width: 2.5, color: 0xe0432a, alpha: a, cap: 'round' });
    }
  }
}
