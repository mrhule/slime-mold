/**
 * The look in one table (FR-018): one light, hard width bands, line weights, shadow offsets, pulse
 * thresholds, shake and splat limits, and what each quality level turns off. Render code reads these
 * numbers instead of keeping its own. Values are first guesses, tuned by eye.
 */
export const style = {
  /** unit vector pointing toward the light (upper left) */
  light: { x: -0.6, y: -0.8 },
  /** vein half-widths by band, and the conductivity thresholds (with hysteresis) between bands */
  veinBands: { halfWidth: [1.2, 2.2, 3.4], up: [1.2, 3.0], down: [0.9, 2.4] },
  /** outline padding on the lit and shadow sides of a vein; shifted second stroke for Graphics outlines */
  outline: { padLit: 1.0, padShade: 2.4, strokeShift: [1.0, 1.2] },
  shadow: { veinOffset: [2.5, 3.5], veinAlpha: 0.35, groundOffset: [3, 4], groundAlpha: 0.3 },
  pulse: { minFlow: 0.05, lightFlow: 0.5, heavyFlow: 2.0, speed: 1.6 },
  shake: { max: 6, k: 1.2, decaySeconds: 0.25 },
  splats: { maxPerFrame: 12, lifeSeconds: 0.5 },
  /** the auto quality governor: drop after dropSeconds under dropFps, rise after raiseSeconds over raiseFps */
  governor: { dropFps: 45, dropSeconds: 3, raiseFps: 58, raiseSeconds: 20 },
  quality: {
    high: { veinShadow: true, pulses: true, printFilter: true, splatScale: 1 },
    low: { veinShadow: false, pulses: false, printFilter: false, splatScale: 0.5 },
  },
} as const;

export type QualityLevel = keyof typeof style.quality;

/**
 * Which side of an edge faces the light: 1 when the edge normal (nx, ny) points toward it, else -1.
 * The vein layer multiplies an edge's cross-axis coordinate by this so the lit side is always the
 * same side in the world, whatever direction the edge was drawn in (A8).
 */
export function litSide(nx: number, ny: number): 1 | -1 {
  return nx * style.light.x + ny * style.light.y > 0 ? 1 : -1;
}

/** cross-axis coordinate for a round joint: -1 on the lit side, +1 on the shadow side (A8) */
export function jointU(dx: number, dy: number): number {
  return -(dx * style.light.x + dy * style.light.y);
}

/**
 * The width band of a vein edge from its conductivity (A10): 0 thin, 1 medium, 2 thick. The up and
 * down thresholds differ, so a value hovering at a threshold keeps its previous band instead of
 * flickering; `previous` is that band from the last rebuild.
 */
export function bandOf(conductivity: number, previous: 0 | 1 | 2): 0 | 1 | 2 {
  const { up, down } = style.veinBands;
  if (previous === 0) return conductivity >= up[1] ? 2 : conductivity >= up[0] ? 1 : 0;
  if (previous === 1) return conductivity >= up[1] ? 2 : conductivity < down[0] ? 0 : 1;
  return conductivity < down[0] ? 0 : conductivity < down[1] ? 1 : 2;
}

/**
 * How many pulses travel along each cell of an edge carrying `flow` (use |flow|): none under
 * minFlow, one for light flow, two from heavyFlow up (A11). Bad input (NaN, negative) gives none.
 */
export function pulseCount(flow: number): 0 | 1 | 2 {
  if (!(flow >= style.pulse.minFlow)) return 0;
  return flow >= style.pulse.heavyFlow ? 2 : 1;
}
