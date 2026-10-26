import type { Settings } from '../audio/settings';
import type { Run } from '../game/run';
import { MOLD_COLORS } from '../render/palette';

export interface ScreenActions {
  start(): void;
  resume(): void;
  closeMenu(): void;
  restartRun(): void;
  quitToTitle(): void;
  nextRound(): void;
  newRun(): void;
  /** play the guided first-round tips again */
  tutorial(): void;
}

/** how the menu reads and changes the player's settings (saved by the caller) */
export interface SettingsApi {
  get(): Settings;
  set(change: Partial<Settings>): void;
  /** false when the print filter could not be built, which hides its toggle */
  printAvailable?: boolean;
}

const fmtTime = (seconds: number): string => {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Title, pause menu, round-end, and pause overlays (FR-029), all in the comic style. */
export class Screens {
  private readonly root: HTMLElement;
  private lastKey = '';

  constructor(
    parent: HTMLElement,
    private readonly actions: ScreenActions,
    private readonly settings: SettingsApi,
  ) {
    parent.insertAdjacentHTML('beforeend', '<div class="screens"></div>');
    this.root = parent.querySelector('.screens') as HTMLElement;
    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!btn) {
        if ((e.target as HTMLElement).closest('.focus-overlay')) this.actions.resume();
        return;
      }
      const act = btn.dataset.act as keyof ScreenActions;
      this.actions[act]();
    });
    // settings controls apply at once and are saved by the caller; the menu is not re-rendered, so a
    // slider keeps its focus while it is dragged
    const onSetting = (e: Event): void => {
      const el = e.target as HTMLInputElement | HTMLSelectElement;
      const key = el.dataset?.setting as keyof Settings | undefined;
      if (!key) return;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') this.settings.set({ [key]: el.checked } as Partial<Settings>);
      else if (el instanceof HTMLInputElement && el.type === 'range') this.settings.set({ [key]: Number(el.value) } as Partial<Settings>);
      else this.settings.set({ [key]: el.value } as Partial<Settings>);
    };
    this.root.addEventListener('input', onSetting);
    this.root.addEventListener('change', onSetting);
  }

  update(run: Run): void {
    const outcomeKey = run.state === 'roundEnd' ? `${run.outcome}:${run.roundNumber}:${run.bestRound}` : '';
    const key = `${run.state}:${run.pauseReason}:${outcomeKey}:${run.bestRound}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.root.innerHTML = this.render(run);
  }

  private render(run: Run): string {
    if (run.state === 'title') return this.title(run);
    if (run.state === 'roundEnd') return this.roundEnd(run);
    if (run.state === 'paused') {
      if (run.pauseReason === 'menu') return this.menu();
      if (run.pauseReason === 'focus') return '<div class="screen focus-overlay"><div class="panel big"><h2>Paused</h2><p><span class="kbd-only">Click</span><span class="touch-only">Tap</span> to resume</p></div></div>';
      return '<div class="banner">Paused — <span class="kbd-only">Space</span><span class="touch-only">tap ❚❚</span> to resume. You can still give orders.</div>';
    }
    return '';
  }

  private title(run: Run): string {
    const best = run.bestRound > 0 ? `<p class="best">Best round: <b>${run.bestRound}</b></p>` : '';
    const dots = MOLD_COLORS.slice(0, 4)
      .map((c) => `<span class="dot" style="background:#${c.toString(16).padStart(6, '0')}"></span>`)
      .join('');
    return `<div class="screen"><div class="panel big title">
      <h1>Slime Mold</h1>
      <div class="dots">${dots}</div>
      <p>Grow your mold across the map. Eat, build, and beat the rival molds.</p>
      ${best}
      <button class="btn" data-act="start">Start</button>
      <ul class="keys touch-only">
        <li><b>Tap</b> the map to grow there &middot; <b>press and hold</b> a marker to cancel</li>
        <li><b>Drag</b> to look around &middot; <b>pinch</b> to zoom</li>
        <li>Pick a building, tap a spot, then <b>Build</b></li>
      </ul>
      <ul class="keys kbd-only">
        <li><b>Click</b> the map to grow there &middot; <b>right-click</b> a marker to cancel, a vein to cut it (again to rejoin), a building twice to demolish it</li>
        <li><b>Q / E</b> or the slider: send nutrients to growth or to the fight</li>
        <li><b>F</b> build a factory &middot; <b>Space</b> pause &middot; <b>1 2 3</b> speed &middot; <b>WASD</b> and wheel to look around</li>
      </ul>
    </div></div>`;
  }

  private settingsSection(): string {
    const s = this.settings.get();
    const slider = (key: string, value: number): string => `<input type="range" min="0" max="1" step="0.05" value="${value}" data-setting="${key}" />`;
    return `<div class="settings">
      <h3>Settings</h3>
      <label class="setting"><span>Sound</span>${slider('sfxVolume', s.sfxVolume)}</label>
      <label class="setting"><span>Music</span>${slider('musicVolume', s.musicVolume)}</label>
      <label class="setting"><span>Mute all</span><input type="checkbox" data-setting="muted" ${s.muted ? 'checked' : ''} /></label>
      <label class="setting" title="Turns off screen shake and flashing or bouncing effects"><span>Reduce motion</span><input type="checkbox" data-setting="reduceMotion" ${s.reduceMotion ? 'checked' : ''} /></label>
      <label class="setting" title="Auto drops to Low when the frame rate stays low and returns when it recovers"><span>Quality</span><select data-setting="quality">${(['auto', 'high', 'low'] as const).map((q) => `<option value="${q}" ${s.quality === q ? 'selected' : ''}>${q[0]?.toUpperCase()}${q.slice(1)}</option>`).join('')}</select></label>
      <label class="setting" title="Touch controls and layout for phones and tablets. Auto follows your device."><span>Touch mode</span><select data-setting="touchMode">${(['auto', 'on', 'off'] as const).map((q) => `<option value="${q}" ${s.touchMode === q ? 'selected' : ''}>${q[0]?.toUpperCase()}${q.slice(1)}</option>`).join('')}</select></label>
      ${this.settings.printAvailable === false ? '' : `<label class="setting" title="A comic print look: halftone dots, grain and slightly off-register colour. High quality only."><span>Print texture</span><input type="checkbox" data-setting="printTexture" ${s.printTexture ? 'checked' : ''} /></label>`}
    </div>`;
  }

  /** keep the menu's controls in step when a setting changes elsewhere (the HUD mute button) */
  syncSettings(): void {
    const s = this.settings.get();
    for (const el of this.root.querySelectorAll<HTMLInputElement>('[data-setting]')) {
      const key = el.dataset.setting as keyof Settings;
      if (el.type === 'checkbox') el.checked = Boolean(s[key]);
      else if (el.type === 'range') el.value = String(s[key]);
    }
  }

  private menu(): string {
    return `<div class="screen"><div class="panel big">
      <h2>Paused</h2>
      <button class="btn" data-act="closeMenu">Resume</button>
      <button class="btn" data-act="tutorial">How to play</button>
      <button class="btn" data-act="restartRun">Restart run</button>
      <button class="btn" data-act="quitToTitle">Quit to title</button>
      ${this.settingsSection()}
    </div></div>`;
  }

  private roundEnd(run: Run): string {
    const w = run.world;
    const player = w.molds[0];
    const rivalsOut = w.molds.filter((m) => m.kind === 'rival' && m.status === 'eliminated').length;
    const rivals = w.molds.filter((m) => m.kind === 'rival').length;
    const win = run.outcome === 'victory';
    const stats = player
      ? `<li><span>Time</span><b>${fmtTime(w.tick * 0.05)}</b></li>
         <li><span>Biggest size</span><b>${player.stats.peakSize} cells</b></li>
         <li><span>Nutrients gathered</span><b>${Math.round(player.stats.nutrientsGathered)}</b></li>
         <li><span>Rivals eliminated</span><b>${rivalsOut} / ${rivals}</b></li>
         <li><span>Seed</span><b>${run.runSeed}</b></li>`
      : '';
    const buttons = win
      ? `<button class="btn" data-act="nextRound">Next round</button><button class="btn" data-act="quitToTitle">Quit to title</button>`
      : `<button class="btn" data-act="newRun">New run</button><button class="btn" data-act="quitToTitle">Quit to title</button>`;
    return `<div class="screen"><div class="panel big ${win ? 'win' : 'lose'}">
      <h2>${win ? 'You win!' : 'You were eaten!'}</h2>
      <p>${win ? `Round ${run.roundNumber} cleared. Round ${run.roundNumber + 1} gets harder.` : `You reached round ${run.roundNumber}. The next run starts again at round 1.`}</p>
      <ul class="stats">${stats}</ul>
      <p class="best">Best round: <b>${run.bestRound}</b></p>
      ${buttons}
    </div></div>`;
  }
}
