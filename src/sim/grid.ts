/**
 * Grid helpers. Cells are indexed y * width + x. Directions 0..7 go
 * E, SE, S, SW, W, NW, N, NE; k and (k + 4) & 7 are opposites. Each vein edge is stored once,
 * in the "forward" directions 0..3 (E, SE, S, SW) of the cell that owns the slot.
 */

export const DX = [1, 1, 0, -1, -1, -1, 0, 1] as const;
export const DY = [0, 1, 1, 1, 0, -1, -1, -1] as const;
export const SQRT2 = 1.4142135623730951;

export const cellX = (w: number, i: number): number => i % w;
export const cellY = (w: number, i: number): number => Math.floor(i / w);
export const cellAt = (w: number, x: number, y: number): number => y * w + x;
export const opposite = (k: number): number => (k + 4) & 7;
export const isDiagonal = (k: number): boolean => (k & 1) === 1;

/** neighbor of cell i in direction k, or -1 if it is off the grid */
export function neighbor(w: number, h: number, i: number, k: number): number {
  const x = (i % w) + (DX[k] as number);
  const y = Math.floor(i / w) + (DY[k] as number);
  if (x < 0 || y < 0 || x >= w || y >= h) return -1;
  return y * w + x;
}

/** direction from cell a to adjacent cell b, or -1 if they are not 8-adjacent */
export function dirBetween(w: number, a: number, b: number): number {
  const dx = (b % w) - (a % w);
  const dy = Math.floor(b / w) - Math.floor(a / w);
  if (dx < -1 || dx > 1 || dy < -1 || dy > 1 || (dx === 0 && dy === 0)) return -1;
  for (let k = 0; k < 8; k++) if (DX[k] === dx && DY[k] === dy) return k;
  return -1;
}

/** index into the 4-per-cell edge arrays for the edge leaving cell i in direction k */
export function edgeSlot(w: number, i: number, k: number): number {
  if (k < 4) return i * 4 + k;
  const n = i + (DY[k] as number) * w + (DX[k] as number);
  return n * 4 + (k - 4);
}

/** octile distance between two cells, in step units (diagonal = sqrt 2) */
export function octile(w: number, a: number, b: number): number {
  const dx = Math.abs((a % w) - (b % w));
  const dy = Math.abs(Math.floor(a / w) - Math.floor(b / w));
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}

export function popcount8(v: number): number {
  let n = 0;
  for (let b = v & 0xff; b; b &= b - 1) n++;
  return n;
}
