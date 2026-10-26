import type { HudModel } from '../sim/types';
import { reasonText } from './messages';

export interface HudActions {
  onTogglePause(): void;
  onSpeed(speed: 1 | 2 | 3): void;
  onAllocation(value: number): void;
  onToggleMute(): void;
  onEvolve(): void;
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
        <div class="row" title="Nutrients stored across your whole mold, against how much your pieces can hold. Build factories to hold more."><span class="label">Nutrients</span><span class="value" data-hud="nutrients">0</span></div>
        <div class="row flow" title="Nutrients arriving per second: your core, food you have eaten, and goo pools with a store house"><span class="label">Income</span><span class="value pos" data-hud="inflow">+0.0/s</span></div>
        <div class="row flow" data-hud="upkeepRow" title="Upkeep owed per second: every vein cell and building costs a little to keep alive"><span class="label">Upkeep</span><span class="value out" data-hud="upkeep">-0.0/s</span></div>
        <div class="row flow" data-hud="growthRow" hidden title="Nutrients spent per second pushing your veins outward"><span class="label">Growing</span><span class="value out" data-hud="growth">-0.0/s</span></div>
        <div class="row flow" data-hud="fightRow" hidden title="Nutrients spent per second fighting at the fronts"><span class="label">Fighting</span><span class="value out" data-hud="fight">-0.0/s</span></div>
        <div class="row net" title="Income minus everything you spend, per second. Below zero and your stock drains."><span class="label">Net</span><span class="value pos" data-hud="income">+0.0/s</span></div>
        <div class="row" data-hud="controlRow" title="Share of the map you hold. Win at ${Math.round(winControl * 100)}%, or eliminate every rival."><span class="label">Map control</span><span class="value" data-hud="control">0%</span></div>
        <div class="meter" data-hud="controlMeter" title="Win at ${Math.round(winControl * 100)}%"><div class="meter-fill" data-hud="controlFill"></div><div class="meter-goal"></div></div>
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
        <button type="button" class="alloc-chip" data-hud="chip" title="Growth versus fight: tap to change">Fight 30%</button>
        <button type="button" class="evolve" data-hud="evolve" hidden title="Spend a fixed amount of nutrients to evolve and unlock new buildings (V). The price does not grow with your factories.">Evolve</button>
        <div class="burst" data-hud="starved" hidden>GROWTH STARVED!</div>
        <div class="warn easing" data-hud="easing" hidden></div>
        <div class="warn" data-hud="dying" hidden>VEINS DYING BACK: upkeep is more than your stock can pay. Eat food, build a Factory on a goo pool, or stop growing.</div>
        <div class="warn" data-hud="unlinked" hidden></div>
        <div class="rivals" data-hud="rivals"></div>
        <div class="hint kbd-only">Click the map to grow there. Right-click a marker to cancel, or a vein to cut it.</div>
      </div>
      <button type="button" class="mute-btn" data-hud="mute" aria-label="Mute" aria-pressed="false" title="Mute or unmute sound">
        <svg viewBox="0 0 28 24" width="28" height="24" aria-hidden="true">
          <g stroke="#14110f" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
            <path d="M3 9 H8 L14 4 V20 L8 15 H3 Z" fill="#fff6dc"/>
            <g data-part="waves" fill="none"><path d="M18 8 Q21 12 18 16"/><path d="M21 5 Q26 12 21 19"/></g>
            <path data-part="slash" d="M17 6 L26 18" stroke="#e0432a" stroke-width="3" hidden/>
          </g>
        </svg>
      </button>
      <div class="toast" data-hud="toast" hidden></div>`,
    );
    const q = (name: string): HTMLElement => root.querySelector(`[data-hud="${name}"]`) as HTMLElement;
    for (const k of ['round', 'time', 'nutrients', 'income', 'inflow', 'upkeep', 'upkeepRow', 'growth', 'growthRow', 'fight', 'fightRow', 'dying', 'control', 'controlFill', 'controlRow', 'controlMeter', 'easing', 'starved', 'unlinked', 'rivals', 'toast', 'mute', 'chip', 'evolve']) this.el[k] = q(k);
    this.el.mute!.addEventListener('click', () => this.actions.onToggleMute());
    this.el.evolve!.addEventListener('click', () => this.actions.onEvolve());
    this.slider = q('alloc') as HTMLInputElement;
    this.speedButtons = [...root.querySelectorAll<HTMLButtonElement>('.clock button')];

    // touch mode: the slider is hidden behind a chip that shows the split and opens a big slider, which
    // closes when released or when the player taps anywhere else
    const hudEl = root.querySelector('.hud') as HTMLElement;
    const chip = this.el.chip as HTMLElement;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      hudEl.classList.toggle('alloc-open');
    });
    this.slider.addEventListener('change', () => hudEl.classList.remove('alloc-open'));
    document.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.slider')) hudEl.classList.remove('alloc-open');
    });

    this.slider.addEventListener('pointerdown', () => (this.sliderActive = true));
    window.addEventListener('pointerup', () => (this.sliderActive = false));
    this.slider.addEventListener('input', () => this.actions.onAllocation(Number(this.slider.value)));
    // give keyboard focus back to the game so hotkeys keep working after using the slider
    this.slider.addEventListener('change', () => this.slider.blur());
    for (const b of this.speedButtons) {
      b.addEventListener('click', () => {
        const v = b.dataset.speed;
        if (v === 'pause') this.actions.onTogglePause();
        else this.actions.onSpeed(Number(v) as 1 | 2 | 3);
        b.blur();
      });
    }
  }

  /** show the sound state on the mute button */
  setMuted(muted: boolean): void {
    const btn = this.el.mute!;
    btn.setAttribute('aria-pressed', String(muted));
    btn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    btn.classList.toggle('muted', muted);
    (btn.querySelector('[data-part="slash"]') as SVGElement).toggleAttribute('hidden', !muted);
    (btn.querySelector('[data-part="waves"]') as SVGElement).style.opacity = muted ? '0.35' : '1';
  }

  update(hud: HudModel, clock: HudClock): void {
    this.el.round!.textContent = String(hud.round);
    this.el.time!.textContent = fmtTime(hud.elapsedSeconds);
    this.el.nutrients!.textContent = `${hud.stock.total.toFixed(1)} / ${Math.round(hud.stock.cap)}${hud.stock.full ? ' FULL' : ''}`;
    this.el.nutrients!.classList.toggle('neg', hud.stock.full);
    const evolveBtn = this.el.evolve as HTMLButtonElement;
    const t = hud.tier;
    evolveBtn.hidden = t.current >= t.max;
    evolveBtn.classList.toggle('ready', t.ready);
    evolveBtn.textContent = t.ready ? `Evolve to tier ${t.current + 1} (V): costs ${Math.round(t.cost)}` : `Evolve: needs ${Math.round(t.cost)} nutrients`;
    const f = hud.flow;
    const upkeep = f.veins + f.buildings;
    const net = f.income - upkeep - f.growth - f.fight;
    this.el.inflow!.textContent = `+${f.income.toFixed(1)}/s`;
    this.el.upkeep!.textContent = `-${upkeep.toFixed(1)}/s`;
    this.el.upkeep!.classList.toggle('neg', hud.starving);
    (this.el.upkeepRow as HTMLElement).title = `Upkeep owed per second: veins ${f.veins.toFixed(1)}, buildings ${f.buildings.toFixed(1)}`;
    (this.el.growthRow as HTMLElement).hidden = f.growth < 0.05;
    this.el.growth!.textContent = `-${f.growth.toFixed(1)}/s`;
    (this.el.fightRow as HTMLElement).hidden = f.fight < 0.05;
    this.el.fight!.textContent = `-${f.fight.toFixed(1)}/s`;
    this.el.income!.textContent = `${net >= 0 ? '+' : '-'}${Math.abs(net).toFixed(1)}/s`;
    this.el.income!.classList.toggle('neg', net < 0);
    this.el.income!.classList.toggle('pos', net >= 0);
    this.el.dying!.hidden = !hud.starving;
    this.el.control!.textContent = `${Math.round(hud.mapControl * 100)}%`;
    (this.el.controlFill as HTMLElement).style.width = `${Math.min(100, (hud.mapControl / hud.winControl) * 100)}%`;
    const goal = `${Math.round(hud.winControl * 100)}%`;
    (this.el.controlRow as HTMLElement).title = `Share of the map you hold. Win at ${goal}, or eliminate every rival.`;
    (this.el.controlMeter as HTMLElement).title = `Win at ${goal}`;
    const eased = hud.winControl < this.winControl - 1e-6;
    this.el.easing!.hidden = !eased;
    if (eased) this.el.easing!.textContent = `The dish is drying out: you now win at ${goal} control.`;
    this.el.starved!.hidden = !hud.growthStarved;
    const waiting = hud.pools.waiting;
    this.el.unlinked!.hidden = waiting === 0;
    if (waiting > 0) this.el.unlinked!.textContent = `${waiting} goo ${waiting === 1 ? 'pool is' : 'pools are'} waiting: build a Factory (F) on the same vein`;
    if (!this.sliderActive && document.activeElement !== this.slider) this.slider.value = String(hud.allocation);
    this.el.chip!.textContent = `Fight ${Math.round(hud.allocation * 100)}%`;
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
