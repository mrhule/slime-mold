/**
 * Player settings (contracts/settings.md). Stored as JSON under one key and validated field by field
 * on load, so a bad or missing value falls back to its default. Every storage access is in try/catch:
 * with storage blocked the game runs on the defaults and simply does not remember changes (A15).
 */
export interface Settings {
  muted: boolean;
  sfxVolume: number;
  musicVolume: number;
  reduceMotion: boolean;
  quality: 'auto' | 'high' | 'low';
  printTexture: boolean;
  /** touch layout and controls: follow the device (auto), or force on or off (007) */
  touchMode: 'auto' | 'on' | 'off';
}

export type SettingsStore = Pick<Storage, 'getItem' | 'setItem'>;

export const SETTINGS_KEY = 'slime-mold:v1:settings';

/** the browser's localStorage, or null where it is missing or blocked (kept here so audio imports no game code) */
function browserStore(): SettingsStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function defaultSettings(): Settings {
  return {
    muted: false,
    sfxVolume: 0.8,
    musicVolume: 0.5,
    reduceMotion: prefersReducedMotion(),
    quality: 'auto',
    printTexture: false,
    touchMode: 'auto',
  };
}

const volume = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);
const flag = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** `defaults` replaces the built-in defaults (touch mode starts on Low quality); a saved value still wins */
export function loadSettings(store: SettingsStore | null = browserStore(), defaults: Partial<Settings> = {}): Settings {
  const base: Settings = { ...defaultSettings(), ...defaults };
  try {
    const raw = store?.getItem(SETTINGS_KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Record<string, unknown> | null;
    if (!p || typeof p !== 'object') return base;
    return {
      muted: flag(p.muted, base.muted),
      sfxVolume: volume(p.sfxVolume, base.sfxVolume),
      musicVolume: volume(p.musicVolume, base.musicVolume),
      reduceMotion: flag(p.reduceMotion, base.reduceMotion),
      quality: p.quality === 'high' || p.quality === 'low' || p.quality === 'auto' ? p.quality : base.quality,
      printTexture: flag(p.printTexture, base.printTexture),
      touchMode: p.touchMode === 'on' || p.touchMode === 'off' || p.touchMode === 'auto' ? p.touchMode : base.touchMode,
    };
  } catch {
    return base;
  }
}

export function saveSettings(settings: Settings, store: SettingsStore | null = browserStore()): void {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable or full: carry on without it */
  }
}
