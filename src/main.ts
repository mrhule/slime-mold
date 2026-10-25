import './ui/styles.css';
import { Application } from 'pixi.js';
import { FixedStepLoop } from './game/loop';
import { GameRenderer } from './render/renderer';
import { canPlace, createRound, enqueue, readHud, step } from './sim';
import type { Command, SimEvent, World } from './sim';
import { BuildBar } from './ui/buildbar';
import { Hud } from './ui/hud';
import { InputController } from './ui/input';
import { reasonText } from './ui/messages';

const PLAYER = 1;

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const seedParam = params.get('seed');
  const runSeed = seedParam !== null ? Number(seedParam) >>> 0 : (Date.now() ^ 0x5bd1e995) >>> 0;

  let world: World = createRound({ runSeed, roundNumber: 1 });

  const app = new Application();
  await app.init({ resizeTo: window, background: 0x14110f, antialias: true, preference: 'webgl' });
  (document.getElementById('game') as HTMLElement).appendChild(app.canvas);

  const renderer = new GameRenderer(app, world);
  const hud = new Hud(document.getElementById('ui') as HTMLElement);
  const frameEvents: SimEvent[] = [];
  const loop = new FixedStepLoop(() => {
    step(world);
    frameEvents.push(...world.events);
  });
  const send = (cmd: Command): void => enqueue(world, cmd);
  const input = new InputController(app.canvas, renderer, () => world, send);
  const buildBar = new BuildBar(document.getElementById('ui') as HTMLElement, (type) => input.togglePlacing(type));

  if (import.meta.env.DEV) {
    (window as unknown as { __slime: unknown }).__slime = { get world() { return world; }, loop, renderer, runSeed };
  }

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    loop.advance(dt);
    input.update(dt);
    renderer.resize();
    // placement preview: ask the sim whether it would allow the building under the cursor
    let ghost: { cell: number; ok: boolean } | null = null;
    const pointer = input.pointerPosition;
    if (input.placing && input.hoverCell !== null && pointer) {
      const result = canPlace(world, PLAYER, input.placing, input.hoverCell);
      ghost = { cell: input.hoverCell, ok: result.ok };
      buildBar.showHint(result.ok ? 'Click to build' : reasonText(result.reason), pointer.x, pointer.y, result.ok);
    } else {
      buildBar.showHint(null, 0, 0, true);
    }
    renderer.update(world, dt, ghost);
    const model = readHud(world, PLAYER);
    hud.update(model);
    buildBar.update(model.build, input.placing);
    for (const e of frameEvents) {
      if (e.type === 'commandRejected' && e.mold === PLAYER) {
        hud.reject(e.reason);
        if (e.cell !== undefined) renderer.fx.addRejectPing(e.cell, world.width);
      }
    }
    frameEvents.length = 0;
  });
}

void main();
