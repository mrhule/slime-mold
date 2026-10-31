import { octile } from './grid';
import { enqueueInternal } from './commands';
import { viewFor } from './view';
import type { CellIndex, Mold, MoldView, World } from './types';

/** how far apart new targets must be */
const MIN_SPACING = 9;
/** how far from one of its own cells a wandering vein picks a spot, in cells */
const WANDER_MIN = 6;
const WANDER_MAX = 14;
const WANDER_TRIES = 12;
/** what a goo pool nobody holds is worth, against food (an oat flake is 40, a bread crumb 120) */
const POOL_VALUE = 150;

/** the Growth/War slider is at its Growth end: the veins explore on their own (the player's mold only) */
export function exploring(world: Readonly<World>, mold: Readonly<Mold>): boolean {
  return !mold.ai && mold.allocation <= world.balance.allocationZones.exploreMax;
}

/** the slider is at its War end: the mold bleeds nutrients and its veins die back (the player's mold only) */
export function atWar(world: Readonly<World>, mold: Readonly<Mold>): boolean {
  return !mold.ai && mold.allocation >= world.balance.allocationZones.warMin;
}

/** a target the veins picked themselves rather than the player: they grow slower than a chosen one */
const isOwn = (speed: number): boolean => speed < 1;

/** food or a goo pool the mold has had in sight at some point (never what is still in the fog), best first */
function revealedNutrients(world: Readonly<World>, view: MoldView, mold: Mold): { cell: CellIndex; score: number }[] {
  // food that fell from the sky (sugar, bread and the rest) is not something the veins go after on their own
  const dropped = new Set<CellIndex>();
  for (const f of world.foodSources) if (f.origin === 'drop') dropped.add(f.y * world.width + f.x);
  const score = (cell: CellIndex, value: number): number => {
    const from = view.nearestOwn(cell);
    return from < 0 ? 0 : value / (view.pathCost(from, cell) + 8);
  };
  const out: { cell: CellIndex; score: number }[] = [];
  for (const f of view.knownFood()) {
    if (view.ownerAt(f.cell) === mold.id || dropped.has(f.cell)) continue;
    out.push({ cell: f.cell, score: score(f.cell, f.amount * (f.stale ? 0.6 : 1)) });
  }
  for (const p of view.knownPools()) {
    if (p.owned >= p.cells) continue;
    // a pool is terrain every mold knows about, so only count it once some of it has been in sight
    let seen = false;
    for (let y = 0; y < p.h && !seen; y++) {
      for (let x = 0; x < p.w; x++) {
        if (view.visibility(p.cell + y * view.width + x) !== 0) {
          seen = true;
          break;
        }
      }
    }
    if (seen) out.push({ cell: p.cell, score: score(p.cell, POOL_VALUE * (1 - p.owned / p.cells)) });
  }
  return out.filter((c) => c.score > 0).sort((a, b) => b.score - a.score || a.cell - b.cell);
}

/**
 * With the slider at max Growth, a vein splinters off every few seconds. It wanders: a random
 * spot a little way out from a random cell of the mold, grown toward at a third of normal speed,
 * and it does not know about food or goo pools still in the fog. Once food or a pool has been
 * revealed the veins stop wandering and head for it at half speed. Nutrient drops (food that
 * fell from the sky) are never gone after, in the fog or in sight. A target the player chose
 * is never replaced, and only free slots (or slots held by an earlier wandering vein) are used.
 * The orders go in as internal commands, like a rival's, so a replay makes them again.
 */
export function tickExplore(world: World): void {
  const zone = world.balance.allocationZones;
  for (const mold of world.molds) {
    if (mold.status !== 'alive' || !exploring(world, mold)) continue;
    if ((world.tick + mold.id * 7) % zone.exploreEvery !== 0) continue;
    const view = viewFor(world, mold.id);
    const w = view.width;
    const h = view.height;
    const own = mold.targets.filter((t) => isOwn(t.speed));
    const chosen = mold.targets.filter((t) => !isOwn(t.speed));

    const revealed = revealedNutrients(world, view, mold);
    const best = revealed[0];
    if (best) {
      // someone is already heading there (within a few cells) or the player's own targets fill the slots
      const covered = mold.targets.some((t) => octile(w, t.cell, best.cell) < MIN_SPACING);
      if (!covered && chosen.length < world.balance.maxTargets) {
        // wandering veins give way to the one that has something to go for
        if (mold.targets.length >= world.balance.maxTargets) {
          const wander = own.find((t) => t.speed <= zone.exploreSpeed + 1e-9);
          if (wander) enqueueInternal(world, { type: 'cancelTarget', mold: mold.id, targetId: wander.id });
        }
        enqueueInternal(world, { type: 'setTarget', mold: mold.id, cell: best.cell, speed: zone.seekSpeed });
      }
      continue;
    }

    if (mold.targets.length >= world.balance.maxTargets) continue;
    const rng = world.rng.get(`explore:${mold.id}`);
    const cells: CellIndex[] = [];
    for (const comp of world.components.values()) {
      if (comp.moldId === mold.id && !comp.orphaned) for (const c of comp.cells) cells.push(c);
    }
    if (cells.length === 0) continue;
    const taken = mold.targets.map((t) => t.cell);
    for (let i = 0; i < WANDER_TRIES; i++) {
      const from = cells[rng.int(cells.length)] as CellIndex;
      // a random offset in a square around the cell, at least WANDER_MIN away (whole cells only: no trig in the sim)
      const dx = rng.int(2 * WANDER_MAX + 1) - WANDER_MAX;
      const dy = rng.int(2 * WANDER_MAX + 1) - WANDER_MAX;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < WANDER_MIN) continue;
      const x = (from % w) + dx;
      const y = Math.floor(from / w) + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const cell = y * w + x;
      if ((view.terrain[cell] as number) >= 2 || view.ownerAt(cell) === mold.id) continue;
      if (taken.some((t) => octile(w, t, cell) < MIN_SPACING)) continue;
      enqueueInternal(world, { type: 'setTarget', mold: mold.id, cell, speed: zone.exploreSpeed });
      break;
    }
  }
}
