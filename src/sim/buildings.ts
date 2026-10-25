import { TICK_DT } from './types';
import type { Building, BuildingType, CellIndex, Component, FoodSource, MoldId, PlaceResult, World } from './types';

/** Is `type` a building this world knows about? */
export function isBuildingType(world: Readonly<World>, type: string): type is BuildingType {
  return Object.prototype.hasOwnProperty.call(world.balance.buildings, type);
}

/** live buildings of a type owned by a mold */
export function countBuildings(world: Readonly<World>, moldId: MoldId, type: BuildingType): number {
  let n = 0;
  for (const b of world.buildings) if (!b.destroyed && b.moldId === moldId && b.type === type) n++;
  return n;
}

/**
 * The food item a harvester placed on `cell` would work on: any food item whose footprint the
 * cell sits in or touches (8-adjacent). Returns the nearest one by footprint, or null.
 */
export function harvestTarget(world: Readonly<World>, cell: CellIndex): FoodSource | null {
  const w = world.width;
  const x = cell % w;
  const y = Math.floor(cell / w);
  let best: FoodSource | null = null;
  for (const f of world.foodSources) {
    if (f.depleted) continue;
    if (x >= f.x - 1 && x <= f.x + f.w && y >= f.y - 1 && y <= f.y + f.h) {
      if (!best || f.id < best.id) best = f;
    }
  }
  return best;
}

/** does this mold already have a live harvester on this food item? */
function harvested(world: Readonly<World>, moldId: MoldId, sourceId: number): boolean {
  return world.buildings.some((b) => !b.destroyed && b.type === 'harvester' && b.moldId === moldId && b.target === sourceId);
}

/**
 * Can `moldId` place `type` on `cell` right now? Read-only, and the single source of truth: the
 * `placeBuilding` command, the UI preview, and the rival AI all call it (B5). Reasons are checked
 * in the order of the PlaceReason list, so the first failing one is reported.
 */
export function canPlace(world: Readonly<World>, moldId: MoldId, type: BuildingType, cell: CellIndex): PlaceResult {
  if (!isBuildingType(world, type)) return { ok: false, reason: 'unknown-building' };
  const mold = world.molds[moldId - 1];
  if (!mold || mold.status !== 'alive') return { ok: false, reason: 'mold-eliminated' };
  if (!Number.isInteger(cell) || cell < 0 || cell >= world.width * world.height) return { ok: false, reason: 'out-of-bounds' };
  if (world.owner[cell] !== moldId) return { ok: false, reason: 'not-your-cell' };
  if ((world.buildingAt[cell] as number) >= 0) return { ok: false, reason: 'occupied' };
  // food cells are only for harvesters (FR-004)
  if (type !== 'harvester' && (world.food[cell] as number) > 0) return { ok: false, reason: 'on-food' };
  if (type === 'harvester') {
    const target = harvestTarget(world, cell);
    if (!target) return { ok: false, reason: 'no-food-nearby' };
    if (target.w * target.h < world.balance.buildings.harvester.minFoodCells) return { ok: false, reason: 'food-too-small' };
    if (harvested(world, moldId, target.id)) return { ok: false, reason: 'already-harvested' };
  }
  const spec = world.balance.buildings[type];
  if (countBuildings(world, moldId, type) >= spec.limit) return { ok: false, reason: 'limit-reached' };
  const comp = world.components.get(world.component[cell] as number);
  if (!comp || comp.pool < spec.cost) return { ok: false, reason: 'cant-afford' };
  return { ok: true };
}

/** Place a building: pay from the pool of the piece holding the cell, then create it. */
export function placeBuilding(world: World, moldId: MoldId, type: BuildingType, cell: CellIndex): PlaceResult {
  const check = canPlace(world, moldId, type, cell);
  if (!check.ok) return check;
  const comp = world.components.get(world.component[cell] as number) as Component;
  comp.pool -= world.balance.buildings[type].cost;
  const building: Building = {
    id: world.buildings.length,
    type,
    moldId,
    cell,
    placedTick: world.tick,
    target: type === 'harvester' ? (harvestTarget(world, cell) as FoodSource).id : -1,
    destroyed: false,
  };
  world.buildings.push(building);
  world.buildingAt[cell] = building.id;
  world.events.push({ type: 'buildingPlaced', id: building.id, building: type, mold: moldId, cell });
  if (type === 'booster') recomputeBoost(world);
  return { ok: true };
}

/** the live building standing on a cell, if any */
export function buildingOn(world: Readonly<World>, cell: CellIndex): Building | undefined {
  const id = world.buildingAt[cell] as number;
  return id >= 0 ? world.buildings[id] : undefined;
}

/** does a working farm stand on this cell? (farms are sources of supply, B3) */
export function isFarmCell(world: Readonly<World>, cell: CellIndex): boolean {
  return buildingOn(world, cell)?.type === 'farm';
}

/** Farms pay their own piece every tick, whatever food is on the map. */
export function tickBuildings(world: World): void {
  const gain = world.balance.buildings.farm.income * TICK_DT;
  for (const b of world.buildings) {
    if (b.destroyed || b.type !== 'farm') continue;
    const comp = world.components.get(world.component[b.cell] as number);
    if (!comp) continue;
    comp.pool += gain;
    const mold = world.molds[b.moldId - 1];
    if (mold) mold.incomeTick += gain;
  }
}

/** per-second upkeep of the live buildings standing in a piece */
export function buildingUpkeep(world: Readonly<World>, compId: number): number {
  let sum = 0;
  for (const b of world.buildings) {
    if (!b.destroyed && world.component[b.cell] === compId) sum += world.balance.buildings[b.type].upkeep;
  }
  return sum;
}

/** nutrients per second the mold's working farms produce, before upkeep */
export function buildingIncome(world: Readonly<World>, moldId: MoldId): number {
  let sum = 0;
  for (const b of world.buildings) {
    if (!b.destroyed && b.moldId === moldId && b.type === 'farm') sum += world.balance.buildings.farm.income;
  }
  return sum;
}

/** Is this booster factory working? It stops while its piece cannot pay upkeep (FR-011). */
export function boosterWorking(world: Readonly<World>, b: Building): boolean {
  if (b.destroyed || b.type !== 'booster') return false;
  const comp = world.components.get(world.component[b.cell] as number);
  return !!comp && !comp.unpaid;
}

/**
 * Rebuild the combat strength multiplier from the working booster factories (FR-010, FR-012):
 * the owner's cells within `radius` get +`bonus` per factory, capped at +`stackCap` in total.
 * Cheap enough to run every tick (a handful of factories, each covering a small square).
 */
export function recomputeBoost(world: World): void {
  const spec = world.balance.buildings.booster;
  const w = world.width;
  const h = world.height;
  let any = false;
  for (const b of world.buildings) if (b.type === 'booster' && !b.destroyed) any = true;
  if (!any && !world.boostActive) return;
  world.boost.fill(1);
  world.boostActive = false;
  for (const b of world.buildings) {
    if (!boosterWorking(world, b)) continue;
    world.boostActive = true;
    const cx = b.cell % w;
    const cy = Math.floor(b.cell / w);
    for (let y = Math.max(0, cy - spec.radius); y <= Math.min(h - 1, cy + spec.radius); y++) {
      for (let x = Math.max(0, cx - spec.radius); x <= Math.min(w - 1, cx + spec.radius); x++) {
        const c = y * w + x;
        if (world.owner[c] !== b.moldId) continue;
        const next = (world.boost[c] as number) + spec.bonus;
        world.boost[c] = Math.min(1 + spec.stackCap, next);
      }
    }
  }
}

/** the cells a booster factory strengthens, for drawing its area */
export function boosterArea(world: Readonly<World>, b: Building): { x0: number; y0: number; x1: number; y1: number } {
  const r = world.balance.buildings.booster.radius;
  const cx = b.cell % world.width;
  const cy = Math.floor(b.cell / world.width);
  return { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r };
}
