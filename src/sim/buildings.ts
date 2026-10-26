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
    if (f.depleted || world.balance.foodTypes[f.type].infinite) continue; // goo pools are not harvested
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
  if (mold.tier < (spec.minTier ?? 1)) return { ok: false, reason: 'locked' };
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
    level: 1,
    boosting: false,
    destroyed: false,
  };
  world.buildings.push(building);
  world.buildingAt[cell] = building.id;
  world.events.push({ type: 'buildingPlaced', id: building.id, building: type, mold: moldId, cell });
  if (type === 'booster') recomputeBoost(world);
  if (type === 'storehouse') {
    clampPools(world); // records the higher cap
    recomputeSupply(world);
  }
  return { ok: true };
}

/** how far along the veins a factory reaches: its base reach plus a step for each level above the first */
export function reachOf(world: Readonly<World>, b: Readonly<Building> | undefined): number {
  const spec = b?.type === 'relay' ? world.balance.buildings.relay : world.balance.buildings.storehouse;
  return spec.reach + ((b?.level ?? 1) - 1) * spec.reachPerLevel;
}

/** the upgrade ladder of a building that has one (factories and relays), else null */
export function upgradeSpec(world: Readonly<World>, type: BuildingType): { maxLevel: number; reachPerLevel: number; upgradeCost: number[] } | null {
  if (type === 'storehouse') return world.balance.buildings.storehouse;
  if (type === 'relay') return world.balance.buildings.relay;
  return null;
}

/** Raise a factory one level, paying from its piece; more reach (and a wider boost) at once. */
export function upgradeBuilding(world: World, moldId: MoldId, cell: CellIndex): PlaceResult {
  const b = buildingOn(world, cell);
  if (!b) return { ok: false, reason: 'no-building' };
  if (b.moldId !== moldId) return { ok: false, reason: 'not-your-cell' };
  const spec = upgradeSpec(world, b.type);
  if (!spec) return { ok: false, reason: 'not-upgradable' };
  if (b.level >= spec.maxLevel) return { ok: false, reason: 'max-level' };
  const cost = spec.upgradeCost[b.level - 1] ?? Infinity;
  const comp = world.components.get(world.component[cell] as number);
  if (!comp || comp.pool < cost) return { ok: false, reason: 'cant-afford' };
  comp.pool -= cost;
  b.level++;
  world.events.push({ type: 'buildingUpgraded', id: b.id, building: b.type, mold: moldId, cell, level: b.level });
  recomputeSupply(world);
  recomputeFeed(world);
  return { ok: true };
}

/** Tear down a building, paying part of its cost back into its piece. The cell and its veins stay. */
export function demolishBuilding(world: World, moldId: MoldId, cell: CellIndex): PlaceResult {
  const b = buildingOn(world, cell);
  if (!b) return { ok: false, reason: 'no-building' };
  if (b.moldId !== moldId) return { ok: false, reason: 'not-your-cell' };
  const comp = world.components.get(world.component[cell] as number);
  if (comp) {
    const spec = world.balance.buildings[b.type];
    const extra = (upgradeSpec(world, b.type)?.upgradeCost ?? []).slice(0, b.level - 1).reduce((a, c) => a + c, 0);
    comp.pool += (spec.cost + extra) * world.balance.demolishRefund;
  }
  b.destroyed = true;
  world.buildingAt[cell] = -1;
  world.events.push({ type: 'buildingDestroyed', id: b.id, building: b.type, mold: moldId, cell });
  if (b.type === 'booster') recomputeBoost(world); // its bonus ends at once
  if (b.type === 'storehouse') {
    clampPools(world); // its cap ends at once
    recomputeSupply(world); // and so does its boost
    recomputeFeed(world); // and its reach, so veins only it fed start their clock
  }
  return { ok: true };
}

/** the live building standing on a cell, if any */
export function buildingOn(world: Readonly<World>, cell: CellIndex): Building | undefined {
  const id = world.buildingAt[cell] as number;
  return id >= 0 ? world.buildings[id] : undefined;
}

/** per-second upkeep of one building */
function upkeepOf(world: Readonly<World>, b: Building): number {
  return world.balance.buildings[b.type].upkeep;
}

/** per-second upkeep of the live buildings standing in a piece */
export function buildingUpkeep(world: Readonly<World>, compId: number): number {
  let sum = 0;
  for (const b of world.buildings) {
    if (!b.destroyed && world.component[b.cell] === compId) sum += upkeepOf(world, b);
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
  return veinCover(world, start, reachOf(world, buildingOn(world, start)), spec.bonus);
}

/** What the placement ghost shows: the verdict plus, for valid spots, what it would do (003). */
export function placePreview(
  world: Readonly<World>,
  moldId: MoldId,
  type: BuildingType,
  cell: CellIndex,
): { result: PlaceResult; capBefore?: number; capAfter?: number } {
  const result = canPlace(world, moldId, type, cell);
  if (!result.ok) return { result };
  const comp = world.components.get(world.component[cell] as number);
  if (!comp) return { result };
  if (type === 'storehouse') {
    const spec = world.balance.buildings.storehouse;
    const n = workingStoreHouses(world, comp);
    return { result, capBefore: capOf(world, comp), capAfter: world.balance.pool.baseCap + spec.capacity * Math.min(n + 1, spec.perPiece) };
  }
  return { result };
}

/**
 * Rebuild the growth and harvest multiplier from the store houses that are boosting (S7, S8): each
 * adds its taper along its vein, capped at +stackCap in total. A store house boosts while its piece
 * can pay upkeep and holds stock above lowStock; once off it needs 1.25x lowStock to come back on,
 * so the boost does not flicker.
 */
export function recomputeSupply(world: World): void {
  const spec = world.balance.buildings.storehouse;
  let any = false;
  for (const b of world.buildings) if (b.type === 'storehouse' && !b.destroyed) any = true;
  if (!any && !world.supplyActive) return;
  world.supply.fill(1);
  world.supplyActive = false;
  for (const b of world.buildings) {
    if (b.type !== 'storehouse') continue;
    const comp = b.destroyed ? undefined : world.components.get(world.component[b.cell] as number);
    if (!comp || comp.unpaid) b.boosting = false;
    else b.boosting = comp.pool >= (b.boosting ? spec.lowStock : spec.lowStock * 1.25);
    if (!b.boosting) continue;
    world.supplyActive = true;
    for (const { cell, bonus } of storeCover(world, b.cell)) {
      world.supply[cell] = Math.min(1 + spec.stackCap, (world.supply[cell] as number) + bonus);
    }
  }
}

/**
 * How well fed a vein cell `d` steps along the veins from a supply with the given reach is: 1 right at
 * it, falling in a line to `trickle` at the end of the reach, then to `floor` (growth almost stops)
 * half a reach further out, and `floor` beyond.
 */
export function feedAt(world: Readonly<World>, d: number, reach: number): number {
  const { trickle, floor } = world.balance.feed;
  if (d <= reach) return 1 - ((1 - trickle) * d) / reach;
  const over = Math.min(1, (d - reach) / (0.5 * reach));
  return trickle - (trickle - floor) * over;
}

/**
 * Rebuild how well each vein cell is fed (see `feedAt`) from the best supply near it: a mold's core,
 * any cell over food, or a working factory (which has its own reach). Overlapping supplies take the
 * best, not the sum. Cells out of every reach are left at the floor.
 */
export function recomputeFeed(world: World): void {
  const { coreReach, floor } = world.balance.feed;
  world.feed.fill(floor);
  const take = (cell: CellIndex, f: number): void => {
    if (f > (world.feed[cell] as number)) world.feed[cell] = f;
  };
  // the core and every cell over food supply their own veins, all at once: one search from every source
  const w = world.width;
  const limit = 1.5 * coreReach;
  const dist = new Int32Array(world.owner.length).fill(-1);
  const queue: CellIndex[] = [];
  const seed = (c: CellIndex): void => {
    if (dist[c] === 0) return;
    dist[c] = 0;
    queue.push(c);
  };
  for (const mold of world.molds) if (mold.status === 'alive') seed(mold.core);
  for (const comp of world.components.values()) for (const s of comp.sources) if (world.owner[s] !== 0) seed(s);
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head] as CellIndex;
    const d = dist[c] as number;
    take(c, feedAt(world, d, coreReach));
    if (d + 1 >= limit) continue;
    const bits = world.edges[c] as number;
    for (let k = 0; k < 8; k++) {
      if (!(bits & (1 << k))) continue;
      const n = c + (DX[k] as number) + (DY[k] as number) * w;
      if (dist[n] !== -1) continue;
      dist[n] = d + 1;
      queue.push(n);
    }
  }
  for (const b of world.buildings) {
    if (b.destroyed) continue;
    if (b.type === 'relay') {
      // a relay carries supply as long as its piece can pay upkeep; it needs no stock
      const relayReach = reachOf(world, b);
      const comp = world.components.get(world.component[b.cell] as number);
      if (comp && !comp.unpaid) for (const { cell, bonus } of veinCover(world, b.cell, 1.5 * relayReach, 1)) take(cell, feedAt(world, (1 - bonus) * 1.5 * relayReach, relayReach));
      continue;
    }
    if (b.type !== 'storehouse' || !b.boosting) continue;
    const reach = reachOf(world, b);
    // veinCover tapers 1 -> 0 over its reach, so ask for one and a half reaches and turn each value back into a distance
    for (const { cell, bonus } of veinCover(world, b.cell, 1.5 * reach, 1)) take(cell, feedAt(world, (1 - bonus) * 1.5 * reach, reach));
  }
}

/**
 * Store houses pay for the speed-up (S8): each boosting one drains `drain` per second from its
 * piece, but only while a boosted tip or harvester in that piece actually did work this tick.
 */
export function drainStoreHouses(world: World): void {
  if (world.supplyUse.size === 0) return;
  const amount = world.balance.buildings.storehouse.drain * TICK_DT;
  for (const b of world.buildings) {
    if (b.destroyed || b.type !== 'storehouse' || !b.boosting) continue;
    const compId = world.component[b.cell] as number;
    if (!world.supplyUse.has(compId)) continue;
    const comp = world.components.get(compId);
    if (comp) comp.pool = Math.max(0, comp.pool - amount);
  }
}
