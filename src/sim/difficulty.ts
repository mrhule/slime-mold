import { defaultBalance } from '../config/balance';
import type { BalanceConfig } from '../config/balance';
import type { DifficultyProfile } from './types';

/** The narrowest and widest map shape a screen can ask for, as width over height. */
const ASPECT_MIN = 1;
const ASPECT_MAX = 2.4;

/**
 * Difficulty for a 1-based round number (R14). Every field only ever moves toward harder.
 * With a screen `aspect` (width over height) the map keeps the same number of cells but takes the
 * screen's shape, so a wide phone gets a wide map instead of a 4:3 one it can only show part of.
 */
export function difficultyFor(round: number, balance: BalanceConfig = defaultBalance, aspect?: number): DifficultyProfile {
  const d = balance.difficulty;
  const n = Math.max(1, Math.floor(round));
  const scale = Math.min(1 + d.mapGrowth * (n - 1), d.mapScaleMax);
  let mapWidth = Math.min(Math.round(d.baseW * scale), d.capW);
  let mapHeight = Math.min(Math.round(d.baseH * scale), d.capH);
  if (aspect !== undefined && Number.isFinite(aspect) && aspect > 0) {
    const cells = mapWidth * mapHeight;
    mapWidth = Math.round(Math.sqrt(cells * Math.min(ASPECT_MAX, Math.max(ASPECT_MIN, aspect))));
    mapHeight = Math.round(cells / mapWidth);
  }
  return {
    rivalCount: Math.min(1 + Math.floor((n - 1) / 2), d.rivalsMax),
    mapWidth,
    mapHeight,
    foodDensity: Math.max(1 - d.foodDecay * (n - 1), d.foodMin),
    rivalAggression: Math.min(d.aggressionBase + d.aggressionStep * (n - 1), d.aggressionMax),
    rivalStartNutrients: 1 + d.startNutrientsStep * (n - 1),
    aiThinkInterval: Math.max(d.thinkBase - d.thinkStep * (n - 1), d.thinkMin),
    dropInterval: balance.dropInterval,
    rivalBuildReserve: Math.max(d.buildReserveMin, d.buildReserveBase - d.buildReserveStep * (n - 1)),
  };
}
