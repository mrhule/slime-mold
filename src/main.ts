import './ui/styles.css';
import { Application } from 'pixi.js';
import { FixedStepLoop } from './game/loop';
import { Run } from './game/run';
import { createStorage } from './game/storage';
import { GameRenderer } from './render/renderer';
import { canPlace, createRound, enqueue, pendingAllocation, readHud, roundOutcome, step } from './sim';
import type { Command, SimEvent } from './sim';
import { BuildBar } from './ui/buildbar';
import { DebugOverlay } from './ui/debug';
import { Hud } from './ui/hud';
import { InputController } from './ui/input';
import { reasonText } from './ui/messages';
import { Screens } from './ui/screens';

const PLAYER = 1;

const freshSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const seedParam = params.get('seed');
  const roundParam = Number(params.get('round'));
  const dev = import.meta.env.DEV;

  // debug parameters only exist in dev builds (T098)
  const run = new Run({
    runSeed: dev && seedParam !== null ? Number(seedParam) >>> 0 : freshSeed(),
    startRound: dev && Number.isFinite(roundParam) && roundParam >= 1 ? Math.floor(roundParam) : 1,
    storage: createStorage(),
    newSeed: freshSeed,
    createWorld: (runSeed, roundNumber) => createRound({ runSeed, roundNumber }),
  });

  const app = new Application();
  await app.init({ resizeTo: window, background: 0x14110f, antialias: true, preference: 'webgl' });
  (document.getElementById('game') as HTMLElement).appendChild(app.canvas);
  const ui = document.getElementById('ui') as HTMLElement;

  const renderer = new GameRenderer(app, run.world);
  let builtVersion = run.worldVersion;
  const frameEvents: SimEvent[] = [];
  let tickMs = 0;
  let ticksPerFrame = 0;
  let fps = 60;

  const loop = new FixedStepLoop(() => {
    const t0 = performance.now();
    step(run.world);
    tickMs += (performance.now() - t0 - tickMs) * 0.05;
    frameEvents.push(...run.world.events);
    const outcome = roundOutcome(run.world);
    if (outcome !== 'playing') run.finishRound(outcome);
  });

  const send = (cmd: Command): void => enqueue(run.world, cmd);
  const hud = new Hud(
    ui,
    {
      onTogglePause: () => run.togglePause(),
      onSpeed: (s) => run.setSpeed(s),
      onAllocation: (value) => send({ type: 'setAllocation', mold: PLAYER, value }),
    },
    run.world.balance.victoryControl,
  );
  const input = new InputController(app.canvas, renderer, () => run.world, send, {
    canAct: () => run.state === 'playing' || run.state === 'paused',
    togglePause: () => run.togglePause(),
    setSpeed: (s) => run.setSpeed(s),
    escape: () => (run.state === 'paused' && run.pauseReason === 'menu' ? run.closeMenu() : run.openMenu()),
  });
  const buildBar = new BuildBar(ui, (type) => input.togglePlacing(type));
  const screens = new Screens(ui, {
    start: () => run.start(),
    resume: () => run.resume(),
    closeMenu: () => run.closeMenu(),
    restartRun: () => run.newRun(),
    quitToTitle: () => run.quitToTitle(),
    nextRound: () => run.nextRound(),
    newRun: () => run.newRun(),
  });
  const debug = dev ? new DebugOverlay(ui, params.has('debug')) : null;

  // the clock stops when the tab is hidden or loses focus (FR-027)
  const autoPause = (): void => run.pause('focus');
  document.addEventListener('visibilitychange', () => document.hidden && autoPause());
  window.addEventListener('blur', autoPause);

  run.onChange(() => screens.update(run));
  screens.update(run);

  if (dev) {
    (window as unknown as { __slime: unknown }).__slime = {
      run,
      loop,
      renderer,
      get world() {
        return run.world;
      },
    };
  }

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    fps += (1 / Math.max(dt, 0.001) - fps) * 0.05;

    if (run.worldVersion !== builtVersion) {
      builtVersion = run.worldVersion;
      renderer.build(run.world);
      input.placing = null;
    }

    loop.speed = run.loopSpeed;
    ticksPerFrame = loop.advance(dt);
    input.update(dt);
    renderer.resize();

    // placement preview: ask the sim whether it would allow the building under the cursor
    let ghost: { cell: number; ok: boolean } | null = null;
    const pointer = input.pointerPosition;
    if (input.placing && input.hoverCell !== null && pointer) {
      const result = canPlace(run.world, PLAYER, input.placing, input.hoverCell);
      ghost = { cell: input.hoverCell, ok: result.ok };
      buildBar.showHint(result.ok ? 'Click to build' : reasonText(result.reason), pointer.x, pointer.y, result.ok);
    } else {
      buildBar.showHint(null, 0, 0, true);
    }

    renderer.update(run.world, dt, ghost);
    const model = readHud(run.world, PLAYER);
    model.allocation = pendingAllocation(run.world, PLAYER); // show orders given while paused
    hud.update(model, { speed: run.speed, paused: run.state === 'paused' });
    buildBar.update(model.build, input.placing);

    for (const e of frameEvents) {
      if (e.type === 'commandRejected' && e.mold === PLAYER) {
        hud.reject(e.reason);
        if (e.cell !== undefined) renderer.fx.addRejectPing(e.cell, run.world.width);
      }
      if (e.type === 'moldEliminated' && e.mold !== PLAYER) hud.toast(`Rival ${e.mold - 1} was eaten!`, 3);
    }
    frameEvents.length = 0;

    debug?.update({
      fps,
      tickMs,
      ticksPerFrame,
      droppedTicks: loop.droppedTicks,
      seed: run.runSeed,
      round: run.roundNumber,
      tick: run.world.tick,
    });
  });
}

void main();
