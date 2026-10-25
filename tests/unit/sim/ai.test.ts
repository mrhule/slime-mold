import { describe, expect, it } from 'vitest';
import { think } from '../../../src/sim/ai/rival-ai';
import { scanFronts } from '../../../src/sim/combat';
import { updateVision } from '../../../src/sim/fog';
import { placeFood } from '../../../src/sim/food';
import { addMold } from '../../../src/sim/molds';
import { addCell } from '../../../src/sim/network';
import { Rng } from '../../../src/sim/rng';
import type { AiState, Command, World } from '../../../src/sim/types';
import { viewFor } from '../../../src/sim/view';
import { cellOf, createOpenWorld } from '../../helpers';

function rivalWorld(aggression = 0.5): { world: World; id: number; state: AiState } {
  const world = createOpenWorld(100, 60);
  addMold(world, 'player', cellOf(world, 90, 50), 10);
  const rival = addMold(world, 'rival', cellOf(world, 20, 30), 30, aggression);
  updateVision(world);
  return { world, id: rival.id, state: rival.ai! };
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
