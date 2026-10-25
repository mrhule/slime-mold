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
    world.replay.entries.push({ tick: world.tick, cmd });
    applyCommand(world, cmd);
  }
}
