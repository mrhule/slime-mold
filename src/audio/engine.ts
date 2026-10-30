import type { CueRequest } from './cues';
import { Limiter } from './limiter';
import { Music } from './music';
import { defaultSettings } from './settings';
import type { Settings } from './settings';
import { playCue } from './synth';
import { TrackPlayer } from './tracks';
import type { TrackElementFactory } from './tracks';

/** music sits under the effects at the same slider position */
const MUSIC_BUS_SCALE = 0.55;
/** a spoken sting sits above the music */
const STING_BUS_SCALE = 0.9;
/** the music drops to this level under a sting, easing down and back over these seconds */
const DUCK_LEVEL = 0.12;
const DUCK_DOWN = 1.2;
const DUCK_UP = 2.5;
/** a sting fades in and out over these seconds */
const STING_FADE_IN = 1;
const STING_FADE_OUT = 1.5;

type ContextFactory = () => AudioContext | null;

function browserContext(): AudioContext | null {
  try {
    const Ctor = typeof AudioContext !== 'undefined' ? AudioContext : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

/**
 * The audio engine (A6, A7, contracts/audio-cues.md). The `AudioContext` is created lazily from the
 * first user gesture (browser autoplay policy); until then, and whenever audio is missing or blocked,
 * every call is a harmless no-op. Buses: sfx and music feed a master gain that mute sets to zero.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private musicBus: GainNode | null = null;
  /** between the music bus and the master: ducked under a sting */
  private duck: GainNode | null = null;
  private stingBus: GainNode | null = null;
  private readonly stingBuffers = new Map<string, Promise<AudioBuffer | null>>();
  private stingActive = false;
  /** the sting that is playing now, so it can be faded out early */
  private stingNow: { voice: GainNode; src: AudioBufferSourceNode } | null = null;
  /** the context is not suspended before this time (a sting is fading out) */
  private holdUntil = 0;
  private music: Music | null = null;
  private tracks: TrackPlayer | null = null;
  private trackUrls: string[] = [];
  private introUrl: string | null = null;
  private settings: Settings = defaultSettings();
  private playing = false;
  private wantMusic = false;
  private readonly limiter = new Limiter();

  constructor(
    private readonly makeContext: ContextFactory = browserContext,
    private readonly now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    private readonly makeTrackElement?: TrackElementFactory,
  ) {}

  /** recorded tracks to play as the music (shuffled, endless); with none, or none that load, the generated loop plays */
  setTracks(urls: readonly string[]): void {
    this.trackUrls = urls.slice();
  }

  /** a recorded piece played once, before the playlist, the first time music starts */
  setIntro(url: string | null): void {
    this.introUrl = url;
  }

  /** whether sound can play at all (a context exists) */
  get available(): boolean {
    return this.ctx !== null;
  }

  /** call from the first pointerdown or keydown */
  unlock(): void {
    try {
      if (!this.ctx) {
        const ctx = this.makeContext();
        if (!ctx) return;
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.sfx = ctx.createGain();
        this.musicBus = ctx.createGain();
        this.duck = ctx.createGain();
        this.stingBus = ctx.createGain();
        this.sfx.connect(this.master);
        this.musicBus.connect(this.duck);
        this.duck.connect(this.master);
        this.stingBus.connect(this.master);
        this.master.connect(ctx.destination);
        this.applySettings();
      }
      this.syncRunning();
      if (this.wantMusic) this.startMusic();
    } catch {
      /* audio unavailable: stay silent */
    }
  }

  setSettings(settings: Settings): void {
    this.settings = settings;
    this.applySettings();
  }

  private applySettings(): void {
    try {
      const s = this.settings;
      if (this.master) this.master.gain.value = s.muted ? 0 : 1;
      if (this.sfx) this.sfx.gain.value = s.sfxVolume;
      if (this.musicBus) this.musicBus.gain.value = s.musicVolume * MUSIC_BUS_SCALE;
      if (this.stingBus) this.stingBus.gain.value = s.musicVolume * STING_BUS_SCALE;
    } catch {
      /* ignore */
    }
  }

  /** suspend the context while the game is not playing (or the tab is hidden), resume when it is */
  setRunning(playing: boolean): void {
    this.playing = playing;
    this.syncRunning();
  }

  private syncRunning(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      if (this.playing) {
        void ctx.resume?.();
        this.tracks?.resume();
      } else if (this.now() >= this.holdUntil) {
        void ctx.suspend?.();
        this.tracks?.pause();
      }
    } catch {
      /* ignore */
    }
  }

  play(request: CueRequest): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.playing || this.settings.muted) return;
    try {
      if (!this.limiter.admit(request.cue, this.now())) return;
      playCue(ctx, this.sfx, request.cue, request.strength, ctx.currentTime + 0.005);
    } catch {
      /* a failed sound is not worth a crash */
    }
  }

  /** fetch and decode stings ahead of time so they start the moment they are wanted */
  preloadStings(urls: readonly string[]): void {
    for (const url of urls) void this.loadSting(url);
  }

  private loadSting(url: string): Promise<AudioBuffer | null> {
    let p = this.stingBuffers.get(url);
    if (!p) {
      const ctx = this.ctx;
      p =
        ctx && typeof fetch !== 'undefined'
          ? fetch(url)
              .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing'))))
              .then((data) => ctx.decodeAudioData(data))
              .catch(() => null)
          : Promise.resolve(null);
      this.stingBuffers.set(url, p);
    }
    return p;
  }

  /**
   * Play a recorded sting over the music: the music eases down as the sting fades in, and back up
   * after it fades out. `onStart` gets the sting's length in seconds the moment it begins. Resolves
   * false (and plays nothing) when sound is unavailable, muted, paused, or another sting is playing.
   */
  async playSting(url: string, onStart?: (seconds: number) => void, opts: { silenceMusic?: boolean } = {}): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx || !this.stingBus || !this.duck || !this.playing || this.settings.muted || this.stingActive) return false;
    this.stingActive = true;
    try {
      const buffer = await this.loadSting(url);
      if (!buffer || !this.playing || !this.stingBus || !this.duck) {
        this.stingActive = false;
        return false;
      }
      // with silenceMusic the music fades fully away first (it may already have), then the sting begins
      const lead = opts.silenceMusic ? this.duck.gain.value * DUCK_DOWN : 0;
      const t = ctx.currentTime + 0.05 + lead;
      const len = buffer.duration;
      const voice = ctx.createGain();
      voice.gain.setValueAtTime(0, t);
      voice.gain.linearRampToValueAtTime(1, t + Math.min(STING_FADE_IN, len / 2));
      voice.gain.setValueAtTime(1, t + Math.max(len - STING_FADE_OUT, len / 2));
      voice.gain.linearRampToValueAtTime(0, t + len);
      voice.connect(this.stingBus);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(voice);
      const playing = { voice, src };
      this.stingNow = playing;
      src.onended = () => {
        // a sting that was faded out early must not clear the flag of the one that replaced it
        if (this.stingNow === playing) {
          this.stingNow = null;
          this.stingActive = false;
        }
        try {
          voice.disconnect();
        } catch {
          /* ignore */
        }
      };
      const duck = this.duck.gain;
      const level = opts.silenceMusic ? 0 : DUCK_LEVEL;
      duck.cancelScheduledValues(ctx.currentTime);
      duck.setValueAtTime(duck.value, ctx.currentTime);
      if (opts.silenceMusic) duck.linearRampToValueAtTime(0, t);
      else duck.linearRampToValueAtTime(level, t + DUCK_DOWN);
      duck.setValueAtTime(level, t + len);
      duck.linearRampToValueAtTime(1, t + len + DUCK_UP);
      src.start(t);
      onStart?.(len);
      return true;
    } catch {
      this.stingActive = false;
      return false;
    }
  }

  /**
   * Fade out the sting that is playing, if any, over `seconds`, and bring the music back up (or with
   * `silenceMusic`, fade the music out too and leave it down until the next sting ends). The
   * sound context stays running until the fade is done, even if the game has stopped playing.
   * Another sting may start at once.
   */
  stopSting(seconds = 1, silenceMusic = false): void {
    const ctx = this.ctx;
    const now = this.stingNow;
    if (!ctx || (!now && !silenceMusic)) return;
    this.stingNow = null;
    this.stingActive = false;
    try {
      const t = ctx.currentTime;
      if (now) {
        now.voice.gain.cancelScheduledValues(t);
        now.voice.gain.setValueAtTime(now.voice.gain.value, t);
        now.voice.gain.linearRampToValueAtTime(0, t + seconds);
        now.src.stop(t + seconds + 0.05);
      }
      if (this.duck) {
        // the music comes back up, or with silenceMusic it fades away too and stays down
        this.duck.gain.cancelScheduledValues(t);
        this.duck.gain.setValueAtTime(this.duck.gain.value, t);
        this.duck.gain.linearRampToValueAtTime(silenceMusic ? 0 : 1, t + seconds);
      }
      this.holdUntil = this.now() + seconds * 1000 + 100;
      setTimeout(() => this.syncRunning(), seconds * 1000 + 150);
    } catch {
      /* ignore */
    }
  }

  /** begin the music loop (once a gesture has unlocked audio) */
  startMusic(): void {
    this.wantMusic = true;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || this.music?.playing || this.tracks?.playing) return;
    if (this.trackUrls.length > 0 || this.introUrl) {
      try {
        this.tracks = new TrackPlayer(ctx, this.musicBus, this.trackUrls, () => this.startGeneratedMusic(), this.makeTrackElement, Math.random, this.introUrl);
        this.introUrl = null; // once per session
        this.tracks.start();
        if (!this.playing) this.tracks.pause();
        return;
      } catch {
        this.tracks = null;
      }
    }
    this.startGeneratedMusic();
  }

  private startGeneratedMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || this.music?.playing || !this.wantMusic) return;
    try {
      this.music = new Music(ctx, this.musicBus);
      this.music.start();
    } catch {
      this.music = null;
    }
  }

  /** call from any tap or key press: restarts the recorded track if the browser had refused or stopped it */
  kick(): void {
    try {
      if (this.playing) void this.ctx?.resume?.();
      this.tracks?.kick();
    } catch {
      /* ignore */
    }
  }

  stopMusic(): void {
    this.wantMusic = false;
    this.tracks?.stop();
    this.tracks = null;
    this.music?.stop();
    this.music = null;
  }
}
