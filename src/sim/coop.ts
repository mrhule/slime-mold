import { DX, DY } from './grid';
import { removeCellAndSplit } from './network';
import { moldOf } from './world';
import type { CellIndex, MoldId, World } from './types';

/** cells that wither (or recede) when a front the hero fought is decided */
export const FRONT_SWING_CELLS = 10;

/**
 * Pay nutrients out of a mold's stock (co-op: hero upgrades, supplies and the cost of an open front).
 * The money comes from every piece in proportion to what it holds. Without `partial` it is all or nothing.
 * Returns how much was taken.
 */
export function spendNutrients(world: World, moldId: MoldId, amount: number, partial: boolean): number {
  if (!(amount > 0)) return 0;
  let total = 0;
  for (const c of world.components.values()) if (c.moldId === moldId) total += c.pool;
  if (total <= 0 || (!partial && total < amount)) return 0;
  const take = Math.min(amount, total);
  for (const c of world.components.values()) if (c.moldId === moldId) c.pool -= (c.pool / total) * take;
  return take;
}

/** the cells of `victim` that touch a cell of `other`, the most contested first */
function contactCells(world: World, victim: MoldId, other: MoldId): CellIndex[] {
  const { width: w, height: h } = world;
  const out: { cell: CellIndex; touching: number }[] = [];
  for (const cell of moldOf(world, victim).frontCells) {
    if (world.owner[cell] !== victim || cell === moldOf(world, victim).core) continue;
    const x = cell % w;
    const y = Math.floor(cell / w);
    let touching = 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + (DX[k] as number);
      const ny = y + (DY[k] as number);
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && world.owner[ny * w + nx] === other) touching++;
    }
    if (touching > 0) out.push({ cell, touching });
  }
  out.sort((a, b) => b.touching - a.touching || a.cell - b.cell);
  return out.map((e) => e.cell);
}

/**
 * The hero decided a front: a win withers the rival's cells where it touches the player, a loss (or a
 * recall) makes the player's line recede from it. Not called for fronts that auto-resolve.
 */
export function resolveFront(world: World, moldId: MoldId, rival: MoldId, outcome: 'won' | 'lost'): void {
  const victim = outcome === 'won' ? rival : moldId;
  const winner = outcome === 'won' ? moldId : rival;
  if (moldOf(world, rival).status !== 'alive') return;
  for (const cell of contactCells(world, victim, winner).slice(0, FRONT_SWING_CELLS)) {
    if (world.owner[cell] !== victim) continue;
    world.events.push({ type: 'cellDied', cell, mold: victim, by: winner });
    moldOf(world, victim).stats.cellsDestroyed++;
    removeCellAndSplit(world, cell);
  }
}
