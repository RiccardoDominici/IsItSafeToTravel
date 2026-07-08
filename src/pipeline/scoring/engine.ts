import { normalizeIndicators } from './normalize.js';
import { freshnessWeight } from './freshness.js';
import { COUNTRIES, getCountryByIso3 } from '../config/countries.js';
import { getRegion } from '../../lib/regions.js';
import { readJson } from '../utils/fs.js';
import { join } from 'node:path';
import type {
  RawIndicator,
  WeightsConfig,
  FormulaV9Config,
  PillarWeight,
  CountryEntry,
  AdvisoryInfo,
  SourceMeta,
  PillarScore,
  ScoredCountry,
  RawSourceData,
  PillarName,
  SourcesConfig,
  IndicatorScore,
} from '../types.js';

/**
 * Compute safety score for a single country — Formula v9 (Bayesian synthesis).
 *
 * Ported faithfully from the frozen reference implementation (prototype-scorer.mjs,
 * SHIP-SPEC.md section 1.1, quick-260706-x81). Mechanisms, in order:
 * 1. Advisory consensus (A, nAdv, severeShare, severeEff, rho_A) over the frozen
 *    excluded-source set, importance tiers, and at/nz rebase.
 * 2. Per-pillar value p_i (sub-weight-renormalized mean over present indicators)
 *    and precision n_i = sum(rho * freshnessWeight()) over present indicators.
 * 3. A conservative region-anchored prior mu, nudged by advisory consensus.
 * 4. Bayesian shrinkage p_hat_i = (n_i*p_i + K*mu)/(n_i+K) — NO eligibility gates,
 *    NO neutral-0.5 defaults, NO low-data advisory blend, NO critical floor, NO
 *    majority-L4 hard cap (all removed; v8.x mechanisms).
 * 5. Weighted geometric mean G across all 5 shrunk pillars + a down-only acute
 *    soft-min term (conflict/crime) + a count-damped severe-advisory modifier.
 * 6. Concave 1-10 calibration: score = 1 + 9*composite^gamma.
 * 7. confidence = sum w_i * n_i/(n_i+K) (NEW output field).
 *
 * All formula constants live in weightsConfig.formulaV9 (single source of truth);
 * their VALUES are frozen and must equal the prototype exactly — see
 * DEFAULT_FORMULA_V9 below for the same defaults, used only when a (synthetic/
 * legacy) WeightsConfig omits the formulaV9 section.
 */

/**
 * Legacy v8.x pillar-coverage constants. NO LONGER used by computeCountryScore's
 * own composite/shrinkage math (Formula v9 replaced hard gating with Bayesian
 * shrinkage — see module docstring). Kept exported ONLY for backward compatibility
 * with unrelated UI/FAQ "which pillar is weakest" eligibility filtering
 * (src/lib/seo.ts selectEligiblePillars, PillarBreakdown.astro, PillarDetailTable.astro,
 * AnswerFirstParagraph.astro) which is a display-layer concern, not a scoring one.
 */
export const MIN_PILLAR_COVERAGE = 0.30;

/**
 * Soft flag: pillars with dataCompleteness below this threshold should be flagged
 * in the UI (asterisk + tooltip) so users know the displayed pillar number is
 * based on thin data. The engine does NOT use this constant directly — it is
 * exported so UI components import a single source of truth.
 */
export const LOW_COVERAGE_FLAG_THRESHOLD = 0.50;

/**
 * Default Formula v9 constants (identical to prototype-scorer.mjs DEFAULT_CONST +
 * ADVISORY_TIER + FROZEN_EXCLUDED_SOURCES + ADVISORY_REBASE + REGION_OFFSET).
 * Used only as a fallback when a WeightsConfig has no formulaV9 section (e.g.
 * ad-hoc synthetic configs in older tests) — production weights.json v9.0.0+
 * always carries its own formulaV9 section, which is the real source of truth.
 */
export const DEFAULT_FORMULA_V9: FormulaV9Config = {
  K: 1.0,
  lambda: 0.25,
  q: 3,
  gamma: 0.96,
  S_MAX: 0.32,
  N_SEV: 6,
  D_MAX: 24000,
  P_HALF: 200000,
  nudgeMinNAdv: 1,
  severeMinNAdv: 2,
  gateRampWidth: 2.4,
  muBase: 0.45,
  muClampMin: 0.32,
  muClampMax: 0.60,
  nudgeScale: 0.35,
  nudgeDenom: 5,
  rhoADenom: 6,
  floorP: 0.02,
  acuteDownOnly: 1,
  advisoryTiers: {},
  frozenExcludedSources: [],
  advisoryRebase: [],
  regionOffset: {},
};

/** All government advisory codes ScoredCountry.advisories may carry (37). */
const ADVISORY_CODES = [
  'us', 'uk', 'ca', 'au', 'de', 'nl', 'jp', 'sk',
  'fr', 'nz', 'ie', 'fi', 'hk', 'br', 'at', 'ph',
  'be', 'dk', 'sg', 'ro', 'rs', 'ee', 'hr', 'ar',
  'it', 'es', 'kr', 'tw', 'cn', 'in',
  'ch', 'se', 'no', 'pl', 'cz', 'hu', 'pt',
] as const;

type AdvisoriesInput = Partial<Record<(typeof ADVISORY_CODES)[number], AdvisoryInfo>>;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Extract {code -> numeric level} from the ScoredCountry advisories input, dropping unset/NaN entries. */
function extractAdvisoryLevels(advisories: AdvisoriesInput): Record<string, number> {
  const out: Record<string, number> = {};
  for (const code of ADVISORY_CODES) {
    const info = advisories[code];
    if (!info) continue;
    const level = typeof info.level === 'string' ? parseFloat(info.level) : info.level;
    if (typeof level === 'number' && !isNaN(level)) out[code] = level;
  }
  return out;
}

interface AdvisoryConsensusResult {
  A: number | null;
  severeShare: number;
  severeEff: number;
  nAdv: number;
  rhoA: number;
}

/**
 * v9.1 (D4) — advisory nudge/severe ramp. rampFactor(nAdv, minNAdv, width) =
 * clamp((nAdv-(minNAdv-1))/width, 0, 1): 0 at nAdv<=minNAdv-1, 0.5 at
 * nAdv=minNAdv, 1 at nAdv>=minNAdv+width-1. width<=0 degenerates to a hard step
 * at nAdv>=minNAdv. Ported verbatim from prototype-scorer-v91.mjs rampFactor().
 */
function rampFactor(nAdv: number, minNAdv: number, width: number): number {
  if (width <= 0) return nAdv >= minNAdv ? 1 : 0;
  const x = (nAdv - (minNAdv - 1)) / width;
  return Math.max(0, Math.min(1, x));
}

/**
 * Advisory consensus A, severeShare/severeEff and rho_A for one country.
 * FROZEN math (SHIP-SPEC 1.1 item 1 / prototype-scorer-v91.mjs advisoryConsensus()).
 * v9.1 (D4): severeEff is additionally gated by rampFactor(nAdv, severeMinNAdv,
 * gateRampWidth) — a single spurious/thin (nAdv<=1) L4 record contributes ZERO
 * severe modifier regardless of N_SEV damping.
 */
function advisoryConsensus(advisoryLevels: Record<string, number>, f9: FormulaV9Config): AdvisoryConsensusResult {
  const excluded = new Set(f9.frozenExcludedSources);
  const rebase = new Set(f9.advisoryRebase);

  let numA = 0;
  let denA = 0;
  let numSevere = 0;
  let nAdv = 0;

  for (const [code, rawLevel] of Object.entries(advisoryLevels)) {
    if (excluded.has(code)) continue;
    const tier = f9.advisoryTiers[code];
    if (!tier) continue; // unknown/unfrozen source code — ignore defensively
    let L = rawLevel;
    if (rebase.has(code)) L = Math.max(1, L - 1);
    nAdv += 1;
    denA += tier;
    numA += (tier * (4 - L)) / 3;
    if (L === 4) numSevere += tier;
  }

  const A = denA > 0 ? numA / denA : null;
  const severeShare = denA > 0 ? numSevere / denA : 0;
  const severeEffRaw = severeShare * (nAdv / (nAdv + f9.N_SEV));
  const severeEff = severeEffRaw * rampFactor(nAdv, f9.severeMinNAdv, f9.gateRampWidth);
  const rhoA = nAdv / (nAdv + f9.rhoADenom);

  return { A, severeShare, severeEff, nAdv, rhoA };
}

/**
 * Conservative region-anchored prior mu, nudged by advisory consensus. FROZEN
 * math. v9.1 (D4): the advisory-nudge term is additionally gated by
 * rampFactor(nAdv, nudgeMinNAdv, gateRampWidth) — a single-source (nAdv<=1)
 * country's nudge is suppressed toward zero rather than fully weighted.
 */
function computePrior(region: string, A: number | null, nAdv: number, f9: FormulaV9Config): number {
  const regionOffset = f9.regionOffset[region] ?? 0;
  let mu: number;
  if (nAdv > 0 && A !== null) {
    const f = rampFactor(nAdv, f9.nudgeMinNAdv, f9.gateRampWidth);
    mu = f9.muBase + regionOffset + f * (A - 0.5) * f9.nudgeScale * (nAdv / (nAdv + f9.nudgeDenom));
  } else {
    mu = f9.muBase + regionOffset;
  }
  return clamp(mu, f9.muClampMin, f9.muClampMax);
}

interface SubIndicator {
  value: number | null;
  subweight: number;
  rho: number;
}

interface PillarBuildResult {
  p: number | null;
  n: number;
}

/** p_i = sub-weight-renormalized mean over PRESENT indicators; n_i = sum of rho over present indicators. */
function buildPillar(subIndicators: SubIndicator[]): PillarBuildResult {
  const present = subIndicators.filter((s) => s.value !== null && s.value !== undefined && !Number.isNaN(s.value));
  const wSum = present.reduce((s, x) => s + x.subweight, 0);
  const p = wSum > 0 ? present.reduce((s, x) => s + x.subweight * x.value!, 0) / wSum : null;
  const n = present.reduce((s, x) => s + (x.rho ?? 0), 0);
  return { p, n };
}

/** p_hat = (n*p + K*mu) / (n + K). n=0 (or p absent) collapses cleanly to mu. */
function shrinkPillar(p: number | null, n: number, mu: number, K: number): number {
  const pContribution = p === null ? 0 : n * p;
  return (pContribution + K * mu) / (n + K);
}

/** Weighted geometric mean over ALL 5 shrunk pillars, using each pillar's config weight. */
function geometricAggregate(shrunk: Record<PillarName, number>, pillarDefs: PillarWeight[], floorP: number): number {
  let acc = 0;
  for (const pd of pillarDefs) {
    acc += pd.weight * Math.log(Math.max(floorP, shrunk[pd.name]));
  }
  return Math.exp(acc);
}

/** Acute soft-min power mean over conflict & crime only. */
function acuteMean(shrunk: Record<PillarName, number>, pillarDefs: PillarWeight[], f9: FormulaV9Config): number {
  const wc = pillarDefs.find((p) => p.name === 'conflict')?.weight ?? 0;
  const wcr = pillarDefs.find((p) => p.name === 'crime')?.weight ?? 0;
  const c = Math.max(f9.floorP, shrunk.conflict ?? f9.floorP);
  const cr = Math.max(f9.floorP, shrunk.crime ?? f9.floorP);
  if (wc + wcr === 0) return Math.min(c, cr);
  const inner = (wc * Math.pow(c, -f9.q) + wcr * Math.pow(cr, -f9.q)) / (wc + wcr);
  return Math.pow(inner, -1 / f9.q);
}

interface ComposeResult {
  composite: number;
  score: number;
  scoreDisplay: number;
}

/**
 * composite -> 1..10 score. DOCUMENTED DEVIATION (carried from the frozen design,
 * per SHIP-SPEC / final-constants.json "acute-term down-only cap"): the acute term
 * is capped at G (acuteDownOnly) so it can only ever DRAG a score DOWN, never
 * inflate it — R5 severe-risk dominance without symmetric mid-band inflation.
 */
function composeScore(
  shrunk: Record<PillarName, number>,
  severeEff: number,
  pillarDefs: PillarWeight[],
  f9: FormulaV9Config,
): ComposeResult {
  const G = geometricAggregate(shrunk, pillarDefs, f9.floorP);
  const acuteRaw = acuteMean(shrunk, pillarDefs, f9);
  const acute = f9.acuteDownOnly ? Math.min(acuteRaw, G) : acuteRaw;
  const severeFactor = clamp(1 - f9.S_MAX * severeEff, 0, 1);
  const composite = Math.pow(G, 1 - f9.lambda) * Math.pow(acute, f9.lambda) * severeFactor;
  const score = 1 + 9 * Math.pow(Math.max(0, composite), f9.gamma);
  const scoreDisplay = Math.round(score);
  return { composite, score, scoreDisplay };
}

/** confidence = sum_i w_i * n_i/(n_i+K). NEW v9 output field. */
function computeConfidence(nByPillar: Record<PillarName, number>, pillarDefs: PillarWeight[], K: number): number {
  let acc = 0;
  for (const pd of pillarDefs) {
    const n = nByPillar[pd.name] ?? 0;
    acc += pd.weight * (n / (n + K));
  }
  return acc;
}

/**
 * Freshness weight for one indicator, matching the pre-v9 tiered-scoring lookup
 * exactly: source-tiers.json decay params keyed by the RawIndicator's own
 * `.source` (e.g. "advisories_us", "gpi"), age from `dataDate ?? fetchedAt`.
 * Defaults to 1.0 (fresh) when sourcesConfig, the raw record, its source config,
 * or a usable date is missing — backward-compatible with sources that only stamp
 * fetchedAt at the RawSourceData level (gpi/vdem/worldbank/inform/base advisories).
 */
function computeIndicatorFreshness(
  indicatorName: string,
  rawByName: Map<string, RawIndicator>,
  sourcesConfig: SourcesConfig | undefined,
  now: number,
): number {
  if (!sourcesConfig) return 1.0;
  const raw = rawByName.get(indicatorName);
  if (!raw) return 1.0;
  const sourceConf = sourcesConfig.sources[raw.source];
  if (!sourceConf) return 1.0;
  const dateStr = raw.dataDate ?? raw.fetchedAt;
  if (!dateStr) return 1.0;
  const ageMs = now - new Date(dateStr).getTime();
  return freshnessWeight(ageMs, sourceConf.decayHalfLifeDays, sourceConf.maxAgeDays);
}

export function computeCountryScore(
  iso3: string,
  allIndicators: RawIndicator[],
  weightsConfig: WeightsConfig,
  countryEntry: CountryEntry,
  advisories: { us?: AdvisoryInfo; uk?: AdvisoryInfo; ca?: AdvisoryInfo; au?: AdvisoryInfo; de?: AdvisoryInfo; nl?: AdvisoryInfo; jp?: AdvisoryInfo; sk?: AdvisoryInfo; fr?: AdvisoryInfo; nz?: AdvisoryInfo; ie?: AdvisoryInfo; fi?: AdvisoryInfo; hk?: AdvisoryInfo; br?: AdvisoryInfo; at?: AdvisoryInfo; ph?: AdvisoryInfo; be?: AdvisoryInfo; dk?: AdvisoryInfo; sg?: AdvisoryInfo; ro?: AdvisoryInfo; rs?: AdvisoryInfo; ee?: AdvisoryInfo; hr?: AdvisoryInfo; ar?: AdvisoryInfo; it?: AdvisoryInfo; es?: AdvisoryInfo; kr?: AdvisoryInfo; tw?: AdvisoryInfo; cn?: AdvisoryInfo; in?: AdvisoryInfo; ch?: AdvisoryInfo; se?: AdvisoryInfo; no?: AdvisoryInfo; pl?: AdvisoryInfo; cz?: AdvisoryInfo; hu?: AdvisoryInfo; pt?: AdvisoryInfo },
  sources: SourceMeta[],
  sourcesConfig?: SourcesConfig,
): ScoredCountry {
  const upperIso3 = iso3.toUpperCase();
  const countryIndicators = allIndicators.filter((ind) => ind.countryIso3.toUpperCase() === upperIso3);

  // Normalize all indicators for this country at once (normalize.ts is UNCHANGED).
  const normalizedAll = normalizeIndicators(countryIndicators);
  const normalizedByName = new Map<string, IndicatorScore>();
  for (const ns of normalizedAll) normalizedByName.set(ns.name, ns);

  // Lookup for freshness data (one-value-per-indicator contract).
  const rawByName = new Map<string, RawIndicator>();
  for (const ind of countryIndicators) rawByName.set(ind.indicatorName, ind);

  const f9 = weightsConfig.formulaV9 ?? DEFAULT_FORMULA_V9;
  const now = Date.now();

  // --- Advisory consensus (drives the synthetic "A" conflict indicator + prior nudge) ---
  const advisoryLevels = extractAdvisoryLevels(advisories);
  const { A, severeShare, severeEff, nAdv, rhoA } = advisoryConsensus(advisoryLevels, f9);

  // --- Conservative prior, anchored by region (getRegion is the single source of truth) ---
  const region = getRegion(upperIso3);
  const mu = computePrior(region, A, nAdv, f9);

  // --- Per-pillar value/precision + Bayesian shrinkage ---
  const rawByPillar: Partial<Record<PillarName, number | null>> = {};
  const nByPillar: Partial<Record<PillarName, number>> = {};
  const shrunkByPillar: Partial<Record<PillarName, number>> = {};
  const presentIndicatorsByPillar: Partial<Record<PillarName, IndicatorScore[]>> = {};
  const foundCountByPillar: Partial<Record<PillarName, number>> = {};

  for (const pillarDef of weightsConfig.pillars) {
    const subIndicators: SubIndicator[] = [];
    const presentIndicators: IndicatorScore[] = [];
    let foundCount = 0;

    for (const indName of pillarDef.indicators) {
      const subweight = pillarDef.indicatorWeights?.[indName] ?? 1.0 / pillarDef.indicators.length;

      if (indName === 'A') {
        // Synthetic advisory-consensus indicator: precision is per-country (rho_A),
        // never freshness-discounted (it already reflects the current data date).
        subIndicators.push({ value: A, subweight, rho: rhoA });
        if (A !== null) foundCount++;
        continue;
      }

      const ns = normalizedByName.get(indName);
      const rhoBase = pillarDef.indicatorPrecision?.[indName] ?? 1;
      const fw = computeIndicatorFreshness(indName, rawByName, sourcesConfig, now);
      let rho = rhoBase * fw;

      // v9.1 (round-2 F1) — population-scaled homicide precision: scale ONLY
      // wb_homicide's rho (evidence weight n_i), NEVER its value, and NEVER any
      // other indicator. rho_hom_eff = rhoBase * fw * pop/(pop+P_HALF). Missing
      // population (33/248 project countries, none of which carry wb_homicide
      // — verified) falls back to factor=1 (LARGE/full precision).
      if (indName === 'wb_homicide') {
        const pop = rawByName.get('wb_population')?.value;
        const factor =
          typeof pop === 'number' && Number.isFinite(pop) && pop > 0 ? pop / (pop + f9.P_HALF) : 1;
        rho = rho * factor;
      }

      if (ns) {
        subIndicators.push({ value: ns.normalizedValue, subweight, rho });
        presentIndicators.push(ns);
        foundCount++;
      } else {
        subIndicators.push({ value: null, subweight, rho });
      }
    }

    const built = buildPillar(subIndicators);
    rawByPillar[pillarDef.name] = built.p;
    nByPillar[pillarDef.name] = built.n;
    presentIndicatorsByPillar[pillarDef.name] = presentIndicators;
    foundCountByPillar[pillarDef.name] = foundCount;
  }

  for (const pillarDef of weightsConfig.pillars) {
    shrunkByPillar[pillarDef.name] = shrinkPillar(
      rawByPillar[pillarDef.name] ?? null,
      nByPillar[pillarDef.name] ?? 0,
      mu,
      f9.K,
    );
  }

  const shrunkComplete = shrunkByPillar as Record<PillarName, number>;
  const nComplete = nByPillar as Record<PillarName, number>;

  const { composite, score, scoreDisplay } = composeScore(shrunkComplete, severeEff, weightsConfig.pillars, f9);
  const confidence = computeConfidence(nComplete, weightsConfig.pillars, f9.K);
  void composite; // retained for potential future diagnostics; not part of ScoredCountry today

  // --- Build PillarScore[] output. score = SHRUNK value (v9's calibrated, confidence-
  // weighted pillar position). dataCompleteness KEEPS the existing presence-ratio
  // semantics: found/expected across the pillar's listed indicators (the synthetic
  // "A" slot counts as found iff advisory data was available, i.e. A !== null). ---
  const pillars: PillarScore[] = weightsConfig.pillars.map((pillarDef) => {
    const expectedCount = pillarDef.indicators.length;
    const foundCount = foundCountByPillar[pillarDef.name] ?? 0;
    const dataCompleteness = expectedCount > 0 ? foundCount / expectedCount : 0;

    return {
      name: pillarDef.name,
      score: shrunkComplete[pillarDef.name],
      weight: pillarDef.weight,
      indicators: presentIndicatorsByPillar[pillarDef.name] ?? [],
      dataCompleteness,
    };
  });

  const overallCompleteness =
    pillars.length > 0 ? pillars.reduce((acc, p) => acc + p.dataCompleteness, 0) / pillars.length : 0;

  return {
    iso3: upperIso3,
    name: countryEntry.name,
    score,
    scoreDisplay,
    pillars,
    advisories,
    dataCompleteness: Math.round(overallCompleteness * 1000) / 1000,
    confidence,
    lastUpdated: new Date().toISOString(),
    sources,
  };
}

/**
 * Map indicator names to their source name for tier classification.
 * This is used to determine expected signal count from config, not from
 * available data, preventing score spikes when a fetch temporarily fails.
 */
export const INDICATOR_SOURCE_MAP: Record<string, string> = {
  wb_child_mortality: 'worldbank',
  wb_air_pollution: 'worldbank',
  vdem_rule_of_law: 'vdem',
  vdem_gov_effectiveness: 'vdem',
  vdem_corruption_control: 'vdem',
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
  // Tier 3a complex
  advisory_level_it: 'advisories_it',
  advisory_level_es: 'advisories_es',
  advisory_level_kr: 'advisories_kr',
  advisory_level_tw: 'advisories_tw',
  advisory_level_cn: 'advisories_cn',
  advisory_level_in: 'advisories_in',
  // Tier 3b complex
  advisory_level_ch: 'advisories_ch',
  advisory_level_se: 'advisories_se',
  advisory_level_no: 'advisories_no',
  advisory_level_pl: 'advisories_pl',
  advisory_level_cz: 'advisories_cz',
  advisory_level_hu: 'advisories_hu',
  advisory_level_pt: 'advisories_pt',
  reliefweb_active_disasters: 'reliefweb',
  gdacs_disaster_alerts: 'gdacs',
};

/** Metadata for known data sources used in scoring. */
export const SOURCE_CATALOG: Record<string, { url: string; description: string }> = {
  worldbank: {
    url: 'https://data.worldbank.org/',
    description: 'World Bank Development Indicators -- child mortality and PM2.5 air pollution',
  },
  vdem: {
    url: 'https://www.v-dem.net/data/the-v-dem-dataset/',
    description: 'V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- Rule of Law, Political Corruption, and Public Administration indices (Coppedge et al., DOI 10.23696/vdemds26)',
  },
  advisories: {
    url: 'https://travel.state.gov/',
    description: 'Travel advisories from 37 governments worldwide including US, UK, Canada, Australia, Germany, Netherlands, Japan, Slovakia, France, New Zealand, Ireland, Finland, Hong Kong, Brazil, Austria, Philippines, Belgium, Denmark, Singapore, Romania, Serbia, Estonia, Croatia, Argentina, Italy, Spain, South Korea, Taiwan, China, India, Switzerland, Sweden, Norway, Poland, Czech Republic, Hungary, and Portugal',
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
  ucdp: {
    url: 'https://ucdp.uu.se/',
    description: 'UCDP Georeferenced Event Dataset (Uppsala Conflict Data Program) -- state-based and one-sided conflict deaths, via the Our World in Data mirror (CC-BY)',
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
    // Skip tiered advisory aggregates: the single 'advisories' SOURCE_CATALOG
    // entry already describes all 37 governments. Without this skip these
    // entries render as broken anchors (`<a href="">advisories_tier1</a>`)
    // because SOURCE_CATALOG has no per-tier metadata.
    if (sourceData.source.startsWith('advisories_tier')) continue;

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
 * Automatically loads source-tiers.json for freshness decay. If the config file
 * is missing, freshness weighting defaults to 1.0 (fresh) everywhere.
 */
export function computeAllScores(
  rawDataBySource: Map<string, RawSourceData>,
  weightsConfig: WeightsConfig,
): ScoredCountry[] {
  // Load sources tier config (optional -- graceful fallback: no freshness decay)
  const sourceTiersPath = join(process.cwd(), 'src/pipeline/config/source-tiers.json');
  const sourcesConfig = readJson<SourcesConfig>(sourceTiersPath) ?? undefined;

  if (sourcesConfig) {
    console.log('  Freshness decay: loaded source-tiers.json (%d sources configured)',
      Object.keys(sourcesConfig.sources).length);
  } else {
    console.log('  source-tiers.json not found -- freshness weighting defaults to 1.0 everywhere');
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
  type AdvisoryInfoMap = Record<string, { us?: AdvisoryInfo; uk?: AdvisoryInfo; ca?: AdvisoryInfo; au?: AdvisoryInfo; de?: AdvisoryInfo; nl?: AdvisoryInfo; jp?: AdvisoryInfo; sk?: AdvisoryInfo; fr?: AdvisoryInfo; nz?: AdvisoryInfo; ie?: AdvisoryInfo; fi?: AdvisoryInfo; hk?: AdvisoryInfo; br?: AdvisoryInfo; at?: AdvisoryInfo; ph?: AdvisoryInfo; be?: AdvisoryInfo; dk?: AdvisoryInfo; sg?: AdvisoryInfo; ro?: AdvisoryInfo; rs?: AdvisoryInfo; ee?: AdvisoryInfo; hr?: AdvisoryInfo; ar?: AdvisoryInfo; it?: AdvisoryInfo; es?: AdvisoryInfo; kr?: AdvisoryInfo; tw?: AdvisoryInfo; cn?: AdvisoryInfo; in?: AdvisoryInfo; ch?: AdvisoryInfo; se?: AdvisoryInfo; no?: AdvisoryInfo; pl?: AdvisoryInfo; cz?: AdvisoryInfo; hu?: AdvisoryInfo; pt?: AdvisoryInfo }>;
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
  const tier3bSource = rawDataBySource.get('advisories_tier3b');
  const anyAdvisorySource = advisoriesSource || tier1Source || tier2aSource || tier2bSource || tier3aSource || tier3bSource;

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
      console.log(`  No advisories-info.json for ${dataDate} — advisory consensus will not include base tier-1 sources`);
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

    // Also load tier-3b advisory info
    const tier3bInfoPath = join(process.cwd(), 'data', 'raw', dataDate, 'advisories-tier3b-info.json');
    const tier3bInfo = readJson<AdvisoryInfoMap>(tier3bInfoPath);
    if (tier3bInfo) {
      for (const [iso3, info] of Object.entries(tier3bInfo)) {
        if (!advisoryInfoMap[iso3]) advisoryInfoMap[iso3] = {};
        Object.assign(advisoryInfoMap[iso3], info);
      }
      console.log(`  Merged tier-3b advisory info`);
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

  // Sort by iso3
  results.sort((a, b) => a.iso3.localeCompare(b.iso3));

  return results;
}
