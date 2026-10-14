/**
 * The top summary of a country page (AnswerFirstParagraph.astro), as plain text.
 *
 * Scored country (formula v10, SPEC §7 "Top summary"):
 *   1. score, band and rank among the countries WITH an official score, as of the snapshot date;
 *   2. the concrete driver of the weakest pillar: the indicator pulling it down the most, in plain
 *      words, with the source's own value, its data year and the source
 *      ("The main risk is violent crime: 45.7 homicides per 100,000 people (World Bank, 2023)");
 *   3. the best-rated pillar, ONLY when it is good in absolute terms (>= 7.0/10): a pillar that is
 *      merely the least bad is never presented as a strength;
 *   4. the government advisories by level ("Of the 22 governments that publish a travel advisory
 *      for Ecuador, 1 advises normal precautions, 18 advise increased caution and 3 advise
 *      reconsidering travel");
 *   5. the provenance sentence shared with the FAQ (provenance-copy.ts).
 * Grey place (no official score): one "partial data" sentence plus the advisory sentence; no
 * score, rank or pillar figure.
 *
 * Pure: everything comes in through arguments (no I/O), so it is unit-tested directly.
 */
import type { PillarName, PillarScore, ScoredCountry } from '../pipeline/types';
import { MIN_PILLAR_COVERAGE } from '../pipeline/scoring/engine';
import weightsConfig from '../pipeline/config/weights.json';
import type { Lang } from '../i18n/ui';
import { countrySummaryCopy } from '../i18n/country-summary-copy';
import {
  getEnglishCountryPhrase,
  getFrenchPreposition,
  getGermanFuerPhrase,
  getItalianLocative,
  getPortugueseDe,
  getPortuguesePhrase,
} from '../i18n/country-grammar';
import { getBandVerdictCopy } from './band-copy';
import { LOW_CONFIDENCE_THRESHOLD } from './confidence';
import { selectPillarExtremes } from './pillar-extremes';
import { getProvenanceCounts, buildProvenanceSentence } from './provenance-copy';
import { describeDriver, selectPillarDriver } from './indicator-display';
import { isScored } from './score-status';

/** A pillar at or above this (display value, /10) counts as good in absolute terms. */
export const STRONG_PILLAR_MIN = 7.0;
/** Below this (display value, /10) the weakest pillar is called "the main risk". */
export const MAIN_RISK_MAX = 5.0;

const DATE_LOCALE: Record<Lang, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', zh: 'zh-CN', de: 'de-DE' };

export interface SummaryContext {
  lang: Lang;
  /** Bare localized country name (getLocalizedCountryName). */
  name: string;
  /** Global rank among countries with an official score (1 = safest); ignored for grey places. */
  rank: number;
  /** How many countries have an official score. */
  total: number;
  /** Snapshot date the page shows (YYYY-MM-DD or ISO). */
  snapshotDate: string;
}

/** Per-language ordinal for the rank (en 78th, it 78°, fr 78e, pt 78º; es/de/zh use the plain number). */
export function ordinal(n: number, lang: Lang): string {
  if (lang === 'en') {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  if (lang === 'fr') return n + (n === 1 ? 'er' : 'e');
  if (lang === 'it') return n + '°';
  if (lang === 'pt') return n + 'º';
  return String(n);
}

function fill(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => slots[key] ?? match);
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Display value of a 0-1 pillar on the /10 scale the page shows ("4.4"). */
function pillarDisplay(score01: number): number {
  return Number((score01 * 10).toFixed(1));
}

/** Country phrases each locale's templates use (see country-summary-copy.ts). */
function nameSlots(lang: Lang, iso3: string, name: string): Record<string, string> {
  return {
    name: lang === 'en' ? getEnglishCountryPhrase(iso3, name) : name,
    nameIn: getItalianLocative(iso3, name),
    namePrep: getFrenchPreposition(iso3, name),
    nameA: getPortuguesePhrase(iso3, name, 'a'),
    nameDe: getPortugueseDe(iso3, name),
    nameFuer: getGermanFuerPhrase(iso3, name),
  };
}

/** Published levels (1..4) of the country's government advisories, ignoring malformed entries. */
export function advisoryLevels(country: Pick<ScoredCountry, 'advisories'>): number[] {
  return Object.values(country.advisories ?? {})
    .map((info) => Number(info?.level))
    .filter((level) => Number.isInteger(level) && level >= 1 && level <= 4);
}

/** "Of the 22 governments that publish a travel advisory for Ecuador, 1 advises …" (or its none/one/all variants). */
export function buildAdvisorySentence(levels: readonly number[], lang: Lang, names: Record<string, string>): string {
  const copy = countrySummaryCopy[lang];
  const n = levels.length;
  if (n === 0) return fill(copy.advisoryNone, names);

  const counts = new Map<number, number>();
  for (const level of levels) counts.set(level, (counts.get(level) ?? 0) + 1);
  const phrase = (level: number, count: number): string =>
    copy.levelPhrases[level as 1 | 2 | 3 | 4][count === 1 ? 0 : 1];

  if (n === 1) return fill(copy.advisoryOne, { ...names, phrase: phrase(levels[0], 1) });
  if (counts.size === 1) return fill(copy.advisoryAll, { ...names, n: String(n), phrase: phrase(levels[0], n) });

  // Mildest level first, as the levels are numbered.
  const items = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => fill(copy.breakdownItem, { count: String(count), phrase: phrase(level, count) }));
  // German closes an infinitive clause ("raten, die Reise zu überdenken") with a comma before the next item.
  const closed = lang === 'de' ? items.map((item, i) => (i < items.length - 1 && item.includes(',') ? `${item},` : item)) : items;
  const breakdown =
    closed.length === 1
      ? closed[0]
      : `${closed.slice(0, -1).join(copy.listSeparator)}${copy.listLastSeparator}${closed[closed.length - 1]}`;
  return fill(copy.advisoryMany, { ...names, n: String(n), breakdown });
}

/**
 * The pillars a traveller meets directly. Governance (rule of law, corruption, public
 * administration) is context: the methodology weighs it least (15%) and calls it an indirect
 * factor, so it is named only when every direct-risk pillar is at 7.0 or above.
 */
const DIRECT_RISK_PILLARS: ReadonlySet<PillarName> = new Set(['conflict', 'crime', 'health', 'environment']);

/** Pillar weights of the current formula (weights.json), for the drag measure below. */
const PILLAR_WEIGHT: ReadonlyMap<string, number> = new Map(weightsConfig.pillars.map((p) => [p.name, p.weight]));

/**
 * How much a pillar pulls the score down: w * -ln(p). The score is a weighted geometric mean, so
 * this is the pillar's exact share of the shortfall in log terms; it ranks a 4.4 crime pillar
 * (25%) above a 5.0 natural-hazards pillar (10%), as a traveller would.
 */
function pillarDrag(pillar: PillarScore): number {
  return (PILLAR_WEIGHT.get(pillar.name) ?? 0) * -Math.log(Math.max(0.02, pillar.score));
}

/** How the summary and the FAQ frame the driver pillar. */
export type DriverFrame = 'mainRisk' | 'concern' | 'weakest' | 'allGood';

/**
 * The pillar the summary and the FAQ's "biggest risk" answer talk about, and how to frame it:
 *  - among the direct-risk pillars below 7.0, the one that pulls the score down the most:
 *    'mainRisk' when it is below 5.0, otherwise 'concern';
 *  - when every direct-risk pillar is at 7.0+, the lowest pillar overall: 'weakest' when it is
 *    below 7.0 (governance), 'allGood' when every pillar is at 7.0 or above.
 * Only pillars with enough data coverage are considered (as selectPillarExtremes), falling back to
 * all pillars when none qualifies. Examples on 2026-10-14: Ecuador names crime (4.4, not
 * governance 4.0), Germany natural hazards (6.7), North Korea conflict (4.9).
 */
export function selectDriverPillar(pillars: readonly PillarScore[]): { pillar: PillarScore; frame: DriverFrame } {
  const covered = pillars.filter((p) => p.dataCompleteness >= MIN_PILLAR_COVERAGE);
  const eligible = covered.length > 0 ? covered : [...pillars];
  const weakDirect = eligible.filter((p) => DIRECT_RISK_PILLARS.has(p.name) && pillarDisplay(p.score) < STRONG_PILLAR_MIN);
  if (weakDirect.length > 0) {
    const pillar = weakDirect.reduce((a, b) => (pillarDrag(b) > pillarDrag(a) ? b : a));
    return { pillar, frame: pillarDisplay(pillar.score) < MAIN_RISK_MAX ? 'mainRisk' : 'concern' };
  }
  const pillar = eligible.reduce((a, b) => (b.score < a.score ? b : a));
  return { pillar, frame: pillarDisplay(pillar.score) < STRONG_PILLAR_MIN ? 'weakest' : 'allGood' };
}

/** The driver sentence: the concrete indicator behind the driver pillar, or a plain fallback naming the pillar. */
function buildDriverSentence(country: ScoredCountry, lang: Lang): { text: string; pillar: PillarScore; frame: DriverFrame } {
  const copy = countrySummaryCopy[lang];
  const { pillar, frame } = selectDriverPillar(country.pillars);
  const driver = selectPillarDriver(pillar);
  const described = driver ? describeDriver(driver, lang) : null;
  if (!described) {
    const text = fill(copy.driverFallback, { pillar: copy.pillarArea[pillar.name], score: pillarDisplay(pillar.score).toFixed(1) });
    return { text, pillar, frame };
  }
  const template =
    frame === 'mainRisk' ? copy.driverMainRisk : frame === 'concern' ? copy.driverConcern : frame === 'weakest' ? copy.driverWeakest : copy.driverAllGood;
  return { text: fill(template, described), pillar, frame };
}

/**
 * "Its best-rated area is health (8.9/10)." Only next to a risk or a concern, and only when that
 * pillar is at 7.0 or above: a pillar that is merely less bad than the others is never presented
 * as a strength.
 */
function buildStrongAreaSentence(country: ScoredCountry, lang: Lang, driverPillar: PillarScore, frame: DriverFrame): string | null {
  if (frame !== 'mainRisk' && frame !== 'concern') return null;
  const { strongest, isNearTie } = selectPillarExtremes(country.pillars);
  const value = pillarDisplay(strongest.score);
  if (isNearTie || strongest.name === driverPillar.name || value < STRONG_PILLAR_MIN) return null;
  const copy = countrySummaryCopy[lang];
  return fill(copy.strongArea, { pillar: copy.pillarArea[strongest.name], score: value.toFixed(1) });
}

/** The whole summary paragraph for one country, as plain text. */
export function buildCountrySummary(country: ScoredCountry, ctx: SummaryContext): string {
  const { lang } = ctx;
  const copy = countrySummaryCopy[lang];
  const names = nameSlots(lang, country.iso3, ctx.name);
  const joiner = lang === 'zh' ? '' : ' ';
  const advisory = buildAdvisorySentence(advisoryLevels(country), lang, names);
  const sentence = (text: string): string => (lang === 'en' ? capitalizeFirst(text) : text);

  if (!isScored(country)) {
    return [fill(copy.grey, names), advisory].map(sentence).join(joiner);
  }

  const { riskLabel } = getBandVerdictCopy(country.score, lang);
  const date = new Date(ctx.snapshotDate).toLocaleDateString(DATE_LOCALE[lang], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const opener = fill(country.confidence < LOW_CONFIDENCE_THRESHOLD ? copy.scoredLowConfidence : copy.scored, {
    ...names,
    score: country.score.toFixed(1),
    date,
    // en band labels are title-cased for the hero pill ("High caution"); inside a sentence they read lowercase.
    riskLevel: lang === 'en' ? riskLabel.charAt(0).toLowerCase() + riskLabel.slice(1) : riskLabel,
    rank: ordinal(ctx.rank, lang),
    total: String(ctx.total),
  });
  const provenance = buildProvenanceSentence(getProvenanceCounts(country), names.name, lang, country.iso3);
  const driver = buildDriverSentence(country, lang);

  return [opener, driver.text, buildStrongAreaSentence(country, lang, driver.pillar, driver.frame), advisory, provenance]
    .filter((s): s is string => Boolean(s))
    .map(sentence)
    .join(joiner);
}
