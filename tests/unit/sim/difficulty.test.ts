import { describe, expect, it } from 'vitest';
import { difficultyFor } from '../../../src/sim';
import type { DifficultyProfile } from '../../../src/sim/types';

describe('difficultyFor (R14)', () => {
  it('matches the table at rounds 1, 5, and 10', () => {
    const r1 = difficultyFor(1);
    expect(r1).toMatchObject({ rivalCount: 1, mapWidth: 160, mapHeight: 120, foodDensity: 1, aiThinkInterval: 3, dropInterval: 35 });
    expect(r1.rivalAggression).toBeCloseTo(0.2);
    expect(r1.rivalStartNutrients).toBeCloseTo(1);

    const r5 = difficultyFor(5);
    expect(r5.rivalCount).toBe(3);
    expect(r5.mapWidth).toBe(211);
    expect(r5.mapHeight).toBe(158);
    expect(r5.foodDensity).toBeCloseTo(0.8);
    expect(r5.rivalAggression).toBeCloseTo(0.52);
    expect(r5.rivalStartNutrients).toBeCloseTo(1.4);
    expect(r5.aiThinkInterval).toBeCloseTo(2);

    const r10 = difficultyFor(10);
    expect(r10.rivalCount).toBe(5);
    expect(r10.mapWidth).toBe(275);
    expect(r10.mapHeight).toBe(206);
    expect(r10.foodDensity).toBeCloseTo(0.55);
    expect(r10.rivalAggression).toBeCloseTo(0.9);
    expect(r10.rivalStartNutrients).toBeCloseTo(1.9);
    expect(r10.aiThinkInterval).toBeCloseTo(0.8);
  });

  it('reaches the caps', () => {
    const late = difficultyFor(40);
    expect(late.rivalCount).toBe(5);
    expect(late.mapWidth).toBe(320);
    expect(late.mapHeight).toBe(240);
    expect(late.foodDensity).toBe(0.5);
    expect(late.rivalAggression).toBe(0.9);
    expect(late.aiThinkInterval).toBe(0.8);
  });

  it('every round is at least as hard in every field and strictly harder in at least one (rounds 1 to 50)', () => {
    // "harder" means: more rivals, bigger map, less food, more aggression, richer rivals, faster thinking
    const harder: Record<keyof DifficultyProfile, 1 | -1 | 0> = {
      rivalCount: 1,
      mapWidth: 1,
      mapHeight: 1,
      foodDensity: -1,
      rivalAggression: 1,
      rivalStartNutrients: 1,
      aiThinkInterval: -1,
      dropInterval: 0,
    };
    for (let n = 1; n < 50; n++) {
      const a = difficultyFor(n);
      const b = difficultyFor(n + 1);
      let strictly = false;
      for (const key of Object.keys(harder) as (keyof DifficultyProfile)[]) {
        const delta = (b[key] - a[key]) * harder[key];
        if (harder[key] === 0) expect(b[key], `${key} round ${n + 1}`).toBe(a[key]);
        else expect(delta, `${key} round ${n} to ${n + 1}`).toBeGreaterThanOrEqual(-1e-9);
        if (delta > 1e-9) strictly = true;
      }
      expect(strictly, `round ${n} to ${n + 1} is strictly harder somewhere`).toBe(true);
    }
  });

  it('treats a non-positive or fractional round as round 1 or the floor', () => {
    expect(difficultyFor(0)).toEqual(difficultyFor(1));
    expect(difficultyFor(3.9)).toEqual(difficultyFor(3));
  });
});
