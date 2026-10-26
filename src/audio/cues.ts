/**
 * The cue vocabulary and its rate rules (data-model.md "Cue table"). Shared by the director (which
 * asks for cues), the limiter (which admits them) and the synth (which plays them).
 */
export type CueName =
  | 'grow'
  | 'squelch'
  | 'warn'
  | 'land'
  | 'place'
  | 'refuse'
  | 'evolve'
  | 'upgrade'
  | 'demolish'
  | 'wither'
  | 'frontWon'
  | 'frontLost'
  | 'roundStart'
  | 'roundWin'
  | 'roundLose';

/** one thing to play; `strength` (0..1) scales volume and pitch */
export interface CueRequest {
  cue: CueName;
  strength: number;
}

export interface CueRule {
  /** fewest milliseconds between two plays of this cue */
  minIntervalMs: number;
  /** most plays in any one second */
  maxPerSecond: number;
  /** important cues skip the minimum interval (they still count toward the caps) */
  bypass: boolean;
  /** how long the sound rings, for the voice count */
  durationMs: number;
}

export const CUE_RULES: Record<CueName, CueRule> = {
  grow: { minIntervalMs: 90, maxPerSecond: 6, bypass: false, durationMs: 120 },
  squelch: { minIntervalMs: 200, maxPerSecond: 3, bypass: false, durationMs: 260 },
  warn: { minIntervalMs: 0, maxPerSecond: 2, bypass: true, durationMs: 520 },
  land: { minIntervalMs: 0, maxPerSecond: 2, bypass: true, durationMs: 420 },
  place: { minIntervalMs: 80, maxPerSecond: 4, bypass: false, durationMs: 240 },
  refuse: { minIntervalMs: 150, maxPerSecond: 3, bypass: false, durationMs: 220 },
  evolve: { minIntervalMs: 0, maxPerSecond: 1, bypass: true, durationMs: 1000 },
  upgrade: { minIntervalMs: 100, maxPerSecond: 3, bypass: false, durationMs: 420 },
  demolish: { minIntervalMs: 100, maxPerSecond: 3, bypass: false, durationMs: 380 },
  wither: { minIntervalMs: 1500, maxPerSecond: 1, bypass: false, durationMs: 700 },
  frontWon: { minIntervalMs: 600, maxPerSecond: 1, bypass: false, durationMs: 420 },
  frontLost: { minIntervalMs: 600, maxPerSecond: 1, bypass: false, durationMs: 420 },
  roundStart: { minIntervalMs: 0, maxPerSecond: 1, bypass: true, durationMs: 700 },
  roundWin: { minIntervalMs: 0, maxPerSecond: 1, bypass: true, durationMs: 1100 },
  roundLose: { minIntervalMs: 0, maxPerSecond: 1, bypass: true, durationMs: 1100 },
};

/** about this many sounds may ring at once; extra requests are dropped (A4) */
export const MAX_VOICES = 12;
