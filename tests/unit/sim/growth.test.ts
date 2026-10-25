import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { addTarget, findPath, planTarget, snapTarget } from '../../../src/sim/growth';
import { applyCommand } from '../../../src/sim/commands';
import { Terrain } from '../../../src/sim/types';
import { step } from '../../../src/sim/step';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createWorldWithMold } from '../../helpers';

describe('target snapping', () => {
  it('snaps an obstacle target to the nearest open cell within 6 cells', () => {
    const { world } = createWorldWithMold();
    const t = cellOf(world, 30, 20);
    world.terrain[t] = Terrain.Obstacle;
    const snapped = snapTarget(world, t);
    expect(snapped).not.toBe(t);
    expect(Math.abs((snapped % world.width) - 30) + Math.abs(Math.floor(snapped / world.width) - 20)).toBeLessThanOrEqual(2);
  });

  it('rejects when nothing open is within the snap radius', () => {
    const { world, mold } = createWorldWithMold();
    const cx = 40;
    const cy = 20;
    for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) world.terrain[cellOf(world, x, y)] = Terrain.Obstacle;
    const res = planTarget(world, mold.id, cellOf(world, cx, cy));
    expect(res).toEqual({ ok: false, reason: 'no-open-cell-nearby' });
  });

  it('rejects out of bounds and already-owned targets', () => {
    const { world, mold } = createWorldWithMold();
    expect(planTarget(world, mold.id, -1)).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(planTarget(world, mold.id, mold.core)).toEqual({ ok: false, reason: 'already-owned' });
  });
});

describe('pathfinding', () => {
  it('routes around obstacles and never enters terrain 2 or 3', () => {
    const { world, mold } = createWorldWithMold();
    for (let y = 10; y < 30; y++) world.terrain[cellOf(world, 25, y)] = Terrain.Obstacle;
    const target = cellOf(world, 35, 20);
    const path = findPath(world, mold.id, target)!;
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toBe(target);
    for (const c of path) expect(world.terrain[c]).toBeLessThan(Terrain.Obstacle);
    expect(path.length).toBeGreaterThan(25); // had to go around the wall
  });

  it('does not cut corners between diagonal obstacles', () => {
    const { world, mold } = createWorldWithMold(30, 20, 5, 10);
    // a diagonal wall of obstacles with no orthogonal gap
    for (let i = 0; i < 20; i++) {
      world.terrain[cellOf(world, 14 + i * 0, 1 + i)] = Terrain.Obstacle;
    }
    for (let i = 1; i < 19; i++) world.terrain[cellOf(world, 15, i)] = Terrain.Obstacle;
    world.terrain[cellOf(world, 14, 9)] = Terrain.Open;
    const path = findPath(world, mold.id, cellOf(world, 25, 10));
    if (path) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!;
        const b = path[i]!;
        const dx = (b % world.width) - (a % world.width);
        const dy = Math.floor(b / world.width) - Math.floor(a / world.width);
        if (dx !== 0 && dy !== 0) {
          expect(world.terrain[a + dx]).toBeLessThan(Terrain.Obstacle);
          expect(world.terrain[a + dy * world.width]).toBeLessThan(Terrain.Obstacle);
        }
      }
    }
  });

  it('prefers open ground over rough ground', () => {
    const { world, mold } = createWorldWithMold();
    for (let y = 18; y <= 22; y++) for (let x = 15; x <= 25; x++) world.terrain[cellOf(world, x, y)] = Terrain.Rough;
    const path = findPath(world, mold.id, cellOf(world, 30, 20))!;
    const roughSteps = path.filter((c) => world.terrain[c] === Terrain.Rough).length;
    expect(roughSteps).toBeLessThan(6); // detours around the patch instead of crossing 10 rough cells
  });
});

describe('targets', () => {
  it('the 4th target replaces the oldest', () => {
    const { world, mold } = createWorldWithMold();
    const ids: number[] = [];
    for (let i = 0; i < 4; i++) {
      step(world);
      const res = addTarget(world, mold.id, cellOf(world, 30, 10 + i * 4));
      expect(res.ok).toBe(true);
      ids.push(mold.targets[mold.targets.length - 1]!.id);
    }
    expect(mold.targets).toHaveLength(3);
    expect(mold.targets.map((t) => t.id)).not.toContain(ids[0]);
    expect(mold.targets.map((t) => t.id)).toContain(ids[3]);
  });

  it('a funded tip extends one cell per build cost', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 100);
    addTarget(world, mold.id, cellOf(world, 25, 20));
    const before = mold.cellCount;
    for (let i = 0; i < 200; i++) step(world);
    expect(mold.cellCount).toBeGreaterThan(before + 5);
    assertInvariants(world);
  });

  it('goes starved after 1 s without nutrients', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 0);
    world.balance = { ...world.balance, coreIncome: 0, upkeepPerCell: 0 };
    addTarget(world, mold.id, cellOf(world, 30, 20));
    for (let i = 0; i < 40; i++) step(world);
    expect(mold.targets[0]!.state).toBe('starved');
  });

  it('is starved while growth can only run on trickle income', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 0);
    addTarget(world, mold.id, cellOf(world, 40, 20));
    for (let i = 0; i < 60; i++) step(world);
    expect(mold.targets[0]!.state).toBe('starved');
    expect(mold.cellCount).toBeGreaterThan(5); // still creeping forward on income
  });

  it('is not starved while the stock can fund growth', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 500);
    addTarget(world, mold.id, cellOf(world, 40, 20));
    for (let i = 0; i < 60; i++) step(world);
    expect(mold.targets[0]!.state).toBe('growing');
  });

  it('arrival removes the target; built veins remain', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 200);
    addTarget(world, mold.id, cellOf(world, 18, 20));
    for (let i = 0; i < 400 && mold.targets.length; i++) step(world);
    expect(mold.targets).toHaveLength(0);
    expect(world.owner[cellOf(world, 18, 20)]).toBe(mold.id);
  });

  it('cancelTarget and clearTargets keep built veins', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 200);
    addTarget(world, mold.id, cellOf(world, 40, 20));
    for (let i = 0; i < 60; i++) step(world);
    const cells = mold.cellCount;
    expect(cells).toBeGreaterThan(5);
    applyCommand(world, { type: 'cancelTarget', mold: mold.id, targetId: mold.targets[0]!.id });
    expect(mold.targets).toHaveLength(0);
    expect(mold.cellCount).toBe(cells);
    addTarget(world, mold.id, cellOf(world, 40, 25));
    applyCommand(world, { type: 'clearTargets', mold: mold.id });
    expect(mold.targets).toHaveLength(0);
  });

  it('rejects unknown targets and commands for unknown molds', () => {
    const { world, mold } = createWorldWithMold();
    applyCommand(world, { type: 'cancelTarget', mold: mold.id, targetId: 999 });
    expect(world.events).toContainEqual({ type: 'commandRejected', mold: mold.id, reason: 'unknown-target' });
  });
});

describe('store house boost on growth (003 FR-020, FR-023, S8)', () => {
  /** one tick of a lone tip, with the supply multiplier set on every cell */
  function tipAfterOneTick(supply: number) {
    const { world, mold } = createWorldWithMold(80, 30, 10, 15, 100, { ...defaultBalance, coreIncome: 0, upkeepPerCell: 0 });
    world.supply.fill(supply);
    applyCommand(world, { type: 'setTarget', mold: mold.id, cell: cellOf(world, 60, 15) });
    const comp = world.components.get(world.component[mold.core] as number)!;
    const before = comp.pool;
    step(world);
    const tip = mold.targets[0]!;
    return { world, tip, spent: before - comp.pool };
  }

  it('turns each granted nutrient into more progress, and still pays the grant from the pool', () => {
    const plain = tipAfterOneTick(1);
    const boosted = tipAfterOneTick(1.5);
    expect(plain.tip.progress).toBeGreaterThan(0);
    expect(plain.tip.progress).toBeLessThan(1); // no cell finished yet, so the ratio is clean
    expect(boosted.tip.progress).toBeCloseTo(plain.tip.progress * 1.5, 6);
    expect(boosted.spent).toBeCloseTo(plain.spent, 9);
  });

  it('marks the piece as having used the boost, so its store house drains', () => {
    const boosted = tipAfterOneTick(1.5);
    expect(boosted.world.supplyUse.size).toBe(1);
    const plain = tipAfterOneTick(1);
    expect(plain.world.supplyUse.size).toBe(0);
  });

  it('does not touch combat strength or farm income', () => {
    const { world } = tipAfterOneTick(1.5);
    expect(world.boost.every((v) => v === 1)).toBe(true);
    expect(world.molds[0]!.incomeTick).toBeGreaterThanOrEqual(0);
  });
});
