import { Sprite, Texture } from 'pixi.js';
import { hash2, valueNoise } from '../sim/noise';
import { Terrain } from '../sim/types';
import type { World } from '../sim/types';
import { CELL } from './units';
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
  const fertile = occupancy(world, (i) => world.fertile[i] === 1, pw, ph);
  paintGround(img, rough, glass, fertile, pw, ph);
  ctx.putImageData(img, 0, 0);

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

function paintGround(img: ImageData, rough: Float32Array, glass: Float32Array, fertile: Float32Array, pw: number, ph: number): void {
  const data = img.data;
  const bands: Rgb[] = [rgb(MAP.dark), rgb(MAP.mid), rgb(MAP.base)];
  const roughC = rgb(MAP.rough);
  const roughInk = rgb(MAP.roughHatch);
  const glassC = rgb(MAP.glass);
  const glassDarkC = rgb(MAP.glassDark);
  const glassLightC = rgb(MAP.glassLight);
  const ink = rgb(INK);
  const fertileC = rgb(MAP.fertile);
  const fertileLightC = rgb(MAP.fertileLight);
  const fertileInkC = rgb(MAP.fertileInk);

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
        mixIn(roughC, inside);
        const phase = (((x * 0.8 + y) % 7) + 7) % 7;
        const line = 1 - smooth(0.5, 1.3, Math.abs(phase - 3.5) * 0.6 + 0.0);
        mixIn(roughInk, inside * smooth(EDGE + 0.1, EDGE + 0.2, rv) * line * 0.7);
        const rim = smooth(EDGE - 0.02, EDGE + 0.02, rv) * (1 - smooth(EDGE + 0.06, EDGE + 0.1, rv));
        mixIn(roughInk, rim * 0.45);
      }

      // fertile ground: a flat green wash with a soft inked edge and short inked tufts, so it reads
      // by shape as well as tone (S10)
      const fv = (fertile[i] as number) + wobble;
      if (fv > EDGE - 0.05) {
        const inside = smooth(EDGE - 0.02, EDGE + 0.02, fv);
        const lit = smooth(0.5, 0.52, valueNoise(x / 20, y / 20, 61));
        mixIn(fertileC, inside * 0.92);
        mixIn(fertileLightC, inside * lit * 0.55);
        const rim = smooth(EDGE - 0.02, EDGE + 0.02, fv) * (1 - smooth(EDGE + 0.05, EDGE + 0.1, fv));
        mixIn(fertileInkC, rim * 0.7);
        // one tuft per 9px block, drawn as a small V opening upward
        const bx = Math.floor(x / 9);
        const by = Math.floor(y / 9);
        if (hash2(bx, by, 83) < 0.45 && fv > EDGE + 0.12) {
          const dx = x - (bx * 9 + 2 + Math.floor(hash2(bx, by, 84) * 5));
          const dy = y - (by * 9 + 3 + Math.floor(hash2(bx, by, 85) * 4));
          if (dy >= -4 && dy <= 0 && Math.abs(Math.abs(dx) + dy * 0.5) < 0.8 && Math.abs(dx) <= 2.5) mixIn(fertileInkC, inside * 0.85);
        }
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
