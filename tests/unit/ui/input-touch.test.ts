import { describe, expect, it } from 'vitest';
import { InputController } from '../../../src/ui/input';
import { CELL } from '../../../src/render/units';
import { createRound } from '../../../src/sim';
import type { Command, World } from '../../../src/sim';

/** a canvas, renderer and world just real enough to drive the touch path */
function rig(): { input: InputController; sent: Command[]; world: World; cam: { x: number; y: number; zoom: number; pans: number[][] } ; fire: (type: string, id: number, x: number, y: number, t: number) => void } {
  const world = createRound({ runSeed: 3, roundNumber: 1 });
  const listeners = new Map<string, (e: unknown) => void>();
  const canvas = {
    style: { touchAction: '' },
    addEventListener: (n: string, f: (e: unknown) => void) => void listeners.set(n, f),
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: () => {},
  } as unknown as HTMLCanvasElement;
  const cam = { x: 0, y: 0, zoom: 1, pans: [] as number[][] };
  const renderer = {
    camera: {
      viewW: 800,
      viewH: 600,
      screenToWorld: (sx: number, sy: number) => [sx, sy],
      worldToScreen: (wx: number, wy: number) => [wx, wy],
      pan: (dx: number, dy: number) => void cam.pans.push([dx, dy]),
      zoomAt: (_x: number, _y: number, f: number) => void (cam.zoom *= f),
      centerOn: () => {},
    },
    coreWorldPosition: () => [0, 0],
  };
  const sent: Command[] = [];
  const g = globalThis as { window?: unknown };
  g.window ??= { addEventListener: () => {} };
  const input = new InputController(canvas, renderer as never, () => world, (c) => sent.push(c), {
    canAct: () => true,
    togglePause: () => {},
    setSpeed: () => {},
    escape: () => {},
  });
  input.setTouch(true);
  const fire = (type: string, id: number, x: number, y: number, t: number): void => {
    listeners.get(type)?.({ pointerType: 'touch', pointerId: id, clientX: x, clientY: y, timeStamp: t, button: 0, shiftKey: false, preventDefault: () => {} });
  };
  return { input, sent, world, cam, fire };
}

describe('touch input mapping (contracts/touch-controls.md)', () => {
  it('a tap on a map cell sends setTarget, like a click', () => {
    const { sent, fire } = rig();
    fire('pointerdown', 1, 5 * CELL + 2, 5 * CELL + 2, 0);
    fire('pointerup', 1, 5 * CELL + 2, 5 * CELL + 2, 100);
    expect(sent).toEqual([{ type: 'setTarget', mold: 1, cell: 5 * 160 + 5 }]);
  });

  it('a drag pans and sets no target', () => {
    const { sent, cam, fire } = rig();
    fire('pointerdown', 1, 100, 100, 0);
    fire('pointermove', 1, 140, 100, 50);
    fire('pointerup', 1, 140, 100, 100);
    expect(sent).toEqual([]);
    expect(cam.pans.length).toBeGreaterThan(0);
    expect(cam.pans[0]).toEqual([-40, -0]);
  });

  it('a pinch zooms and sets no target', () => {
    const { sent, cam, fire } = rig();
    fire('pointerdown', 1, 100, 100, 0);
    fire('pointerdown', 2, 200, 100, 10);
    fire('pointermove', 2, 300, 100, 20);
    fire('pointerup', 2, 300, 100, 30);
    fire('pointerup', 1, 100, 100, 40);
    expect(cam.zoom).toBeCloseTo(2);
    expect(sent).toEqual([]);
  });

  it('a long press on a growth target cancels it, and elsewhere does nothing', () => {
    const { input, sent, world, fire } = rig();
    const mold = world.molds[0];
    if (!mold) throw new Error('no mold');
    mold.targets.push({ id: 7, cell: 20 * 160 + 20 } as never);
    const x = 20 * CELL + CELL / 2;
    const y = 20 * CELL + CELL / 2;
    fire('pointerdown', 1, x + 6, y, 0);
    const realNow = performance.now;
    performance.now = () => 700;
    input.update(0.016);
    performance.now = realNow;
    fire('pointerup', 1, x + 6, y, 800);
    expect(sent).toEqual([{ type: 'cancelTarget', mold: 1, targetId: 7 }]);

    sent.length = 0;
    fire('pointerdown', 1, 300, 300, 1000);
    performance.now = () => 1700;
    input.update(0.016);
    performance.now = realNow;
    fire('pointerup', 1, 300, 300, 1800);
    expect(sent).toEqual([]);
  });

  it('with touch mode off, touch pointers are ignored by the touch path (mouse behavior is unchanged)', () => {
    const { input, sent, fire } = rig();
    input.setTouch(false);
    fire('pointerdown', 1, 100, 100, 0);
    fire('pointerup', 1, 100, 100, 50);
    expect(sent).toEqual([{ type: 'setTarget', mold: 1, cell: Math.floor(100 / CELL) * 160 + Math.floor(100 / CELL) }]);
  });
});
