import { DX, DY, cellAt } from './grid';
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

/** Absorb nutrients from every food cell a mold holds, and retire used-up food. */
export function tickFood(world: World): void {
  // which (mold, food item) pairs have a working harvester (FR-015)
  const harvested = new Set<number>();
  for (const b of world.buildings) if (!b.destroyed && b.type === 'harvester') harvested.add(b.moldId * 65536 + b.target);
  const mult = world.balance.buildings.harvester.rateMult;
  for (const src of world.foodSources) {
    if (src.depleted) continue;
    const baseRate = world.balance.foodTypes[src.type].absorbRate * TICK_DT;
    for (const c of foodCells(world, src)) {
      const left = world.food[c] as number;
      const owner = world.owner[c] as number;
      if (left <= 0 || owner === 0) continue;
      const amount = Math.min(left, harvested.has(owner * 65536 + src.id) ? baseRate * mult : baseRate);
      world.food[c] = left - amount;
      src.remaining -= amount;
      const comp = world.components.get(world.component[c] as number) as Component;
      comp.pool += amount;
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
