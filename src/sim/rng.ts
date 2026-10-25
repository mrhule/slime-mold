/** Seeded PRNG: splitmix32 seeds sfc32. Named streams keep subsystems independent (R11). */

function splitmix32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x9e3779b9) | 0;
    let t = s ^ (s >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mix two 32-bit values into one. */
export function mix32(a: number, b: number): number {
  let h = Math.imul((a ^ 0x9e3779b9) | 0, 0x85ebca6b) ^ Math.imul((b + 0x7f4a7c15) | 0, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/** Per-round seed derived from the run seed. */
export function deriveSeed(runSeed: number, roundNumber: number): number {
  return mix32(runSeed >>> 0, roundNumber);
}

export class Rng {
  a: number;
  b: number;
  c: number;
  d: number;

  constructor(seed: number) {
    const sm = splitmix32(seed);
    this.a = sm();
    this.b = sm();
    this.c = sm();
    this.d = sm();
    for (let i = 0; i < 12; i++) this.next();
  }

  /** uniform in [0, 1) */
  next(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  float(): number {
    return this.next();
  }

  /** integer in [0, n) */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** float in [lo, hi) */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  /** symmetric offset in [-amount, amount) */
  jitter(amount: number): number {
    return (this.next() * 2 - 1) * amount;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)] as T;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  state(): [number, number, number, number] {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }
}

export class RngStreams {
  private streams = new Map<string, Rng>();

  constructor(readonly seed: number) {}

  get(name: string): Rng {
    let r = this.streams.get(name);
    if (!r) {
      r = new Rng(mix32(this.seed, hashString(name)));
      this.streams.set(name, r);
    }
    return r;
  }

  /** all stream states, ordered by name, for hashing */
  states(): number[] {
    const out: number[] = [];
    for (const name of [...this.streams.keys()].sort()) {
      out.push(...(this.streams.get(name) as Rng).state());
    }
    return out;
  }
}
