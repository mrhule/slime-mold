import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { scanFronts } from '../../../src/sim/combat';
import { solveFlow } from '../../../src/sim/flow';
import { addTarget } from '../../../src/sim/growth';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import { cellOf, createWorldWithMold } from '../../helpers';

/** the most a piece can spend per second: the base cap plus the per-cell share */
function budgetOf(world: ReturnType<typeof createWorldWithMold>['world'], moldId: number): number {
  const comp = [...world.components.values()].find((c) => c.moldId === moldId)!;
  return defaultBalance.spendRateCap + defaultBalance.spendRatePerCell * comp.cells.length;
}

/** an open world with a player mold and a rival whose cell touches the player's east arm */
function contactWorld() {
  const { world, mold } = createWorldWithMold(60, 40, 10, 20, 1000);
  addMold(world, 'rival', cellOf(world, 40, 20), 100);
  addCell(world, 2, cellOf(world, 12, 20), -1);
  world.conductivity.fill(20); // thick veins: no bottleneck, so shares are exact
  scanFronts(world);
  return { world, mold };
}

describe('flow: fronts and the allocation slider (R4)', () => {
  it('splits the budget: tips get (1 - a), fronts get a', () => {
    const { world, mold } = contactWorld();
    const budget = budgetOf(world, mold.id);
    mold.allocation = 0.25;
    addTarget(world, mold.id, cellOf(world, 8, 5));
    solveFlow(world);
    const pressure = mold.frontCells.reduce((s, c) => s + world.pressure[c]!, 0);
    expect(mold.frontCells.length).toBeGreaterThan(0);
    expect(mold.targets[0]!.rate).toBeCloseTo(budget * 0.75, 4);
    expect(pressure).toBeCloseTo(budget * 0.25, 4);
  });

  it('gives the whole budget to the front when there are no tips', () => {
    const { world, mold } = contactWorld();
    mold.allocation = 0;
    solveFlow(world);
    const pressure = mold.frontCells.reduce((s, c) => s + world.pressure[c]!, 0);
    expect(pressure).toBeCloseTo(budgetOf(world, mold.id), 4);
  });

  it('gives the whole budget to growth when there is no front, whatever the slider says', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 1000);
    world.conductivity.fill(20);
    mold.allocation = 1;
    addTarget(world, mold.id, cellOf(world, 30, 20));
    solveFlow(world);
    expect(mold.targets[0]!.rate).toBeCloseTo(budgetOf(world, mold.id), 4);
  });

  it('weights toward front cells with more enemy contact', () => {
    const { world, mold } = contactWorld();
    // a second player cell that touches two enemy cells
    addCell(world, mold.id, cellOf(world, 11, 21), cellOf(world, 11, 20));
    addCell(world, 2, cellOf(world, 12, 22), -1);
    world.conductivity.fill(20);
    scanFronts(world);
    mold.allocation = 1;
    solveFlow(world);
    const cells = mold.frontCells;
    const heavy = cells.reduce((best, c) => (world.enemyAdj[c]! > world.enemyAdj[best]! ? c : best));
    const light = cells.reduce((best, c) => (world.enemyAdj[c]! < world.enemyAdj[best]! ? c : best));
    expect(world.enemyAdj[heavy]!).toBeGreaterThan(world.enemyAdj[light]!);
    expect(world.pressure[heavy]!).toBeGreaterThan(world.pressure[light]!);
  });

  it('is bottlenecked by thin veins: a front behind a thin link gets less than one behind thick ones', () => {
    const { world, mold } = contactWorld();
    mold.allocation = 1;
    world.conductivity.fill(0.2); // thin everywhere
    solveFlow(world);
    const pressure = mold.frontCells.reduce((s, c) => s + world.pressure[c]!, 0);
    expect(pressure).toBeLessThan(budgetOf(world, mold.id) * 0.5);
  });
});
