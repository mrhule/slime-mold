import { describe, expect, it } from 'vitest';
import { think } from '../../../src/sim/ai/rival-ai';
import { enqueue } from '../../../src/sim/commands';
import { step } from '../../../src/sim/step';
import { scanFronts } from '../../../src/sim/combat';
import { updateVision } from '../../../src/sim/fog';
import { placeFood } from '../../../src/sim/food';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import { Rng } from '../../../src/sim/rng';
import type { AiState, Command, World } from '../../../src/sim/types';
import { viewFor } from '../../../src/sim/view';
import { defaultBalance } from '../../../src/config/balance';
import { canPlace } from '../../../src/sim/buildings';
import { cellOf, createOpenWorld, withStoreHouse } from '../../helpers';

function rivalWorld(aggression = 0.5): { world: World; id: number; state: AiState } {
  const world = createOpenWorld(100, 60);
  addMold(world, 'player', cellOf(world, 90, 50), 10);
  const rival = addMold(world, 'rival', cellOf(world, 20, 30), 30, aggression);
  updateVision(world);
  return { world, id: rival.id, state: rival.ai! };
}

/** a goo pool beside the rival's east arm, with one of its cells held */
function holdPool(world: World, id: number): void {
  placeFood(world, 'goo', 22, 29, 'initial');
  addCell(world, id, cellOf(world, 22, 30), cellOf(world, 21, 30));
  updateVision(world);
}

const targets = (cmds: Command[]) => cmds.filter((c): c is Extract<Command, { type: 'setTarget' }> => c.type === 'setTarget');

describe('rival AI', () => {
  it('returns at most aiCommandsPerThink commands, all stamped with its own mold id', () => {
    const { world, id, state } = rivalWorld();
    for (let i = 0; i < 6; i++) placeFood(world, 'oatFlake', 28 + i * 3, 24 + (i % 3) * 5, 'initial');
    updateVision(world);
    const cmds = think(viewFor(world, id), state, new Rng(1), 3);
    expect(cmds.length).toBeGreaterThan(0);
    expect(cmds.length).toBeLessThanOrEqual(3);
    for (const c of cmds) expect(c.mold).toBe(id);
    expect(think(viewFor(world, id), state, new Rng(1), 1).length).toBeLessThanOrEqual(1);
  });

  it('is deterministic: the same view, state and rng give the same commands', () => {
    const { world, id } = rivalWorld();
    placeFood(world, 'oatFlake', 30, 28, 'initial');
    updateVision(world);
    const a = think(viewFor(world, id), { aggression: 0.5, debug: [] }, new Rng(7), 3);
    const b = think(viewFor(world, id), { aggression: 0.5, debug: [] }, new Rng(7), 3);
    expect(a).toEqual(b);
  });

  it('targets visible food when nothing contests it', () => {
    const { world, id, state } = rivalWorld();
    placeFood(world, 'sugarCube', 30, 27, 'initial');
    updateVision(world);
    const t = targets(think(viewFor(world, id), state, new Rng(3), 3));
    expect(t.length).toBeGreaterThan(0);
    expect(t[0]!.cell).toBe(cellOf(world, 30, 27));
  });

  it('grows toward a goo pool it has never seen: pools are terrain every mold knows', () => {
    const { world, id, state } = rivalWorld();
    placeFood(world, 'goo', 60, 10, 'initial');
    updateVision(world);
    const view = viewFor(world, id);
    expect(view.visibility(cellOf(world, 60, 10))).toBe(0);
    const t = targets(think(view, state, new Rng(3), 3));
    expect(t.some((c) => c.cell === cellOf(world, 60, 10))).toBe(true);
  });

  it('prefers richer and closer food', () => {
    const { world, id, state } = rivalWorld();
    placeFood(world, 'oatFlake', 28, 36, 'initial'); // small
    placeFood(world, 'fruitSlice', 30, 22, 'initial'); // big, about as close
    updateVision(world);
    const t = targets(think(viewFor(world, id), state, new Rng(3), 3));
    expect(t[0]!.cell).toBe(cellOf(world, 30, 22));
  });

  it('explores when it knows of no food', () => {
    const { world, id, state } = rivalWorld();
    const cmds = think(viewFor(world, id), state, new Rng(5), 3);
    const t = targets(cmds);
    expect(world.foodSources).toHaveLength(0);
    expect(t.length).toBeGreaterThan(0);
    for (const c of t) expect(world.terrain[c.cell]).toBeLessThan(2);
  });

  it('only sees food its own veins can see (fog): unseen food is not a target', () => {
    const { world, id, state } = rivalWorld();
    placeFood(world, 'fruitSlice', 80, 10, 'initial'); // far away and never seen
    updateVision(world);
    const view = viewFor(world, id);
    expect(view.knownFood()).toHaveLength(0);
    const t = targets(think(view, state, new Rng(5), 3));
    expect(t.some((c) => c.cell === cellOf(world, 80, 10))).toBe(false);
  });

  it('keeps its targets apart', () => {
    const { world, id, state } = rivalWorld();
    for (let i = 0; i < 6; i++) placeFood(world, 'oatFlake', 26 + i * 3, 26 + (i % 2) * 6, 'initial');
    updateVision(world);
    const t = targets(think(viewFor(world, id), state, new Rng(9), 3));
    for (let i = 0; i < t.length; i++) {
      for (let j = i + 1; j < t.length; j++) {
        const dx = (t[i]!.cell % world.width) - (t[j]!.cell % world.width);
        const dy = Math.floor(t[i]!.cell / world.width) - Math.floor(t[j]!.cell / world.width);
        expect(Math.max(Math.abs(dx), Math.abs(dy))).toBeGreaterThan(5);
      }
    }
  });

  it('puts everything into growth when it sees no front, and raises the fight share when it does', () => {
    const { world, id, state } = rivalWorld(0.8);
    world.molds[id - 1]!.allocation = 0.7;
    let cmds = think(viewFor(world, id), state, new Rng(2), 3);
    const down = cmds.find((c) => c.type === 'setAllocation');
    expect(down && down.type === 'setAllocation' ? down.value : -1).toBe(0);

    // an enemy cell touching its east arm
    addCell(world, 1, cellOf(world, 22, 30), -1);
    scanFronts(world);
    expect(world.molds[id - 1]!.frontCells.length).toBeGreaterThan(0);
    world.molds[id - 1]!.allocation = 0;
    world.molds[id - 1]!.frontLoss = 1; // losing biomass on the front
    updateVision(world);
    cmds = think(viewFor(world, id), state, new Rng(2), 3);
    const up = cmds.find((c) => c.type === 'setAllocation');
    expect(up && up.type === 'setAllocation' ? up.value : -1).toBeGreaterThanOrEqual(0.7);
  });

  it('a more aggressive rival fights with more of its nutrients', () => {
    const fightShare = (aggression: number): number => {
      const { world, id, state } = rivalWorld(aggression);
      addCell(world, 1, cellOf(world, 22, 30), -1);
      scanFronts(world);
      const cmds = think(viewFor(world, id), state, new Rng(2), 3);
      const c = cmds.find((x) => x.type === 'setAllocation');
      return c && c.type === 'setAllocation' ? c.value : 0;
    };
    expect(fightShare(0.9)).toBeGreaterThan(fightShare(0.1));
  });

  it('attacks a visible enemy when aggressive and nothing better is around', () => {
    const { world, id, state } = rivalWorld(0.9);
    const enemy = cellOf(world, 30, 32); // inside its 10-cell vision
    addCell(world, 1, enemy, -1);
    world.biomass[enemy] = 0.3; // weak
    updateVision(world);
    const t = targets(think(viewFor(world, id), state, new Rng(4), 3));
    expect(t.some((c) => c.cell === enemy)).toBe(true);
  });

  it('does nothing once it is out of cells', () => {
    const { world, id, state } = rivalWorld();
    world.molds[id - 1]!.cellCount = 0;
    expect(think(viewFor(world, id), state, new Rng(1), 3)).toEqual([]);
  });
});

describe('rival AI building (US4)', () => {
  const placements = (cmds: Command[]) => cmds.filter((c): c is Extract<Command, { type: 'placeBuilding' }> => c.type === 'placeBuilding');

  function rich(pool: number, reserve: number) {
    const { world, id, state } = rivalWorld(0.5);
    state.buildReserve = reserve;
    for (const c of world.components.values()) if (c.moldId === id) c.pool = pool;
    updateVision(world);
    return { world, id, state };
  }

  it('builds a store house, through the same command, when it holds a goo pool with none on its piece', () => {
    const { world, id, state } = rich(200, 60);
    holdPool(world, id);
    const cmds = placements(think(viewFor(world, id), state, new Rng(1), 3));
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ mold: id, building: 'storehouse' });
    expect(world.owner[cmds[0]!.cell]).toBe(id);
  });

  it('builds no second store house for a pool whose piece already has one', () => {
    const { world, id, state } = rich(200, 60);
    holdPool(world, id);
    const core = world.molds[id - 1]!.core;
    withStoreHouse(world, id, core + 1); // an arm of the core
    expect(placements(think(viewFor(world, id), state, new Rng(1), 3))).toHaveLength(0);
  });

  it('builds nothing while it holds no goo pool and has no other need', () => {
    const { world, id, state } = rich(150, 20);
    expect(placements(think(viewFor(world, id), state, new Rng(1), 3))).toHaveLength(0);
  });

  it('does not build when it cannot afford cost + reserve', () => {
    const { world, id, state } = rich(50, 60);
    holdPool(world, id);
    expect(placements(think(viewFor(world, id), state, new Rng(1), 3))).toHaveLength(0);
  });

  it('a smaller reserve means it builds sooner (difficulty changes timing only)', () => {
    const early = rich(70, 10);
    const late = rich(70, 200);
    holdPool(early.world, early.id);
    holdPool(late.world, late.id);
    expect(placements(think(viewFor(early.world, early.id), early.state, new Rng(1), 3))).toHaveLength(1);
    expect(placements(think(viewFor(late.world, late.id), late.state, new Rng(1), 3))).toHaveLength(0);
  });

  it('pays the same cost and obeys the same limits as the player when the command runs', () => {
    const { world, id, state } = rich(500, 20);
    holdPool(world, id);
    const cmd = placements(think(viewFor(world, id), state, new Rng(1), 3))[0]!;
    const comp = world.components.get(world.component[cmd.cell]!)!;
    const before = comp.pool;
    enqueue(world, cmd);
    step(world);
    expect(before - comp.pool).toBeGreaterThanOrEqual(world.balance.buildings.storehouse.cost - 1); // minus a tick of income
    expect(world.buildings.filter((b) => b.moldId === id)).toHaveLength(1);
    // fill the limit: the AI stops asking, and the sim would refuse anyway
    for (const comp2 of world.components.values()) if (comp2.moldId === id) comp2.pool = 5000;
    for (let i = 0; i < 12; i++) {
      for (const cm of placements(think(viewFor(world, id), state, new Rng(i), 3))) enqueue(world, cm);
      step(world);
    }
    expect(world.buildings.filter((b) => b.moldId === id && b.type === 'storehouse').length).toBeLessThanOrEqual(world.balance.buildings.storehouse.limit);
  });

  it('builds a booster factory near a front it is losing', () => {
    const { world, id, state } = rich(300, 30);
    addCell(world, 1, cellOf(world, 22, 30), -1); // an enemy cell touching its east arm
    scanFronts(world);
    world.molds[id - 1]!.frontLoss = 1;
    updateVision(world);
    const cmds = placements(think(viewFor(world, id), state, new Rng(2), 3));
    expect(cmds[0]).toMatchObject({ mold: id, building: 'booster' });
  });

  it('builds a harvester next to big food it can see', () => {
    const { world, id, state } = rich(200, 20);
    placeFood(world, 'sugarCube', 24, 28, 'initial');
    // grow the mold up to the food so it has cells touching it
    let prev = cellOf(world, 21, 30);
    for (let x = 22; x <= 23; x++) {
      addCell(world, id, cellOf(world, x, 30), prev);
      prev = cellOf(world, x, 30);
    }
    updateVision(world);
    const cmds = placements(think(viewFor(world, id), state, new Rng(3), 3));
    expect(cmds.some((c) => c.building === 'harvester')).toBe(true);
  });

  it('cannot see (or harvest) big food it has never seen', () => {
    const { world, id, state } = rich(200, 20);
    placeFood(world, 'sugarCube', 80, 10, 'initial'); // far away, never seen
    updateVision(world);
    const view = viewFor(world, id);
    expect(view.knownFood()).toHaveLength(0);
    const cmds = placements(think(view, state, new Rng(3), 3));
    expect(cmds.some((c) => c.building === 'harvester')).toBe(false);
  });

  it('can only ask about its own cells', () => {
    const { world, id } = rich(500, 0);
    const view = viewFor(world, id);
    expect(view.canBuild('booster', cellOf(world, 21, 30))).toBe(true);
    expect(view.canBuild('booster', cellOf(world, 50, 10))).toBe(false); // empty ground
    expect(view.canBuild('booster', cellOf(world, 90, 50))).toBe(false); // the other mold's core
  });
});

describe('rival AI: store houses (003 US5, 008)', () => {
  const placements2 = (cmds: Command[]) => cmds.filter((c): c is Extract<Command, { type: 'placeBuilding' }> => c.type === 'placeBuilding');

  function funded(pool: number, reserve = 10) {
    const { world, id, state } = rivalWorld(0.5);
    state.buildReserve = reserve;
    for (const c of world.components.values()) if (c.moldId === id) c.pool = pool;
    updateVision(world);
    return { world, id, state };
  }

  it('never issues a placement the sim would refuse', () => {
    const { world, id, state } = funded(250);
    holdPool(world, id);
    for (let round = 0; round < 6; round++) {
      const cmds = think(viewFor(world, id), state, new Rng(round + 1), 3);
      for (const p of placements2(cmds)) {
        expect(canPlace(world, id, p.building, p.cell), `${p.building}@${p.cell}`).toEqual({ ok: true });
        enqueue(world, p);
      }
      step(world);
      for (const c of world.components.values()) if (c.moldId === id) c.pool = 250;
    }
  });

  it('builds a store house for capacity when a piece is nearly full, up to the per-piece count', () => {
    const { world, id, state } = funded(0.9 * defaultBalance.pool.baseCap);
    const cmds = placements2(think(viewFor(world, id), state, new Rng(1), 3));
    expect(cmds.some((c) => c.building === 'storehouse')).toBe(true);
    // with the per-piece count already reached it does not stack more
    const piece = [...world.components.values()].find((c) => c.moldId === id)!;
    const arms = [world.molds[id - 1]!.core + 1, world.molds[id - 1]!.core - 1, world.molds[id - 1]!.core + world.width];
    for (const cell of arms.slice(0, defaultBalance.buildings.storehouse.perPiece)) withStoreHouse(world, id, cell);
    piece.pool = 0.95 * (defaultBalance.pool.baseCap + defaultBalance.buildings.storehouse.capacity * defaultBalance.buildings.storehouse.perPiece);
    updateVision(world);
    const again = placements2(think(viewFor(world, id), state, new Rng(1), 3));
    expect(again.some((c) => c.building === 'storehouse')).toBe(false);
  });
});
