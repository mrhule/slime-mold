import { buildingUpkeep } from './buildings';
import { degree, removeCell } from './network';
import { edgeSlot, octile } from './grid';
import { moldOf } from './world';
import { TICK_DT } from './types';
import type { CellIndex, Component, World } from './types';

/**
 * Every piece pays `upkeepPerCell` per cell out of its own pool. Veins are never retracted for
 * being idle; the brake on over-expansion is this: when a piece cannot pay, its weakest leaf
 * cell starves and dies, one at a time, until income covers the upkeep again.
 */
export function tickUpkeep(world: World): void {
  const rate = world.balance.upkeepPerCell * TICK_DT;
  for (const comp of [...world.components.values()]) {
    const buildingsDue = buildingUpkeep(world, comp.id) * TICK_DT;
    const due = rate * comp.cells.length + buildingsDue;
    const paid = Math.min(due, comp.pool);
    comp.pool -= paid;
    const mold = moldOf(world, comp.moldId);
    mold.upkeepTick += paid;
    mold.flowTick.veins += due - buildingsDue;
    mold.flowTick.buildings += buildingsDue;
    comp.unpaid = paid < due - 1e-12;
    if (comp.unpaid) starve(world, comp);
    else recover(world, comp);
  }
}

function validVictim(world: World, comp: Component, cell: CellIndex): boolean {
  return cell >= 0 && world.component[cell] === comp.id && cell !== moldOf(world, comp.moldId).core && degree(world, cell) <= 1;
}

/**
 * The leaf (or loose) cell to starve: building-free cells first, then the thinnest vein, then
 * the outermost, then the lowest index. A building cell goes only when nothing else is left.
 */
function pickVictim(world: World, comp: Component): CellIndex {
  const core = moldOf(world, comp.moldId).core;
  let best = -1;
  let bestD = Infinity;
  let bestDist = -1;
  let bestBuilt = 1;
  for (const cell of comp.cells) {
    if (cell === core || degree(world, cell) > 1) continue;
    let d = 0;
    const bits = world.edges[cell] as number;
    if (bits !== 0) {
      let k = 0;
      while (!(bits & (1 << k))) k++;
      d = world.conductivity[edgeSlot(world.width, cell, k)] as number;
    }
    const dist = octile(world.width, cell, core);
    const built = (world.buildingAt[cell] as number) >= 0 ? 1 : 0;
    if (
      best < 0 ||
      built < bestBuilt ||
      (built === bestBuilt && (d < bestD || (d === bestD && (dist > bestDist || (dist === bestDist && cell < best)))))
    ) {
      bestBuilt = built;
      bestD = d;
      bestDist = dist;
      best = cell;
    }
  }
  return best;
}

function starve(world: World, comp: Component): void {
  if (!validVictim(world, comp, comp.starveCell)) comp.starveCell = pickVictim(world, comp);
  const cell = comp.starveCell;
  if (cell < 0) return;
  const b = (world.biomass[cell] as number) - world.balance.starveDecay * TICK_DT;
  if (b > 0) {
    world.biomass[cell] = b;
    return;
  }
  const moldId = world.owner[cell] as number;
  world.events.push({ type: 'cellDied', cell, mold: moldId, by: 0 });
  moldOf(world, moldId).stats.cellsDestroyed++;
  comp.starveCell = -1;
  removeCell(world, cell);
}

/** Once upkeep is covered again, a half-starved cell heals back to full. */
function recover(world: World, comp: Component): void {
  const cell = comp.starveCell;
  if (cell < 0) return;
  if (world.component[cell] !== comp.id) {
    comp.starveCell = -1;
    return;
  }
  const b = Math.min(1, (world.biomass[cell] as number) + world.balance.biomassRegen * TICK_DT);
  world.biomass[cell] = b;
  if (b >= 1) comp.starveCell = -1;
}
