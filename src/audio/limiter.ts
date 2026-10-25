import { CUE_RULES, MAX_VOICES } from './cues';
import type { CueName, CueRule } from './cues';

/**
 * Decides which cue requests actually play (A4, FR-003): hundreds of cells growing or dying in one
 * frame must not become a wall of noise. A request is dropped when the same cue played too recently,
 * when it already played its maximum in the last second, or when the global voice cap is full.
 * Cues marked bypass skip the minimum interval but still count toward the other two limits.
 */
export class Limiter {
  private readonly last = new Map<CueName, number>();
  private readonly recent = new Map<CueName, number[]>();
  /** end times (ms) of sounds still ringing */
  private voices: number[] = [];

  constructor(
    private readonly rules: Record<CueName, CueRule> = CUE_RULES,
    private readonly maxVoices = MAX_VOICES,
  ) {}

  /** true if the cue may play at `nowMs`; admitting it records it */
  admit(cue: CueName, nowMs: number, bypass = this.rules[cue].bypass): boolean {
    const rule = this.rules[cue];
    this.voices = this.voices.filter((end) => end > nowMs);
    if (this.voices.length >= this.maxVoices) return false;

    const last = this.last.get(cue);
    if (!bypass && last !== undefined && nowMs - last < rule.minIntervalMs) return false;

    const window = (this.recent.get(cue) ?? []).filter((t) => nowMs - t < 1000);
    if (window.length >= rule.maxPerSecond) {
      this.recent.set(cue, window);
      return false;
    }
    window.push(nowMs);
    this.recent.set(cue, window);
    this.last.set(cue, nowMs);
    this.voices.push(nowMs + rule.durationMs);
    return true;
  }

  /** how many sounds are ringing at `nowMs` (for tests and debugging) */
  voiceCount(nowMs: number): number {
    return this.voices.filter((end) => end > nowMs).length;
  }
}
