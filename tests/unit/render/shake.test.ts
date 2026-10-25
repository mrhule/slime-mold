import { describe, expect, it } from 'vitest';
import { Camera } from '../../../src/render/camera';
import { shakeImpulse, style } from '../../../src/render/style';

/** just enough of a Pixi container for Camera.apply */
function fakeContainer() {
  const c = { sx: 0, px: 0, py: 0, scale: { set: (v: number) => void (c.sx = v) }, position: { set: (x: number, y: number) => { c.px = x; c.py = y; } } };
  return c;
}

function cam(): Camera {
  const camera = new Camera(2000, 1500);
  camera.setView(800, 600);
  camera.centerOn(1000, 700);
  return camera;
}

describe('shakeImpulse (A13)', () => {
  it('is 0 for no deaths, grows with sqrt(n), and caps at style.shake.max', () => {
    expect(shakeImpulse(0)).toBe(0);
    expect(shakeImpulse(-3)).toBe(0);
    expect(shakeImpulse(4)).toBeCloseTo(2 * shakeImpulse(1), 9);
    expect(shakeImpulse(9)).toBeCloseTo(3 * shakeImpulse(1), 9);
    expect(shakeImpulse(1)).toBeGreaterThan(0);
    expect(shakeImpulse(1e9)).toBe(style.shake.max);
    let last = 0;
    for (let n = 0; n < 200; n++) {
      expect(shakeImpulse(n)).toBeGreaterThanOrEqual(last);
      last = shakeImpulse(n);
    }
  });
});

describe('camera shake (A13, FR-014)', () => {
  it('decays to under 5% of the start within one second', () => {
    const camera = cam();
    camera.addShake(shakeImpulse(25));
    const start = camera.shakeAmount;
    expect(start).toBeGreaterThan(0);
    for (let t = 0; t < 1; t += 1 / 60) camera.tickShake(1 / 60);
    expect(camera.shakeAmount).toBeLessThan(start * 0.05);
  });

  it('never exceeds the cap however much is added', () => {
    const camera = cam();
    for (let i = 0; i < 50; i++) camera.addShake(shakeImpulse(100));
    expect(camera.shakeAmount).toBeLessThanOrEqual(style.shake.max);
  });

  it('with reduceMotion set the offset is always 0', () => {
    const camera = cam();
    camera.reduceMotion = true;
    camera.addShake(shakeImpulse(100));
    const c = fakeContainer();
    for (let i = 0; i < 30; i++) {
      camera.tickShake(1 / 60);
      camera.apply(c as never);
      expect(c.px).toBe(camera.viewW / 2 - camera.x * camera.zoom);
      expect(c.py).toBe(camera.viewH / 2 - camera.y * camera.zoom);
    }
    expect(camera.shakeAmount).toBe(0);
  });

  it('moves only the container offset, never the camera position or its clamping', () => {
    const camera = cam();
    const { x, y, zoom } = camera;
    camera.addShake(shakeImpulse(36));
    const c = fakeContainer();
    let moved = false;
    for (let i = 0; i < 30; i++) {
      camera.tickShake(1 / 60);
      camera.apply(c as never);
      if (c.px !== camera.viewW / 2 - x * zoom || c.py !== camera.viewH / 2 - y * zoom) moved = true;
      expect(camera.x).toBe(x);
      expect(camera.y).toBe(y);
      expect(camera.zoom).toBe(zoom);
    }
    expect(moved).toBe(true);
    // the offset stays within the current amplitude
    camera.addShake(shakeImpulse(36));
    camera.tickShake(0.001);
    camera.apply(c as never);
    expect(Math.abs(c.px - (camera.viewW / 2 - x * zoom))).toBeLessThanOrEqual(style.shake.max + 1e-9);
    // clamping is unaffected: centering near the edge still clamps to the real bounds
    camera.centerOn(0, 0);
    expect(camera.x).toBeCloseTo(camera.viewW / 2 / camera.zoom, 9);
  });

  it('is the same sequence every time (a local seeded generator)', () => {
    const run = () => {
      const camera = cam();
      camera.addShake(5);
      const c = fakeContainer();
      const seen: number[] = [];
      for (let i = 0; i < 10; i++) {
        camera.tickShake(1 / 60);
        camera.apply(c as never);
        seen.push(c.px, c.py);
      }
      return seen;
    };
    expect(run()).toEqual(run());
  });

  it('stops moving once it has decayed away', () => {
    const camera = cam();
    camera.addShake(shakeImpulse(9));
    for (let t = 0; t < 3; t += 1 / 60) camera.tickShake(1 / 60);
    const c = fakeContainer();
    camera.apply(c as never);
    expect(c.px).toBe(camera.viewW / 2 - camera.x * camera.zoom);
  });
});
