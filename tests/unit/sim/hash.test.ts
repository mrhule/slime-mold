import { describe, expect, it } from 'vitest';
import { Hasher, stateHash } from '../../../src/sim/hash';
import { createOpenWorld } from '../../helpers';

describe('Hasher', () => {
  it('is deterministic and order sensitive', () => {
    const a = new Hasher();
    a.num(1);
    a.num(2);
    const b = new Hasher();
    b.num(1);
    b.num(2);
    const c = new Hasher();
    c.num(2);
    c.num(1);
    expect(a.result()).toBe(b.result());
    expect(a.result()).not.toBe(c.result());
  });
});

describe('stateHash', () => {
  it('is equal for identical worlds and changes when state changes', () => {
    const w1 = createOpenWorld(30, 20);
    const w2 = createOpenWorld(30, 20);
    expect(stateHash(w1)).toBe(stateHash(w2));
    w2.food[50] = 1;
    expect(stateHash(w1)).not.toBe(stateHash(w2));
  });
});

describe('stateHash with store houses (003)', () => {
  it('differs when only a store house differs, and replays to the same hash', async () => {
    const { addMold } = await import('../../../src/sim/molds');
    const { placeBuilding } = await import('../../../src/sim/buildings');
    const { step } = await import('../../../src/sim/step');
    const make = (withStore: boolean) => {
      const world = createOpenWorld(40, 30);
      const mold = addMold(world, 'player', 20 * 40 + 10, 200);
      if (withStore) placeBuilding(world, mold.id, 'storehouse', 20 * 40 + 11);
      for (let i = 0; i < 30; i++) step(world);
      return world;
    };
    expect(stateHash(make(true))).not.toBe(stateHash(make(false)));
    expect(stateHash(make(true))).toBe(stateHash(make(true)));
  });
});
