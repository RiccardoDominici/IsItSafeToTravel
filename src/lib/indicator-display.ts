/**
 * Real-value display of scored indicators (formula v10, SPEC §7 "Indicator table" and "Top
 * summary"): which indicators to show, how to print each raw value on its source's own scale,
 * which source edition it comes from, and the plain-words driver of a weak pillar.
 *
 * Shared by PillarBreakdown.astro (indicator tables), the top summary
 * (src/lib/country-summary.ts) and the FAQ driver clause (src/lib/seo.ts), so the three never
 * describe the same number differently.
 *
 * Pure module: no Node imports.
 */
import weightsConfig from '../pipeline/config/weights.json';
import type { IndicatorScore, PillarScore, WeightsConfig } from '../pipeline/types';
import type { Lang } from '../i18n/ui';
import { indicatorCopy, type DescribedIndicator, type FactTemplate, type IndicatorScale } from '../i18n/indicator-copy';

/** Indicators the current formula scores (weights.json, the engine's own list), minus the synthetic advisory consensus "A". */
const SCORED_INDICATORS: ReadonlySet<string> = new Set(
  weightsConfig.pillars.flatMap((p) => p.indicators).filter((name) => name !== 'A'),
);

/** Order of the indicators inside each pillar, as weights.json lists them (stable tie-break). */
const INDICATOR_ORDER: ReadonlyMap<string, number> = new Map(
  weightsConfig.pillars.flatMap((p) => p.indicators).map((name, i) => [name, i]),
);

interface IndicatorMeta {
  scale: IndicatorScale;
  /** Decimals for the printed value (the source's own precision). */
  decimals: number;
}

const META: Record<DescribedIndicator, IndicatorMeta> = {
  gpi_overall: { scale: 'gpi', decimals: 2 },
  gpi_militarisation: { scale: 'gpi', decimals: 2 },
  gpi_safety_security: { scale: 'gpi', decimals: 2 },
  ucdp_conflict_deaths: { scale: 'deaths', decimals: 0 },
  wb_homicide: { scale: 'per100k', decimals: 1 },
  inform_health_access: { scale: 'inform', decimals: 1 },
  inform_epidemic: { scale: 'inform', decimals: 1 },
  inform_governance: { scale: 'inform', decimals: 1 },
  inform_natural: { scale: 'inform', decimals: 1 },
  vdem_rule_of_law: { scale: 'vdemUp', decimals: 2 },
  vdem_corruption_control: { scale: 'vdemDown', decimals: 2 },
  vdem_gov_effectiveness: { scale: 'vdemLatent', decimals: 2 },
  reliefweb_active_disasters: { scale: 'disasters', decimals: 0 },
  gdacs_disaster_alerts: { scale: 'alerts', decimals: 0 },
};

/**
 * Pillars without the synthetic advisory slot "A", with the precision of each listed indicator.
 * Used by pillarEvidenceCoverage: a feed with precision 0 (ReliefWeb, GDACS: "the value
 * contributes, the confidence does not") is absent for most countries simply because nothing is
 * happening there, and its absence takes nothing away from the pillar.
 */
const PILLAR_DEFS: ReadonlyMap<string, { indicators: readonly string[]; precision: Readonly<Record<string, number>> }> = new Map(
  weightsConfig.pillars.map((p) => [
    p.name,
    { indicators: p.indicators, precision: ((p as unknown as WeightsConfig['pillars'][number]).indicatorPrecision ?? {}) as Record<string, number> },
  ]),
);

/**
 * Data coverage of a pillar as the reader should see it. Equal to the engine's dataCompleteness
 * (found / listed indicators), except that a pillar whose only missing indicators are zero-precision
 * alert feeds counts as fully covered: since formula v10 the natural-hazards pillar lists INFORM
 * plus two alert feeds, and "no ReliefWeb or GDACS alert today" made almost every country show
 * 33% coverage and a "low coverage, contribution reduced" asterisk that was not true.
 */
export function pillarEvidenceCoverage(pillar: PillarScore): number {
  const def = PILLAR_DEFS.get(pillar.name);
  if (!def || def.indicators.includes('A')) return pillar.dataCompleteness;
  const present = new Set(pillar.indicators.map((i) => i.name));
  const missing = def.indicators.filter((name) => !present.has(name));
  const scoredPresent = def.indicators.filter((name) => present.has(name) && (def.precision[name] ?? 1) > 0);
  if (missing.length > 0 && scoredPresent.length > 0 && missing.every((name) => def.precision[name] === 0)) return 1;
  return pillar.dataCompleteness;
}

/** Country-level coverage shown in the hero: the mean of pillarEvidenceCoverage. */
export function countryEvidenceCoverage(pillars: readonly PillarScore[]): number {
  if (pillars.length === 0) return 0;
  return pillars.reduce((sum, p) => sum + pillarEvidenceCoverage(p), 0) / pillars.length;
}

/** Indicators a reader would not act on as "the main risk" when the pillar offers another driver. */
const NOT_A_TRAVEL_DRIVER: ReadonlySet<string> = new Set(['gpi_militarisation']);

const NUMBER_LOCALE: Record<Lang, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', zh: 'zh-CN', de: 'de-DE' };

function isDescribed(name: string): name is DescribedIndicator {
  return Object.prototype.hasOwnProperty.call(META, name);
}

/** True when the current formula scores this indicator (pre-v10 legacy rows are not). */
export function isScoredIndicator(name: string): boolean {
  return SCORED_INDICATORS.has(name);
}

/**
 * The indicators to show for a pillar: only those the current formula scores, in weights.json
 * order. Rows a pre-v10 snapshot still carries (child mortality, PM2.5, the INFORM "Human" and
 * "River Flood" columns once mislabelled as health and climate risk) are not shown: they do not
 * feed the score any more, and two of them were never what their label said.
 */
export function displayedIndicators(pillar: PillarScore): IndicatorScore[] {
  return pillar.indicators
    .filter((ind) => isScoredIndicator(ind.name))
    .sort((a, b) => (INDICATOR_ORDER.get(a.name) ?? 99) - (INDICATOR_ORDER.get(b.name) ?? 99));
}

/**
 * Locales whose CLDR default leaves four-digit numbers ungrouped ("2428") although the same page
 * groups larger ones ("100.000"): Italian copy groups every number from 1,000 (2026-10-15 audit,
 * I53: "2428 persone" next to "100.000 abitanti"). Spanish keeps the RAE rule (no separator for
 * four digits), which its default already follows.
 */
const ALWAYS_GROUP: ReadonlySet<Lang> = new Set<Lang>(['it']);

/** A number in the locale's own format with fixed decimals ("45.7", "45,7", "2,54"); minus as U+2212. */
export function formatSourceNumber(value: number, decimals: number, lang: Lang): string {
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  };
  // 'always' (ES2023) is not in every TypeScript lib's option type; Node 18+ supports it.
  if (ALWAYS_GROUP.has(lang)) (options as { useGrouping?: unknown }).useGrouping = 'always';
  return new Intl.NumberFormat(NUMBER_LOCALE[lang], options).format(value).replace(/^-/, '−');
}

function pick(template: FactTemplate | string | readonly [string, string], count: number): string {
  if (typeof template === 'string') return template;
  return Math.abs(count) === 1 ? template[0] : template[1];
}

export interface IndicatorValueDisplay {
  /** The raw value as the source publishes it ("45.7", "4.1 / 10", "2.54"). */
  value: string;
  /** Unit or source scale ("per 100,000 people", "GPI scale 1–5, lower is better"). */
  unit: string;
}

/** The raw value of an indicator on its source's own scale, with its unit (null for an unknown indicator). */
export function formatIndicatorValue(ind: IndicatorScore, lang: Lang): IndicatorValueDisplay | null {
  if (!isDescribed(ind.name) || !Number.isFinite(ind.rawValue)) return null;
  const meta = META[ind.name];
  const number = formatSourceNumber(ind.rawValue, meta.decimals, lang);
  const unit = pick(indicatorCopy[lang].units[meta.scale], ind.rawValue);
  return { value: meta.scale === 'inform' ? `${number} / 10` : number, unit };
}

/**
 * The source an indicator comes from, with its edition where the source has one: "GPI 2026",
 * "INFORM Risk 2026", "V-Dem v16", "World Bank" (the year column carries the data year).
 */
export function indicatorSourceLabel(ind: IndicatorScore, lang: Lang): string {
  const names = indicatorCopy[lang].sourceNames;
  switch (ind.source) {
    case 'gpi':
      return `GPI ${ind.year}`;
    case 'inform':
      return `INFORM Risk ${ind.year}`;
    case 'worldbank':
      return names.worldbank;
    case 'vdem':
      return names.vdem;
    case 'ucdp':
      return names.ucdp;
    case 'reliefweb':
      return names.reliefweb;
    case 'gdacs':
      return names.gdacs;
    default:
      return ind.source;
  }
}

/** True for World Bank rows, which carry the publication-lag note. */
export function isWorldBankIndicator(ind: IndicatorScore): boolean {
  return ind.source === 'worldbank';
}

/** The World Bank publication-lag note, per locale (the row's own year column gives the data year). */
export function worldBankLagNote(lang: Lang): string {
  return indicatorCopy[lang].worldBankLagNote;
}

/**
 * The indicator that pulls a pillar down the most: the lowest normalised value among the scored
 * indicators the pillar actually has (ties: weights.json order). GPI militarisation is passed
 * over when the pillar has another indicator: it is a property of the state (arms, military
 * spending), not something a traveller meets. Null when the pillar has no scored indicator.
 * The result can be a GOOD value (Qatar's GPI 1.68): to quote it as a risk use selectBadDriver.
 */
export function selectPillarDriver(pillar: PillarScore): IndicatorScore | null {
  const candidates = displayedIndicators(pillar).filter((ind) => isDescribed(ind.name));
  const preferred = candidates.filter((ind) => !NOT_A_TRAVEL_DRIVER.has(ind.name));
  const pool = preferred.length > 0 ? preferred : candidates;
  let best: IndicatorScore | null = null;
  for (const ind of pool) {
    if (best === null || ind.normalizedValue < best.normalizedValue) best = ind;
  }
  return best;
}

/**
 * Normalised values (0 = worst, 1 = best) below this sit in the bad half of their source's scale:
 * GPI above 2.5 on its 1-5 scale, an INFORM risk above 5 out of 10, V-Dem rule of law below 0.5.
 */
export const BAD_DRIVER_MAX = 0.5;

/**
 * The pillar's driver only when its own value is bad (2026-10-15 audit, I04): the summary used to
 * print "The main concern is a climate of violence and insecurity" over Qatar's GPI 1.68 (one of
 * the most peaceful values on the site) because the conflict pillar was low for another reason
 * (government advisories, which are not an indicator row). Null when no displayed indicator is in
 * the bad half: the caller then names the pillar or the real cause instead of a good number.
 */
export function selectBadDriver(pillar: PillarScore): IndicatorScore | null {
  const driver = selectPillarDriver(pillar);
  return driver && driver.normalizedValue < BAD_DRIVER_MAX ? driver : null;
}

/** Topic ("violent crime") and fact ("45.7 homicides per 100,000 people (World Bank, 2023)") of a driver. */
export function describeDriver(ind: IndicatorScore, lang: Lang): { topic: string; fact: string } | null {
  if (!isDescribed(ind.name)) return null;
  const copy = indicatorCopy[lang];
  const meta = META[ind.name];
  const value = formatSourceNumber(ind.rawValue, meta.decimals, lang);
  const fact = pick(copy.facts[ind.name], ind.rawValue).replace('{v}', value).replace('{y}', String(ind.year));
  return { topic: copy.topics[ind.name], fact };
}
