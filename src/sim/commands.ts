import { demolishBuilding, placeBuilding, upgradeBuilding } from './buildings';
import { addTarget } from './growth';
import { sporeBurst } from './bloom';
import { evolve } from './tiers';
import { dirBetween } from './grid';
import { cutKey, linkCells, relabelComponent, unlinkCells } from './network';
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
    case 'upgradeBuilding': {
      const res = upgradeBuilding(world, cmd.mold, cmd.cell);
      if (!res.ok) reject(world, cmd.mold, res.reason, cmd.cell);
      return;
    }
    case 'evolve': {
      const res = evolve(world, cmd.mold);
      if (!res.ok) reject(world, cmd.mold, res.reason);
      return;
    }
    case 'sporeBurst': {
      const reason = sporeBurst(world, cmd.mold);
      if (reason) reject(world, cmd.mold, reason);
      return;
    }
    case 'demolishBuilding': {
      const res = demolishBuilding(world, cmd.mold, cmd.cell);
      if (!res.ok) reject(world, cmd.mold, res.reason, cmd.cell);
      return;
    }
    case 'toggleLink': {
      const { a, b } = cmd;
      const k = dirBetween(world.width, a, b);
      const owned = (c: number): boolean => c >= 0 && c < world.owner.length && world.owner[c] === mold.id;
      if (k < 0 || !owned(a) || !owned(b)) return reject(world, cmd.mold, 'no-vein', a);
      const key = cutKey(world, a, b);
      if ((world.edges[a] as number) & (1 << k)) {
        // cut: the cells stay, but the two sides are separate pieces; one with no core or food starves and dies off
        unlinkCells(world, a, b);
        world.cuts.add(key);
        relabelComponent(world, world.component[a] as number);
        return;
      }
      if (world.cuts.has(key)) {
        world.cuts.delete(key);
        linkCells(world, a, b);
        return;
      }
      return reject(world, cmd.mold, 'no-vein', a);
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
