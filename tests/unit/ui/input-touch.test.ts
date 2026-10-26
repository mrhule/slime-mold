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

describe('touch placement: preview, then Confirm (FR-007)', () => {
  const tap = (fire: (t: string, id: number, x: number, y: number, ms: number) => void, x: number, y: number, t0 = 0): void => {
    fire('pointerdown', 1, x, y, t0);
    fire('pointerup', 1, x, y, t0 + 80);
  };

  it('a tap while placing only previews: no command until Confirm, then exactly one placeBuilding', () => {
    const { input, sent, fire } = rig();
    input.togglePlacing('booster');
    tap(fire, 8 * CELL + 3, 9 * CELL + 3);
    expect(sent).toEqual([]);
    expect(input.pendingCell).toBe(9 * 160 + 8);
    input.confirmPlacement();
    expect(sent).toEqual([{ type: 'placeBuilding', mold: 1, building: 'booster', cell: 9 * 160 + 8 }]);
  });

  it('tapping again moves the pending spot', () => {
    const { input, sent, fire } = rig();
    input.togglePlacing('booster');
    tap(fire, 2 * CELL + 1, 2 * CELL + 1);
    tap(fire, 4 * CELL + 1, 4 * CELL + 1, 500);
    expect(input.pendingCell).toBe(4 * 160 + 4);
    expect(sent).toEqual([]);
  });

  it('Cancel, or choosing another building, sends nothing and clears the spot', () => {
    const { input, sent, fire } = rig();
    input.togglePlacing('booster');
    tap(fire, 5 * CELL + 1, 5 * CELL + 1);
    input.cancelPlacement();
    expect(input.placing).toBeNull();
    expect(input.pendingCell).toBeNull();
    input.togglePlacing('booster');
    tap(fire, 5 * CELL + 1, 5 * CELL + 1, 500);
    input.togglePlacing('booster');
    expect(input.pendingCell).toBeNull();
    input.confirmPlacement();
    expect(sent).toEqual([]);
  });

  it('panning keeps the pending spot', () => {
    const { input, fire } = rig();
    input.togglePlacing('booster');
    tap(fire, 6 * CELL + 1, 6 * CELL + 1);
    fire('pointerdown', 1, 300, 300, 1000);
    fire('pointermove', 1, 360, 300, 1050);
    fire('pointerup', 1, 360, 300, 1100);
    expect(input.pendingCell).toBe(6 * 160 + 6);
  });

  it('confirm with nothing chosen does nothing', () => {
    const { input, sent } = rig();
    input.togglePlacing('booster');
    input.confirmPlacement();
    expect(sent).toEqual([]);
  });
});
