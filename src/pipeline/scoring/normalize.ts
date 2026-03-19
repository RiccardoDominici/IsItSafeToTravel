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
 */
const INDICATOR_RANGES: Record<string, { min: number; max: number; inverse: boolean }> = {
  gpi_overall: { min: 1.0, max: 4.0, inverse: true },
  gpi_safety_security: { min: 1.0, max: 5.0, inverse: true },
  gpi_militarisation: { min: 1.0, max: 5.0, inverse: true },
  acled_fatalities: { min: 0, max: 10000, inverse: true },
  acled_events: { min: 0, max: 5000, inverse: true },
  advisory_level_us: { min: 1, max: 4, inverse: true },
  advisory_level_uk: { min: 0, max: 4, inverse: true },
  inform_health: { min: 0, max: 10, inverse: true },
  inform_epidemic: { min: 0, max: 10, inverse: true },
  inform_governance: { min: 0, max: 10, inverse: true },
  inform_natural: { min: 0, max: 10, inverse: true },
  inform_climate: { min: 0, max: 10, inverse: true },
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
