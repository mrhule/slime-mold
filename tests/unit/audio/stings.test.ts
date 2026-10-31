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
    d.useContact(0); // the molds have already met
    d.update(snap({ playerCells: 100, enemyCells: 100, frontCells: 3 })); // share 0.50
    d.update(snap({ playerCells: 110, enemyCells: 90, frontCells: 3 })); // 0.55, a push
    expect(d.update(snap({ playerCells: 100, enemyCells: 100, frontCells: 3 }))).toBe('stand'); // pushed back to 0.50
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

  it('plays the last stand, not the rally, when the first contact is an attack on a smaller mold', () => {
    const d = new StingDirector();
    expect(d.update(snap({ seconds: 30, playerCells: 30, enemyCells: 100, frontCells: 3 }))).toBe('stand');
    expect(d.update(snap({ seconds: 300, playerCells: 30, enemyCells: 100, frontCells: 9 }))).not.toBe('rally');
  });

  it('plays the fading sting when rivals it has met hold far more, even if the mold never shrank', () => {
    const d = new StingDirector();
    d.useContact(50);
    expect(d.update(snap({ seconds: 130, playerCells: 20, enemyCells: 100 }))).toBe('fading');
  });

  it('says nothing about rivals the mold has never touched: no last stand or outgunned fading from distant growth', () => {
    const d = new StingDirector();
    // far apart the whole time: the enemy simply grows faster, so the player's share keeps sliding
    for (let t = 50; t < 600; t += 5) {
      const player = 100 + (t % 40 < 20 ? 8 : -8);
      expect(d.update(snap({ seconds: t, playerCells: player, enemyCells: 150 + t, frontCells: 0 }))).toBeNull();
    }
  });

  it('does not play the last stand while the mold is winning ground back, but does for a real collapse', () => {
    const run = (shares: number[]): string | null => {
      const d = new StingDirector();
      d.useContact(80);
      let last: string | null = null;
      shares.forEach((sh, i) => {
        last = d.update(snap({ seconds: 100 + i * 4, playerCells: sh * 200, enemyCells: (1 - sh) * 200, frontCells: 3 }));
      });
      return last;
    };
    // up from 0.30, a push to 0.50, then a small slip to 0.45: still well above where it was ten seconds ago
    expect(run([0.3, 0.4, 0.5, 0.45])).toBeNull();
    // a push to 0.60 and then a slip back to 0.40, below where it was ten seconds ago
    expect(run([0.5, 0.55, 0.6, 0.4])).toBe('stand');
  });

  it('plays no rally or last stand for a first contact that was used up by a video', () => {
    const d = new StingDirector();
    d.useContact(100);
    expect(d.update(snap({ seconds: 100, frontCells: 3 }))).toBeNull();
    expect(d.update(snap({ seconds: 400, playerCells: 30, enemyCells: 100, frontCells: 9 }))).not.toBe('rally');
    d.rebase();
    expect(d.update(snap({ seconds: 100, frontCells: 3 }))).toBe('rally');
  });

  it('plays the "again" sting on a new contact a minute or more after the last, picking either recording at random', () => {
    const files = new Set<string | null>();
    for (const roll of [0, 0.99]) {
      const d = new StingDirector(() => roll);
      expect(d.update(snap({ seconds: 20, frontCells: 3 }))).toBe('rally');
      expect(d.update(snap({ seconds: 30, frontCells: 0 }))).toBeNull(); // contact broken
      expect(d.update(snap({ seconds: 90, frontCells: 4 }))).toBe('again'); // 70 seconds on
      expect(d.lastReason).toMatch(/met a rival again/);
      files.add(d.lastFile);
    }
    expect([...files].sort()).toEqual(['second-contact-option-1.mp3', 'second-contact-option-2.mp3']);
  });

  it('does not play the "again" sting for a contact inside a minute of the last, or for one that never broke', () => {
    const d = new StingDirector(() => 0);
    expect(d.update(snap({ seconds: 20, frontCells: 3 }))).toBe('rally');
    expect(d.update(snap({ seconds: 25, frontCells: 0 }))).toBeNull();
    expect(d.update(snap({ seconds: 50, frontCells: 3 }))).toBeNull(); // only 30 seconds after
    expect(d.update(snap({ seconds: 300, frontCells: 3 }))).toBeNull(); // still the same unbroken contact
  });

  it('counts a video as the first contact, so the "again" sting can follow a minute later', () => {
    const d = new StingDirector(() => 0);
    d.useContact(100);
    expect(d.update(snap({ seconds: 101, frontCells: 3 }))).toBeNull();
    expect(d.update(snap({ seconds: 110, frontCells: 0 }))).toBeNull();
    expect(d.update(snap({ seconds: 170, frontCells: 3 }))).toBe('again');
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
