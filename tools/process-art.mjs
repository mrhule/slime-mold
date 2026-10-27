/**
 * Turns the raw generated art in art-source/ into small, game-ready files in public/art/:
 *   - sheets on a magenta background are keyed to transparency and cut into one sprite per drawing
 *   - floor tiles and the vignette are shrunk to WebP
 * Run: node tools/process-art.mjs   (needs the `sharp` dev dependency)
 * Writes public/art/art.json describing every output so the game never hard-codes sprite counts.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'art-source';
const OUT = 'public/art';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

/** how magenta a pixel is, 0..1, judged against pure magenta (255, 0, 255) */
const magentaness = (r, g, b) => Math.max(0, Math.min(1, (Math.min(r, b) - g) / 255));

/** raw RGBA with the magenta background removed: soft edge, and the magenta mixed into edges taken back out */
async function keyed(file) {
  const { data, info } = await sharp(path.join(SRC, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const m = magentaness(r, g, b);
    const alpha = 1 - Math.max(0, Math.min(1, (m - 0.12) / 0.55));
    if (alpha <= 0.02) {
      out[i + 3] = 0;
      continue;
    }
    // un-mix: pixel = alpha * colour + (1 - alpha) * magenta
    const k = 1 - alpha;
    out[i] = Math.max(0, Math.min(255, (r - k * 255) / alpha));
    out[i + 1] = Math.max(0, Math.min(255, g / alpha));
    out[i + 2] = Math.max(0, Math.min(255, (b - k * 255) / alpha));
    out[i + 3] = Math.round(alpha * 255);
  }
  return { data: out, width: info.width, height: info.height };
}

/** bounding boxes of the separate drawings: connected blobs of opaque pixels, seen through a coarse grid so a drawing's loose crumbs stay with it */
function blobs({ data, width, height }, cell = 12, minPixels = 1500) {
  const gw = Math.ceil(width / cell);
  const gh = Math.ceil(height / cell);
  const filled = new Uint8Array(gw * gh);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 100) filled[Math.floor(y / cell) * gw + Math.floor(x / cell)] = 1;
  // close small gaps by one grid step
  const grown = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (filled[y * gw + x]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < gw && ny < gh) grown[ny * gw + nx] = 1;
  }
  const seen = new Uint8Array(gw * gh);
  const boxes = [];
  for (let s = 0; s < gw * gh; s++) {
    if (!grown[s] || seen[s]) continue;
    const stack = [s];
    seen[s] = 1;
    let x0 = gw, y0 = gh, x1 = 0, y1 = 0;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % gw;
      const cy = Math.floor(c / gw);
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const n = ny * gw + nx;
        if (grown[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    const box = { left: Math.max(0, x0 * cell - cell), top: Math.max(0, y0 * cell - cell), right: Math.min(width, (x1 + 1) * cell + cell), bottom: Math.min(height, (y1 + 1) * cell + cell) };
    let opaque = 0;
    for (let y = box.top; y < box.bottom; y++) for (let x = box.left; x < box.right; x++) if (data[(y * width + x) * 4 + 3] > 100) opaque++;
    if (opaque >= minPixels) boxes.push(box);
  }
  // reading order: rows first, then left to right
  boxes.sort((a, b) => (Math.abs(a.top - b.top) > 120 ? a.top - b.top : a.left - b.left));
  return boxes;
}

const manifest = { sprites: {}, images: {} };

/** @param {string} name @param {string} file @param {number} maxSize longest side of each sprite in pixels */
async function sheet(name, file, maxSize, opts = {}) {
  const img = await keyed(file);
  const boxes = blobs(img, opts.cell, opts.minPixels);
  manifest.sprites[name] = [];
  let n = 0;
  for (const b of boxes) {
    const w = b.right - b.left;
    const h = b.bottom - b.top;
    const out = `${name}-${n}.webp`;
    const scale = Math.min(1, maxSize / Math.max(w, h));
    const info = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } })
      .extract({ left: b.left, top: b.top, width: w, height: h })
      .resize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)))
      .webp({ quality: 85, alphaQuality: 90 })
      .toFile(path.join(OUT, out));
    manifest.sprites[name].push({ file: out, w: info.width, h: info.height });
    n++;
  }
  console.log(`${name}: ${n} sprites`);
}

async function plain(name, file, width, opts = {}) {
  const out = `${name}.webp`;
  const src = opts.key ? await keyed(file) : null;
  if (src && opts.neutral) {
    // a vignette only darkens: drop the colour (the generated halo is tinted) and keep brightness as depth
    for (let i = 0; i < src.data.length; i += 4) {
      const luma = 0.3 * src.data[i] + 0.59 * src.data[i + 1] + 0.11 * src.data[i + 2];
      src.data[i] = src.data[i + 1] = src.data[i + 2] = Math.round(luma * 0.35);
    }
  }
  const pipeline = src ? sharp(src.data, { raw: { width: src.width, height: src.height, channels: 4 } }) : sharp(path.join(SRC, file));
  const info = await pipeline.resize(width).webp({ quality: opts.quality ?? 80 }).toFile(path.join(OUT, out));
  manifest.images[name] = { file: out, w: info.width, h: info.height };
  console.log(`${name}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
}

await plain('floor-open', 'floor-open.png', 1024, { quality: 82 });
await plain('floor-rough', 'floor-rough.png', 1024, { quality: 82 });
await plain('vignette', 'vignette.png', 1376, { key: true, neutral: true, quality: 80 });
await sheet('food', 'food-sheet.png', 192, { minPixels: 800 });
await sheet('goo', 'goo-pool.png', 256);
await sheet('litter', 'litter-sheet.png', 72, { cell: 8, minPixels: 150 });
await sheet('twigs', 'twigs-sheet.png', 160, { minPixels: 400 });
await sheet('rocks', 'rocks-sheet.png', 256);
await sheet('rocks-moss', 'rocks-moss-sheet.png', 256);
await sheet('puddles', 'puddles-sheet.png', 192);
await sheet('factory', 'factory-sheet.png', 160);
await sheet('relay-booster', 'relay-booster-sheet.png', 160);
if (fs.existsSync(path.join(SRC, 'collector-sheet.png'))) await sheet('collector', 'collector-sheet.png', 160);
if (fs.existsSync(path.join(SRC, 'fortress-sheet.png'))) await sheet('fortress', 'fortress-sheet.png', 160);
if (fs.existsSync(path.join(SRC, 'goo-link.png'))) await sheet('goo-link', 'goo-link.png', 160);

fs.writeFileSync(path.join(OUT, 'art.json'), JSON.stringify(manifest, null, 1));
const total = fs.readdirSync(OUT).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`total ${(total / 1024).toFixed(0)} KB`);
