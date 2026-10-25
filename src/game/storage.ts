import type { RunStorage } from './run';

const KEY = 'slime-mold:v1:best';

/**
 * Best round, kept in the browser (R17). Every access is wrapped in try/catch: with storage
 * blocked or unavailable the game runs normally and simply does not remember the best round.
 */
export function createStorage(store: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage()): RunStorage {
  return {
    loadBest(): number {
      try {
        const raw = store?.getItem(KEY);
        if (!raw) return 0;
        const parsed = JSON.parse(raw) as { bestRound?: unknown };
        const n = Number(parsed.bestRound);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
      } catch {
        return 0;
      }
    },
    saveBest(round: number): void {
      try {
        store?.setItem(KEY, JSON.stringify({ bestRound: round }));
      } catch {
        /* storage unavailable or full: carry on without it */
      }
    },
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
