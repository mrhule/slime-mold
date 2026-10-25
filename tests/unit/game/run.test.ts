import { describe, expect, it } from 'vitest';
import { Run } from '../../../src/game/run';
import type { RunStorage } from '../../../src/game/run';
import { createRound } from '../../../src/sim';
import { deriveSeed } from '../../../src/sim/rng';

function makeRun(best = 0, startRound = 1) {
  let seedCounter = 100;
  const saved: number[] = [];
  const storage: RunStorage = { loadBest: () => best, saveBest: (n) => saved.push(n) };
  const created: { seed: number; round: number }[] = [];
  const run = new Run({
    runSeed: 1,
    startRound,
    storage,
    newSeed: () => ++seedCounter,
    createWorld: (seed, round) => {
      created.push({ seed, round });
      return createRound({ runSeed: seed, roundNumber: round });
    },
  });
  return { run, saved, created };
}

describe('Run state machine', () => {
  it('starts on the title with the clock stopped', () => {
    const { run } = makeRun(3);
    expect(run.state).toBe('title');
    expect(run.loopSpeed).toBe(0);
    expect(run.bestRound).toBe(3);
    run.start();
    expect(run.state).toBe('playing');
    expect(run.loopSpeed).toBe(1);
  });

  it('pauses, resumes, and changes speed', () => {
    const { run } = makeRun();
    run.start();
    run.togglePause();
    expect(run.state).toBe('paused');
    expect(run.loopSpeed).toBe(0);
    run.togglePause();
    expect(run.loopSpeed).toBe(1);
    run.setSpeed(3);
    expect(run.loopSpeed).toBe(3);
    run.pause('player');
    run.setSpeed(2); // choosing a speed resumes a player pause
    expect(run.state).toBe('playing');
    expect(run.loopSpeed).toBe(2);
  });

  it('a focus pause can be resumed by Space or by a click', () => {
    const { run } = makeRun();
    run.start();
    run.pause('focus');
    expect(run.pauseReason).toBe('focus');
    run.togglePause();
    expect(run.state).toBe('playing');
    run.pause('focus');
    run.resume();
    expect(run.state).toBe('playing');
  });

  it('the pause menu holds the game until it is closed', () => {
    const { run } = makeRun();
    run.start();
    run.openMenu();
    expect(run.pauseReason).toBe('menu');
    run.togglePause();
    expect(run.state).toBe('paused');
    run.closeMenu();
    expect(run.state).toBe('playing');
  });

  it('victory moves to the next round with a new seed derived from the run; best round is kept', () => {
    const { run, saved, created } = makeRun(0);
    run.start();
    run.finishRound('victory');
    expect(run.state).toBe('roundEnd');
    expect(run.bestRound).toBe(1);
    expect(saved).toEqual([1]);
    run.nextRound();
    expect(run.state).toBe('playing');
    expect(run.roundNumber).toBe(2);
    expect(created[created.length - 1]).toEqual({ seed: 1, round: 2 });
    expect(run.world.seed).toBe(deriveSeed(1, 2));
    expect(run.world.roundNumber).toBe(2);
    expect(run.worldVersion).toBe(1);
  });

  it('does not lower the best round', () => {
    const { run, saved } = makeRun(5);
    run.start();
    run.finishRound('victory');
    expect(run.bestRound).toBe(5);
    expect(saved).toEqual([]);
  });

  it('defeat ends the run and the next run starts at round 1 with a new seed', () => {
    const { run, created } = makeRun(0, 1);
    run.start();
    run.finishRound('victory');
    run.nextRound();
    run.finishRound('defeat');
    expect(run.outcome).toBe('defeat');
    run.nextRound(); // not allowed after a defeat
    expect(run.roundNumber).toBe(2);
    run.newRun();
    expect(run.roundNumber).toBe(1);
    expect(run.state).toBe('playing');
    expect(created[created.length - 1]!.seed).not.toBe(1);
    expect(run.bestRound).toBe(1);
  });

  it('nothing carries over between rounds: a fresh world each time', () => {
    const { run } = makeRun();
    run.start();
    const first = run.world;
    run.finishRound('victory');
    run.nextRound();
    expect(run.world).not.toBe(first);
    expect(run.world.tick).toBe(0);
    expect(run.world.molds[0]!.stats.cellsBuilt).toBeLessThan(10);
  });

  it('quit to title builds a fresh round 1 behind the title', () => {
    const { run } = makeRun();
    run.start();
    run.quitToTitle();
    expect(run.state).toBe('title');
    expect(run.roundNumber).toBe(1);
    expect(run.loopSpeed).toBe(0);
  });

  it('honours a starting round override', () => {
    const { run, created } = makeRun(0, 5);
    expect(run.roundNumber).toBe(5);
    expect(created[0]).toEqual({ seed: 1, round: 5 });
  });
});
