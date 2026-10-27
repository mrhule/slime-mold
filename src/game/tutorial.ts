import { readJson, writeJson } from './storage';
import type { SafeStore } from './storage';

const KEY = 'slime-mold:v1:tutorial';

/** what the tutorial needs to know about the game, read once per frame */
export interface TutorialSnapshot {
  round: number;
  /** seconds of game time since the round began */
  seconds: number;
  /** growth targets the player has set right now */
  targets: number;
  cells: number;
  factories: number;
  /** nutrients the player has gathered so far */
  gathered: number;
  /** a rival mold has been seen */
  rivalSeen: boolean;
}

export interface TutorialStep {
  id: 'grow' | 'factory' | 'eat' | 'economy' | 'fight' | 'win';
  /** the prompt; `touch` picks the wording for fingers */
  text(touch: boolean, winPercent: number): string;
  /** is this step finished? `since` is the seconds of game time spent on it */
  done(s: TutorialSnapshot, since: number): boolean;
}

export const STEPS: readonly TutorialStep[] = [
  {
    id: 'grow',
    text: (touch) => `${touch ? 'Tap' : 'Click'} the map to grow your mold there. Head for a glowing green goo pool: it pays you income.`,
    done: (s) => s.targets > 0 && s.cells >= 12,
  },
  {
    id: 'factory',
    text: (touch) => `A goo pool only pays while a Factory sits on the same vein. ${touch ? 'Pick Factory below, tap a spot on your veins, then Build.' : 'Press F, then click a spot on your veins.'}`,
    done: (s) => s.factories >= 1,
  },
  {
    id: 'eat',
    text: () => 'Eat food to grow stronger: reach crumbs and cubes and your mold spreads over them. The bar under each shows what is left.',
    done: (s) => s.gathered >= 40,
  },
  {
    id: 'economy',
    text: () => 'Watch Net in the top-left. When upkeep beats income your outer veins die back: stop growing for a while and let nutrients build up.',
    done: (_s, since) => since >= 12,
  },
  {
    id: 'fight',
    text: (touch) => `A rival! Where molds touch there is a fight. ${touch ? 'The slider' : 'Q / E or the slider'} sends nutrients to growth or to the fight, and a Fortress makes your veins hit harder.`,
    // with no rival in sight the lesson waits a while, then moves on rather than stalling
    done: (s, since) => (s.rivalSeen && since >= 12) || since >= 150,
  },
  {
    id: 'win',
    text: (_touch, winPercent) => `Hold ${winPercent}% of the map, or eat every rival, to win the round. Later rounds are bigger and harder. Good luck!`,
    done: (_s, since) => since >= 10,
  },
];

/**
 * The guided first round: a row of prompts that move on by themselves as the player does each thing, so
 * nobody has to read a manual first. It only watches; it never changes the game.
 */
export class Tutorial {
  private index = 0;
  private stepStart = 0;
  private active = false;

  constructor(private readonly store: SafeStore | null) {}

  /** has the player finished or skipped it before? */
  get seen(): boolean {
    try {
      return (readJson(this.store, KEY) as { done?: boolean } | null)?.done === true;
    } catch {
      return false;
    }
  }

  get running(): boolean {
    return this.active;
  }

  get stepNumber(): number {
    return this.index + 1;
  }

  get stepCount(): number {
    return STEPS.length;
  }

  /** begin from the first prompt at the game time `seconds` */
  start(seconds = 0): void {
    this.index = 0;
    this.stepStart = seconds;
    this.active = true;
  }

  /** stop and remember it, so it is not offered again */
  finish(): void {
    this.active = false;
    writeJson(this.store, KEY, { done: true });
  }

  /** the current prompt, moving on when it is done; null once the whole thing is over or off */
  update(s: TutorialSnapshot): TutorialStep | null {
    if (!this.active) return null;
    let step = STEPS[this.index];
    while (step && step.done(s, s.seconds - this.stepStart)) {
      this.index++;
      this.stepStart = s.seconds;
      step = STEPS[this.index];
    }
    if (!step) {
      this.finish();
      return null;
    }
    return step;
  }
}
