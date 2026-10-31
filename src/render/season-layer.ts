import { Container, Sprite } from 'pixi.js';
import { hash2 } from '../sim/noise';
import { Terrain } from '../sim/types';
import type { Season, World } from '../sim/types';
import { art } from './art';
import type { ArtSprite } from './art';
import { CELL } from './units';

/**
 * The small things that come and go with the seasons, scattered over open ground when the round is
 * built and faded in and out as the season turns: green growth and flowers in spring, berries and
 * tall grass in summer, mushrooms, acorns and fallen leaves in fall, snow patches in winter. They
 * are only pictures; the sim knows nothing about them. Placement comes from the map's seed, so a
 * replay looks the same.
 */

/** floor-life sheet order: the first drawing is 0 */
const LIFE = { buttons: 0, tall: 1, ring: 2, bracket: 3, moss: 4, lichen: 5, fern: 6, sapling: 7, grass: 8, bramble: 9, dandelion: 10, acorns: 11, dryLeaf: 12, shells: 13, roots: 14, cone: 15 } as const;

interface SeasonKind {
  /** one in this many open cells holds an item */
  every: number;
  /** drawn size range, world pixels */
  size: [number, number];
  /** which sprites: [group in the art manifest, index or -1 for any] */
  pick: [string, number][];
}

const KINDS: Record<Season, SeasonKind> = {
  spring: { every: 55, size: [14, 24], pick: [['floor-life', LIFE.fern], ['floor-life', LIFE.sapling], ['floor-life', LIFE.grass], ['floor-life', LIFE.moss], ['floor-life', LIFE.dandelion], ['floor-life', LIFE.buttons]] },
  summer: { every: 60, size: [14, 26], pick: [['floor-life', LIFE.bramble], ['floor-life', LIFE.grass], ['floor-life', LIFE.fern], ['floor-life', LIFE.dandelion], ['floor-life', LIFE.sapling]] },
  fall: { every: 34, size: [12, 22], pick: [['leaves', -1], ['leaves', -1], ['leaves', -1], ['floor-life', LIFE.acorns], ['floor-life', LIFE.tall], ['floor-life', LIFE.ring], ['floor-life', LIFE.bracket], ['floor-life', LIFE.dryLeaf], ['floor-life', LIFE.cone]] },
  // the thin patches, the heaps on rocks and the snowy log (not the round mounds, which read as snowballs from above)
  winter: { every: 70, size: [26, 46], pick: [['snow-patches', 0], ['snow-patches', 1], ['snow-patches', 2], ['snow-patches', 6], ['snow-patches', 7], ['snow-patches', 8]] },
};

const SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'winter'];
/** how fast a season's things fade in or out, per second */
const FADE = 0.45;

export class SeasonLayer {
  readonly container = new Container();
  private readonly groups = new Map<Season, Container>();
  private readonly amount: Record<Season, number> = { spring: 0, summer: 0, fall: 0, winter: 0 };

  constructor(world: Readonly<World>) {
    this.container.eventMode = 'none';
    const painted = art();
    for (const season of SEASONS) {
      const group = new Container();
      group.visible = false;
      group.alpha = 0;
      this.groups.set(season, group);
      this.container.addChild(group);
    }
    this.amount[world.season] = 1;
    if (!painted) return;
    const w = world.width;
    const h = world.height;
    SEASONS.forEach((season, si) => {
      const kind = KINDS[season];
      const group = this.groups.get(season) as Container;
      for (let cy = 2; cy < h - 2; cy++) {
        for (let cx = 2; cx < w - 2; cx++) {
          const t = world.terrain[cy * w + cx];
          if (t !== Terrain.Open && t !== Terrain.Rough) continue;
          if (hash2(cx, cy, world.seed + 500 + si) * kind.every >= 1) continue;
          const [name, index] = kind.pick[Math.floor(hash2(cx, cy, world.seed + 510 + si) * kind.pick.length)] as [string, number];
          const list = painted.sprites[name];
          if (!list || list.length === 0) continue;
          const entry = list[index >= 0 ? index : Math.floor(hash2(cx, cy, world.seed + 520 + si) * list.length)] as ArtSprite | undefined;
          if (!entry) continue;
          const sprite = new Sprite(entry.texture);
          sprite.anchor.set(0.5);
          const size = kind.size[0] + hash2(cx, cy, world.seed + 530 + si) * (kind.size[1] - kind.size[0]);
          sprite.scale.set(size / Math.max(entry.w, entry.h));
          sprite.position.set((cx + hash2(cx, cy, world.seed + 540 + si)) * CELL, (cy + hash2(cx, cy, world.seed + 550 + si)) * CELL);
          sprite.rotation = (hash2(cx, cy, world.seed + 560 + si) - 0.5) * Math.PI * 2;
          group.addChild(sprite);
        }
      }
    });
    this.apply();
  }

  update(world: Readonly<World>, dt: number, still: boolean): void {
    let changed = false;
    for (const season of SEASONS) {
      const want = season === world.season ? 1 : 0;
      const now = this.amount[season];
      if (now === want) continue;
      const next = still ? want : now + Math.sign(want - now) * Math.min(Math.abs(want - now), dt * FADE);
      this.amount[season] = next;
      changed = true;
    }
    if (changed) this.apply();
  }

  private apply(): void {
    for (const season of SEASONS) {
      const group = this.groups.get(season) as Container;
      const a = this.amount[season];
      group.alpha = a;
      group.visible = a > 0.01;
    }
  }
}
