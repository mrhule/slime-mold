import './ui/styles.css';
import { Application } from 'pixi.js';
import { Director } from './audio/director';
import { AudioEngine } from './audio/engine';
import trackUrls from 'virtual:music-tracks';
import { loadSettings, saveSettings } from './audio/settings';
import type { Settings } from './audio/settings';
import { FixedStepLoop } from './game/loop';
import { Run } from './game/run';
import { visibleDeaths } from './game/frame-events';
import { createStorage, safeLocalStorage } from './game/storage';
import { Tutorial } from './game/tutorial';
import { loadArt } from './render/art';
import { GameRenderer } from './render/renderer';
import { createRound, countBuildings, enqueue, knownFoodLeft, pendingAllocation, placePreview, readHud, roundOutcome, step, upgradeSpec } from './sim';
import { TICK_DT } from './sim';
import type { BuildingType, Command, SimEvent } from './sim';
import { BuildBar } from './ui/buildbar';
import { Coach } from './ui/coach';
import { DebugOverlay } from './ui/debug';
import { Hud } from './ui/hud';
import { InputController } from './ui/input';
import { FOOD_NAMES, reasonText } from './ui/messages';
import { QualityGovernor } from './render/quality';
import { Screens } from './ui/screens';
import { installTapHints } from './ui/tap-hints';
import { TouchBar } from './ui/touch-bar';
import { applyTouchClass, detectTouch, resolveTouch } from './ui/touch-mode';

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
    // on a touch device the map takes the screen's shape rather than being cropped by it
    createWorld: (runSeed, roundNumber) => {
      const touch = resolveTouch(loadSettings(safeLocalStorage()).touchMode, detectTouch());
      const long = Math.max(window.innerWidth, window.innerHeight);
      const short = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
      return createRound({ runSeed, roundNumber, ...(touch ? { aspect: long / short } : {}) });
    },
  });

  const app = new Application();
  // touch devices draw one pixel per CSS pixel (never the phone's native density) to save battery and heat
  const touchAtStart = resolveTouch(loadSettings(safeLocalStorage()).touchMode, detectTouch());
  await app.init({ resizeTo: window, background: 0x14110f, antialias: true, preference: 'webgl', ...(touchAtStart ? { resolution: 1, autoDensity: false } : {}) });
  (document.getElementById('game') as HTMLElement).appendChild(app.canvas);
  const ui = document.getElementById('ui') as HTMLElement;

  await loadArt(); // the painted look; the game draws its plain procedural look if this fails
  const renderer = new GameRenderer(app, run.world);
  let builtVersion = run.worldVersion;
  const frameEvents: SimEvent[] = [];
  let tickMs = 0;
  let ticksPerFrame = 0;
  let fps = 60;
  // ticks at which the player lost a cell to a rival, for the "front collapsing" warning
  const losses: number[] = [];
  let lastFrontAlert = -Infinity;
  const FRONT_WINDOW_TICKS = 200; // 10 s
  const FRONT_LOSS_CELLS = 6;
  const FRONT_ALERT_GAP_TICKS = 600; // at most one warning every 30 s

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
  // touch-first devices start on Low quality; a saved Quality choice still wins
  const detectedTouch = detectTouch();
  let settings: Settings = loadSettings(store);
  if (resolveTouch(settings.touchMode, detectedTouch)) settings = loadSettings(store, { quality: 'low' });
  const engine = new AudioEngine();
  engine.setTracks(trackUrls); // the files in public/music; none means the generated loop
  const director = new Director();
  engine.setSettings(settings);
  // iOS only counts a finished tap (touchend or click) as a user gesture, so those unlock too; the
  // listeners come off once a tap or key press has found audio available
  const unlockEvents = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
  const unlockAudio = (e: Event): void => {
    engine.unlock();
    engine.startMusic();
    if (engine.available && e.type !== 'pointerdown') for (const t of unlockEvents) window.removeEventListener(t, unlockAudio);
  };
  for (const t of unlockEvents) window.addEventListener(t, unlockAudio, { passive: true });
  // a later tap or key press also restarts a recorded track the browser stopped (a phone locking its screen, say)
  for (const t of ['pointerdown', 'keydown'] as const) window.addEventListener(t, () => engine.kick(), { passive: true });

  const send = (cmd: Command): void => enqueue(run.world, cmd);
  let applySettings: (change: Partial<Settings>) => void = () => {};
  const hud = new Hud(
    ui,
    {
      onTogglePause: () => run.togglePause(),
      onSpeed: (s) => run.setSpeed(s),
      onAllocation: (value) => send({ type: 'setAllocation', mold: PLAYER, value }),
      onToggleMute: () => applySettings({ muted: !settings.muted }),
      onEvolve: () => send({ type: 'evolve', mold: PLAYER }),
    },
    run.world.balance.victoryControl,
  );
  const input = new InputController(app.canvas, renderer, () => run.world, send, {
    canAct: () => run.state === 'playing' || run.state === 'paused',
    togglePause: () => run.togglePause(),
    setSpeed: (s) => run.setSpeed(s),
    escape: () => (run.state === 'paused' && run.pauseReason === 'menu' ? run.closeMenu() : run.openMenu()),
  });
  const touchBar = new TouchBar(ui, {
    onClearTargets: () => send({ type: 'clearTargets', mold: PLAYER }),
    onConfirmPlacement: () => input.confirmPlacement(),
    onCancelPlacement: () => input.cancelPlacement(),
    onMenu: () => (run.state === 'paused' && run.pauseReason === 'menu' ? run.closeMenu() : run.openMenu()),
    onHome: () => {
      const [x, y] = renderer.coreWorldPosition(run.world);
      renderer.camera.centerOn(x, y);
    },
  });
  const tutorial = new Tutorial(store);
  let tutorialRound = 1;
  const startTutorial = (): void => {
    tutorialRound = run.world.roundNumber;
    tutorial.start(run.world.tick * TICK_DT);
  };
  const coach = new Coach(ui, () => tutorial.finish());
  const buildBar = new BuildBar(ui, (type) => input.togglePlacing(type));
  const screens = new Screens(ui, {
    start: () => {
      run.start();
      if (!tutorial.seen && run.world.roundNumber === 1) startTutorial();
    },
    tutorial: () => {
      run.closeMenu();
      startTutorial();
    },
    resume: () => run.resume(),
    closeMenu: () => run.closeMenu(),
    restartRun: () => run.newRun(),
    quitToTitle: () => run.quitToTitle(),
    nextRound: () => run.nextRound(),
    newRun: () => run.newRun(),
  }, { get: () => settings, set: (change) => applySettings(change), printAvailable: renderer.print !== null });
  // how much empty window lies around the map, so the panels can sit beside it instead of on it
  let uiMargins = '';
  const fitUiToMap = (): void => {
    const cam = renderer.camera;
    const [x0, y0] = cam.worldToScreen(0, 0);
    const [x1, y1] = cam.worldToScreen(cam.worldW, cam.worldH);
    const left = Math.max(0, Math.round(x0));
    const right = Math.max(0, Math.round(cam.viewW - x1));
    const bottom = Math.max(0, Math.round(cam.viewH - y1));
    const margins = `${left} ${right} ${bottom}`;
    if (margins === uiMargins) return;
    uiMargins = margins;
    ui.style.setProperty('--map-left', `${left}px`);
    ui.style.setProperty('--map-right', `${right}px`);
    ui.style.setProperty('--map-bottom', `${bottom}px`);
  };
  const touchOn = (): boolean => resolveTouch(settings.touchMode, detectedTouch);
  // portrait on a touch device shows a rotate message and pauses; turning back resumes only that pause
  const portrait = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : null;
  let pausedByPortrait = false;
  const orientation = (): void => {
    if (portrait?.matches && touchOn()) {
      if (run.state === 'playing') {
        run.pause('focus');
        pausedByPortrait = true;
      }
    } else if (pausedByPortrait) {
      pausedByPortrait = false;
      if (run.state === 'paused' && run.pauseReason === 'focus') run.resume();
    }
  };
  portrait?.addEventListener?.('change', orientation);
  ui.insertAdjacentHTML('beforeend', '<div class="rotate-hint"><div class="panel big"><h2>Rotate your phone</h2><div class="phone" aria-hidden="true">&#128241;</div><p>Slime Mold plays in landscape.</p></div></div>');
  installTapHints(ui, () => touchOn(), (text) => hud.toast(text, 3));
  document.addEventListener('contextmenu', (e) => {
    if (touchOn()) e.preventDefault();
  });
  const touchMode = (): void => {
    const on = touchOn();
    applyTouchClass(on);
    input.setTouch(on);
    orientation();
  };
  const reduceMotion = (): void => {
    touchMode();
    renderer.camera.reduceMotion = settings.reduceMotion;
    renderer.setPrintTexture(settings.printTexture);
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
  const governor = new QualityGovernor();
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
    renderer.setQuality(governor.update(dt, fps, settings.quality));

    if (run.worldVersion !== builtVersion) {
      builtVersion = run.worldVersion;
      renderer.build(run.world);
      input.placing = null;
      director.rebase();
    }

    loop.speed = run.loopSpeed;
    ticksPerFrame = loop.advance(dt);
    input.update(dt);
    // phones report a stale window height after a rotation or when the address bar moves, so the canvas
    // is checked against the real window every frame and resized when they differ
    if (app.screen.width !== window.innerWidth || app.screen.height !== window.innerHeight) app.renderer.resize(window.innerWidth, window.innerHeight);
    renderer.resize();
    fitUiToMap();

    // placement preview: ask the sim whether it would allow the building under the cursor
    let ghost: { cell: number; ok: boolean; type: BuildingType } | null = null;
    const pointer = input.pointerPosition;
    if (input.placing && input.hoverCell !== null && pointer) {
      const preview = placePreview(run.world, PLAYER, input.placing, input.hoverCell);
      const result = preview.result;
      ghost = { cell: input.hoverCell, ok: result.ok, type: input.placing };
      const note = preview.capAfter !== undefined ? ` (stock cap ${Math.round(preview.capBefore ?? 0)} to ${Math.round(preview.capAfter)})` : '';
      buildBar.showHint(result.ok ? `Click to build${note}` : reasonText(result.reason), pointer.x, pointer.y, result.ok);
    } else if (input.touchActive && input.placing) {
      // touch: the chosen spot is previewed and its reason shown in the placement bar (FR-007, FR-008)
      const cell = input.pendingCell;
      if (cell === null) {
        touchBar.setPlacement({ text: 'Tap the map to choose a spot', canConfirm: false, hasSpot: false });
      } else {
        const preview = placePreview(run.world, PLAYER, input.placing, cell);
        ghost = { cell, ok: preview.result.ok, type: input.placing };
        const note = preview.capAfter !== undefined ? ` (stock cap ${Math.round(preview.capBefore ?? 0)} to ${Math.round(preview.capAfter)})` : '';
        touchBar.setPlacement({ text: preview.result.ok ? `Build here?${note}` : reasonText(preview.result.reason), canConfirm: preview.result.ok, hasSpot: true });
      }
      buildBar.showHint(null, 0, 0, true);
    } else {
      buildBar.showHint(null, 0, 0, true);
    }
    if (!(input.touchActive && input.placing)) touchBar.setPlacement(null);

    // hovering one of the player's store houses reveals everything it speeds up
    let inspect: number | null = null;
    const under = input.placing || input.touchActive ? null : input.pointerCell;
    if (under !== null) {
      const w = run.world.width;
      const nearBuilding = run.world.buildings.find(
        (b) => !b.destroyed && b.moldId === PLAYER && Math.abs((b.cell % w) - (under % w)) <= 2 && Math.abs(Math.floor(b.cell / w) - Math.floor(under / w)) <= 2,
      );
      const near = nearBuilding?.type === 'storehouse' || nearBuilding?.type === 'relay' ? nearBuilding : undefined;
      const label = near?.type === 'relay' ? 'Relay' : 'Factory';
      const armed = nearBuilding !== undefined && input.demolishArmed === nearBuilding.cell;
      if (nearBuilding && !near && pointer) {
        buildBar.showHint(armed ? 'Right-click again to demolish!' : 'Right-click to demolish (half back)', pointer.x, pointer.y, !armed);
      }
      if (near) {
        if (near.type === 'storehouse') inspect = near.cell;
        const spec = upgradeSpec(run.world, near.type) as NonNullable<ReturnType<typeof upgradeSpec>>;
        const cost = spec.upgradeCost[near.level - 1];
        const comp = run.world.components.get(run.world.component[near.cell] as number);
        if (pointer) {
          if (armed) buildBar.showHint('Right-click again to demolish!', pointer.x, pointer.y, false);
          else if (cost === undefined || near.level >= spec.maxLevel) buildBar.showHint(`${label} level ${near.level}: fully upgraded. Right-click to demolish`, pointer.x, pointer.y, true);
          else buildBar.showHint(`${label} level ${near.level}: click to upgrade for ${cost} (reach +${spec.reachPerLevel}). Right-click to demolish`, pointer.x, pointer.y, !!comp && comp.pool >= cost);
        }
      }
    }

    // hovering food says how much of it is left (food in the fog shows what was last seen)
    if (under !== null && pointer && !input.demolishArmed) {
      const sid = run.world.foodSourceId[under] as number;
      const src = sid >= 0 ? run.world.foodSources[sid] : undefined;
      if (src && !src.depleted && !run.world.buildings.some((b) => !b.destroyed && b.moldId === PLAYER && Math.abs((b.cell % run.world.width) - (under % run.world.width)) <= 2 && Math.abs(Math.floor(b.cell / run.world.width) - Math.floor(under / run.world.width)) <= 2)) {
        const name = FOOD_NAMES[src.type] ?? 'Food';
        if (run.world.balance.foodTypes[src.type].infinite) {
          buildBar.showHint(`${name}: never runs out`, pointer.x, pointer.y, true);
        } else {
          const left = knownFoodLeft(run.world, src);
          if (left) buildBar.showHint(`${name}: ${Math.round(left.amount)} of ${Math.round(src.total)} nutrients left${left.fresh ? '' : ' (last seen)'}`, pointer.x, pointer.y, true);
        }
      }
    }

    renderer.update(run.world, dt, ghost, inspect);
    const model = readHud(run.world, PLAYER);
    model.allocation = pendingAllocation(run.world, PLAYER); // show orders given while paused
    hud.update(model, { speed: run.speed, paused: run.state === 'paused' });
    // the guided first round: prompts follow what the player has done, and stay out of the menus
    let tutorialStep: ReturnType<Tutorial['update']> = null;
    if (tutorial.running && run.world.roundNumber !== tutorialRound) tutorial.finish();
    if (tutorial.running && (run.state === 'playing' || (run.state === 'paused' && run.pauseReason !== 'menu'))) {
      const me = run.world.molds[PLAYER - 1];
      tutorialStep = tutorial.update({
        round: run.world.roundNumber,
        seconds: model.elapsedSeconds,
        targets: me?.targets.length ?? 0,
        cells: me?.cellCount ?? 0,
        factories: countBuildings(run.world, PLAYER, 'storehouse'),
        gathered: me?.stats.nutrientsGathered ?? 0,
        rivalSeen: model.rivals.some((r) => r.visibleCells !== null),
      });
    }
    if (tutorialStep) coach.show(tutorialStep.text(touchOn(), Math.round(model.winControl * 100)), tutorial.stepNumber, tutorial.stepCount);
    else coach.hide();
    buildBar.update(model.build, input.placing);
    buildBar.highlight((model.pools.waiting > 0 || tutorialStep?.id === 'factory') && input.placing !== 'storehouse' ? 'storehouse' : null);

    // a front that keeps losing cells gets a warning that says what to do about it
    while (losses.length > 0 && (losses[0] as number) < run.world.tick - FRONT_WINDOW_TICKS) losses.shift();
    if (losses.length >= FRONT_LOSS_CELLS && run.world.tick - lastFrontAlert > FRONT_ALERT_GAP_TICKS) {
      lastFrontAlert = run.world.tick;
      hud.toast('Your front is collapsing! Send more to the fight (E) or build a Booster (B)', 4);
    }

    for (const e of frameEvents) {
      if (e.type === 'commandRejected' && e.mold === PLAYER) {
        hud.reject(e.reason);
        if (e.cell !== undefined) renderer.fx.addRejectPing(e.cell, run.world.width);
      }
      if (e.type === 'cellDied' && e.mold === PLAYER && e.by > 0) losses.push(run.world.tick);
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

    // fights you can see: ink splats for each visible death (the screen itself no longer shakes)
    const deaths = visibleDeaths(run.world, frameEvents, PLAYER);
    for (const d of deaths) {
      const dying = run.world.molds[d.mold - 1];
      if (dying) renderer.fx.addSplat(d.cell, run.world.width, dying.color, dying.pattern);
    }
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
