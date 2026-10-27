/**
 * Recorded music: the audio files in `public/music` play as a shuffled playlist on the music bus,
 * track after track, forever. The tracks stream through one `<audio>` element (no whole-file decode,
 * so the big files cost no memory spike) routed into the same gain bus as the generated music, so the
 * music slider, mute, and pause all keep working. A track that fails to load is skipped; if none
 * load, `onExhausted` fires so the engine can fall back to the generated loop.
 */

/** the bits of an `<audio>` element the player uses (a fake stands in for it in tests) */
export interface TrackElement {
  src: string;
  preload: string;
  crossOrigin: string | null;
  currentTime: number;
  duration: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: 'ended' | 'error' | 'timeupdate', fn: () => void): void;
  removeAttribute?(name: string): void;
  load?(): void;
}

export type TrackElementFactory = () => TrackElement;

/** seconds a track fades in at the start and out at the end, so songs overlap no one and click nowhere */
export const FADE_SECONDS = 2;

/** a shuffled copy: Fisher-Yates driven by `rand` (0..1), so a test can pass a fixed sequence */
export function shuffled<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * The play order: every track once in shuffled order, then a reshuffle for the next pass, never
 * starting a new pass with the track that just played (when there is more than one).
 */
export function playlist(urls: readonly string[], rand: () => number = Math.random): () => string | null {
  let order: string[] = [];
  let last: string | null = null;
  return () => {
    if (urls.length === 0) return null;
    if (order.length === 0) {
      order = shuffled(urls, rand);
      if (urls.length > 1 && order[0] === last) order.push(order.shift() as string);
    }
    last = order.shift() as string;
    return last;
  };
}

const browserElement: TrackElementFactory = () => new Audio() as unknown as TrackElement;

/**
 * One `<audio>` element plays every track, changing its `src` for the next one. Phones (iOS above all)
 * only let an element start playing from a tap, and a track that ends starts the next with no tap, so
 * a fresh element per track would be blocked and the music would stop after one song. The one element
 * is started from the first tap and stays unlocked for the rest of the session.
 */
export class TrackPlayer {
  private readonly next: () => string | null;
  private el: TrackElement | null = null;
  private gain: GainNode | null = null;
  private running = false;
  private paused = false;
  private failures = 0;
  private started = false;
  private fadingOut = false;
  private readonly total: number;
  /** a track played once before the playlist (the intro), then forgotten */
  private first: string | null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly bus: AudioNode,
    urls: readonly string[],
    private readonly onExhausted: () => void = () => {},
    private readonly makeElement: TrackElementFactory = browserElement,
    rand: () => number = Math.random,
    intro: string | null = null,
  ) {
    this.next = playlist(urls, rand);
    this.first = intro;
    this.total = urls.length + (intro ? 1 : 0);
  }

  get playing(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.failures = 0;
    if (!this.attach()) {
      this.fail();
      return;
    }
    this.playNext();
  }

  stop(): void {
    this.running = false;
    this.detach();
  }

  /** hold the current track (the game is paused or the tab is hidden) */
  pause(): void {
    this.paused = true;
    try {
      this.el?.pause();
    } catch {
      /* ignore */
    }
  }

  resume(): void {
    if (!this.running) return;
    this.paused = false;
    this.play();
  }

  /** call from a tap or key press: starts the track again if the browser had refused or stopped it */
  kick(): void {
    if (this.running && !this.paused) this.play();
  }

  private play(): void {
    try {
      const p = this.el?.play();
      if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  /** create the one element and wire it into the music bus; false if the browser cannot */
  private attach(): boolean {
    if (this.el) return true;
    try {
      const el = this.makeElement();
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      this.ctx.createMediaElementSource(el as unknown as HTMLMediaElement).connect(gain);
      gain.connect(this.bus);
      el.addEventListener('timeupdate', () => this.onTime());
      el.addEventListener('ended', () => {
        if (this.running) this.playNext();
      });
      el.addEventListener('error', () => {
        if (!this.running) return;
        this.failures++;
        // every track failed in a row: give up and let the engine fall back
        if (this.failures >= Math.max(1, this.total)) this.fail();
        else this.playNext();
      });
      this.el = el;
      this.gain = gain;
      return true;
    } catch {
      return false;
    }
  }

  private onTime(): void {
    const el = this.el;
    const gain = this.gain;
    if (!el || !gain) return;
    if (!this.started) {
      this.started = true;
      this.failures = 0;
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + FADE_SECONDS);
    }
    const left = el.duration - el.currentTime;
    if (!this.fadingOut && Number.isFinite(left) && left <= FADE_SECONDS && left > 0) {
      this.fadingOut = true;
      gain.gain.setValueAtTime(gain.gain.value, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + left);
    }
  }

  private fail(): void {
    this.running = false;
    this.detach();
    this.onExhausted();
  }

  private detach(): void {
    const el = this.el;
    const gain = this.gain;
    this.el = null;
    this.gain = null;
    try {
      el?.pause();
      el?.removeAttribute?.('src');
      el?.load?.();
      gain?.disconnect();
    } catch {
      /* ignore */
    }
  }

  private playNext(): void {
    if (!this.running || !this.el) return;
    const url = this.first ?? this.next();
    this.first = null;
    if (url === null) {
      this.fail();
      return;
    }
    this.started = false;
    this.fadingOut = false;
    this.gain?.gain.setValueAtTime(0, this.ctx.currentTime);
    this.el.src = url;
    this.el.load?.();
    if (!this.paused) this.play();
  }
}
