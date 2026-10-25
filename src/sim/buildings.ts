import { DX, DY } from './grid';
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
  // farms only grow on fertile ground (003 FR-009)
  if (type === 'farm' && world.fertile[cell] === 0) return { ok: false, reason: 'not-fertile' };
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
    level: type === 'farm' ? world.balance.buildings.farm.defaultLevel : 0,
    linked: false,
    destroyed: false,
  };
  world.buildings.push(building);
  world.buildingAt[cell] = building.id;
  world.events.push({ type: 'buildingPlaced', id: building.id, building: type, mold: moldId, cell });
  if (type === 'booster') recomputeBoost(world);
  if (type === 'storehouse') clampPools(world); // records the higher cap
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

/** what a farm at `level` would pay per second once linked: income * o * (1.5 - 0.5 * o), o = level * levelStep (S6) */
export function farmIncomeAt(world: Readonly<World>, level: number): number {
  const spec = world.balance.buildings.farm;
  const o = level * spec.levelStep;
  return spec.income * o * (1.5 - 0.5 * o);
}

/** a farm's upkeep per second at `level`: it grows with the output and stops at level 0 */
export function farmUpkeepAt(world: Readonly<World>, level: number): number {
  const spec = world.balance.buildings.farm;
  return spec.upkeep * level * spec.levelStep;
}

/** does a working store house stand in the farm's piece? (S4) */
export function farmLinked(world: Readonly<World>, b: Building): boolean {
  if (b.destroyed || b.type !== 'farm') return false;
  const comp = world.components.get(world.component[b.cell] as number);
  return !!comp && workingStoreHouses(world, comp) > 0;
}

/**
 * Nutrients per second a farm pays right now: nothing while unlinked, otherwise its income at its
 * level, so level 4 is the plain income and the curve flattens toward the top (S6).
 */
export function farmOutput(world: Readonly<World>, b: Building): number {
  if (b.destroyed || b.type !== 'farm' || !farmLinked(world, b)) return 0;
  return farmIncomeAt(world, b.level);
}

/** per-second upkeep of one building; a farm's grows with its output level and stops at level 0 */
function upkeepOf(world: Readonly<World>, b: Building): number {
  return b.type === 'farm' ? farmUpkeepAt(world, b.level) : world.balance.buildings[b.type].upkeep;
}

/**
 * Farms pay their own piece every tick, but only while linked to a store house, and they slow down
 * to the piece's headroom so nothing they make is wasted (S5). Flips of the link state raise events.
 */
export function tickBuildings(world: World): void {
  const dt = TICK_DT;
  const desired = new Map<number, number>();
  for (const b of world.buildings) {
    if (b.destroyed || b.type !== 'farm') continue;
    const linked = farmLinked(world, b);
    if (linked !== b.linked) {
      b.linked = linked;
      world.events.push({ type: 'farmLinkChanged', building: b.id, linked });
    }
    const out = farmOutput(world, b) * dt;
    if (out > 0) desired.set(world.component[b.cell] as number, (desired.get(world.component[b.cell] as number) ?? 0) + out);
  }
  for (const b of world.buildings) {
    if (b.destroyed || b.type !== 'farm') continue;
    const compId = world.component[b.cell] as number;
    const comp = world.components.get(compId);
    if (!comp) continue;
    const want = desired.get(compId) ?? 0;
    if (want <= 0) continue;
    const headroom = Math.max(0, capOf(world, comp) - comp.pool);
    const scale = want > headroom ? headroom / want : 1;
    const gain = farmOutput(world, b) * dt * scale;
    comp.pool += gain;
    const mold = world.molds[b.moldId - 1];
    if (mold) mold.incomeTick += gain;
  }
}

/** per-second upkeep of the live buildings standing in a piece */
export function buildingUpkeep(world: Readonly<World>, compId: number): number {
  let sum = 0;
  for (const b of world.buildings) {
    if (!b.destroyed && world.component[b.cell] === compId) sum += upkeepOf(world, b);
  }
  return sum;
}

/** nutrients per second the mold's farms pay right now (linked ones, at their levels), before upkeep */
export function buildingIncome(world: Readonly<World>, moldId: MoldId): number {
  let sum = 0;
  for (const b of world.buildings) {
    if (!b.destroyed && b.moldId === moldId && b.type === 'farm') sum += farmOutput(world, b);
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
 * The cells a building at `start` strengthens along the vein network it is wired into, and how
 * much: fading linearly with distance along the veins (not through the air), from `bonus` at the
 * building to nothing at `reach` cells. Shared by booster factories and store houses.
 */
export function veinCover(world: Readonly<World>, start: CellIndex, reach: number, bonus: number): { cell: CellIndex; bonus: number }[] {
  const w = world.width;
  const out: { cell: CellIndex; bonus: number }[] = [];
  const dist = new Map<CellIndex, number>([[start, 0]]);
  const queue: CellIndex[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head] as CellIndex;
    const d = dist.get(c) as number;
    out.push({ cell: c, bonus: bonus * (1 - d / reach) });
    if (d + 1 >= reach) continue;
    const bits = world.edges[c] as number;
    for (let k = 0; k < 8; k++) {
      if (!(bits & (1 << k))) continue;
      const n = c + (DX[k] as number) + (DY[k] as number) * w;
      if (dist.has(n)) continue;
      dist.set(n, d + 1);
      queue.push(n);
    }
  }
  return out;
}

/** The cells a booster factory at `start` strengthens (FR-010, FR-012). */
export function boosterCover(world: Readonly<World>, start: CellIndex): { cell: CellIndex; bonus: number }[] {
  const spec = world.balance.buildings.booster;
  return veinCover(world, start, spec.reach, spec.bonus);
}

/**
 * Rebuild the combat strength multiplier from the working booster factories: each adds its taper
 * to the cells its veins reach, capped at +`stackCap` in total. Cheap enough to run every tick (a
 * handful of factories, each covering at most a few hundred cells).
 */
export function recomputeBoost(world: World): void {
  const spec = world.balance.buildings.booster;
  let any = false;
  for (const b of world.buildings) if (b.type === 'booster' && !b.destroyed) any = true;
  if (!any && !world.boostActive) return;
  world.boost.fill(1);
  world.boostActive = false;
  for (const b of world.buildings) {
    if (!boosterWorking(world, b)) continue;
    world.boostActive = true;
    for (const { cell, bonus } of boosterCover(world, b.cell)) {
      world.boost[cell] = Math.min(1 + spec.stackCap, (world.boost[cell] as number) + bonus);
    }
  }
}

/** live store houses in a piece that count: they stand and the piece can pay its upkeep (S3) */
export function workingStoreHouses(world: Readonly<World>, comp: Readonly<Component>): number {
  if (comp.unpaid) return 0;
  let n = 0;
  for (const b of world.buildings) {
    if (!b.destroyed && b.type === 'storehouse' && world.component[b.cell] === comp.id) n++;
  }
  return n;
}

/** the most nutrients a piece can hold: a base amount plus its working store houses (S2) */
export function capOf(world: Readonly<World>, comp: Readonly<Component>): number {
  const spec = world.balance.buildings.storehouse;
  return world.balance.pool.baseCap + spec.capacity * Math.min(workingStoreHouses(world, comp), spec.perPiece);
}

/**
 * Cut every pool to its cap (S2): the one place nutrients above a cap are discarded, so no gain
 * path can forget it. Reports a piece first reaching its cap, and stock lost to a falling cap.
 */
export function clampPools(world: World): void {
  for (const comp of world.components.values()) {
    const cap = capOf(world, comp);
    if (comp.pool > cap) {
      if (cap < comp.cap - 1e-9) world.events.push({ type: 'capLost', componentId: comp.id, amount: comp.pool - cap });
      comp.pool = cap;
    }
    const full = comp.pool >= cap - 1e-6;
    if (full && !comp.full) world.events.push({ type: 'storeFull', componentId: comp.id });
    comp.full = full;
    comp.cap = cap;
  }
}

/** The cells a store house at `start` boosts for growth and harvest, with their bonus (FR-020). */
export function storeCover(world: Readonly<World>, start: CellIndex): { cell: CellIndex; bonus: number }[] {
  const spec = world.balance.buildings.storehouse;
  return veinCover(world, start, spec.reach, spec.bonus);
}

/** What the placement ghost shows: the verdict plus, for valid spots, what it would do (003). */
export function placePreview(
  world: Readonly<World>,
  moldId: MoldId,
  type: BuildingType,
  cell: CellIndex,
): { result: PlaceResult; unlinked?: boolean; capBefore?: number; capAfter?: number } {
  const result = canPlace(world, moldId, type, cell);
  if (!result.ok) return { result };
  const comp = world.components.get(world.component[cell] as number);
  if (!comp) return { result };
  if (type === 'storehouse') {
    const spec = world.balance.buildings.storehouse;
    const n = workingStoreHouses(world, comp);
    return { result, capBefore: capOf(world, comp), capAfter: world.balance.pool.baseCap + spec.capacity * Math.min(n + 1, spec.perPiece) };
  }
  if (type === 'farm') return { result, unlinked: workingStoreHouses(world, comp) === 0 };
  return { result };
}
