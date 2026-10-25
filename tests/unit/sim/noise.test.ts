import { describe, expect, it } from 'vitest';
import { fbm2, hash2, valueNoise } from '../../../src/sim/noise';

describe('noise', () => {
  it('hash2 is deterministic and in [0, 1)', () => {
    expect(hash2(3, 9, 5)).toBe(hash2(3, 9, 5));
    for (let i = 0; i < 200; i++) {
      const v = hash2(i, i * 7, 11);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('valueNoise is continuous and bounded', () => {
    let prev = valueNoise(0, 2.3, 1);
    for (let x = 0.05; x < 10; x += 0.05) {
      const v = valueNoise(x, 2.3, 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(Math.abs(v - prev)).toBeLessThan(0.2);
      prev = v;
    }
  });

  it('fbm2 is reproducible per seed and differs between seeds', () => {
    expect(fbm2(10.5, 20.5, 3)).toBe(fbm2(10.5, 20.5, 3));
    expect(fbm2(10.5, 20.5, 3)).not.toBe(fbm2(10.5, 20.5, 4));
  });
});
