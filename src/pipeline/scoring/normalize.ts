import type { RawIndicator, IndicatorScore } from '../types.js';

/**
 * Normalize a value to 0-1 range (higher = safer).
 * Values outside [min, max] are clamped.
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Inverse normalization: lower raw values = higher normalized (safer).
 * Used for indicators where low = good (e.g., advisory level, conflict events).
 */
export function normalizeInverse(value: number, min: number, max: number): number {
  return 1 - normalize(value, min, max);
}

/**
 * Known min/max ranges and direction for each indicator.
 * inverse=true means lower raw value = safer (higher normalized score).
 *
 * World Bank WGI indicators: -2.5 to 2.5 (higher = better governance/stability)
 * Advisory levels: 1 to 4 (lower = safer)
 * ACLED: 0 to N (lower = fewer conflicts = safer)
 * Health/environment: lower = better
 */
const INDICATOR_RANGES: Record<string, { min: number; max: number; inverse: boolean }> = {
  // World Bank Worldwide Governance Indicators (higher = better)
  wb_political_stability: { min: -2.5, max: 2.5, inverse: false },
  wb_rule_of_law: { min: -2.5, max: 2.5, inverse: false },
  wb_gov_effectiveness: { min: -2.5, max: 2.5, inverse: false },
  wb_corruption_control: { min: -2.5, max: 2.5, inverse: false },

  // World Bank health & environment (lower = better)
  wb_child_mortality: { min: 0, max: 200, inverse: true },
  wb_air_pollution: { min: 0, max: 100, inverse: true },

  // ACLED conflict data (lower = safer)
  acled_fatalities: { min: 0, max: 10000, inverse: true },
  acled_events: { min: 0, max: 5000, inverse: true },

  // Government travel advisories: raw levels 1-4 (lower = safer)
  advisory_level_us: { min: 1, max: 4, inverse: true },
  advisory_level_uk: { min: 1, max: 4, inverse: true },
};

/**
 * Normalize an array of raw indicators into scored indicators.
 * Unknown indicator names are skipped (not in INDICATOR_RANGES).
 */
export function normalizeIndicators(indicators: RawIndicator[]): IndicatorScore[] {
  const results: IndicatorScore[] = [];

  for (const ind of indicators) {
    const range = INDICATOR_RANGES[ind.indicatorName];
    if (!range) continue; // Skip unknown indicators

    const normalizedValue = range.inverse
      ? normalizeInverse(ind.value, range.min, range.max)
      : normalize(ind.value, range.min, range.max);

    results.push({
      name: ind.indicatorName,
      rawValue: ind.value,
      normalizedValue,
      source: ind.source,
      year: ind.year,
    });
  }

  return results;
}
