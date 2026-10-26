import type { SimEvent } from '../sim/types';
import type { CueName, CueRequest } from './cues';

export type RunPhase = 'title' | 'playing' | 'paused' | 'roundEnd';

/** everything the director reads each rendered frame: plain values, no world access */
export interface DirectorSnapshot {
  /** the player's mold id (events are filtered to it) */
  playerId: number;
  /** wall-clock milliseconds, for the one-second front window */
  nowMs: number;
  playerCells: number;
  playerGathered: number;
  runState: RunPhase;
  /** how the round ended, once `runState` is `roundEnd` */
  outcome: 'victory' | 'defeat' | null;
  /** `cellDied` events visible to the player right now (fog already applied, A3) */
  visibleDeaths: { own: boolean; byEnemy: boolean }[];
  /** the frame's other events (drops, buildings, rejections) */
  events: readonly SimEvent[];
}

const FRONT_WINDOW_MS = 1000;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Turns game state into cue requests (contracts/audio-cues.md). Pure apart from the memory it keeps
 * between frames: the previous snapshot's counters and the last second of visible deaths. It is
 * called once per rendered frame, so 2x and 3x speed do not multiply cues (A7), and it never
 * touches the sim (Constitution I).
 */
export class Director {
  private prevCells: number | null = null;
  private prevGathered = 0;
  private prevState: RunPhase | null = null;
  private window: { t: number; own: boolean }[] = [];

  /** a new round replaced the world: counters start over, so the jump in cells is not a growth sound */
  rebase(): void {
    this.prevCells = null;
    this.prevGathered = 0;
    this.window = [];
  }

  update(s: DirectorSnapshot): CueRequest[] {
    const out: CueRequest[] = [];
    const add = (cue: CueName, strength = 1): void => void out.push({ cue, strength: clamp01(strength) });

    // growth and absorption: the player's own mold only, from state deltas
    if (this.prevCells !== null && s.playerCells > this.prevCells) add('grow', (s.playerCells - this.prevCells) / 8);
    if (this.prevCells !== null && s.playerGathered > this.prevGathered + 1e-6) add('squelch', (s.playerGathered - this.prevGathered) / 2);
    this.prevCells = s.playerCells;
    this.prevGathered = s.playerGathered;

    // events: drops are announced to every mold; placements and refusals only count for the player
    for (const e of s.events) {
      if (e.type === 'dropWarning') add('warn');
      else if (e.type === 'dropLanded') add('land');
      else if (e.type === 'buildingPlaced' && e.mold === s.playerId) add('place');
      else if (e.type === 'commandRejected' && e.mold === s.playerId) add('refuse');
      else if (e.type === 'moldEvolved' && e.mold === s.playerId) add('evolve');
      else if (e.type === 'buildingUpgraded' && e.mold === s.playerId) add('upgrade');
      else if (e.type === 'buildingDestroyed' && e.mold === s.playerId) add('demolish');
    }

    // veins of your own dying back with no enemy to blame (out of reach, starved, cut off): a soft sigh, not a fight
    const withered = s.visibleDeaths.filter((d) => d.own && !d.byEnemy).length;
    if (withered > 0) add('wither', withered / 6);

    // fronts: visible deaths over the last second, only when something new died this frame; only a kill by an enemy is a fight
    const fought = s.visibleDeaths.filter((d) => d.byEnemy);
    if (fought.length > 0) {
      for (const d of fought) this.window.push({ t: s.nowMs, own: d.own });
      this.window = this.window.filter((d) => s.nowMs - d.t <= FRONT_WINDOW_MS);
      const own = this.window.filter((d) => d.own).length;
      const enemy = this.window.length - own;
      if (enemy > own) add('frontWon', enemy / 10);
      else if (own > enemy) add('frontLost', own / 10);
    } else {
      this.window = this.window.filter((d) => s.nowMs - d.t <= FRONT_WINDOW_MS);
    }

    // run state changes: each jingle once, on the transition only
    if (this.prevState !== null && this.prevState !== s.runState) {
      if (s.runState === 'playing' && (this.prevState === 'title' || this.prevState === 'roundEnd')) add('roundStart');
      else if (s.runState === 'roundEnd' && this.prevState === 'playing') add(s.outcome === 'victory' ? 'roundWin' : 'roundLose');
    }
    this.prevState = s.runState;
    return out;
  }
}
