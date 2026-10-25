import { buildingIncome, capOf, countBuildings, farmLinked } from './buildings';
import { mapControl } from './round';
import { moldOf } from './world';
import { TICK_DT } from './types';
import type { BuildOption, BuildingType, HudModel, MoldId, World } from './types';

export function storedNutrients(world: World, moldId: MoldId): number {
  let sum = 0;
  for (const c of world.components.values()) if (c.moldId === moldId) sum += c.pool;
  return sum;
}

/** stored nutrients against the caps of a mold's pieces, and whether any piece is full */
export function stockOf(world: World, moldId: MoldId): { total: number; cap: number; full: boolean } {
  let total = 0;
  let cap = 0;
  let full = false;
  for (const c of world.components.values()) {
    if (c.moldId !== moldId) continue;
    const limit = capOf(world, c);
    total += c.pool;
    cap += limit;
    if (c.pool >= limit - 1e-6) full = true;
  }
  return { total, cap, full };
}

function farmCounts(world: World, moldId: MoldId): { total: number; linked: number; unlinked: number } {
  let total = 0;
  let linked = 0;
  for (const b of world.buildings) {
    if (b.destroyed || b.type !== 'farm' || b.moldId !== moldId) continue;
    total++;
    if (farmLinked(world, b)) linked++;
  }
  return { total, linked, unlinked: total - linked };
}

function buildOptions(world: World, moldId: MoldId): BuildOption[] {
  const out: BuildOption[] = [];
  for (const type of Object.keys(world.balance.buildings) as BuildingType[]) {
    const spec = world.balance.buildings[type];
    let affordable = false;
    for (const c of world.components.values()) if (c.moldId === moldId && c.pool >= spec.cost) affordable = true;
    const option: BuildOption = {
      type,
      cost: spec.cost,
      upkeep: spec.upkeep,
      count: countBuildings(world, moldId, type),
      limit: spec.limit,
      affordable,
    };
    if (type === 'farm') option.income = world.balance.buildings.farm.income;
    out.push(option);
  }
  return out;
}

export function readHud(world: World, moldId: MoldId): HudModel {
  const mold = moldOf(world, moldId);
  return {
    round: world.roundNumber,
    storedNutrients: storedNutrients(world, moldId),
    netIncome: mold.netIncome,
    allocation: mold.allocation,
    mapControl: mapControl(world, moldId),
    growthStarved: mold.targets.some((t) => t.state === 'starved'),
    targets: mold.targets.map((t) => ({ id: t.id, cell: t.cell, state: t.state })),
    build: buildOptions(world, moldId),
    buildingIncome: buildingIncome(world, moldId),
    stock: stockOf(world, moldId),
    farms: farmCounts(world, moldId),
    rivals: world.molds
      .filter((m) => m.id !== moldId)
      .map((m) => ({
        id: m.id,
        color: m.color,
        pattern: m.pattern,
        status: m.status,
        visibleCells: (mold.seenCells[m.id] as number) > 0 ? (mold.seenCells[m.id] as number) : null,
      })),
    elapsedSeconds: world.tick * TICK_DT,
  };
}
