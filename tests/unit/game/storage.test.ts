import { describe, expect, it } from 'vitest';
import { createStorage } from '../../../src/game/storage';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('storage', () => {
  it('reads and writes { bestRound } under slime-mold:v1:best', () => {
    const m = memoryStore();
    const s = createStorage(m);
    expect(s.loadBest()).toBe(0);
    s.saveBest(7);
    expect(JSON.parse(m.data.get('slime-mold:v1:best')!)).toEqual({ bestRound: 7 });
    expect(createStorage(m).loadBest()).toBe(7);
  });

  it('survives corrupt data', () => {
    const m = memoryStore();
    m.data.set('slime-mold:v1:best', 'not json');
    expect(createStorage(m).loadBest()).toBe(0);
    m.data.set('slime-mold:v1:best', JSON.stringify({ bestRound: -3 }));
    expect(createStorage(m).loadBest()).toBe(0);
    m.data.set('slime-mold:v1:best', JSON.stringify({ bestRound: 'x' }));
    expect(createStorage(m).loadBest()).toBe(0);
  });

  it('does not throw when storage is missing or throws', () => {
    const none = createStorage(null);
    expect(none.loadBest()).toBe(0);
    expect(() => none.saveBest(3)).not.toThrow();
    const broken = createStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(broken.loadBest()).toBe(0);
    expect(() => broken.saveBest(3)).not.toThrow();
  });
});
