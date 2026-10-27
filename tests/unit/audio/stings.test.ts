import { describe, expect, it } from 'vitest';
import { StingDirector } from '../../../src/audio/stings';
import type { StingSnapshot } from '../../../src/audio/stings';

const snap = (over: Partial<StingSnapshot>): StingSnapshot => ({ seconds: 100, playing: true, playerCells: 100, enemyCells: 100, frontCells: 0, ...over });

describe('StingDirector', () => {
  it('plays the rally the first time the molds touch, even early in a round, and only once', () => {
    const d = new StingDirector();
    expect(d.update(snap({ seconds: 20, frontCells: 0 }))).toBeNull();
    expect(d.update(snap({ seconds: 25, frontCells: 3 }))).toBe('rally');
    expect(d.update(snap({ seconds: 400, frontCells: 9 }))).toBeNull();
  });

  it('plays the fading sting when the mold is down to a fraction of its best size', () => {
    const d = new StingDirector();
    d.update(snap({ playerCells: 100 }));
    expect(d.update(snap({ playerCells: 60 }))).toBeNull();
    expect(d.update(snap({ playerCells: 35 }))).toBe('fading');
  });

  it('plays the last stand when ground gained from the enemy is pushed back', () => {
    const d = new StingDirector();
    d.update(snap({ playerCells: 100, enemyCells: 100 })); // share 0.50
    d.update(snap({ playerCells: 110, enemyCells: 90 })); // 0.55, a push
    expect(d.update(snap({ playerCells: 100, enemyCells: 100 }))).toBe('stand'); // pushed back to 0.50
  });

  it('stays quiet early in a round (but for the first contact), while not playing, and during the cooldown', () => {
    const d = new StingDirector();
    expect(d.update(snap({ seconds: 10, playerCells: 100 }))).toBeNull();
    expect(d.update(snap({ seconds: 10, playerCells: 20 }))).toBeNull(); // a fade too early
    expect(d.update(snap({ playing: false, frontCells: 4 }))).toBeNull();
    expect(d.update(snap({ seconds: 100, frontCells: 4 }))).toBe('rally');
    expect(d.update(snap({ seconds: 120, playerCells: 20 }))).toBeNull(); // within a minute of the last
    expect(d.update(snap({ seconds: 170, playerCells: 20 }))).toBe('fading');
  });

  it('lets the doom stings come back later in a round, but not the rally', () => {
    const d = new StingDirector();
    d.update(snap({ seconds: 50, playerCells: 100 }));
    expect(d.update(snap({ seconds: 100, playerCells: 30 }))).toBe('fading');
    expect(d.update(snap({ seconds: 110, playerCells: 30 }))).toBeNull(); // not grown back yet
    d.update(snap({ seconds: 120, playerCells: 80 })); // recovered
    expect(d.update(snap({ seconds: 190, playerCells: 30 }))).toBeNull(); // too soon after the last
    expect(d.update(snap({ seconds: 400, playerCells: 30 }))).toBe('fading');
    const r = new StingDirector();
    expect(r.update(snap({ frontCells: 2 }))).toBe('rally');
    expect(r.update(snap({ seconds: 1000, frontCells: 2 }))).toBeNull();
  });

  it('can retry a sting that could not play, and starts over each round', () => {
    const d = new StingDirector();
    expect(d.update(snap({ frontCells: 2 }))).toBe('rally');
    d.release('rally');
    expect(d.update(snap({ seconds: 200, frontCells: 2 }))).toBe('rally');
    d.rebase();
    expect(d.update(snap({ seconds: 100, frontCells: 2 }))).toBe('rally');
  });
});
