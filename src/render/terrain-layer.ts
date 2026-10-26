import { Sprite, Texture } from 'pixi.js';
import { hash2, valueNoise } from '../sim/noise';
import { Terrain } from '../sim/types';
import type { World } from '../sim/types';
import { CELL } from './units';
import { FLOOR_TILE_WORLD_PX, art } from './art';
import type { Art, ArtSprite } from './art';
import { INK, MAP, rgb } from './palette';
import { style } from './style';

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

type Rgb = [number, number, number];

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** blur radius in pixels: rounds the grid's square steps into smooth blobs */
const BLUR = 4;
/** where the blurred occupancy counts as "inside" */
const EDGE = 0.4;

/**
 * Bakes the whole map into one texture: a grimy surface in smooth flat grunge bands, inked
 * rough patches, cel-shaded glass obstacles with hatched drop shadows, and a dark dish wall
 * (FR-032). Shapes come from a blurred, wobbled occupancy field rather than the grid squares, so
 * edges read as hand-inked curves instead of stair-steps. One texel per world unit.
 */
export function bakeTerrain(world: Readonly<World>): Sprite {
  const w = world.width;
  const h = world.height;
  const pw = w * CELL;
  const ph = h * CELL;
  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  const img = ctx.createImageData(pw, ph);
  const rough = occupancy(world, (i) => world.terrain[i] === Terrain.Rough, pw, ph);
  const glass = occupancy(world, (i) => world.terrain[i] === Terrain.Obstacle, pw, ph);
  const painted = art();
  paintGround(img, rough, glass, pw, ph, painted);
  ctx.putImageData(img, 0, 0);
  if (painted) paintProps(world, ctx, painted);

  paintWall(world, ctx);
  paintScratches(world, ctx, pw, ph);

  const sprite = new Sprite(Texture.from(canvas));
  sprite.width = pw;
  sprite.height = ph;
  return sprite;
}

/** 1 where a cell matches, blurred into a soft field the size of the texture */
function occupancy(world: Readonly<World>, match: (cell: number) => boolean, pw: number, ph: number): Float32Array {
  const w = world.width;
  const field = new Float32Array(pw * ph);
  for (let cy = 0; cy < world.height; cy++) {
    for (let cx = 0; cx < w; cx++) {
      if (!match(cy * w + cx)) continue;
      for (let y = cy * CELL; y < (cy + 1) * CELL; y++) field.fill(1, y * pw + cx * CELL, y * pw + (cx + 1) * CELL);
    }
  }
  const tmp = new Float32Array(pw * ph);
  boxBlur(field, tmp, pw, ph, BLUR);
  boxBlur(field, tmp, pw, ph, BLUR);
  return field;
}

/** in-place separable box blur (running sums); `tmp` is scratch of the same size */
function boxBlur(a: Float32Array, tmp: Float32Array, w: number, h: number, r: number): void {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = 0; x <= r && x < w; x++) sum += a[row + x] as number;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum * inv;
      const add = x + r + 1;
      const sub = x - r;
      if (add < w) sum += a[row + add] as number;
      if (sub >= 0) sum -= a[row + sub] as number;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= r && y < h; y++) sum += tmp[y * w + x] as number;
    for (let y = 0; y < h; y++) {
      a[y * w + x] = sum * inv;
      const add = y + r + 1;
      const sub = y - r;
      if (add < h) sum += tmp[add * w + x] as number;
      if (sub >= 0) sum -= tmp[sub * w + x] as number;
    }
  }
}

function paintGround(img: ImageData, rough: Float32Array, glass: Float32Array, pw: number, ph: number, painted: Art | null): void {
  const data = img.data;
  const bands: Rgb[] = [rgb(MAP.dark), rgb(MAP.mid), rgb(MAP.base)];
  const roughC = rgb(MAP.rough);
  const roughInk = rgb(MAP.roughHatch);
  const glassC = rgb(MAP.glass);
  const glassDarkC = rgb(MAP.glassDark);
  const glassLightC = rgb(MAP.glassLight);
  const ink = rgb(INK);
  const floor = painted ? new FloorSampler(painted, pw, ph) : null;
  const out: Rgb = [0, 0, 0];

  const at = (f: Float32Array, x: number, y: number): number => {
    const xx = x < 0 ? 0 : x >= pw ? pw - 1 : x;
    const yy = y < 0 ? 0 : y >= ph ? ph - 1 : y;
    return f[yy * pw + xx] as number;
  };

  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = y * pw + x;
      // flat 3-band grunge from low-frequency noise, band edges anti-aliased
      const n = 0.6 * valueNoise(x / 152, y / 152, 11) + 0.4 * valueNoise(x / 36, y / 36, 23);
      const lo = smooth(0.39, 0.41, n);
      const hi = smooth(0.59, 0.61, n);
      let r = bands[0]![0] + (bands[1]![0] - bands[0]![0]) * lo + (bands[2]![0] - bands[1]![0]) * hi;
      let g = bands[0]![1] + (bands[1]![1] - bands[0]![1]) * lo + (bands[2]![1] - bands[1]![1]) * hi;
      let b = bands[0]![2] + (bands[1]![2] - bands[0]![2]) * lo + (bands[2]![2] - bands[1]![2]) * hi;
      if (floor) {
        floor.sample(floor.open, x, y, out);
        [r, g, b] = out;
      }

      const mixIn = (c: Rgb, a: number): void => {
        r += (c[0] - r) * a;
        g += (c[1] - g) * a;
        b += (c[2] - b) * a;
      };

      // hand-inked wobble so no edge is a straight run of grid squares
      const wobble = (valueNoise(x / 13, y / 13, 41) - 0.5) * 0.2;

      // rough patches: darker flat tone, diagonal ink hatching inside
      const rv = (rough[i] as number) + wobble;
      if (rv > EDGE - 0.05) {
        const inside = smooth(EDGE - 0.02, EDGE + 0.02, rv);
        if (floor) {
          floor.sample(floor.rough, x, y, out);
          mixIn(out, inside);
        } else mixIn(roughC, inside);
        const phase = (((x * 0.8 + y) % 7) + 7) % 7;
        const line = 1 - smooth(0.5, 1.3, Math.abs(phase - 3.5) * 0.6 + 0.0);
        if (!floor) mixIn(roughInk, inside * smooth(EDGE + 0.1, EDGE + 0.2, rv) * line * 0.7);
        const rim = smooth(EDGE - 0.02, EDGE + 0.02, rv) * (1 - smooth(EDGE + 0.06, EDGE + 0.1, rv));
        mixIn(roughInk, rim * 0.45);
      }

      // glass obstacles: hatched drop shadow, flat cel bands, a lit rim, a heavy ink outline
      const gv = (glass[i] as number) + wobble;
      const sv = at(glass, x - 3, y - 4) + wobble;
      if (sv > EDGE && gv < EDGE) {
        const shade = smooth(EDGE, EDGE + 0.03, sv);
        mixIn(ink, shade * 0.4);
        const hatch = (((x + y) % 6) + 6) % 6;
        mixIn(ink, shade * (1 - smooth(1.0, 2.0, hatch)) * 0.55);
      }
      if (gv > EDGE - 0.04) {
        const inside = smooth(EDGE - 0.02, EDGE + 0.02, gv);
        const dark = smooth(0.71, 0.73, valueNoise(x / 22, y / 22, 21));
        const body: Rgb = [
          glassC[0] + (glassDarkC[0] - glassC[0]) * dark,
          glassC[1] + (glassDarkC[1] - glassC[1]) * dark,
          glassC[2] + (glassDarkC[2] - glassC[2]) * dark,
        ];
        mixIn(body, inside);
        // lit strip along edges facing up-left: inside, but the point up-left of here is not
        const litv = at(glass, x - 4, y - 4) + wobble;
        const lit = smooth(EDGE + 0.04, EDGE + 0.07, gv) * (1 - smooth(EDGE - 0.04, EDGE, litv)) * (1 - smooth(EDGE + 0.2, EDGE + 0.26, gv));
        mixIn(glassLightC, lit * inside);
        // heavy ink outline just inside the edge: thinner where the step toward the light is open
        // and heavier where the step away from it is (the shadow side), within the style's range (A12)
        const awayV = at(glass, x + 3, y + 3) + wobble;
        const shadeSide = 1 - smooth(EDGE - 0.04, EDGE + 0.04, awayV);
        const width = 0.1 * (style.outline.padLit + shadeSide * (style.outline.padShade - style.outline.padLit));
        const outline = smooth(EDGE - 0.02, EDGE + 0.02, gv) * (1 - smooth(EDGE + width - 0.02, EDGE + width + 0.02, gv));
        mixIn(ink, outline);
      }

      const o = i * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
}

function paintWall(world: Readonly<World>, ctx: CanvasRenderingContext2D): void {
  const w = world.width;
  const h = world.height;
  ctx.fillStyle = css(MAP.wall);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (world.terrain[y * w + x] === Terrain.Wall) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
  // inked inner edge of the dish, softly rounded
  ctx.strokeStyle = css(INK);
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(CELL, CELL, w * CELL - 2 * CELL, h * CELL - 2 * CELL, CELL * 1.5);
  ctx.stroke();
}

function paintScratches(world: Readonly<World>, ctx: CanvasRenderingContext2D, pw: number, ph: number): void {
  ctx.strokeStyle = css(MAP.scratch);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const count = Math.floor((pw * ph) / 9000);
  for (let n = 0; n < count; n++) {
    const x = hash2(n, 1, world.seed) * pw;
    const y = hash2(n, 2, world.seed) * ph;
    const len = 6 + hash2(n, 3, world.seed) * 22;
    const dir = (hash2(n, 4, world.seed) - 0.5) * 0.9;
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + len * dir);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Samples a tiled floor image without visible seams: each pixel blends four copies of the tile, shifted by half
 * a tile, weighted so the copy whose seam is nearest contributes nothing there. The blend softens contrast a
 * little in return, which keeps the floor quiet behind the veins.
 */
class FloorSampler {
  readonly open: ImageData;
  readonly rough: ImageData;
  private readonly t: number;
  private readonly scale: number;
  private readonly wx: Float32Array;
  private readonly wy: Float32Array;

  constructor(painted: Art, pw: number, ph: number) {
    this.open = painted.open;
    this.rough = painted.rough;
    this.t = painted.tile;
    // the tile covers FLOOR_TILE_WORLD_PX world pixels, so one texel is this many canvas pixels
    this.scale = painted.tile / FLOOR_TILE_WORLD_PX;
    const weights = (n: number): Float32Array => {
      const a = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const u = ((i * this.scale) % this.t) / this.t;
        a[i] = Math.sin(Math.PI * u) ** 2;
      }
      return a;
    };
    this.wx = weights(pw);
    this.wy = weights(ph);
  }

  sample(img: ImageData, x: number, y: number, out: Rgb): void {
    const t = this.t;
    const half = t >> 1;
    const u = Math.floor(x * this.scale) % t;
    const v = Math.floor(y * this.scale) % t;
    const u2 = (u + half) % t;
    const v2 = (v + half) % t;
    const a = this.wx[x] as number;
    const b = this.wy[y] as number;
    const d = img.data;
    const i00 = (v * t + u) * 4;
    const i10 = (v * t + u2) * 4;
    const i01 = (v2 * t + u) * 4;
    const i11 = (v2 * t + u2) * 4;
    const w00 = a * b;
    const w10 = (1 - a) * b;
    const w01 = a * (1 - b);
    const w11 = (1 - a) * (1 - b);
    out[0] = (d[i00] as number) * w00 + (d[i10] as number) * w10 + (d[i01] as number) * w01 + (d[i11] as number) * w11;
    out[1] = (d[i00 + 1] as number) * w00 + (d[i10 + 1] as number) * w10 + (d[i01 + 1] as number) * w01 + (d[i11 + 1] as number) * w11;
    out[2] = (d[i00 + 2] as number) * w00 + (d[i10 + 2] as number) * w10 + (d[i01 + 2] as number) * w01 + (d[i11 + 2] as number) * w11;
  }
}

const isObstacle = (world: Readonly<World>, cell: number): boolean => world.terrain[cell] === Terrain.Obstacle;
const isFloor = (world: Readonly<World>, cell: number): boolean => world.terrain[cell] === Terrain.Open || world.terrain[cell] === Terrain.Rough;

/** a sprite drawn centred on (cx, cy) so its longest side is `size` world pixels */
function stamp(ctx: CanvasRenderingContext2D, sprite: ArtSprite, cx: number, cy: number, size: number, angle = 0, alpha = 1): void {
  const k = size / Math.max(sprite.w, sprite.h);
  const w = sprite.w * k;
  const h = sprite.h * k;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  if (angle) ctx.rotate(angle);
  ctx.drawImage(sprite.image, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/**
 * The painted extras, drawn into the terrain canvas: small litter and twigs scattered on open ground, then
 * piles of rocks laid over every obstacle so the blocked cells read as boulders. The plain obstacle body stays
 * underneath, so a gap between rocks looks like shadow rather than open floor.
 */
function paintProps(world: Readonly<World>, ctx: CanvasRenderingContext2D, painted: Art): void {
  const w = world.width;
  const h = world.height;
  const litter = painted.sprites.litter ?? [];
  const twigs = painted.sprites.twigs ?? [];
  const rocks = [...(painted.sprites.rocks ?? []), ...(painted.sprites['rocks-moss'] ?? [])];

  for (let cy = 2; cy < h - 2; cy++) {
    for (let cx = 2; cx < w - 2; cx++) {
      const cell = cy * w + cx;
      if (!isFloor(world, cell)) continue;
      const roll = hash2(cx, cy, world.seed + 71);
      const x = (cx + hash2(cx, cy, world.seed + 72)) * CELL;
      const y = (cy + hash2(cx, cy, world.seed + 73)) * CELL;
      const angle = (hash2(cx, cy, world.seed + 74) - 0.5) * Math.PI * 2;
      if (roll < 1 / 90 && litter.length > 0) {
        stamp(ctx, litter[Math.floor(hash2(cx, cy, world.seed + 75) * litter.length)] as ArtSprite, x, y, 12 + hash2(cx, cy, world.seed + 76) * 8, angle, 0.9);
      } else if (roll > 1 - 1 / 260 && twigs.length > 0) {
        stamp(ctx, twigs[Math.floor(hash2(cx, cy, world.seed + 77) * twigs.length)] as ArtSprite, x, y, 26 + hash2(cx, cy, world.seed + 78) * 26, angle, 0.85);
      }
    }
  }

  if (rocks.length === 0) return;
  // cover each obstacle cell with a rock: raster order, each rock marking the cells it hides
  const covered = new Uint8Array(w * h);
  const placed: { x: number; y: number; size: number; sprite: ArtSprite }[] = [];
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const cell = cy * w + cx;
      if (!isObstacle(world, cell) || covered[cell]) continue;
      const radius = 1.6 + hash2(cx, cy, world.seed + 81) * 1.6; // in cells
      const mx = cx + radius * 0.55;
      const my = cy + radius * 0.55;
      for (let yy = Math.floor(my - radius); yy <= Math.ceil(my + radius); yy++) {
        for (let xx = Math.floor(mx - radius); xx <= Math.ceil(mx + radius); xx++) {
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          if ((xx - mx) ** 2 + (yy - my) ** 2 <= radius * radius) covered[yy * w + xx] = 1;
        }
      }
      placed.push({ x: (mx + 0.5 + (hash2(cx, cy, world.seed + 83) - 0.5) * 1.1) * CELL, y: (my + 0.5 + (hash2(cx, cy, world.seed + 84) - 0.5) * 1.1) * CELL, size: radius * 2.3 * CELL, sprite: rocks[Math.floor(hash2(cx, cy, world.seed + 82) * rocks.length)] as ArtSprite });
    }
  }
  // lower rocks in front, so piles overlap the way they would seen from above and to the side
  placed.sort((a, b) => a.y - b.y);
  for (const r of placed) stamp(ctx, r.sprite, r.x, r.y, r.size);
}
