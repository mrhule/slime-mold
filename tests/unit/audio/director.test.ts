import { describe, expect, it } from 'vitest';
import { Director } from '../../../src/audio/director';
import type { DirectorSnapshot } from '../../../src/audio/director';
import type { SimEvent } from '../../../src/sim/types';

const snap = (over: Partial<DirectorSnapshot> = {}): DirectorSnapshot => ({
  playerId: 1,
  nowMs: 0,
  playerCells: 10,
  playerGathered: 0,
  runState: 'playing',
  outcome: null,
  visibleDeaths: [],
  events: [],
  ...over,
});

const cues = (d: Director, s: DirectorSnapshot): string[] => d.update(s).map((r) => r.cue);

describe('director (contracts/audio-cues.md)', () => {
  it('plays grow when the player cell count rises, and nothing when it falls', () => {
    const d = new Director();
    d.update(snap({ playerCells: 10 })); // baseline
    expect(cues(d, snap({ playerCells: 14 }))).toContain('grow');
    expect(cues(d, snap({ playerCells: 14 }))).not.toContain('grow');
    expect(cues(d, snap({ playerCells: 9 }))).not.toContain('grow');
  });

  it('strength grows with how much changed and is capped at 1', () => {
    const d = new Director();
    d.update(snap({ playerCells: 10 }));
    const small = d.update(snap({ playerCells: 11 })).find((r) => r.cue === 'grow')!;
    const big = d.update(snap({ playerCells: 500 })).find((r) => r.cue === 'grow')!;
    expect(small.strength).toBeLessThan(big.strength);
    expect(big.strength).toBe(1);
    expect(small.strength).toBeGreaterThan(0);
  });

  it('plays squelch when nutrients gathered rise', () => {
    const d = new Director();
    d.update(snap({ playerGathered: 5 }));
    expect(cues(d, snap({ playerGathered: 5 }))).not.toContain('squelch');
    expect(cues(d, snap({ playerGathered: 6.5 }))).toContain('squelch');
  });

  it('plays warn and land from the drop events', () => {
    const d = new Director();
    d.update(snap());
    const warn: SimEvent = { type: 'dropWarning', dropId: 1, cell: 5, foodType: 'sugarCube' };
    const land: SimEvent = { type: 'dropLanded', dropId: 1, foodSourceId: 2 };
    expect(cues(d, snap({ events: [warn] }))).toEqual(['warn']);
    expect(cues(d, snap({ events: [land] }))).toEqual(['land']);
  });

  it("plays place and refuse only for the player's mold", () => {
    const d = new Director();
    d.update(snap());
    const mine: SimEvent[] = [
      { type: 'buildingPlaced', id: 0, building: 'farm', mold: 1, cell: 3 },
      { type: 'commandRejected', mold: 1, reason: 'cant-afford' },
    ];
    const theirs: SimEvent[] = [
      { type: 'buildingPlaced', id: 1, building: 'farm', mold: 2, cell: 9 },
      { type: 'commandRejected', mold: 2, reason: 'cant-afford' },
    ];
    expect(cues(d, snap({ events: mine }))).toEqual(['place', 'refuse']);
    expect(cues(d, snap({ events: theirs }))).toEqual([]);
  });

  it('plays frontWon when visible enemy deaths dominate and frontLost when own deaths dominate', () => {
    const won = new Director();
    won.update(snap());
    expect(cues(won, snap({ nowMs: 100, visibleDeaths: [{ own: false, byEnemy: true }, { own: false, byEnemy: true }, { own: true, byEnemy: true }] }))).toContain('frontWon');
    const lost = new Director();
    lost.update(snap());
    expect(cues(lost, snap({ nowMs: 100, visibleDeaths: [{ own: true, byEnemy: true }, { own: true, byEnemy: true }, { own: false, byEnemy: true }] }))).toContain('frontLost');
  });

  it('a tie or an empty visibleDeaths gives no front cue', () => {
    const d = new Director();
    d.update(snap());
    expect(cues(d, snap({ nowMs: 100, visibleDeaths: [] }))).toEqual([]);
    expect(cues(d, snap({ nowMs: 200, visibleDeaths: [{ own: true, byEnemy: true }, { own: false, byEnemy: true }] }))).toEqual([]);
  });

  it('counts deaths over the last second only', () => {
    const d = new Director();
    d.update(snap());
    d.update(snap({ nowMs: 100, visibleDeaths: [{ own: true, byEnemy: true }, { own: true, byEnemy: true }, { own: true, byEnemy: true }] }));
    // 2.5 s later a single enemy death arrives: the old own deaths no longer count
    expect(cues(d, snap({ nowMs: 2600, visibleDeaths: [{ own: false, byEnemy: true }] }))).toContain('frontWon');
  });

  it('plays roundStart, roundWin and roundLose on state transitions only, once each', () => {
    const d = new Director();
    d.update(snap({ runState: 'title' }));
    expect(cues(d, snap({ runState: 'title' }))).toEqual([]);
    expect(cues(d, snap({ runState: 'playing' }))).toEqual(['roundStart']);
    expect(cues(d, snap({ runState: 'playing' }))).toEqual([]);
    expect(cues(d, snap({ runState: 'paused' }))).toEqual([]);
    expect(cues(d, snap({ runState: 'playing' }))).toEqual([]); // resume is not a new round
    expect(cues(d, snap({ runState: 'roundEnd', outcome: 'victory' }))).toEqual(['roundWin']);
    expect(cues(d, snap({ runState: 'roundEnd', outcome: 'victory' }))).toEqual([]);
    expect(cues(d, snap({ runState: 'playing' }))).toEqual(['roundStart']);
    expect(cues(d, snap({ runState: 'roundEnd', outcome: 'defeat' }))).toEqual(['roundLose']);
  });

  it('does not play anything on the very first snapshot', () => {
    expect(cues(new Director(), snap({ playerCells: 99, playerGathered: 50 }))).toEqual([]);
  });
});
