/**
 * Headless balance and performance report (T092):
 *   npm run sim:batch -- --rounds 1-3 --games 20 [--aggr 0.4] [--max 25] [--seed 1] [--verbose]
 *
 * Plays whole rounds with the player driven by the same AI the rivals use (so no human is
 * needed), and reports how rounds end, how long they take in game time, and the tick cost.
 */
import { think } from '../src/sim/ai/rival-ai';
import { Rng } from '../src/sim/rng';
import { createRound, enqueue, step, viewFor } from '../src/sim';
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

interface GameResult {
  outcome: 'victory' | 'defeat' | 'timeout';
  minutes: number;
  cells: number;
  tickMs: number;
}

/** the player is run by the rival AI: think on the same cadence, through ordinary commands */
function playGame(round: number, seed: number): GameResult {
  const world: World = createRound({ runSeed: seed, roundNumber: round });
  const state: AiState = { aggression, debug: [] };
  const rng = new Rng(seed ^ 0x5a5a); // the harness's own stream, not part of the world
  const interval = Math.round(world.difficulty.aiThinkInterval / TICK_DT);
  const maxTicks = Math.round((maxMinutes * 60) / TICK_DT);
  let tickMsTotal = 0;
  let ticks = 0;
  while (world.tick < maxTicks && world.outcome === 'playing') {
    if (world.tick % interval === 0 && world.molds[0]!.status === 'alive') {
      for (const cmd of think(viewFor(world, 1), state, rng, world.balance.aiCommandsPerThink)) enqueue(world, cmd);
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
    tickMs: tickMsTotal / Math.max(1, ticks),
  };
}

const pct = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

for (let round = roundFrom; round <= roundTo; round++) {
  const results: GameResult[] = [];
  for (let g = 0; g < games; g++) {
    const res = playGame(round, baseSeed * 1000 + g);
    results.push(res);
    if (verbose) console.log(`  round ${round} game ${g}: ${res.outcome} in ${res.minutes.toFixed(1)} min, ${res.cells} cells`);
  }
  const wins = results.filter((r) => r.outcome === 'victory').length;
  const losses = results.filter((r) => r.outcome === 'defeat').length;
  const timeouts = results.length - wins - losses;
  const mins = results.map((r) => r.minutes).sort((a, b) => a - b);
  const tickMs = results.reduce((s, r) => s + r.tickMs, 0) / results.length;
  console.log(
    `round ${round}: ${games} games, win ${((wins / games) * 100).toFixed(0)}%, lose ${((losses / games) * 100).toFixed(0)}%, ` +
      `timeout ${((timeouts / games) * 100).toFixed(0)}% | minutes median ${pct(mins, 0.5).toFixed(1)} ` +
      `p10 ${pct(mins, 0.1).toFixed(1)} p90 ${pct(mins, 0.9).toFixed(1)} | mean tick ${tickMs.toFixed(2)} ms`,
  );
}
