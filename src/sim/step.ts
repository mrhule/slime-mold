import { clampPools, tickBuildings } from './buildings';
import { tickAi } from './ai-driver';
import { tickDrops } from './drops';
import { checkEliminations, scanFronts, tickCombat } from './combat';
import { applyQueuedCommands } from './commands';
import { updateVision } from './fog';
import { evaluateOutcome } from './round';
import { solveFlow } from './flow';
import { tickFood } from './food';
import { tickGrowth } from './growth';
import { decayOrphans } from './network';
import { tickUpkeep } from './upkeep';
import { TICK_DT } from './types';
import type { Component, World } from './types';

/** EMA time constant for the HUD's net income (seconds). */
const INCOME_SMOOTHING = 2;

function tickIncome(world: World): void {
  const gain = world.balance.coreIncome * TICK_DT;
  for (const mold of world.molds) {
    if (mold.status !== 'alive') continue;
    const id = world.component[mold.core] as number;
    if (id < 0 || world.owner[mold.core] !== mold.id) continue;
    (world.components.get(id) as Component).pool += gain;
    mold.incomeTick += gain;
  }
  tickFood(world);
  tickBuildings(world);
}

function settleNetIncome(world: World): void {
  const k = TICK_DT / INCOME_SMOOTHING;
  for (const mold of world.molds) {
    const net = (mold.incomeTick - mold.upkeepTick) / TICK_DT;
    mold.netIncome += (net - mold.netIncome) * k;
    mold.incomeTick = 0;
    mold.upkeepTick = 0;
  }
}

/** Advance the world by exactly one tick (dt = 0.05 s). Order matters; see research.md R10. */
export function step(world: World): void {
  world.events = [];
  applyQueuedCommands(world);
  tickDrops(world);
  tickIncome(world);
  tickUpkeep(world);
  scanFronts(world);
  if (world.tick % world.balance.flowEvery === 0) solveFlow(world);
  tickGrowth(world);
  tickCombat(world);
  decayOrphans(world);
  checkEliminations(world);
  clampPools(world);
  if (world.tick % world.balance.fogEvery === 0) updateVision(world);
  if (world.tick % 10 === 0) evaluateOutcome(world);
  tickAi(world);
  settleNetIncome(world);
  world.tick++;
}
