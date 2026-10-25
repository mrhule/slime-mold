import { moldOf } from './world';
import { TICK_DT } from './types';
import type { HudModel, MoldId, World } from './types';

export function storedNutrients(world: World, moldId: MoldId): number {
  let sum = 0;
  for (const c of world.components.values()) if (c.moldId === moldId) sum += c.pool;
  return sum;
}

export function readHud(world: World, moldId: MoldId): HudModel {
  const mold = moldOf(world, moldId);
  return {
    round: world.roundNumber,
    storedNutrients: storedNutrients(world, moldId),
    netIncome: mold.netIncome,
    allocation: mold.allocation,
    mapControl: world.reachableCells > 0 ? mold.cellCount / world.reachableCells : 0,
    growthStarved: mold.targets.some((t) => t.state === 'starved'),
    targets: mold.targets.map((t) => ({ id: t.id, cell: t.cell, state: t.state })),
    rivals: world.molds
      .filter((m) => m.id !== moldId)
      .map((m) => ({ id: m.id, color: m.color, pattern: m.pattern, status: m.status, visibleCells: null })),
    elapsedSeconds: world.tick * TICK_DT,
  };
}
