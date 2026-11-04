import { describe, expect, it } from 'vitest';
import { scanFronts } from '../../../src/sim/combat';
import { applyCommand } from '../../../src/sim/commands';
import { FRONT_SWING_CELLS, spendNutrients } from '../../../src/sim/coop';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import type { World } from '../../../src/sim/types';
import { cellOf, createOpenWorld } from '../../helpers';

function setup(): { world: World; me: number; rival: number } {
  const world = createOpenWorld(60, 40);
  const me = addMold(world, 'player', cellOf(world, 8, 20), 100);
  const rival = addMold(world, 'rival', cellOf(world, 50, 20), 100);
  // two facing walls of loose cells, one column apart
  for (let y = 10; y < 30; y++) {
    addCell(world, me.id, cellOf(world, 25, y), -1);
    addCell(world, rival.id, cellOf(world, 26, y), -1);
  }
  scanFronts(world);
  return { world, me: me.id, rival: rival.id };
}

const total = (world: World, id: number): number => [...world.components.values()].filter((c) => c.moldId === id).reduce((s, c) => s + c.pool, 0);

const count = (world: World, id: number): number => world.owner.filter((o) => o === id).length;

describe('co-op spending', () => {
  it('takes exactly what was asked, from every piece in proportion', () => {
    const { world, me } = setup();
    const before = total(world, me);
    expect(spendNutrients(world, me, 30, false)).toBe(30);
    expect(total(world, me)).toBeCloseTo(before - 30);
  });

  it('refuses an unaffordable purchase and leaves the stock alone', () => {
    const { world, me } = setup();
    const before = total(world, me);
    applyCommand(world, { type: 'spend', mold: me, amount: before + 50 });
    expect(total(world, me)).toBeCloseTo(before);
    expect(world.events.some((e) => e.type === 'commandRejected' && e.reason === 'cant-afford')).toBe(true);
  });

  it('a partial spend (an open front draining) takes what there is', () => {
    const { world, me } = setup();
    const before = total(world, me);
    expect(spendNutrients(world, me, before + 50, true)).toBeCloseTo(before);
    expect(total(world, me)).toBeCloseTo(0);
  });
});

describe('front results', () => {
  it('a win withers the rival cells that touch us and spares ours', () => {
    const { world, me, rival } = setup();
    const [mine, theirs] = [count(world, me), count(world, rival)];
    applyCommand(world, { type: 'frontResult', mold: me, rival, outcome: 'won' });
    expect(count(world, rival)).toBe(theirs - FRONT_SWING_CELLS);
    expect(count(world, me)).toBe(mine);
  });

  it('a loss makes our line recede', () => {
    const { world, me, rival } = setup();
    const [mine, theirs] = [count(world, me), count(world, rival)];
    applyCommand(world, { type: 'frontResult', mold: me, rival, outcome: 'lost' });
    expect(count(world, me)).toBe(mine - FRONT_SWING_CELLS);
    expect(count(world, rival)).toBe(theirs);
  });
});
