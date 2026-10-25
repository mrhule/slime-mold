import { think } from './ai/rival-ai';
import { enqueueInternal } from './commands';
import { TICK_DT } from './types';
import type { World } from './types';
import { viewFor } from './view';

/**
 * Let each rival think when its turn comes (R8). Rivals only get a `MoldView` and answer with
 * ordinary commands, which go into the same queue as the player's. Think times are jittered per
 * rival from their own seeded stream so they do not act in lockstep.
 */
export function tickAi(world: World): void {
  for (const mold of world.molds) {
    if (!mold.ai || mold.status !== 'alive' || world.tick < mold.aiNext) continue;
    const rng = world.rng.get(`ai:${mold.id}`);
    for (const cmd of think(viewFor(world, mold.id), mold.ai, rng, world.balance.aiCommandsPerThink)) enqueueInternal(world, cmd);
    const interval = world.difficulty.aiThinkInterval / TICK_DT;
    mold.aiNext = world.tick + Math.max(1, Math.round(interval * (1 + rng.jitter(0.2))));
  }
}
