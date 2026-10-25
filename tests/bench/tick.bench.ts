/**
 * Sim tick benchmark (run with `npm run bench`). Constitution V budget: mean tick <= 6 ms at
 * round-10 scale (about 275x206 cells, 6 molds). Rivals, combat, fog and AI are added in later
 * stories; the scenario grows with them. Exits non-zero if the budget is missed.
 */
import { defaultBalance } from '../../src/config/balance';
import { createRound, enqueue, step } from '../../src/sim';
import type { World } from '../../src/sim';
import { neighbor } from '../../src/sim/grid';
import { addCell } from '../../src/sim/network';

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
  // idle veins would retract; keep them so the tick cost is a worst case
  const balance = { ...defaultBalance, retractDelay: 1e9 };
  const world = createRound({ runSeed: 5, roundNumber: round, balance });
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

let failed = false;
for (const round of [1, 10]) {
  const world = foragingWorld(round);
  const ticks = 600;
  const times: number[] = [];
  for (let i = 0; i < ticks; i++) {
    const t0 = performance.now();
    step(world);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((s, t) => s + t, 0) / times.length;
  const p99 = times[Math.floor(times.length * 0.99)]!;
  const label = `round ${round} (${world.width}x${world.height}, ${world.molds[0]!.cellCount} cells, ${world.molds[0]!.targets.length} tips)`;
  console.log(`${label}: mean ${mean.toFixed(3)} ms, p99 ${p99.toFixed(3)} ms, max ${times[times.length - 1]!.toFixed(3)} ms`);
  if (mean > BUDGET_MS) failed = true;
}
if (failed) {
  console.error(`over the ${BUDGET_MS} ms budget`);
  process.exit(1);
}
