import { describe, expect, it } from 'vitest';
import { defaultBalance } from '../../../src/config/balance';
import { applyCommand } from '../../../src/sim/commands';
import { demolishBuilding, placeBuilding, recomputeFeed, recomputeSupply, storeCover, upgradeBuilding } from '../../../src/sim/buildings';
import { fadeStrays } from '../../../src/sim/fade';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import type { Component } from '../../../src/sim/types';
import { assertInvariants } from '../../../src/sim/world';
import { cellOf, createOpenWorld } from '../../helpers';

const spec = defaultBalance.buildings.storehouse;
const { coreReach, graceSeconds, fadeSeconds } = defaultBalance.feed;
const quiet = { ...defaultBalance, coreIncome: 0, upkeepPerCell: 0 };

/** a vein east from the core along y = 15, long enough to run past the core's reach */
function longVein(len = 70) {
  const world = createOpenWorld(110, 30, quiet);
  const mold = addMold(world, 'player', cellOf(world, 5, 15), 400);
  const cells: number[] = [];
  let prev = mold.core;
  for (let x = 6; x < 6 + len; x++) {
    const c = cellOf(world, x, 15);
    if (world.owner[c] !== mold.id) addCell(world, mold.id, c, prev);
    cells.push(c);
    prev = c;
  }
  const comp = world.components.get(world.component[mold.core] as number) as Component;
  comp.pool = 400;
  return { world, mold, comp, cells };
}

/** run the flow-cadence recompute and the fade as the sim does, for this many game seconds */
function age(world: ReturnType<typeof longVein>['world'], seconds: number): void {
  const every = world.balance.flowEvery * 0.05;
  for (let t = 0; t < seconds; t += every) {
    recomputeSupply(world);
    recomputeFeed(world);
    fadeStrays(world);
  }
}

describe('factory upgrades', () => {
  it('each level pays from the piece, adds reach and widens the cover', () => {
    const { world, mold, comp, cells } = longVein();
    const at = cells[10] as number;
    expect(placeBuilding(world, mold.id, 'storehouse', at)).toEqual({ ok: true });
    comp.pool = 200;
    const before = storeCover(world, at).length;
    expect(upgradeBuilding(world, mold.id, at)).toEqual({ ok: true });
    expect(world.buildings[0]!.level).toBe(2);
    expect(comp.pool).toBeCloseTo(200 - (spec.upgradeCost[0] as number), 6);
    expect(storeCover(world, at).length).toBeGreaterThan(before);
    expect(upgradeBuilding(world, mold.id, at)).toEqual({ ok: true });
    expect(upgradeBuilding(world, mold.id, at)).toEqual({ ok: false, reason: 'max-level' });
  });

  it('refuses when it cannot pay, for another mold, or for other buildings', () => {
    const { world, mold, comp, cells } = longVein();
    const at = cells[10] as number;
    placeBuilding(world, mold.id, 'storehouse', at);
    comp.pool = 1;
    expect(upgradeBuilding(world, mold.id, at)).toEqual({ ok: false, reason: 'cant-afford' });
    expect(upgradeBuilding(world, 2, at)).toEqual({ ok: false, reason: 'not-your-cell' });
    expect(upgradeBuilding(world, mold.id, cells[20] as number)).toEqual({ ok: false, reason: 'no-building' });
    comp.pool = 200;
    placeBuilding(world, mold.id, 'booster', cells[30] as number);
    expect(upgradeBuilding(world, mold.id, cells[30] as number)).toEqual({ ok: false, reason: 'not-upgradable' });
  });

  it('is a command, so the replay records it', () => {
    const { world, mold, comp, cells } = longVein();
    const at = cells[10] as number;
    placeBuilding(world, mold.id, 'storehouse', at);
    comp.pool = 200;
    applyCommand(world, { type: 'upgradeBuilding', mold: mold.id, cell: at });
    expect(world.buildings[0]!.level).toBe(2);
    expect(world.events.some((e) => e.type === 'buildingUpgraded')).toBe(true);
  });
});

describe('veins out of every reach fade and die', () => {
  it('cells past the core\'s reach are left alone for the grace period, then lose biomass and die', () => {
    const { world, mold, cells } = longVein(70);
    const near = cells[10] as number;
    const far = cells[60] as number;
    age(world, graceSeconds - 2);
    expect(world.biomass[far]).toBe(1); // still time to build a factory
    age(world, 2 + fadeSeconds * 0.5);
    expect(world.biomass[near]).toBe(1);
    expect(world.biomass[far]!).toBeLessThan(1);
    expect(world.biomass[far]!).toBeGreaterThan(0);
    age(world, fadeSeconds * 1.5);
    expect(world.owner[far]).toBe(0);
    expect(world.owner[near]).toBe(mold.id);
    expect(world.owner[cells[coreReach - 5] as number]).toBe(mold.id);
    assertInvariants(world);
  });

  it('a working factory keeps its stretch of vein alive', () => {
    const { world, mold, comp, cells } = longVein(70);
    const far = cells[60] as number;
    placeBuilding(world, mold.id, 'storehouse', cells[58] as number);
    comp.pool = 300;
    age(world, graceSeconds + fadeSeconds * 2);
    expect(world.owner[far]).toBe(mold.id);
    expect(world.biomass[far]).toBe(1);
  });

  it('spares the head of a growing tip, and the core', () => {
    const { world, mold, cells } = longVein(70);
    const tipHead = cells[69] as number;
    mold.targets.push({ id: 99, cell: tipHead, path: [tipHead], pos: 0, progress: 0, rate: 0, state: 'growing', starvedFor: 0 } as never);
    age(world, graceSeconds + fadeSeconds * 2);
    expect(world.owner[tipHead]).toBe(mold.id);
    expect(world.owner[mold.core]).toBe(mold.id);
  });
});

describe('building a factory in time saves a stretch of vein', () => {
  it('the clock resets once the vein is back in reach', () => {
    const { world, mold, comp, cells } = longVein(70);
    const far = cells[60] as number;
    age(world, graceSeconds + 5);
    expect(world.strayFor[far]!).toBeGreaterThan(graceSeconds);
    placeBuilding(world, mold.id, 'storehouse', cells[58] as number);
    comp.pool = 300;
    age(world, fadeSeconds);
    expect(world.strayFor[far]).toBe(0);
    expect(world.biomass[far]!).toBeGreaterThan(0.5); // hurt a little, but saved
    expect(world.owner[far]).toBe(mold.id);
  });
});

describe('demolishing a building', () => {
  it('removes it, keeps the cell and its veins, and pays half back (upgrades included)', () => {
    const { world, mold, comp, cells } = longVein();
    const at = cells[10] as number;
    placeBuilding(world, mold.id, 'storehouse', at);
    comp.pool = 200;
    upgradeBuilding(world, mold.id, at);
    const before = comp.pool;
    const paid = spec.cost + (spec.upgradeCost[0] as number);
    expect(demolishBuilding(world, mold.id, at)).toEqual({ ok: true });
    expect(world.buildings[0]!.destroyed).toBe(true);
    expect(world.buildingAt[at]).toBe(-1);
    expect(world.owner[at]).toBe(mold.id);
    expect(comp.pool).toBeCloseTo(before + paid * defaultBalance.demolishRefund, 6);
    expect(world.events.some((e) => e.type === 'buildingDestroyed')).toBe(true);
    // the spot is free again, and the building count (limit) dropped
    expect(placeBuilding(world, mold.id, 'storehouse', at)).toEqual({ ok: true });
  });

  it('ends a factory\'s reach at once, so the veins it fed start their die-back clock', () => {
    const { world, mold, comp, cells } = longVein(70);
    const far = cells[60] as number;
    placeBuilding(world, mold.id, 'storehouse', cells[58] as number);
    comp.pool = 300;
    age(world, 10);
    expect(world.strayFor[far]).toBe(0);
    applyCommand(world, { type: 'demolishBuilding', mold: mold.id, cell: cells[58] as number });
    age(world, 10);
    expect(world.strayFor[far]!).toBeGreaterThan(0);
  });

  it('refuses where there is no building, or it belongs to someone else', () => {
    const { world, mold, cells } = longVein();
    expect(demolishBuilding(world, mold.id, cells[3] as number)).toEqual({ ok: false, reason: 'no-building' });
    placeBuilding(world, mold.id, 'storehouse', cells[10] as number);
    expect(demolishBuilding(world, 2, cells[10] as number)).toEqual({ ok: false, reason: 'not-your-cell' });
  });
});
