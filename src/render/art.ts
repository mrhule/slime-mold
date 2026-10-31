import { Texture } from 'pixi.js';

/** one cut-out drawing: its Pixi texture, the image itself (for painting into the terrain canvas) and its pixel size */
export interface ArtSprite {
  texture: Texture;
  image: HTMLImageElement;
  w: number;
  h: number;
}

/** the painted look: tiled floors, cut-out sprites and the vignette. Missing in tests and when loading fails. */
export interface Art {
  /** a floor tile's pixels; the tile is `tile` pixels square */
  open: ImageData;
  rough: ImageData;
  tile: number;
  sprites: Record<string, ArtSprite[]>;
  vignette: Texture;
  /** the extra ground tiles (mud, needles, gravel, wet, snow), by manifest name, as pixels like `open` */
  ground: Record<string, ImageData>;
  /** weather overlays: white marks that are see-through everywhere else, by manifest name (`overlay-rain` and so on) */
  overlays: Record<string, Texture>;
}

interface Manifest {
  sprites: Record<string, { file: string; w: number; h: number }[]>;
  images: Record<string, { file: string; w: number; h: number }>;
}

/** how many world pixels one floor tile covers; smaller reads as finer grit */
export const FLOOR_TILE_WORLD_PX = 512;

let loaded: Art | null = null;

/** the painted art, or null when it has not loaded (the game then draws its plain procedural look) */
export const art = (): Art | null => loaded;

async function image(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

function pixels(img: HTMLImageElement, size: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

/** load the art once; every failure is swallowed so the game still runs without it */
export async function loadArt(baseUrl: string = import.meta.env.BASE_URL): Promise<Art | null> {
  if (loaded) return loaded;
  // ?plain skips the painted art, to compare with the procedural look
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('plain')) return null;
  try {
    const dir = `${baseUrl}art/`;
    const manifest = (await (await fetch(`${dir}art.json`)).json()) as Manifest;
    const [open, rough, vignette] = await Promise.all(['floor-open', 'floor-rough', 'vignette'].map((n) => image(dir + (manifest.images[n] as { file: string }).file)));
    const sprites: Art['sprites'] = {};
    await Promise.all(
      Object.entries(manifest.sprites).map(async ([name, list]) => {
        sprites[name] = await Promise.all(list.map(async (s) => {
          const img = await image(dir + s.file);
          return { texture: Texture.from(img), image: img, w: s.w, h: s.h };
        }));
      }),
    );
    const tile = 512;
    // the second set of art is optional: a manifest without it still loads
    const ground: Art['ground'] = {};
    const overlays: Art['overlays'] = {};
    await Promise.all(
      Object.entries(manifest.images).map(async ([name, entry]) => {
        if (name.startsWith('floor-') && name !== 'floor-open' && name !== 'floor-rough') ground[name] = pixels(await image(dir + entry.file), tile);
        else if (name.startsWith('overlay-')) {
          const texture = Texture.from(await image(dir + entry.file));
          texture.source.addressMode = 'repeat';
          overlays[name] = texture;
        }
      }),
    );
    loaded = { open: pixels(open as HTMLImageElement, tile), rough: pixels(rough as HTMLImageElement, tile), tile, sprites, vignette: Texture.from(vignette as HTMLImageElement), ground, overlays };
    return loaded;
  } catch {
    loaded = null;
    return null;
  }
}
