import type { MoldId, SimEvent, World } from '../sim/types';

export interface VisibleDeath {
  /** the dead cell belonged to the player */
  own: boolean;
  /** an enemy mold killed it (starvation and orphan decay are not) */
  byEnemy: boolean;
  cell: number;
  /** the mold the dead cell belonged to */
  mold: MoldId;
}

/**
 * The deaths the player may know about (A3, FR-005): a `cellDied` event only counts when the player's
 * vision of that cell is "visible now". Sound, splats and shake all read this list, so the fog rule
 * lives in one place. Pure: reads the world and the events, writes nothing.
 */
export function visibleDeaths(world: Readonly<World>, events: readonly SimEvent[], playerId: MoldId): VisibleDeath[] {
  const player = world.molds[playerId - 1];
  if (!player) return [];
  const out: VisibleDeath[] = [];
  for (const e of events) {
    if (e.type !== 'cellDied' || player.vision[e.cell] !== 2) continue;
    out.push({ own: e.mold === playerId, byEnemy: e.by !== 0 && e.by !== e.mold, cell: e.cell, mold: e.mold });
  }
  return out;
}
