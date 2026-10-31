import { capOf, countBuildings } from './buildings';
import { poolCounts, poolIncome } from './food';
import { burstStatus } from './bloom';
import { mapControl, winThreshold } from './round';
import { evolveStatus } from './tiers';
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
      locked: moldOf(world, moldId).tier < (spec.minTier ?? 1),
      minTier: spec.minTier ?? 1,
    };
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
    flow: { ...mold.flow },
    starving: [...world.components.values()].some((c) => c.moldId === moldId && c.unpaid),
    allocation: mold.allocation,
    zones: { exploreMax: world.balance.allocationZones.exploreMax, warMin: world.balance.allocationZones.warMin },
    mapControl: mapControl(world, moldId),
    winControl: winThreshold(world),
    burst: { ...burstStatus(world, moldId), cost: world.balance.burst.cost, target: world.balance.burst.winControl },
    growthStarved: mold.targets.some((t) => t.state === 'starved'),
    targets: mold.targets.map((t) => ({ id: t.id, cell: t.cell, state: t.state })),
    build: buildOptions(world, moldId),
    poolIncome: poolIncome(world, moldId),
    stock: stockOf(world, moldId),
    tier: evolveStatus(world, moldId),
    pools: poolCounts(world, moldId),
    rivals: world.molds
      .filter((m) => m.id !== moldId)
      .map((m) => ({
        id: m.id,
        color: m.color,
        pattern: m.pattern,
        status: m.status,
        visibleCells: (mold.seenCells[m.id] as number) > 0 ? (mold.seenCells[m.id] as number) : null,
        control: (mold.seenCells[m.id] as number) > 0 ? mapControl(world, m.id) : null,
      })),
    elapsedSeconds: world.tick * TICK_DT,
  };
}
