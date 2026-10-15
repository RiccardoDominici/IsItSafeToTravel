/**
 * The top summary of a country page (AnswerFirstParagraph.astro), as plain text.
 *
 * Scored country (formula v10, SPEC §7 "Top summary"):
 *   1. score, band and rank among the countries WITH an official score, as of the snapshot date;
 *   2. the focus pillar (src/lib/pillar-focus.ts, the same one the meta description and the FAQ
 *      name) with its concrete driver: the indicator pulling it down the most, in plain words, with
 *      the source's own value, its data year and the source ("The main risk is violent crime: 45.7
 *      homicides per 100,000 people (World Bank, 2023)"), quoted only when that value is bad;
 *      then, when the bars need it, a tie, a lower governance bar and lower estimated bars
 *      (src/lib/pillar-narrative.ts);
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
import type { ScoredCountry } from '../pipeline/types';
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
import { getInlineRiskLabel } from './band-copy';
import { LOW_CONFIDENCE_THRESHOLD } from './confidence';
import { getProvenanceCounts, buildProvenanceSentence } from './provenance-copy';
import { isScored } from './score-status';
import { formatTenths } from './display-number';
import { getAdvisoryConsensus } from './advisory-consensus';
import { selectPillarFocus } from './pillar-focus';
import {
  fixItalianNumberArticles,
  buildAdvisoryLeadSentence,
  buildAdvisoryPressureSentence,
  buildBestSentence,
  buildEstimatesSentence,
  buildFocusSentences,
  buildGovernanceContext,
  buildTieSentence,
} from './pillar-narrative';

export { STRONG_PILLAR_MIN, MAIN_RISK_MAX } from './pillar-focus';

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

/** Country phrases each locale's templates use (see country-summary-copy.ts). */
export function nameSlots(lang: Lang, iso3: string, name: string): Record<string, string> {
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

  const done = (text: string): string => (lang === 'it' ? fixItalianNumberArticles(text) : text);
  if (n === 1) return fill(copy.advisoryOne, { ...names, phrase: phrase(levels[0], 1) });
  if (counts.size === 1) return done(fill(copy.advisoryAll, { ...names, n: String(n), phrase: phrase(levels[0], n) }));

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
  return done(fill(copy.advisoryMany, { ...names, n: String(n), breakdown }));
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

  const date = new Date(ctx.snapshotDate).toLocaleDateString(DATE_LOCALE[lang], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const opener = fill(country.confidence < LOW_CONFIDENCE_THRESHOLD ? copy.scoredLowConfidence : copy.scored, {
    ...names,
    score: formatTenths(country.score, lang),
    date,
    riskLevel: getInlineRiskLabel(country.score, lang),
    rank: ordinal(ctx.rank, lang),
    total: String(ctx.total),
  });
  const provenance = buildProvenanceSentence(getProvenanceCounts(country), names.name, lang, country.iso3);
  const focus = selectPillarFocus(country.pillars);
  const consensus = getAdvisoryConsensus(country);

  // Most governments at "reconsider travel" or worse is the strongest signal on the page: it comes
  // before any pillar. When every government gives the same advice, that sentence says it all and
  // the breakdown below would only repeat it.
  const lead = buildAdvisoryLeadSentence(consensus, lang);
  const unanimous = new Set(consensus.levels).size === 1;

  return [
    opener,
    lead,
    ...buildFocusSentences(focus, lang, true),
    // Right after the focus sentence, so it refers to the focus pillar and not to a tie.
    buildAdvisoryPressureSentence(focus, lang, consensus, lead !== null),
    buildTieSentence(focus, lang),
    buildGovernanceContext(focus, lang),
    buildEstimatesSentence(focus, lang),
    // A strength only at 7.0+: the summary never presents the least-bad pillar as good.
    buildBestSentence(focus, lang, false),
    lead && unanimous ? null : advisory,
    provenance,
  ]
    .filter((s): s is string => Boolean(s))
    .map(sentence)
    .join(joiner);
}
