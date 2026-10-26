/**
 * The round touch buttons that replace keys and right-click: Clear all targets (Shift + right-click)
 * and Home (H). They are always in the page but only shown under the `touch` root class.
 */
export interface TouchBarActions {
  onClearTargets(): void;
  onHome(): void;
}

export class TouchBar {
  constructor(parent: HTMLElement, actions: TouchBarActions) {
    parent.insertAdjacentHTML(
      'beforeend',
      `<div class="touch-bar">
        <button type="button" class="round" data-touch="home" aria-label="Go to my core" title="Go to my core">&#8962;</button>
        <button type="button" class="round" data-touch="clear" aria-label="Clear all growth targets" title="Clear all growth targets">&#10005;</button>
      </div>`,
    );
    const root = parent.querySelector('.touch-bar') as HTMLElement;
    root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-touch]') as HTMLElement | null;
      if (!btn) return;
      if (btn.dataset.touch === 'home') actions.onHome();
      else actions.onClearTargets();
    });
  }
}
