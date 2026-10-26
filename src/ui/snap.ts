import { canPlace } from '../sim';
import type { BuildingType, MoldId, World } from '../sim/types';

/**
 * Snap a chosen cell to the nearest spot where the building can go (placement is easier with a thumb
 * or a mouse when it lands on the vein for you). The cell itself wins if it is allowed; otherwise the
 * nearest allowed cell within `radius`; otherwise the nearest of your own free cells, so the preview
 * can say why (cannot afford, limit reached); otherwise the cell as tapped. Only your own cells and
 * cells the game already lets you place on are returned, so it never reveals anything hidden.
 */
export function snapPlacement(world: Readonly<World>, mold: MoldId, type: BuildingType, cell: number, radius: number): number {
  if (cell < 0 || cell >= world.width * world.height) return cell;
  if (canPlace(world, mold, type, cell).ok) return cell;
  const w = world.width;
  const cx = cell % w;
  const cy = Math.floor(cell / w);
  let best = -1;
  let bestD = Infinity;
  let own = -1;
  let ownD = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= world.height) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= w) continue;
      const d = dx * dx + dy * dy;
      if (d > radius * radius) continue;
      const c = y * w + x;
      if (world.owner[c] !== mold) continue;
      if (d < ownD && (world.buildingAt[c] as number) < 0) {
        own = c;
        ownD = d;
      }
      if (d < bestD && canPlace(world, mold, type, c).ok) {
        best = c;
        bestD = d;
      }
    }
  }
  return best >= 0 ? best : own >= 0 ? own : cell;
}

/** how far to look, in cells: about 36 screen pixels, so it feels the same at every zoom */
export function snapRadius(cellScreenPx: number): number {
  return Math.min(8, Math.max(2, Math.ceil(36 / Math.max(1, cellScreenPx))));
}
