/**
 * Sim tick benchmark (run with `npm run bench`). Constitution V budget: mean tick <= 6 ms at
 * round-10 scale (about 275x206 cells, 6 molds). Rivals, combat, fog and AI are added in later
 * stories; the scenario grows with them. Exits non-zero if the budget is missed.
 */
import { defaultBalance } from '../../src/config/balance';
import { think } from '../../src/sim/ai/rival-ai';
import { Rng } from '../../src/sim/rng';
import { createRound, enqueue, step, viewFor } from '../../src/sim';
import type { AiState, World } from '../../src/sim';
import { neighbor } from '../../src/sim/grid';
import { addCell } from '../../src/sim/network';
import { placeBuilding } from '../../src/sim/buildings';
import type { BuildingType } from '../../src/sim';

const BUDGET_MS = 6;
const NETWORK_CELLS = 4000;

/** Grow a big blob by flood fill from the core so the tick has a realistic network to chew on. */
function prebuild(world: World, cells: number): void {
  const mold = world.molds[0]!;
  const queue = [...world.components.values()].flatMap((c) => c.cells);
  let head = 0;
  while (head < queue.length && mold.cellCount < cells) {
    const u = queue[head++]!;
    for (const k of [0, 2, 4, 6]) {
      const v = neighbor(world.width, world.height, u, k);
      if (v < 0 || world.owner[v] !== 0 || world.terrain[v]! >= 2) continue;
      addCell(world, mold.id, v, u);
      queue.push(v);
      if (mold.cellCount >= cells) break;
    }
  }
}

function foragingWorld(round: number): World {
  const world = createRound({ runSeed: 5, roundNumber: round, balance: defaultBalance });
  const mold = world.molds[0]!;
  prebuild(world, NETWORK_CELLS);
  for (const comp of world.components.values()) comp.pool = 1e6;
  const core = mold.core;
  const cx = core % world.width;
  const cy = Math.floor(core / world.width);
  const byDistance = [...world.foodSources]
    .filter((f) => world.owner[f.y * world.width + f.x] === 0)
    .sort((a, b) => (a.x - cx) ** 2 + (a.y - cy) ** 2 - ((b.x - cx) ** 2 + (b.y - cy) ** 2));
  for (const f of byDistance.slice(0, 3)) {
    enqueue(world, { type: 'setTarget', mold: 1, cell: f.y * world.width + f.x });
  }
  step(world);
  return world;
}

/**
 * The growth-only world with every building type at its per-mold limit (farms on fertile ground,
 * store houses boosting growing tips), so the building and boost code runs at its worst.
 */
function buildingsWorld(round: number): World {
  const world = foragingWorld(round);
  for (const comp of world.components.values()) comp.pool = 1e6;
  const spec = world.balance.buildings;
  const own: number[] = [];
  for (let c = 0; c < world.owner.length; c++) if (world.owner[c] === 1 && (world.food[c] as number) <= 0 && world.buildingAt[c]! < 0) own.push(c);
  const plan: [BuildingType, number][] = [
    ['storehouse', spec.storehouse.limit],
    ['farm', spec.farm.limit],
    ['booster', spec.booster.limit],
  ];
  let k = 0;
  const stride = Math.floor(own.length / 20);
  for (const [type, count] of plan) {
    for (let i = 0; i < count; i++) {
      const cell = own[(k++ * stride + 7) % own.length]!;
      if (type === 'farm') world.fertile[cell] = 1;
      placeBuilding(world, 1, type, cell);
    }
  }
  for (const comp of world.components.values()) comp.pool = 500;
  return world;
}

/** A full round with every mold AI-driven (the player too), warmed up so fronts, fog and AI all run. */
function rivalWorld(round: number): { world: World; drive: (tick: number) => void } {
  const world = createRound({ runSeed: 5, roundNumber: round });
  const state: AiState = { aggression: 0.6, debug: [] };
  const rng = new Rng(99);
  const interval = Math.round(world.difficulty.aiThinkInterval / 0.05);
  const drive = (tick: number): void => {
    if (tick % interval === 0 && world.molds[0]!.status === 'alive') {
      for (const cmd of think(viewFor(world, 1), state, rng, 3)) enqueue(world, cmd);
    }
  };
  for (let t = 0; t < 3600; t++) {
    drive(t);
    step(world);
  }
  return { world, drive };
}

interface Scenario {
  label: (world: World) => string;
  build: () => { world: World; drive?: (tick: number) => void };
}

const scenarios: Scenario[] = [
  ...[1, 10].map((round): Scenario => ({
    label: (w) => `growth only, round ${round} (${w.width}x${w.height}, ${w.molds[0]!.cellCount} cells, 4000-cell network)`,
    build: () => ({ world: foragingWorld(round) }),
  })),
  ...[1, 10].map((round): Scenario => ({
    label: (w) => `every building at its limit, round ${round} (${w.width}x${w.height}, ${w.molds[0]!.cellCount} cells, ${w.buildings.length} placed, ${w.buildings.filter((b) => !b.destroyed).length} standing at the end)`,
    build: () => {
      const world = buildingsWorld(round);
      // keep the pieces stocked so upkeep never starves a building away during the run
      return { world, drive: () => { for (const c of world.components.values()) if (c.moldId === 1) c.pool = 500; } };
    },
  })),
  ...[1, 10].map((round): Scenario => ({
    label: (w) => `AI vs AI, round ${round} (${w.width}x${w.height}, ${w.molds.length} molds, ${w.molds.reduce((s, m) => s + m.cellCount, 0)} cells, ${w.molds.reduce((s, m) => s + m.frontCells.length, 0)} front cells)`,
    build: () => rivalWorld(round),
  })),
];

let failed = false;
for (const scenario of scenarios) {
  const { world, drive } = scenario.build();
  const ticks = 600;
  const times: number[] = [];
  for (let i = 0; i < ticks; i++) {
    drive?.(world.tick);
    const t0 = performance.now();
    step(world);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((s, t) => s + t, 0) / times.length;
  const p99 = times[Math.floor(times.length * 0.99)]!;
  const label = scenario.label(world);
  console.log(`${label}: mean ${mean.toFixed(3)} ms, p99 ${p99.toFixed(3)} ms, max ${times[times.length - 1]!.toFixed(3)} ms`);
  if (mean > BUDGET_MS) failed = true;
}
if (failed) {
  console.error(`over the ${BUDGET_MS} ms budget`);
  process.exit(1);
}
