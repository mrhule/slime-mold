import { BufferImageSource, Container, Mesh, MeshGeometry, Shader, Texture } from 'pixi.js';
import type { World } from '../sim/types';
import { INK_RGB } from './palette';
import { CELL } from './units';
import vertex from './shaders/world.vert?raw';
import fragment from './shaders/fog.frag?raw';

/**
 * Fog of war over the map (FR-028, FR-032): the player's vision grid goes into a texture and an
 * ink shader scribbles over what has never been seen and dots what is only remembered, with a
 * hand-drawn boundary. Terrain stays readable through the scribble; only food and rivals are
 * hidden, and those layers hide themselves using the same vision grid.
 */
export class FogLayer {
  readonly container = new Container();
  private readonly data: Uint8Array;
  private readonly source: BufferImageSource;
  private readonly uniforms: { uTime: number };
  private lastBuild = -1;

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
        uVision: texture.source,
        fogUniforms: {
          uGrid: { value: [w, h], type: 'vec2<f32>' },
          uTime: { value: 0, type: 'f32' },
          uInk: { value: INK_RGB, type: 'vec3<f32>' },
        },
      },
    });
    this.uniforms = shader.resources.fogUniforms.uniforms as { uTime: number };
    this.container.addChild(new Mesh({ geometry, shader }));
  }

  update(world: Readonly<World>, timeSeconds: number): void {
    this.uniforms.uTime = timeSeconds;
    const player = world.molds[0];
    if (!player) return;
    // vision only changes at the fog cadence, so only re-upload then
    const build = Math.floor(world.tick / world.balance.fogEvery);
    if (build === this.lastBuild) return;
    this.lastBuild = build;
    const v = player.vision;
    const d = this.data;
    for (let i = 0; i < v.length; i++) {
      const s = v[i] as number;
      d[i * 4] = s === 2 ? 255 : s === 1 ? 128 : 0;
    }
    this.source.update();
  }
}
