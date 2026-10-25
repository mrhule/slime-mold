import { describe, expect, it } from 'vitest';
import { visibleDeaths } from '../../../src/game/frame-events';
import { addMold } from '../../../src/sim/molds';
import type { SimEvent } from '../../../src/sim/types';
import { cellOf, createOpenWorld } from '../../helpers';

function setup() {
  const world = createOpenWorld(60, 30);
  const me = addMold(world, 'player', cellOf(world, 10, 15), 20);
  const rival = addMold(world, 'rival', cellOf(world, 50, 15), 20);
  return { world, me: me.id, rival: rival.id, player: world.molds[0]! };
}

const died = (cell: number, mold: number, by: number): SimEvent => ({ type: 'cellDied', cell, mold, by });

describe('visibleDeaths (A3, FR-005)', () => {
  it('returns a death in view, with own and byEnemy set correctly', () => {
    const { world, me, rival, player } = setup();
    const a = cellOf(world, 20, 15);
    const b = cellOf(world, 21, 15);
    player.vision[a] = 2;
    player.vision[b] = 2;
    const out = visibleDeaths(world, [died(a, me, rival), died(b, rival, me)], me);
    expect(out).toEqual([
      { own: true, byEnemy: true, cell: a, mold: me },
      { own: false, byEnemy: true, cell: b, mold: rival },
    ]);
  });

  it('drops a death in remembered or never-seen fog', () => {
    const { world, me, rival, player } = setup();
    const seen = cellOf(world, 30, 15);
    const unseen = cellOf(world, 31, 15);
    player.vision[seen] = 1; // remembered, not visible now
    player.vision[unseen] = 0;
    expect(visibleDeaths(world, [died(seen, rival, me), died(unseen, rival, me)], me)).toEqual([]);
  });

  it('a death with by === 0 (starvation) is not byEnemy', () => {
    const { world, me, player } = setup();
    const c = cellOf(world, 12, 15);
    player.vision[c] = 2;
    expect(visibleDeaths(world, [died(c, me, 0)], me)).toEqual([{ own: true, byEnemy: false, cell: c, mold: me }]);
  });

  it('ignores other events and writes nothing', () => {
    const { world, me, player } = setup();
    const c = cellOf(world, 12, 15);
    player.vision[c] = 2;
    const before = Array.from(player.vision);
    const events: SimEvent[] = [{ type: 'dropLanded', dropId: 0, foodSourceId: 0 }, { type: 'moldEliminated', mold: 2 }];
    expect(visibleDeaths(world, events, me)).toEqual([]);
    expect(Array.from(player.vision)).toEqual(before);
  });

  it('returns nothing for an unknown player id', () => {
    const { world } = setup();
    expect(visibleDeaths(world, [died(5, 1, 2)], 9)).toEqual([]);
  });
});
