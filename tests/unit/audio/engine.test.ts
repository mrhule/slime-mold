import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../../../src/audio/engine';
import { defaultSettings } from '../../../src/audio/settings';

/** a node-like object that accepts every call the engine might make */
function node(): Record<string, unknown> {
  const gain = { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() };
  return { gain, connect: vi.fn(), disconnect: vi.fn(), frequency: { ...gain, value: 0 }, start: vi.fn(), stop: vi.fn(), Q: { value: 1 }, type: '' };
}

/** a minimal fake AudioContext */
function fakeContext() {
  const gains: Record<string, unknown>[] = [];
  const ctx = {
    state: 'running' as string,
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume: vi.fn(() => {
      ctx.state = 'running';
      return Promise.resolve();
    }),
    suspend: vi.fn(() => {
      ctx.state = 'suspended';
      return Promise.resolve();
    }),
    createGain: vi.fn(() => {
      const g = node();
      gains.push(g);
      return g;
    }),
    createOscillator: vi.fn(() => node()),
    createBiquadFilter: vi.fn(() => node()),
    createBufferSource: vi.fn(() => node()),
    createBuffer: vi.fn((_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) })),
  };
  return { ctx, gains };
}

afterEach(() => vi.useRealTimers());

describe('audio engine with no audio (FR-002, edge case: blocked or missing audio)', () => {
  it('never throws when no AudioContext exists', () => {
    const engine = new AudioEngine(() => null);
    expect(() => {
      engine.unlock();
      engine.play({ cue: 'grow', strength: 1 });
      engine.setRunning(true);
      engine.setRunning(false);
      engine.startMusic();
      engine.stopMusic();
      engine.setSettings({ ...defaultSettings(), muted: true });
    }).not.toThrow();
    expect(engine.available).toBe(false);
  });

  it('never throws when the AudioContext constructor throws', () => {
    const engine = new AudioEngine(() => {
      throw new Error('blocked');
    });
    expect(() => {
      engine.unlock();
      engine.play({ cue: 'warn', strength: 1 });
      engine.startMusic();
    }).not.toThrow();
  });

  it('ignores play before unlock', () => {
    const { ctx } = fakeContext();
    const engine = new AudioEngine(() => ctx as unknown as AudioContext);
    engine.setRunning(true);
    engine.play({ cue: 'grow', strength: 1 });
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });
});

describe('audio engine with a minimal fake context', () => {
  it('setRunning(false) suspends and setRunning(true) resumes', () => {
    const { ctx } = fakeContext();
    const engine = new AudioEngine(() => ctx as unknown as AudioContext);
    engine.unlock();
    engine.setRunning(false);
    expect(ctx.suspend).toHaveBeenCalled();
    engine.setRunning(true);
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('mute sets the master gain to zero and unmute restores it', () => {
    const { ctx, gains } = fakeContext();
    const engine = new AudioEngine(() => ctx as unknown as AudioContext);
    engine.unlock();
    const [master, sfx, music] = gains as unknown as { gain: { value: number } }[];
    if (!master || !sfx || !music) throw new Error('buses missing');
    // the engine builds master first, then sfx, then music
    engine.setSettings({ ...defaultSettings(), muted: true, sfxVolume: 0.5, musicVolume: 0.4 });
    expect(master.gain.value).toBe(0);
    expect(sfx.gain.value).toBe(0.5);
    expect(music.gain.value).toBeGreaterThan(0);
    engine.setSettings({ ...defaultSettings(), muted: false });
    expect(master.gain.value).toBe(1);
  });

  it('plays a cue only while playing and not muted', () => {
    const { ctx } = fakeContext();
    const engine = new AudioEngine(() => ctx as unknown as AudioContext, () => 0);
    engine.unlock();
    engine.play({ cue: 'place', strength: 1 });
    expect(ctx.createOscillator).not.toHaveBeenCalled(); // not running yet
    engine.setRunning(true);
    engine.play({ cue: 'place', strength: 1 });
    expect(ctx.createOscillator).toHaveBeenCalled();
    ctx.createOscillator.mockClear();
    engine.setSettings({ ...defaultSettings(), muted: true });
    engine.play({ cue: 'place', strength: 1 });
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it('rate-limits repeated cues', () => {
    const { ctx } = fakeContext();
    let now = 0;
    const engine = new AudioEngine(() => ctx as unknown as AudioContext, () => now);
    engine.unlock();
    engine.setRunning(true);
    engine.play({ cue: 'refuse', strength: 1 });
    const after1 = ctx.createOscillator.mock.calls.length;
    now = 10;
    engine.play({ cue: 'refuse', strength: 1 }); // inside the minimum interval
    expect(ctx.createOscillator.mock.calls.length).toBe(after1);
    now = 1000;
    engine.play({ cue: 'refuse', strength: 1 });
    expect(ctx.createOscillator.mock.calls.length).toBeGreaterThan(after1);
  });

  it('starts music once and survives a context that cannot build it', () => {
    vi.useFakeTimers();
    const { ctx } = fakeContext();
    const engine = new AudioEngine(() => ctx as unknown as AudioContext);
    engine.unlock();
    engine.startMusic();
    engine.startMusic();
    expect(ctx.createOscillator.mock.calls.length).toBeGreaterThan(0);
    const created = ctx.createOscillator.mock.calls.length;
    engine.startMusic(); // already playing: no second drone
    expect(ctx.createOscillator.mock.calls.length).toBe(created);
    engine.stopMusic();
    const broken = { ...ctx, createGain: undefined } as unknown as AudioContext;
    const engine2 = new AudioEngine(() => broken);
    expect(() => {
      engine2.unlock();
      engine2.startMusic();
    }).not.toThrow();
  });
});
