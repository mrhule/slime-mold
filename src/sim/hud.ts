import { buildingIncome, countBuildings } from './buildings';
import { mapControl } from './round';
import { moldOf } from './world';
import { TICK_DT } from './types';
import type { BuildOption, BuildingType, HudModel, MoldId, World } from './types';

export function storedNutrients(world: World, moldId: MoldId): number {
  let sum = 0;
  for (const c of world.components.values()) if (c.moldId === moldId) sum += c.pool;
  return sum;
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
    rivals: world.molds
      .filter((m) => m.id !== moldId)
      .map((m) => ({ id: m.id, color: m.color, pattern: m.pattern, status: m.status, visibleCells: null })),
    elapsedSeconds: world.tick * TICK_DT,
  };
}
