import { normalizeIndicators } from './normalize.js';
import { freshnessWeight } from './freshness.js';
import { COUNTRIES, getCountryByIso3 } from '../config/countries.js';
import { readJson, findLatestCached } from '../utils/fs.js';
import { join } from 'node:path';
import type {
  RawIndicator,
  WeightsConfig,
  CountryEntry,
  AdvisoryInfo,
  SourceMeta,
  PillarScore,
  PillarWeight,
  ScoredCountry,
  RawSourceData,
  PillarName,
  SourcesConfig,
  IndicatorScore,
} from '../types.js';

/**
 * Compute safety score for a single country.
 *
 * When sourcesConfig is provided, uses tiered baseline+signal blending
 * with freshness decay and per-indicator sub-weights.
 * When sourcesConfig is omitted, falls back to legacy equal-averaging behavior.
 *
 * Logic (tiered mode):
 * - Filter & normalize indicators for this country
 * - For each pillar: separate indicators into baseline and signal tiers
 * - Apply freshness decay weights and per-indicator sub-weights
 * - Blend tiers: pillarScore = baseline * (1 - effectiveSignalInfluence) + signal * effectiveSignalInfluence
 * - effectiveSignalInfluence = maxSignalInfluence * signalCompleteness
 * - Composite = weighted sum of pillar scores, mapped to 1-10 scale
 */
export function computeCountryScore(
  iso3: string,
  allIndicators: RawIndicator[],
  weightsConfig: WeightsConfig,
  countryEntry: CountryEntry,
  advisories: { us?: AdvisoryInfo; uk?: AdvisoryInfo; ca?: AdvisoryInfo; au?: AdvisoryInfo },
  sources: SourceMeta[],
  sourcesConfig?: SourcesConfig,
): ScoredCountry {
  const countryIndicators = allIndicators.filter(
    (ind) => ind.countryIso3.toUpperCase() === iso3.toUpperCase(),
  );

  // Normalize all indicators for this country at once
  const normalizedAll = normalizeIndicators(countryIndicators);

  // Build a lookup from indicator name -> raw indicator (for freshness data)
  const rawByName = new Map<string, RawIndicator>();
  for (const ind of countryIndicators) {
    rawByName.set(ind.indicatorName, ind);
  }

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
    } else if (!sourcesConfig) {
      // Legacy path: simple equal-weight averaging (backward compatible)
      const sum = pillarIndicators.reduce((acc, ind) => acc + ind.normalizedValue, 0);
      score = sum / foundCount;
    } else {
      // Tiered path: baseline+signal blending with freshness and sub-weights
      score = computeTieredPillarScore(pillarDef, pillarIndicators, rawByName, sourcesConfig);
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
 * Map indicator names to their source name for tier classification.
 * This is used to determine expected signal count from config, not from
 * available data, preventing score spikes when a fetch temporarily fails.
 */
const INDICATOR_SOURCE_MAP: Record<string, string> = {
  wb_political_stability: 'worldbank',
  wb_rule_of_law: 'worldbank',
  wb_gov_effectiveness: 'worldbank',
  wb_corruption_control: 'worldbank',
  wb_child_mortality: 'worldbank',
  wb_air_pollution: 'worldbank',
  gpi_overall: 'gpi',
  gpi_safety_security: 'gpi',
  gpi_militarisation: 'gpi',
  inform_natural: 'inform',
  inform_health: 'inform',
  inform_epidemic: 'inform',
  inform_governance: 'inform',
  inform_climate: 'inform',
  advisory_level_us: 'advisories_us',
  advisory_level_uk: 'advisories_uk',
  advisory_level_ca: 'advisories_ca',
  advisory_level_au: 'advisories_au',
  gdelt_instability: 'gdelt',
  reliefweb_active_disasters: 'reliefweb',
  gdacs_disaster_alerts: 'gdacs',
  who_active_outbreaks: 'who-dons',
};

function indicatorToSource(indicatorName: string): string | undefined {
  return INDICATOR_SOURCE_MAP[indicatorName];
}

/**
 * Compute a tiered pillar score using baseline+signal blending.
 *
 * For each indicator:
 * 1. Determine tier (baseline/signal) from sourcesConfig
 * 2. Compute freshness weight from data age
 * 3. Apply per-indicator sub-weight (from indicatorWeights or equal fallback)
 * 4. Weighted average within each tier
 * 5. Blend tiers based on signal completeness
 */
function computeTieredPillarScore(
  pillarDef: PillarWeight,
  pillarIndicators: IndicatorScore[],
  rawByName: Map<string, RawIndicator>,
  sourcesConfig: SourcesConfig,
): number {
  const now = Date.now();

  // Count expected signal indicators for this pillar based on config, not available data.
  // This prevents score spikes when a signal source fetch fails temporarily.
  const expectedSignalCount = pillarDef.indicators.filter((indName) => {
    const sourceName = indicatorToSource(indName);
    if (!sourceName) return false;
    const sourceConf = sourcesConfig.sources[sourceName];
    return sourceConf?.tier === 'signal';
  }).length;

  // Separate into baseline and signal with weighted values
  let baselineWeightedSum = 0;
  let baselineWeightTotal = 0;
  let signalWeightedSum = 0;
  let signalWeightTotal = 0;
  let signalFoundCount = 0;

  for (const ind of pillarIndicators) {
    const raw = rawByName.get(ind.name);
    const sourceName = raw?.source ?? ind.source;

    // Determine tier (default to baseline for unknown sources)
    const sourceConf = sourcesConfig.sources[sourceName];
    const tier = sourceConf?.tier ?? 'baseline';

    // Compute freshness weight
    let fw = 1.0; // default: no timestamp = treat as fresh (backward compat)
    if (sourceConf && raw) {
      const dateStr = raw.dataDate ?? raw.fetchedAt;
      if (dateStr) {
        const ageMs = now - new Date(dateStr).getTime();
        fw = freshnessWeight(ageMs, sourceConf.decayHalfLifeDays, sourceConf.maxAgeDays);
      }
    }

    // Per-indicator sub-weight (fall back to equal weights)
    const subWeight = pillarDef.indicatorWeights?.[ind.name]
      ?? (1.0 / pillarDef.indicators.length);

    const effectiveWeight = subWeight * fw;

    if (tier === 'signal') {
      signalWeightedSum += ind.normalizedValue * effectiveWeight;
      signalWeightTotal += effectiveWeight;
      signalFoundCount++;
    } else {
      baselineWeightedSum += ind.normalizedValue * effectiveWeight;
      baselineWeightTotal += effectiveWeight;
    }
  }

  // Compute tier scores (weighted averages)
  const baselineScore = baselineWeightTotal > 0
    ? baselineWeightedSum / baselineWeightTotal
    : 0.5; // neutral if no baseline data

  const signalScore = signalWeightTotal > 0
    ? signalWeightedSum / signalWeightTotal
    : 0.5; // neutral if no signal data (won't matter due to completeness=0)

  // Signal completeness: how many of the expected signal indicators are present
  const signalCompleteness = expectedSignalCount > 0
    ? Math.min(1, signalFoundCount / expectedSignalCount)
    : 0;

  // Effective signal influence: capped by maxSignalInfluence, scaled by completeness
  const effectiveSignalInfluence = sourcesConfig.maxSignalInfluence * signalCompleteness;

  // Blend: when no signal data, effectiveSignalInfluence=0 => pure baseline
  return baselineScore * (1 - effectiveSignalInfluence) + signalScore * effectiveSignalInfluence;
}

/** Metadata for known data sources used in scoring. */
const SOURCE_CATALOG: Record<string, { url: string; description: string }> = {
  worldbank: {
    url: 'https://data.worldbank.org/',
    description: 'World Bank Development Indicators -- governance, health, and environment data',
  },
  advisories: {
    url: 'https://travel.state.gov/',
    description: 'Travel advisories from US State Department, UK FCDO, Government of Canada, and Australian Government',
  },
  gpi: {
    url: 'https://www.visionofhumanity.org/maps/',
    description: 'Global Peace Index -- annual peacefulness ranking by IEP',
  },
  inform: {
    url: 'https://drmkc.jrc.ec.europa.eu/inform-index',
    description: 'INFORM Risk Index -- hazard, exposure, vulnerability, and coping capacity',
  },
  gdelt: {
    url: 'https://www.gdeltproject.org/',
    description: 'Global Database of Events, Language, and Tone -- media-derived event monitoring',
  },
  reliefweb: {
    url: 'https://reliefweb.int/',
    description: 'ReliefWeb -- humanitarian situation reports and disaster alerts',
  },
  gdacs: {
    url: 'https://www.gdacs.org/',
    description: 'Global Disaster Alerting Coordination System -- natural disaster alerts',
  },
  'who-dons': {
    url: 'https://www.who.int/emergencies/disease-outbreak-news',
    description: 'WHO Disease Outbreak News -- disease outbreak alerts and updates',
  },
};

/**
 * Build SourceMeta[] for a given country from the raw data map.
 * Only includes sources that actually have indicators for this country.
 */
function buildSourcesForCountry(
  iso3: string,
  rawDataBySource: Map<string, RawSourceData>,
): SourceMeta[] {
  const sources: SourceMeta[] = [];
  const upperIso3 = iso3.toUpperCase();

  for (const [, sourceData] of rawDataBySource) {
    const hasDataForCountry = sourceData.indicators.some(
      (ind) => ind.countryIso3.toUpperCase() === upperIso3,
    );
    if (hasDataForCountry) {
      const catalog = SOURCE_CATALOG[sourceData.source] ?? {
        url: '',
        description: sourceData.source,
      };
      sources.push({
        name: sourceData.source,
        url: catalog.url,
        fetchedAt: sourceData.fetchedAt,
        description: catalog.description,
      });
    }
  }

  return sources;
}

/**
 * Compute scores for all countries.
 *
 * Merges indicators from all sources, scores each country from the
 * COUNTRIES list plus any additional iso3 codes found in the data.
 * Results are sorted by iso3.
 *
 * Automatically loads source-tiers.json for tiered scoring.
 * If the config file is missing, falls back to legacy equal-averaging.
 */
export function computeAllScores(
  rawDataBySource: Map<string, RawSourceData>,
  weightsConfig: WeightsConfig,
): ScoredCountry[] {
  // Load sources tier config (optional -- graceful fallback to legacy mode)
  const sourceTiersPath = join(process.cwd(), 'src/pipeline/config/source-tiers.json');
  const sourcesConfig = readJson<SourcesConfig>(sourceTiersPath) ?? undefined;

  if (sourcesConfig) {
    console.log('  Tiered scoring: loaded source-tiers.json (maxSignalInfluence=%d%%)',
      Math.round(sourcesConfig.maxSignalInfluence * 100));
  } else {
    console.log('  Legacy scoring: source-tiers.json not found, using equal-weight averaging');
  }

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

  // Load advisory info from side-channel file
  type AdvisoryInfoMap = Record<string, { us?: AdvisoryInfo; uk?: AdvisoryInfo; ca?: AdvisoryInfo; au?: AdvisoryInfo }>;
  let advisoryInfoMap: AdvisoryInfoMap = {};

  // Find advisories-info.json from the raw data directory
  // Derive path from the advisories source data
  const advisoriesSource = rawDataBySource.get('advisories');
  if (advisoriesSource) {
    // The fetchedAt timestamp tells us the date — but we need the rawDir path
    // Try to find it by looking at the indicators' source to derive the date
    const dateMatch = advisoriesSource.fetchedAt.match(/^(\d{4}-\d{2}-\d{2})/);
    const today = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
    const advisoryInfoPath = join(process.cwd(), 'data', 'raw', today, 'advisories-info.json');
    const loaded = readJson<AdvisoryInfoMap>(advisoryInfoPath);
    if (loaded) {
      advisoryInfoMap = loaded;
      console.log(`  Loaded advisory info for ${Object.keys(advisoryInfoMap).length} countries`);
    } else {
      // Try to find most recent cached advisory info file
      const cachedPath = findLatestCached('advisories-info.json');
      if (cachedPath) {
        const info = readJson<AdvisoryInfoMap>(cachedPath);
        if (info) {
          advisoryInfoMap = info;
          console.log(`  Loaded advisory info from cache: ${cachedPath}`);
        }
      }
    }
  }

  // Score each country
  const results: ScoredCountry[] = [];
  for (const iso3 of iso3Set) {
    const entry = getCountryByIso3(iso3);
    if (!entry) continue; // Skip unknown iso3 codes not in our country list

    const sources = buildSourcesForCountry(iso3, rawDataBySource);
    const countryAdvisories = advisoryInfoMap[iso3] || {};
    const scored = computeCountryScore(iso3, allIndicators, weightsConfig, entry, countryAdvisories, sources, sourcesConfig);
    results.push(scored);
  }

  // Log tier contribution summary
  if (sourcesConfig) {
    let baselineContribCount = 0;
    let signalContribCount = 0;
    for (const ind of allIndicators) {
      const sourceConf = sourcesConfig.sources[ind.source];
      if (sourceConf?.tier === 'signal') {
        signalContribCount++;
      } else {
        baselineContribCount++;
      }
    }
    const total = baselineContribCount + signalContribCount;
    if (total > 0) {
      const baselinePct = Math.round((baselineContribCount / total) * 100);
      const signalPct = Math.round((signalContribCount / total) * 100);
      console.log(`  Baseline contribution: ${baselinePct}%, Signal contribution: ${signalPct}%`);
    }
  }

  // Sort by iso3
  results.sort((a, b) => a.iso3.localeCompare(b.iso3));

  return results;
}
