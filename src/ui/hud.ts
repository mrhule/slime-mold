import type { HudModel } from '../sim/types';
import { reasonText } from './messages';

export interface HudActions {
  onTogglePause(): void;
  onSpeed(speed: 1 | 2 | 3): void;
  onAllocation(value: number): void;
  onToggleMute(): void;
  onEvolve(): void;
  onBurst(): void;
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
  private burstState: HudModel['burst']['state'] = 'locked';
  /** the time (ms) until which a first press of the burst button counts as armed */
  private burstArmedUntil = 0;
  private toastTimer = 0;
  private narrTimer = 0;
  private announceTimer = 0;
  private rivalKey = '';
  private controlKey = '';
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
        <div class="row flow" data-hud="fightRow" hidden title="Nutrients spent per second on the war at the fronts"><span class="label">At war</span><span class="value out" data-hud="fight">-0.0/s</span></div>
        <div class="row net" title="Income minus everything you spend, per second. Below zero and your stock drains."><span class="label">Net</span><span class="value pos" data-hud="income">+0.0/s</span></div>
        <div class="row" data-hud="controlRow" title="Share of the map you hold. Win at ${Math.round(winControl * 100)}%, or eliminate every rival."><span class="label">Map control</span><span class="value" data-hud="control">0%</span></div>
        <div class="meter" data-hud="controlMeter" title="Win at ${Math.round(winControl * 100)}%"><div class="meter-fill" data-hud="controlFill"></div><div class="meter-rivals" data-hud="controlRivals"></div><div class="meter-goal" data-hud="controlGoal"></div></div>
        <div class="clock" role="group" aria-label="Game speed">
          <button type="button" data-speed="pause" title="Pause (Space)">❚❚</button>
          <button type="button" data-speed="1" title="Normal speed (1)">1x</button>
          <button type="button" data-speed="2" title="Double speed (2)">2x</button>
          <button type="button" data-speed="3" title="Triple speed (3)">3x</button>
        </div>
        <label class="slider" data-hud="sliderBox" title="Where nutrients go. Growth builds veins faster; War sends more to battle fronts, and your veins hit harder and take less damage. Close to Growth your fronts are weak and easy to lose. Q / E to nudge. The hatched ends are special: all the way to Growth and your veins explore on their own; all the way to War and your mold bleeds nutrients and its veins die back.">
          <span class="slider-labels"><span>Growth</span><span>War</span></span>
          <input type="range" min="0" max="1" step="0.05" value="0.3" data-hud="alloc" aria-label="Growth versus war" />
          <span class="zone-note" data-hud="zoneNote" hidden></span>
        </label>
        <button type="button" class="alloc-chip" data-hud="chip" title="Growth versus war: tap to change">War 30%</button>
        <button type="button" class="evolve" data-hud="evolve" hidden title="Spend a fixed amount of nutrients to evolve and unlock new buildings (V). The price does not grow with your factories.">Evolve</button>
        <button type="button" class="burst-btn" data-hud="burstBtn" hidden></button>
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
      <div class="toast" data-hud="toast" hidden></div>
      <div class="announce" data-hud="announce" hidden><span class="announce-heading" data-hud="announceHeading"></span><span class="announce-sub" data-hud="announceSub"></span></div>
      <div class="narration" data-hud="narration" hidden><span class="narr-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="narr-body"><span class="narr-title" data-hud="narrTitle"></span><span class="narr-text" data-hud="narrText"></span></span></div>`,
    );
    const q = (name: string): HTMLElement => root.querySelector(`[data-hud="${name}"]`) as HTMLElement;
    for (const k of ['round', 'time', 'nutrients', 'income', 'inflow', 'upkeep', 'upkeepRow', 'growth', 'growthRow', 'fight', 'fightRow', 'dying', 'control', 'controlFill', 'controlRivals', 'controlGoal', 'controlRow', 'controlMeter', 'easing', 'starved', 'unlinked', 'rivals', 'toast', 'narration', 'narrTitle', 'narrText', 'announce', 'announceHeading', 'announceSub', 'mute', 'chip', 'sliderBox', 'zoneNote', 'evolve', 'burstBtn']) this.el[k] = q(k);
    this.el.burstBtn!.addEventListener('click', () => this.pressBurst());
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

  /** the spore burst button or its key: the first press asks to be sure, a second press soon after goes all in */
  pressBurst(): void {
    if (this.burstState !== 'ready') return;
    const now = performance.now();
    if (now < this.burstArmedUntil) {
      this.burstArmedUntil = 0;
      this.actions.onBurst();
    } else {
      this.burstArmedUntil = now + 5000;
    }
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
    const atWarNow = hud.allocation >= hud.zones.warMin;
    this.el.dying!.hidden = !hud.starving && !atWarNow;
    this.el.dying!.textContent = hud.starving ? 'VEINS DYING BACK: upkeep is more than your stock can pay. Eat food, build a Factory on a goo pool, or stop growing.' : 'ALL-OUT WAR: your mold bleeds nutrients and its veins are dying back. Slide toward Growth to stop it.';
    const b = hud.burst;
    this.burstState = b.state;
    const btn = this.el.burstBtn as HTMLButtonElement;
    const armed = performance.now() < this.burstArmedUntil;
    btn.hidden = b.state === 'used';
    btn.disabled = b.state !== 'ready';
    btn.classList.toggle('armed', armed && b.state === 'ready');
    btn.classList.toggle('blooming', b.state === 'blooming');
    const target = Math.round(b.target * 100);
    btn.textContent =
      b.state === 'blooming'
        ? `BLOOM! ${Math.ceil(b.secondsLeft)}s left: reach ${target}% control`
        : b.state === 'locked'
          ? `Spore burst unlocks at ${fmtTime(b.unlockIn + hud.elapsedSeconds)}`
          : b.state === 'poor'
            ? `Spore burst: needs ${Math.round(b.cost)} nutrients`
            : armed
              ? `ALL IN? Press again: cover ${target}% or lose!`
              : 'Spore burst (X)';
    btn.title = `A last gamble, once a round: spend ${Math.round(b.cost)} nutrients and spores spring up all over the map and bloom for a while. If you hold ${target}% of the map when the bloom ends you win; if not, you lose.`;
    this.el.control!.textContent = `${Math.round(hud.mapControl * 100)}%`;
    // the bar is the whole map: you first, then each rival you have met in its own colour, with a tick at the win line
    (this.el.controlFill as HTMLElement).style.width = `${Math.min(100, hud.mapControl * 100)}%`;
    (this.el.controlGoal as HTMLElement).style.left = `${Math.min(100, hud.winControl * 100)}%`;
    this.renderControlRivals(hud);
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
    this.el.chip!.textContent = `War ${Math.round(hud.allocation * 100)}%`;
    // the two hatched ends of the slider: how far they reach, and what the mold is doing in one of them
    const box = this.el.sliderBox as HTMLElement;
    box.style.setProperty('--z-explore', `${hud.zones.exploreMax * 100}%`);
    box.style.setProperty('--z-war', `${(1 - hud.zones.warMin) * 100}%`);
    const exploring = hud.allocation <= hud.zones.exploreMax;
    const atWar = hud.allocation >= hud.zones.warMin;
    this.el.zoneNote!.hidden = !(exploring || atWar);
    this.el.zoneNote!.textContent = exploring ? 'Veins are exploring on their own' : atWar ? 'All-out war: nutrients bleed, veins die back' : '';
    this.el.zoneNote!.classList.toggle('war', atWar);
    this.el.chip!.classList.toggle('war', atWar);
    this.el.chip!.classList.toggle('explore', exploring);
    for (const b of this.speedButtons) {
      const v = b.dataset.speed;
      b.classList.toggle('on', v === 'pause' ? clock.paused : !clock.paused && Number(v) === clock.speed);
    }
    this.renderRivals(hud);
  }

  /** a coloured piece of the control bar for each rival the player has met */
  private renderControlRivals(hud: HudModel): void {
    const shown = hud.rivals.filter((r) => r.status === 'alive' && r.control !== null && r.control > 0);
    const key = shown.map((r) => `${r.id}:${((r.control as number) * 100).toFixed(1)}`).join('|');
    if (key === this.controlKey) return;
    this.controlKey = key;
    this.el.controlRivals!.innerHTML = shown
      .map((r) => `<span class="seg c${r.color}" style="width:${Math.min(100, (r.control as number) * 100)}%" title="Rival ${r.id - 1}: ${Math.round((r.control as number) * 100)}% of the map"></span>`)
      .join('');
  }

  private renderRivals(hud: HudModel): void {
    const key = hud.rivals.map((r) => `${r.id}:${r.status}:${r.control === null ? '?' : Math.round(r.control * 100)}`).join('|');
    if (key === this.rivalKey) return;
    this.rivalKey = key;
    this.el.rivals!.innerHTML = hud.rivals
      .map((r) => {
        const state = r.status === 'eliminated' ? 'Eliminated' : r.control === null ? '?' : `${Math.round(r.control * 100)}%`;
        return `<div class="rival ${r.status}" title="Rival ${r.id - 1}: ${state}"><span class="swatch c${r.color} p${r.pattern}"></span><span class="rname">Rival ${r.id - 1}</span><span class="rstate">${state}</span></div>`;
      })
      .join('');
  }

  /** short message for a rejected command */
  reject(reason: string): void {
    this.toast(reasonText(reason));
  }

  /** a big popup in the middle of the screen for a moment that changes the game (first contact), then fading away */
  announce(heading: string, sub: string, seconds: number): void {
    const card = this.el.announce!;
    this.el.announceHeading!.textContent = heading;
    this.el.announceSub!.textContent = sub;
    card.classList.remove('out');
    // restart the pop-in animation when a second one comes up
    card.hidden = true;
    void card.offsetWidth;
    card.hidden = false;
    window.clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => {
      card.classList.add('out');
      this.announceTimer = window.setTimeout(() => (card.hidden = true), 1000);
    }, seconds * 1000);
  }

  /** the narrator card: shown while a spoken sting plays, with bars that dance, then fading away */
  narrate(title: string, text: string, seconds: number): void {
    const card = this.el.narration!;
    this.el.narrTitle!.textContent = title;
    this.el.narrText!.textContent = text;
    card.classList.remove('out');
    card.hidden = false;
    window.clearTimeout(this.narrTimer);
    this.narrTimer = window.setTimeout(() => {
      card.classList.add('out');
      this.narrTimer = window.setTimeout(() => (card.hidden = true), 1500);
    }, seconds * 1000);
  }

  toast(message: string, seconds = 2): void {
    this.el.toast!.textContent = message;
    this.el.toast!.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.el.toast!.hidden = true), seconds * 1000);
  }
}
