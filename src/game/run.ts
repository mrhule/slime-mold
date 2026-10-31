import type { Speed } from './loop';
import type { RoundOutcome, World } from '../sim/types';

export type RunState = 'title' | 'playing' | 'paused' | 'roundEnd';
/** why the game is paused: the player, the pause menu, the tab losing focus, or a video playing over it */
export type PauseReason = 'player' | 'menu' | 'focus' | 'video';

export interface RunStorage {
  loadBest(): number;
  saveBest(round: number): void;
}

export interface RunOptions {
  runSeed: number;
  /** builds the world for a round of this run */
  createWorld: (runSeed: number, roundNumber: number) => World;
  /** picks a fresh seed for a new run */
  newSeed: () => number;
  storage?: RunStorage;
  /** first round to play (debug `?round=`) */
  startRound?: number;
}

/**
 * The run: title, playing (with pause and speed), and the round-end screens. Rounds escalate on
 * victory; a defeat ends the run and the next one starts again at round 1 (FR-023, FR-024).
 * Nothing carries over between rounds except the best round reached.
 */
export class Run {
  state: RunState = 'title';
  pauseReason: PauseReason | null = null;
  speed: 1 | 2 | 3 = 1;
  world: World;
  runSeed: number;
  roundNumber: number;
  bestRound: number;
  outcome: Exclude<RoundOutcome, 'playing'> | null = null;
  /** bumped whenever `world` is replaced, so the renderer knows to rebuild */
  worldVersion = 0;
  private readonly listeners: (() => void)[] = [];
  private readonly firstRound: number;

  constructor(private readonly opts: RunOptions) {
    this.runSeed = opts.runSeed;
    this.firstRound = opts.startRound ?? 1;
    this.roundNumber = this.firstRound;
    this.bestRound = opts.storage?.loadBest() ?? 0;
    this.world = opts.createWorld(this.runSeed, this.roundNumber);
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** the speed to feed the fixed-step loop: 0 unless the game is actually running */
  get loopSpeed(): Speed {
    return this.state === 'playing' ? this.speed : 0;
  }

  get isPaused(): boolean {
    return this.state === 'paused';
  }

  start(): void {
    if (this.state !== 'title') return;
    this.state = 'playing';
    this.emit();
  }

  pause(reason: PauseReason = 'player'): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.pauseReason = reason;
    this.emit();
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.pauseReason = null;
    this.emit();
  }

  /** Space: pause and resume (not for the pause menu, which has its own buttons) */
  togglePause(): void {
    if (this.state === 'playing') this.pause('player');
    else if (this.state === 'paused' && this.pauseReason !== 'menu') this.resume();
  }

  /** speed keys: choosing a speed also resumes a player pause */
  setSpeed(speed: 1 | 2 | 3): void {
    this.speed = speed;
    if (this.state === 'paused' && this.pauseReason === 'player') this.resume();
    else this.emit();
  }

  openMenu(): void {
    if (this.state === 'playing') this.pause('menu');
    else if (this.state === 'paused' && this.pauseReason !== 'menu') this.pauseReason = 'menu';
    this.emit();
  }

  closeMenu(): void {
    if (this.state === 'paused' && this.pauseReason === 'menu') this.resume();
  }

  /** the round ended: record it and stop the clock */
  finishRound(outcome: Exclude<RoundOutcome, 'playing'>): void {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.state = 'roundEnd';
    this.pauseReason = null;
    this.outcome = outcome;
    if (outcome === 'victory' && this.roundNumber > this.bestRound) {
      this.bestRound = this.roundNumber;
      this.opts.storage?.saveBest(this.bestRound);
    }
    this.emit();
  }

  private load(runSeed: number, roundNumber: number): void {
    this.runSeed = runSeed;
    this.roundNumber = roundNumber;
    this.world = this.opts.createWorld(runSeed, roundNumber);
    this.worldVersion++;
    this.outcome = null;
    this.pauseReason = null;
    this.state = 'playing';
  }

  /** after a victory: a new, harder map. Nothing else carries over. */
  nextRound(): void {
    if (this.state !== 'roundEnd' || this.outcome !== 'victory') return;
    this.load(this.runSeed, this.roundNumber + 1);
    this.emit();
  }

  /** after a defeat (or from the menu): a fresh run from round 1 with a new seed */
  newRun(): void {
    this.load(this.opts.newSeed(), this.firstRound);
    this.emit();
  }

  quitToTitle(): void {
    this.runSeed = this.opts.newSeed();
    this.roundNumber = this.firstRound;
    this.world = this.opts.createWorld(this.runSeed, this.roundNumber);
    this.worldVersion++;
    this.outcome = null;
    this.pauseReason = null;
    this.state = 'title';
    this.emit();
  }
}
