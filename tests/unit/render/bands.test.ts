import { describe, expect, it } from 'vitest';
import { style, veinHalfWidth } from '../../../src/render/style';

const { min, max, ref } = style.veinWidth;

describe('vein width follows traffic', () => {
  it('idle veins are the thinnest and busy ones the thickest', () => {
    expect(veinHalfWidth(0)).toBe(min);
    expect(veinHalfWidth(ref)).toBeCloseTo(max, 6);
    expect(veinHalfWidth(ref * 10)).toBeCloseTo(max, 6);
  });

  it('grows smoothly and never shrinks as conductivity rises', () => {
    let last = veinHalfWidth(0);
    for (let c = 0.05; c <= ref * 1.5; c += 0.05) {
      const w = veinHalfWidth(c);
      expect(w).toBeGreaterThanOrEqual(last);
      expect(w - last).toBeLessThan(0.3); // no visible steps
      last = w;
    }
  });

  it('treats bad input as the thinnest vein', () => {
    expect(veinHalfWidth(Number.NaN)).toBe(min);
    expect(veinHalfWidth(-3)).toBe(min);
  });
});
