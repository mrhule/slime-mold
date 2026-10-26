import { Container, Graphics } from 'pixi.js';
import { capOf } from '../sim/index';
import { BUILDING_OF_CODE } from '../sim/types';
import type { Building, BuildingType, FoodSource, World } from '../sim/types';
import { INK, moldColor } from './palette';
import { style as look } from './style';
import { CELL } from './units';


const STALE_GREY = 0x8a8a84;
const UNLINKED = 0xf2a01e;
const AMBER = 0xe8a21e;
const AMBER_SHADE = 0xa8620c;
const AMBER_LIGHT = 0xffe9a0;
const AMBER_GLOW = 0xffcf3a;
const PULSE_BODY = 0xf5f2d2;
const PULSE_SHADE = 0xc9c27a;
const PULSE_CORE = 0xffee4a;
const DIGEST = 0x9ccc2e;
const DIGEST_SHADE = 0x5c8a1a;
const DIGEST_LIGHT = 0xe3ff9c;

/** world-space center of a cell */
export const cellCenter = (cell: number, width: number): [number, number] => [(cell % width) * CELL + CELL / 2, Math.floor(cell / width) * CELL + CELL / 2];

/** how a building is drawn: a placement ghost, a remembered one out of sight, an idle one, and the clock and fullness that drive the motion */
export interface BuildingStyle {
  /** outline color override: used for the placement ghost */
  ghost?: number;
  /** a remembered, out-of-sight building: dim and uncolored */
  stale?: boolean;
  /** a harvester whose food is used up */
  idle?: boolean;
  /** seconds, for the beat, the swell and the kneading */
  t?: number;
  /** 0..1 how full a store's piece is, for how far it swells and how brightly it glows */
  fill?: number;
  /** a factory's level (1 up to maxLevel), shown as extra bulbs and pips */
  level?: number;
  maxLevel?: number;
}

/** a remembered or ghosted building holds still */
const still = (style: BuildingStyle): boolean => style.stale === true || style.ghost !== undefined;

/**
 * An inked pulse node: a four-pointed muscular knot with a bright core that beats like a heart
 * (a quick double beat), so it reads as the thing that drives the veins it sits on.
 */
export function drawBooster(g: Graphics, cx: number, cy: number, flag: number, style: BuildingStyle = {}): void {
  const alpha = style.ghost !== undefined ? 0.6 : style.stale ? 0.55 : 1;
  const ink = style.ghost ?? INK;
  const S = 1.3;
  const w = style.ghost !== undefined ? 2.5 : 3;
  const phase = (style.t ?? 0) * 5.2;
  const beat = still(style) ? 0 : Math.max(0, Math.sin(phase)) ** 6 + 0.55 * Math.max(0, Math.sin(phase - 1.15)) ** 6;
  const k = 1 + 0.13 * beat;
  const body = style.stale ? STALE_GREY : PULSE_BODY;
  const shade = style.stale ? STALE_GREY : PULSE_SHADE;
  const core = style.stale ? STALE_GREY : PULSE_CORE;
  g.ellipse(cx + look.shadow.groundOffset[0], cy + 8 * S, 11 * S, 3.4 * S).fill({ color: INK, alpha: look.shadow.groundAlpha * 1.5 * alpha });
  const star = (scale: number): number[] => {
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4 - Math.PI / 2;
      const r = (i % 2 === 0 ? 11 : 5.4) * S * k * scale;
      pts.push(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.92);
    }
    return pts;
  };
  g.poly(star(1), true).fill({ color: shade, alpha }).stroke({ width: w, color: ink, alpha, join: 'round' });
  g.poly(star(0.74), true).fill({ color: body, alpha });
  // muscle bands pulling in toward the core
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 - Math.PI / 4;
    g.moveTo(cx + Math.cos(ang) * 3.2 * S, cy + Math.sin(ang) * 3.2 * S).lineTo(cx + Math.cos(ang) * 6.4 * S * k, cy + Math.sin(ang) * 6.4 * S * k * 0.92);
  }
  g.stroke({ width: 1.4, color: ink, alpha: 0.55 * alpha, cap: 'round' });
  // the bright core, swelling with each beat, with a ring that flashes out
  if (beat > 0.05) g.circle(cx, cy, (4.4 + 3.6 * beat) * S).stroke({ width: 2, color: PULSE_CORE, alpha: 0.7 * beat });
  g.circle(cx, cy, 3.4 * S * (1 + 0.3 * beat)).fill({ color: core, alpha }).stroke({ width: 2, color: ink, alpha });
  g.circle(cx - 0.5 * S, cy - 0.6 * S, 1.3 * S).fill({ color: 0xffffff, alpha: 0.9 * alpha });
  // owner's flag on the north tip
  if (!style.stale) g.rect(cx - 2.5 * S, cy - 11 * S * k - 4.4 * S, 5 * S, 3 * S).fill({ color: flag, alpha }).stroke({ width: 1.8, color: ink, alpha });
}

/**
 * An inked digestor: a stalk topped by a cup with a ring of curled fingers clamped over the food.
 * The fingers flex and bubbles rise while it works; gray and crossed out once its food is gone.
 */
export function drawHarvester(g: Graphics, cx: number, cy: number, flag: number, style: BuildingStyle = {}): void {
  const alpha = style.ghost !== undefined ? 0.6 : style.stale ? 0.55 : style.idle ? 0.6 : 1;
  const ink = style.ghost ?? INK;
  const S = 1.3;
  const w = style.ghost !== undefined ? 2.5 : 3;
  const t = style.t ?? 0;
  const working = !style.stale && !style.idle && style.ghost === undefined;
  const col = style.stale || style.idle ? STALE_GREY : DIGEST;
  const shade = style.stale || style.idle ? STALE_GREY : DIGEST_SHADE;
  g.ellipse(cx + look.shadow.groundOffset[0], cy + 7 * S, 9 * S, 3.2 * S).fill({ color: INK, alpha: look.shadow.groundAlpha * 1.5 * alpha });
  // stalk, ink first and then the colored core
  const stalk = (): void => {
    g.moveTo(cx, cy + 6 * S).quadraticCurveTo(cx + 1.2 * S, cy + 1 * S, cx, cy - 5 * S);
  };
  stalk();
  g.stroke({ width: 6.4, color: ink, alpha, cap: 'round' });
  stalk();
  g.stroke({ width: 3.4, color: col, alpha, cap: 'round' });
  // root knob in the owner's color
  g.circle(cx, cy + 5.6 * S, 2.6 * S).fill({ color: style.stale ? STALE_GREY : flag, alpha }).stroke({ width: 2, color: ink, alpha });
  // the cup and its dark mouth
  g.ellipse(cx, cy - 5 * S, 6.2 * S, 2.7 * S).fill({ color: shade, alpha }).stroke({ width: w, color: ink, alpha });
  g.ellipse(cx, cy - 5.5 * S, 4.4 * S, 1.6 * S).fill({ color: working ? 0x223a0c : 0x4a4a46, alpha });
  // curled fingers over the top: [start x, control x, end x, flex phase]
  const fingers: [number, number, number, number, number][] = [
    [-6.6, -13, -3.4, 0, 11],
    [-3.3, -6.4, -1.5, 1.3, 13],
    [0, 0.6, 0.2, 2.6, 14],
    [3.3, 6.4, 1.5, 3.9, 13],
    [6.6, 13, 3.4, 5.2, 11],
  ];
  for (const [sx, qx, ex, ph, h] of fingers) {
    const flex = working ? Math.sin(t * 2.4 + ph) * 1.1 * S : 0;
    const tipX = cx + ex * S - flex * 0.4;
    const tipY = cy - h * S + Math.abs(flex) * 0.3;
    const path = (): void => {
      g.moveTo(cx + sx * S, cy - 5 * S).quadraticCurveTo(cx + qx * S + flex, cy - (h + 4) * S, tipX, tipY);
    };
    path();
    g.stroke({ width: 4.4, color: ink, alpha, cap: 'round' });
    path();
    g.stroke({ width: 2, color: col, alpha, cap: 'round' });
    g.circle(tipX, tipY, 1.2 * S).fill({ color: working ? DIGEST_LIGHT : col, alpha }).stroke({ width: 1.6, color: ink, alpha });
  }
  // digestive bubbles rising from the cup
  if (working) {
    for (let i = 0; i < 3; i++) {
      const f = (t * 0.55 + i / 3) % 1;
      const bx = cx + Math.sin(i * 2.1 + t * 1.3) * 2.4 * S;
      const by = cy - 6 * S - f * 9 * S;
      const r = 1.1 * S * (1 - f * 0.45);
      g.circle(bx, by, r).fill({ color: DIGEST_LIGHT, alpha: 1 - f }).stroke({ width: 1, color: ink, alpha: 0.8 * (1 - f) });
    }
  }
  if (style.idle) {
    g.moveTo(cx - 5 * S, cy - 4 * S).lineTo(cx + 5 * S, cy + 3 * S);
    g.moveTo(cx + 5 * S, cy - 4 * S).lineTo(cx - 5 * S, cy + 3 * S);
    g.stroke({ width: 2.2, color: ink, alpha: 0.7 });
  }
}

/**
 * An inked sac: a low, wide cluster of three amber bulbs held by root tendrils. It swells and glows
 * brighter as its piece fills with nutrients, and breathes a little, so a full store looks full.
 */
export function drawStoreHouse(g: Graphics, cx: number, cy: number, flag: number, style: BuildingStyle = {}): void {
  const alpha = style.ghost !== undefined ? 0.6 : style.stale ? 0.55 : 1;
  const ink = style.ghost ?? INK;
  const S = 1.3;
  const w = style.ghost !== undefined ? 2.5 : 3;
  const fill = style.stale ? 0 : Math.min(1, Math.max(0, style.fill ?? 0.4));
  const breathe = 1 + (still(style) ? 0 : 0.035 * Math.sin((style.t ?? 0) * 2.1)) + 0.12 * fill;
  const base = style.stale ? STALE_GREY : AMBER;
  const shade = style.stale ? STALE_GREY : AMBER_SHADE;
  g.ellipse(cx + look.shadow.groundOffset[0], cy + 7 * S, 12.5 * S, 3.6 * S).fill({ color: INK, alpha: look.shadow.groundAlpha * 1.5 * alpha });
  // root tendrils spreading from under the bulbs, ink first and then a dark amber core
  const rootEnds: [number, number][] = [
    [-5, -12],
    [-2, -4],
    [3, 5],
    [6, 13],
  ];
  const drawRoots = (): void => {
    for (const [x0, x1] of rootEnds) g.moveTo(cx + x0 * S, cy + 3 * S).quadraticCurveTo(cx + x1 * 0.8 * S, cy + 9 * S, cx + x1 * S, cy + 6.4 * S);
  };
  drawRoots();
  g.stroke({ width: 4.6, color: ink, alpha, cap: 'round' });
  drawRoots();
  g.stroke({ width: 2, color: shade, alpha, cap: 'round' });
  const bulb = (x: number, y: number, r: number): void => {
    g.circle(x, y, r).fill({ color: base, alpha }).stroke({ width: w, color: ink, alpha });
    if (!style.stale) g.circle(x, y + r * 0.08, r * 0.62).fill({ color: AMBER_GLOW, alpha: (0.2 + 0.65 * fill) * alpha });
    // shaded lower-right crescent and a lit upper-left rim
    g.moveTo(x + Math.cos(0.1) * r * 0.8, y + Math.sin(0.1) * r * 0.8).arc(x, y, r * 0.8, 0.1, 1.5).stroke({ width: r * 0.24, color: shade, alpha: 0.8 * alpha, cap: 'round' });
    g.moveTo(x + Math.cos(3.3) * r * 0.7, y + Math.sin(3.3) * r * 0.7).arc(x, y, r * 0.7, 3.3, 4.7).stroke({ width: 1.8, color: style.stale ? 0xdadad2 : AMBER_LIGHT, alpha, cap: 'round' });
  };
  const level = style.level ?? 1;
  // each level above the first grows another small bulb out of the back of the cluster
  if (level >= 2) bulb(cx - 3.6 * S, cy - 5.4 * S, 3.4 * S * breathe);
  if (level >= 3) bulb(cx + 4.4 * S, cy - 5 * S, 3.1 * S * breathe);
  bulb(cx - 8.6 * S, cy + 1.6 * S, 5 * S * breathe);
  bulb(cx + 8.8 * S, cy + 2.2 * S, 4.5 * S * breathe);
  const topR = 6.2 * S * breathe;
  bulb(cx, cy - 0.6 * S, topR);
  // level pips under the cluster: filled for each level reached, hollow for the rest
  if (!style.stale) {
    const max = style.maxLevel ?? 3;
    for (let i = 0; i < max; i++) {
      const px = cx + (i - (max - 1) / 2) * 4.4 * S;
      const on = i < level;
      g.circle(px, cy + 9.6 * S, 1.5 * S).fill({ color: on ? AMBER_GLOW : 0x2c2b22, alpha: (on ? 1 : 0.6) * alpha }).stroke({ width: 1.4, color: ink, alpha });
    }
  }
  // owner's color: a small spore budding off the big bulb (no stalk, which would read as a fuse)
  if (!style.stale) g.circle(cx + topR * 0.62, cy - 0.6 * S - topR * 0.8, 2.2 * S).fill({ color: flag, alpha }).stroke({ width: 1.8, color: ink, alpha });
}

/** draw any building by type */
export function drawBuilding(g: Graphics, type: BuildingType, cx: number, cy: number, color: number, style: BuildingStyle = {}): void {
  if (type === 'storehouse') drawStoreHouse(g, cx, cy, color, style);
  else if (type === 'booster') drawBooster(g, cx, cy, color, style);
  else drawHarvester(g, cx, cy, color, style);
}

/**
 * Rings along every vein a store house speeds up, fading with its taper. Rings, not the booster's
 * filled glow, so the two read apart (growth and harvest versus combat).
 */
export function drawStoreCover(g: Graphics, width: number, cover: { cell: number; bonus: number }[], maxBonus: number, color: number, alpha = 1): void {
  for (const { cell, bonus } of cover) {
    const [x, y] = cellCenter(cell, width);
    const t = Math.max(0, bonus / maxBonus);
    g.circle(x, y, CELL * (0.8 + 0.5 * t)).stroke({ width: 2.8, color: INK, alpha: alpha * (0.15 + 0.35 * t) });
    g.circle(x, y, CELL * (0.8 + 0.5 * t)).stroke({ width: 1.6, color, alpha: alpha * (0.3 + 0.6 * t) });
  }
}

/**
 * Small inked droplets riding the veins a building affects, flowing out from it: big at the
 * source and shrinking as the effect tapers, sparser too. `steps` maps each covered cell to the
 * neighbor one step closer to the source; a drop runs from that neighbor to the cell, so it
 * shrinks along the way. `t` is the strength at the cell and `tNext` at the neighbor (1 = at the source).
 */
export function drawStoreDrops(g: Graphics, width: number, steps: { cell: number; next: number; t: number; tNext: number }[], color: number, timeSeconds: number, core?: number): void {
  for (const { cell, next, t, tNext } of steps) {
    const seed = ((cell * 2654435761) >>> 0) / 4294967296;
    // sparser drops where the effect is weak
    if (seed > 0.3 + 0.7 * t) continue;
    const [x1, y1] = cellCenter(next, width);
    const [x2, y2] = cellCenter(cell, width);
    const f = (timeSeconds * 0.9 + seed * 7) % 1;
    const x = x1 + (x2 - x1) * f;
    const y = y1 + (y2 - y1) * f;
    const r = 1 + 3.6 * (tNext + (t - tNext) * f);
    g.circle(x, y, r + 1.6).fill({ color: INK, alpha: 0.9 });
    g.circle(x, y, r).fill({ color });
    if (core !== undefined) g.circle(x, y, r * 0.5).fill({ color: core });
    g.circle(x - r * 0.35, y - r * 0.35, r * 0.35).fill({ color: 0xffffff, alpha: 0.85 });
  }
}

/** For each cell a building covers: the neighbor one step closer to it, for drops to travel out from. */
export function homewardSteps(width: number, cover: { cell: number; bonus: number }[]): { cell: number; next: number; t: number; tNext: number }[] {
  const bonusOf = new Map<number, number>();
  for (const c of cover) bonusOf.set(c.cell, c.bonus);
  const max = Math.max(...cover.map((c) => c.bonus), 1e-9);
  const out: { cell: number; next: number; t: number; tNext: number }[] = [];
  for (const { cell, bonus } of cover) {
    let best = -1;
    let bestBonus = bonus + 1e-9;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const n = cell + dx + dy * width;
        const b = bonusOf.get(n);
        if (b !== undefined && b > bestBonus) {
          best = n;
          bestBonus = b;
        }
      }
    }
    if (best >= 0) out.push({ cell, next: best, t: bonus / max, tNext: bestBonus / max });
  }
  return out;
}

/** A small broken-chain mark above a goo pool whose piece has no store house. */
export function drawUnlinked(g: Graphics, cx: number, cy: number): void {
  const y = cy - 19;
  g.circle(cx - 4.5, y, 3.2).stroke({ width: 3.6, color: INK });
  g.circle(cx + 4.5, y, 3.2).stroke({ width: 3.6, color: INK });
  g.circle(cx - 4.5, y, 3.2).stroke({ width: 1.8, color: UNLINKED });
  g.circle(cx + 4.5, y, 3.2).stroke({ width: 1.8, color: UNLINKED });
  g.moveTo(cx - 1.5, y - 5).lineTo(cx + 1.5, y + 5).stroke({ width: 4, color: INK, cap: 'round' });
  g.moveTo(cx - 1.5, y - 5).lineTo(cx + 1.5, y + 5).stroke({ width: 2, color: UNLINKED, cap: 'round' });
}

/** Buildings drawn above the veins, redrawn only when what the player can see changes. */
export class BuildingLayer {
  readonly container = new Container();
  private readonly areas = new Graphics();
  private readonly g = new Graphics();
  /** an ink-tinted copy of every building, shifted toward the lower right behind the real one: a heavier outline on the shadow side */
  private readonly rim = new Graphics();
  private lastKey = '';

  constructor() {
    this.rim.tint = INK;
    this.rim.position.set(look.outline.strokeShift[0], look.outline.strokeShift[1]);
    this.container.addChild(this.areas, this.rim, this.g);
  }

  update(world: Readonly<World>, timeSeconds = 0): void {
    const player = world.molds[0];
    const vision = player?.vision;
    const shown = (b: Building): boolean => !b.destroyed && (b.moldId === 1 || !vision || vision[b.cell] === 2);
    const foodOf = (b: Building): FoodSource | undefined => world.foodSources[b.target];

    // buildings the player saw earlier but cannot see now (shown dim, as last known)
    const remembered: { cell: number; type: BuildingType }[] = [];
    if (player && vision) {
      for (let i = 0; i < vision.length; i++) {
        if (vision[i] !== 1) continue;
        const type = BUILDING_OF_CODE[player.memBuilding[i] as number];
        if (type && (player.memOwner[i] as number) !== 1) remembered.push({ cell: i, type });
      }
    }

    let key = '';
    for (const b of world.buildings) {
      const idle = b.type === 'harvester' ? (foodOf(b)?.depleted ? 'i' : 'a') : '';
      key += shown(b) ? `${b.id}${idle},` : 'x';
    }
    for (const r of remembered) key += `m${r.cell}${r.type[0]},`;
    // live buildings move (a beat, a swell, kneading), so redraw about twelve times a second while any is in view
    if (world.buildings.some(shown)) key += `f${Math.floor(timeSeconds * 12)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    this.areas.clear();
    this.g.clear();
    this.rim.clear();
    for (const r of remembered) {
      const [x, y] = cellCenter(r.cell, world.width);
      drawBuilding(this.rim, r.type, x, y, 0, { stale: true });
      drawBuilding(this.g, r.type, x, y, 0, { stale: true });
    }
    const maxLevel = world.balance.buildings.storehouse.maxLevel;
    for (const b of world.buildings) {
      if (!shown(b)) continue;
      const [x, y] = cellCenter(b.cell, world.width);
      const mold = world.molds[b.moldId - 1];
      const color = moldColor(mold ? mold.color : 0);
      const food = foodOf(b);
      const idle = b.type === 'harvester' && (food?.depleted ?? true);
      if (b.type === 'harvester' && !idle && food) {
        // a dotted line to the food it works on
        const dx = (food.x + food.w / 2) * CELL - x;
        const dy = (food.y + food.h / 2) * CELL - y;
        const len = Math.hypot(dx, dy) || 1;
        for (let d = 8; d < len - 6; d += 9) this.areas.circle(x + (dx / len) * d, y + (dy / len) * d, 1.6).fill({ color: INK, alpha: 0.7 });
      }
      const comp = b.type === 'storehouse' ? world.components.get(world.component[b.cell] as number) : undefined;
      const fill = comp ? Math.min(1, comp.pool / capOf(world, comp)) : 0;
      drawBuilding(this.rim, b.type, x, y, color, { idle, t: timeSeconds, fill, level: b.level, maxLevel });
      drawBuilding(this.g, b.type, x, y, color, { idle, t: timeSeconds, fill, level: b.level, maxLevel });
    }
  }
}
