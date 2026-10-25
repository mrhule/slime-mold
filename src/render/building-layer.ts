import { Container, Graphics } from 'pixi.js';
import { boosterCover, storeCover } from '../sim/index';
import { BUILDING_OF_CODE } from '../sim/types';
import type { Building, BuildingType, FoodSource, World } from '../sim/types';
import { INK, moldColor } from './palette';
import { CELL } from './units';

const POT = 0x8a5a2b;
const POT_SHADE = 0x5e3a1b;
const POT_LIGHT = 0xc58a4e;
const SPOT = 0xfff6dc;
/** the farm is drawn a bit larger than one cell so it reads at a glance */
const FARM_SCALE = 1.35;

const BOOST_GREY = 0x7a7f84;
const BOOST_SHADE = 0x4b4f53;
const BOOST_LIGHT = 0xb9bec2;
const BOLT = 0xffd23a;
const RIG = 0x4f9aa8;
const RIG_SHADE = 0x2f6a77;
const RIG_LIGHT = 0xa6dbe4;
const STALE_GREY = 0x8a8a84;
const UNLINKED = 0xf2a01e;
const BARN_WOOD = 0x9a6a3a;
const BARN_LIGHT = 0xc58a4e;
const BARN_ROOF = 0xa8432f;
const BARN_DOOR = 0x5e3a1b;
const TANK_SHADE = 0x8d8f80;
const TANK_LIGHT = 0xd8d9c8;

/** world-space center of a cell */
export const cellCenter = (cell: number, width: number): [number, number] => [(cell % width) * CELL + CELL / 2, Math.floor(cell / width) * CELL + CELL / 2];

export interface BuildingStyle {
  /** outline color override: used for the placement ghost */
  ghost?: number;
  /** a remembered, out-of-sight building: dim and uncolored */
  stale?: boolean;
  /** a harvester whose food is used up */
  idle?: boolean;
}

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
    g.ellipse(cx + (dx + r * 0.38) * S, cy + (dy + r * 0.3) * S, r * 0.5 * S, r * 0.34 * S).fill({ color: INK, alpha: 0.26 * alpha });
    g.circle(cx + (dx - r * 0.3) * S, cy + (dy - r * 0.2) * S, Math.max(0.9, r * 0.22 * S)).fill({ color: SPOT, alpha });
  }

  // planter: dark lower band, lit upper band, thick rim
  g.ellipse(cx, cy + 3.4 * S, 9 * S, 5.6 * S).fill({ color: POT_SHADE, alpha }).stroke({ width: w, color: ink, alpha });
  g.ellipse(cx, cy + 2.6 * S, 9 * S, 4.1 * S).fill({ color: POT, alpha }).stroke({ width: w, color: ink, alpha });
  g.ellipse(cx - 2.4 * S, cy + 1.4 * S, 3.6 * S, 1.2 * S).fill({ color: POT_LIGHT, alpha });
}

/** An inked booster factory: a squat machine with a chimney and a lightning bolt on its front. */
export function drawBooster(g: Graphics, cx: number, cy: number, flag: number, style: BuildingStyle = {}): void {
  const alpha = style.ghost !== undefined ? 0.6 : style.stale ? 0.55 : 1;
  const ink = style.ghost ?? INK;
  const S = 1.3;
  const w = style.ghost !== undefined ? 2.5 : 3;
  const body = style.stale ? STALE_GREY : BOOST_GREY;
  g.ellipse(cx + 2 * S, cy + 6.5 * S, 10 * S, 3.6 * S).fill({ color: INK, alpha: 0.45 * alpha });
  // chimney with a smoke puff
  g.rect(cx + 3.5 * S, cy - 9 * S, 4 * S, 9 * S).fill({ color: BOOST_SHADE, alpha }).stroke({ width: w, color: ink, alpha });
  g.circle(cx + 6 * S, cy - 12 * S, 2.8 * S).fill({ color: 0xe8e6de, alpha }).stroke({ width: 2, color: ink, alpha });
  // body: dark base band, lit upper band
  g.roundRect(cx - 9 * S, cy - 4 * S, 18 * S, 11 * S, 1.5).fill({ color: BOOST_SHADE, alpha }).stroke({ width: w, color: ink, alpha, join: 'round' });
  g.rect(cx - 7.5 * S, cy - 2.5 * S, 15 * S, 5 * S).fill({ color: body, alpha });
  g.rect(cx - 7.5 * S, cy - 2.5 * S, 15 * S, 1.6 * S).fill({ color: BOOST_LIGHT, alpha });
  g.rect(cx - 7.5 * S, cy - 2.5 * S, 1.8 * S, 5 * S).fill({ color: BOOST_LIGHT, alpha });
  g.rect(cx + 5.7 * S, cy - 2.5 * S, 1.8 * S, 5 * S).fill({ color: BOOST_SHADE, alpha });
  // lightning bolt
  const bolt = [cx - 1 * S, cy - 2 * S, cx - 4 * S, cy + 2.5 * S, cx - 0.5 * S, cy + 2.2 * S, cx - 2.5 * S, cy + 6 * S, cx + 3.5 * S, cy + 0.5 * S, cx + 0.3 * S, cy + 0.8 * S, cx + 2 * S, cy - 2 * S];
  g.poly(bolt, true).fill({ color: style.stale ? STALE_GREY : BOLT, alpha }).stroke({ width: 1.8, color: ink, alpha, join: 'miter' });
  // owner's flag on the roof
  if (!style.stale) g.rect(cx - 8 * S, cy - 8 * S, 5 * S, 3 * S).fill({ color: flag, alpha }).stroke({ width: 1.8, color: ink, alpha });
}

/** An inked harvester: a tripod rig with a bucket, dimmed and crossed out once its food is gone. */
export function drawHarvester(g: Graphics, cx: number, cy: number, flag: number, style: BuildingStyle = {}): void {
  const alpha = style.ghost !== undefined ? 0.6 : style.stale ? 0.55 : style.idle ? 0.6 : 1;
  const ink = style.ghost ?? INK;
  const S = 1.3;
  const w = style.ghost !== undefined ? 2.5 : 3;
  const col = style.stale || style.idle ? STALE_GREY : RIG;
  g.ellipse(cx + 2 * S, cy + 6 * S, 9.5 * S, 3.4 * S).fill({ color: INK, alpha: 0.45 * alpha });
  // tripod legs, ink first and then the colored core
  const legs = (): void => {
    g.moveTo(cx, cy - 9 * S).lineTo(cx - 8 * S, cy + 5 * S);
    g.moveTo(cx, cy - 9 * S).lineTo(cx + 8 * S, cy + 5 * S);
    g.moveTo(cx, cy - 9 * S).lineTo(cx, cy + 6 * S);
  };
  legs();
  g.stroke({ width: 5.5, color: ink, alpha, cap: 'round' });
  legs();
  g.stroke({ width: 2.4, color: RIG_SHADE, alpha, cap: 'round' });
  // hanging bucket on a line
  g.moveTo(cx, cy - 9 * S).lineTo(cx, cy - 1 * S).stroke({ width: 1.8, color: ink, alpha });
  g.poly([cx - 4 * S, cy - 1 * S, cx + 4 * S, cy - 1 * S, cx + 3 * S, cy + 4 * S, cx - 3 * S, cy + 4 * S], true).fill({ color: col, alpha }).stroke({ width: w, color: ink, alpha, join: 'round' });
  g.rect(cx - 3.2 * S, cy - 0.6 * S, 6.4 * S, 1.4 * S).fill({ color: RIG_LIGHT, alpha });
  g.poly([cx + 1.6 * S, cy - 0.4 * S, cx + 3.6 * S, cy - 0.4 * S, cx + 2.8 * S, cy + 3.9 * S, cx + 1.4 * S, cy + 3.9 * S], true).fill({ color: RIG_SHADE, alpha: 0.75 * alpha });
  // pulley wheel in the owner's color at the top
  g.circle(cx, cy - 9 * S, 2.4 * S).fill({ color: style.stale ? STALE_GREY : flag, alpha }).stroke({ width: 2, color: ink, alpha });
  if (style.idle) {
    g.moveTo(cx - 5 * S, cy - 4 * S).lineTo(cx + 5 * S, cy + 3 * S);
    g.moveTo(cx + 5 * S, cy - 4 * S).lineTo(cx - 5 * S, cy + 3 * S);
    g.stroke({ width: 2.2, color: ink, alpha: 0.7 });
  }
}

/**
 * An inked store house: a squat barn with a red roof and a round steel tank beside it, so it
 * reads as "storage" and differs from the farm's mushrooms, the booster's chimney and the
 * harvester's tripod even in grayscale.
 */
export function drawStoreHouse(g: Graphics, cx: number, cy: number, flag: number, style: BuildingStyle = {}): void {
  const alpha = style.ghost !== undefined ? 0.6 : style.stale ? 0.55 : 1;
  const ink = style.ghost ?? INK;
  const S = 1.3;
  const w = style.ghost !== undefined ? 2.5 : 3;
  const wood = style.stale ? STALE_GREY : BARN_WOOD;
  const roof = style.stale ? STALE_GREY : BARN_ROOF;
  g.ellipse(cx + 2 * S, cy + 6.5 * S, 11 * S, 3.6 * S).fill({ color: INK, alpha: 0.45 * alpha });
  // round tank on the right: a dark band under a lit stripe
  g.roundRect(cx + 3 * S, cy - 5 * S, 8 * S, 12 * S, 3.4 * S).fill({ color: TANK_SHADE, alpha }).stroke({ width: w, color: ink, alpha, join: 'round' });
  g.roundRect(cx + 4.4 * S, cy - 3.6 * S, 3 * S, 8 * S, 1.4 * S).fill({ color: TANK_LIGHT, alpha });
  // barn body and door
  g.rect(cx - 10 * S, cy - 3 * S, 14 * S, 10 * S).fill({ color: wood, alpha }).stroke({ width: w, color: ink, alpha, join: 'round' });
  g.rect(cx - 5.5 * S, cy + 1 * S, 5 * S, 6 * S).fill({ color: BARN_DOOR, alpha }).stroke({ width: 2, color: ink, alpha });
  g.rect(cx - 9.2 * S, cy - 2.4 * S, 1.8 * S, 9 * S).fill({ color: BARN_LIGHT, alpha: 0.8 * alpha });
  g.rect(cx + 2.4 * S, cy - 2.4 * S, 1.2 * S, 9 * S).fill({ color: INK, alpha: 0.22 * alpha });
  // roof
  g.poly([cx - 12 * S, cy - 2.5 * S, cx - 3 * S, cy - 10 * S, cx + 6 * S, cy - 2.5 * S], true).fill({ color: roof, alpha }).stroke({ width: w, color: ink, alpha, join: 'round' });
  g.poly([cx - 3 * S, cy - 10 * S, cx + 6 * S, cy - 2.5 * S, cx - 3 * S, cy - 2.5 * S], true).fill({ color: INK, alpha: 0.2 * alpha });
  g.roundRect(cx + 8.6 * S, cy - 4 * S, 1.8 * S, 10 * S, 0.9 * S).fill({ color: INK, alpha: 0.2 * alpha });
  // owner's flag on the roof peak
  if (!style.stale) g.rect(cx - 3 * S, cy - 14 * S, 5 * S, 3 * S).fill({ color: flag, alpha }).stroke({ width: 1.8, color: ink, alpha });
}

/** draw any building by type */
export function drawBuilding(g: Graphics, type: BuildingType, cx: number, cy: number, color: number, style: BuildingStyle = {}): void {
  if (type === 'farm') drawFarm(g, cx, cy, style.stale ? STALE_GREY : color, style.ghost);
  else if (type === 'storehouse') drawStoreHouse(g, cx, cy, color, style);
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

/** A small broken-chain mark above a farm that has no store house on its vein. */
export function drawUnlinked(g: Graphics, cx: number, cy: number): void {
  const y = cy - 19;
  g.circle(cx - 4.5, y, 3.2).stroke({ width: 3.6, color: INK });
  g.circle(cx + 4.5, y, 3.2).stroke({ width: 3.6, color: INK });
  g.circle(cx - 4.5, y, 3.2).stroke({ width: 1.8, color: UNLINKED });
  g.circle(cx + 4.5, y, 3.2).stroke({ width: 1.8, color: UNLINKED });
  g.moveTo(cx - 1.5, y - 5).lineTo(cx + 1.5, y + 5).stroke({ width: 4, color: INK, cap: 'round' });
  g.moveTo(cx - 1.5, y - 5).lineTo(cx + 1.5, y + 5).stroke({ width: 2, color: UNLINKED, cap: 'round' });
}

/** A soft glow along every vein a booster factory strengthens, fading with its taper. */
export function drawBoosterCover(g: Graphics, width: number, cover: { cell: number; bonus: number }[], maxBonus: number, color: number, alpha = 1): void {
  for (const { cell, bonus } of cover) {
    const [x, y] = cellCenter(cell, width);
    const t = Math.max(0, bonus / maxBonus);
    g.circle(x, y, CELL * (0.7 + 0.5 * t)).fill({ color, alpha: alpha * (0.1 + 0.3 * t) });
  }
}

/** Buildings drawn above the veins, redrawn only when what the player can see changes. */
export class BuildingLayer {
  readonly container = new Container();
  private readonly areas = new Graphics();
  private readonly g = new Graphics();
  private lastKey = '';

  constructor() {
    this.container.addChild(this.areas, this.g);
  }

  update(world: Readonly<World>): void {
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
      key += shown(b) ? `${b.id}${idle}${b.type === 'farm' ? (b.linked ? 'l' : 'u') : ''},` : 'x';
    }
    for (const r of remembered) key += `m${r.cell}${r.type[0]},`;
    // the veins a booster covers keep growing, so redraw its glow a few times a second
    if (world.buildings.some((b) => (b.type === 'booster' || b.type === 'storehouse') && !b.destroyed)) key += `t${Math.floor(world.tick / 10)}`;
    for (const b of world.buildings) if (b.type === 'storehouse' && !b.destroyed) key += b.boosting ? 'b' : 'o';
    if (key === this.lastKey) return;
    this.lastKey = key;

    this.areas.clear();
    this.g.clear();
    for (const r of remembered) {
      const [x, y] = cellCenter(r.cell, world.width);
      drawBuilding(this.g, r.type, x, y, 0, { stale: true });
    }
    const boosterSpec = world.balance.buildings.booster;
    for (const b of world.buildings) {
      if (!shown(b)) continue;
      const [x, y] = cellCenter(b.cell, world.width);
      const mold = world.molds[b.moldId - 1];
      const color = moldColor(mold ? mold.color : 0);
      if (b.type === 'storehouse' && b.boosting) drawStoreCover(this.areas, world.width, storeCover(world, b.cell), world.balance.buildings.storehouse.bonus, color);
      if (b.type === 'booster') drawBoosterCover(this.areas, world.width, boosterCover(world, b.cell), boosterSpec.bonus, color);
      const food = foodOf(b);
      const idle = b.type === 'harvester' && (food?.depleted ?? true);
      if (b.type === 'harvester' && !idle && food) {
        // a dotted line to the food it works on
        const dx = (food.x + food.w / 2) * CELL - x;
        const dy = (food.y + food.h / 2) * CELL - y;
        const len = Math.hypot(dx, dy) || 1;
        for (let d = 8; d < len - 6; d += 9) this.areas.circle(x + (dx / len) * d, y + (dy / len) * d, 1.6).fill({ color: INK, alpha: 0.7 });
      }
      drawBuilding(this.g, b.type, x, y, color, { idle });
      if (b.type === 'farm' && !b.linked) drawUnlinked(this.g, x, y);
    }
  }
}
