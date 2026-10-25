import { describe, expect, it } from 'vitest';
import { bandOf, style } from '../../../src/render/style';

const { up, down } = style.veinBands;

describe('vein width bands (A10)', () => {
  it('maps conductivity to thin, medium and thick at the thresholds', () => {
    expect(bandOf(0, 0)).toBe(0);
    expect(bandOf(up[0] - 0.01, 0)).toBe(0);
    expect(bandOf(up[0], 0)).toBe(1);
    expect(bandOf(up[1] - 0.01, 0)).toBe(1);
    expect(bandOf(up[1], 0)).toBe(2);
    expect(bandOf(50, 0)).toBe(2);
  });

  it('a value hovering between down and up keeps the previous band', () => {
    const mid = (down[0] + up[0]) / 2;
    expect(bandOf(mid, 0)).toBe(0);
    expect(bandOf(mid, 1)).toBe(1);
    const high = (down[1] + up[1]) / 2;
    expect(bandOf(high, 1)).toBe(1);
    expect(bandOf(high, 2)).toBe(2);
  });

  it('sweeping up then down changes bands at different thresholds', () => {
    const upAt: number[] = [];
    const downAt: number[] = [];
    let band: 0 | 1 | 2 = 0;
    for (let c = 0; c <= 4; c += 0.01) {
      const next = bandOf(c, band);
      if (next !== band) upAt.push(c);
      band = next;
    }
    expect(band).toBe(2);
    for (let c = 4; c >= 0; c -= 0.01) {
      const next = bandOf(c, band);
      if (next !== band) downAt.push(c);
      band = next;
    }
    expect(band).toBe(0);
    expect(upAt).toHaveLength(2);
    expect(downAt).toHaveLength(2);
    expect(upAt[0]!).toBeCloseTo(up[0], 1);
    expect(upAt[1]!).toBeCloseTo(up[1], 1);
    expect(downAt[0]!).toBeCloseTo(down[1], 1); // thick falls to medium first
    expect(downAt[1]!).toBeCloseTo(down[0], 1);
    expect(downAt[0]!).toBeLessThan(upAt[1]!);
    expect(downAt[1]!).toBeLessThan(upAt[0]!);
  });

  it('never flickers: a noisy value around a threshold changes band at most once per crossing of the dead zone', () => {
    let band: 0 | 1 | 2 = 0;
    let changes = 0;
    for (let i = 0; i < 1000; i++) {
      const c = (up[0] + down[0]) / 2 + Math.sin(i) * 0.1; // wobbles inside the dead zone
      const next = bandOf(c, band);
      if (next !== band) changes++;
      band = next;
    }
    expect(changes).toBe(0);
  });

  it('half-widths grow with the band', () => {
    const [a, b, c] = style.veinBands.halfWidth;
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});
