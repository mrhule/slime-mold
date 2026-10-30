import { Container, Graphics } from 'pixi.js';
import { Rng, mix32 } from '../sim/rng';
import { Terrain } from '../sim/types';
import type { World } from '../sim/types';
import { INK } from './palette';
import { style } from './style';
import { CELL } from './units';

/** snail palette: a warm brown shell with a pale spiral, a grey-green body */
const SHELL = { base: 0xb9773a, shade: 0x84501f, light: 0xe8c58b };
const BODY = { base: 0xb7b99a, shade: 0x8a8d70 };
const TRAIL = 0xdfe8c8;

/** one snail for roughly this many cells of map, between the two limits */
const CELLS_PER_SNAIL = 700;
const MIN_SNAILS = 3;
const MAX_SNAILS = 9;
/** cells per second: a snail's pace */
const SPEED = 0.35;
const TRAIL_POINTS = 28;
const TRAIL_STEP = 3;
/** how big the snail is drawn, in world pixels from tail to head */
const LENGTH = CELL * 2.6;

interface Snail {
  /** position in cells */
  x: number;
  y: number;
  heading: number;
  /** seconds left of a rest, during which it does not move */
  rest: number;
  /** seconds until it next decides to turn or rest */
  think: number;
  /** how far out the eyestalks are, 0..1 */
  stalks: number;
  seed: number;
  trail: { x: number; y: number }[];
  sinceTrail: number;
}

/**
 * A few snails that crawl about the forest floor, only for life. They are drawn from their own
 * random stream and never touch the sim (Constitution I), so replays and hashes are unaffected.
 * Snails are only drawn where the player can see right now, and pull their eyestalks in over a
 * cell any mold has grown on.
 */
export class CritterLayer {
  readonly container = new Container();
  private readonly g = new Graphics();
  private readonly snails: Snail[] = [];
  private rng: Rng;

  constructor(sim: Readonly<World>) {
    this.rng = new Rng(mix32(sim.seed, 0x534e41));
    this.container.addChild(this.g);
    const count = Math.max(MIN_SNAILS, Math.min(MAX_SNAILS, Math.round((sim.width * sim.height) / CELLS_PER_SNAIL)));
    for (let tries = 0; this.snails.length < count && tries < count * 40; tries++) {
      const x = this.rng.range(2, sim.width - 2);
      const y = this.rng.range(2, sim.height - 2);
      if (!this.walkable(sim, x, y)) continue;
      this.snails.push({ x, y, heading: this.rng.range(0, Math.PI * 2), rest: 0, think: this.rng.range(1, 6), stalks: 1, seed: this.snails.length, trail: [], sinceTrail: 0 });
    }
  }

  private walkable(sim: Readonly<World>, x: number, y: number): boolean {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx < 1 || cy < 1 || cx >= sim.width - 1 || cy >= sim.height - 1) return false;
    const t = sim.terrain[cy * sim.width + cx];
    return t === Terrain.Open || t === Terrain.Rough;
  }

  update(sim: Readonly<World>, dt: number, time: number, still: boolean): void {
    const vision = sim.molds[0]?.vision;
    const g = this.g;
    g.clear();
    for (const s of this.snails) {
      if (!still) this.crawl(sim, s, dt);
      const cell = Math.floor(s.y) * sim.width + Math.floor(s.x);
      if (vision && vision[cell] !== 2) continue;
      const hidden = sim.owner[cell] !== 0;
      s.stalks += ((hidden ? 0 : 1) - s.stalks) * Math.min(1, dt * 4);
      this.draw(g, s, time);
    }
  }

  private crawl(sim: Readonly<World>, s: Snail, dt: number): void {
    s.think -= dt;
    if (s.think <= 0) {
      s.think = this.rng.range(2, 8);
      if (this.rng.chance(0.3)) s.rest = this.rng.range(1.5, 5);
      else s.heading += this.rng.jitter(1.1);
    }
    if (s.rest > 0) {
      s.rest -= dt;
      return;
    }
    const step = SPEED * dt;
    const nx = s.x + Math.cos(s.heading) * step;
    const ny = s.y + Math.sin(s.heading) * step;
    // look a little ahead so it turns before it reaches a rock or the edge
    const ax = s.x + Math.cos(s.heading) * 1.2;
    const ay = s.y + Math.sin(s.heading) * 1.2;
    if (!this.walkable(sim, nx, ny) || !this.walkable(sim, ax, ay)) {
      s.heading += (this.rng.chance(0.5) ? 1 : -1) * this.rng.range(0.6, 1.6);
      s.think = this.rng.range(1, 3);
      return;
    }
    s.x = nx;
    s.y = ny;
    s.sinceTrail += step;
    if (s.sinceTrail >= TRAIL_STEP / CELL) {
      s.sinceTrail = 0;
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > TRAIL_POINTS) s.trail.shift();
    }
  }

  private draw(g: Graphics, s: Snail, time: number): void {
    // the slime trail fades towards its oldest point
    for (let i = 1; i < s.trail.length; i++) {
      const a = s.trail[i - 1] as { x: number; y: number };
      const b = s.trail[i] as { x: number; y: number };
      g.moveTo(a.x * CELL, a.y * CELL).lineTo(b.x * CELL, b.y * CELL).stroke({ width: 2.2, color: TRAIL, alpha: 0.5 * (i / s.trail.length), cap: 'round' });
    }

    const px = s.x * CELL;
    const py = s.y * CELL;
    const cos = Math.cos(s.heading);
    const sin = Math.sin(s.heading);
    // body-local (along, across) to world
    const at = (u: number, v: number): [number, number] => [px + cos * u - sin * v, py + sin * u + cos * v];
    const bob = Math.sin(time * 2 + s.seed) * 0.6;

    // hard offset shadow, like everything else on the floor
    g.ellipse(px + style.shadow.groundOffset[0], py + style.shadow.groundOffset[1] + 1, LENGTH * 0.55, LENGTH * 0.3).fill({ color: INK, alpha: style.shadow.groundAlpha * 1.4 });

    // foot: a long soft body, tail to head
    const tail = at(-LENGTH * 0.5, 0);
    const head = at(LENGTH * 0.42, 0);
    g.moveTo(tail[0], tail[1]).lineTo(head[0], head[1]).stroke({ width: LENGTH * 0.34, color: INK, cap: 'round' });
    g.moveTo(tail[0], tail[1]).lineTo(head[0], head[1]).stroke({ width: LENGTH * 0.34 - 3, color: BODY.base, cap: 'round' });
    const belly = at(0, LENGTH * 0.08);
    g.circle(belly[0], belly[1], LENGTH * 0.1).fill({ color: BODY.shade, alpha: 0.6 });

    // eyestalks, pulled in when the snail is over mold
    const reach = LENGTH * 0.34 * s.stalks;
    for (const side of [-1, 1]) {
      const base = at(LENGTH * 0.34, side * LENGTH * 0.08);
      const tip = at(LENGTH * 0.34 + reach * 0.6, side * (LENGTH * 0.08 + reach * 0.5) + bob * 0.3);
      g.moveTo(base[0], base[1]).lineTo(tip[0], tip[1]).stroke({ width: 2.6, color: INK, cap: 'round' });
      g.moveTo(base[0], base[1]).lineTo(tip[0], tip[1]).stroke({ width: 1.1, color: BODY.base, cap: 'round' });
      g.circle(tip[0], tip[1], 1.9).fill(INK);
    }

    // shell: dark outline, shade, base, a pale spiral and a highlight
    const [sx, sy] = at(-LENGTH * 0.1, 0);
    const r = LENGTH * 0.3 + bob * 0.15;
    g.circle(sx, sy - 1.5, r).fill(SHELL.shade).stroke({ width: 2.6, color: INK });
    g.circle(sx - 0.8, sy - 2.2, r * 0.82).fill(SHELL.base);
    // moveTo the arc's start first, or Pixi joins it to the last point (the map's corner) with a line
    const spiral = (radius: number, from: number, to: number, width: number, color: number): void => {
      g.moveTo(sx - 0.5 + Math.cos(from) * radius, sy - 2 + Math.sin(from) * radius);
      g.arc(sx - 0.5, sy - 2, radius, from, to).stroke({ width, color });
    };
    spiral(r * 0.5, 0.5, Math.PI * 2.2, 1.5, SHELL.shade);
    spiral(r * 0.22, 1, Math.PI * 2.4, 1.2, SHELL.light);
    g.circle(sx - r * 0.35, sy - r * 0.6, r * 0.18).fill({ color: SHELL.light, alpha: 0.9 });
  }
}
