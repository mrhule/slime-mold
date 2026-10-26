import { stockOf } from './hud';
import { moldOf } from './world';
import type { MoldId, PlaceResult, World } from './types';

/** where a mold stands on evolving: its tier, whether it holds enough to pay for the next step, and what that costs */
export function evolveStatus(world: Readonly<World>, moldId: MoldId): { current: number; max: number; ready: boolean; needed: number; cost: number } {
  const t = world.balance.tiers;
  const mold = moldOf(world, moldId);
  const cost = t.costs[mold.tier - 1] ?? Infinity;
  const stock = stockOf(world as World, moldId);
  return { current: mold.tier, max: t.max, ready: mold.tier < t.max && stock.total >= cost, needed: cost, cost };
}

/**
 * Evolve: spend a fixed number of nutrients (taken from every piece in proportion to what it holds)
 * to move up a tier, which unlocks the buildings that need it. The price depends only on the tier
 * you are leaving, not on how many factories you have. Needs the stock to cover it, so it is also a
 * use for nutrients that would otherwise pile up at the cap.
 */
export function evolve(world: World, moldId: MoldId): { ok: true } | { ok: false; reason: string } {
  const status = evolveStatus(world, moldId);
  if (status.current >= status.max) return { ok: false, reason: 'max-tier' };
  if (!status.ready) return { ok: false, reason: 'cant-afford' };
  const stock = stockOf(world, moldId);
  const keep = 1 - status.cost / stock.total;
  for (const c of world.components.values()) if (c.moldId === moldId) c.pool *= keep;
  const mold = moldOf(world, moldId);
  mold.tier++;
  world.events.push({ type: 'moldEvolved', mold: moldId, tier: mold.tier });
  return { ok: true };
}

export type { PlaceResult };
