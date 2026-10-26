import { DX, DY, cellAt } from './grid';
import { workingStoreHouses } from './buildings';
import { addCell } from './network';
import { moldOf } from './world';
import { TICK_DT, Terrain } from './types';
import type { CellIndex, Component, FoodSource, FoodType, MoldId, World } from './types';

const walkable = (world: World, cell: CellIndex): boolean => {
  const t = world.terrain[cell];
  return t === Terrain.Open || t === Terrain.Rough;
};

/** Can a footprint of this type sit with its top-left at (x, y)? */
export function canPlaceFood(world: World, type: FoodType, x: number, y: number): boolean {
  const spec = world.balance.foodTypes[type];
  if (x < 0 || y < 0 || x + spec.w > world.width || y + spec.h > world.height) return false;
  for (let yy = y; yy < y + spec.h; yy++) {
    for (let xx = x; xx < x + spec.w; xx++) {
      const c = cellAt(world.width, xx, yy);
      if (!walkable(world, c) || (world.foodSourceId[c] as number) >= 0) return false;
    }
  }
  return true;
}

export function placeFood(
  world: World,
  type: FoodType,
  x: number,
  y: number,
  origin: FoodSource['origin'],
): FoodSource | null {
  if (!canPlaceFood(world, type, x, y)) return null;
  const spec = world.balance.foodTypes[type];
  const src: FoodSource = {
    id: world.foodSources.length,
    type,
    x,
    y,
    w: spec.w,
    h: spec.h,
    total: spec.nutrients,
    remaining: spec.nutrients,
    origin,
    depleted: false,
  };
  const per = spec.nutrients / (spec.w * spec.h);
  for (let yy = y; yy < y + spec.h; yy++) {
    for (let xx = x; xx < x + spec.w; xx++) {
      const c = cellAt(world.width, xx, yy);
      world.food[c] = per;
      world.foodSourceId[c] = src.id;
    }
  }
  world.foodSources.push(src);
  return src;
}

export function foodCells(world: World, src: FoodSource): CellIndex[] {
  const out: CellIndex[] = [];
  for (let yy = src.y; yy < src.y + src.h; yy++) {
    for (let xx = src.x; xx < src.x + src.w; xx++) out.push(cellAt(world.width, xx, yy));
  }
  return out;
}

/**
 * How much of a food item the player knows about: what is in sight now plus what was last seen on the
 * rest of its footprint. Null when no part of it has ever been seen. `fresh` is false when none of it
 * is in sight at the moment, so the number may be out of date.
 */
export function knownFoodLeft(world: Readonly<World>, src: FoodSource): { amount: number; fresh: boolean } | null {
  const mold = world.molds[0];
  if (!mold) return { amount: src.remaining, fresh: true };
  let amount = 0;
  let seen = false;
  let fresh = false;
  for (let y = src.y; y < src.y + src.h; y++) {
    for (let x = src.x; x < src.x + src.w; x++) {
      const c = y * world.width + x;
      const v = mold.vision[c] as number;
      if (v > 0) seen = true;
      if (v === 2) fresh = true;
      amount += v === 2 ? (world.food[c] as number) : v === 1 ? (mold.memFood[c] as number) : 0;
    }
  }
  return seen ? { amount, fresh } : null;
}

/** Absorb nutrients from every food cell a mold holds, and retire used-up food. */
export function tickFood(world: World): void {
  const piecesWithStore = new Map<number, boolean>();
  const paying = (compId: number): boolean => {
    let ok = piecesWithStore.get(compId);
    if (ok === undefined) {
      const comp = world.components.get(compId);
      ok = !!comp && workingStoreHouses(world, comp) > 0;
      piecesWithStore.set(compId, ok);
    }
    return ok;
  };
  // which (mold, food item) pairs have a working harvester (FR-015)
  const harvested = new Set<number>();
  for (const b of world.buildings) if (!b.destroyed && b.type === 'harvester') harvested.add(b.moldId * 65536 + b.target);
  const mult = world.balance.buildings.harvester.rateMult;
  for (const src of world.foodSources) {
    if (src.depleted) continue;
    const spec = world.balance.foodTypes[src.type];
    const baseRate = spec.absorbRate * TICK_DT;
    if (spec.infinite) {
      // a goo pool: each held cell pays a fixed rate into its piece, but only while that piece has a
      // store house; nothing is ever taken from the cells and the pool never depletes (008)
      for (const c of foodCells(world, src)) {
        const owner = world.owner[c] as number;
        if (owner === 0) continue;
        const compId = world.component[c] as number;
        if (!paying(compId)) continue;
        const comp = world.components.get(compId) as Component;
        comp.pool += baseRate;
        const mold = moldOf(world, owner);
        mold.stats.nutrientsGathered += baseRate;
        mold.incomeTick += baseRate;
      }
      continue;
    }
    for (const c of foodCells(world, src)) {
      const left = world.food[c] as number;
      const owner = world.owner[c] as number;
      if (left <= 0 || owner === 0) continue;
      const harvesting = harvested.has(owner * 65536 + src.id);
      const boost = harvesting ? (world.supply[c] as number) : 1; // store house on this vein (S8)
      const amount = Math.min(left, harvesting ? baseRate * mult * boost : baseRate);
      world.food[c] = left - amount;
      src.remaining -= amount;
      const comp = world.components.get(world.component[c] as number) as Component;
      comp.pool += amount;
      if (boost > 1) world.supplyUse.add(comp.id);
      const mold = moldOf(world, owner);
      mold.stats.nutrientsGathered += amount;
      mold.incomeTick += amount;
    }
    if (src.remaining <= 1e-4) {
      for (const c of foodCells(world, src)) world.food[c] = 0;
      src.remaining = 0;
      src.depleted = true;
      world.events.push({ type: 'foodDepleted', foodSourceId: src.id });
    }
  }
}

/**
 * A mold that reaches one cell of a food item engulfs the rest of its footprint for free, so
 * touching food is enough to feed on all of it.
 */
export function engulfFood(world: World, moldId: MoldId, cell: CellIndex): void {
  const sid = world.foodSourceId[cell] as number;
  if (sid < 0) return;
  const src = world.foodSources[sid] as FoodSource;
  if (src.depleted) return;
  const w = world.width;
  const cells = foodCells(world, src);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of cells) {
      if (world.owner[c] !== 0) continue;
      const cx = c % w;
      const cy = Math.floor(c / w);
      for (let k = 0; k < 8; k++) {
        const nx = cx + (DX[k] as number);
        const ny = cy + (DY[k] as number);
        if (nx < src.x || ny < src.y || nx >= src.x + src.w || ny >= src.y + src.h) continue;
        const n = cellAt(w, nx, ny);
        if (world.owner[n] === moldId) {
          addCell(world, moldId, c, n);
          changed = true;
          break;
        }
      }
    }
  }
}

/** goo pools: nutrients per second a mold earns from the cells it holds, on pieces that have a store house (008) */
export function poolIncome(world: Readonly<World>, moldId: MoldId): number {
  let sum = 0;
  for (const src of world.foodSources) {
    const spec = world.balance.foodTypes[src.type];
    if (!spec.infinite) continue;
    for (const c of foodCells(world as World, src)) {
      if (world.owner[c] !== moldId) continue;
      const comp = world.components.get(world.component[c] as number);
      if (comp && workingStoreHouses(world, comp) > 0) sum += spec.absorbRate;
    }
  }
  return sum;
}

/** how many goo pools a mold holds some of, and how many of those have a held cell on a piece with no store house */
export function poolCounts(world: Readonly<World>, moldId: MoldId): { held: number; waiting: number } {
  let held = 0;
  let waiting = 0;
  for (const src of world.foodSources) {
    if (!world.balance.foodTypes[src.type].infinite) continue;
    let any = false;
    let idle = false;
    for (const c of foodCells(world as World, src)) {
      if (world.owner[c] !== moldId) continue;
      any = true;
      const comp = world.components.get(world.component[c] as number);
      if (!comp || workingStoreHouses(world, comp) === 0) idle = true;
    }
    if (any) held++;
    if (idle) waiting++;
  }
  return { held, waiting };
}
