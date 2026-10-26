/**
 * The touch-only controls that replace keys and right-click: round Clear all targets (Shift +
 * right-click) and Home (H) buttons, and the placement bar (Confirm / Cancel plus the reason a spot
 * is refused, which desktop shows as a hover hint). All of it is hidden unless the root has `touch`.
 */
export interface TouchBarActions {
  onClearTargets(): void;
  onHome(): void;
  /** the pause menu (Esc on a keyboard), which also holds Settings */
  onMenu(): void;
  onConfirmPlacement(): void;
  onCancelPlacement(): void;
}

export interface PlacementState {
  text: string;
  /** the chosen spot is allowed, so Confirm is enabled */
  canConfirm: boolean;
  /** a spot has been chosen (otherwise the text asks for one) */
  hasSpot: boolean;
}

export class TouchBar {
  private readonly placement: HTMLElement;
  private readonly text: HTMLElement;
  private readonly confirm: HTMLButtonElement;
  private lastKey = '';

  constructor(parent: HTMLElement, actions: TouchBarActions) {
    parent.insertAdjacentHTML(
      'beforeend',
      `<div class="touch-bar">
        <button type="button" class="round" data-touch="menu" aria-label="Menu and settings" title="Menu and settings">&#9776;</button>
        <button type="button" class="round" data-touch="home" aria-label="Go to my core" title="Go to my core">&#8962;</button>
        <button type="button" class="round" data-touch="clear" aria-label="Clear all growth targets" title="Clear all growth targets">&#10005;</button>
      </div>
      <div class="placement-bar" hidden>
        <div class="placement-text" data-p="text"></div>
        <button type="button" class="btn-confirm" data-p="confirm">Build</button>
        <button type="button" class="btn-cancel" data-p="cancel">Cancel</button>
      </div>`,
    );
    const root = parent.querySelector('.touch-bar') as HTMLElement;
    root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-touch]') as HTMLElement | null;
      if (!btn) return;
      if (btn.dataset.touch === 'home') actions.onHome();
      else if (btn.dataset.touch === 'menu') actions.onMenu();
      else actions.onClearTargets();
    });
    this.placement = parent.querySelector('.placement-bar') as HTMLElement;
    this.text = this.placement.querySelector('[data-p="text"]') as HTMLElement;
    this.confirm = this.placement.querySelector('[data-p="confirm"]') as HTMLButtonElement;
    this.confirm.addEventListener('click', () => actions.onConfirmPlacement());
    (this.placement.querySelector('[data-p="cancel"]') as HTMLElement).addEventListener('click', () => actions.onCancelPlacement());
  }

  /** show the placement bar for this state, or hide it when null */
  setPlacement(state: PlacementState | null): void {
    if (!state) {
      this.placement.hidden = true;
      this.lastKey = '';
      return;
    }
    this.placement.hidden = false;
    const key = `${state.text}|${state.canConfirm}|${state.hasSpot}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.text.textContent = state.text;
    this.text.classList.toggle('bad', state.hasSpot && !state.canConfirm);
    this.confirm.disabled = !state.canConfirm;
  }
}
