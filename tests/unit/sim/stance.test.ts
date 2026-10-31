import { describe, expect, it } from 'vitest';
import { enqueue, step } from '../../../src/sim';
import { stanceAttack, stanceTaken } from '../../../src/sim/combat';
import { addMold } from '../../../src/sim/molds';
import { assertInvariants } from '../../../src/sim/world';
import { defaultBalance } from '../../../src/config/balance';
import { cellOf, createOpenWorld } from '../../helpers';

describe('the slider changes how a mold fights', () => {
  it('reads 1 at the default setting, and weakens toward Growth and strengthens toward War', () => {
    const world = createOpenWorld();
    const d = world.balance.defaultAllocation;
    expect(stanceAttack(world, d)).toBeCloseTo(1, 1);
    expect(stanceTaken(world, d)).toBeCloseTo(1, 1);
    expect(stanceAttack(world, 0)).toBeLessThan(stanceAttack(world, 0.5));
    expect(stanceAttack(world, 0.5)).toBeLessThan(stanceAttack(world, 1));
    expect(stanceTaken(world, 0)).toBeGreaterThan(stanceTaken(world, 0.5));
    expect(stanceTaken(world, 0.5)).toBeGreaterThan(stanceTaken(world, 1));
  });

  it('a mold near Growth loses a fight to one near War even when both pour everything into it', () => {
    // with no growth targets left, each side hands its whole budget to the front, so only the stance differs
    const run = (leftAlloc: number, rightAlloc: number, balance = defaultBalance): { left: number; right: number } => {
      const world = createOpenWorld(60, 30, balance);
      const left = addMold(world, 'player', cellOf(world, 20, 15), 300);
      const right = addMold(world, 'player', cellOf(world, 40, 15), 300);
      enqueue(world, { type: 'setTarget', mold: left.id, cell: cellOf(world, 40, 15) });
      enqueue(world, { type: 'setTarget', mold: right.id, cell: cellOf(world, 20, 15) });
      for (let t = 0; t < 900; t++) step(world);
      enqueue(world, { type: 'clearTargets', mold: left.id });
      enqueue(world, { type: 'clearTargets', mold: right.id });
      enqueue(world, { type: 'setAllocation', mold: left.id, value: leftAlloc });
      enqueue(world, { type: 'setAllocation', mold: right.id, value: rightAlloc });
      for (let t = 0; t < 1200; t++) {
        step(world);
        for (const c of world.components.values()) c.pool = Math.max(c.pool, 200);
      }
      assertInvariants(world);
      return { left: left.cellCount, right: right.cellCount };
    };
    const a = run(0.2, 0.8);
    expect(a.right).toBeGreaterThan(a.left);
    const b = run(0.8, 0.2);
    expect(b.left).toBeGreaterThan(b.right);
    // the stance is what decides it: with it switched off the same duel is far closer
    const flat = run(0.2, 0.8, { ...defaultBalance, stance: { attackAtGrowth: 1, attackAtWar: 1, takenAtGrowth: 1, takenAtWar: 1 } });
    expect(Math.abs(flat.right - flat.left)).toBeLessThan(Math.abs(a.right - a.left));
  });
});
