import { removeCellAndSplit } from './network';
import { blooming } from './bloom';
import { moldOf } from './world';
import { TICK_DT } from './types';
import type { CellIndex, World } from './types';

/** is this cell out of reach of every supply (its mold's core, food and each working factory)? */
export function isStray(world: Readonly<World>, cell: CellIndex): boolean {
  return (world.feed[cell] as number) <= world.balance.feed.trickle + 1e-6;
}

/**
 * Veins out of every supply's reach die back (called at the flow cadence, after the feed is
 * recomputed). A stray cell is given `graceSeconds` (time to build a factory); after that it loses
 * biomass over `fadeSeconds` and dies, and combat's regrowth skips it. Back in reach, its clock
 * resets. The core, cells over food and the head of a growing tip are spared, so a vein can still be
 * pushed out past its supply.
 */
export function fadeStrays(world: World): void {
  const { graceSeconds, fadeSeconds } = world.balance.feed;
  if (!(fadeSeconds > 0)) return;
  const dt = world.balance.flowEvery * TICK_DT;
  const loss = dt / fadeSeconds;
  const heads = new Set<number>();
  for (const mold of world.molds) for (const tip of mold.targets) heads.add(tip.path[tip.pos] as number);
  const dead: CellIndex[] = [];
  for (let c = 0; c < world.owner.length; c++) {
    const o = world.owner[c] as number;
    if (o === 0) continue;
    const mold = world.molds[o - 1];
    if (!mold || mold.status !== 'alive' || blooming(world, o) || c === mold.core || (world.food[c] as number) > 0 || heads.has(c) || !isStray(world, c)) {
      world.strayFor[c] = 0;
      continue;
    }
    world.strayFor[c] = (world.strayFor[c] as number) + dt;
    if ((world.strayFor[c] as number) <= graceSeconds) continue;
    const b = (world.biomass[c] as number) - loss;
    if (b <= 0) dead.push(c);
    else world.biomass[c] = b;
  }
  for (const c of dead) {
    const moldId = world.owner[c] as number;
    if (moldId === 0) continue;
    world.events.push({ type: 'cellDied', cell: c, mold: moldId, by: 0 });
    moldOf(world, moldId).stats.cellsDestroyed++;
    removeCellAndSplit(world, c);
  }
}
