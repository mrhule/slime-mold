import { octile } from '../grid';
import type { Rng } from '../rng';
import type { AiState, BuildingType, CellIndex, Command, FoodType, MoldView } from '../types';

/** Public knowledge of what each food type is worth, for judging drops from a warning. */
const FOOD_VALUE: Record<FoodType, number> = { oatFlake: 40, breadCrumb: 120, sugarCube: 300, fruitSlice: 500 };
/** roughly how fast a mold grows toward something, in cells per second */
const GROW_SPEED = 5;
const MIN_SPACING = 9;
const EXPLORE_SAMPLES = 10;
/** how many own cells to try when looking for a spot to build */
const BUILD_TRIES = 80;
/** a booster factory this close to a front (as the crow flies) strengthens it well along the veins */
const BOOSTER_REACH = 10;
/** food worth a harvester: roughly bread crumb size and up */
const HARVEST_WORTH = 100;

interface Candidate {
  cell: CellIndex;
  score: number;
  kind: 'food' | 'drop' | 'attack' | 'explore';
}

/**
 * Decide whether to build something this think, using only what the view shows. A rival builds
 * only when it holds more than the building costs plus a reserve (set by difficulty: a smaller
 * reserve means it builds sooner). Same command, costs, and limits as the player (FR-019).
 */
function planBuild(view: MoldView, state: AiState): Command | null {
  const reserve = state.buildReserve ?? 100;
  const rich = view.richestPool();
  const me = view.self.id;
  const own = view.ownCells();
  if (own.length === 0) return null;
  const w = view.width;
  const place = (type: BuildingType, cell: CellIndex): Command => ({ type: 'placeBuilding', mold: me, building: type, cell });
  const affords = (type: BuildingType, spare: number): boolean => rich >= view.buildCost(type) + reserve * spare;

  // under pressure on a front: a booster factory close behind it
  if (view.self.frontCells.length > 0 && view.self.frontLoss > 0.15 && affords('booster', 0.4)) {
    const front = view.self.frontCells[0] as CellIndex;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < Math.min(own.length, BUILD_TRIES * 4); i++) {
      const c = own[i] as CellIndex;
      const d = octile(w, c, front);
      if (d < bestD && d <= BOOSTER_REACH && view.canBuild('booster', c)) {
        bestD = d;
        best = c;
      }
    }
    if (best >= 0) {
      return place('booster', best);
    }
  }

  // big food within reach: a harvester to pay it out sooner
  if (affords('harvester', 0.5)) {
    for (const f of view.knownFood()) {
      if (f.stale || f.amount < HARVEST_WORTH) continue;
      for (let i = 0; i < Math.min(own.length, BUILD_TRIES * 4); i++) {
        const c = own[i] as CellIndex;
        if (octile(w, c, f.cell) <= 4 && view.canBuild('harvester', c)) {
              return place('harvester', c);
        }
      }
    }
  }

  // otherwise a farm, for steady income
  if (affords('farm', 1)) {
    for (let i = 0; i < Math.min(own.length, BUILD_TRIES); i++) {
      const c = own[i] as CellIndex;
      if (view.canBuild('farm', c)) {
          return place('farm', c);
      }
    }
  }
  return null;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Utility AI (R8). It scores things worth growing toward, picks a few well-separated ones, and
 * sets the growth/fight slider from the fronts it sees. Its only inputs are `view` (fog-limited)
 * and its own `state`; its only outputs are the same commands the player has (FR-015).
 */
export function think(view: MoldView, state: AiState, rng: Rng, maxCommands: number): Command[] {
  const me = view.self.id;
  const commands: Command[] = [];
  if (view.self.cellCount === 0) return commands;
  const aggression = state.aggression;

  // growth/fight allocation from the fronts it can see
  let want = 0;
  if (view.self.frontCells.length > 0) {
    want = 0.25 + 0.55 * aggression + (view.self.frontLoss > 0.4 ? 0.15 : 0);
  }
  want = Math.round(Math.min(0.95, clamp01(want)) * 20) / 20;
  if (Math.abs(want - view.self.allocation) >= 0.1) commands.push({ type: 'setAllocation', mold: me, value: want });

  const w = view.width;
  const h = view.height;
  const score = (cell: CellIndex, value: number): number => {
    const from = view.nearestOwn(cell);
    if (from < 0) return 0;
    return value / (view.pathCost(from, cell) + 8);
  };

  const candidates: Candidate[] = [];
  for (const f of view.knownFood()) {
    if (view.ownerAt(f.cell) === me) continue;
    candidates.push({ cell: f.cell, kind: 'food', score: score(f.cell, f.amount * (f.stale ? 0.6 : 1)) });
  }
  for (const d of view.dropWarnings()) {
    const from = view.nearestOwn(d.cell);
    if (from < 0) continue;
    const arrivesIn = view.pathCost(from, d.cell) / GROW_SPEED;
    const lands = d.landsInTicks * 0.05;
    // worth racing for if we can be there soon after it lands
    const urgency = arrivesIn <= lands + 20 ? 1.2 : 0.4;
    candidates.push({ cell: d.cell, kind: 'drop', score: score(d.cell, FOOD_VALUE[d.type] * urgency) });
  }
  const enemies = view.visibleEnemyCells();
  const stride = Math.max(1, Math.floor(enemies.length / 60));
  for (let i = 0; i < enemies.length; i += stride) {
    const cell = enemies[i] as CellIndex;
    const bio = view.biomassAt(cell) ?? 1;
    candidates.push({ cell, kind: 'attack', score: score(cell, 120 * aggression * (1.3 - bio)) });
  }
  for (let i = 0; i < EXPLORE_SAMPLES; i++) {
    const cell = (1 + rng.int(h - 2)) * w + 1 + rng.int(w - 2);
    if ((view.terrain[cell] as number) >= 2) continue;
    const v = view.visibility(cell);
    candidates.push({ cell, kind: 'explore', score: score(cell, v === 0 ? 45 : v === 1 ? 10 : 4) });
  }
  candidates.sort((a, b) => b.score - a.score || a.cell - b.cell);

  // pick a few well-separated targets; with all slots full, replace at most one, and only for a good one
  const taken: CellIndex[] = view.self.targets.map((t) => t.cell);
  const free = Math.max(0, 3 - view.self.targets.length);
  const slots = free > 0 ? Math.min(free, 2) : 1;
  const picks: Candidate[] = [];
  for (const c of candidates) {
    if (picks.length >= slots) break;
    if (c.score < (free > 0 ? 0.15 : 1.0)) break;
    if (taken.some((t) => octile(w, t, c.cell) < MIN_SPACING)) continue;
    picks.push(c);
    taken.push(c.cell);
  }
  for (const c of picks) commands.push({ type: 'setTarget', mold: me, cell: c.cell });

  const build = planBuild(view, state);
  if (build) commands.splice(Math.min(1, commands.length), 0, build);

  state.debug = candidates.slice(0, 3).map((c) => `${c.kind}@${c.cell % w},${Math.floor(c.cell / w)} ${c.score.toFixed(2)}`);
  if (build && build.type === 'placeBuilding') state.debug.unshift(`build ${build.building}`);
  return commands.slice(0, maxCommands);
}
