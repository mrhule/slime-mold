/**
 * Spoken-word stings: short narrated pieces played over the music at the big turns of a round
 * (docs/opera-prompts.md). The director below decides when from plain numbers, with no world access,
 * and the rally (first contact with an enemy) plays at most once a round. The doom stings may come back, but not twice within
 * DOOM_REPEAT seconds, and the fading one only after the mold has recovered since it last played.
 */

export type StingId = 'fading' | 'stand' | 'rally';

export interface StingDef {
  id: StingId;
  /** file in public/operas */
  file: string;
  /** the narrator card's heading */
  title: string;
  /** the narrator card's text (the words of the recording) */
  caption: string;
  /** a big popup shown as the sting starts, to say why the music changed; an empty `sub` is filled with the director's reason */
  announce?: { heading: string; sub: string };
}

export const STINGS: Record<StingId, StingDef> = {
  fading: {
    id: 'fading',
    file: 'doom-fading.mp3',
    title: 'The light is fading',
    caption: 'The veins grow thin... the light grows dim... and still, the mold endures. But for how long?',
    announce: { heading: 'The light is fading', sub: '' },
  },
  stand: {
    id: 'stand',
    file: 'doom-stand.mp3',
    title: 'The last stand',
    caption: 'They have taken our fields. They have taken our roots. But they will NOT take... THE KINGDOM.',
    announce: { heading: 'The last stand', sub: '' },
  },
  rally: {
    id: 'rally',
    file: 'doom-rally.mp3',
    title: 'The tide has turned',
    caption: 'Mold! The tide has turned! The leaves tremble! The snails retreat! Spread, and the whole forest floor shall be OURS!',
    announce: { heading: 'First contact!', sub: '' },
  },
};

/** the song played as a new round begins after a victory; the director never picks it, main.ts plays it on the round change */
export const ROUND_SONG: StingDef = {
  id: 'rally',
  file: 'The_Spores_Remember.mp3',
  title: 'The spores remember',
  caption: 'The battle is over... the fields lie quiet... and beneath the leaves, the mold rests. But the spores... the spores remember. Rise, little mold! The forest floor awaits! Spread... and spread... AGAIN!',
  announce: { heading: 'A new round', sub: 'The spores remember.' },
};

/** what the director reads each frame: plain values */
export interface StingSnapshot {
  /** game seconds into the round (does not run while paused) */
  seconds: number;
  /** false in menus, when paused or after the round ends */
  playing: boolean;
  /** the player's vein cells, and the cells of all living rivals together */
  playerCells: number;
  enemyCells: number;
  /** the player's cells touching an enemy cell (zero until the molds first meet) */
  frontCells: number;
}

/** no sting in the first seconds of a round, and none within this long of the last one */
const QUIET_START = 45;
const COOLDOWN = 60;
/** the same doom sting does not repeat within this long */
const DOOM_REPEAT = 120;
/** fading: the mold is down to this share of the most cells it has held, once it has held enough to matter */
const FADING_SHARE = 0.4;
const FADING_PEAK = 25;
/** the last stand: the player's share of all living veins (theirs plus the enemies') gained this much, then lost this much from the top */
const STAND_GAIN = 0.04;
const STAND_LOSS = 0.03;
/** first contact while the player holds less than this share of all veins is an attack, not a rally: the last stand plays instead */
const CONTACT_LOSING = 0.4;
/** fading also plays when the player is down to this share against rivals who hold at least FADING_PEAK cells */
const OUTGUNNED_SHARE = 0.25;

export class StingDirector {
  /** the rally has played this round */
  private rallied = false;
  /** when each doom sting last played, and whether the mold has grown back since the fading one */
  private doomAt = new Map<StingId, number>();
  private recovered = true;
  private lastAt = -Infinity;
  private peakCells = 0;
  private low = Infinity;
  private high = 0;
  /** why the last sting was picked, in words for the player */
  lastReason = '';

  /** a new round: everything may play again */
  rebase(): void {
    this.rallied = false;
    this.doomAt.clear();
    this.recovered = true;
    this.lastAt = -Infinity;
    this.peakCells = 0;
    this.low = Infinity;
    this.high = 0;
  }

  /** the sting could not play (audio blocked or muted): let it come up again later */
  release(id: StingId): void {
    if (id === 'rally') this.rallied = false;
    else this.doomAt.delete(id);
  }

  update(s: StingSnapshot): StingId | null {
    if (!s.playing) return null;
    this.peakCells = Math.max(this.peakCells, s.playerCells);
    const total = s.playerCells + s.enemyCells;
    const share = total > 0 ? s.playerCells / total : 0;

    // watch for a push that was pushed back, every frame, whether or not a sting may play now
    let pushedBack = false;
    this.low = Math.min(this.low, share);
    if (share > this.low + STAND_GAIN) this.high = Math.max(this.high, share);
    if (this.high > 0 && this.high - share >= STAND_LOSS) {
      pushedBack = true;
      this.low = share;
      this.high = 0;
    }

    if (s.playerCells > this.peakCells * FADING_SHARE * 1.5) this.recovered = true;
    // first contact with an enemy mold ("the tide has turned") may come at any time, even early
    const contact = s.frontCells > 0 && !this.rallied;
    if (s.seconds - this.lastAt < COOLDOWN || (s.seconds < QUIET_START && !contact)) return null;
    // losing by a lot to rivals, whatever the mold's own best size was
    const outgunned = s.enemyCells >= FADING_PEAK && share <= OUTGUNNED_SHARE;
    let pick: StingId | null = null;
    let reason = '';
    const shrunk = this.peakCells >= FADING_PEAK && s.playerCells <= this.peakCells * FADING_SHARE;
    if (contact) {
      // met while already behind: the enemy is attacking, so the last stand plays and the rally is used up
      if (share < CONTACT_LOSING) {
        this.rallied = true;
        pick = 'stand';
        reason = `A rival hit you while you were behind: you hold ${Math.round(share * 100)}% of the veins.`;
      } else {
        pick = 'rally';
        reason = 'Your mold has made first contact with a rival mold.';
      }
    } else if ((shrunk || outgunned) && this.recovered) {
      pick = 'fading';
      reason = shrunk ? 'Your mold has shrunk to a fraction of its best size.' : `Rivals hold far more than you: you have ${Math.round(share * 100)}% of the veins.`;
    } else if (pushedBack) {
      pick = 'stand';
      reason = 'A rival pushed you back from ground you had won.';
    }
    if (!pick) return null;
    if (pick === 'rally') {
      if (this.rallied) return null;
      this.rallied = true;
    } else {
      const last = this.doomAt.get(pick);
      if (last !== undefined && s.seconds - last < DOOM_REPEAT) return null;
      this.doomAt.set(pick, s.seconds);
      if (pick === 'fading') this.recovered = false;
    }
    this.lastAt = s.seconds;
    this.lastReason = reason;
    return pick;
  }
}
