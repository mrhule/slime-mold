import { Sprite, Texture } from 'pixi.js';
import { hash2, valueNoise } from '../sim/noise';
import { Terrain } from '../sim/types';
import type { World } from '../sim/types';
import { CELL } from './units';
import { INK, MAP, rgb } from './palette';

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

/** deterministic per-cell wobble in [-1, 1] */
const wob = (cell: number, salt: number): number => hash2(cell, salt, 7) * 2 - 1;

/**
 * Bakes the whole map into one texture: a grimy scratched surface with flat grunge bands,
 * inked rough patches, cel-shaded glass obstacles with hatched drop shadows, and a dark dish
 * wall (FR-032). One texel per world unit.
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

  paintSurface(ctx, pw, ph);

  // rough patches: darker flat tone with ink hatching
  ctx.lineCap = 'round';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (world.terrain[i] !== Terrain.Rough) continue;
      ctx.fillStyle = css(MAP.rough);
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
  ctx.strokeStyle = css(MAP.roughHatch);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (world.terrain[i] !== Terrain.Rough) continue;
      const ox = x * CELL;
      const oy = y * CELL;
      for (let k = 0; k < 3; k++) {
        const off = (k + 0.5) * (CELL / 3);
        ctx.moveTo(ox + off + wob(i, k) * 0.8, oy + CELL);
        ctx.lineTo(ox + off + CELL * 0.45 + wob(i, k + 9) * 0.8, oy + CELL * 0.1);
      }
    }
  }
  ctx.stroke();

  paintObstacles(world, ctx);
  paintWall(world, ctx);
  paintScratches(world, ctx, pw, ph);

  const sprite = new Sprite(Texture.from(canvas));
  sprite.width = pw;
  sprite.height = ph;
  return sprite;
}

function paintSurface(ctx: CanvasRenderingContext2D, pw: number, ph: number): void {
  // flat 3-band grunge from low-frequency noise, written block by block
  const block = 4;
  const bw = Math.ceil(pw / block);
  const bh = Math.ceil(ph / block);
  const img = ctx.createImageData(pw, ph);
  const bands = [rgb(MAP.dark), rgb(MAP.mid), rgb(MAP.base)];
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const n = 0.6 * valueNoise(bx / 38, by / 38, 11) + 0.4 * valueNoise(bx / 9, by / 9, 23);
      const grain = hash2(bx, by, 5);
      const v = n + (grain - 0.5) * 0.12;
      const [r, g, b] = bands[v < 0.4 ? 0 : v < 0.6 ? 1 : 2] as [number, number, number];
      for (let yy = 0; yy < block; yy++) {
        const py = by * block + yy;
        if (py >= ph) break;
        for (let xx = 0; xx < block; xx++) {
          const px = bx * block + xx;
          if (px >= pw) break;
          const o = (py * pw + px) * 4;
          img.data[o] = r;
          img.data[o + 1] = g;
          img.data[o + 2] = b;
          img.data[o + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function paintObstacles(world: Readonly<World>, ctx: CanvasRenderingContext2D): void {
  const w = world.width;
  const h = world.height;
  const isObs = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && world.terrain[y * w + x] === Terrain.Obstacle;

  // hatched drop shadow first
  ctx.fillStyle = 'rgba(15, 13, 11, 0.55)';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isObs(x, y)) ctx.fillRect(x * CELL + 3, y * CELL + 4, CELL, CELL);
    }
  }
  ctx.strokeStyle = css(INK);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isObs(x, y) || isObs(x, y + 1)) continue;
      // below a bottom edge: short diagonal hatches in the shadow
      for (let k = 0; k < 4; k++) {
        const hx = x * CELL + k * 2.2 + 1;
        ctx.moveTo(hx, y * CELL + CELL + 0.5);
        ctx.lineTo(hx + 3, y * CELL + CELL + 4.5);
      }
    }
  }
  ctx.stroke();

  // glass body in flat bands
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isObs(x, y)) continue;
      const i = y * w + x;
      // flat bands in chunky 2x2-cell patches, not a per-cell checkerboard
      const band = hash2(x >> 1, y >> 1, 21);
      ctx.fillStyle = css(band > 0.72 ? MAP.glassDark : MAP.glass);
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      if (!isObs(x - 1, y) || !isObs(x, y - 1)) {
        ctx.fillStyle = css(MAP.glassLight);
        ctx.fillRect(x * CELL + 1.5, y * CELL + 1.5, CELL * 0.45, 2 + (i % 3));
      }
    }
  }

  // wobbly ink outline along every edge facing open ground
  ctx.strokeStyle = css(INK);
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const edge = (x1: number, y1: number, x2: number, y2: number, seed: number): void => {
    const mx = (x1 + x2) / 2 + wob(seed, 1) * 1.1;
    const my = (y1 + y2) / 2 + wob(seed, 2) * 1.1;
    ctx.moveTo(x1 + wob(seed, 3) * 0.6, y1 + wob(seed, 4) * 0.6);
    ctx.quadraticCurveTo(mx, my, x2 + wob(seed, 5) * 0.6, y2 + wob(seed, 6) * 0.6);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isObs(x, y)) continue;
      const i = y * w + x;
      const x0 = x * CELL;
      const y0 = y * CELL;
      if (!isObs(x, y - 1)) edge(x0, y0, x0 + CELL, y0, i * 4);
      if (!isObs(x, y + 1)) edge(x0, y0 + CELL, x0 + CELL, y0 + CELL, i * 4 + 1);
      if (!isObs(x - 1, y)) edge(x0, y0, x0, y0 + CELL, i * 4 + 2);
      if (!isObs(x + 1, y)) edge(x0 + CELL, y0, x0 + CELL, y0 + CELL, i * 4 + 3);
    }
  }
  ctx.stroke();
}

function paintWall(world: Readonly<World>, ctx: CanvasRenderingContext2D): void {
  const w = world.width;
  const h = world.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (world.terrain[y * w + x] !== Terrain.Wall) continue;
      ctx.fillStyle = css(MAP.wall);
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = css(MAP.wallLight);
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 2);
      }
    }
  }
  // inked inner edge of the dish
  ctx.strokeStyle = css(INK);
  ctx.lineWidth = 4;
  ctx.strokeRect(CELL, CELL, w * CELL - 2 * CELL, h * CELL - 2 * CELL);
}

function paintScratches(world: Readonly<World>, ctx: CanvasRenderingContext2D, pw: number, ph: number): void {
  ctx.strokeStyle = css(MAP.scratch);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
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
