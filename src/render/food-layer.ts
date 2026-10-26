import { Container, Graphics, Sprite } from 'pixi.js';
import { art } from './art';
import { knownFoodLeft, workingStoreHouses } from '../sim/index';
import { hash2 } from '../sim/noise';
import type { FoodSource, World } from '../sim/types';
import { drawUnlinked } from './building-layer';
import { FOOD, INK, moldColor } from './palette';
import { style } from './style';
import { CELL } from './units';

const GOO_LIP = 0x24351c;

/** the glow under food: warm and pale, so it reads against both dark and mid floors */
const HALO_COLOR = 0xffe9a0;
const HALO_RING = 0xfff6d2;
/** the amount bar fill: bright gold, easy to read against the dark track */
const METER_FILL = 0xffd23f;
const HALO_PAD = 9;
/** the smallest a painted food item is drawn, so a tiny oat flake is still easy to spot */
const MIN_FOOD_PX = 30;

/** which painted food drawing each type uses (the order of the generated sheet) */
const FOOD_SPRITE: Partial<Record<FoodSource['type'], number>> = { oatFlake: 0, breadCrumb: 1, sugarCube: 2, fruitSlice: 3 };

/** the remaining-nutrients bar under each food item */
const METER_H = 6;
const METER_MIN_W = 22;
const METER_STEPS = 24;

/** what the player can see of a goo pool: who holds most of it, and whether it is paying or waiting */
interface PoolState {
  owner: number;
  color: number | null;
  paying: boolean;
  waiting: boolean;
}

/** read the pool's ownership from the player's view: only cells in sight now count */
function poolState(world: Readonly<World>, f: FoodSource): PoolState {
  const player = world.molds[0];
  const vision = player?.vision;
  const counts = new Map<number, number>();
  let paying = false;
  let waiting = false;
  for (let y = f.y; y < f.y + f.h; y++) {
    for (let x = f.x; x < f.x + f.w; x++) {
      const c = y * world.width + x;
      if (vision && vision[c] !== 2) continue;
      const owner = world.owner[c] as number;
      if (owner === 0) continue;
      counts.set(owner, (counts.get(owner) ?? 0) + 1);
      const comp = world.components.get(world.component[c] as number);
      const works = !!comp && workingStoreHouses(world, comp) > 0;
      if (works) paying = true;
      else if (owner === 1) waiting = true;
    }
  }
  let owner = 0;
  let most = 0;
  for (const [id, n] of counts) {
    if (n > most || (n === most && id < owner)) {
      owner = id;
      most = n;
    }
  }
  return { owner, color: owner > 0 ? (world.molds[owner - 1]?.color ?? 0) : null, paying, waiting };
}

/** Outlined, cel-shaded food drawn procedurally; shrinks as it is eaten. */
export class FoodLayer {
  readonly container = new Container();
  private readonly g = new Graphics();
  /** an ink-tinted copy of every item shifted toward the lower right behind it: a heavier outline on the shadow side (A12) */
  private readonly rim = new Graphics();
  /** goo pools are terrain, so they are drawn in their own container that sits above the fog (008 FR-001) */
  readonly poolContainer = new Container();
  private readonly poolG = new Graphics();
  private readonly poolRim = new Graphics();
  private lastKey = '';
  /** painted food and pools, one sprite per source, when the art has loaded */
  private readonly foodSprites = new Map<number, Sprite>();
  private readonly poolSprites = new Map<number, Sprite>();
  /** a soft pulsing glow under each item you know about, so food stands out from the floor */
  private readonly halo = new Graphics();
  private shown: { x: number; y: number; r: number }[] = [];
  private readonly spriteLayer = new Container();
  private readonly poolSpriteLayer = new Container();

  constructor() {
    this.rim.tint = INK;
    this.rim.position.set(style.outline.strokeShift[0], style.outline.strokeShift[1]);
    this.container.addChild(this.halo, this.spriteLayer, this.rim, this.g);
    this.poolRim.tint = INK;
    this.poolRim.position.set(style.outline.strokeShift[0], style.outline.strokeShift[1]);
    this.poolContainer.addChild(this.poolSpriteLayer, this.poolRim, this.poolG);
  }

  update(world: Readonly<World>): void {
    this.pulseHalos(world.tick);
    // redraw only when some amount changed visibly
    const known = (f: FoodSource): number | null => knownFoodLeft(world, f)?.amount ?? null;
    const amounts = new Map<number, number>();
    let key = '';
    const pools = new Map<number, PoolState>();
    for (const f of world.foodSources) {
      if (world.balance.foodTypes[f.type].infinite) {
        const st = poolState(world, f);
        pools.set(f.id, st);
        key += `g${st.owner}${st.paying ? 'p' : ''}${st.waiting ? 'w' : ''}${Math.floor(world.tick / 4)},`;
        continue;
      }
      const a = f.depleted ? null : known(f);
      if (a === null || a <= 0) {
        key += 'x';
        continue;
      }
      amounts.set(f.id, a);
      key += `${Math.round(Math.sqrt(a / f.total) * 12)}.${Math.round((a / f.total) * METER_STEPS)},`;
    }
    if (key === this.lastKey) return;
    this.lastKey = key;
    const g = this.g;
    g.clear();
    this.rim.clear();
    this.poolG.clear();
    this.poolRim.clear();
    this.shown = [];
    for (const f of world.foodSources) {
      const st = pools.get(f.id);
      if (st) {
        const painted = this.paintPool(f);
        this.drawGoo(this.poolRim, f, st, world.tick, !painted);
        this.drawGoo(this.poolG, f, st, world.tick, !painted);
        if (st.waiting) drawUnlinked(this.poolG, (f.x + f.w / 2) * CELL, f.y * CELL - 2);
        continue;
      }
      const a = amounts.get(f.id);
      const sprite = this.foodSprites.get(f.id);
      if (a === undefined) {
        if (sprite) sprite.visible = false;
        continue;
      }
      this.shown.push({ x: (f.x + f.w / 2) * CELL, y: (f.y + f.h / 2) * CELL, r: (Math.max(f.w, f.h) * CELL) / 2 + HALO_PAD });
      if (!this.paintFood(f, a)) {
        this.draw(this.rim, f, a);
        this.draw(g, f, a);
      }
      this.drawMeter(g, f, a);
    }
  }

  private pulseHalos(tick: number): void {
    const g = this.halo;
    g.clear();
    const beat = 0.5 + 0.5 * Math.sin((tick / 20) * Math.PI);
    for (const h of this.shown) {
      // a dark ring outside the glow separates it from a busy floor, whatever the floor colour
      g.circle(h.x, h.y, h.r + 2).stroke({ width: 3, color: INK, alpha: 0.55 });
      g.circle(h.x, h.y, h.r).fill({ color: HALO_COLOR, alpha: 0.3 + 0.14 * beat });
      g.circle(h.x, h.y, h.r * (0.72 + 0.1 * beat)).fill({ color: HALO_COLOR, alpha: 0.3 });
      g.circle(h.x, h.y, h.r).stroke({ width: 3, color: HALO_RING, alpha: 0.65 + 0.3 * beat });
    }
  }

  /** show this item as its painted sprite, shrinking as it is eaten; false when there is no art for it */
  private paintFood(f: FoodSource, remaining: number): boolean {
    const list = art()?.sprites.food;
    const picture = list?.[FOOD_SPRITE[f.type] ?? -1];
    if (!picture) return false;
    let sprite = this.foodSprites.get(f.id);
    if (!sprite) {
      sprite = new Sprite(picture.texture);
      sprite.anchor.set(0.5);
      this.spriteLayer.addChild(sprite);
      this.foodSprites.set(f.id, sprite);
    }
    const amount = Math.sqrt(Math.max(0, remaining) / f.total);
    const fit = Math.max(Math.min((f.w * CELL * 1.7) / picture.w, (f.h * CELL * 1.7) / picture.h), MIN_FOOD_PX / Math.max(picture.w, picture.h)) * (0.6 + 0.4 * amount);
    sprite.scale.set(fit);
    sprite.position.set((f.x + f.w / 2) * CELL, (f.y + f.h / 2) * CELL);
    sprite.visible = true;
    return true;
  }

  /** a goo pool as its painted sprite; the owner ring and the waiting mark are still drawn over it */
  private paintPool(f: FoodSource): boolean {
    const picture = art()?.sprites.goo?.[0];
    if (!picture) return false;
    let sprite = this.poolSprites.get(f.id);
    if (!sprite) {
      sprite = new Sprite(picture.texture);
      sprite.anchor.set(0.5);
      this.poolSpriteLayer.addChild(sprite);
      this.poolSprites.set(f.id, sprite);
    }
    sprite.scale.set(Math.min((f.w * CELL * 1.3) / picture.w, (f.h * CELL * 1.3) / picture.h));
    sprite.position.set((f.x + f.w / 2) * CELL, (f.y + f.h / 2) * CELL);
    return true;
  }

  /** a slim bar under an item showing how much of its nutrients are left; it empties as the item is eaten */
  private drawMeter(g: Graphics, f: FoodSource, remaining: number): void {
    const frac = Math.min(1, Math.max(0, remaining / f.total));
    const w = Math.max(f.w * CELL, METER_MIN_W);
    const x = (f.x + f.w / 2) * CELL - w / 2;
    const y = (f.y + f.h) * CELL + 3;
    g.rect(x, y, w, METER_H).fill({ color: INK, alpha: 0.75 }).stroke({ width: 1.5, color: INK });
    if (frac > 0) g.rect(x + 1, y + 1, (w - 2) * frac, METER_H - 2).fill(METER_FILL);
  }

  /**
   * A pool of primordial goo: a dark inked lip around a bubbling green well, always shown (it is terrain).
   * A pool a mold holds gets a ring in that mold's colour, pulsing while it pays; a pool the player holds
   * that waits for a store house carries the broken-chain mark.
   */
  private drawGoo(g: Graphics, f: FoodSource, st: PoolState, tick: number, withBody = true): void {
    const pal = FOOD.goo;
    const cx = (f.x + f.w / 2) * CELL;
    const cy = (f.y + f.h / 2) * CELL;
    const rx = (f.w * CELL) / 2 - 1;
    const ry = (f.h * CELL) / 2 - 1;
    if (withBody) {
    // hard offset shadow, dark lip, deep slime, lit surface, glossy highlight
    g.ellipse(cx + style.shadow.groundOffset[0], cy + style.shadow.groundOffset[1] + 2, rx, ry).fill({ color: INK, alpha: style.shadow.groundAlpha * 1.6 });
    g.ellipse(cx, cy, rx, ry).fill(GOO_LIP).stroke({ width: 3, color: INK });
    g.ellipse(cx, cy + 1, rx * 0.84, ry * 0.8).fill(pal.shade).stroke({ width: 1.8, color: INK });
    g.ellipse(cx - rx * 0.04, cy - ry * 0.05, rx * 0.72, ry * 0.62).fill(pal.base);
    g.ellipse(cx - rx * 0.28, cy - ry * 0.3, rx * 0.3, ry * 0.13).fill(pal.light);
    // slow bubbles that swell and pop in place
    for (let k = 0; k < 4; k++) {
      const t = ((tick + k * 23) % 90) / 90;
      const bx = cx + (hash2(f.id, k, 5) - 0.5) * rx * 1.2;
      const by = cy + (hash2(f.id, k, 6) - 0.5) * ry * 0.9;
      const r = 1 + 3.2 * Math.sqrt(t);
      g.circle(bx, by, r).fill({ color: pal.light, alpha: 0.85 * (1 - t) }).stroke({ width: 1.3, color: INK, alpha: 0.7 * (1 - t) });
    }
    }
    if (st.owner > 0) {
      const color = moldColor(st.color ?? 0);
      const pulse = st.paying ? 0.55 + 0.35 * Math.sin((tick / 12) * Math.PI) : 0.45;
      g.ellipse(cx, cy, rx + 3.5, ry + 3.5).stroke({ width: 4.5, color: INK, alpha: 0.5 * pulse });
      g.ellipse(cx, cy, rx + 3.5, ry + 3.5).stroke({ width: 2.4, color, alpha: pulse });
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
