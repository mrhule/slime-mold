import { BufferImageSource, Container, Mesh, MeshGeometry, Shader, Texture } from 'pixi.js';
import type { World } from '../sim/types';
import { INK_RGB, moldColor, moldPattern, rgb } from './palette';
import { CELL } from './units';
import vertex from './shaders/world.vert?raw';
import fragment from './shaders/toon.frag?raw';

/**
 * The slime body: one texel per grid cell holding owner color, ink pattern, and biomass,
 * drawn through the ink-film shader (flat cel bands, wobbly heavy outline, hatching; no glow).
 */
export class FilmLayer {
  readonly container = new Container();
  private readonly data: Uint8Array;
  private readonly source: BufferImageSource;
  private readonly uniforms: { uTime: number };
  private lastTick = -1;

  constructor(world: Readonly<World>) {
    const w = world.width;
    const h = world.height;
    this.data = new Uint8Array(w * h * 4);
    this.source = new BufferImageSource({
      resource: this.data,
      width: w,
      height: h,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'nearest',
    });
    const texture = new Texture({ source: this.source });

    const pw = w * CELL;
    const ph = h * CELL;
    const geometry = new MeshGeometry({
      positions: new Float32Array([0, 0, pw, 0, pw, ph, 0, ph]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    const shader = Shader.from({
      gl: { vertex, fragment },
      resources: {
        uData: texture.source,
        filmUniforms: {
          uGrid: { value: [w, h], type: 'vec2<f32>' },
          uTime: { value: 0, type: 'f32' },
          uOutlinePx: { value: 2.6, type: 'f32' },
          uInk: { value: INK_RGB, type: 'vec3<f32>' },
        },
      },
    });
    this.uniforms = shader.resources.filmUniforms.uniforms as { uTime: number };
    this.container.addChild(new Mesh({ geometry, shader }));
  }

  update(world: Readonly<World>, timeSeconds: number): void {
    this.uniforms.uTime = timeSeconds;
    if (world.tick === this.lastTick) return;
    this.lastTick = world.tick;
    const data = this.data;
    const colors = world.molds.map((m) => rgb(moldColor(m.color)));
    const patterns = world.molds.map((m) => moldPattern(m.pattern));
    const player = world.molds[0];
    const vision = player?.vision;
    for (let i = 0; i < world.owner.length; i++) {
      let o = world.owner[i] as number;
      let bio = world.biomass[i] as number;
      if (vision && vision[i] !== 2) {
        // out of sight: show the last-known owner (dimmed), or nothing if it was never seen
        o = vision[i] === 1 ? (player.memOwner[i] as number) : 0;
        bio = 0.5;
      }
      const j = i * 4;
      if (o === 0) {
        data[j] = 0;
        data[j + 1] = 0;
        data[j + 2] = 0;
        data[j + 3] = 0;
        continue;
      }
      const c = colors[o - 1] as [number, number, number];
      data[j] = c[0];
      data[j + 1] = c[1];
      data[j + 2] = (c[2] & 0xf8) | (patterns[o - 1] as number);
      data[j + 3] = Math.max(1, Math.round(bio * 255));
    }
    this.source.update();
  }
}
