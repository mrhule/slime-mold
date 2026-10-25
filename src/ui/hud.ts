import type { HudModel } from '../sim/types';
import { reasonText } from './messages';

/** Comic-panel HUD (R19) bound to a HudModel. Plain DOM, no framework. */
export class Hud {
  private readonly nutrients: HTMLElement;
  private readonly income: HTMLElement;
  private readonly starved: HTMLElement;
  private readonly targets: HTMLElement;
  private readonly toastEl: HTMLElement;
  private toastTimer = 0;

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="panel hud">
        <div class="panel-title">Slime Mold</div>
        <div class="row"><span class="label">Nutrients</span><span class="value" data-hud="nutrients">0</span></div>
        <div class="row"><span class="label">Income</span><span class="value" data-hud="income">+0.0/s</span></div>
        <div class="row"><span class="label">Growing to</span><span class="value" data-hud="targets">0</span></div>
        <div class="burst" data-hud="starved" hidden>GROWTH STARVED!</div>
        <div class="hint">Click the map to grow there. Right-click a marker to cancel.</div>
      </div>
      <div class="toast" data-hud="toast" hidden></div>`,
    );
    const q = (name: string): HTMLElement => root.querySelector(`[data-hud="${name}"]`) as HTMLElement;
    this.nutrients = q('nutrients');
    this.income = q('income');
    this.starved = q('starved');
    this.targets = q('targets');
    this.toastEl = q('toast');
  }

  update(hud: HudModel): void {
    this.nutrients.textContent = hud.storedNutrients.toFixed(1);
    const sign = hud.netIncome >= 0 ? '+' : '';
    this.income.textContent = `${sign}${hud.netIncome.toFixed(1)}/s`;
    this.income.classList.toggle('neg', hud.netIncome < 0);
    this.targets.textContent = String(hud.targets.length);
    this.starved.hidden = !hud.growthStarved;
  }

  /** short message for a rejected command */
  reject(reason: string): void {
    this.toast(reasonText(reason));
  }

  toast(message: string, seconds = 2): void {
    this.toastEl.textContent = message;
    this.toastEl.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.hidden = true), seconds * 1000);
  }
}
