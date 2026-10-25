import { describe, expect, it } from 'vitest';
import { dirBetween, edgeSlot, neighbor, octile, opposite, popcount8, SQRT2 } from '../../../src/sim/grid';

const W = 10;
const H = 8;

describe('grid', () => {
  it('neighbors respect bounds', () => {
    expect(neighbor(W, H, 0, 4)).toBe(-1); // W of left edge
    expect(neighbor(W, H, 0, 6)).toBe(-1); // N of top edge
    expect(neighbor(W, H, 0, 0)).toBe(1);
    expect(neighbor(W, H, 0, 1)).toBe(W + 1);
    expect(neighbor(W, H, W * H - 1, 0)).toBe(-1);
  });

  it('dirBetween inverts neighbor', () => {
    const c = 3 * W + 4;
    for (let k = 0; k < 8; k++) {
      const n = neighbor(W, H, c, k);
      expect(dirBetween(W, c, n)).toBe(k);
      expect(dirBetween(W, n, c)).toBe(opposite(k));
    }
    expect(dirBetween(W, c, c)).toBe(-1);
    expect(dirBetween(W, c, c + 2)).toBe(-1);
  });

  it('stores each edge in exactly one slot', () => {
    const c = 3 * W + 4;
    for (let k = 0; k < 8; k++) {
      const n = neighbor(W, H, c, k);
      expect(edgeSlot(W, c, k)).toBe(edgeSlot(W, n, opposite(k)));
    }
  });

  it('octile distance', () => {
    expect(octile(W, 0, 3)).toBe(3);
    expect(octile(W, 0, 2 * W + 2)).toBeCloseTo(2 * SQRT2);
    expect(octile(W, 0, W + 3)).toBeCloseTo(2 + SQRT2);
  });

  it('popcount8', () => {
    expect(popcount8(0)).toBe(0);
    expect(popcount8(0b10110001)).toBe(4);
  });
});
