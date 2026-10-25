import { describe, expect, it } from 'vitest';
import { createRound, enqueue, step } from '../../../src/sim';
import { applyCommand, pendingAllocation } from '../../../src/sim/commands';
import { createWorldWithMold } from '../../helpers';

describe('commands', () => {
  it('are queued and only applied on the next tick, in order', () => {
    const { world, mold } = createWorldWithMold();
    enqueue(world, { type: 'setAllocation', mold: mold.id, value: 0.9 });
    enqueue(world, { type: 'setAllocation', mold: mold.id, value: 0.1 });
    expect(mold.allocation).toBe(world.balance.defaultAllocation);
    step(world);
    expect(mold.allocation).toBeCloseTo(0.1);
  });

  it('are recorded in the replay log with the tick they ran on', () => {
    const { world, mold } = createWorldWithMold();
    step(world);
    step(world);
    enqueue(world, { type: 'setAllocation', mold: mold.id, value: 0.5 });
    step(world);
    expect(world.replay.entries).toEqual([{ tick: 2, cmd: { type: 'setAllocation', mold: mold.id, value: 0.5 } }]);
  });

  it('pendingAllocation reflects queued orders, so repeated nudges add up', () => {
    const { world, mold } = createWorldWithMold();
    expect(pendingAllocation(world, mold.id)).toBeCloseTo(0.3);
    enqueue(world, { type: 'setAllocation', mold: mold.id, value: 0.4 });
    enqueue(world, { type: 'setAllocation', mold: mold.id, value: 0.53 });
    expect(pendingAllocation(world, mold.id)).toBeCloseTo(0.55);
    step(world);
    expect(pendingAllocation(world, mold.id)).toBeCloseTo(0.55);
  });

  it('are rejected for unknown or eliminated molds', () => {
    const { world, mold } = createWorldWithMold();
    applyCommand(world, { type: 'setAllocation', mold: 9, value: 0.5 });
    expect(world.events).toContainEqual({ type: 'commandRejected', mold: 9, reason: 'unknown-mold' });
    mold.status = 'eliminated';
    applyCommand(world, { type: 'clearTargets', mold: mold.id });
    expect(world.events).toContainEqual({ type: 'commandRejected', mold: mold.id, reason: 'mold-eliminated' });
  });

  it('report where a rejected target click landed', () => {
    const { world, mold } = createWorldWithMold();
    applyCommand(world, { type: 'setTarget', mold: mold.id, cell: mold.core });
    expect(world.events).toContainEqual({ type: 'commandRejected', mold: mold.id, reason: 'already-owned', cell: mold.core });
  });

  it('replaying the log on a fresh round reproduces the state hash', async () => {
    const { stateHash } = await import('../../../src/sim');
    const a = createRound({ runSeed: 3, roundNumber: 1 });
    const food = a.foodSources[0]!;
    enqueue(a, { type: 'setTarget', mold: 1, cell: food.y * a.width + food.x });
    for (let t = 0; t < 300; t++) step(a);
    const b = createRound({ runSeed: 3, roundNumber: 1 });
    let next = 0;
    for (let t = 0; t < 300; t++) {
      while (next < a.replay.entries.length && a.replay.entries[next]!.tick === t) enqueue(b, a.replay.entries[next++]!.cmd);
      step(b);
    }
    expect(stateHash(b)).toBe(stateHash(a));
  });
});
