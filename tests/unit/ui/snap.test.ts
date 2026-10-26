import { describe, expect, it } from 'vitest';
import { canPlace, createRound, enqueue, step } from '../../../src/sim';
import type { World } from '../../../src/sim';
import { snapPlacement, snapRadius } from '../../../src/ui/snap';

function grown(): World {
  const world = createRound({ runSeed: 31, roundNumber: 2 });
  const core = world.molds[0]!.core;
  enqueue(world, { type: 'setTarget', mold: 1, cell: core + 12 });
  enqueue(world, { type: 'setTarget', mold: 1, cell: core - 12 * world.width });
  for (let i = 0; i < 300; i++) step(world);
  for (const comp of world.components.values()) comp.pool = 250; // so cost never decides what is allowed
  return world;
}

/** an empty cell that is not your vein, a few cells from a valid spot, if there is one */
function awayFromVein(world: World, valid: number, gap: number): number | null {
  const w = world.width;
  for (const [dx, dy] of [[gap, 0], [-gap, 0], [0, gap], [0, -gap]] as const) {
    const c = valid + dy * w + dx;
    if (c >= 0 && c < w * world.height && world.owner[c] !== 1) return c;
  }
  return null;
}

describe('placement snapping', () => {
  it('keeps a cell that is already allowed', () => {
    const world = grown();
    const valid = [...Array(world.width * world.height).keys()].find((c) => canPlace(world, 1, 'booster', c).ok);
    expect(valid).toBeDefined();
    expect(snapPlacement(world, 1, 'booster', valid!, 5)).toBe(valid);
  });

  it('moves a tap that missed the vein onto the nearest allowed cell', () => {
    const world = grown();
    const valid = [...Array(world.width * world.height).keys()].filter((c) => canPlace(world, 1, 'booster', c).ok);
    let checked = 0;
    for (const v of valid) {
      const miss = awayFromVein(world, v, 2);
      if (miss === null) continue;
      const snapped = snapPlacement(world, 1, 'booster', miss, 5);
      expect(canPlace(world, 1, 'booster', snapped).ok).toBe(true);
      const w = world.width;
      const d = Math.hypot((snapped % w) - (miss % w), Math.floor(snapped / w) - Math.floor(miss / w));
      expect(d).toBeLessThanOrEqual(5);
      if (++checked >= 5) break;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('returns the tapped cell when nothing is in range', () => {
    const world = grown();
    const far = world.width * world.height - 1;
    expect(snapPlacement(world, 1, 'booster', far, 3)).toBe(far);
  });

  it('never returns a cell the mold does not own unless nothing is in range', () => {
    const world = grown();
    const core = world.molds[0]!.core;
    const snapped = snapPlacement(world, 1, 'booster', core + 3 * world.width + 3, 6);
    expect(world.owner[snapped] === 1 || snapped === core + 3 * world.width + 3).toBe(true);
  });

  it('looks about 36 screen pixels around, within 2 to 8 cells', () => {
    expect(snapRadius(100)).toBe(2);
    expect(snapRadius(12)).toBe(3);
    expect(snapRadius(2)).toBe(8);
    expect(snapRadius(0)).toBe(8);
  });
});
