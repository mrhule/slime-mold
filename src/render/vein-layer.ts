import { AlphaFilter, Buffer, BufferUsage, Container, Geometry, Mesh, Shader } from 'pixi.js';
import { hash2 } from '../sim/noise';
import { neighbor } from '../sim/grid';
import type { World } from '../sim/types';
import { INK_RGB, moldColor, moldPattern, rgbUnit } from './palette';
import { jointU, litSide, pulseCount, style, veinHalfWidth } from './style';
import type { QualityLevel } from './style';
import { CELL } from './units';
import vertex from './shaders/vein.vert?raw';
import fragment from './shaders/vein.frag?raw';
import shadowFragment from './shaders/vein-shadow.frag?raw';

const FLOATS = 8; // x, y, u, v, signed pulse count, kind, pulse phase, feed

interface MoldMesh {
  mesh: Mesh<Geometry, Shader> | null;
  /** the flat shadow under this mold's veins (A12); lives in the shared, alpha-filtered shadow group */
  shadowMesh: Mesh<Geometry, Shader> | null;
  uniforms: { uTime: number; uPulses: number };
  shader: Shader;
  shadowShader: Shader;
}

/**
 * Each mold's vein network as one mesh: a near-black ink outline pass followed by the flat
 * colored core (so cores of neighboring edges cover each other's outlines). Width snaps to three
 * bands by edge conductivity; the outline is thinner on the lit side and heavier on the shadow side
 * (A12). Under all the veins sits one flat shadow group, offset toward the lower right and drawn
 * opaque into a shared texture that is blended once at `veinAlpha`, so overlapping edges do not
 * darken twice. Geometry is rebuilt at the flow cadence only.
 */
export class VeinLayer {
  readonly container = new Container();
  private readonly shadows = new Container();
  private readonly meshes = new Container();
  private quality: QualityLevel = 'high';
  private readonly molds = new Map<number, MoldMesh>();
  private lastBuild = -1;
  private halfWidth: Float32Array;
  private jitterX: Float32Array;
  private jitterY: Float32Array;

  constructor(world: Readonly<World>) {
    const n = world.width * world.height;
    this.shadows.filters = [new AlphaFilter({ alpha: style.shadow.veinAlpha })];
    this.container.addChild(this.shadows, this.meshes);
    this.halfWidth = new Float32Array(n);
    this.jitterX = new Float32Array(n);
    this.jitterY = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.jitterX[i] = (hash2(i, 11, world.seed) - 0.5) * 2.2;
      this.jitterY[i] = (hash2(i, 12, world.seed) - 0.5) * 2.2;
    }
  }

  update(world: Readonly<World>, timeSeconds: number, quality: QualityLevel = 'high'): void {
    this.quality = quality;
    this.shadows.visible = style.quality[quality].veinShadow;
    for (const m of this.molds.values()) {
      m.uniforms.uTime = timeSeconds;
      m.uniforms.uPulses = style.quality[quality].pulses ? 1 : 0;
    }
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
            uPattern: { value: moldPattern(colorIndex), type: 'f32' },
            uPulses: { value: 1, type: 'f32' },
            uPulseSpeed: { value: style.pulse.speed, type: 'f32' },
          },
        },
      });
      const shadowShader = Shader.from({ gl: { vertex, fragment: shadowFragment }, resources: { shadowUniforms: { uInk: { value: INK_RGB, type: 'vec3<f32>' } } } });
      m = { mesh: null, shadowMesh: null, shader, shadowShader, uniforms: shader.resources.veinUniforms.uniforms as { uTime: number; uPulses: number } };
      this.molds.set(moldId, m);
    }
    return m;
  }

  private rebuild(world: Readonly<World>, moldId: number, colorIndex: number): void {
    const w = world.width;
    const h = world.height;
    // rivals' veins are drawn only where the player can currently see them
    const vision = moldId === 1 ? null : (world.molds[0]?.vision ?? null);
    const visible = (c: number): boolean => vision === null || vision[c] === 2;
    const cells: number[] = [];
    for (const comp of world.components.values()) if (comp.moldId === moldId) for (const c of comp.cells) if (visible(c)) cells.push(c);
    const entry = this.moldMesh(moldId, colorIndex);
    if (cells.length === 0) {
      if (entry.mesh) entry.mesh.visible = false;
      if (entry.shadowMesh) entry.shadowMesh.visible = false;
      return;
    }

    // node radii: the widest incident edge
    const hw = this.halfWidth;
    for (const c of cells) hw[c] = 0;
    const edgeList: { a: number; b: number; half: number; flow: number; phase: number }[] = [];
    for (const c of cells) {
      const bits = world.edges[c] as number;
      for (let k = 0; k < 4; k++) {
        if (!(bits & (1 << k))) continue;
        const v = neighbor(w, h, c, k);
        if (!visible(v)) continue;
        const slot = c * 4 + k;
        // width follows conductivity, which follows traffic: thick arteries, hair-thin idle tendrils
        const half = veinHalfWidth(world.conductivity[slot] as number);
        const flow = world.edgeFlow[slot] as number;
        // the flow attribute carries the pulse count, signed by direction
        edgeList.push({ a: c, b: v, half, flow: Math.sign(flow) * pulseCount(Math.abs(flow)), phase: hash2(c, v, world.seed) });
        if (half > (hw[c] as number)) hw[c] = half;
        if (half > (hw[v] as number)) hw[v] = half;
      }
    }
    for (const c of cells) if ((hw[c] as number) === 0) hw[c] = 1.6;

    // how well fed each cell is, 0 (far from supply) to 1 (at it): thin and dull veins read as starved
    const { floor } = world.balance.feed;
    // a cell that is fading away (biomass falling) looks as starved as one far from supply
    const fedAt = (c: number): number => Math.min(world.biomass[c] as number, Math.min(1, Math.max(0, ((world.feed[c] as number) - floor) / (1 - floor || 1))));
    const slim = (c: number): number => 0.55 + 0.45 * fedAt(c);

    const nodeVerts = 9; // centre + 8 around
    const cx = (c: number): number => (c % w) * CELL + CELL / 2 + (this.jitterX[c] as number);
    const cy = (c: number): number => Math.floor(c / w) * CELL + CELL / 2 + (this.jitterY[c] as number);

    /**
     * One geometry for the given passes (0 = ink outline, 1 = colored core). `shift` moves
     * everything (the shadow copy); `padded` makes the outline thinner on the lit side and
     * heavier on the shadow side instead of a constant pad.
     */
    const build = (kinds: number[], shiftX: number, shiftY: number): Geometry => {
      const verts = new Float32Array((edgeList.length * 4 + cells.length * nodeVerts) * kinds.length * FLOATS);
      const idx = new Uint32Array((edgeList.length * 6 + cells.length * 24) * kinds.length);
      let vo = 0;
      let io = 0;
      let vcount = 0;
      const push = (x: number, y: number, u: number, v: number, flow: number, kind: number, phase = 0, fed = 1): void => {
        verts[vo++] = x + shiftX;
        verts[vo++] = y + shiftY;
        verts[vo++] = u;
        verts[vo++] = v;
        verts[vo++] = flow;
        verts[vo++] = kind;
        verts[vo++] = phase;
        verts[vo++] = fed;
        vcount++;
      };
      for (const kind of kinds) {
        const outline = kind === 0;
        for (const e of edgeList) {
          const x1 = cx(e.a);
          const y1 = cy(e.a);
          const x2 = cx(e.b);
          const y2 = cy(e.b);
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = -dy / len;
          const uy = dx / len;
          const lenCells = len / CELL;
          // the lit stripe sits on the u < 0 side, so flip u on edges whose +normal faces away from the light (A8)
          const s = litSide(ux, uy);
          // the outline is lighter on the lit side and heavier on the shadow side (A12); +normal is the lit side when s = 1
          const padPlus = outline ? (s === 1 ? style.outline.padLit : style.outline.padShade) : 0;
          const padMinus = outline ? (s === 1 ? style.outline.padShade : style.outline.padLit) : 0;
          // each end of the edge is as thick as its own cell's feed allows, so a vein tapers as it leaves supply
          const h1 = e.half * slim(e.a);
          const h2 = e.half * slim(e.b);
          const f1 = fedAt(e.a);
          const f2 = fedAt(e.b);
          const base = vcount;
          push(x1 + ux * (h1 + padPlus), y1 + uy * (h1 + padPlus), -s, 0, e.flow, kind, e.phase, f1);
          push(x1 - ux * (h1 + padMinus), y1 - uy * (h1 + padMinus), s, 0, e.flow, kind, e.phase, f1);
          push(x2 + ux * (h2 + padPlus), y2 + uy * (h2 + padPlus), -s, lenCells, e.flow, kind, e.phase, f2);
          push(x2 - ux * (h2 + padMinus), y2 - uy * (h2 + padMinus), s, lenCells, e.flow, kind, e.phase, f2);
          idx[io++] = base;
          idx[io++] = base + 1;
          idx[io++] = base + 2;
          idx[io++] = base + 1;
          idx[io++] = base + 3;
          idx[io++] = base + 2;
        }
        // round joints
        for (const c of cells) {
          const x = cx(c);
          const y = cy(c);
          const base = vcount;
          const fed = fedAt(c);
          push(x, y, 0, 0, 0, kind, 0, fed);
          for (let s = 0; s < 8; s++) {
            const ang = (s / 8) * Math.PI * 2;
            const ux = Math.cos(ang);
            const uy = Math.sin(ang);
            const u = jointU(ux, uy);
            const pad = outline ? style.outline.padLit + ((u + 1) / 2) * (style.outline.padShade - style.outline.padLit) : 0;
            const r = (hw[c] as number) * slim(c) + pad;
            push(x + ux * r, y + uy * r, u, 0, 0, kind, 0, fed);
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
      return new Geometry({
        attributes: {
          aPosition: { buffer, format: 'float32x2', stride, offset: 0 },
          aUV: { buffer, format: 'float32x2', stride, offset: 8 },
          aStyle: { buffer, format: 'float32x3', stride, offset: 16 },
          aFeed: { buffer, format: 'float32', stride, offset: 28 },
        },
        indexBuffer: idx,
      });
    };

    const place = (current: Mesh<Geometry, Shader> | null, geometry: Geometry, shader: Shader, parent: Container): Mesh<Geometry, Shader> => {
      if (current) {
        const old = current.geometry;
        current.geometry = geometry;
        current.visible = true;
        old.destroy(true);
        return current;
      }
      const mesh = new Mesh<Geometry, Shader>({ geometry, shader });
      parent.addChild(mesh);
      return mesh;
    };

    entry.mesh = place(entry.mesh, build([0, 1], 0, 0), entry.shader, this.meshes);
    if (style.quality[this.quality].veinShadow) {
      // the same silhouette without the outline padding, moved toward the lower right (the one light)
      entry.shadowMesh = place(entry.shadowMesh, build([1], style.shadow.veinOffset[0], style.shadow.veinOffset[1]), entry.shadowShader, this.shadows);
    } else if (entry.shadowMesh) {
      entry.shadowMesh.visible = false;
    }
  }
}
