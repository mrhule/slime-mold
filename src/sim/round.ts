import { moldOf } from './world';
import type { MoldId, World } from './types';

/**
 * Share of the reachable map a mold holds: owned cells over the walkable cells reachable from
 * the player's start (terrain 2 and 3 never count). Win threshold is `balance.victoryControl`.
 */
export function mapControl(world: Readonly<World>, moldId: MoldId): number {
  if (world.reachableCells <= 0) return 0;
  return moldOf(world as World, moldId).cellCount / world.reachableCells;
}
