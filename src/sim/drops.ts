import { canPlaceFood, engulfFood, foodCells, placeFood } from './food';
import type { Rng } from './rng';
import { TICK_DT } from './types';
import type { DropEvent, FoodType, World } from './types';

/** weights are read in this fixed order so the pick is reproducible */
const DROP_TYPES: FoodType[] = ['oatFlake', 'breadCrumb', 'sugarCube', 'fruitSlice'];

/** A weighted pick of a food type, by `balance.dropWeights`. */
export function pickDropType(world: Readonly<World>, rng: Rng): FoodType {
  const weights = world.balance.dropWeights;
  let total = 0;
  for (const t of DROP_TYPES) total += weights[t] ?? 0;
  let roll = rng.next() * total;
  for (const t of DROP_TYPES) {
    roll -= weights[t] ?? 0;
    if (roll < 0) return t;
  }
  return 'breadCrumb';
}

/** ticks until the next announcement: dropInterval plus or minus dropJitter seconds */
export function nextDropDelay(world: Readonly<World>, rng: Rng): number {
  const b = world.balance;
  return Math.max(1, Math.round((b.dropInterval + rng.jitter(b.dropJitter)) / TICK_DT));
}

/** the first announcement comes a little earlier than the usual interval */
export function firstDropTick(world: Readonly<World>, rng: Rng): number {
  return Math.max(1, Math.round((world.balance.dropInterval * 0.6 + rng.jitter(world.balance.dropJitter)) / TICK_DT));
}

function footprintReachable(world: World, x: number, y: number, fw: number, fh: number): boolean {
  for (let yy = y; yy < y + fh; yy++) {
    for (let xx = x; xx < x + fw; xx++) if (!world.reachable[yy * world.width + xx]) return false;
  }
  return true;
}

/** pick a spot where a drop of this type fits on walkable, reachable ground away from other drops */
function pickSpot(world: World, type: FoodType, rng: Rng): { x: number; y: number } | null {
  const spec = world.balance.foodTypes[type];
  const pending = world.drops.filter((d) => d.state !== 'landed');
  for (let attempt = 0; attempt < 80; attempt++) {
    const x = 2 + rng.int(world.width - 4 - spec.w);
    const y = 2 + rng.int(world.height - 4 - spec.h);
    if (!canPlaceFood(world, type, x, y) || !footprintReachable(world, x, y, spec.w, spec.h)) continue;
    const near = pending.some((d) => Math.abs((d.cell % world.width) - x) < 10 && Math.abs(Math.floor(d.cell / world.width) - y) < 10);
    if (!near) return { x, y };
  }
  return null;
}

/**
 * Food drops (FR-017): announce a drop with a warning every molds can see, let it land after
 * `dropWarning` seconds, and schedule the next one when this one enters its warning.
 */
export function tickDrops(world: World): void {
  const rng = world.rng.get('drops');
  const b = world.balance;

  if (world.tick >= world.nextDropTick) {
    world.nextDropTick = world.tick + nextDropDelay(world, rng);
    const type = pickDropType(world, rng);
    const spot = pickSpot(world, type, rng);
    if (spot) {
      const drop: DropEvent = {
        id: world.drops.length,
        type,
        cell: spot.y * world.width + spot.x,
        warnTick: world.tick,
        landTick: world.tick + Math.round(b.dropWarning / TICK_DT),
        state: 'warning',
      };
      world.drops.push(drop);
      world.events.push({ type: 'dropWarning', dropId: drop.id, cell: drop.cell, foodType: type });
    }
  }

  for (const drop of world.drops) {
    if (drop.state !== 'warning' || world.tick < drop.landTick) continue;
    drop.state = 'landed';
    const w = world.width;
    let x = drop.cell % w;
    let y = Math.floor(drop.cell / w);
    if (!canPlaceFood(world, drop.type, x, y)) {
      // something took the spot during the warning: nudge it a little
      let moved = false;
      for (let r = 1; r <= 3 && !moved; r++) {
        for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]] as const) {
          if (canPlaceFood(world, drop.type, x + dx, y + dy)) {
            x += dx;
            y += dy;
            moved = true;
            break;
          }
        }
      }
      if (!moved) continue;
    }
    const src = placeFood(world, drop.type, x, y, 'drop');
    if (!src) continue;
    world.events.push({ type: 'dropLanded', dropId: drop.id, foodSourceId: src.id });
    // everyone saw it coming, so every mold knows where it landed (remembered, until they see it)
    for (const mold of world.molds) {
      for (const cell of foodCells(world, src)) {
        if ((mold.vision[cell] as number) === 0) mold.vision[cell] = 1;
        if ((mold.vision[cell] as number) === 1) mold.memFood[cell] = world.food[cell] as number;
      }
    }
    // molds already under the landing spot start feeding at once and spread over the rest of it
    for (const cell of foodCells(world, src)) {
      const owner = world.owner[cell] as number;
      if (owner !== 0) engulfFood(world, owner, cell);
    }
  }
}
