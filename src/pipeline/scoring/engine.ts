import { normalizeIndicators } from './normalize.js';
import { COUNTRIES, getCountryByIso3 } from '../config/countries.js';
import type {
  RawIndicator,
  WeightsConfig,
  CountryEntry,
  AdvisoryInfo,
  SourceMeta,
  PillarScore,
  ScoredCountry,
  RawSourceData,
  PillarName,
} from '../types.js';

/**
 * Compute safety score for a single country.
 *
 * Logic:
 * - Filter indicators for this country
 * - For each pillar: normalize indicators, average them, track data completeness
 * - Composite = weighted sum of pillar scores, mapped to 1-10 scale
 * - Missing data reduces dataCompleteness but does not block scoring
 */
export function computeCountryScore(
  iso3: string,
  allIndicators: RawIndicator[],
  weightsConfig: WeightsConfig,
  countryEntry: CountryEntry,
  advisories: { us?: AdvisoryInfo; uk?: AdvisoryInfo },
  sources: SourceMeta[],
): ScoredCountry {
  const countryIndicators = allIndicators.filter(
    (ind) => ind.countryIso3.toUpperCase() === iso3.toUpperCase(),
  );

  // Normalize all indicators for this country at once
  const normalizedAll = normalizeIndicators(countryIndicators);

  // Build pillar scores
  const pillars: PillarScore[] = weightsConfig.pillars.map((pillarDef) => {
    // Find normalized indicators that belong to this pillar
    const pillarIndicators = normalizedAll.filter((ns) =>
      pillarDef.indicators.includes(ns.name),
    );

    const expectedCount = pillarDef.indicators.length;
    const foundCount = pillarIndicators.length;
    const dataCompleteness = expectedCount > 0 ? foundCount / expectedCount : 0;

    let score: number;
    if (foundCount === 0) {
      score = 0.5; // neutral default when no data
    } else {
      const sum = pillarIndicators.reduce((acc, ind) => acc + ind.normalizedValue, 0);
      score = sum / foundCount;
    }

    return {
      name: pillarDef.name as PillarName,
      score,
      weight: pillarDef.weight,
      indicators: pillarIndicators,
      dataCompleteness,
    };
  });

  // Compute composite weighted score (0-1 range)
  const weightedSum = pillars.reduce((acc, p) => acc + p.score * p.weight, 0);

  // Map to 1-10 scale: score = weightedSum * 9 + 1
  const score = Math.round((weightedSum * 9 + 1) * 10) / 10;
  const scoreDisplay = Math.round(score);

  // Overall data completeness: average of pillar completeness
  const overallCompleteness =
    pillars.length > 0
      ? pillars.reduce((acc, p) => acc + p.dataCompleteness, 0) / pillars.length
      : 0;

  return {
    iso3: iso3.toUpperCase(),
    name: countryEntry.name,
    score,
    scoreDisplay,
    pillars,
    advisories,
    dataCompleteness: Math.round(overallCompleteness * 1000) / 1000,
    lastUpdated: new Date().toISOString(),
    sources,
  };
}

/**
 * Compute scores for all countries.
 *
 * Merges indicators from all sources, scores each country from the
 * COUNTRIES list plus any additional iso3 codes found in the data.
 * Results are sorted by iso3.
 */
export function computeAllScores(
  rawDataBySource: Map<string, RawSourceData>,
  weightsConfig: WeightsConfig,
): ScoredCountry[] {
  // Merge all indicators
  const allIndicators: RawIndicator[] = [];
  for (const sourceData of rawDataBySource.values()) {
    allIndicators.push(...sourceData.indicators);
  }

  // Collect unique iso3 codes from data + COUNTRIES list
  const iso3Set = new Set<string>();
  for (const country of COUNTRIES) {
    iso3Set.add(country.iso3);
  }
  for (const ind of allIndicators) {
    iso3Set.add(ind.countryIso3.toUpperCase());
  }

  // Score each country
  const results: ScoredCountry[] = [];
  for (const iso3 of iso3Set) {
    const entry = getCountryByIso3(iso3);
    if (!entry) continue; // Skip unknown iso3 codes not in our country list

    const scored = computeCountryScore(iso3, allIndicators, weightsConfig, entry, {}, []);
    results.push(scored);
  }

  // Sort by iso3
  results.sort((a, b) => a.iso3.localeCompare(b.iso3));

  return results;
}
