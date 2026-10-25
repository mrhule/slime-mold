import { style } from './style';
import type { QualityLevel } from './style';

export type QualitySetting = 'auto' | 'high' | 'low';

/**
 * Picks the quality level from the frame rate (A14). `high` and `low` pin the level; `auto` drops to
 * low after `dropSeconds` under `dropFps` and returns to high only after `raiseSeconds` over
 * `raiseFps`. Frames in between reset both clocks, so a rate hovering near a threshold never flips.
 */
export class QualityGovernor {
  level: QualityLevel = 'high';
  private lowSince = 0;
  private highSince = 0;

  update(dtSeconds: number, fps: number, setting: QualitySetting): QualityLevel {
    if (setting !== 'auto') {
      this.level = setting;
      this.lowSince = 0;
      this.highSince = 0;
      return this.level;
    }
    const g = style.governor;
    if (this.level === 'high') {
      this.lowSince = fps < g.dropFps ? this.lowSince + dtSeconds : 0;
      if (this.lowSince >= g.dropSeconds) {
        this.level = 'low';
        this.lowSince = 0;
        this.highSince = 0;
      }
    } else {
      this.highSince = fps > g.raiseFps ? this.highSince + dtSeconds : 0;
      if (this.highSince >= g.raiseSeconds) {
        this.level = 'high';
        this.lowSince = 0;
        this.highSince = 0;
      }
    }
    return this.level;
  }
}
