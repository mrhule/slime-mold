import { COOP } from './config';
import { DX, DY } from '../sim/grid';
import type { MoldId, World } from '../sim/types';

/** a place where the player's veins touch a rival's, worked out from the war map */
export interface FrontInfo {
  /** stable per rival: F1 is the first rival */
  id: string;
  rival: MoldId;
  /** middle of the contact, in grid cells */
  cx: number;
  cy: number;
  ourCells: number;
  theirCells: number;
  seed: number;
  /** hero pool units: from the rival's nutrients in the pieces that touch us */
  pool: number;
  /** from the rival's strength */
  tier: number;
  /** 0 (ours) to 1 (the rival's): from the veins each side holds at the contact */
  pressure: number;
}

export const frontIdOf = (rival: MoldId): string => `F${rival - 1}`;

/** every front right now: one per living rival the player's front cells touch */
export function findFronts(world: World, playerId: MoldId): FrontInfo[] {
  const me = world.molds[playerId - 1];
  if (!me || me.status !== 'alive') return [];
  const { width: w, height: h } = world;
  const touching = new Map<MoldId, { sx: number; sy: number; ours: number; theirs: Set<number>; pieces: Set<number> }>();
  for (const cell of me.frontCells) {
    const x = cell % w;
    const y = Math.floor(cell / w);
    for (let k = 0; k < 8; k++) {
      const nx = x + (DX[k] as number);
      const ny = y + (DY[k] as number);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      const o = world.owner[n] as number;
      if (o === 0 || o === playerId) continue;
      let t = touching.get(o);
      if (!t) touching.set(o, (t = { sx: 0, sy: 0, ours: 0, theirs: new Set(), pieces: new Set() }));
      t.theirs.add(n);
      t.pieces.add(world.component[n] as number);
    }
  }
  for (const cell of me.frontCells) {
    const x = cell % w;
    const y = Math.floor(cell / w);
    const seen = new Set<number>();
    for (let k = 0; k < 8; k++) {
      const nx = x + (DX[k] as number);
      const ny = y + (DY[k] as number);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const o = world.owner[ny * w + nx] as number;
      const t = touching.get(o);
      if (!t || seen.has(o)) continue;
      seen.add(o);
      t.ours++;
      t.sx += x;
      t.sy += y;
    }
  }
  const out: FrontInfo[] = [];
  for (const [rival, t] of touching) {
    const mold = world.molds[rival - 1];
    if (!mold || mold.status !== 'alive' || t.ours === 0) continue;
    let nutrients = 0;
    for (const id of t.pieces) nutrients += world.components.get(id)?.pool ?? 0;
    const theirs = t.theirs.size;
    out.push({
      id: frontIdOf(rival),
      rival,
      cx: t.sx / t.ours,
      cy: t.sy / t.ours,
      ourCells: t.ours,
      theirCells: theirs,
      seed: ((world.replay.runSeed * 2654435761) ^ (world.roundNumber * 40503) ^ (rival * 9973)) >>> 0,
      pool: Math.round(Math.min(COOP.poolMax, Math.max(COOP.poolMin, nutrients * COOP.poolPerNutrient))),
      tier: mold.tier,
      pressure: theirs / (t.ours + theirs),
    });
  }
  return out.sort((a, b) => a.rival - b.rival);
}
