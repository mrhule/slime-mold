import { describe, expect, it } from 'vitest';
import { CELL } from '../../src/render/units';
import { createRound, enqueue, stateHash, step } from '../../src/sim';
import type { Command, World } from '../../src/sim';
import { InputController } from '../../src/ui/input';

const TICKS = 400;

/** an input controller on a fake canvas over a real world, collecting what it sends */
function drive(touch: boolean): { world: World; sent: Command[]; fire: (type: string, id: number, x: number, y: number, t: number, button?: number) => void; input: InputController } {
  const world = createRound({ runSeed: 31, roundNumber: 2 });
  const listeners = new Map<string, (e: unknown) => void>();
  const canvas = {
    style: { touchAction: '' },
    addEventListener: (n: string, f: (e: unknown) => void) => void listeners.set(n, f),
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: () => {},
  } as unknown as HTMLCanvasElement;
  const renderer = {
    camera: {
      viewW: 4000,
      viewH: 4000,
      screenToWorld: (sx: number, sy: number) => [sx, sy],
      worldToScreen: (wx: number, wy: number) => [wx, wy],
      pan: () => {},
      zoomAt: () => {},
      centerOn: () => {},
    },
    coreWorldPosition: () => [0, 0],
  };
  const g = globalThis as { window?: unknown };
  g.window ??= { addEventListener: () => {} };
  const sent: Command[] = [];
  const input = new InputController(canvas, renderer as never, () => world, (c) => { sent.push(c); enqueue(world, c); }, {
    canAct: () => true,
    togglePause: () => {},
    setSpeed: () => {},
    escape: () => {},
  });
  input.setTouch(touch);
  const fire = (type: string, id: number, x: number, y: number, t: number, button = 0): void => {
    listeners.get(type)?.({ pointerType: touch ? 'touch' : 'mouse', pointerId: id, clientX: x, clientY: y, timeStamp: t, button, shiftKey: false, preventDefault: () => {} });
  };
  return { world, sent, fire, input };
}

function play(touch: boolean): { sent: Command[]; hash: number } {
  const { world, sent, fire, input } = drive(touch);
  const core = world.molds[0]!.core;
  const cx = core % world.width;
  const cy = Math.floor(core / world.width);
  const at = (dx: number, dy: number): [number, number] => [(cx + dx) * CELL + 2, (cy + dy) * CELL + 2];
  const click = (x: number, y: number, t: number): void => {
    fire('pointerdown', 1, x, y, t);
    fire('pointerup', 1, x, y, t + 60);
  };
  // two growth targets, then a store house placed near the core
  click(...at(8, 0), 0);
  click(...at(-8, 3), 200);
  input.togglePlacing('storehouse');
  click(...at(2, 1), 400);
  if (touch) input.confirmPlacement(); // touch previews first; the click already placed it on the mouse path
  for (let i = 0; i < TICKS; i++) step(world);
  return { sent, hash: stateHash(world) };
}

describe('touch input never changes the simulation (FR-018, SC-006)', () => {
  it('the same actions by mouse and by touch send the same commands and give the same state hash', () => {
    const mouse = play(false);
    const touch = play(true);
    expect(mouse.sent.some((c) => c.type === 'placeBuilding')).toBe(true);
    expect(touch.sent).toEqual(mouse.sent);
    expect(touch.hash).toBe(mouse.hash);
  });
});
