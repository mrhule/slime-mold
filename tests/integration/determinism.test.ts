import { describe, expect, it } from 'vitest';
import { think } from '../../src/sim/ai/rival-ai';
import { Rng } from '../../src/sim/rng';
import { assertInvariants, createRound, enqueue, stateHash, step, viewFor } from '../../src/sim';
import type { AiState, Command, World } from '../../src/sim';

/** Play `ticks` ticks with the player driven by the AI (through ordinary commands). */
function playRecorded(seed: number, round: number, ticks: number): { world: World; log: { tick: number; cmd: Command }[] } {
  const world = createRound({ runSeed: seed, roundNumber: round });
  const state: AiState = { aggression: 0.5, debug: [] };
  const rng = new Rng(seed ^ 0x5a5a); // the harness's own stream, not part of the world
  const interval = Math.round(world.difficulty.aiThinkInterval / 0.05);
  for (let t = 0; t < ticks; t++) {
    if (t % interval === 0 && world.molds[0]!.status === 'alive') {
      for (const cmd of think(viewFor(world, 1), state, rng, world.balance.aiCommandsPerThink)) enqueue(world, cmd);
    }
    step(world);
  }
  return { world, log: world.replay.entries };
}

function replay(seed: number, round: number, ticks: number, log: { tick: number; cmd: Command }[]): World {
  const world = createRound({ runSeed: seed, roundNumber: round });
  let next = 0;
  for (let t = 0; t < ticks; t++) {
    while (next < log.length && log[next]!.tick === t) enqueue(world, log[next++]!.cmd);
    step(world);
  }
  return world;
}

describe('determinism with rivals, fog, and combat (SC-006)', () => {
  it('replaying the log from the seed gives the same state hash, across 20 seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const ticks = 1800;
      const { world, log } = playRecorded(seed, 1 + (seed % 3), ticks);
      const again = replay(seed, 1 + (seed % 3), ticks, log);
      expect(stateHash(again), `seed ${seed}`).toBe(stateHash(world));
    }
  }, 120_000);

  it('rival commands are not in the replay log: only the outside orders are', () => {
    const { world, log } = playRecorded(5, 1, 1200);
    expect(world.molds.some((m) => m.ai)).toBe(true);
    for (const e of log) expect(e.cmd.mold).toBe(1);
  });

  it('structural invariants hold throughout a rival round', () => {
    const world = createRound({ runSeed: 9, roundNumber: 2 });
    const state: AiState = { aggression: 0.7, debug: [] };
    const rng = new Rng(77);
    for (let t = 0; t < 3000; t++) {
      if (t % 28 === 0) for (const cmd of think(viewFor(world, 1), state, rng, 3)) enqueue(world, cmd);
      step(world);
      if (t % 100 === 0) assertInvariants(world);
    }
    assertInvariants(world);
  }, 60_000);
});
