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
