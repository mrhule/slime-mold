import { TICK_DT } from '../sim/types';

export type Speed = 0 | 1 | 2 | 3;

/**
 * Fixed-timestep accumulator (R10). Speed only changes how many whole ticks run per frame, so
 * 3x plays out exactly like 1x. At most `maxTicksPerFrame` run per frame; any extra owed time
 * is dropped so a slow frame cannot snowball.
 */
export class FixedStepLoop {
  speed: Speed = 1;
  /** ticks dropped by the per-frame cap since the loop started (debug) */
  droppedTicks = 0;
  private acc = 0;

  constructor(
    private readonly stepFn: () => void,
    readonly dt: number = TICK_DT,
    readonly maxTicksPerFrame = 8,
  ) {}

  /** Feed real elapsed seconds; returns how many ticks ran. */
  advance(realSeconds: number): number {
    if (this.speed === 0) return 0;
    this.acc += Math.max(0, realSeconds) * this.speed;
    let ran = 0;
    while (this.acc >= this.dt - 1e-9 && ran < this.maxTicksPerFrame) {
      this.stepFn();
      this.acc -= this.dt;
      ran++;
    }
    if (this.acc >= this.dt - 1e-9) {
      this.droppedTicks += Math.floor(this.acc / this.dt);
      this.acc = 0;
    }
    return ran;
  }

  /** Run exactly `n` ticks regardless of speed (used by tests and tools). */
  runTicks(n: number): void {
    for (let i = 0; i < n; i++) this.stepFn();
  }
}
