// --- Source tier types ---
export type SourceTier = 'baseline' | 'signal';

export interface SourceConfig {
  tier: SourceTier;
  maxAgeDays: number;
  decayHalfLifeDays: number;
}

export interface SourcesConfig {
  maxSignalInfluence: number;
  maxDailyScoreChange: number;
  sources: Record<string, SourceConfig>;
}

// --- Raw data types ---
export interface FetchResult {
  source: string;
  success: boolean;
  countriesFound: number;
  error?: string;
  fetchedAt: string; // ISO 8601
}

export interface RawIndicator {
  countryIso3: string;
  indicatorName: string;
  value: number;
  year: number;
  source: string;
  fetchedAt?: string;  // ISO 8601 when data was fetched
  dataDate?: string;   // ISO 8601 when underlying data was published
}

export interface RawSourceData {
  source: string;
  fetchedAt: string;
  indicators: RawIndicator[];
}

// --- Scoring config ---
export type PillarName = 'conflict' | 'crime' | 'health' | 'governance' | 'environment';

export interface PillarWeight {
  name: PillarName;
  weight: number;
  indicators: string[];
  indicatorWeights?: Record<string, number>;  // Per-indicator sub-weight (must sum to 1.0 within pillar)
  /**
   * Formula v9: per-indicator precision (rho) — evidence weight contributed to the
   * pillar's n_i when the indicator is present. rho=0 means "value contributes,
   * confidence does not" (reliefweb/gdacs). The synthetic advisory-consensus
   * indicator "A" (conflict pillar) has its precision computed per-country
   * (rho_A = nAdv/(nAdv+rhoADenom)) and is intentionally absent from this map.
   */
  indicatorPrecision?: Record<string, number>;
}

/**
 * Formula v9 (Bayesian synthesis) tunable constants + frozen tables. See
 * SHIP-SPEC.md sections 1.1/1.2 and scripts/../prototype-scorer.mjs DEFAULT_CONST /
 * ADVISORY_TIER / FROZEN_EXCLUDED_SOURCES / ADVISORY_REBASE / REGION_OFFSET — the
 * values here MUST equal the frozen prototype exactly (ported, not re-tuned).
 */
export interface FormulaV9Config {
  K: number;              // shrinkage strength
  lambda: number;         // acute-term blend weight
  q: number;               // acute soft-min power-mean exponent
  gamma: number;           // concave 1-10 calibration lift
  S_MAX: number;           // bounded severe-advisory modifier ceiling
  N_SEV: number;           // severe-modifier count damping denominator offset
  muBase: number;          // conservative prior base
  muClampMin: number;
  muClampMax: number;
  nudgeScale: number;      // coefficient on (A-0.5) in the prior's advisory nudge
  nudgeDenom: number;      // nAdv/(nAdv+nudgeDenom) confidence-weighting of the nudge
  rhoADenom: number;       // rho_A = nAdv/(nAdv+rhoADenom)
  floorP: number;          // floor inside ln(max(floorP, phat)) and acute mean
  acuteDownOnly: number;   // 1 => cap acute at G so it only drags the score down, never inflates
  /** government code (lowercase, e.g. "us") -> importance tier (4=highest .. 1=lowest) */
  advisoryTiers: Record<string, number>;
  /** government codes NEVER entering A/severeShare/nAdv (broken parser or zero-variance) */
  frozenExcludedSources: string[];
  /** government codes rebased L -> max(1, L-1) because they never emit Level 1 */
  advisoryRebase: string[];
  /** region name -> conservative-prior offset */
  regionOffset: Record<string, number>;
}

export interface WeightsConfig {
  version: string;
  pillars: PillarWeight[];
  /** Formula v9 constants (weights.json v9.0.0+). Absent in older/synthetic test configs. */
  formulaV9?: FormulaV9Config;
}

// --- Scored output ---
export interface IndicatorScore {
  name: string;
  rawValue: number;
  normalizedValue: number; // 0-1
  source: string;
  year: number;
}

export interface PillarScore {
  name: PillarName;
  score: number; // 0-1
  weight: number;
  indicators: IndicatorScore[];
  dataCompleteness: number; // 0-1 percentage of available indicators
}

export interface AdvisoryInfo {
  level: number | string;
  text: string;
  source: string;
  url: string;
  updatedAt: string;
}

export interface ScoredCountry {
  iso3: string;
  name: { en: string; it: string; es: string; fr: string; pt: string };
  score: number; // 1-10, one decimal
  scoreDisplay: number; // 1-10 integer
  pillars: PillarScore[];
  advisories: {
    us?: AdvisoryInfo;
    uk?: AdvisoryInfo;
    ca?: AdvisoryInfo;
    au?: AdvisoryInfo;
    de?: AdvisoryInfo;
    nl?: AdvisoryInfo;
    jp?: AdvisoryInfo;
    sk?: AdvisoryInfo;
    // Tier 2a
    fr?: AdvisoryInfo;
    nz?: AdvisoryInfo;
    ie?: AdvisoryInfo;
    fi?: AdvisoryInfo;
    hk?: AdvisoryInfo;
    br?: AdvisoryInfo;
    at?: AdvisoryInfo;
    ph?: AdvisoryInfo;
    // Tier 2b
    be?: AdvisoryInfo;
    dk?: AdvisoryInfo;
    sg?: AdvisoryInfo;
    ro?: AdvisoryInfo;
    rs?: AdvisoryInfo;
    ee?: AdvisoryInfo;
    hr?: AdvisoryInfo;
    ar?: AdvisoryInfo;
    // Tier 3a
    it?: AdvisoryInfo;
    es?: AdvisoryInfo;
    kr?: AdvisoryInfo;
    tw?: AdvisoryInfo;
    cn?: AdvisoryInfo;
    in?: AdvisoryInfo;
    // Tier 3b
    ch?: AdvisoryInfo;
    se?: AdvisoryInfo;
    no?: AdvisoryInfo;
    pl?: AdvisoryInfo;
    cz?: AdvisoryInfo;
    hu?: AdvisoryInfo;
    pt?: AdvisoryInfo;
  };
  dataCompleteness: number; // 0-1 overall
  /**
   * Formula v9: confidence = sum_i w_i * n_i/(n_i+K) — how much of the composite
   * score is grounded in actual evidence vs. the conservative prior. 0 = fully
   * prior-driven (no data), approaches 1 as precision n_i grows per pillar.
   */
  confidence: number;
  lastUpdated: string; // ISO 8601
  sources: SourceMeta[];
}

export interface SourceMeta {
  name: string;
  url: string;
  fetchedAt: string;
  description: string;
}

// --- Country mapping ---
export interface CountryEntry {
  iso3: string;
  iso2: string;
  name: { en: string; it: string; es: string; fr: string; pt: string };
}

// --- Daily snapshot ---
export interface DailySnapshot {
  date: string; // YYYY-MM-DD
  generatedAt: string; // ISO 8601
  pipelineVersion: string;
  weightsVersion: string;
  globalScore: number; // arithmetic mean of all countries[].score, rounded to 1 decimal
  countries: ScoredCountry[];
  fetchResults: FetchResult[];
}

// --- Sentiment (display-only, NOT a scoring pillar) ---
// IMPORTANT: These types are structurally independent of PillarName / PillarScore /
// ScoredCountry.pillars. They must NEVER be added to the closed PillarName union or
// appended to ScoredCountry.pillars — doing so would silently feed sentiment into
// computeAllScores's weighted geometric mean (violates D-06). See 39-PATTERNS.md.
export interface VoteRow {
  iso3: string;
  delta: number; // -2..+2
  created_at: number; // unix epoch seconds
}

export interface SentimentEntry {
  iso3: string;
  count: number; // total votes considered
  avgDelta: number; // recency-weighted mean of deltas (unclamped, for transparency)
  correction: number; // clamp(avgDelta * SCALE, -CAP, +CAP), score points
  perceived: number; // clamp(official + correction, 1, 10)
  official: number; // official score used at aggregation time
}

export interface SentimentSnapshot {
  generatedAt: string; // ISO 8601
  countries: Record<string, SentimentEntry>; // keyed by ISO3, only countries with >= SENTIMENT_MIN_VOTES votes
}
