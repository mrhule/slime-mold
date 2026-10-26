import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../../../src/audio/engine';
import { TrackPlayer, playlist, shuffled } from '../../../src/audio/tracks';
import type { TrackElement } from '../../../src/audio/tracks';

/** a seeded sequence in 0..1 so shuffles are repeatable */
function seq(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

class FakeEl implements TrackElement {
  src = '';
  preload = '';
  crossOrigin: string | null = null;
  currentTime = 0;
  duration = 100;
  plays = 0;
  pauses = 0;
  private handlers = new Map<string, (() => void)[]>();
  play(): void {
    this.plays++;
  }
  pause(): void {
    this.pauses++;
  }
  addEventListener(type: 'ended' | 'error' | 'timeupdate', fn: () => void): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
  }
  fire(type: 'ended' | 'error' | 'timeupdate'): void {
    for (const fn of this.handlers.get(type) ?? []) fn();
  }
}

function fakeCtx() {
  const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ gain: param(), connect() {}, disconnect() {} });
  const ctx = {
    currentTime: 0,
    destination: {},
    state: 'running',
    createGain: node,
    createMediaElementSource: () => ({ connect() {} }),
    resume: () => Promise.resolve(),
    suspend: () => Promise.resolve(),
  };
  return ctx as unknown as AudioContext;
}

describe('playlist order', () => {
  it('shuffles without losing or repeating a track, and is repeatable for a seed', () => {
    const urls = ['a', 'b', 'c', 'd', 'e'];
    const out = shuffled(urls, seq(7));
    expect([...out].sort()).toEqual(urls);
    expect(shuffled(urls, seq(7))).toEqual(out);
    expect(urls).toEqual(['a', 'b', 'c', 'd', 'e']); // the input is untouched
  });

  it('plays every track once per pass, and never starts a pass with the track that just played', () => {
    const urls = ['a', 'b', 'c'];
    const next = playlist(urls, seq(3));
    let last: string | null = null;
    for (let pass = 0; pass < 20; pass++) {
      const seen: string[] = [];
      for (let i = 0; i < urls.length; i++) seen.push(next() as string);
      expect([...seen].sort()).toEqual(urls);
      if (last !== null) expect(seen[0]).not.toBe(last);
      last = seen[seen.length - 1] as string;
    }
  });

  it('handles one track and no tracks', () => {
    const one = playlist(['solo']);
    expect([one(), one(), one()]).toEqual(['solo', 'solo', 'solo']);
    expect(playlist([])()).toBeNull();
  });
});

describe('TrackPlayer', () => {
  function make(urls: string[]) {
    const els: FakeEl[] = [];
    let exhausted = 0;
    const player = new TrackPlayer(fakeCtx(), {} as AudioNode, urls, () => exhausted++, () => {
      const el = new FakeEl();
      els.push(el);
      return el;
    }, seq(5));
    return { player, els, exhausted: () => exhausted };
  }

  it('plays on one element: the next track is a new src on the same element, and it keeps going', () => {
    const { player, els } = make(['a', 'b']);
    player.start();
    expect(els).toHaveLength(1);
    expect(els[0]!.plays).toBe(1);
    expect(player.playing).toBe(true);
    const first = els[0]!.src;
    els[0]!.fire('ended');
    expect(els).toHaveLength(1);
    expect(els[0]!.src).not.toBe(first);
    expect(els[0]!.plays).toBe(2);
    const second = els[0]!.src;
    els[0]!.fire('ended');
    expect(els[0]!.src).not.toBe(second);
    expect(els[0]!.plays).toBe(3);
  });

  it('loops through the whole list over and over until it is stopped', () => {
    const { player, els } = make(['a', 'b', 'c']);
    player.start();
    const seen: string[] = [els[0]!.src];
    for (let i = 0; i < 11; i++) {
      els[0]!.fire('ended');
      seen.push(els[0]!.src);
    }
    expect(new Set(seen)).toEqual(new Set(['a', 'b', 'c']));
    expect(player.playing).toBe(true);
    player.stop();
    els[0]!.fire('ended');
    expect(player.playing).toBe(false);
  });

  it('kick restarts playback unless the player is paused or stopped', () => {
    const { player, els } = make(['a']);
    player.start();
    const plays = els[0]!.plays;
    player.kick();
    expect(els[0]!.plays).toBe(plays + 1);
    player.pause();
    player.kick();
    expect(els[0]!.plays).toBe(plays + 1);
    player.resume();
    player.stop();
    const after = els[0]!.plays;
    player.kick();
    expect(els[0]!.plays).toBe(after);
  });

  it('skips a track that fails and plays the next', () => {
    const { player, els, exhausted } = make(['a', 'b', 'c']);
    player.start();
    els[0]!.fire('error');
    expect(els).toHaveLength(1);
    expect(els[0]!.plays).toBe(2); // moved on to the next track
    expect(exhausted()).toBe(0);
    expect(player.playing).toBe(true);
  });

  it('gives up and reports it when every track fails, so the engine can fall back', () => {
    const { player, els, exhausted } = make(['a', 'b']);
    player.start();
    els[0]!.fire('error');
    els[0]!.fire('error');
    expect(exhausted()).toBe(1);
    expect(player.playing).toBe(false);
  });

  it('a track that played resets the failure count', () => {
    const { player, els, exhausted } = make(['a', 'b']);
    player.start();
    els[0]!.fire('timeupdate'); // it really played
    els[0]!.fire('ended');
    els[0]!.fire('error');
    expect(exhausted()).toBe(0);
  });

  it('pauses and resumes the current track, and stop ends the playlist', () => {
    const { player, els } = make(['a']);
    player.start();
    player.pause();
    expect(els[0]!.pauses).toBeGreaterThan(0);
    const plays = els[0]!.plays;
    player.resume();
    expect(els[0]!.plays).toBe(plays + 1);
    player.stop();
    expect(player.playing).toBe(false);
    const playsAfterStop = els[0]!.plays;
    els[0]!.fire('ended'); // a late event after stop does nothing
    expect(els[0]!.plays).toBe(playsAfterStop);
  });

  it('an empty list reports exhaustion at once', () => {
    const { player, exhausted } = make([]);
    player.start();
    expect(exhausted()).toBe(1);
  });
});

describe('engine with recorded tracks', () => {
  it('plays the tracks instead of the generated loop, and falls back when none load', () => {
    const els: FakeEl[] = [];
    const engine = new AudioEngine(fakeCtxFactory(), () => 0, () => {
      const el = new FakeEl();
      els.push(el);
      return el;
    });
    engine.setTracks(['/music/a.mp3', '/music/b.mp3']);
    engine.unlock();
    engine.setRunning(true);
    engine.startMusic();
    expect(els).toHaveLength(1);
    els[0]!.fire('error');
    els[0]!.fire('error'); // both failed: the engine starts the generated loop (it must not throw)
    expect(els).toHaveLength(1);
  });

  it('with no tracks it never touches an audio element', () => {
    const els: FakeEl[] = [];
    const engine = new AudioEngine(fakeCtxFactory(), () => 0, () => {
      const el = new FakeEl();
      els.push(el);
      return el;
    });
    engine.setTracks([]);
    engine.unlock();
    engine.startMusic();
    expect(els).toHaveLength(0);
  });

  it('pauses the track when the game stops running and resumes it after', () => {
    const els: FakeEl[] = [];
    const engine = new AudioEngine(fakeCtxFactory(), () => 0, () => {
      const el = new FakeEl();
      els.push(el);
      return el;
    });
    engine.setTracks(['/music/a.mp3']);
    engine.unlock();
    engine.setRunning(true);
    engine.startMusic();
    const before = els[0]!.pauses;
    engine.setRunning(false);
    expect(els[0]!.pauses).toBeGreaterThan(before);
    const plays = els[0]!.plays;
    engine.setRunning(true);
    expect(els[0]!.plays).toBeGreaterThan(plays);
  });
});

function fakeCtxFactory(): () => AudioContext {
  return () => fakeCtx();
}
