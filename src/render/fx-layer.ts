import { Container, Graphics, Text } from 'pixi.js';
import { hash2 } from '../sim/noise';
import { cellCenter, drawBoosterArea, drawBuilding } from './building-layer';
import type { BuildingType, Mold, World } from '../sim/types';
import { INK, moldColor } from './palette';
import { CELL } from './units';

interface Ping {
  x: number;
  y: number;
  age: number;
}

/** where the player is about to place a building, and whether the sim would allow it */
export interface PlacementGhost {
  cell: number;
  ok: boolean;
  type: BuildingType;
}

const GHOST_OK = 0x2ea84a;
const GHOST_BAD = 0xe0432a;

interface Landing {
  x: number;
  y: number;
  r: number;
  age: number;
}

const LANDING_SECONDS = 0.8;

const STATE_COLOR = { growing: -1, starved: 0xe8872b, blocked: 0xe0432a, arrived: 0xffffff } as const;
const PING_SECONDS = 0.9;

/** Inked target markers with tip state, and the rough red "X" shown for a rejected command. */
export class FxLayer {
  readonly container = new Container();
  private readonly g = new Graphics();
  private pings: Ping[] = [];
  private landings: Landing[] = [];
  private readonly countdowns = new Map<number, Text>();

  constructor() {
    this.container.addChild(this.g);
  }

  /** a dust burst where a food drop just landed */
  addLanding(cell: number, width: number, radius: number): void {
    this.landings.push({ x: (cell % width) * CELL + CELL / 2, y: Math.floor(cell / width) * CELL + CELL / 2, r: radius, age: 0 });
  }

  addRejectPing(cell: number, width: number): void {
    this.pings.push({ x: (cell % width) * CELL + CELL / 2, y: Math.floor(cell / width) * CELL + CELL / 2, age: 0 });
  }

  /**
   * Incoming food: a jagged comic burst with a "!" and a countdown, visible to everyone across
   * the whole map (FR-031), then a dust ring when it lands.
   */
  private drawDrops(g: Graphics, world: Readonly<World>, dt: number, timeSeconds: number): void {
    const live = new Set<number>();
    for (const d of world.drops) {
      if (d.state !== 'warning') continue;
      live.add(d.id);
      const spec = world.balance.foodTypes[d.type];
      const [x0, y0] = FxLayer.markerPosition(d.cell, world.width);
      const x = x0 + ((spec.w - 1) * CELL) / 2;
      const y = y0 + ((spec.h - 1) * CELL) / 2;
      const secondsLeft = Math.max(0, (d.landTick - world.tick) * 0.05);
      const urgency = 1 - secondsLeft / world.balance.dropWarning;
      const radius = (Math.max(spec.w, spec.h) * CELL) / 2 + 10 + urgency * 6 + Math.sin(timeSeconds * 9) * 2;
      // landing zone outline, then the burst
      g.rect(x0 - 2, y0 - 2, spec.w * CELL + 4, spec.h * CELL + 4).stroke({ width: 3, color: INK, alpha: 0.8 });
      const pts: number[] = [];
      const spikes = 11;
      const frame = Math.floor(timeSeconds * 8);
      for (let s = 0; s < spikes * 2; s++) {
        const ang = (s / (spikes * 2)) * Math.PI * 2;
        const r = s % 2 === 0 ? radius * (0.9 + hash2(d.id, s + frame * 32, 3) * 0.25) : radius * 0.62;
        pts.push(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
      }
      g.poly(pts, true).fill(urgency > 0.6 ? 0xe0432a : 0xffd23a).stroke({ width: 3.5, color: INK, join: 'miter' });
      let label = this.countdowns.get(d.id);
      if (!label) {
        label = new Text({ text: '', style: { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 26, fill: 0xffffff, stroke: { color: INK, width: 5 } } });
        label.anchor.set(0.5);
        this.container.addChild(label);
        this.countdowns.set(d.id, label);
      }
      label.text = `!${Math.ceil(secondsLeft)}`;
      label.position.set(x, y);
    }
    for (const [id, label] of this.countdowns) {
      if (live.has(id)) continue;
      label.destroy();
      this.countdowns.delete(id);
    }

    this.landings = this.landings.filter((l) => (l.age += dt) < LANDING_SECONDS);
    for (const l of this.landings) {
      const f = l.age / LANDING_SECONDS;
      const r = l.r * (0.4 + f * 1.2);
      g.circle(l.x, l.y, r).stroke({ width: 5 * (1 - f) + 1, color: INK, alpha: 1 - f });
      for (let s = 0; s < 8; s++) {
        const ang = (s / 8) * Math.PI * 2 + 0.3;
        g.moveTo(l.x + Math.cos(ang) * r * 0.7, l.y + Math.sin(ang) * r * 0.7).lineTo(l.x + Math.cos(ang) * r * 1.15, l.y + Math.sin(ang) * r * 1.15);
      }
      g.stroke({ width: 3, color: INK, alpha: 1 - f, cap: 'round' });
    }
  }

  /**
   * Angular comic starbursts on every visible battle front, bigger where more nutrients are
   * being thrown at it (FR-032). The points re-seed 8 times a second so they flicker like ink.
   */
  private drawBursts(g: Graphics, world: Readonly<World>, timeSeconds: number): void {
    const vision = world.molds[0]?.vision;
    const base = world.balance.basePressure;
    const bursts: { cell: number; power: number }[] = [];
    for (const mold of world.molds) {
      for (const cell of mold.frontCells) {
        if (vision && vision[cell] !== 2) continue;
        const power = (world.pressure[cell] as number) + base;
        if (power > 0.5) bursts.push({ cell, power });
      }
    }
    if (bursts.length === 0) return;
    bursts.sort((a, b) => b.power - a.power || a.cell - b.cell);
    const frame = Math.floor(timeSeconds * 8);
    for (const { cell, power } of bursts.slice(0, 36)) {
      const [x, y] = FxLayer.markerPosition(cell, world.width);
      const outer = 5 + Math.min(11, power * 1.8);
      const points = 8;
      const pts: number[] = [];
      for (let s = 0; s < points * 2; s++) {
        const ang = (s / (points * 2)) * Math.PI * 2 + (hash2(cell, frame, 5) - 0.5) * 0.5;
        const r = s % 2 === 0 ? outer * (0.85 + hash2(cell, s + frame * 16, 6) * 0.3) : outer * 0.45;
        pts.push(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
      }
      g.poly(pts, true).fill(0xffd23a).stroke({ width: 2.5, color: INK, join: 'miter' });
      g.circle(x, y, outer * 0.28).fill(0xe0432a);
    }
  }

  /** world position of a target marker, for hit-testing right-clicks */
  static markerPosition(cell: number, width: number): [number, number] {
    return [(cell % width) * CELL + CELL / 2, Math.floor(cell / width) * CELL + CELL / 2];
  }

  update(world: Readonly<World>, player: Mold | undefined, dt: number, timeSeconds: number, ghost: PlacementGhost | null = null): void {
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
    this.drawBursts(g, world, timeSeconds);
    this.drawDrops(g, world, dt, timeSeconds);
    if (ghost && player) {
      const [gx, gy] = cellCenter(ghost.cell, world.width);
      const color = ghost.ok ? GHOST_OK : GHOST_BAD;
      g.rect(gx - CELL / 2, gy - CELL / 2, CELL, CELL).stroke({ width: 2, color, alpha: 0.9 });
      if (ghost.type === 'booster') drawBoosterArea(g, gx, gy, world.balance.buildings.booster.radius, color, 0.7);
      drawBuilding(g, ghost.type, gx, gy, moldColor(player.color), { ghost: color });
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
