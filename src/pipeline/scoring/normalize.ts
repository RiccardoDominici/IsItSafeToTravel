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

  // ReliefWeb active disasters (lower = safer)
  reliefweb_active_disasters: { min: 0, max: 10, inverse: true },

  // GDACS disaster alerts - orange/red (lower = safer)
  gdacs_disaster_alerts: { min: 0, max: 5, inverse: true },

  // Global Peace Index: 1 to 5 scale (lower = more peaceful = safer)
  gpi_overall: { min: 1, max: 4, inverse: true },
  gpi_safety_security: { min: 1, max: 5, inverse: true },
  gpi_militarisation: { min: 1, max: 5, inverse: true },

  // INFORM Risk Index: 0 to 10 (lower = lower risk = safer)
  inform_natural: { min: 0, max: 10, inverse: true },
  inform_health: { min: 0, max: 10, inverse: true },
  inform_epidemic: { min: 0, max: 10, inverse: true },
  inform_governance: { min: 0, max: 10, inverse: true },
  inform_climate: { min: 0, max: 10, inverse: true },

  // Government travel advisories: raw levels 1-4 (lower = safer)
  advisory_level_us: { min: 1, max: 4, inverse: true },
  advisory_level_uk: { min: 1, max: 4, inverse: true },
  advisory_level_ca: { min: 1, max: 4, inverse: true },
  advisory_level_au: { min: 1, max: 4, inverse: true },
  advisory_level_de: { min: 1, max: 4, inverse: true },
  advisory_level_nl: { min: 1, max: 4, inverse: true },
  advisory_level_jp: { min: 1, max: 4, inverse: true },
  advisory_level_sk: { min: 1, max: 4, inverse: true },

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
