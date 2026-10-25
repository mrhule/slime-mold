import './ui/styles.css';
import { Application } from 'pixi.js';
import { Director } from './audio/director';
import { AudioEngine } from './audio/engine';
import { loadSettings, saveSettings } from './audio/settings';
import type { Settings } from './audio/settings';
import { FixedStepLoop } from './game/loop';
import { Run } from './game/run';
import { visibleDeaths } from './game/frame-events';
import { createStorage, safeLocalStorage } from './game/storage';
import { GameRenderer } from './render/renderer';
import { createRound, enqueue, pendingAllocation, placePreview, readHud, roundOutcome, step } from './sim';
import type { BuildingType, Command, SimEvent } from './sim';
import { BuildBar } from './ui/buildbar';
import { DebugOverlay } from './ui/debug';
import { Hud } from './ui/hud';
import { FarmPanel } from './ui/farm-panel';
import { InputController } from './ui/input';
import { FOOD_NAMES, reasonText } from './ui/messages';
import { shakeImpulse } from './render/style';
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

  // sound: settings are loaded once, changes apply at once and are saved; the engine starts on the
  // first click or key press (browser autoplay rules) and does nothing if audio is unavailable
  const store = safeLocalStorage();
  let settings: Settings = loadSettings(store);
  const engine = new AudioEngine();
  const director = new Director();
  engine.setSettings(settings);
  const unlockAudio = (): void => {
    engine.unlock();
    engine.startMusic();
    if (engine.available) {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    }
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  const send = (cmd: Command): void => enqueue(run.world, cmd);
  let applySettings: (change: Partial<Settings>) => void = () => {};
  const hud = new Hud(
    ui,
    {
      onTogglePause: () => run.togglePause(),
      onSpeed: (s) => run.setSpeed(s),
      onAllocation: (value) => send({ type: 'setAllocation', mold: PLAYER, value }),
      onToggleMute: () => applySettings({ muted: !settings.muted }),
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
  const farmPanel = new FarmPanel(ui, (delta) => input.nudgeFarm(delta));
  const screens = new Screens(ui, {
    start: () => run.start(),
    resume: () => run.resume(),
    closeMenu: () => run.closeMenu(),
    restartRun: () => run.newRun(),
    quitToTitle: () => run.quitToTitle(),
    nextRound: () => run.nextRound(),
    newRun: () => run.newRun(),
  }, { get: () => settings, set: (change) => applySettings(change) });
  const reduceMotion = (): void => {
    renderer.camera.reduceMotion = settings.reduceMotion;
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  };
  applySettings = (change) => {
    settings = { ...settings, ...change };
    saveSettings(settings, store);
    engine.setSettings(settings);
    hud.setMuted(settings.muted);
    reduceMotion();
    screens.syncSettings();
  };
  hud.setMuted(settings.muted);
  reduceMotion();
  const debug = dev ? new DebugOverlay(ui, params.has('debug')) : null;

  // the clock stops when the tab is hidden or loses focus (FR-027)
  // (`?nopause` turns this off in dev builds, for testing in a window that keeps losing focus)
  if (!(dev && params.has('nopause'))) {
    const autoPause = (): void => run.pause('focus');
    document.addEventListener('visibilitychange', () => document.hidden && autoPause());
    window.addEventListener('blur', autoPause);
  }

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
      director.rebase();
    }

    loop.speed = run.loopSpeed;
    ticksPerFrame = loop.advance(dt);
    input.update(dt);
    renderer.resize();

    // placement preview: ask the sim whether it would allow the building under the cursor
    let ghost: { cell: number; ok: boolean; type: BuildingType } | null = null;
    const pointer = input.pointerPosition;
    if (input.placing && input.hoverCell !== null && pointer) {
      const preview = placePreview(run.world, PLAYER, input.placing, input.hoverCell);
      const result = preview.result;
      ghost = { cell: input.hoverCell, ok: result.ok, type: input.placing };
      const note = preview.capAfter !== undefined ? ` (stock cap ${Math.round(preview.capBefore ?? 0)} to ${Math.round(preview.capAfter)})` : preview.unlinked ? ' (no store house on this vein: it will not pay)' : '';
      buildBar.showHint(result.ok ? `Click to build${note}` : reasonText(result.reason), pointer.x, pointer.y, result.ok);
    } else {
      buildBar.showHint(null, 0, 0, true);
    }

    renderer.update(run.world, dt, ghost);
    const model = readHud(run.world, PLAYER);
    model.allocation = pendingAllocation(run.world, PLAYER); // show orders given while paused
    hud.update(model, { speed: run.speed, paused: run.state === 'paused' });
    buildBar.update(model.build, input.placing);
    farmPanel.update(run.world, input.selectedFarm);
    buildBar.highlight(model.farms.unlinked > 0 && input.placing !== 'storehouse' ? 'storehouse' : null);

    for (const e of frameEvents) {
      if (e.type === 'commandRejected' && e.mold === PLAYER) {
        hud.reject(e.reason);
        if (e.cell !== undefined) renderer.fx.addRejectPing(e.cell, run.world.width);
      }
      if (e.type === 'capLost') hud.toast('Stock lost!', 2.5);
      if (e.type === 'dropWarning') hud.toast(`${FOOD_NAMES[e.foodType] ?? 'Food'} incoming!`, 2.5);
      if (e.type === 'dropLanded') {
        const src = run.world.foodSources[e.foodSourceId];
        if (src) renderer.fx.addLanding(src.y * run.world.width + src.x, run.world.width, (Math.max(src.w, src.h) * 8) / 2 + 6);
      }
      if (e.type === 'moldEliminated' && e.mold !== PLAYER) hud.toast(`Rival ${e.mold - 1} was eaten!`, 3);
    }

    // sound: the engine only runs while the game is playing and the tab is visible, and the director
    // reads one snapshot per rendered frame (so fast-forward cannot multiply cues)
    engine.setRunning(run.state === 'playing' && !document.hidden);
    const player = run.world.molds[PLAYER - 1];
    if (player) {
      const requests = director.update({
        playerId: PLAYER,
        nowMs: performance.now(),
        playerCells: player.cellCount,
        playerGathered: player.stats.nutrientsGathered,
        runState: run.state,
        outcome: run.outcome,
        visibleDeaths: visibleDeaths(run.world, frameEvents, PLAYER),
        events: frameEvents,
      });
      for (const request of requests) engine.play(request);
    }

    // fights you can see: ink splats for each visible death and a shake scaled by how many (A13)
    const deaths = visibleDeaths(run.world, frameEvents, PLAYER);
    for (const d of deaths) {
      const dying = run.world.molds[d.mold - 1];
      if (dying) renderer.fx.addSplat(d.cell, run.world.width, dying.color, dying.pattern);
    }
    renderer.camera.addShake(shakeImpulse(deaths.length));
    renderer.camera.tickShake(dt);
    frameEvents.length = 0;

    const extra = run.world.molds
      .filter((m) => m.ai)
      .map((m) => {
        const pressure = m.frontCells.reduce((s, c) => s + (run.world.pressure[c] as number), 0);
        return `R${m.id - 1} ${m.status === 'alive' ? '' : '(out) '}cells ${m.cellCount} alloc ${m.allocation.toFixed(2)} tips ${m.targets.length} fronts ${m.frontCells.length} press ${pressure.toFixed(1)} loss ${m.frontLoss.toFixed(2)} | ${m.ai?.debug.join('; ') ?? ''}`;
      });
    debug?.update({
      fps,
      tickMs,
      ticksPerFrame,
      droppedTicks: loop.droppedTicks,
      seed: run.runSeed,
      round: run.roundNumber,
      tick: run.world.tick,
      extra,
    });
  });
}

void main();
