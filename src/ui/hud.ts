import type { HudModel } from '../sim/types';
import { reasonText } from './messages';

export interface HudActions {
  onTogglePause(): void;
  onSpeed(speed: 1 | 2 | 3): void;
  onAllocation(value: number): void;
}

export interface HudClock {
  speed: 1 | 2 | 3;
  paused: boolean;
}

const fmtTime = (seconds: number): string => {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Comic-panel HUD (R19, FR-026) bound to a HudModel. Plain DOM, no framework. */
export class Hud {
  private readonly el: Record<string, HTMLElement> = {};
  private readonly slider: HTMLInputElement;
  private readonly speedButtons: HTMLButtonElement[];
  private sliderActive = false;
  private toastTimer = 0;
  private rivalKey = '';
  private readonly winControl: number;

  constructor(
    root: HTMLElement,
    private readonly actions: HudActions,
    winControl = 0.75,
  ) {
    this.winControl = winControl;
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="panel hud">
        <div class="panel-title">Slime Mold</div>
        <div class="row"><span class="label">Round</span><span class="value" data-hud="round">1</span></div>
        <div class="row"><span class="label">Time</span><span class="value" data-hud="time">0:00</span></div>
        <div class="row" title="Nutrients stored across your whole mold"><span class="label">Nutrients</span><span class="value" data-hud="nutrients">0</span></div>
        <div class="row" title="Income minus upkeep, per second"><span class="label">Income</span><span class="value" data-hud="income">+0.0/s</span></div>
        <div class="row" title="Share of the map you hold. Win at ${Math.round(winControl * 100)}%, or eliminate every rival."><span class="label">Map control</span><span class="value" data-hud="control">0%</span></div>
        <div class="meter" title="Win at ${Math.round(winControl * 100)}%"><div class="meter-fill" data-hud="controlFill"></div><div class="meter-goal"></div></div>
        <div class="clock" role="group" aria-label="Game speed">
          <button type="button" data-speed="pause" title="Pause (Space)">❚❚</button>
          <button type="button" data-speed="1" title="Normal speed (1)">1x</button>
          <button type="button" data-speed="2" title="Double speed (2)">2x</button>
          <button type="button" data-speed="3" title="Triple speed (3)">3x</button>
        </div>
        <label class="slider" title="Where nutrients go. Growth builds veins faster, Fight sends more to battle fronts. Q / E to nudge.">
          <span class="slider-labels"><span>Growth</span><span>Fight</span></span>
          <input type="range" min="0" max="1" step="0.05" value="0.3" data-hud="alloc" aria-label="Growth versus fight" />
        </label>
        <div class="burst" data-hud="starved" hidden>GROWTH STARVED!</div>
        <div class="rivals" data-hud="rivals"></div>
        <div class="hint">Click the map to grow there. Right-click a marker to cancel.</div>
      </div>
      <div class="toast" data-hud="toast" hidden></div>`,
    );
    const q = (name: string): HTMLElement => root.querySelector(`[data-hud="${name}"]`) as HTMLElement;
    for (const k of ['round', 'time', 'nutrients', 'income', 'control', 'controlFill', 'starved', 'rivals', 'toast']) this.el[k] = q(k);
    this.slider = q('alloc') as HTMLInputElement;
    this.speedButtons = [...root.querySelectorAll<HTMLButtonElement>('.clock button')];

    this.slider.addEventListener('pointerdown', () => (this.sliderActive = true));
    window.addEventListener('pointerup', () => (this.sliderActive = false));
    this.slider.addEventListener('input', () => this.actions.onAllocation(Number(this.slider.value)));
    for (const b of this.speedButtons) {
      b.addEventListener('click', () => {
        const v = b.dataset.speed;
        if (v === 'pause') this.actions.onTogglePause();
        else this.actions.onSpeed(Number(v) as 1 | 2 | 3);
        b.blur();
      });
    }
  }

  update(hud: HudModel, clock: HudClock): void {
    this.el.round!.textContent = String(hud.round);
    this.el.time!.textContent = fmtTime(hud.elapsedSeconds);
    this.el.nutrients!.textContent = hud.storedNutrients.toFixed(1);
    const sign = hud.netIncome >= 0 ? '+' : '';
    this.el.income!.textContent = `${sign}${hud.netIncome.toFixed(1)}/s`;
    this.el.income!.classList.toggle('neg', hud.netIncome < 0);
    this.el.control!.textContent = `${Math.round(hud.mapControl * 100)}%`;
    (this.el.controlFill as HTMLElement).style.width = `${Math.min(100, (hud.mapControl / this.winControl) * 100)}%`;
    this.el.starved!.hidden = !hud.growthStarved;
    if (!this.sliderActive && document.activeElement !== this.slider) this.slider.value = String(hud.allocation);
    for (const b of this.speedButtons) {
      const v = b.dataset.speed;
      b.classList.toggle('on', v === 'pause' ? clock.paused : !clock.paused && Number(v) === clock.speed);
    }
    this.renderRivals(hud);
  }

  private renderRivals(hud: HudModel): void {
    const key = hud.rivals.map((r) => `${r.id}:${r.status}:${r.visibleCells === null ? '?' : r.visibleCells}`).join('|');
    if (key === this.rivalKey) return;
    this.rivalKey = key;
    this.el.rivals!.innerHTML = hud.rivals
      .map((r) => {
        const state = r.status === 'eliminated' ? 'Eliminated' : r.visibleCells === null ? '?' : `${r.visibleCells} seen`;
        return `<div class="rival ${r.status}" title="Rival ${r.id - 1}: ${state}"><span class="swatch c${r.color} p${r.pattern}"></span><span class="rname">Rival ${r.id - 1}</span><span class="rstate">${state}</span></div>`;
      })
      .join('');
  }

  /** short message for a rejected command */
  reject(reason: string): void {
    this.toast(reasonText(reason));
  }

  toast(message: string, seconds = 2): void {
    this.el.toast!.textContent = message;
    this.el.toast!.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.el.toast!.hidden = true), seconds * 1000);
  }
}
