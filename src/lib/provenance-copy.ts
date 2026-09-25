/**
 * Truthful, per-country provenance sentence for AnswerFirstParagraph and the
 * FAQ's A1 answer (src/lib/seo.ts getCountryFaqData).
 *
 * WHY: both surfaces used to state "calculated daily from 40+ independent
 * public sources" verbatim on *every* country page, including the 17
 * territories (e.g. Jersey, Guernsey) whose `sources` array is empty and whose
 * score is a pure Bayesian prior with zero real evidence (2026-09-25 audit,
 * I1/I12). This module replaces the fixed "40+" claim with the country's own
 * numbers: how many governments actually have an advisory on record for it
 * (`country.advisories`) and how many other data feeds cover it
 * (`country.sources`, excluding the 'advisories' feed itself so the two counts
 * never overlap — see buildSourcesForCountry in the scoring engine).
 */
import type { ScoredCountry } from '../pipeline/types';
import type { Lang } from '../i18n/ui';
import { countryFaqCopy } from './country-faq-copy';
import { getItalianGeneric, getPortugueseWithArticle, getGermanFuerPhrase } from '../i18n/country-grammar';

export interface ProvenanceCounts {
  advisoryCount: number;
  otherSourceCount: number;
}

/** Pure counts derived from a country's own data — no copy, no i18n. */
export function getProvenanceCounts(country: ScoredCountry): ProvenanceCounts {
  const advisoryCount = Object.keys(country.advisories ?? {}).length;
  // 'advisories' is one of the named entries in SourceMeta[] (see SOURCE_CATALOG
  // in engine.ts) — excluded here so it is never counted twice, once as N
  // government advisories and again as one of the "other" data feeds.
  const otherSourceCount = (country.sources ?? []).filter((s) => s.name !== 'advisories').length;
  return { advisoryCount, otherSourceCount };
}

/** Singular/plural "N other public dataset(s)" phrase, per language. */
const otherSourceNoun: Record<Lang, { one: string; other: string }> = {
  en: { one: 'one other public dataset', other: '{n} other public datasets' },
  it: { one: 'un altro dataset pubblico', other: '{n} altri dataset pubblici' },
  es: { one: 'otro conjunto de datos público', other: '{n} otros conjuntos de datos públicos' },
  fr: { one: 'un autre jeu de données public', other: '{n} autres jeux de données publics' },
  pt: { one: 'outro conjunto de dados público', other: '{n} outros conjuntos de dados públicos' },
  zh: { one: '1 个其他公开数据集', other: '{n} 个其他公开数据集' },
  de: { one: 'einen weiteren öffentlichen Datensatz', other: '{n} weitere öffentliche Datensätze' },
};

/**
 * Sentence shown when a country has neither advisories nor other data feeds
 * (17 territories today, e.g. Jersey) — the score is 100% a regional prior.
 * it/pt take `n` as the bare article-bearing noun phrase ("gli Stati Uniti" /
 * "o Japão", from getItalianGeneric / getPortugueseWithArticle) — "Per"/
 * "para" themselves are invariant, so they stay hardcoded here. de takes `n`
 * as the FULL "für ..." phrase already (getGermanFuerPhrase): "für" always
 * governs the accusative, which changes the article itself for masculine
 * countries (der -> den), so it can't be a fixed prefix + unchanging noun
 * phrase the way it/pt can — see country-grammar.ts.
 */
const zeroDataSentence: Record<Lang, (name: string) => string> = {
  en: (n) => `There is no direct data for ${n} yet: the score is a cautious estimate based on its region.`,
  it: (n) => `Per ${n} non ci sono ancora dati diretti: il punteggio è una stima prudente basata sulla sua regione.`,
  es: (n) => `Todavía no hay datos directos para ${n}: la puntuación es una estimación prudente basada en su región.`,
  fr: (n) => `Il n'existe pas encore de données directes pour ${n} : le score est une estimation prudente fondée sur sa région.`,
  pt: (n) => `Ainda não há dados diretos para ${n}: a pontuação é uma estimativa prudente baseada na sua região.`,
  zh: (n) => `目前还没有关于${n}的直接数据：该评分是基于所在地区得出的审慎估计。`,
  de: (n) => `${n} liegen noch keine direkten Daten vor: Der Wert ist eine vorsichtige Schätzung auf Basis der Region.`,
};

/** "It combines {clause} and is recalculated daily" template, {clause} pre-filled. */
const combinesSentence: Record<Lang, (clause: string) => string> = {
  en: (c) => `It combines ${c} and is recalculated daily.`,
  it: (c) => `Il punteggio combina ${c} ed è ricalcolato ogni giorno.`,
  es: (c) => `La puntuación combina ${c} y se recalcula a diario.`,
  fr: (c) => `Le score combine ${c} et est recalculé chaque jour.`,
  pt: (c) => `A pontuação combina ${c} e é recalculada diariamente.`,
  zh: (c) => `该评分综合了${c}，并每日重新计算。`,
  de: (c) => `Der Wert kombiniert ${c} und wird täglich neu berechnet.`,
};

/** How "advisory clause" and "dataset clause" are joined when both are present. */
const andConnector: Record<Lang, string> = {
  en: ' and ',
  it: ' e ',
  es: ' y ',
  fr: ' et ',
  pt: ' e ',
  zh: '和',
  de: ' und ',
};

/**
 * Build the localized provenance sentence for one country. Four structural
 * cases: no data at all, advisories only, other feeds only (not observed live
 * today, but the two counts are structurally independent so this stays
 * defensive), and both — never a single hardcoded "40+" claim.
 *
 * `iso3` is only needed for the zero-data case (it/pt/de need the
 * article-bearing or "für"-accusative form there, not the bare name) — see
 * the zeroDataSentence docstring above.
 */
export function buildProvenanceSentence(counts: ProvenanceCounts, countryName: string, lang: Lang, iso3: string): string {
  const { advisoryCount, otherSourceCount } = counts;

  if (advisoryCount === 0 && otherSourceCount === 0) {
    const zeroDataName =
      lang === 'it' ? getItalianGeneric(iso3, countryName)
      : lang === 'pt' ? getPortugueseWithArticle(iso3, countryName)
      : lang === 'de' ? getGermanFuerPhrase(iso3, countryName)
      : countryName;
    return zeroDataSentence[lang](zeroDataName);
  }

  const advisoryNoun = countryFaqCopy[lang].advisoryCountNoun;
  const advClause = advisoryCount === 1 ? advisoryNoun.one : advisoryNoun.other.replace('{n}', String(advisoryCount));

  const sourceNoun = otherSourceNoun[lang];
  const otherClause = otherSourceCount === 1 ? sourceNoun.one : sourceNoun.other.replace('{n}', String(otherSourceCount));

  let clause: string;
  if (advisoryCount > 0 && otherSourceCount > 0) {
    clause = `${advClause}${andConnector[lang]}${otherClause}`;
  } else if (advisoryCount > 0) {
    clause = advClause;
  } else {
    clause = otherClause;
  }
  return combinesSentence[lang](clause);
}
