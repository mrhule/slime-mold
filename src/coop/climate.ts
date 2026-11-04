import type { Messages } from '../../link/protocol';
import type { World } from '../sim/types';

/** the sky on the commander's map, as the hero draws it; the RTS stays the authority and nothing here changes it */
export function climateMessage(world: Readonly<World>): Messages['climate'] {
  const w = world.weather as { kind: Messages['climate']['weather']; intensity?: number };
  const intensity = typeof w.intensity === 'number' && Number.isFinite(w.intensity) ? w.intensity : 1;
  return { season: world.season, weather: w.kind, intensity: Math.round(Math.max(0, Math.min(1, intensity)) * 20) / 20 };
}

export const climateKey = (c: Messages['climate']): string => `${c.season}:${c.weather}:${c.intensity}`;
