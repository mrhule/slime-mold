import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { art } from './art';
import type { ArtSprite } from './art';
import type { Season, Weather, World } from '../sim/types';

/**
 * The weather over the map, drawn in screen space from the sim's season and weather and nothing else:
 *   - a colour wash for the season (bright and green in spring, warm in summer, dark and amber in
 *     fall, dark and blue in winter), eased over a few seconds when the season turns;
 *   - rain and storm streaks with splashes, snow and a blizzard's whiteout, drifting fog, frost around
 *     the edges, falling leaves in fall, and lightning with a flash.
 * Each kind of weather fades in and out, so a change of weather is never a jump. It uses the painted
 * overlays and sprites (docs/art-prompts-2.md) when they loaded, and draws a plain procedural
 * version of the same things when they did not.
 */

const SEASON_WASH: Record<Season, { color: number; alpha: number }> = {
  spring: { color: 0xb6f09a, alpha: 0.07 },
  summer: { color: 0xffe9a8, alpha: 0.06 },
  fall: { color: 0x6b3a14, alpha: 0.2 },
  winter: { color: 0x1f2f55, alpha: 0.28 },
};

const WEATHER: readonly Weather[] = ['clear', 'rain', 'storm', 'fog', 'frost', 'snow', 'blizzard'];

interface Particle {
  x: number;
  y: number;
  /** a per-particle random number in [0, 1), for size and speed */
  r: number;
}

/** how many particles each kind draws at the high quality level (halved at low) */
const COUNTS = { rain: 150, snow: 110, blizzard: 240 } as const;
/** the plain rain keeps this many particles ready, enough for a storm's thicker fall */
const RAIN_POOL = 380;
/** how fast rain falls down the screen, in pixels a second (it used to be twice this) */
const RAIN_SPEED = 470;
/** the way the painted rain slants as drawn: sideways pixels per pixel fallen (it leans to the left going down) */
const RAIN_DRAWN_SLANT = -0.34;
const FLAKES = 46;
const LEAVES = 26;
const SPLASHES = 34;

/** a repeatable pseudo-random number in [0, 1) for item `i` and a purpose number `k` */
const rnd = (i: number, k: number): number => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** a pooled sprite that drifts across the screen, wrapping at the edges */
interface Drifter {
  sprite: Sprite;
  p: Particle;
}

export class WeatherLayer {
  readonly container = new Container();
  private readonly g = new Graphics();
  private readonly amount: Record<Weather, number> = { clear: 1, rain: 0, storm: 0, fog: 0, frost: 0, snow: 0, blizzard: 0 };
  private leafAmount = 0;
  private wash = { color: SEASON_WASH.spring.color, alpha: SEASON_WASH.spring.alpha };
  private readonly rain: Particle[] = [];
  private readonly snow: Particle[] = [];
  private readonly blizzard: Particle[] = [];
  private flashAlpha = 0;
  private time = 0;

  /** the painted pieces, built the first time the art is there */
  private painted: {
    rain: TilingSprite;
    /** a second, closer and faster sheet of rain that only a storm adds */
    downpour: TilingSprite;
    snow: TilingSprite;
    snowFar: TilingSprite;
    fog: TilingSprite;
    frost: TilingSprite;
    storm: Sprite;
    flakes: Drifter[];
    leaves: Drifter[];
    splashes: { sprite: Sprite; p: Particle; life: number }[];
    bolt: Sprite;
  } | null = null;
  private boltLife = 0;
  /** which spell of weather the rain direction was picked for */
  private spell = -1;
  /** how far the rain slants now and where it is heading: sideways pixels per pixel fallen, negative to the left */
  private rainSlant = 0.25;
  private rainSlantTo = 0.25;
  private triedBuild = false;

  constructor() {
    this.container.eventMode = 'none';
    this.container.addChild(this.g);
    const seed = (n: number): Particle[] => Array.from({ length: n }, (_, i) => ({ x: (i * 0.618034) % 1, y: (i * 0.381966 + 0.13) % 1, r: (i * 0.7548776662) % 1 }));
    this.rain.push(...seed(RAIN_POOL));
    this.snow.push(...seed(COUNTS.snow));
    this.blizzard.push(...seed(COUNTS.blizzard));
  }

  /** a bolt of lightning struck somewhere: light the whole screen, and draw a bolt where it hit (screen position) */
  flash(sx?: number, sy?: number): void {
    this.flashAlpha = 0.55;
    const p = this.painted;
    if (p && sx !== undefined && sy !== undefined) {
      p.bolt.position.set(sx, sy);
      this.boltLife = 0.28;
    }
  }

  update(world: Readonly<World>, dt: number, width: number, height: number, low: boolean, still: boolean): void {
    if (!this.painted && !this.triedBuild) this.build();
    this.time += still ? 0 : dt;
    // ease the season wash and each kind of weather toward where the sim says they should be
    const target = SEASON_WASH[world.season];
    this.wash.color = mix(this.wash.color, target.color, Math.min(1, dt * 0.6));
    this.wash.alpha += (target.alpha - this.wash.alpha) * Math.min(1, dt * 0.6);
    for (const kind of WEATHER) {
      const want = kind === world.weather.kind ? 1 : 0;
      this.amount[kind] += (want - this.amount[kind]) * Math.min(1, dt * 0.8);
    }
    this.pickRainDirection(world);
    this.rainSlant += (this.rainSlantTo - this.rainSlant) * Math.min(1, dt * 0.5);
    this.leafAmount += ((world.season === 'fall' ? 1 : 0) - this.leafAmount) * Math.min(1, dt * 0.6);
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.2);

    const g = this.g;
    g.clear();
    g.rect(0, 0, width, height).fill({ color: this.wash.color, alpha: this.wash.alpha });
    const storm = this.amount.storm;
    const rain = this.amount.rain + storm;
    if (storm > 0.02) g.rect(0, 0, width, height).fill({ color: 0x0d1220, alpha: 0.2 * storm });

    if (this.painted) this.updatePainted(this.painted, width, height, dt, low, still, rain);
    else {
      if (this.amount.fog > 0.02) this.drawFog(g, width, height, this.amount.fog);
      if (this.amount.frost > 0.02) this.drawFrost(g, width, height, this.amount.frost);
      if (rain > 0.02) this.drawRain(g, width, height, rain, dt, low, still);
      if (this.amount.snow > 0.02) this.drawSnow(g, width, height, this.amount.snow, dt, low, still);
      if (this.amount.blizzard > 0.02) this.drawBlizzard(g, width, height, this.amount.blizzard, dt, low, still);
    }
    if (this.amount.blizzard > 0.02) g.rect(0, 0, width, height).fill({ color: 0xe8eef8, alpha: 0.32 * this.amount.blizzard });
    if (this.flashAlpha > 0.01 && !still) g.rect(0, 0, width, height).fill({ color: 0xfff6d8, alpha: this.flashAlpha });
  }

  /** every new spell of weather gets its own rain direction: left or right, a little or a lot, and never the same twice running */
  private pickRainDirection(world: Readonly<World>): void {
    if (world.weather.untilTick === this.spell) return;
    this.spell = world.weather.untilTick;
    const side = Math.random() < 0.5 ? -1 : 1;
    this.rainSlantTo = side * (0.1 + Math.random() * 0.5);
  }

  /** make the painted pieces once the art has loaded */
  private build(): void {
    this.triedBuild = true;
    const a = art();
    const o = a?.overlays;
    if (!a || !o || !o['overlay-rain'] || !o['overlay-snow'] || !o['overlay-fog'] || !o['overlay-frost'] || !o['overlay-storm']) return;
    const tile = (name: string): TilingSprite => {
      const t = new TilingSprite({ texture: o[name] as NonNullable<typeof o[string]>, width: 100, height: 100 });
      t.visible = false;
      t.eventMode = 'none';
      this.container.addChild(t);
      return t;
    };
    const rain = tile('overlay-rain');
    const downpour = tile('overlay-rain');
    const snowFar = tile('overlay-snow');
    const snow = tile('overlay-snow');
    const fog = tile('overlay-fog');
    const frost = tile('overlay-frost');
    const storm = new Sprite(o['overlay-storm']);
    storm.visible = false;
    this.container.addChild(storm);
    const drifters = (group: string, n: number): Drifter[] => {
      const list = a.sprites[group] ?? [];
      if (list.length === 0) return [];
      return Array.from({ length: n }, (_, i) => {
        const art = list[i % list.length] as ArtSprite;
        const sprite = new Sprite(art.texture);
        sprite.anchor.set(0.5);
        sprite.visible = false;
        this.container.addChild(sprite);
        return { sprite, p: { x: rnd(i, 1), y: rnd(i, 2), r: rnd(i, 3) } };
      });
    };
    const flakes = drifters('snowflakes', FLAKES);
    const leaves = drifters('leaves', LEAVES);
    const splashList = a.sprites['rain-splash'] ?? [];
    const splashes = splashList.length === 0 ? [] : Array.from({ length: SPLASHES }, (_, i) => {
      const art = splashList[i % splashList.length] as ArtSprite;
      const sprite = new Sprite(art.texture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.container.addChild(sprite);
      return { sprite, p: { x: rnd(i, 4), y: rnd(i, 5), r: rnd(i, 6) }, life: rnd(i, 7) };
    });
    const bolts = a.sprites.lightning ?? [];
    const bolt = new Sprite(bolts[0]?.texture);
    bolt.anchor.set(0.5, 1);
    bolt.visible = false;
    this.container.addChild(bolt);
    this.boltSprites = bolts;
    this.painted = { rain, downpour, snow, snowFar, fog, frost, storm, flakes, leaves, splashes, bolt };
  }

  private boltSprites: ArtSprite[] = [];

  private updatePainted(p: NonNullable<WeatherLayer['painted']>, width: number, height: number, dt: number, low: boolean, still: boolean, rain: number): void {
    const move = still ? 0 : dt;
    const snow = this.amount.snow;
    const blizzard = this.amount.blizzard;
    const storm = this.amount.storm;

    // rain: streaks falling, slanting whichever way this spell's wind blows
    p.rain.visible = rain > 0.02;
    if (p.rain.visible) {
      // a little sway on top of the slant, so the rain is never perfectly steady
      const slant = this.rainSlant + Math.sin(this.time * 0.6) * 0.04;
      const side = Math.hypot(width, height) * 1.05;
      p.rain.anchor.set(0.5);
      p.rain.position.set(width / 2, height / 2);
      p.rain.width = side;
      p.rain.height = side;
      // turn the picture from the way it was drawn to the slant wanted
      p.rain.rotation = Math.atan(RAIN_DRAWN_SLANT) - Math.atan(slant);
      p.rain.alpha = Math.min(1, this.amount.rain + storm * 1.25) * 0.7;
      p.rain.tint = 0xcfe2f5;
      // the streaks are drawn leaning left going down, so that is the way the texture runs
      p.rain.tilePosition.x += RAIN_DRAWN_SLANT * RAIN_SPEED * (1 + 0.5 * storm) * move;
      p.rain.tilePosition.y += RAIN_SPEED * (1 + 0.5 * storm) * move;
    }
    // a storm adds a second, finer and faster sheet over the first, turned a touch differently, so the rain is thick
    p.downpour.visible = storm > 0.02;
    if (p.downpour.visible) {
      const side = Math.hypot(width, height) * 1.05;
      p.downpour.anchor.set(0.5);
      p.downpour.position.set(width / 2, height / 2);
      p.downpour.width = side;
      p.downpour.height = side;
      p.downpour.tileScale.set(0.75);
      p.downpour.rotation = Math.atan(RAIN_DRAWN_SLANT) - Math.atan(this.rainSlant * 1.15 + 0.03);
      p.downpour.alpha = Math.min(1, storm) * 0.8;
      p.downpour.tint = 0xdbe8f6;
      p.downpour.tilePosition.x += RAIN_DRAWN_SLANT * RAIN_SPEED * 1.8 * move;
      p.downpour.tilePosition.y += RAIN_SPEED * 1.8 * move;
    }
    // snow: two layers of fall at different sizes and speeds, and a few big flakes in front
    p.snowFar.visible = snow + blizzard > 0.02;
    p.snow.visible = p.snowFar.visible;
    if (p.snow.visible) {
      for (const [t, scale, vx, vy, a] of [[p.snowFar, 0.7, -10, 55, 0.7], [p.snow, 1.4, -25, 110, 0.85]] as const) {
        t.width = width;
        t.height = height;
        t.tileScale.set(scale);
        t.alpha = (snow + blizzard) * a;
        // a blizzard drives the snow sideways, hard
        t.tilePosition.x += (vx * snow - 900 * blizzard * scale) * move;
        t.tilePosition.y += (vy * snow + 160 * blizzard * scale) * move;
      }
    }
    const flakeCount = low ? Math.floor(p.flakes.length / 2) : p.flakes.length;
    p.flakes.forEach((f, i) => {
      f.sprite.visible = i < flakeCount && snow > 0.02;
      if (!f.sprite.visible) return;
      this.drift(f, -22, 70, width, height, move, 1);
      f.sprite.alpha = 0.9 * snow;
      f.sprite.rotation = this.time * (0.4 + f.p.r) * (i % 2 ? 1 : -1);
      f.sprite.scale.set(0.6 + f.p.r * 0.7);
    });
    // fog drifting across
    p.fog.visible = this.amount.fog > 0.02;
    if (p.fog.visible) {
      p.fog.width = width;
      p.fog.height = height;
      p.fog.tileScale.set(1.5);
      p.fog.tint = 0xe3eadf;
      p.fog.alpha = this.amount.fog * 0.6;
      p.fog.tilePosition.x += 16 * move;
    }
    // frost creeping in from the edges
    p.frost.visible = this.amount.frost > 0.02;
    if (p.frost.visible) {
      p.frost.width = width;
      p.frost.height = height;
      p.frost.tileScale.set(1.2);
      p.frost.tint = 0xdff0fb;
      p.frost.alpha = this.amount.frost * 0.55;
    }
    // a stormy darkness at the edges, with cracks
    p.storm.visible = this.amount.storm > 0.02;
    if (p.storm.visible) {
      p.storm.width = width;
      p.storm.height = height;
      p.storm.tint = 0x9fb4d8;
      p.storm.alpha = this.amount.storm * 0.75;
    }
    // raindrops landing
    p.splashes.forEach((s, si) => {
      s.sprite.visible = rain > 0.05 && !low && (si < SPLASHES * 0.45 || storm > 0.05);
      if (!s.sprite.visible) return;
      s.life += move * (1.6 + s.p.r);
      if (s.life >= 1) {
        s.life = 0;
        s.p.x = (s.p.x * 997 + 0.381966 + this.time * 0.37) % 1;
        s.p.y = (s.p.y * 991 + 0.618034 + this.time * 0.53) % 1;
      }
      s.sprite.position.set(s.p.x * width, s.p.y * height);
      s.sprite.scale.set(0.45 + s.life * 0.75);
      s.sprite.alpha = (1 - s.life) * 0.8 * Math.min(1, rain);
    });
    // fallen leaves blowing across in fall
    p.leaves.forEach((l, i) => {
      l.sprite.visible = this.leafAmount > 0.05;
      if (!l.sprite.visible) return;
      this.blow(l, i, width, height, move, rain);
      l.sprite.alpha = 0.95 * this.leafAmount;
    });
    // the bolt
    this.boltLife = Math.max(0, this.boltLife - dt);
    p.bolt.visible = this.boltLife > 0 && !still && this.boltSprites.length > 0;
    if (p.bolt.visible) {
      const pick = this.boltSprites[Math.floor(this.boltLife * 97) % this.boltSprites.length] as ArtSprite;
      p.bolt.texture = pick.texture;
      p.bolt.scale.set(1.1);
      p.bolt.alpha = Math.min(1, this.boltLife * 6);
    }
  }

  /**
   * A leaf on the wind. A slow gust swings the wind round the compass, and each leaf answers it its own way: its own
   * speed that rises and falls, its own heading off the wind, a flutter from side to side, and a tumble that speeds up
   * and slows down. Nothing is in step, so the leaves scatter instead of streaming in lines.
   */
  private blow(l: Drifter, i: number, width: number, height: number, dt: number, rain: number): void {
    const t = this.time;
    const r2 = rnd(i, 11);
    const r3 = rnd(i, 12);
    const r4 = rnd(i, 13);
    const wind = 0.5 + 1.1 * Math.sin(t * 0.13) + 0.5 * Math.sin(t * 0.37 + 2);
    const heading = wind + (l.p.r - 0.5) * 2.6 + Math.sin(t * (0.5 + r2) + r3 * 30) * 0.9;
    const gust = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (0.3 + r4 * 0.5) + r2 * 20));
    const speed = (28 + 95 * r3 + 50 * rain) * gust;
    const flutter = Math.sin(t * (2 + r4 * 3) + l.p.r * 40) * 22 * (0.4 + r2);
    const vx = Math.cos(heading) * speed - Math.sin(heading) * flutter;
    const vy = Math.sin(heading) * speed + Math.cos(heading) * flutter;
    l.p.x = (((l.p.x + (vx * dt) / width) % 1) + 1) % 1;
    l.p.y = (((l.p.y + (vy * dt) / height) % 1) + 1) % 1;
    l.sprite.position.set(l.p.x * width, l.p.y * height);
    // tumbling: a spin that changes pace, and a leaf turning edge-on now and then
    l.sprite.rotation += dt * (1.2 + 3.2 * r2) * (r3 > 0.5 ? 1 : -1) * (0.4 + gust);
    const turn = Math.abs(Math.cos(t * (0.9 + r4 * 1.6) + r2 * 9));
    l.sprite.scale.set((0.75 + l.p.r * 0.6) * (0.55 + 0.45 * turn), (0.75 + l.p.r * 0.6));
  }

  /** move a pooled sprite by (vx, vy) pixels a second, wrapping at the screen edges, and put it there */
  private drift(d: Drifter, vx: number, vy: number, width: number, height: number, dt: number, sway: number): void {
    const speed = 0.8 + d.p.r * 0.4;
    d.p.x = (((d.p.x + (vx * dt * speed) / width) % 1) + 1) % 1;
    d.p.y = (((d.p.y + (vy * dt * speed) / height) % 1) + 1) % 1;
    d.sprite.position.set(d.p.x * width + Math.sin(this.time * 1.2 + d.p.r * 20) * 10 * sway, d.p.y * height);
  }

  /** move the first `count` particles by (dx, dy) pixels a second, wrapping at the screen edges */
  private advance(list: Particle[], count: number, dx: number, dy: number, width: number, height: number, dt: number, still: boolean): Particle[] {
    const active = list.slice(0, count);
    if (still) return active;
    for (const p of active) {
      const speed = 0.8 + p.r * 0.4;
      p.x = (((p.x + (dx * dt * speed) / width) % 1) + 1) % 1;
      p.y = (((p.y + (dy * dt * speed) / height) % 1) + 1) % 1;
    }
    return active;
  }

  private drawRain(g: Graphics, width: number, height: number, amount: number, dt: number, low: boolean, still: boolean): void {
    const heavy = 1 + 1.4 * this.amount.storm;
    const count = Math.min(this.rain.length, Math.round(COUNTS.rain * heavy * (low ? 0.5 : 1)));
    for (const p of this.advance(this.rain, count, this.rainSlant * RAIN_SPEED, RAIN_SPEED * 0.8, width, height, dt, still)) {
      const x = p.x * width;
      const y = p.y * height;
      const len = 12 + p.r * 14;
      g.moveTo(x, y).lineTo(x + len * this.rainSlant, y + len).stroke({ width: 1.4, color: 0xc4d6ea, alpha: 0.5 * Math.min(1, amount) });
    }
  }

  private drawSnow(g: Graphics, width: number, height: number, amount: number, dt: number, low: boolean, still: boolean): void {
    const count = Math.round(COUNTS.snow * (low ? 0.5 : 1));
    for (const p of this.advance(this.snow, count, -20, 70, width, height, dt, still)) {
      const x = p.x * width;
      const y = p.y * height;
      const sway = Math.sin(this.time * 1.4 + p.r * 20) * 8;
      g.circle(x + sway, y, 1.2 + p.r * 2.2).fill({ color: 0xf4f8ff, alpha: 0.85 * Math.min(1, amount) });
    }
  }

  private drawBlizzard(g: Graphics, width: number, height: number, amount: number, dt: number, low: boolean, still: boolean): void {
    const count = Math.round(COUNTS.blizzard * (low ? 0.5 : 1));
    for (const p of this.advance(this.blizzard, count, -900, 220, width, height, dt, still)) {
      const x = p.x * width;
      const y = p.y * height;
      const len = 18 + p.r * 30;
      g.moveTo(x, y).lineTo(x + len, y - len * 0.22).stroke({ width: 1.6 + p.r * 1.6, color: 0xffffff, alpha: 0.6 * Math.min(1, amount) });
    }
  }

  private drawFog(g: Graphics, width: number, height: number, amount: number): void {
    for (let i = 0; i < 7; i++) {
      const phase = this.time * (6 + i * 2) + i * 140;
      const x = (((phase % (width + 400)) + width + 400) % (width + 400)) - 200;
      const y = ((i + 0.5) / 7) * height;
      g.ellipse(x, y, 260 + i * 20, 46).fill({ color: 0xdfe6dc, alpha: 0.13 * amount });
    }
  }

  private drawFrost(g: Graphics, width: number, height: number, amount: number): void {
    for (let i = 0; i < 4; i++) {
      const inset = 4 + i * 9;
      g.rect(inset, inset, width - inset * 2, height - inset * 2).stroke({ width: 5 - i, color: 0xcfe6f6, alpha: (0.2 - i * 0.04) * amount });
    }
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [width, 0, -1, 1], [0, height, 1, -1], [width, height, -1, -1]] as const) {
      for (let k = 1; k <= 5; k++) g.moveTo(cx, cy + sy * k * 16).lineTo(cx + sx * k * 22, cy).stroke({ width: 1.2, color: 0xe6f3fb, alpha: 0.35 * amount });
    }
  }
}

/** blend two 0xRRGGBB colours */
function mix(a: number, b: number, t: number): number {
  const ch = (v: number, shift: number): number => (v >> shift) & 255;
  const lerp = (shift: number): number => Math.round(ch(a, shift) + (ch(b, shift) - ch(a, shift)) * t);
  return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
}
