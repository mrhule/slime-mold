import { moldOf } from './world';
import { TICK_DT } from './types';
import type { MoldId, RoundOutcome, World } from './types';

/**
 * Share of the reachable map a mold holds: owned cells over the walkable cells reachable from
 * the player's start (terrain 2 and 3 never count). Win threshold is `balance.victoryControl`.
 */
export function mapControl(world: Readonly<World>, moldId: MoldId): number {
  if (world.reachableCells <= 0) return 0;
  return moldOf(world as World, moldId).cellCount / world.reachableCells;
}

/**
 * Decide the round (FR-022): defeat when the player is eliminated; victory when every rival is
 * eliminated or the player holds `victoryControl` of the map. Defeat is checked first, so if
 * both happen in the same tick the player loses. Once decided, the outcome sticks.
 */
/**
 * The map control that wins the round right now. It starts at `victoryControl`; once a round has run
 * past `victoryEase.startSeconds` it eases down, so a stalemate always ends one way or the other.
 */
export function winThreshold(world: Readonly<World>): number {
  const { victoryControl, victoryEase: e } = world.balance;
  const late = Math.max(0, world.tick * TICK_DT - e.startSeconds);
  return Math.max(Math.min(victoryControl, e.floor), victoryControl - (late / 60) * e.perMinute);
}

export function evaluateOutcome(world: World): void {
  if (world.outcome !== 'playing') return;
  const player = world.molds[0];
  if (!player) return;
  if (player.status === 'eliminated') {
    world.outcome = 'defeat';
    world.defeatReason = 'eliminated';
    return;
  }
  const rivals = world.molds.slice(1);
  if (rivals.length > 0 && rivals.every((m) => m.status === 'eliminated')) {
    world.outcome = 'victory';
    world.victoryReason = 'eliminated-all';
    return;
  }
  if (mapControl(world, player.id) >= winThreshold(world)) {
    world.outcome = 'victory';
    world.victoryReason = 'map-control';
  }
}

export function roundOutcome(world: Readonly<World>): RoundOutcome {
  return world.outcome;
}
