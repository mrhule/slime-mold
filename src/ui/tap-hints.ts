/**
 * Touch has no hover, so the `title` hints desktop shows on hover are shown on tap instead (M7).
 * `hintFor` finds the text for a tapped element; `installTapHints` wires it to a click listener.
 */
interface HintTarget {
  closest(selector: string): { getAttribute(name: string): string | null } | null;
}

const HINT_AREAS = '.hud, .farm-panel, .touch-bar';

/** the hint for a tapped element: its own or its nearest ancestor's title, inside the HUD, farm panel or round buttons */
export function hintFor(target: HintTarget | null): string | null {
  if (!target) return null;
  if (!target.closest(HINT_AREAS)) return null;
  const el = target.closest('[title]');
  const text = el?.getAttribute('title')?.trim();
  return text ? text : null;
}

export function installTapHints(root: HTMLElement, isTouch: () => boolean, show: (text: string) => void): void {
  root.addEventListener('click', (e) => {
    if (!isTouch()) return;
    const hint = hintFor(e.target as HTMLElement | null);
    if (hint) show(hint);
  });
}
