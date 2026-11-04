import { capOf } from './buildings';
import { DX, DY } from './grid';
import { removeCellAndSplit } from './network';
import { moldOf } from './world';
import type { CellIndex, Component, MoldId, World } from './types';

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
  setFrontHold(world, moldId, rival, false);
  swing(world, outcome === 'won' ? rival : moldId, outcome === 'won' ? moldId : rival, FRONT_SWING_CELLS);
}

/** is combat between these two molds suspended because a hero is fighting their front? */
export function frontHeld(world: Readonly<World>, a: MoldId, b: MoldId): boolean {
  return moldOf(world as World, a).holdAgainst.includes(b) || moldOf(world as World, b).holdAgainst.includes(a);
}

export function setFrontHold(world: World, moldId: MoldId, rival: MoldId, held: boolean): void {
  const list = moldOf(world, moldId).holdAgainst;
  const i = list.indexOf(rival);
  if (held && i < 0) list.push(rival);
  else if (!held && i >= 0) list.splice(i, 1);
}

/** the hero's pressure moved the line while the front is held: positive cells make ours recede, negative wither the rival's */
export function shiftFront(world: World, moldId: MoldId, rival: MoldId, cells: number): void {
  if (!Number.isFinite(cells) || cells === 0) return;
  const n = Math.min(Math.abs(Math.trunc(cells)), FRONT_SWING_CELLS);
  if (cells > 0) swing(world, moldId, rival, n);
  else swing(world, rival, moldId, n);
}

/** nutrients arriving from outside (the hero's harvest): into the biggest piece, up to what it can hold */
export function gainNutrients(world: World, moldId: MoldId, amount: number): void {
  if (!(amount > 0)) return;
  let best: Component | null = null;
  for (const c of world.components.values()) if (c.moldId === moldId && (!best || c.pool > best.pool)) best = c;
  if (best) best.pool = Math.min(capOf(world, best), best.pool + amount);
}

/** remove up to `count` cells of `victim` where they touch `winner` */
function swing(world: World, victim: MoldId, winner: MoldId, count: number): void {
  if (moldOf(world, victim).status !== 'alive' || moldOf(world, winner).status !== 'alive') return;
  for (const cell of contactCells(world, victim, winner).slice(0, count)) {
    if (world.owner[cell] !== victim) continue;
    world.events.push({ type: 'cellDied', cell, mold: victim, by: winner });
    moldOf(world, victim).stats.cellsDestroyed++;
    removeCellAndSplit(world, cell);
  }
}
