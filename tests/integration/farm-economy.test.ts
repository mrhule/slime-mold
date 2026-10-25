import { describe, expect, it } from 'vitest';
import { assertInvariants, createRound, enqueue, readHud, stateHash, step } from '../../src/sim';
import { placeBuilding } from '../../src/sim/buildings';
import { defaultBalance } from '../../src/config/balance';
import { cellOf, createWorldWithMold } from '../helpers';

describe('farm economy (US1)', () => {
  it('a mold with a farm keeps growing where one without cannot, with no food in reach', () => {
    const run = (withFarm: boolean): number => {
      const { world, mold } = createWorldWithMold(220, 40, 10, 20, 100);
      if (withFarm) placeBuilding(world, mold.id, 'farm', cellOf(world, 11, 20));
      enqueue(world, { type: 'setTarget', mold: mold.id, cell: cellOf(world, 210, 20) });
      for (let t = 0; t < 20 * 500; t++) {
        step(world);
        if (t % 400 === 0) assertInvariants(world);
      }
      return mold.cellCount;
    };
    const without = run(false);
    const withFarm = run(true);
    expect(withFarm).toBeGreaterThan(without + 30);
  });

  it('a farm pays back its cost in about 75 seconds of game time', () => {
    const { world, mold } = createWorldWithMold(60, 40, 10, 20, 100, { ...defaultBalance, coreIncome: 0, upkeepPerCell: 0 });
    const cell = cellOf(world, 11, 20);
    const comp = world.components.get(world.component[cell]!)!;
    placeBuilding(world, mold.id, 'farm', cell);
    const afterCost = comp.pool;
    const { cost, income, upkeep } = defaultBalance.buildings.farm;
    for (let t = 0; t < Math.ceil((cost / (income - upkeep)) * 20); t++) step(world);
    expect(comp.pool).toBeGreaterThanOrEqual(afterCost + cost - 0.1);
  });

  it('is deterministic and replayable, including placeBuilding', () => {
    const play = (): { hash: number; log: ReturnType<typeof createRound>['replay'] } => {
      const world = createRound({ runSeed: 21, roundNumber: 1 });
      const arm = world.molds[0]!.core + 1;
      const food = world.foodSources[0]!;
      enqueue(world, { type: 'placeBuilding', mold: 1, building: 'farm', cell: arm });
      enqueue(world, { type: 'setTarget', mold: 1, cell: food.y * world.width + food.x });
      for (let t = 0; t < 600; t++) step(world);
      return { hash: stateHash(world), log: world.replay };
    };
    const a = play();
    const b = play();
    expect(a.hash).toBe(b.hash);
    expect(a.log.entries.some((e) => e.cmd.type === 'placeBuilding')).toBe(true);

    const replay = createRound({ runSeed: 21, roundNumber: 1 });
    let next = 0;
    for (let t = 0; t < 600; t++) {
      while (next < a.log.entries.length && a.log.entries[next]!.tick === t) enqueue(replay, a.log.entries[next++]!.cmd);
      step(replay);
    }
    expect(stateHash(replay)).toBe(a.hash);
    expect(readHud(replay, 1).build[0]!.count).toBe(1);
  });
});
