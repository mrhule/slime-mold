import { describe, expect, it } from 'vitest';
import { pulseCount, style } from '../../../src/render/style';

describe('flow pulses (A11)', () => {
  it('is 0 below minFlow, 1 for light flow, 2 for heavy flow', () => {
    expect(pulseCount(0)).toBe(0);
    expect(pulseCount(style.pulse.minFlow * 0.5)).toBe(0);
    expect(pulseCount(style.pulse.minFlow)).toBe(1);
    expect(pulseCount(style.pulse.lightFlow)).toBe(1);
    expect(pulseCount(style.pulse.heavyFlow - 0.01)).toBe(1);
    expect(pulseCount(style.pulse.heavyFlow)).toBe(2);
    expect(pulseCount(1000)).toBe(2);
  });

  it('is monotonic in the flow', () => {
    let last = 0;
    for (let f = 0; f < 5; f += 0.01) {
      const n = pulseCount(f);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });

  it('is 0 for NaN, negative zero, infinities of the wrong kind and negative flow', () => {
    expect(pulseCount(NaN)).toBe(0);
    expect(pulseCount(-0)).toBe(0);
    expect(pulseCount(-5)).toBe(0); // callers pass |flow|
    expect(pulseCount(-Infinity)).toBe(0);
  });
});
