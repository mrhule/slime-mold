export type TouchSetting = 'auto' | 'on' | 'off';

type MatchMedia = (query: string) => { matches: boolean };

/**
 * A touch-first device: the primary pointer is coarse (a finger) and cannot hover (M1). A laptop with
 * a touchscreen and a mouse reports a fine pointer with hover, so it stays in desktop mode.
 */
export function detectTouch(match: MatchMedia | undefined = typeof matchMedia === 'function' ? matchMedia : undefined): boolean {
  try {
    return !!match && match('(pointer: coarse)').matches && match('(hover: none)').matches;
  } catch {
    return false;
  }
}

/** On and Off force the mode; Auto follows the device */
export function resolveTouch(setting: TouchSetting, detected: boolean): boolean {
  return setting === 'on' || (setting === 'auto' && detected);
}

/** the `touch` class on the root switches the whole interface to its touch layout */
export function applyTouchClass(on: boolean, root: { classList: { toggle(name: string, force?: boolean): boolean } } = document.documentElement): void {
  root.classList.toggle('touch', on);
}
