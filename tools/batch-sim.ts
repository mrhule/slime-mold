/**
 * Headless balance and performance report (T092):
 *   npm run sim:batch -- --rounds 1-3 --games 20 [--aggr 0.4] [--think 1.2] [--farms 4] [--max 25] [--seed 1] [--verbose]
 *                        [--set upkeepPerCell=0.002,dropInterval=25]   (balance overrides, dotted paths allowed)
 *
 * Plays whole rounds with the player driven by the same AI the rivals use (so no human is
 * needed), and reports how rounds end, how long they take in game time, and the tick cost.
 */
import { think } from '../src/sim/ai/rival-ai';
import { Rng } from '../src/sim/rng';
import { defaultBalance } from '../src/config/balance';
import type { BalanceConfig } from '../src/config/balance';
import { canPlace, createRound, enqueue, step, viewFor } from '../src/sim';
import type { AiState, World } from '../src/sim';
import { TICK_DT } from '../src/sim/types';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const [r0, r1] = arg('rounds', '1-1').split('-').map(Number) as [number, number | undefined];
const roundFrom = r0;
const roundTo = r1 ?? r0;
const games = Number(arg('games', '10'));
const aggression = Number(arg('aggr', '0.4'));
const maxMinutes = Number(arg('max', '25'));
const baseSeed = Number(arg('seed', '1'));
const verbose = process.argv.includes('--verbose');
/** how often (seconds) the player model decides what to do; a fixed, human-like pace */
const playerThink = Number(arg('think', '1.2'));
/** how many farms the player model builds (a human would; the rival AI does not build yet) */
const farms = Number(arg('farms', '4'));

/** apply "--set a=1,b.c=2" on top of the default balance */
function balanceFromArgs(): BalanceConfig {
  const balance = structuredClone(defaultBalance) as unknown as Record<string, unknown>;
  const spec = arg('set', '');
  for (const pair of spec.split(',').filter(Boolean)) {
    const [path, value] = pair.split('=') as [string, string];
    const keys = path.split('.');
    let node = balance;
    for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>;
    const last = keys[keys.length - 1] as string;
    if (!(last in node)) throw new Error(`unknown balance key ${path}`);
    node[last] = Number(value);
  }
  return balance as unknown as BalanceConfig;
}
const balance = balanceFromArgs();

interface GameResult {
  outcome: 'victory' | 'defeat' | 'timeout';
  minutes: number;
  cells: number;
  rivalCells: number;
  tickMs: number;
}

/** A human-ish habit: spend spare nutrients on a farm next to the core, up to `farms` of them. */
function maybeBuildFarm(world: World): void {
  const mold = world.molds[0]!;
  if (mold.status !== 'alive' || farms <= 0) return;
  const spec = world.balance.buildings.farm;
  if (world.buildings.filter((b) => !b.destroyed && b.moldId === 1).length >= farms) return;
  const w = world.width;
  const cx = mold.core % w;
  const cy = Math.floor(mold.core / w);
  let best = -1;
  let bestD = Infinity;
  for (const comp of world.components.values()) {
    if (comp.moldId !== 1 || comp.pool < spec.cost + 15) continue;
    for (const c of comp.cells) {
      const d = (c % w - cx) ** 2 + (Math.floor(c / w) - cy) ** 2;
      if (d < bestD && canPlace(world, 1, 'farm', c).ok) {
        bestD = d;
        best = c;
      }
    }
  }
  if (best >= 0) enqueue(world, { type: 'placeBuilding', mold: 1, building: 'farm', cell: best });
}

/** the player is run by the rival AI: think on the same cadence, through ordinary commands */
function playGame(round: number, seed: number): GameResult {
  const world: World = createRound({ runSeed: seed, roundNumber: round, balance });
  const state: AiState = { aggression, debug: [] };
  const rng = new Rng(seed ^ 0x5a5a); // the harness's own stream, not part of the world
  const interval = Math.max(1, Math.round(playerThink / TICK_DT));
  const maxTicks = Math.round((maxMinutes * 60) / TICK_DT);
  let tickMsTotal = 0;
  let ticks = 0;
  while (world.tick < maxTicks && world.outcome === 'playing') {
    if (world.tick % interval === 0 && world.molds[0]!.status === 'alive') {
      for (const cmd of think(viewFor(world, 1), state, rng, world.balance.aiCommandsPerThink)) enqueue(world, cmd);
      maybeBuildFarm(world);
    }
    const t0 = performance.now();
    step(world);
    tickMsTotal += performance.now() - t0;
    ticks++;
  }
  return {
    outcome: world.outcome === 'playing' ? 'timeout' : world.outcome,
    minutes: (world.tick * TICK_DT) / 60,
    cells: world.molds[0]!.cellCount,
    rivalCells: world.molds.slice(1).reduce((a, m) => a + m.cellCount, 0),
    tickMs: tickMsTotal / Math.max(1, ticks),
  };
}

const pct = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

let reach = 1; // chance a run gets through every round so far
for (let round = roundFrom; round <= roundTo; round++) {
  const results: GameResult[] = [];
  for (let g = 0; g < games; g++) {
    const res = playGame(round, baseSeed * 1000 + g);
    results.push(res);
    if (verbose) console.log(`  round ${round} game ${g}: ${res.outcome} in ${res.minutes.toFixed(1)} min, ${res.cells} cells vs ${res.rivalCells}`);
  }
  const wins = results.filter((r) => r.outcome === 'victory').length;
  const losses = results.filter((r) => r.outcome === 'defeat').length;
  const timeouts = results.length - wins - losses;
  reach *= wins / games;
  const mins = results.map((r) => r.minutes).sort((a, b) => a - b);
  const tickMs = results.reduce((s, r) => s + r.tickMs, 0) / results.length;
  console.log(
    `round ${round}: ${games} games, win ${((wins / games) * 100).toFixed(0)}%, lose ${((losses / games) * 100).toFixed(0)}%, ` +
      `timeout ${((timeouts / games) * 100).toFixed(0)}% | minutes median ${pct(mins, 0.5).toFixed(1)} ` +
      `p10 ${pct(mins, 0.1).toFixed(1)} p90 ${pct(mins, 0.9).toFixed(1)} | mean tick ${tickMs.toFixed(2)} ms | cleared so far ${(reach * 100).toFixed(1)}%`,
  );
}
