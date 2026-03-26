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
 * Hybrid scoring strategy (v7.0):
 * 1. Per-pillar: baseline+signal tiered blending (unchanged)
 * 2. Composite: weighted GEOMETRIC mean of pillar scores (penalizes low outliers)
 * 3. Hard cap: if any government advisory is Level 4 "Do Not Travel" → score ≤ 2
 * 4. Critical floor: if any pillar score < CRITICAL_PILLAR_THRESHOLD → score ≤ minPillar * CRITICAL_FLOOR_MULTIPLIER * 9 + 1
 */

// Scoring strategy constants
const CRITICAL_PILLAR_THRESHOLD = 0.25; // pillar score (0-1) below which critical floor kicks in
const CRITICAL_FLOOR_MULTIPLIER = 1.5;  // max score = minPillar * this * 9 + 1
const ADVISORY_HARD_CAP_LEVEL = 4;      // advisory level that triggers hard cap
const ADVISORY_HARD_CAP_MAJORITY = true; // require majority of advisory sources at Level 4
const ADVISORY_HARD_CAP_BASE = 2;       // base hard cap score
const GEOMETRIC_MEAN_FLOOR = 0.01;      // floor for pillar scores in geometric mean (avoid log(0))
const LOW_DATA_THRESHOLD = 0.3;         // overall dataCompleteness below which advisory blending kicks in
export function computeCountryScore(
  iso3: string,
  allIndicators: RawIndicator[],
  weightsConfig: WeightsConfig,
  countryEntry: CountryEntry,
  advisories: { us?: AdvisoryInfo; uk?: AdvisoryInfo; ca?: AdvisoryInfo; au?: AdvisoryInfo; de?: AdvisoryInfo; nl?: AdvisoryInfo; jp?: AdvisoryInfo; sk?: AdvisoryInfo; fr?: AdvisoryInfo; nz?: AdvisoryInfo; ie?: AdvisoryInfo; fi?: AdvisoryInfo; hk?: AdvisoryInfo; br?: AdvisoryInfo; at?: AdvisoryInfo; ph?: AdvisoryInfo; be?: AdvisoryInfo; dk?: AdvisoryInfo; sg?: AdvisoryInfo; ro?: AdvisoryInfo; rs?: AdvisoryInfo; ee?: AdvisoryInfo; hr?: AdvisoryInfo; ar?: AdvisoryInfo },
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

  // --- Advisory analysis (used in multiple steps below) ---
  const advisoryLevels = [
    advisories.us?.level, advisories.uk?.level,
    advisories.ca?.level, advisories.au?.level,
    advisories.de?.level, advisories.nl?.level,
    advisories.jp?.level, advisories.sk?.level,
    advisories.fr?.level, advisories.nz?.level,
    advisories.ie?.level, advisories.fi?.level,
    advisories.hk?.level, advisories.br?.level,
    advisories.at?.level, advisories.ph?.level,
    advisories.be?.level, advisories.dk?.level,
    advisories.sg?.level, advisories.ro?.level,
    advisories.rs?.level, advisories.ee?.level,
    advisories.hr?.level, advisories.ar?.level,
  ].filter((l): l is number | string => l !== undefined)
   .map((l) => typeof l === 'string' ? parseFloat(l) : l)
   .filter((l) => !isNaN(l));

  const advisoryAvg = advisoryLevels.length > 0
    ? advisoryLevels.reduce((a, b) => a + b, 0) / advisoryLevels.length
    : null;

  // Advisory-derived score (0-1): maps avg advisory 1→0.9, 2→0.6, 3→0.35, 4→0.1
  const advisoryScore = advisoryAvg !== null
    ? Math.max(0.05, 1.0 - (advisoryAvg - 1) * 0.3)
    : null;

  // --- Composite score: weighted geometric mean ---
  const totalWeight = pillars.reduce((acc, p) => acc + p.weight, 0);
  const weightedLogSum = pillars.reduce((acc, p) => {
    const clampedScore = Math.max(GEOMETRIC_MEAN_FLOOR, p.score);
    return acc + p.weight * Math.log(clampedScore);
  }, 0);
  let compositeScore = Math.exp(weightedLogSum / totalWeight);

  // --- Fix 2+3: blend with advisory score when data is sparse ---
  const overallCompleteness =
    pillars.length > 0
      ? pillars.reduce((acc, p) => acc + p.dataCompleteness, 0) / pillars.length
      : 0;

  if (overallCompleteness < LOW_DATA_THRESHOLD && advisoryScore !== null) {
    // The less data we have, the more we trust advisories
    // At dc=0: 100% advisory. At dc=LOW_DATA_THRESHOLD: 0% advisory.
    const advisoryBlend = 1 - (overallCompleteness / LOW_DATA_THRESHOLD);
    compositeScore = compositeScore * (1 - advisoryBlend) + advisoryScore * advisoryBlend;
  }

  // --- Critical floor: if any pillar with real data is below threshold ---
  const pillarsWithData = pillars.filter((p) => p.dataCompleteness > 0);
  if (pillarsWithData.length > 0) {
    const minPillarScore = Math.min(...pillarsWithData.map((p) => p.score));
    if (minPillarScore < CRITICAL_PILLAR_THRESHOLD) {
      const criticalCap = minPillarScore * CRITICAL_FLOOR_MULTIPLIER;
      compositeScore = Math.min(compositeScore, criticalCap);
    }
  }

  // Map to 1-10 scale
  let score = compositeScore * 9 + 1;

  // --- Fix 1+4: advisory hard cap requires consensus (2+ sources) and varies by min pillar ---
  const level4Count = advisoryLevels.filter((l) => l >= ADVISORY_HARD_CAP_LEVEL).length;
  const majorityThreshold = Math.ceil(advisoryLevels.length / 2 + 0.1); // >50%: 2/3, 3/4, 2/2
  if (level4Count >= majorityThreshold && advisoryLevels.length > 0) {
    // Variable cap: worse countries get lower cap based on their min pillar score
    // Base cap = 2, but if min pillar is very low, cap is lower (down to 1)
    const minPillar = pillarsWithData.length > 0
      ? Math.min(...pillarsWithData.map((p) => p.score))
      : 0.1;
    const variableCap = ADVISORY_HARD_CAP_BASE + (minPillar - 0.1) * 2; // range ~1.0 to ~2.8
    const hardCap = Math.max(1, Math.min(ADVISORY_HARD_CAP_BASE + 1, variableCap));
    score = Math.min(score, hardCap);
  }

  const scoreDisplay = Math.round(score);

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
  advisory_level_de: 'advisories_de',
  advisory_level_nl: 'advisories_nl',
  advisory_level_jp: 'advisories_jp',
  advisory_level_sk: 'advisories_sk',
  advisory_level_fr: 'advisories_fr',
  advisory_level_nz: 'advisories_nz',
  advisory_level_ie: 'advisories_ie',
  advisory_level_fi: 'advisories_fi',
  advisory_level_hk: 'advisories_hk',
  advisory_level_br: 'advisories_br',
  advisory_level_at: 'advisories_at',
  advisory_level_ph: 'advisories_ph',
  // Tier 2b
  advisory_level_be: 'advisories_be',
  advisory_level_dk: 'advisories_dk',
  advisory_level_sg: 'advisories_sg',
  advisory_level_ro: 'advisories_ro',
  advisory_level_rs: 'advisories_rs',
  advisory_level_ee: 'advisories_ee',
  advisory_level_hr: 'advisories_hr',
  advisory_level_ar: 'advisories_ar',
  reliefweb_active_disasters: 'reliefweb',
  gdacs_disaster_alerts: 'gdacs',
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
    description: 'Travel advisories from US, UK, Canada, Australia, Germany, Netherlands, Japan, Slovakia, France, New Zealand, Ireland, Finland, Hong Kong, Brazil, Austria, Philippines, Belgium, Denmark, Singapore, Romania, Serbia, Estonia, Croatia, and Argentina',
  },
  gpi: {
    url: 'https://www.visionofhumanity.org/maps/',
    description: 'Global Peace Index -- annual peacefulness ranking by IEP',
  },
  inform: {
    url: 'https://drmkc.jrc.ec.europa.eu/inform-index',
    description: 'INFORM Risk Index -- hazard, exposure, vulnerability, and coping capacity',
  },
  reliefweb: {
    url: 'https://reliefweb.int/',
    description: 'ReliefWeb -- humanitarian situation reports and disaster alerts',
  },
  gdacs: {
    url: 'https://www.gdacs.org/',
    description: 'Global Disaster Alerting Coordination System -- natural disaster alerts',
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
  type AdvisoryInfoMap = Record<string, { us?: AdvisoryInfo; uk?: AdvisoryInfo; ca?: AdvisoryInfo; au?: AdvisoryInfo; de?: AdvisoryInfo; nl?: AdvisoryInfo; jp?: AdvisoryInfo; sk?: AdvisoryInfo; fr?: AdvisoryInfo; nz?: AdvisoryInfo; ie?: AdvisoryInfo; fi?: AdvisoryInfo; hk?: AdvisoryInfo; br?: AdvisoryInfo; at?: AdvisoryInfo; ph?: AdvisoryInfo; be?: AdvisoryInfo; dk?: AdvisoryInfo; sg?: AdvisoryInfo; ro?: AdvisoryInfo; rs?: AdvisoryInfo; ee?: AdvisoryInfo; hr?: AdvisoryInfo; ar?: AdvisoryInfo; it?: AdvisoryInfo; es?: AdvisoryInfo; kr?: AdvisoryInfo; tw?: AdvisoryInfo; cn?: AdvisoryInfo; in?: AdvisoryInfo }>;
  let advisoryInfoMap: AdvisoryInfoMap = {};

  // Find advisories-info.json from the raw data directory
  // IMPORTANT: only use advisory info from the SAME date's raw directory.
  // Never fall back to a different date — applying modern advisories
  // (e.g. Level 4 "Do Not Travel") to historical dates would be incorrect.
  // Determine the data date from any available advisory source
  const advisoriesSource = rawDataBySource.get('advisories');
  const tier1Source = rawDataBySource.get('advisories_tier1');
  const tier2aSource = rawDataBySource.get('advisories_tier2a');
  const tier2bSource = rawDataBySource.get('advisories_tier2b');
  const tier3aSource = rawDataBySource.get('advisories_tier3a');
  const anyAdvisorySource = advisoriesSource || tier1Source || tier2aSource || tier2bSource || tier3aSource;

  if (anyAdvisorySource) {
    const dateMatch = anyAdvisorySource.fetchedAt.match(/^(\d{4}-\d{2}-\d{2})/);
    const dataDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

    // Load base advisories-info.json
    const advisoryInfoPath = join(process.cwd(), 'data', 'raw', dataDate, 'advisories-info.json');
    const loaded = readJson<AdvisoryInfoMap>(advisoryInfoPath);
    if (loaded) {
      advisoryInfoMap = loaded;
      console.log(`  Loaded advisory info for ${Object.keys(advisoryInfoMap).length} countries`);
    } else {
      console.log(`  No advisories-info.json for ${dataDate} — advisory hard caps will not apply`);
    }

    // Also load tier-1 advisory info
    const tier1InfoPath = join(process.cwd(), 'data', 'raw', dataDate, 'advisories-tier1-info.json');
    const tier1Info = readJson<AdvisoryInfoMap>(tier1InfoPath);
    if (tier1Info) {
      for (const [iso3, info] of Object.entries(tier1Info)) {
        if (!advisoryInfoMap[iso3]) advisoryInfoMap[iso3] = {};
        Object.assign(advisoryInfoMap[iso3], info);
      }
      console.log(`  Merged tier-1 advisory info`);
    }

    // Also load tier-2a advisory info
    const tier2aInfoPath = join(process.cwd(), 'data', 'raw', dataDate, 'advisories-tier2a-info.json');
    const tier2aInfo = readJson<AdvisoryInfoMap>(tier2aInfoPath);
    if (tier2aInfo) {
      for (const [iso3, info] of Object.entries(tier2aInfo)) {
        if (!advisoryInfoMap[iso3]) advisoryInfoMap[iso3] = {};
        Object.assign(advisoryInfoMap[iso3], info);
      }
      console.log(`  Merged tier-2a advisory info`);
    }

    // Also load tier-2b advisory info
    const tier2bInfoPath = join(process.cwd(), 'data', 'raw', dataDate, 'advisories-tier2b-info.json');
    const tier2bInfo = readJson<AdvisoryInfoMap>(tier2bInfoPath);
    if (tier2bInfo) {
      for (const [iso3, info] of Object.entries(tier2bInfo)) {
        if (!advisoryInfoMap[iso3]) advisoryInfoMap[iso3] = {};
        Object.assign(advisoryInfoMap[iso3], info);
      }
      console.log(`  Merged tier-2b advisory info`);
    }

    // Also load tier-3a advisory info
    const tier3aInfoPath = join(process.cwd(), 'data', 'raw', dataDate, 'advisories-tier3a-info.json');
    const tier3aInfo = readJson<AdvisoryInfoMap>(tier3aInfoPath);
    if (tier3aInfo) {
      for (const [iso3, info] of Object.entries(tier3aInfo)) {
        if (!advisoryInfoMap[iso3]) advisoryInfoMap[iso3] = {};
        Object.assign(advisoryInfoMap[iso3], info);
      }
      console.log(`  Merged tier-3a advisory info`);
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
