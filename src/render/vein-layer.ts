import { Buffer, BufferUsage, Container, Geometry, Mesh, Shader } from 'pixi.js';
import { hash2 } from '../sim/noise';
import { neighbor } from '../sim/grid';
import type { World } from '../sim/types';
import { INK_RGB, moldColor, rgbUnit } from './palette';
import { CELL } from './units';
import vertex from './shaders/vein.vert?raw';
import fragment from './shaders/vein.frag?raw';

const FLOATS = 6; // x, y, u, v, flow, kind
const OUTLINE_PAD = 1.7;

interface MoldMesh {
  mesh: Mesh<Geometry, Shader> | null;
  uniforms: { uTime: number };
  shader: Shader;
}

/**
 * Each mold's vein network as one mesh: a near-black ink outline pass followed by the flat
 * colored core (so cores of neighboring edges cover each other's outlines). Width follows the
 * edge conductivity; geometry is rebuilt at the flow cadence only.
 */
export class VeinLayer {
  readonly container = new Container();
  private readonly molds = new Map<number, MoldMesh>();
  private lastBuild = -1;
  private halfWidth: Float32Array;
  private jitterX: Float32Array;
  private jitterY: Float32Array;

  constructor(world: Readonly<World>) {
    const n = world.width * world.height;
    this.halfWidth = new Float32Array(n);
    this.jitterX = new Float32Array(n);
    this.jitterY = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.jitterX[i] = (hash2(i, 11, world.seed) - 0.5) * 2.2;
      this.jitterY[i] = (hash2(i, 12, world.seed) - 0.5) * 2.2;
    }
  }

  update(world: Readonly<World>, timeSeconds: number): void {
    for (const m of this.molds.values()) m.uniforms.uTime = timeSeconds;
    const buildIndex = Math.floor(world.tick / world.balance.flowEvery);
    if (buildIndex === this.lastBuild) return;
    this.lastBuild = buildIndex;
    for (const mold of world.molds) this.rebuild(world, mold.id, mold.color);
  }

  private moldMesh(moldId: number, colorIndex: number): MoldMesh {
    let m = this.molds.get(moldId);
    if (!m) {
      const shader = Shader.from({
        gl: { vertex, fragment },
        resources: {
          veinUniforms: {
            uMold: { value: rgbUnit(moldColor(colorIndex)), type: 'vec3<f32>' },
            uInk: { value: INK_RGB, type: 'vec3<f32>' },
            uTime: { value: 0, type: 'f32' },
          },
        },
      });
      m = { mesh: null, shader, uniforms: shader.resources.veinUniforms.uniforms as { uTime: number } };
      this.molds.set(moldId, m);
    }
    return m;
  }

  private rebuild(world: Readonly<World>, moldId: number, colorIndex: number): void {
    const w = world.width;
    const h = world.height;
    const cells: number[] = [];
    for (const comp of world.components.values()) if (comp.moldId === moldId) for (const c of comp.cells) cells.push(c);
    const entry = this.moldMesh(moldId, colorIndex);
    if (cells.length === 0) {
      if (entry.mesh) entry.mesh.visible = false;
      return;
    }

    // node radii: the widest incident edge
    const hw = this.halfWidth;
    for (const c of cells) hw[c] = 0;
    const edgeList: { a: number; b: number; half: number; flow: number }[] = [];
    for (const c of cells) {
      const bits = world.edges[c] as number;
      for (let k = 0; k < 4; k++) {
        if (!(bits & (1 << k))) continue;
        const v = neighbor(w, h, c, k);
        const slot = c * 4 + k;
        const half = Math.min(3.6, 0.8 + 0.8 * Math.sqrt(world.conductivity[slot] as number));
        edgeList.push({ a: c, b: v, half, flow: world.edgeFlow[slot] as number });
        if (half > (hw[c] as number)) hw[c] = half;
        if (half > (hw[v] as number)) hw[v] = half;
      }
    }
    for (const c of cells) if ((hw[c] as number) === 0) hw[c] = 1.6;

    const nodeVerts = 9; // centre + 8 around
    const verts = new Float32Array((edgeList.length * 4 + cells.length * nodeVerts) * 2 * FLOATS);
    const idx = new Uint32Array((edgeList.length * 6 + cells.length * 24) * 2);
    let vo = 0;
    let io = 0;
    let vcount = 0;
    const cx = (c: number): number => (c % w) * CELL + CELL / 2 + (this.jitterX[c] as number);
    const cy = (c: number): number => Math.floor(c / w) * CELL + CELL / 2 + (this.jitterY[c] as number);
    const push = (x: number, y: number, u: number, v: number, flow: number, kind: number): void => {
      verts[vo++] = x;
      verts[vo++] = y;
      verts[vo++] = u;
      verts[vo++] = v;
      verts[vo++] = flow;
      verts[vo++] = kind;
      vcount++;
    };

    for (const kind of [0, 1]) {
      const pad = kind === 0 ? OUTLINE_PAD : 0;
      for (const e of edgeList) {
        const x1 = cx(e.a);
        const y1 = cy(e.a);
        const x2 = cx(e.b);
        const y2 = cy(e.b);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = (-dy / len) * (e.half + pad);
        const ny = (dx / len) * (e.half + pad);
        const lenCells = len / CELL;
        const base = vcount;
        push(x1 + nx, y1 + ny, -1, 0, e.flow, kind);
        push(x1 - nx, y1 - ny, 1, 0, e.flow, kind);
        push(x2 + nx, y2 + ny, -1, lenCells, e.flow, kind);
        push(x2 - nx, y2 - ny, 1, lenCells, e.flow, kind);
        idx[io++] = base;
        idx[io++] = base + 1;
        idx[io++] = base + 2;
        idx[io++] = base + 1;
        idx[io++] = base + 3;
        idx[io++] = base + 2;
      }
      // round joints
      for (const c of cells) {
        const r = (hw[c] as number) + pad;
        const x = cx(c);
        const y = cy(c);
        const base = vcount;
        push(x, y, 0, 0, 0, kind);
        for (let s = 0; s < 8; s++) {
          const ang = (s / 8) * Math.PI * 2;
          const ux = Math.cos(ang);
          const uy = Math.sin(ang);
          push(x + ux * r, y + uy * r, ux, 0, 0, kind);
        }
        for (let s = 0; s < 8; s++) {
          idx[io++] = base;
          idx[io++] = base + 1 + s;
          idx[io++] = base + 1 + ((s + 1) % 8);
        }
      }
    }

    const buffer = new Buffer({ data: verts, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    const stride = FLOATS * 4;
    const geometry = new Geometry({
      attributes: {
        aPosition: { buffer, format: 'float32x2', stride, offset: 0 },
        aUV: { buffer, format: 'float32x2', stride, offset: 8 },
        aStyle: { buffer, format: 'float32x2', stride, offset: 16 },
      },
      indexBuffer: idx,
    });
    if (entry.mesh) {
      const old = entry.mesh.geometry;
      entry.mesh.geometry = geometry;
      entry.mesh.visible = true;
      old.destroy(true);
    } else {
      entry.mesh = new Mesh<Geometry, Shader>({ geometry, shader: entry.shader });
      this.container.addChild(entry.mesh);
    }
  }
}
