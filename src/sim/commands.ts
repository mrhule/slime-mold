import { placeBuilding } from './buildings';
import { addTarget } from './growth';
import type { Command, MoldId, World } from './types';

/** Queue a command; it is applied at the start of the next tick (also while paused). */
export function enqueue(world: World, cmd: Command): void {
  world.commandQueue.push(cmd);
}

function reject(world: World, mold: MoldId, reason: string, cell?: number): void {
  world.events.push(cell === undefined ? { type: 'commandRejected', mold, reason } : { type: 'commandRejected', mold, reason, cell });
}

/** Queue a command issued by the sim itself (a rival AI). It runs like any other but is not part of the replay log. */
export function enqueueInternal(world: World, cmd: Command): void {
  world.internalCommands.add(cmd);
  world.commandQueue.push(cmd);
}

/** the allocation a mold will have once its queued orders run (what the slider should show while paused) */
export function pendingAllocation(world: Readonly<World>, moldId: MoldId): number {
  let value = world.molds[moldId - 1]?.allocation ?? 0;
  for (const c of world.commandQueue) {
    if (c.type === 'setAllocation' && c.mold === moldId) value = Math.round(Math.min(1, Math.max(0, c.value)) * 20) / 20;
  }
  return value;
}

/** a farm's level once its queued orders run (what the panel should show while paused) */
export function pendingFarmLevel(world: Readonly<World>, buildingId: number): number {
  let level = world.buildings[buildingId]?.level ?? 0;
  for (const c of world.commandQueue) {
    if (c.type === 'setFarmOutput' && c.building === buildingId && Number.isInteger(c.level) && c.level >= 0 && c.level <= world.balance.buildings.farm.maxLevel) level = c.level;
  }
  return level;
}

export function applyCommand(world: World, cmd: Command): void {
  const mold = world.molds[cmd.mold - 1];
  if (!mold) return reject(world, cmd.mold, 'unknown-mold');
  if (mold.status !== 'alive') return reject(world, cmd.mold, 'mold-eliminated');
  switch (cmd.type) {
    case 'setTarget': {
      const res = addTarget(world, cmd.mold, cmd.cell);
      if (!res.ok) reject(world, cmd.mold, res.reason, cmd.cell);
      return;
    }
    case 'cancelTarget': {
      const i = mold.targets.findIndex((t) => t.id === cmd.targetId);
      if (i >= 0) {
        mold.targets.splice(i, 1);
        return;
      }
      const owned = world.molds.some((m) => m.targets.some((t) => t.id === cmd.targetId));
      return reject(world, cmd.mold, owned ? 'not-owner' : 'unknown-target');
    }
    case 'clearTargets':
      mold.targets.length = 0;
      return;
    case 'placeBuilding': {
      const res = placeBuilding(world, cmd.mold, cmd.building, cmd.cell);
      if (!res.ok) reject(world, cmd.mold, res.reason, cmd.cell);
      return;
    }
    case 'setFarmOutput': {
      const b = world.buildings[cmd.building];
      if (!b || b.destroyed) return reject(world, cmd.mold, 'unknown-building');
      if (b.moldId !== cmd.mold) return reject(world, cmd.mold, 'not-your-building');
      if (b.type !== 'farm') return reject(world, cmd.mold, 'not-a-farm');
      if (!Number.isInteger(cmd.level) || cmd.level < 0 || cmd.level > world.balance.buildings.farm.maxLevel) {
        return reject(world, cmd.mold, 'bad-level');
      }
      b.level = cmd.level;
      return;
    }
    case 'setAllocation': {
      const v = Math.min(1, Math.max(0, cmd.value));
      mold.allocation = Math.round(v * 20) / 20;
      return;
    }
  }
}

export function applyQueuedCommands(world: World): void {
  const queue = world.commandQueue;
  if (queue.length === 0) return;
  world.commandQueue = [];
  for (const cmd of queue) {
    if (!world.internalCommands.has(cmd)) world.replay.entries.push({ tick: world.tick, cmd });
    applyCommand(world, cmd);
  }
}
