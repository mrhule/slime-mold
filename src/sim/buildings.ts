import { TICK_DT } from './types';
import type { Building, BuildingType, CellIndex, Component, MoldId, PlaceResult, World } from './types';

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
 * Can `moldId` place `type` on `cell` right now? Read-only, and the single source of truth: the
 * `placeBuilding` command and the UI preview both call it (B5). Reasons are checked in the
 * order of the PlaceReason list, so the first failing one is reported.
 */
export function canPlace(world: Readonly<World>, moldId: MoldId, type: BuildingType, cell: CellIndex): PlaceResult {
  if (!isBuildingType(world, type)) return { ok: false, reason: 'unknown-building' };
  const mold = world.molds[moldId - 1];
  if (!mold || mold.status !== 'alive') return { ok: false, reason: 'mold-eliminated' };
  if (!Number.isInteger(cell) || cell < 0 || cell >= world.width * world.height) return { ok: false, reason: 'out-of-bounds' };
  if (world.owner[cell] !== moldId) return { ok: false, reason: 'not-your-cell' };
  if ((world.buildingAt[cell] as number) >= 0) return { ok: false, reason: 'occupied' };
  if ((world.food[cell] as number) > 0) return { ok: false, reason: 'on-food' };
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
    destroyed: false,
  };
  world.buildings.push(building);
  world.buildingAt[cell] = building.id;
  world.events.push({ type: 'buildingPlaced', id: building.id, building: type, mold: moldId, cell });
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
