import { describe, expect, it } from 'vitest';
import { SETTINGS_KEY, defaultSettings, loadSettings, saveSettings } from '../../../src/audio/settings';
import type { Settings } from '../../../src/audio/settings';

/** a minimal in-memory store */
function memory(initial?: string): { store: Pick<Storage, 'getItem' | 'setItem'>; data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SETTINGS_KEY, initial);
  return { data, store: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) } };
}

const base = defaultSettings();

describe('settings (contracts/settings.md, A15)', () => {
  it('has the documented defaults', () => {
    expect(base).toMatchObject({ muted: false, sfxVolume: 0.8, musicVolume: 0.5, quality: 'auto', printTexture: false });
    expect(typeof base.reduceMotion).toBe('boolean');
  });

  it('falls back to the defaults when storage is empty, missing, throws, or holds junk', () => {
    expect(loadSettings(memory().store)).toEqual(base);
    expect(loadSettings(null)).toEqual(base);
    expect(loadSettings({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} })).toEqual(base);
    expect(loadSettings(memory('{not json').store)).toEqual(base);
    expect(loadSettings(memory('null').store)).toEqual(base);
    expect(loadSettings(memory('42').store)).toEqual(base);
  });

  it('validates each field on its own: bad fields default, good ones are kept', () => {
    const { store } = memory(JSON.stringify({ muted: true, sfxVolume: 'loud', musicVolume: 0.2, reduceMotion: 'yes', quality: 'ultra', printTexture: true }));
    expect(loadSettings(store)).toEqual({ ...base, muted: true, musicVolume: 0.2, printTexture: true });
  });

  it('clamps volumes to 0..1 and ignores non-finite ones', () => {
    const { store } = memory(JSON.stringify({ sfxVolume: 7, musicVolume: -3 }));
    expect(loadSettings(store)).toMatchObject({ sfxVolume: 1, musicVolume: 0 });
    expect(loadSettings(memory('{"sfxVolume": null}').store).sfxVolume).toBe(base.sfxVolume);
  });

  it('falls back to auto for an unknown quality and accepts the three known ones', () => {
    for (const q of ['auto', 'high', 'low'] as const) expect(loadSettings(memory(JSON.stringify({ quality: q })).store).quality).toBe(q);
    expect(loadSettings(memory(JSON.stringify({ quality: 'medium' })).store).quality).toBe('auto');
  });

  it('round-trips a saved value', () => {
    const { store, data } = memory();
    const s: Settings = { muted: true, sfxVolume: 0.3, musicVolume: 0.9, reduceMotion: true, quality: 'low', printTexture: true, touchMode: 'on' };
    saveSettings(s, store);
    expect(data.has(SETTINGS_KEY)).toBe(true);
    expect(loadSettings(store)).toEqual(s);
  });

  it('does not throw when saving to a store that throws, or to no store', () => {
    expect(() => saveSettings(base, { getItem: () => null, setItem: () => { throw new Error('quota'); } })).not.toThrow();
    expect(() => saveSettings(base, null)).not.toThrow();
  });
});

describe('touch mode setting (007)', () => {
  it('defaults to auto and rejects unknown values', () => {
    expect(defaultSettings().touchMode).toBe('auto');
    expect(loadSettings(memory(JSON.stringify({ touchMode: 'maybe' })).store).touchMode).toBe('auto');
    expect(loadSettings(memory(JSON.stringify({ touchMode: 'on' })).store).touchMode).toBe('on');
  });

  it('default overrides apply when nothing is saved, and a saved value still wins', () => {
    expect(loadSettings(memory().store, { quality: 'low' }).quality).toBe('low');
    expect(loadSettings(memory(JSON.stringify({ quality: 'high' })).store, { quality: 'low' }).quality).toBe('high');
    expect(loadSettings(memory(JSON.stringify({ muted: true })).store, { quality: 'low' }).quality).toBe('low');
  });
});
