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
  private music: Music | null = null;
  private tracks: TrackPlayer | null = null;
  private trackUrls: string[] = [];
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
        this.sfx.connect(this.master);
        this.musicBus.connect(this.master);
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
      } else {
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

  /** begin the music loop (once a gesture has unlocked audio) */
  startMusic(): void {
    this.wantMusic = true;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || this.music?.playing || this.tracks?.playing) return;
    if (this.trackUrls.length > 0) {
      try {
        this.tracks = new TrackPlayer(ctx, this.musicBus, this.trackUrls, () => this.startGeneratedMusic(), this.makeTrackElement);
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

  stopMusic(): void {
    this.wantMusic = false;
    this.tracks?.stop();
    this.tracks = null;
    this.music?.stop();
    this.music = null;
  }
}
