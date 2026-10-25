import { describe, expect, it } from 'vitest';
import { addCell, decayOrphans, linkCells, relabelComponent, removeCell, removeCellAndSplit, refreshSources } from '../../../src/sim/network';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createWorldWithMold } from '../../helpers';

describe('network', () => {
  it('addCell links both endpoints and joins the piece', () => {
    const { world, mold } = createWorldWithMold();
    const a = cellOf(world, 11, 20);
    const b = cellOf(world, 12, 20);
    addCell(world, mold.id, b, a);
    expect(world.edges[a]! & (1 << 0)).toBeTruthy(); // E
    expect(world.edges[b]! & (1 << 4)).toBeTruthy(); // W
    expect(world.component[b]).toBe(world.component[a]);
    expect(mold.cellCount).toBe(6);
    assertInvariants(world);
  });

  it('merging adds pools and the lower id survives', () => {
    const { world, mold } = createWorldWithMold();
    const far = cellOf(world, 30, 20);
    addCell(world, mold.id, far, -1);
    const farComp = world.components.get(world.component[far]!)!;
    farComp.pool = 5;
    const homeId = world.component[mold.core]!;
    const homePool = world.components.get(homeId)!.pool;
    // bridge the gap cell by cell
    let prev = cellOf(world, 11, 20);
    for (let x = 12; x < 30; x++) {
      const c = cellOf(world, x, 20);
      addCell(world, mold.id, c, prev);
      prev = c;
    }
    linkCells(world, prev, far);
    expect(world.components.size).toBe(1);
    const only = [...world.components.values()][0]!;
    expect(only.id).toBe(Math.min(homeId, farComp.id));
    expect(only.pool).toBeCloseTo(homePool + 5);
    assertInvariants(world);
  });

  it('splitting shares the pool by cell count and conserves it', () => {
    const { world, mold } = createWorldWithMold();
    // a line of 9 cells east of the core blob: core arm is (11,20); extend to x = 19
    let prev = cellOf(world, 11, 20);
    for (let x = 12; x <= 19; x++) {
      const c = cellOf(world, x, 20);
      addCell(world, mold.id, c, prev);
      prev = c;
    }
    const comp = world.components.get(world.component[mold.core]!)!;
    comp.pool = 100;
    const before = comp.cells.length;
    removeCellAndSplit(world, cellOf(world, 15, 20));
    expect(world.components.size).toBe(2);
    const pieces = [...world.components.values()];
    expect(pieces[0]!.pool + pieces[1]!.pool).toBeCloseTo(100);
    const cellsAfterRemoval = before - 1;
    for (const p of pieces) expect(p.pool).toBeCloseTo((100 * p.cells.length) / cellsAfterRemoval, 5);
    assertInvariants(world);
  });

  it('a piece with no core or food is orphaned and withers', () => {
    const { world, mold } = createWorldWithMold();
    let prev = cellOf(world, 11, 20);
    for (let x = 12; x <= 16; x++) {
      const c = cellOf(world, x, 20);
      addCell(world, mold.id, c, prev);
      prev = c;
    }
    removeCellAndSplit(world, cellOf(world, 13, 20));
    const orphan = [...world.components.values()].find((c) => !c.cells.includes(mold.core))!;
    refreshSources(world, orphan);
    expect(orphan.orphaned).toBe(true);
    const sample = orphan.cells[0]!;
    const bio0 = world.biomass[sample]!;
    decayOrphans(world);
    expect(world.biomass[sample]!).toBeLessThan(bio0);
    for (let i = 0; i < 100; i++) decayOrphans(world);
    expect(world.owner[sample]).toBe(0);
    assertInvariants(world);
  });

  it('removeCell unlinks edges and updates counts', () => {
    const { world, mold } = createWorldWithMold();
    const c = cellOf(world, 11, 20);
    removeCell(world, c);
    expect(world.owner[c]).toBe(0);
    expect(world.edges[mold.core]! & (1 << 0)).toBe(0);
    expect(mold.cellCount).toBe(4);
    relabelComponent(world, world.component[mold.core]!);
    assertInvariants(world);
  });
});
