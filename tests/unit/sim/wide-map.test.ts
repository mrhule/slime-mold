import { describe, expect, it } from 'vitest';
import { createRound } from '../../../src/sim';

describe('screen-shaped maps', () => {
  it('generate a valid map on a wide screen without falling back', () => {
    for (const roundNumber of [1, 4, 8, 12]) {
      for (let seed = 1; seed <= 6; seed++) {
        const w = createRound({ runSeed: seed * 7919, roundNumber, aspect: 2.1 });
        expect(w.width / w.height, `round ${roundNumber} seed ${seed}`).toBeGreaterThan(1.9);
        expect(w.mapFallback, `fallback round ${roundNumber} seed ${seed}`).toBeFalsy();
      }
    }
  });
});
