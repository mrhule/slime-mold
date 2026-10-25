import type { RunStorage } from './run';

const KEY = 'slime-mold:v1:best';

export type SafeStore = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Best round, kept in the browser (R17). Every access is wrapped in try/catch: with storage
 * blocked or unavailable the game runs normally and simply does not remember the best round.
 */
export function createStorage(store: SafeStore | null = safeLocalStorage()): RunStorage {
  return {
    loadBest(): number {
      try {
        const parsed = readJson(store, KEY) as { bestRound?: unknown } | null;
        if (!parsed) return 0;
        const n = Number(parsed.bestRound);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
      } catch {
        return 0;
      }
    },
    saveBest(round: number): void {
      writeJson(store, KEY, { bestRound: round });
    },
  };
}

/** the browser's localStorage, or null where it is missing or blocked */
export function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** parsed JSON under `key`, or null when the store is missing, empty, throws, or holds invalid JSON */
export function readJson(store: SafeStore | null, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** store `value` as JSON; quietly does nothing when storage is unavailable or full */
export function writeJson(store: SafeStore | null, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full: carry on without it */
  }
}
