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
  /**
   * v9.1 (D2): ucdp_conflict_deaths log-decay normalization knee. norm(d) =
   * clamp(1 - log10(1+d)/log10(1+D_MAX), 0, 1) — see normalize.ts. MUST stay in
   * sync with normalize.ts's own D_MAX module const (same discipline as
   * MIN_RANKING_SOURCES per CLAUDE.md).
   */
  D_MAX: number;
  /**
   * v9.1 (round-2 F1): population half-saturation constant for wb_homicide's
   * precision — rho_hom_eff = crimeRho_hom * pop/(pop+P_HALF). A country whose
   * population equals P_HALF keeps half its homicide evidence weight.
   */
  P_HALF: number;
  /** v9.1 (D4): rampFactor(nAdv, minNAdv, width) gate on the prior's advisory-nudge term. */
  nudgeMinNAdv: number;
  /** v9.1 (D4): rampFactor(nAdv, minNAdv, width) gate on severeEff. */
  severeMinNAdv: number;
  /** v9.1 (D4): shared ramp width for both nudgeMinNAdv and severeMinNAdv gates. */
  gateRampWidth: number;
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
  /**
   * Formula v10 (SPEC §1.2): a non-advisory indicator whose data `year` is older than
   * (run year - maxAgeYears) is treated as missing, before pillar computation AND before
   * source counting. Absent (pre-v10 / synthetic configs) = no age filter.
   */
  maxAgeYears?: number;
  /**
   * Formula v10 (SPEC §4): a country with fewer distinct sources than this (after the
   * max-age filter, counted like hasSufficientData) is `insufficient_data` unless the
   * danger guard holds. Absent (pre-v10 / synthetic configs) = every country is scored.
   */
  minSources?: number;
  /**
   * Formula v10 (SPEC §3): per-pillar scale continuity, frozen on the switch date. For each
   * listed pillar the final (shrunk) pillar value is mapped p' = clamp(alpha + beta * p,
   * 0.001, 1) before aggregation, so a pillar whose indicators changed keeps the mean and
   * spread it had in v9.1 (pillar weights only mean something relative to pillar scales).
   * Pillars not listed are used as computed. Absent = no mapping (v9.1 behaviour).
   */
  pillarCalibration?: Partial<Record<PillarName, CalibrationConfig>>;
  /** Formula v10 (SPEC §5): bounded community adjustment. Absent = no community component. */
  community?: CommunityConfig;
}

/** Formula v10 (SPEC §3) frozen per-pillar map p' = clamp(alpha + beta * p, 0.001, 1). */
export interface CalibrationConfig {
  alpha: number;
  beta: number;
}

/** Formula v10 (SPEC §5) community parameters. */
export interface CommunityConfig {
  /** Shrinkage constant: Z = nEff / (nEff + k). */
  k: number;
  /** Largest adjustment in score points, applied symmetrically (+/- cap). */
  cap: number;
  /** Activation floor: votes in the window. */
  minVotes: number;
  /** Activation floor: distinct known countries of origin. */
  minOrigins: number;
  /** Largest vote-weight share one origin may hold after the origin cap. */
  originCap: number;
}

export interface WeightsConfig {
  version: string;
  pillars: PillarWeight[];
  /**
   * Formula constants (weights.json v9.0.0+). The key stays `formulaV9` whatever the
   * formula version (v10 adds optional fields). Absent in older/synthetic test configs.
   */
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
  updatedAt?: string; // the government's real advisory date — absent when the source exposes none (never the fetch time)
  // Staleness transparency (SOURCE-REPAIR-BRIEF 2026-09-25): set ONLY when this value was not
  // fetched live today but restored from a per-source cache fallback (runWithFloor in
  // advisories.ts, or the equivalent tier1-3 fallbacks). Value = the last date this specific
  // source's data was genuinely fetched live, in YYYY-MM-DD — propagated forward unchanged on
  // every subsequent day the cache keeps getting re-used, so it always reflects the true origin
  // date rather than "yesterday". Absent/undefined = fetched live today. Internal-only for now,
  // like `confidence` elsewhere in this file — renderers must not assume it is user-facing yet.
  // NOTE: this exact field (name + type) may also be added by a parallel branch repairing the
  // tier1-3 fetchers restore path — keep it identical if merging.
  restoredFrom?: string;
}

/**
 * Formula v10 (SPEC §4): `insufficient_data` = fewer than minSources distinct sources
 * after the max-age filter and no danger-guard signal. Such a country has no official
 * score (score, scoreDisplay and dataScore are null); its pillars are kept for
 * transparency but must never be rendered as numbers.
 */
export type ScoreStatus = 'scored' | 'insufficient_data';

/**
 * Formula v10 (SPEC §5) community component, as applied by the engine. Always present.
 * `adjustment` is the number of points added to the data score (0 unless the community
 * is active AND the country has an official score). For a grey country with an active
 * community, `perceived` is the community rating to show separately, never as the score.
 */
export interface CommunityComponent {
  status: 'active' | 'insufficient';
  /** Usable votes in the 180-day window (0 when there is no sentiment entry). */
  votes: number;
  /** Distinct known countries of origin. */
  origins: number;
  /** P: weighted mean perceived score on the 1-10 scale, null without votes. */
  perceived: number | null;
  /** clamp(Z * (P - S_data), -cap, +cap) when applied, else 0. */
  adjustment: number;
}

export interface ScoredCountry {
  iso3: string;
  name: { en: string; it: string; es: string; fr: string; pt: string };
  /**
   * Official score 1-10 (full precision) = clamp(dataScore + community.adjustment, 1, 10).
   * null when scoreStatus is 'insufficient_data' (formula v10). Snapshots written
   * before v10 always carry a number.
   */
  score: number | null;
  /** Math.round(score); null when scoreStatus is 'insufficient_data'. */
  scoreDisplay: number | null;
  /** Formula v10. Absent on snapshots written before v10 (treat as 'scored'). */
  scoreStatus?: ScoreStatus;
  /** Formula v10: S_data, the data score (from the scale-mapped pillars) before the community adjustment; null when grey. */
  dataScore?: number | null;
  /** Formula v10 community component. Absent on snapshots written before v10. */
  community?: CommunityComponent;
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
  globalScore: number; // arithmetic mean of the non-null countries[].score, rounded to 2 decimals
  countries: ScoredCountry[];
  fetchResults: FetchResult[];
  // Data-revision marker (see pipeline/config/data-revision.ts). Missing on
  // every snapshot written before 2026-09-25 — treat as 1 (computeNews does).
  dataRevision?: number;
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
