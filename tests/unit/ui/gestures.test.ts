import { describe, expect, it } from 'vitest';
import { GestureRecognizer, LONG_PRESS_MS, TAP_MAX_MS } from '../../../src/ui/gestures';
import type { Gesture } from '../../../src/ui/gestures';

function rig(): { g: GestureRecognizer; out: Gesture[] } {
  const out: Gesture[] = [];
  return { g: new GestureRecognizer((x) => out.push(x)), out };
}

describe('gesture recognizer (M2)', () => {
  it('a quick press and release is a tap', () => {
    const { g, out } = rig();
    g.down(1, 50, 60, 0);
    g.up(1, 120);
    expect(out).toEqual([{ kind: 'tap', x: 50, y: 60 }]);
  });

  it('a press that drifts a few pixels is still a tap', () => {
    const { g, out } = rig();
    g.down(1, 50, 60, 0);
    g.move(1, 55, 63);
    g.up(1, 100);
    expect(out.map((o) => o.kind)).toEqual(['tap']);
  });

  it('a slow press is not a tap', () => {
    const { g, out } = rig();
    g.down(1, 0, 0, 0);
    g.up(1, TAP_MAX_MS + 50);
    expect(out).toEqual([]);
  });

  it('a drag pans from the press point and never ends as a tap', () => {
    const { g, out } = rig();
    g.down(1, 100, 100, 0);
    g.move(1, 104, 100); // under the pan threshold: nothing yet
    expect(out).toEqual([]);
    g.move(1, 120, 100);
    g.move(1, 130, 110);
    g.up(1, 200);
    expect(out).toEqual([
      { kind: 'pan', dx: 20, dy: 0 },
      { kind: 'pan', dx: 10, dy: 10 },
    ]);
  });

  it('a drag that returns to where it started still does not tap', () => {
    const { g, out } = rig();
    g.down(1, 100, 100, 0);
    g.move(1, 130, 100);
    g.move(1, 100, 100);
    g.up(1, 150);
    expect(out.every((o) => o.kind === 'pan')).toBe(true);
  });

  it('a held finger becomes one long press, and then does not tap', () => {
    const { g, out } = rig();
    g.down(1, 10, 20, 0);
    g.tick(LONG_PRESS_MS - 1);
    expect(out).toEqual([]);
    g.tick(LONG_PRESS_MS);
    g.tick(LONG_PRESS_MS + 100);
    g.up(1, LONG_PRESS_MS + 120);
    expect(out).toEqual([{ kind: 'longpress', x: 10, y: 20 }]);
  });

  it('a long press is cancelled by moving into a pan', () => {
    const { g, out } = rig();
    g.down(1, 10, 20, 0);
    g.move(1, 60, 20);
    g.tick(LONG_PRESS_MS + 10);
    expect(out.map((o) => o.kind)).toEqual(['pan']);
  });

  it('two fingers pinch about their midpoint, and neither lifting ends as a tap', () => {
    const { g, out } = rig();
    g.down(1, 100, 100, 0);
    g.down(2, 200, 100, 10);
    g.move(2, 300, 100);
    expect(out).toEqual([{ kind: 'pinch', x: 200, y: 100, factor: 2 }]);
    g.up(2, 60);
    g.up(1, 70);
    expect(out.filter((o) => o.kind === 'tap')).toEqual([]);
  });

  it('after a pinch the remaining finger pans on from where it is and does not tap or long-press', () => {
    const { g, out } = rig();
    g.down(1, 100, 100, 0);
    g.down(2, 200, 100, 5);
    g.up(2, 50);
    g.move(1, 112, 100);
    g.tick(5000);
    g.up(1, 6000);
    expect(out).toEqual([{ kind: 'pan', dx: 12, dy: 0 }]);
  });

  it('a third finger changes nothing it should not: no tap, no crash', () => {
    const { g, out } = rig();
    g.down(1, 0, 0, 0);
    g.down(2, 10, 0, 1);
    g.down(3, 20, 0, 2);
    g.up(3, 3);
    g.up(2, 4);
    g.up(1, 5);
    expect(out.filter((o) => o.kind === 'tap')).toEqual([]);
  });

  it('cancel drops everything', () => {
    const { g, out } = rig();
    g.down(1, 0, 0, 0);
    g.cancel();
    g.up(1, 10);
    expect(out).toEqual([]);
    expect(g.active).toBe(false);
  });
});
