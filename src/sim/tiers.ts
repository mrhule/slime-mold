import { stockOf } from './hud';
import { moldOf } from './world';
import type { MoldId, PlaceResult, World } from './types';

/** where a mold stands on evolving: its tier, whether the stock is full enough, and what the next step costs */
export function evolveStatus(world: Readonly<World>, moldId: MoldId): { current: number; max: number; ready: boolean; needed: number; cost: number } {
  const t = world.balance.tiers;
  const mold = moldOf(world, moldId);
  const stock = stockOf(world as World, moldId);
  const needed = t.fullShare * stock.cap;
  return {
    current: mold.tier,
    max: t.max,
    ready: mold.tier < t.max && stock.cap > 0 && stock.total >= needed,
    needed,
    cost: t.costShare * stock.cap,
  };
}

/**
 * Evolve: with the stock near full, spend a share of the cap (taken from every piece in proportion
 * to what it holds) to move up a tier, which unlocks the buildings that need it. Turns nutrients
 * that would be wasted at the cap into progress.
 */
export function evolve(world: World, moldId: MoldId): { ok: true } | { ok: false; reason: string } {
  const status = evolveStatus(world, moldId);
  if (status.current >= status.max) return { ok: false, reason: 'max-tier' };
  if (!status.ready) return { ok: false, reason: 'not-full' };
  const stock = stockOf(world, moldId);
  const keep = 1 - status.cost / stock.total;
  for (const c of world.components.values()) if (c.moldId === moldId) c.pool *= keep;
  const mold = moldOf(world, moldId);
  mold.tier++;
  world.events.push({ type: 'moldEvolved', mold: moldId, tier: mold.tier });
  return { ok: true };
}

export type { PlaceResult };
