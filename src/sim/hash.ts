import type { World } from './types';

/** FNV-1a over raw bytes / numbers. Used for replay and determinism checks (R11). */
export class Hasher {
  h = 0x811c9dc5;
  private scratch = new DataView(new ArrayBuffer(8));

  bytes(u8: Uint8Array): void {
    let h = this.h;
    for (let i = 0; i < u8.length; i++) {
      h ^= u8[i] as number;
      h = Math.imul(h, 0x01000193);
    }
    this.h = h;
  }

  array(a: ArrayBufferView): void {
    this.bytes(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
  }

  num(n: number): void {
    this.scratch.setFloat64(0, n);
    this.bytes(new Uint8Array(this.scratch.buffer));
  }

  result(): number {
    return this.h >>> 0;
  }
}

/** Hash of the entire simulation state (excluding the per-tick `events` feed). */
export function stateHash(world: World): number {
  const h = new Hasher();
  h.num(world.tick);
  h.array(world.terrain);
  h.array(world.owner);
  h.array(world.biomass);
  h.array(world.edges);
  h.array(world.conductivity);
  h.array(world.component);
  h.array(world.food);
  h.array(world.buildingAt);
  for (const m of world.molds) {
    h.num(m.id);
    h.num(m.allocation);
    h.num(m.cellCount);
    h.num(m.core);
    h.num(m.status === 'alive' ? 1 : 0);
    for (const t of m.targets) {
      h.num(t.id);
      h.num(t.cell);
      h.num(t.pos);
      h.num(t.progress);
      h.num(t.rate);
      h.num(t.starvedFor);
    }
  }
  for (const c of world.components.values()) {
    h.num(c.id);
    h.num(c.pool);
    h.num(c.cells.length);
    h.num(c.starveCell);
  }
  for (const b of world.buildings) {
    h.num(b.id);
    h.num(b.moldId);
    h.num(b.cell);
    h.num(b.target);
    h.num(b.destroyed ? 1 : 0);
  }
  h.num(world.nextDropTick);
  for (const d of world.drops) {
    h.num(d.id);
    h.num(d.cell);
    h.num(d.landTick);
    h.num(d.state === 'landed' ? 2 : d.state === 'warning' ? 1 : 0);
  }
  for (const f of world.foodSources) {
    h.num(f.remaining);
    h.num(f.depleted ? 1 : 0);
  }
  for (const s of world.rng.states()) h.num(s);
  return h.result();
}
