import { capOf, storeStock } from './buildings';
import { engulfFood } from './food';
import { neighbor } from './grid';
import { addCell } from './network';
import { hash2 } from './noise';
import { mapControl } from './round';
import { moldOf } from './world';
import { TICK_DT, Terrain } from './types';
import type { CellIndex, MoldId, World } from './types';

/** the four straight directions in grid.ts's order (E, S, W, N) */
const STRAIGHT = [0, 2, 4, 6] as const;

/** is this mold in the middle of a spore burst's bloom? */
export const blooming = (world: Readonly<World>, moldId: MoldId): boolean => {
  const mold = world.molds[moldId - 1];
  return !!mold && mold.bloomUntil > world.tick;
};

export type BurstState = 'locked' | 'poor' | 'ready' | 'blooming' | 'used';

/** where a mold's spore burst stands: still locked, too poor, ready, blooming now, or already spent this round */
export function burstStatus(world: Readonly<World>, moldId: MoldId): { state: BurstState; unlockIn: number; secondsLeft: number } {
  const mold = moldOf(world as World, moldId);
  const b = world.balance.burst;
  const elapsed = world.tick * TICK_DT;
  if (blooming(world, moldId)) return { state: 'blooming', unlockIn: 0, secondsLeft: Math.max(0, (mold.bloomUntil - world.tick) * TICK_DT) };
  if (mold.burstUsed) return { state: 'used', unlockIn: 0, secondsLeft: 0 };
  if (elapsed < b.minSeconds) return { state: 'locked', unlockIn: b.minSeconds - elapsed, secondsLeft: 0 };
  if (storeStock(world, moldId) < b.cost) return { state: 'poor', unlockIn: 0, secondsLeft: 0 };
  return { state: 'ready', unlockIn: 0, secondsLeft: 0 };
}

const walkable = (world: Readonly<World>, cell: CellIndex): boolean => world.terrain[cell] === Terrain.Open || world.terrain[cell] === Terrain.Rough;

/** pick spots for the seeds: open, empty, away from food and anyone's veins, and spread out */
function seedSpots(world: Readonly<World>, moldId: MoldId): CellIndex[] {
  const { seeds, spacing } = world.balance.burst;
  const w = world.width;
  const h = world.height;
  const total = w * h;
  const chosen: CellIndex[] = [];
  for (let attempt = 0; attempt < 6000 && chosen.length < seeds; attempt++) {
    const cell = Math.floor(hash2(attempt, world.tick, world.seed + 991) * total);
    if (!walkable(world, cell) || (world.foodSourceId[cell] as number) >= 0) continue;
    const x = cell % w;
    const y = Math.floor(cell / w);
    if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
    let clear = true;
    for (let dy = -2; dy <= 2 && clear; dy++) for (let dx = -2; dx <= 2; dx++) if ((world.owner[cell + dy * w + dx] as number) !== 0) { clear = false; break; }
    if (!clear) continue;
    for (const o of chosen) if ((o % w - x) ** 2 + (Math.floor(o / w) - y) ** 2 < spacing * spacing) { clear = false; break; }
    if (clear) chosen.push(cell);
  }
  void moldId;
  return chosen;
}

/** Start the burst: pay for it, scatter the seeds and begin the bloom. Returns a reason when it cannot run. */
export function sporeBurst(world: World, moldId: MoldId): string | null {
  const mold = moldOf(world, moldId);
  if (mold.status !== 'alive') return 'mold-eliminated';
  const status = burstStatus(world, moldId);
  if (status.state === 'locked') return 'burst-locked';
  if (status.state === 'used' || status.state === 'blooming') return 'burst-used';
  if (status.state === 'poor') return 'burst-cost';
  // the cost comes out of the richest pieces first
  let owed = world.balance.burst.cost;
  const pieces = [...world.components.values()].filter((c) => c.moldId === moldId).sort((a, b) => b.pool - a.pool);
  for (const comp of pieces) {
    const take = Math.min(comp.pool, owed);
    comp.pool -= take;
    owed -= take;
    if (owed <= 1e-9) break;
  }
  mold.burstUsed = true;
  mold.bloomUntil = world.tick + Math.round(world.balance.burst.bloomSeconds / TICK_DT);
  const spots = seedSpots(world, moldId);
  for (const cell of spots) {
    addCell(world, moldId, cell, -1);
    engulfFood(world, moldId, cell);
  }
  world.events.push({ type: 'sporeBurst', mold: moldId, seeds: spots.length });
  return null;
}

/**
 * Every tick of a bloom: the bursting mold's cells spread into empty open neighbours (free of cost), its
 * pieces are kept stocked, and when the clock runs out the round is won or lost on the map control reached.
 */
export function tickBloom(world: World): void {
  const b = world.balance.burst;
  for (const mold of world.molds) {
    if (mold.bloomUntil === 0 || mold.bloomUntil === -1) continue;
    if (world.tick >= mold.bloomUntil) {
      mold.bloomUntil = -1;
      if (mold.kind === 'player' && world.outcome === 'playing' && mold.status === 'alive') {
        if (mapControl(world, mold.id) >= b.winControl) {
          world.outcome = 'victory';
          world.victoryReason = 'spore-burst';
        } else {
          world.outcome = 'defeat';
          world.defeatReason = 'burst-failed';
        }
      }
      continue;
    }
    if (world.tick % b.spreadEvery !== 0) continue;
    const w = world.width;
    const h = world.height;
    const claims = new Map<CellIndex, CellIndex>();
    for (let c = 0; c < world.owner.length; c++) {
      if (world.owner[c] !== mold.id) continue;
      for (const k of STRAIGHT) {
        const n = neighbor(w, h, c, k);
        if (n < 0 || (world.owner[n] as number) !== 0 || !walkable(world, n) || claims.has(n)) continue;
        if (hash2(c * 8 + k, world.tick, world.seed + 7) < b.spreadChance) claims.set(n, c);
      }
    }
    for (const [cell, from] of claims) {
      addCell(world, mold.id, cell, from);
      engulfFood(world, mold.id, cell);
    }
    for (const comp of world.components.values()) if (comp.moldId === mold.id) comp.pool = Math.max(comp.pool, capOf(world, comp));
  }
}
