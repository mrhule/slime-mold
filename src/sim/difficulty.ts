import { defaultBalance } from '../config/balance';
import type { BalanceConfig } from '../config/balance';
import type { DifficultyProfile } from './types';

/** Difficulty for a 1-based round number (R14). Every field only ever moves toward harder. */
export function difficultyFor(round: number, balance: BalanceConfig = defaultBalance): DifficultyProfile {
  const d = balance.difficulty;
  const n = Math.max(1, Math.floor(round));
  const scale = Math.min(1 + d.mapGrowth * (n - 1), d.mapScaleMax);
  return {
    rivalCount: Math.min(1 + Math.floor((n - 1) / 2), d.rivalsMax),
    mapWidth: Math.min(Math.round(d.baseW * scale), d.capW),
    mapHeight: Math.min(Math.round(d.baseH * scale), d.capH),
    foodDensity: Math.max(1 - d.foodDecay * (n - 1), d.foodMin),
    rivalAggression: Math.min(d.aggressionBase + d.aggressionStep * (n - 1), d.aggressionMax),
    rivalStartNutrients: 1 + d.startNutrientsStep * (n - 1),
    aiThinkInterval: Math.max(d.thinkBase - d.thinkStep * (n - 1), d.thinkMin),
    dropInterval: balance.dropInterval,
  };
}
