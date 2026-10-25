import { describe, expect, it } from 'vitest';
import { Rng, RngStreams, deriveSeed } from '../../../src/sim/rng';

describe('Rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('gives different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const same = Array.from({ length: 20 }, () => a.next() === b.next()).filter(Boolean).length;
    expect(same).toBeLessThan(2);
  });

  it('stays in range', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(10);
      expect(Number.isInteger(n) && n >= 0 && n < 10).toBe(true);
      const g = r.range(5, 8);
      expect(g >= 5 && g < 8).toBe(true);
      const j = r.jitter(2);
      expect(j >= -2 && j < 2).toBe(true);
    }
  });

  it('pick returns a member', () => {
    const r = new Rng(3);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(items).toContain(r.pick(items));
  });

  it('is roughly uniform', () => {
    const r = new Rng(99);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 10000; i++) buckets[r.int(10)]++;
    for (const n of buckets) expect(n).toBeGreaterThan(800);
  });
});

describe('RngStreams', () => {
  it('draws from one stream do not change another', () => {
    const s1 = new RngStreams(5);
    const s2 = new RngStreams(5);
    s1.get('drops').next();
    s1.get('drops').next();
    expect(s1.get('mapgen').next()).toBe(s2.get('mapgen').next());
  });

  it('named streams differ', () => {
    const s = new RngStreams(5);
    expect(s.get('a').next()).not.toBe(s.get('b').next());
  });

  it('reports state in a stable order', () => {
    const s1 = new RngStreams(5);
    s1.get('b');
    s1.get('a');
    const s2 = new RngStreams(5);
    s2.get('a');
    s2.get('b');
    expect(s1.states()).toEqual(s2.states());
  });
});

describe('deriveSeed', () => {
  it('is stable and varies by round', () => {
    expect(deriveSeed(1234, 1)).toBe(deriveSeed(1234, 1));
    expect(deriveSeed(1234, 1)).not.toBe(deriveSeed(1234, 2));
  });
});
