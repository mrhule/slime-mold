import { describe, expect, it } from 'vitest';
import { STEPS, Tutorial } from '../../../src/game/tutorial';
import type { TutorialSnapshot } from '../../../src/game/tutorial';

const snap = (over: Partial<TutorialSnapshot> = {}): TutorialSnapshot => ({ round: 1, seconds: 0, targets: 0, cells: 1, factories: 0, gathered: 0, rivalSeen: false, ...over });

function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('tutorial', () => {
  it('is quiet until it is started', () => {
    expect(new Tutorial(null).update(snap())).toBeNull();
  });

  it('moves on as the player does each thing', () => {
    const t = new Tutorial(null);
    t.start();
    expect(t.update(snap())?.id).toBe('grow');
    expect(t.update(snap({ targets: 1, cells: 20 }))?.id).toBe('factory');
    expect(t.update(snap({ targets: 1, cells: 20, factories: 1 }))?.id).toBe('eat');
    expect(t.update(snap({ factories: 1, gathered: 50, seconds: 100 }))?.id).toBe('economy');
    expect(t.update(snap({ factories: 1, gathered: 50, seconds: 113 }))?.id).toBe('fight');
  });

  it('skips lessons the player has already done', () => {
    const t = new Tutorial(null);
    t.start();
    expect(t.update(snap({ targets: 1, cells: 30, factories: 1, gathered: 100 }))?.id).toBe('economy');
  });

  it('does not stall on the fight lesson when no rival ever shows up', () => {
    const t = new Tutorial(null);
    t.start();
    const done = { targets: 1, cells: 30, factories: 1, gathered: 100 };
    t.update(snap({ ...done, seconds: 0 }));
    t.update(snap({ ...done, seconds: 13 }));
    expect(t.update(snap({ ...done, seconds: 100 }))?.id).toBe('fight');
    expect(t.update(snap({ ...done, seconds: 170 }))?.id).toBe('win');
  });

  it('ends after the last lesson and is remembered', () => {
    const store = memoryStore();
    const t = new Tutorial(store);
    expect(t.seen).toBe(false);
    t.start();
    const done = { targets: 1, cells: 30, factories: 1, gathered: 100, rivalSeen: true };
    t.update(snap({ ...done, seconds: 0 }));
    t.update(snap({ ...done, seconds: 13 }));
    t.update(snap({ ...done, seconds: 26 }));
    expect(t.update(snap({ ...done, seconds: 40 }))).toBeNull();
    expect(t.running).toBe(false);
    expect(t.seen).toBe(true);
    expect(new Tutorial(store).seen).toBe(true);
  });

  it('can be skipped, and still works without storage', () => {
    const t = new Tutorial(null);
    t.start();
    t.finish();
    expect(t.running).toBe(false);
    expect(t.update(snap())).toBeNull();
  });

  it('words each prompt for touch and mouse', () => {
    expect(STEPS[0]!.text(true, 75)).toContain('Tap');
    expect(STEPS[0]!.text(false, 75)).toContain('Click');
    expect(STEPS[5]!.text(false, 62)).toContain('62%');
  });
});
