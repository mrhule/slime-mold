import { capOf, farmIncomeAt, farmLinked, farmUpkeepAt, pendingFarmLevel } from '../sim';
import { TICK_DT } from '../sim/types';
import type { World } from '../sim/types';

/**
 * The comic panel for the selected slime pool (contracts/controls.md): output pips, income and upkeep
 * at that level, a status line, and - / + buttons. It only reads the world; the buttons ask the
 * caller to nudge the level, which becomes a `setFarmOutput` command.
 */
export class FarmPanel {
  private readonly root: HTMLElement;
  private readonly pips: HTMLElement;
  private readonly income: HTMLElement;
  private readonly upkeep: HTMLElement;
  private readonly status: HTMLElement;
  private lastKey = '';

  constructor(parent: HTMLElement, onNudge: (delta: 1 | -1) => void) {
    parent.insertAdjacentHTML(
      'beforeend',
      `<div class="panel farm-panel" hidden>
        <div class="panel-title">Slime Pool</div>
        <div class="dial">
          <button type="button" data-delta="-1" title="Less output ([)" aria-label="Less output">&minus;</button>
          <div class="pips" data-f="pips" role="img"></div>
          <button type="button" data-delta="1" title="More output (])" aria-label="More output">+</button>
        </div>
        <div class="row"><span class="label">Income</span><span class="value" data-f="income"></span></div>
        <div class="row"><span class="label">Upkeep</span><span class="value" data-f="upkeep"></span></div>
        <div class="farm-status" data-f="status"></div>
        <div class="hint">[ and ] change the output. Esc to close.</div>
      </div>`,
    );
    this.root = parent.querySelector('.farm-panel') as HTMLElement;
    const q = (f: string): HTMLElement => this.root.querySelector(`[data-f="${f}"]`) as HTMLElement;
    this.pips = q('pips');
    this.income = q('income');
    this.upkeep = q('upkeep');
    this.status = q('status');
    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-delta]') as HTMLButtonElement | null;
      if (btn) onNudge(Number(btn.dataset.delta) as 1 | -1);
    });
  }

  /** show the farm with this building id, or hide the panel when it is null or gone */
  update(world: Readonly<World>, buildingId: number | null): void {
    const b = buildingId === null ? undefined : world.buildings[buildingId];
    if (!b || b.destroyed || b.type !== 'farm') {
      this.root.hidden = true;
      this.lastKey = '';
      return;
    }
    const level = pendingFarmLevel(world, b.id);
    const max = world.balance.buildings.farm.maxLevel;
    const linked = farmLinked(world, b);
    const comp = world.components.get(world.component[b.cell] as number);
    const income = farmIncomeAt(world, level);
    const throttled = linked && level > 0 && !!comp && comp.pool >= capOf(world, comp) - income * TICK_DT * 2;
    const state = level === 0 ? 'parked' : !linked ? 'unlinked' : throttled ? 'throttled' : 'working';
    const key = `${level}|${state}|${income.toFixed(2)}`;
    this.root.hidden = false;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.pips.innerHTML = Array.from({ length: max }, (_, i) => `<span class="pip${i < level ? ' on' : ''}"></span>`).join('');
    this.pips.setAttribute('aria-label', `Output level ${level} of ${max}`);
    this.pips.title = `Output level ${level} of ${max}`;
    this.income.textContent = `+${income.toFixed(2)}/s${linked ? '' : ' (not paying)'}`;
    this.upkeep.textContent = `-${farmUpkeepAt(world, level).toFixed(2)}/s`;
    this.status.className = `farm-status ${state}`;
    this.status.textContent =
      state === 'parked'
        ? 'Parked: no income, no upkeep'
        : state === 'unlinked'
          ? 'Unlinked: build a store house on this vein'
          : state === 'throttled'
            ? 'Throttled: the store is full'
            : 'Working';
  }
}
