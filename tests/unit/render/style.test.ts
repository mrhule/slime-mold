import { describe, expect, it } from 'vitest';
import { jointU, litSide, style } from '../../../src/render/style';

/** the offset (from the edge centre line) where the lit, u < 0 side ends up for an edge going in direction (dx, dy) */
function litOffset(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const s = litSide(nx, ny);
  // the vein layer gives the +normal vertex u = -s, so the lit (u < 0) side is s * normal
  return [s * nx, s * ny];
}

describe('one light (FR-017, A8)', () => {
  it('the light direction is a unit vector pointing up and left', () => {
    const { x, y } = style.light;
    expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
  });

  it('litSide is 1 for normals facing up-left and -1 facing down-right', () => {
    expect(litSide(-1, -1)).toBe(1);
    expect(litSide(-0.2, -0.9)).toBe(1);
    expect(litSide(1, 1)).toBe(-1);
    expect(litSide(0.5, 0.4)).toBe(-1);
  });

  it('flipping an edge direction keeps the lit side in the same world position', () => {
    for (let a = 0; a < 360; a += 15) {
      const rad = (a * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      const [ax, ay] = litOffset(dx, dy);
      const [bx, by] = litOffset(-dx, -dy);
      const dot = ax * style.light.x + ay * style.light.y;
      if (Math.abs(dot) < 1e-9) continue; // an edge exactly side-on to the light has no lit side
      expect(bx, `direction ${a} degrees`).toBeCloseTo(ax, 9);
      expect(by, `direction ${a} degrees`).toBeCloseTo(ay, 9);
      // and that side really faces the light
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('jointU is -1 toward the light, +1 away, antisymmetric, and zero across it', () => {
    expect(jointU(style.light.x, style.light.y)).toBeCloseTo(-1, 9);
    expect(jointU(-style.light.x, -style.light.y)).toBeCloseTo(1, 9);
    for (const [dx, dy] of [[1, 0], [0, 1], [0.7, -0.7], [-0.3, 0.9]] as const) {
      expect(jointU(dx, dy)).toBeCloseTo(-jointU(-dx, -dy), 9);
    }
    // perpendicular to the light
    expect(jointU(-style.light.y, style.light.x)).toBeCloseTo(0, 9);
  });
});
