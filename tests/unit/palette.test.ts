import { describe, expect, it } from 'vitest';
import { MOLD_COLORS, PATTERN_COUNT, moldColor, moldPattern } from '../../src/render/palette';

describe('mold identity (FR-033)', () => {
  it('gives each of the six possible molds its own color and its own pattern', () => {
    const molds = [0, 1, 2, 3, 4, 5];
    expect(new Set(molds.map(moldColor)).size).toBe(6);
    expect(new Set(molds.map(moldPattern)).size).toBe(6);
    expect(PATTERN_COUNT).toBeGreaterThanOrEqual(MOLD_COLORS.length);
  });

  it('patterns fit in the three low bits of the film texture', () => {
    expect(PATTERN_COUNT).toBeLessThanOrEqual(8);
  });
});
