/**
 * Turns raw pointer events into the touch gestures the game uses (M2). Pure: time is passed in, so
 * every threshold tests without a DOM. Coordinates are screen pixels.
 */
export type Gesture =
  | { kind: 'tap'; x: number; y: number }
  | { kind: 'longpress'; x: number; y: number }
  | { kind: 'pan'; dx: number; dy: number }
  | { kind: 'pinch'; x: number; y: number; factor: number };

export const TAP_SLOP_PX = 10;
export const TAP_MAX_MS = 350;
export const PAN_START_PX = 8;
export const LONG_PRESS_MS = 500;

interface Finger {
  x: number;
  y: number;
  startX: number;
  startY: number;
  startT: number;
}

export class GestureRecognizer {
  private readonly fingers = new Map<number, Finger>();
  /** this touch sequence moved the map (or had two fingers), so it can no longer be a tap or a long press */
  private moved = false;
  private longFired = false;
  private pinchDist = 0;

  constructor(private readonly emit: (g: Gesture) => void) {}

  get active(): boolean {
    return this.fingers.size > 0;
  }

  down(id: number, x: number, y: number, t: number): void {
    this.fingers.set(id, { x, y, startX: x, startY: y, startT: t });
    if (this.fingers.size === 1) {
      this.moved = false;
      this.longFired = false;
    } else {
      this.moved = true; // a second finger ends any tap or long press
      this.pinchDist = this.spread();
    }
  }

  move(id: number, x: number, y: number): void {
    const f = this.fingers.get(id);
    if (!f) return;
    const dx = x - f.x;
    const dy = y - f.y;
    f.x = x;
    f.y = y;
    if (this.fingers.size >= 2) {
      this.pinch();
      return;
    }
    if (!this.moved && Math.hypot(x - f.startX, y - f.startY) < PAN_START_PX) return;
    if (!this.moved) {
      // the pan starts from the press point so the map does not jump
      this.moved = true;
      this.emit({ kind: 'pan', dx: x - f.startX, dy: y - f.startY });
      return;
    }
    if (dx !== 0 || dy !== 0) this.emit({ kind: 'pan', dx, dy });
  }

  up(id: number, t: number): void {
    const f = this.fingers.get(id);
    if (!f) return;
    const lone = this.fingers.size === 1;
    this.fingers.delete(id);
    if (this.fingers.size === 1) {
      // back to one finger after a pinch: it pans on from here but never taps
      const rest = [...this.fingers.values()][0] as Finger;
      rest.startX = rest.x;
      rest.startY = rest.y;
      return;
    }
    if (!lone || this.moved || this.longFired) return;
    if (t - f.startT <= TAP_MAX_MS && Math.hypot(f.x - f.startX, f.y - f.startY) <= TAP_SLOP_PX) {
      this.emit({ kind: 'tap', x: f.x, y: f.y });
    }
  }

  cancel(): void {
    this.fingers.clear();
    this.moved = false;
    this.longFired = false;
  }

  /** call each frame (or on a timer) so a held finger becomes a long press */
  tick(t: number): void {
    if (this.fingers.size !== 1 || this.moved || this.longFired) return;
    const f = [...this.fingers.values()][0] as Finger;
    if (t - f.startT >= LONG_PRESS_MS && Math.hypot(f.x - f.startX, f.y - f.startY) < TAP_SLOP_PX) {
      this.longFired = true;
      this.emit({ kind: 'longpress', x: f.x, y: f.y });
    }
  }

  private spread(): number {
    const [a, b] = [...this.fingers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private pinch(): void {
    const [a, b] = [...this.fingers.values()];
    if (!a || !b) return;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (this.pinchDist > 0 && dist > 0 && dist !== this.pinchDist) {
      this.emit({ kind: 'pinch', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, factor: dist / this.pinchDist });
    }
    this.pinchDist = dist;
  }
}
