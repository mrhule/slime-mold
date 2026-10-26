import { DX, DY, neighbor } from './grid';
import { isStray } from './fade';
import { addCell, removeCellAndSplit } from './network';
import { recomputeBoost } from './buildings';
import { moldOf, moldsInOrder } from './world';
import { TICK_DT } from './types';
import type { Component, World } from './types';

/**
 * Contact scan (every tick): a cell is a *front cell* when an enemy cell is 8-adjacent. Records
 * each mold's front cells and how many enemies touch each one, and lets cells out of contact
 * regrow toward full biomass (R6).
 */
export function scanFronts(world: World): void {
  for (const m of world.molds) m.frontCells.length = 0;
  if (world.molds.length < 2) return;
  const { width: w, height: h } = world;
  const regen = world.balance.biomassRegen * TICK_DT;
  for (const comp of world.components.values()) {
    const mold = moldOf(world, comp.moldId);
    for (const cell of comp.cells) {
      let count = 0;
      const x = cell % w;
      const y = Math.floor(cell / w);
      for (let k = 0; k < 8; k++) {
        const nx = x + (DX[k] as number);
        const ny = y + (DY[k] as number);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const o = world.owner[ny * w + nx] as number;
        if (o !== 0 && o !== comp.moldId) count++;
      }
      if (count > 0) {
        world.enemyAdj[cell] = count;
        mold.frontCells.push(cell);
      } else {
        world.enemyAdj[cell] = 0;
        const bio = world.biomass[cell] as number;
        if (bio < 1 && !comp.orphaned && cell !== comp.starveCell && !isStray(world, cell)) world.biomass[cell] = Math.min(1, bio + regen);
      }
    }
  }
}

/**
 * Battle resolution (every tick, R6). Each front cell turns the nutrients delivered to it (plus a
 * small base pressure) into damage on its enemy neighbors. All damage is worked out from the
 * state at the start of the tick and applied at once, so the fight is symmetric and
 * deterministic. A cell that reaches zero biomass dies; the strongest attacker gets part of its
 * build cost back and steps into the freed cell if it can pay for it.
 */
export function tickCombat(world: World): void {
  const b = world.balance;
  const dt = TICK_DT;
  const sc = world.scratch;
  const { width: w, height: h } = world;
  recomputeBoost(world);
  sc.hit.length = 0;
  const stamp = ++sc.damageStampN;

  for (const mold of moldsInOrder(world)) {
    for (const cell of mold.frontCells) {
      const comp = world.components.get(world.component[cell] as number) as Component;
      const grant = Math.min((world.pressure[cell] as number) * dt, comp.pool);
      comp.pool -= grant;
      // a booster factory in range makes this cell hit harder (FR-010)
      const eff = (grant / dt + b.basePressure) * (world.boost[cell] as number);
      sc.eff[cell] = eff;
      const share = eff / (world.enemyAdj[cell] as number);
      const dmg = share * b.attackEff * dt;
      for (let k = 0; k < 8; k++) {
        const n = neighbor(w, h, cell, k);
        if (n < 0) continue;
        const o = world.owner[n] as number;
        if (o === 0 || o === mold.id) continue;
        if (sc.damageStamp[n] !== stamp) {
          sc.damageStamp[n] = stamp;
          sc.damage[n] = 0;
          sc.damageBest[n] = 0;
          sc.damageFrom[n] = -1;
          sc.hit.push(n);
        }
        sc.damage[n] = (sc.damage[n] as number) + dmg;
        if (share > (sc.damageBest[n] as number)) {
          sc.damageBest[n] = share;
          sc.damageFrom[n] = cell;
        }
      }
    }
  }

  const dead: number[] = [];
  for (const n of sc.hit) {
    const defender = moldOf(world, world.owner[n] as number);
    const before = world.biomass[n] as number;
    // ...and tougher: damage taken is divided by the same multiplier
    const dmg = (sc.damage[n] as number) / (world.boost[n] as number);
    defender.lossTick += Math.min(before, dmg);
    world.biomass[n] = before - dmg;
    if (before - dmg <= 0) dead.push(n);
  }

  // Phase 1: note who killed what from the state at the start of the tick, then remove every dead
  // cell. Doing all removals first means two cells that kill each other both die; neither side
  // can "revive" its own cell by claiming it first.
  const kills: { cell: number; attackerId: number; from: number }[] = [];
  for (const n of dead) {
    const defenderId = world.owner[n] as number;
    if (defenderId === 0) continue;
    const from = sc.damageFrom[n] as number;
    kills.push({ cell: n, attackerId: from >= 0 ? (world.owner[from] as number) : 0, from });
  }
  for (const k of kills) {
    const defenderId = world.owner[k.cell] as number;
    if (defenderId === 0) continue;
    const defender = moldOf(world, defenderId);
    world.events.push({ type: 'cellDied', cell: k.cell, mold: defenderId, by: k.attackerId });
    defender.stats.cellsDestroyed++;
    removeCellAndSplit(world, k.cell);
  }

  // Phase 2: attackers whose own cell survived get part of the cost back and step into the gap
  // if they can pay for it.
  for (const k of kills) {
    if (k.attackerId === 0 || world.owner[k.from] !== k.attackerId || world.owner[k.cell] !== 0) continue;
    const comp = world.components.get(world.component[k.from] as number) as Component;
    comp.pool += b.consumeRefund * b.cellBuildCost;
    const terrain = world.terrain[k.cell];
    const cost = b.cellBuildCost * (terrain === 1 ? b.terrainCost.rough : b.terrainCost.open);
    if ((terrain === 0 || terrain === 1) && comp.pool >= cost) {
      comp.pool -= cost;
      addCell(world, k.attackerId, k.cell, k.from);
    }
  }

  // smoothed biomass per second lost on fronts, for the AI and the HUD
  const k = dt / 2;
  for (const mold of world.molds) {
    mold.frontLoss += (mold.lossTick / dt - mold.frontLoss) * k;
    mold.lossTick = 0;
  }
}

/** A mold with no cells left is out of the round (FR-014). */
export function checkEliminations(world: World): void {
  for (const mold of world.molds) {
    if (mold.status !== 'alive' || mold.cellCount > 0) continue;
    mold.status = 'eliminated';
    mold.targets.length = 0;
    world.events.push({ type: 'moldEliminated', mold: mold.id });
  }
}
