import type { ScoredCountry, PillarName, PillarScore } from '../pipeline/types';
import type { Lang } from '../i18n/ui';
import { routes } from '../i18n/ui';
import { getLocalizedCountryName, loadGlobalHistory, loadLatestSnapshot } from './scores';
import { getLastmodMap } from './lastmod';
import { getRegion } from './regions';
import { countryFaqCopy, advisoryLevelWords } from './country-faq-copy';
import { COUNTRY_COUNT, SOURCE_COUNT_DISPLAY } from './site-stats';
import { CONTACT_EMAIL } from './contact';
import wikidataMapJson from '../data/countries-wikidata.json';
// 2026-09-25 audit fix round (I4/C2/I1/C7): buildCountryMetaDescription and the
// country-FAQ functions below now derive their risk label, strongest/weakest
// pillar and provenance clause from the same shared helpers AnswerFirstParagraph
// uses, instead of each keeping its own copy — see the docstring in each module.
import { getBand } from './bands';
import { getBandVerdictCopy, getInlineRiskLabel } from './band-copy';
import { LOW_CONFIDENCE_THRESHOLD } from './confidence';
import { getProvenanceCounts, buildProvenanceSentence } from './provenance-copy';
import { isScored } from './score-status';
import { advisoryLevels, buildAdvisorySentence, nameSlots } from './country-summary';
import { formatTenths } from './display-number';
import { advisoryEntries, getAdvisoryConsensus, type AdvisoryConsensus } from './advisory-consensus';
import { selectPillarFocus, type PillarFocus, type PillarView } from './pillar-focus';
import {
  adviceSlots,
  buildAdviceClause,
  buildAdvisoryPressureSentence,
  buildBestSentence,
  buildEstimatesSentence,
  buildFocusSentences,
  buildGovernanceContext,
  buildTieSentence,
  describeFocusDriver,
  fillTemplate,
  hasLowDirectEstimate,
  joinList,
} from './pillar-narrative';
import { countrySummaryCopy } from '../i18n/country-summary-copy';
import { getCountryByIso2 } from '../pipeline/config/countries';
import {
  getEnglishCountryPhrase,
  getItalianLocative,
  getPortugueseDe,
  getPortuguesePhrase,
  getPortugueseWithArticle,
  getGermanDirectional,
  getGermanFuerPhrase,
  getGermanNominative,
  isGermanPlural,
  getFrenchPreposition,
} from '../i18n/country-grammar';
import { getFrenchDefinite, getGermanUeberPhrase } from '../i18n/country-name-forms';

// ISO3 → Wikidata QID + English Wikipedia article (fallback), plus per-language
// Wikipedia articles where they exist, for Place.sameAs entity grounding (helps
// AI answer engines and Google disambiguate the country entity in each locale).
const wikidataMap = wikidataMapJson as Record<
  string,
  { qid?: string; wikipedia?: string; wikipediaByLang?: Partial<Record<Lang, string>> }
>;

// Locale maps for consistent 7-language handling. Exported so callers that
// build their own JSON-LD nodes outside this file (e.g. hub pages) can stay
// in sync instead of hand-rolling a second copy of the same 7 BCP-47 tags.
export const localeMap: Record<Lang, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', zh: 'zh-CN', de: 'de-DE' };

// ---------- stable @id anchors (2026-09 SEO audit, S1/S8) ----------
// Before this fix, every JSON-LD node on the site was an island: nothing
// referenced anything else by @id, even within the same page's own @graph,
// and WebSite/Organization/Person were duplicated inline (sometimes with
// diverging fields, e.g. two different Person.url values — S8) instead of
// being pointed at from a single canonical node. Using the SAME @id string
// on every page that defines or references these entities lets Google (and
// any other JSON-LD consumer) consolidate them into one real-world entity
// across the whole site — the documented purpose of @id at this scale
// (site-wide entities defined once, referenced by @id elsewhere), rather
// than re-embedding a full definition on every one of the ~1,900 pages.
export const WEBSITE_ID = 'https://isitsafetotravel.org/#website';
export const ORGANIZATION_ID = 'https://isitsafetotravel.org/#organization';
export const AUTHOR_ID = 'https://isitsafetotravel.org/#author';

/**
 * Earliest date in the historical score archive (data/scores/history-index.json),
 * used as the start of Dataset.temporalCoverage (I11: the JSON-LD hardcoded
 * "2025/.." while the real archive goes back to 2012-03-19). Lazily cached at
 * module scope — history-index.json is tens of MB, and buildCountryJsonLd runs
 * once per country per language (~1,736 times per build), so re-parsing it on
 * every call would be a serious build-time regression (see CLAUDE.md "Known
 * constraints"). loadGlobalHistory() already returns points in ascending date
 * order, so the first entry is the earliest.
 */
let cachedHistoryStartDate: string | null | undefined;
function getHistoryStartDate(): string | null {
  if (cachedHistoryStartDate === undefined) {
    const history = loadGlobalHistory();
    cachedHistoryStartDate = history.length > 0 ? history[0].date : null;
  }
  return cachedHistoryStartDate;
}

/** Dataset.temporalCoverage as an open-ended ISO 8601 interval starting where the
 * published history actually begins, falling back to the site-launch date only
 * if the archive is unreadable (defensive — loadGlobalHistory() already handles
 * a missing file by returning []). */
function buildTemporalCoverage(): string {
  return `${getHistoryStartDate() ?? '2026-03-19'}/..`;
}

// "Global" as a Dataset.spatialCoverage Place name, localized (S2/S10): the two
// site-wide Dataset builders used to disagree on both the shape (string vs
// Place object) and language (always English) of this field.
const globalPlaceName: Record<Lang, string> = {
  en: 'Global', it: 'Globale', es: 'Global', fr: 'Mondial', pt: 'Global', zh: '全球', de: 'Weltweit',
};

// Shared distribution list for the two site-wide Dataset nodes (homepage +
// methodology) and /en/api/ (which spreads buildDatasetJsonLd() as its base —
// S4: the API page documents 6 endpoints but the Dataset only ever declared
// one DataDownload). Kept to the 4 machine-readable/bulk downloads; the two
// parameterized endpoints (/history/{iso3}.json, /trend/{iso3}.json) and the
// per-country SVG badge aren't a single static resource so don't fit DataDownload.
const SITE_DATASET_DISTRIBUTION: Record<string, unknown>[] = [
  { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: 'https://isitsafetotravel.org/scores.json' },
  // CSV twin of scores.json (src/lib/dataset-csv.ts / src/pages/scores.csv.ts) —
  // Google Dataset Search's own guidance recommends at least one non-JSON,
  // spreadsheet-friendly distribution alongside the machine format.
  { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: 'https://isitsafetotravel.org/scores.csv' },
  { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: 'https://isitsafetotravel.org/map-data.json' },
  { '@type': 'DataDownload', encodingFormat: 'text/markdown', contentUrl: 'https://isitsafetotravel.org/llms.txt' },
  { '@type': 'DataDownload', encodingFormat: 'text/markdown', contentUrl: 'https://isitsafetotravel.org/llms-full.txt' },
];

/**
 * The current data-revision number, as Dataset.version (Google Dataset Search:
 * "Text or Number — dataset version number"). Lazily read from the live
 * snapshot rather than hardcoded so it can never drift the way the old fixed
 * source counts did (see site-stats.ts's header comment for that history);
 * falls back to '1' for the pre-dataRevision snapshot format (see
 * DailySnapshot.dataRevision's own docstring in pipeline/types.ts).
 */
function getCurrentDataVersion(): string {
  return String(loadLatestSnapshot()?.dataRevision ?? 1);
}

/**
 * Minimal DataCatalog node for Dataset.includedInDataCatalog (Google Dataset
 * Search: "parent repository containing the dataset"). Inlined rather than a
 * separate top-level @graph node with its own @id: every caller of
 * buildDatasetJsonLd/buildMethodologyDatasetJsonLd assembles its own ad hoc
 * @graph array (homepage, /api/, /cite-this-data/, methodology), so a new
 * required sibling node would mean touching all four call sites; an inline
 * object is valid JSON-LD and needs none of that. Always points at the
 * English /api/ page (the one documented entry point for the whole dataset),
 * regardless of the current page's own language — same non-localized-anchor
 * pattern as WEBSITE_ID/ORGANIZATION_ID.
 */
function buildDataCatalog(): Record<string, unknown> {
  return {
    '@type': 'DataCatalog',
    name: 'IsItSafeToTravel Open Data',
    url: `https://isitsafetotravel.org/en/${routes.en.api}/`,
  };
}

// Human-readable region names for Place.containedInPlace (schema.org), per locale.
// Keep all 7 langs covered for every region key so non-EN pages don't leak English text.
const regionDisplayNames: Record<string, Record<Lang, string>> = {
  europe: { en: 'Europe', it: 'Europa', es: 'Europa', fr: 'Europe', pt: 'Europa', zh: '欧洲', de: 'Europa' },
  asia: { en: 'Asia', it: 'Asia', es: 'Asia', fr: 'Asie', pt: 'Ásia', zh: '亚洲', de: 'Asien' },
  africa: { en: 'Africa', it: 'Africa', es: 'África', fr: 'Afrique', pt: 'África', zh: '非洲', de: 'Afrika' },
  americas: { en: 'Americas', it: 'Americhe', es: 'América', fr: 'Amériques', pt: 'Américas', zh: '美洲', de: 'Amerika' },
  oceania: { en: 'Oceania', it: 'Oceania', es: 'Oceanía', fr: 'Océanie', pt: 'Oceania', zh: '大洋洲', de: 'Ozeanien' },
  middle_east: { en: 'Middle East', it: 'Medio Oriente', es: 'Oriente Medio', fr: 'Moyen-Orient', pt: 'Oriente Médio', zh: '中东', de: 'Naher Osten' },
};

// Pillar name translations for meta descriptions
const pillarLabels: Record<Lang, Record<PillarName, string>> = {
  en: { conflict: 'conflict', crime: 'crime', health: 'health', governance: 'governance', environment: 'natural hazards' },
  it: { conflict: 'conflitto', crime: 'criminalità', health: 'salute', governance: 'governance', environment: 'rischi naturali' },
  es: { conflict: 'conflicto', crime: 'criminalidad', health: 'salud', governance: 'gobernanza', environment: 'riesgos naturales' },
  fr: { conflict: 'conflit', crime: 'criminalité', health: 'santé', governance: 'gouvernance', environment: 'risques naturels' },
  pt: { conflict: 'conflito', crime: 'criminalidade', health: 'saúde', governance: 'governança', environment: 'riscos naturais' },
  zh: { conflict: '冲突', crime: '犯罪', health: '健康', governance: '治理', environment: '自然灾害' },
  de: { conflict: 'Konflikt', crime: 'Kriminalität', health: 'Gesundheit', governance: 'Regierungsführung', environment: 'Naturgefahren' },
};

/**
 * Meta description of a grey place (formula v10 insufficient_data): no score, band or pillar.
 * The four-source floor is spelled out ("four"): validate-seo reads "<n> sources" as a count claim.
 */
const greyMetaDescriptions: Record<Lang, (name: string) => string> = {
  en: (n) => `${n}: partial data, no official safety score yet (fewer than four independent sources). See the government advisories we have and rate your trip.`,
  it: (n) => `${n}: dati parziali, ancora nessun punteggio di sicurezza ufficiale (meno di quattro fonti indipendenti). Vedi gli avvisi disponibili e valuta il tuo viaggio.`,
  es: (n) => `${n}: datos parciales, aún sin puntuación de seguridad oficial (menos de cuatro fuentes independientes). Consulta los avisos disponibles y valora tu viaje.`,
  fr: (n) => `${n} : données partielles, pas encore de score de sécurité officiel (moins de quatre sources indépendantes). Consultez les avis disponibles et notez votre voyage.`,
  pt: (n) => `${n}: dados parciais, ainda sem pontuação de segurança oficial (menos de quatro fontes independentes). Veja os alertas disponíveis e avalie sua viagem.`,
  zh: (n) => `${n}数据不完整，暂无官方安全评分（独立来源不足四个）。查看现有的政府旅行警告，并分享您的旅行感受。`,
  de: (n) => `${n}: unvollständige Datenlage, noch keine offizielle Sicherheitsbewertung (weniger als vier unabhängige Quellen). Reisehinweise ansehen und Reise bewerten.`,
};

/**
 * The pillar clause of the meta description, by focus frame (src/lib/pillar-focus.ts, the same pillar
 * the summary and the FAQ name). "Main risk" only below 5.0, "main concern" up to 6.9; when every
 * pillar is at 7.0+ the clause says so instead of calling a strong pillar the main risk (2026-10-15
 * audit, I30: "Hauptrisiko: Regierungsführung (8.0)").
 */
const metaFocusClauses: Record<Lang, Record<'mainRisk' | 'concern' | 'weakest' | 'allGood' | 'allGoodMeasured', (p: string, s: string) => string>> = {
  en: {
    mainRisk: (p, s) => `Main risk: ${p} (${s}).`,
    concern: (p, s) => `Main concern: ${p} (${s}).`,
    weakest: (p, s) => `Weakest area: ${p} (${s}).`,
    allGood: (p, s) => `All five areas at 7/10 or better; lowest: ${p} (${s}).`,
    allGoodMeasured: (p, s) => `Every measured area at 7/10 or better; lowest: ${p} (${s}).`,
  },
  it: {
    mainRisk: (p, s) => `Rischio principale: ${p} (${s}).`,
    concern: (p, s) => `Criticità principale: ${p} (${s}).`,
    weakest: (p, s) => `Area più debole: ${p} (${s}).`,
    allGood: (p, s) => `Tutte e cinque le aree almeno a 7/10; la più bassa: ${p} (${s}).`,
    allGoodMeasured: (p, s) => `Aree misurate tutte almeno a 7/10; la più bassa: ${p} (${s}).`,
  },
  es: {
    mainRisk: (p, s) => `Mayor riesgo: ${p} (${s}).`,
    concern: (p, s) => `Principal preocupación: ${p} (${s}).`,
    weakest: (p, s) => `Área más débil: ${p} (${s}).`,
    allGood: (p, s) => `Las cinco áreas, con 7/10 o más; la más baja: ${p} (${s}).`,
    allGoodMeasured: (p, s) => `Áreas medidas, con 7/10 o más; la más baja: ${p} (${s}).`,
  },
  fr: {
    mainRisk: (p, s) => `Risque principal\u00a0: ${p} (${s}).`,
    concern: (p, s) => `Point de vigilance\u00a0: ${p} (${s}).`,
    weakest: (p, s) => `Domaine le plus faible\u00a0: ${p} (${s}).`,
    allGood: (p, s) => `Les cinq domaines à 7/10 ou plus\u00a0; le plus bas\u00a0: ${p} (${s}).`,
    allGoodMeasured: (p, s) => `Domaines mesurés à 7/10 ou plus\u00a0; le plus bas\u00a0: ${p} (${s}).`,
  },
  pt: {
    mainRisk: (p, s) => `Maior risco: ${p} (${s}).`,
    concern: (p, s) => `Principal preocupação: ${p} (${s}).`,
    weakest: (p, s) => `Área mais fraca: ${p} (${s}).`,
    allGood: (p, s) => `As cinco áreas com 7/10 ou mais; a mais baixa: ${p} (${s}).`,
    allGoodMeasured: (p, s) => `Áreas medidas com 7/10 ou mais; a mais baixa: ${p} (${s}).`,
  },
  zh: {
    mainRisk: (p, s) => `主要风险：${p}（${s}分）。`,
    concern: (p, s) => `最需关注：${p}（${s}分）。`,
    weakest: (p, s) => `最薄弱方面：${p}（${s}分）。`,
    allGood: (p, s) => `五个方面均不低于7分，最低为${p}（${s}分）。`,
    allGoodMeasured: (p, s) => `数据充足的方面均不低于7分，最低为${p}（${s}分）。`,
  },
  de: {
    mainRisk: (p, s) => `Hauptrisiko: ${p} (${s}).`,
    concern: (p, s) => `Größte Sorge: ${p} (${s}).`,
    weakest: (p, s) => `Schwächster Bereich: ${p} (${s}).`,
    allGood: (p, s) => `Alle fünf Bereiche bei 7/10 oder mehr; am niedrigsten: ${p} (${s}).`,
    allGoodMeasured: (p, s) => `Gemessene Bereiche bei 7/10 oder mehr; am niedrigsten: ${p} (${s}).`,
  },
};

/**
 * The provenance tail of the meta description with THIS country's own counts (2026-10-15 audit,
 * I13: every page promised "30+ public sources" while its own summary counted, say, 20 advisories
 * and 5 datasets). Phrased as "advisories" and "datasets", never "<n> sources", which validate-seo
 * reads as the site-wide source-count claim.
 */
const metaTails: Record<Lang, (advisories: number, datasets: number) => string> = {
  en: (a, d) => tail(` Based on %s, recalculated daily.`, ' and ', a && `${a} ${a === 1 ? 'advisory' : 'advisories'}`, d && `${d} ${d === 1 ? 'dataset' : 'datasets'}`),
  it: (a, d) => tail(` Basato su %s, ricalcolato ogni giorno.`, ' e ', a && `${a} ${a === 1 ? 'avviso' : 'avvisi'}`, d && `${d} dataset`),
  es: (a, d) => tail(` Basada en %s, recalculada a diario.`, ' y ', a && `${a} ${a === 1 ? 'aviso' : 'avisos'}`, d && `${d} ${d === 1 ? 'conjunto de datos' : 'conjuntos de datos'}`),
  fr: (a, d) => tail(` Fondé sur %s, recalculé chaque jour.`, ' et ', a && `${a} avis`, d && `${d} ${d === 1 ? 'jeu de données' : 'jeux de données'}`),
  pt: (a, d) => tail(` Com base em %s, recalculada diariamente.`, ' e ', a && `${a} ${a === 1 ? 'alerta' : 'alertas'}`, d && `${d} ${d === 1 ? 'conjunto de dados' : 'conjuntos de dados'}`),
  zh: (a, d) => tail(`基于%s，每日重新计算。`, '和', a && `${a}份旅行警告`, d && `${d}个数据集`),
  de: (a, d) => tail(` Aus %s, täglich neu berechnet.`, ' und ', a && `${a} ${a === 1 ? 'Reisehinweis' : 'Reisehinweisen'}`, d && `${d} ${d === 1 ? 'Datensatz' : 'Datensätzen'}`),
};

/** Fills "%s" with the non-empty parts joined by `and`; empty string when there is nothing to count. */
function tail(template: string, and: string, ...parts: Array<string | 0>): string {
  const present = parts.filter((p): p is string => Boolean(p));
  return present.length === 0 ? '' : template.replace('%s', present.join(and));
}

/**
 * Generate a unique meta description for a country page based on score data.
 * Each country gets a differentiated description using its score, risk level,
 * and focus pillar, kept within Google's ~155-character display budget.
 */
export function buildCountryMetaDescription(country: ScoredCountry, lang: Lang): string {
  // Formula v10 grey place: no score, band or pillar figure in the SERP snippet either.
  if (!isScored(country)) {
    return greyMetaDescriptions[lang](getLocalizedCountryName(country, lang));
  }
  const score = country.score;

  // Single source of truth for the risk label (band-copy.ts) — must read the
  // same as ScoreHero's pill, the FAQ verdict and the answer-first paragraph
  // for this score, or the SERP snippet contradicts the page it links to
  // (2026-09-25 audit, I4).
  const { riskLabel: riskLevel } = getBandVerdictCopy(score, lang);

  // The pillar named is the one the summary and the FAQ name (selectPillarFocus), with the same
  // frame, so the snippet never calls a pillar the "main risk" that the page calls a strength.
  const focus = selectPillarFocus(country.pillars);
  const name = getLocalizedCountryName(country, lang);
  const roundedScore = formatTenths(score, lang);
  const labels = pillarLabels[lang];
  const pillarName = focus.focusTie
    ? `${labels[focus.focus.name]}${META_AND[lang]}${labels[focus.focusTie.name]}`
    : labels[focus.focus.name];
  const frameKey = focus.frame === 'allGood' && !focus.allFiveAtLeast7 ? 'allGoodMeasured' : focus.frame;
  const clause = metaFocusClauses[lang][frameKey](pillarName, formatTenths(focus.focus.value, lang));

  // Google truncates meta descriptions around 155-160 characters. The score +
  // focus clause is the part that must always survive, so it is the "base";
  // the provenance/CTA sentence is appended only when it still fits.
  const DESCRIPTION_MAX = 155;
  const bases: Record<Lang, string> = focus.isFlat
    ? {
        // Near-tie (all pillars within half a point, e.g. prior-only territories): no clause
        // naming an arbitrary pillar (2026-09-25 audit, I13).
        en: `${name} safety score: ${roundedScore}/10 (${riskLevel}). All five safety pillars are closely matched.`,
        it: `${name}: sicurezza ${roundedScore}/10 (${riskLevel}). I cinque pilastri di sicurezza sono molto simili tra loro.`,
        es: `${name}: seguridad ${roundedScore}/10 (${riskLevel}). Los cinco pilares de seguridad están muy igualados.`,
        fr: `${name} : sécurité ${roundedScore}/10 (${riskLevel}). Les cinq piliers de sécurité sont très proches les uns des autres.`,
        pt: `${name}: segurança ${roundedScore}/10 (${riskLevel}). Os cinco pilares de segurança estão muito equilibrados entre si.`,
        zh: `${name}当前安全评分为${roundedScore}/10（${riskLevel}），五大安全支柱得分非常接近，没有明显的强项或弱项。`,
        de: `${name}: Sicherheit ${roundedScore}/10 (${riskLevel}). Die fünf Sicherheitssäulen liegen sehr nah beieinander.`,
      }
    : {
        en: `${name} safety score: ${roundedScore}/10 (${riskLevel}). ${clause}`,
        it: `${name}: sicurezza ${roundedScore}/10 (${riskLevel}). ${clause}`,
        es: `${name}: seguridad ${roundedScore}/10 (${riskLevel}). ${clause}`,
        fr: `${name} : sécurité ${roundedScore}/10 (${riskLevel}). ${clause}`,
        pt: `${name}: segurança ${roundedScore}/10 (${riskLevel}). ${clause}`,
        zh: `${name}当前安全评分为${roundedScore}/10（${riskLevel}），综合评估冲突、犯罪、健康、治理和自然灾害五大安全类别。${clause}`,
        de: `${name}: Sicherheit ${roundedScore}/10 (${riskLevel}). ${clause}`,
      };
  // Honest cadence (formula v10, SPEC §7): the SCORE is recalculated daily; most of the data
  // behind it is not ("updated daily" claimed the opposite).
  const { advisoryCount, otherSourceCount } = getProvenanceCounts(country);
  const base = bases[lang];
  const withTail = base + metaTails[lang](advisoryCount, otherSourceCount);
  return withTail.length <= DESCRIPTION_MAX ? withTail : base;
}

/** "crime and health" in the meta description's tie case. */
const META_AND: Record<Lang, string> = { en: ' and ', it: ' e ', es: ' y ', fr: ' et ', pt: ' e ', zh: '和', de: ' und ' };

/**
 * Build JSON-LD structured data for a country detail page.
 * Uses @graph with WebPage and Place nodes.
 */
// ---------- per-Lang JSON-LD string tables (country page) ----------

// WebPage.name (suffix appended to the country name, e.g. "Japan Safety Score")
const webPageNameTemplates: Record<Lang, (name: string) => string> = {
  en: (n) => `${n} Safety Score`,
  it: (n) => `Punteggio di sicurezza ${n}`,
  es: (n) => `Puntuación de seguridad de ${n}`,
  fr: (n) => `Score de sécurité ${n}`,
  pt: (n) => `Pontuação de segurança de ${n}`,
  zh: (n) => `${n} 安全评分`,
  de: (n) => `Sicherheits-Score ${n}`,
};

// Place.description
const placeDescriptions: Record<Lang, (name: string) => string> = {
  en: (n) => `Safety information for ${n}`,
  it: (n) => `Informazioni di sicurezza per ${n}`,
  es: (n) => `Información de seguridad para ${n}`,
  fr: (n) => `Informations de sécurité pour ${n}`,
  pt: (n) => `Informações de segurança sobre ${n}`,
  zh: (n) => `${n} 的安全信息`,
  de: (n) => `Sicherheitsinformationen zu ${n}`,
};

// Risk bands used in TouristDestination.description (Low / Moderate / High risk)
const riskBands: Record<Lang, [string, string, string]> = {
  en: ['Low risk', 'Moderate risk', 'High risk'],
  it: ['rischio basso', 'rischio moderato', 'rischio alto'],
  es: ['riesgo bajo', 'riesgo moderado', 'riesgo alto'],
  fr: ['risque faible', 'risque modéré', 'risque élevé'],
  pt: ['risco baixo', 'risco moderado', 'risco alto'],
  zh: ['低风险', '中等风险', '高风险'],
  de: ['niedriges Risiko', 'mittleres Risiko', 'hohes Risiko'],
};

// TouristDestination.touristType (segment of travellers)
const touristTypes: Record<Lang, [string, string, string]> = {
  en: ['All travelers including families', 'General travelers', 'Adventure travelers'],
  it: ['Tutti i viaggiatori incluse le famiglie', 'Viaggiatori in generale', 'Viaggiatori avventurosi'],
  es: ['Todos los viajeros incluidas las familias', 'Viajeros en general', 'Viajeros de aventura'],
  fr: ['Tous les voyageurs y compris les familles', 'Voyageurs en général', "Voyageurs d'aventure"],
  pt: ['Todos os viajantes incluindo famílias', 'Viajantes em geral', 'Viajantes de aventura'],
  zh: ['所有旅行者（包括家庭）', '普通旅行者', '冒险旅行者'],
  de: ['Alle Reisenden einschließlich Familien', 'Allgemeine Reisende', 'Abenteuerreisende'],
};

// TouristDestination.description
const touristDescriptions: Record<Lang, (name: string, score: string, band: string) => string> = {
  en: (n, s, b) => `Travel safety information for ${n}. Safety score: ${s}/10 (${b}). Data from IsItSafeToTravel.org, score recalculated daily.`,
  it: (n, s, b) => `Informazioni sulla sicurezza dei viaggi per ${n}. Punteggio di sicurezza: ${s}/10 (${b}). Dati da IsItSafeToTravel.org, punteggio ricalcolato ogni giorno.`,
  es: (n, s, b) => `Información de seguridad de viaje para ${n}. Puntuación de seguridad: ${s}/10 (${b}). Datos de IsItSafeToTravel.org, puntuación recalculada a diario.`,
  fr: (n, s, b) => `Informations de sécurité voyage pour ${n}. Score de sécurité : ${s}/10 (${b}). Données de IsItSafeToTravel.org, score recalculé chaque jour.`,
  pt: (n, s, b) => `Informações de segurança de viagem para ${n}. Pontuação de segurança: ${s}/10 (${b}). Dados de IsItSafeToTravel.org, pontuação recalculada diariamente.`,
  zh: (n, s, b) => `${n}旅行安全信息。安全评分：${s}/10（${b}）。数据来自 IsItSafeToTravel.org，评分每日重新计算。`,
  de: (n, s, b) => `Reise-Sicherheitsinformationen für ${n}. Sicherheits-Score: ${s}/10 (${b}). Daten von IsItSafeToTravel.org, Wert täglich neu berechnet.`,
};

// TouristDestination.description of a grey place: no score, no band.
const touristDescriptionsGrey: Record<Lang, (name: string) => string> = {
  en: (n) => `Travel safety information for ${n}. Partial data: no official safety score yet. Government advisories from IsItSafeToTravel.org.`,
  it: (n) => `Informazioni sulla sicurezza dei viaggi per ${n}. Dati parziali: ancora nessun punteggio di sicurezza ufficiale. Avvisi governativi da IsItSafeToTravel.org.`,
  es: (n) => `Información de seguridad de viaje para ${n}. Datos parciales: aún sin puntuación de seguridad oficial. Avisos gubernamentales de IsItSafeToTravel.org.`,
  fr: (n) => `Informations de sécurité voyage pour ${n}. Données partielles : pas encore de score de sécurité officiel. Avis gouvernementaux de IsItSafeToTravel.org.`,
  pt: (n) => `Informações de segurança de viagem para ${n}. Dados parciais: ainda sem pontuação de segurança oficial. Alertas governamentais de IsItSafeToTravel.org.`,
  zh: (n) => `${n}旅行安全信息。数据不完整：暂无官方安全评分。政府旅行警告来自 IsItSafeToTravel.org。`,
  de: (n) => `Reise-Sicherheitsinformationen für ${n}. Unvollständige Datenlage: noch keine offizielle Sicherheitsbewertung. Staatliche Reisehinweise von IsItSafeToTravel.org.`,
};

// Dataset.name (year is appended)
const datasetNames: Record<Lang, (name: string, year: number) => string> = {
  en: (n, y) => `${n} Travel Safety Data ${y}`,
  it: (n, y) => `Dati sulla sicurezza di viaggio ${n} ${y}`,
  es: (n, y) => `Datos de seguridad de viaje ${n} ${y}`,
  fr: (n, y) => `Données de sécurité voyage ${n} ${y}`,
  pt: (n, y) => `Dados de segurança de viagem ${n} ${y}`,
  zh: (n, y) => `${n} 旅行安全数据 ${y}`,
  de: (n, y) => `Reise-Sicherheitsdaten ${n} ${y}`,
};

// Dataset.description
const datasetDescriptions: Record<Lang, (name: string) => string> = {
  en: (n) => `Safety scores for ${n}, recalculated daily from public sources and covering conflict, crime, health, governance and natural hazards.`,
  it: (n) => `Punteggi di sicurezza per ${n}, ricalcolati ogni giorno da fonti pubbliche, che coprono conflitto, criminalità, salute, governance e rischi naturali.`,
  es: (n) => `Puntuaciones de seguridad para ${n}, recalculadas a diario a partir de fuentes públicas, que cubren conflicto, criminalidad, salud, gobernanza y riesgos naturales.`,
  fr: (n) => `Scores de sécurité pour ${n}, recalculés chaque jour à partir de sources publiques et couvrant conflit, criminalité, santé, gouvernance et risques naturels.`,
  pt: (n) => `Pontuações de segurança para ${n}, recalculadas diariamente a partir de fontes públicas, cobrindo conflito, criminalidade, saúde, governança e riscos naturais.`,
  zh: (n) => `${n}综合安全评分，基于冲突、犯罪、健康、治理和自然灾害五大类别加权计算，数据来源公开透明，评分每日重新计算，供出行前参考。`,
  de: (n) => `Sicherheits-Scores für ${n}, täglich aus öffentlichen Quellen neu berechnet, mit den Bereichen Konflikt, Kriminalität, Gesundheit, Regierungsführung und Naturgefahren.`,
};

// Dataset.description of a grey place: what exists, and that no score is published.
const datasetDescriptionsGrey: Record<Lang, (name: string) => string> = {
  en: (n) => `Travel safety data for ${n}: government travel advisories and the few indicators available. Partial data, so no official safety score is published.`,
  it: (n) => `Dati sulla sicurezza di viaggio per ${n}: avvisi di viaggio governativi e i pochi indicatori disponibili. Dati parziali, quindi nessun punteggio di sicurezza ufficiale.`,
  es: (n) => `Datos de seguridad de viaje para ${n}: avisos de viaje gubernamentales y los pocos indicadores disponibles. Datos parciales, por lo que no se publica una puntuación oficial.`,
  fr: (n) => `Données de sécurité voyage pour ${n} : avis gouvernementaux aux voyageurs et les rares indicateurs disponibles. Données partielles, donc aucun score officiel n'est publié.`,
  pt: (n) => `Dados de segurança de viagem para ${n}: alertas de viagem governamentais e os poucos indicadores disponíveis. Dados parciais, por isso não há pontuação oficial publicada.`,
  zh: (n) => `${n}的旅行安全数据：政府旅行警告及少量可用指标。数据不完整，因此不发布官方安全评分。`,
  de: (n) => `Reisesicherheitsdaten für ${n}: staatliche Reisehinweise und die wenigen verfügbaren Indikatoren. Unvollständige Datenlage, daher keine offizielle Sicherheitsbewertung.`,
};

// Dataset.measurementTechnique
const measurementTechniqueByLang: Record<Lang, string> = {
  en: `Uncertainty-weighted (Bayesian shrinkage) weighted geometric mean of 5 category scores from ${SOURCE_COUNT_DISPLAY} public sources including government advisories, World Bank, INFORM, UCDP and GPI indices`,
  it: `Media geometrica ponderata e corretta per l'incertezza (Bayesian shrinkage) di 5 punteggi di categoria da ${SOURCE_COUNT_DISPLAY} fonti pubbliche tra cui avvisi governativi, Banca Mondiale, INFORM, UCDP e indici GPI`,
  es: `Media geométrica ponderada con corrección por incertidumbre (Bayesian shrinkage) de 5 puntuaciones por categoría de ${SOURCE_COUNT_DISPLAY} fuentes públicas incluidos avisos gubernamentales, Banco Mundial, INFORM, UCDP e índices GPI`,
  fr: `Moyenne géométrique pondérée corrigée pour l'incertitude (Bayesian shrinkage) de 5 scores de catégorie provenant de ${SOURCE_COUNT_DISPLAY} sources publiques, dont les avis gouvernementaux, la Banque mondiale, INFORM, UCDP et les indices GPI`,
  pt: `Média geométrica ponderada com correção de incerteza (Bayesian shrinkage) de 5 pontuações de categoria provenientes de ${SOURCE_COUNT_DISPLAY} fontes públicas, incluindo avisos governamentais, Banco Mundial, INFORM, UCDP e índices GPI`,
  zh: `基于来自 ${SOURCE_COUNT_DISPLAY} 个公开来源（包括政府旅行警告、世界银行、INFORM、UCDP 和 GPI 指数）的 5 个类别评分的、经不确定性加权（贝叶斯收缩）的加权几何平均值`,
  de: `Unsicherheitsgewichtetes (Bayesian Shrinkage) gewichtetes geometrisches Mittel aus 5 Kategorie-Scores aus ${SOURCE_COUNT_DISPLAY} öffentlichen Quellen, darunter Regierungs-Reisehinweise, Weltbank, INFORM, UCDP und GPI-Indizes`,
};

// Dataset.variableMeasured entries (PropertyValue name + description)
const datasetVariablesByLang: Record<Lang, { name: string; description: string; unitText?: string }[]> = {
  en: [
    { name: 'Safety Score', description: 'Composite safety score on 1-10 scale', unitText: 'score' },
    { name: 'Conflict Risk', description: 'Armed conflict and political violence risk assessment' },
    { name: 'Crime Risk', description: 'Personal crime and safety risk assessment' },
    { name: 'Health Risk', description: 'Health infrastructure and disease risk assessment' },
    { name: 'Governance', description: 'Rule of law, corruption, and institutional stability' },
    { name: 'Natural Hazard Risk', description: 'Exposure to natural hazards and ongoing natural disasters' },
  ],
  it: [
    { name: 'Punteggio di sicurezza', description: 'Punteggio di sicurezza composito su scala 1-10', unitText: 'score' },
    { name: 'Rischio di conflitto', description: 'Valutazione del rischio di conflitto armato e violenza politica' },
    { name: 'Rischio criminalità', description: 'Valutazione del rischio di criminalità e sicurezza personale' },
    { name: 'Rischio sanitario', description: 'Valutazione del rischio sanitario e delle infrastrutture mediche' },
    { name: 'Governance', description: 'Stato di diritto, corruzione e stabilità istituzionale' },
    { name: 'Rischi naturali', description: 'Esposizione ai rischi naturali e disastri naturali in corso' },
  ],
  es: [
    { name: 'Puntuación de seguridad', description: 'Puntuación de seguridad compuesta en escala 1-10', unitText: 'score' },
    { name: 'Riesgo de conflicto', description: 'Evaluación del riesgo de conflicto armado y violencia política' },
    { name: 'Riesgo de criminalidad', description: 'Evaluación del riesgo de criminalidad y seguridad personal' },
    { name: 'Riesgo sanitario', description: 'Evaluación del riesgo sanitario y de la infraestructura médica' },
    { name: 'Gobernanza', description: 'Estado de derecho, corrupción y estabilidad institucional' },
    { name: 'Riesgos naturales', description: 'Exposición a peligros naturales y desastres naturales en curso' },
  ],
  fr: [
    { name: 'Score de sécurité', description: 'Score de sécurité composite sur une échelle de 1 à 10', unitText: 'score' },
    { name: 'Risque de conflit', description: 'Évaluation du risque de conflit armé et de violence politique' },
    { name: 'Risque de criminalité', description: 'Évaluation du risque de criminalité et de sécurité personnelle' },
    { name: 'Risque sanitaire', description: "Évaluation du risque sanitaire et de l'infrastructure médicale" },
    { name: 'Gouvernance', description: 'État de droit, corruption et stabilité institutionnelle' },
    { name: 'Risques naturels', description: 'Exposition aux risques naturels et catastrophes naturelles en cours' },
  ],
  pt: [
    { name: 'Pontuação de segurança', description: 'Pontuação de segurança composta na escala de 1 a 10', unitText: 'score' },
    { name: 'Risco de conflito', description: 'Avaliação do risco de conflito armado e violência política' },
    { name: 'Risco de criminalidade', description: 'Avaliação do risco de criminalidade e segurança pessoal' },
    { name: 'Risco sanitário', description: 'Avaliação do risco sanitário e da infraestrutura médica' },
    { name: 'Governança', description: 'Estado de direito, corrupção e estabilidade institucional' },
    { name: 'Riscos naturais', description: 'Exposição a riscos naturais e desastres naturais em andamento' },
  ],
  zh: [
    { name: '安全评分', description: '1-10 分制的综合安全评分', unitText: 'score' },
    { name: '冲突风险', description: '武装冲突与政治暴力风险评估' },
    { name: '犯罪风险', description: '人身犯罪与安全风险评估' },
    { name: '健康风险', description: '医疗基础设施与疾病风险评估' },
    { name: '治理', description: '法治、腐败与制度稳定性' },
    { name: '自然灾害风险', description: '自然灾害暴露程度及正在发生的自然灾害' },
  ],
  de: [
    { name: 'Sicherheits-Score', description: 'Zusammengesetzter Sicherheits-Score auf einer Skala von 1 bis 10', unitText: 'score' },
    { name: 'Konfliktrisiko', description: 'Bewertung des Risikos bewaffneter Konflikte und politischer Gewalt' },
    { name: 'Kriminalitätsrisiko', description: 'Bewertung des Risikos persönlicher Kriminalität und Sicherheit' },
    { name: 'Gesundheitsrisiko', description: 'Bewertung von Gesundheitsinfrastruktur und Krankheitsrisiko' },
    { name: 'Regierungsführung', description: 'Rechtsstaatlichkeit, Korruption und institutionelle Stabilität' },
    { name: 'Naturgefahren', description: 'Gefährdung durch Naturgefahren und laufende Naturkatastrophen' },
  ],
};

export function buildCountryJsonLd(country: ScoredCountry, lang: Lang, canonicalUrl: string, dateModified?: string): Record<string, unknown> {
  const countryName = getLocalizedCountryName(country, lang);
  const regionKey = getRegion(country.iso3);
  const regionName = regionDisplayNames[regionKey]?.[lang];
  // Formula v10 grey place: no score, band, tourist segment or score variable anywhere in the
  // graph (validate-seo asserts it); the same five node types are kept.
  const scored = isScored(country);
  const scoreStr = scored ? country.score.toFixed(1) : '';
  // Band on the displayed 1-decimal value so the label matches the number shown.
  const scoreRounded = Number(scoreStr);
  const bandIdx = scoreRounded >= 7 ? 0 : scoreRounded >= 5 ? 1 : 2;
  const band = riskBands[lang][bandIdx];
  const tourType = touristTypes[lang][bandIdx];
  const year = new Date().getFullYear();
  const variables = scored ? datasetVariablesByLang[lang] : datasetVariablesByLang[lang].slice(1);

  // Entity grounding: link the Place node to Wikidata/Wikipedia when we have a
  // mapping. Wikipedia link prefers the article in the PAGE's own language
  // (GEO-07 — it used to always point at en.wikipedia.org, even from it/de/zh
  // country pages) and falls back to the English article when no localized one
  // exists (src/data/countries-wikidata.json, wikipediaByLang, is populated by
  // batched Wikidata sitelinks lookups — not every country has all 7).
  const wikidataEntry = wikidataMap[country.iso3];
  const localizedWikipedia = lang === 'en' ? wikidataEntry?.wikipedia : wikidataEntry?.wikipediaByLang?.[lang] ?? wikidataEntry?.wikipedia;
  const sameAs = wikidataEntry
    ? [
        wikidataEntry.qid && `https://www.wikidata.org/wiki/${wikidataEntry.qid}`,
        localizedWikipedia,
      ].filter(Boolean)
    : [];

  const placeId = `${canonicalUrl}#place`;
  // Minimal-but-connected Organization/Person references (S1/S8): both carry
  // the site-wide stable @id (so Google can consolidate them with the fuller
  // definitions on the homepage / about pages) AND enough inline properties
  // to stand on their own if a page is read in isolation.
  const organizationRef = { '@id': ORGANIZATION_ID, '@type': 'Organization', name: 'IsItSafeToTravel', url: 'https://isitsafetotravel.org/' };
  const authorRef = { '@id': AUTHOR_ID, '@type': 'Person', name: 'Riccardo Dominici' };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl,
        url: canonicalUrl,
        name: webPageNameTemplates[lang](countryName),
        description: buildCountryMetaDescription(country, lang),
        inLanguage: localeMap[lang],
        // Connects this WebPage to the rest of the site graph (S1): part of
        // the WebSite entity, primary entity is the country's own Place node
        // (already defined below, in the same @graph, so a bare @id resolves).
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': placeId },
        author: authorRef,
        publisher: organizationRef,
        ...(dateModified && { dateModified, datePublished: '2026-03-19' }),
      },
      {
        // NOTE: do NOT add aggregateRating/Review here. Google rejects review snippets
        // on a Place node ("Invalid object type for field <parent_node>"), and a computed
        // safety score is not user reviews. Removed twice now — see git a2491daf (Mar 2026)
        // and the May 2026 GSC regression caused by re-adding it in ca86a406.
        '@type': 'Place',
        '@id': placeId,
        name: countryName,
        description: placeDescriptions[lang](countryName),
        ...(sameAs.length > 0 && { sameAs }),
        ...(regionName && { containedInPlace: { '@type': 'Place', name: regionName } }),
      },
      buildCountryFaqJsonLd(country, lang),
      {
        '@type': 'TouristDestination',
        name: countryName,
        description: scored ? touristDescriptions[lang](countryName, scoreStr, band) : touristDescriptionsGrey[lang](countryName),
        ...(scored && { touristType: tourType }),
        url: canonicalUrl,
      },
      {
        '@type': 'Dataset',
        name: datasetNames[lang](countryName, year),
        description: scored ? datasetDescriptions[lang](countryName) : datasetDescriptionsGrey[lang](countryName),
        url: canonicalUrl,
        inLanguage: localeMap[lang],
        license: 'https://creativecommons.org/licenses/by-nc/4.0/',
        isAccessibleForFree: true,
        temporalCoverage: buildTemporalCoverage(),
        // This Dataset is about ONE country, so its spatial coverage is that
        // country's own Place node — already defined above in the same
        // @graph (S10: was missing entirely on country pages; the two
        // site-wide Dataset builders below use a "Global" Place instead).
        spatialCoverage: { '@id': placeId },
        // Same daily snapshot date as WebPage.dateModified / the visible "Last update".
        ...(dateModified && { dateModified }),
        creator: organizationRef,
        variableMeasured: variables.map((v) => ({
          '@type': 'PropertyValue',
          name: v.name,
          description: v.description,
          ...(v.unitText && { unitText: v.unitText }),
        })),
        measurementTechnique: measurementTechniqueByLang[lang],
      },
    ],
  };
}

/**
 * Build JSON-LD structured data for the homepage (WebSite schema).
 * No SearchAction: the site has no query-based search results endpoint, Google
 * crawls the literal {search_term_string} template as a 404, and the sitelinks
 * search box feature it powered was retired by Google in 2024.
 */
export function buildHomepageJsonLd(siteUrl: string, lang: Lang, dateModified?: string): Record<string, unknown> {
  const descriptions: Record<Lang, string> = {
    en: 'Find out how safe your travel destination is',
    it: 'Scopri quanto e sicura la tua destinazione di viaggio',
    es: 'Descubre que tan seguro es tu destino de viaje',
    fr: 'Decouvrez si votre destination de voyage est sure',
    pt: 'Descubra se seu destino de viagem e seguro',
    zh: '了解您的旅行目的地有多安全',
    de: 'Erfahren Sie, wie sicher Ihr Reiseziel ist',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'IsItSafeToTravel',
    url: siteUrl,
    description: descriptions[lang],
    inLanguage: localeMap[lang],
    ...(dateModified && { dateModified, datePublished: '2026-03-19' }),
  };
}

/**
 * Build JSON-LD structured data for the global safety page.
 * Uses a plain WebPage schema (no aggregateRating — Google rejects review snippets here).
 */
export function buildGlobalSafetyJsonLd(
  globalScore: number,
  canonicalUrl: string,
  lang: Lang,
  dateModified?: string,
): Record<string, unknown> {
  const names: Record<Lang, string> = {
    en: 'Global Safety Score',
    it: 'Punteggio di sicurezza globale',
    es: 'Puntuación de seguridad global',
    fr: 'Score de sécurité mondial',
    pt: 'Pontuação de segurança global',
    zh: '全球安全评分',
    de: 'Globaler Sicherheits-Score',
  };

  const descriptions: Record<Lang, string> = {
    en: `Current global safety score: ${globalScore.toFixed(1)}/10. Track world safety trends over time.`,
    it: `Punteggio di sicurezza globale attuale: ${globalScore.toFixed(1)}/10. Segui le tendenze di sicurezza mondiale nel tempo.`,
    es: `Puntuación de seguridad global actual: ${globalScore.toFixed(1)}/10. Sigue las tendencias de seguridad mundial a lo largo del tiempo.`,
    fr: `Score de sécurité mondial actuel : ${globalScore.toFixed(1)}/10. Suivez les tendances de sécurité mondiale.`,
    pt: `Pontuação de segurança global atual: ${globalScore.toFixed(1)}/10. Acompanhe as tendencias de segurança mundial.`,
    zh: `当前全球安全评分：${globalScore.toFixed(1)}/10。跟踪全球安全趋势变化。`,
    de: `Aktueller globaler Sicherheits-Score: ${globalScore.toFixed(1)}/10. Verfolgen Sie weltweite Sicherheitstrends.`,
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonicalUrl,
    url: canonicalUrl,
    name: names[lang],
    description: descriptions[lang],
    inLanguage: localeMap[lang],
    isPartOf: { '@id': WEBSITE_ID },
    ...(dateModified && { dateModified, datePublished: '2026-03-19' }),
  };
}

/**
 * Build Person JSON-LD structured data for the author.
 * Single canonical url + stable @id (S8 — this used to diverge from the
 * `url` inlined into WebPage.author on every country page, so the "same"
 * person read as two disconnected entities). GitHub moves to `sameAs`,
 * matching how buildOrganizationJsonLd already separates url vs sameAs.
 */
export function buildPersonJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': AUTHOR_ID,
    name: 'Riccardo Dominici',
    jobTitle: 'Independent developer and data analyst',
    url: 'https://isitsafetotravel.org/en/about/',
    sameAs: ['https://github.com/RiccardoDominici'],
    email: CONTACT_EMAIL,
  };
}

/** Ship date of the 2026-09-26 visibility pages (index, government advisories, disagreement,
 *  community-vs-data). Their datePublished must be the day they went live, not the site's launch. */
export const VISIBILITY_PAGES_PUBLISHED = '2026-09-26';

/**
 * Build simple WebPage JSON-LD for static pages (methodology, legal).
 * `datePublished` defaults to the site launch; pages that went live later pass their own date.
 */
export function buildWebPageJsonLd(title: string, description: string, canonicalUrl: string, lang: Lang, dateModified?: string, datePublished = '2026-03-19'): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonicalUrl,
    name: title,
    description,
    url: canonicalUrl,
    inLanguage: localeMap[lang],
    isPartOf: { '@id': WEBSITE_ID },
    ...(dateModified && { dateModified, datePublished }),
  };
}

/**
 * Build BreadcrumbList JSON-LD structured data.
 * Each item becomes a ListItem with position, name, and item (url).
 * An entry with no/empty url omits `item` entirely — Google explicitly allows
 * this for the current-page (last) crumb. Never fall back to the site root:
 * that emitted a wrong trail on ~91 hub pages (2026-08 SEO audit).
 */
export function buildBreadcrumbJsonLd(items: { name: string; url?: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url && { item: item.url }),
    })),
  };
}

// Organization.description, localized (S2 — was English-only on 6/7 homepages;
// note the property is *not* `inLanguage`-tagged: schema.org's inLanguage
// domainIncludes only CreativeWork/Event/BroadcastService/etc, not Organization,
// so tagging it here would be inventing a property schema.org doesn't define).
const organizationDescriptions: Record<Lang, (count: number) => string> = {
  en: (n) => `Free travel safety platform providing transparent, data-driven safety scores for ${n} countries worldwide.`,
  it: (n) => `Piattaforma gratuita per la sicurezza di viaggio, con punteggi trasparenti e basati sui dati per ${n} paesi nel mondo.`,
  es: (n) => `Plataforma gratuita de seguridad de viaje, con puntuaciones transparentes y basadas en datos para ${n} países de todo el mundo.`,
  fr: (n) => `Plateforme gratuite de sécurité de voyage, avec des scores transparents et fondés sur les données pour ${n} pays dans le monde.`,
  pt: (n) => `Plataforma gratuita de segurança de viagem, com pontuações transparentes e baseadas em dados para ${n} países em todo o mundo.`,
  zh: (n) => `免费的旅行安全平台，为全球 ${n} 个国家提供透明、基于数据的安全评分。`,
  de: (n) => `Kostenlose Reisesicherheits-Plattform mit transparenten, datenbasierten Sicherheits-Scores für ${n} Länder weltweit.`,
};

/**
 * Build Organization JSON-LD structured data for the homepage.
 */
export function buildOrganizationJsonLd(siteUrl: string, lang: Lang): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'IsItSafeToTravel',
    url: siteUrl,
    description: organizationDescriptions[lang](COUNTRY_COUNT),
    // Google requires a raster logo >= 112x112px; icon-512.png is the largest PNG we ship.
    logo: `${siteUrl}/icon-512.png`,
    // Same canonical Person entity as buildPersonJsonLd (S8) — one @id, one url.
    founder: { '@id': AUTHOR_ID, '@type': 'Person', name: 'Riccardo Dominici' },
    sameAs: ['https://github.com/RiccardoDominici/IsItSafeToTravel'],
    foundingDate: '2026',
  };
}

/**
 * Build FAQPage JSON-LD structured data.
 * Each question/answer pair becomes a Question with acceptedAnswer.
 */
export function buildFaqPageJsonLd(questions: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((qa) => ({
      '@type': 'Question',
      name: qa.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: qa.answer,
      },
    })),
  };
}

/** Capitalise the first letter of each answer part (en pillar names are lowercase labels: I41). */
function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lowercaseFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Get raw FAQ question/answer pairs for a country page.
 * Used by both the JSON-LD builder and the visible FaqSection component.
 * Questions are stable (they match long-standing search queries); answers are
 * assembled from templates in src/lib/country-faq-copy.ts filled with per-country
 * data, so every page gets a self-contained, citable answer.
 *
 * Every pillar the answers name comes from selectPillarFocus (the summary and the meta
 * description use the same selection) and every advisory claim from getAdvisoryConsensus, so the
 * FAQ cannot contradict the rest of the page (2026-10-15 consistency audit).
 */
export function getCountryFaqData(country: ScoredCountry, lang: Lang): { question: string; answer: string }[] {
  const copy = countryFaqCopy[lang];
  const name = getLocalizedCountryName(country, lang);
  // English needs "the" for the plural/union names (the United States, the Philippines...) in
  // every slot; the other locales get their article or preposition from the dedicated slots below.
  const displayName = lang === 'en' ? getEnglishCountryPhrase(country.iso3, name) : name;
  const now = new Date();
  const year = now.getFullYear().toString();
  const monthYear = now.toLocaleDateString(localeMap[lang], { month: 'long', year: 'numeric' });
  const scored = isScored(country);
  const consensus = getAdvisoryConsensus(country);
  // German finite verbs agree with plural names ("die Niederlande zählen").
  const dePlural = isGermanPlural(country.iso3, name);

  // Locale-specific country phrases (country-grammar.ts): each locale's templates only use the
  // slots they need, so computing all of them is harmless.
  const slots: Record<string, string> = {
    name: displayName,
    year,
    monthYear,
    nameIn: getItalianLocative(country.iso3, name),
    namePara: getPortuguesePhrase(country.iso3, name, 'para'),
    nameA: getPortuguesePhrase(country.iso3, name, 'a'),
    nameArt: getPortugueseWithArticle(country.iso3, name),
    nameDe: getPortugueseDe(country.iso3, name),
    nameDir: getGermanDirectional(country.iso3, name),
    nameNom: getGermanNominative(country.iso3, name),
    nameFuer: getGermanFuerPhrase(country.iso3, name),
    nameUeber: getGermanUeberPhrase(country.iso3, name),
    namePrep: getFrenchPreposition(country.iso3, name),
    deZaehlt: dePlural ? 'zählen' : 'zählt',
    deGilt: dePlural ? 'gelten' : 'gilt',
  };
  const fill = (tpl: string, extra: Record<string, string> = {}) => fillTemplate(tpl, { ...slots, ...extra });
  const joiner = lang === 'zh' ? '' : ' ';
  // One answer from its parts: drop empty parts, capitalise each part's first letter (never in
  // zh), single spaces only.
  const answer = (parts: Array<string | null | undefined>): string =>
    parts
      .filter((p): p is string => Boolean(p && p.trim()))
      .map((p) => (lang === 'zh' ? p : capitalizeFirst(p.trim())))
      .join(joiner)
      .replace(/ {2,}/g, ' ')
      .trim();

  // Grey place (formula v10 insufficient_data): A1 says why there is no score (no figure at all),
  // no "biggest risk" answer (its pillar values are internal), A3 the advisories as usual.
  if (!scored) {
    return [
      { question: fill(copy.q1), answer: answer([fill(copy.a1Grey)]) },
      { question: fill(copy.q3), answer: buildAdvisoryAnswer(country, lang, name, consensus, fill, answer, true) },
    ];
  }

  const score = country.score;
  const scoreSlots = { score: formatTenths(score, lang), riskLevel: getInlineRiskLabel(score, lang) };
  const band = getBand(score);
  const focus = selectPillarFocus(country.pillars);

  // A1 opener. The band alone used to decide it, so ARE (7.3, 11 of 21 governments at "reconsider"
  // or worse) opened "Yes, generally" above an advisory answer saying the opposite (I06), and the
  // danger band said "travel requires serious caution" where all 22 governments say "do not
  // travel" (I18). Advisories first, then confidence, then the band.
  const avoidClause = band === 'danger' && consensus.majorityAvoid ? buildAdviceClause(consensus, lang, 'avoid') : null;
  const reconsiderClause = band !== 'danger' ? buildAdviceClause(consensus, lang) : null;
  const opener = avoidClause
    ? fill(copy.a1VerdictAvoid, { ...scoreSlots, ...adviceSlots(avoidClause) })
    : reconsiderClause
      ? fill(copy.a1VerdictAdvisories, { ...scoreSlots, ...adviceSlots(reconsiderClause) })
      : fill(country.confidence < LOW_CONFIDENCE_THRESHOLD ? copy.a1VerdictLowConfidence : copy.a1Verdict[band], scoreSlots);

  // A1 — verdict, how the score works, the focus pillar in one line (same words as the summary),
  // the best area (a strength only at 7.0+), provenance (the country's own counts).
  const provenance = buildProvenanceSentence(getProvenanceCounts(country), displayName, lang, country.iso3);
  const a1 = answer([
    opener,
    copy.a1Formula,
    ...buildFocusSentences(focus, lang, false),
    buildTieSentence(focus, lang),
    buildEstimatesSentence(focus, lang),
    buildBestSentence(focus, lang, true),
    provenance,
  ]);

  // Outside the danger band the pillars can look better than the government advice (ARE, QAT):
  // A2 then says so instead of implying the pillar is the whole story.
  const a2 = answer(buildBiggestRiskParts(focus, lang, consensus, fill, band !== 'danger'));
  const a3 = buildAdvisoryAnswer(country, lang, name, consensus, fill, answer, false);

  return [
    { question: fill(copy.q1), answer: a1 },
    { question: fill(copy.q2), answer: a2 },
    { question: fill(copy.q3), answer: a3 },
  ];
}

/** A2 ("biggest risk") parts, by focus frame. */
function buildBiggestRiskParts(
  focus: PillarFocus,
  lang: Lang,
  consensus: AdvisoryConsensus,
  fill: (tpl: string, extra?: Record<string, string>) => string,
  withAdvisoryNote: boolean,
): Array<string | null> {
  const copy = countryFaqCopy[lang];
  const area = (p: PillarView) => countrySummaryCopy[lang].pillarArea[p.name];
  const pillarSlots = (p: PillarView) => ({ pillar: area(p), pillarScore: formatTenths(p.value, lang) });
  const described = describeFocusDriver(focus, lang);
  const driver = described ? fill(copy.a2Driver, described) : null;
  const advice = withAdvisoryNote ? buildAdviceClause(consensus, lang) : null;
  const advisoryNote = advice ? fill(copy.a2AdvisoryNote, adviceSlots(advice)) : null;
  const pressure = buildAdvisoryPressureSentence(focus, lang, consensus);

  switch (focus.frame) {
    case 'mainRisk':
    case 'concern':
      return [
        fill(copy.a2[focus.frame], pillarSlots(focus.focus)),
        copy.pillarMeaning[focus.focus.name],
        driver ?? pressure,
        buildTieSentence(focus, lang),
        focus.second ? fill(copy.a2Second, pillarSlots(focus.second)) : null,
        buildGovernanceContext(focus, lang, copy.a2GovernanceContext),
        buildEstimatesSentence(focus, lang),
        buildBestSentence(focus, lang, true),
        // Not twice: when the advice already explains the focus pillar, it is said above.
        driver || !pressure ? advisoryNote : null,
      ];
    case 'weakest':
      return [
        fill(hasLowDirectEstimate(focus) ? copy.a2.weakestMeasured : copy.a2.weakest, pillarSlots(focus.focus)),
        copy.pillarMeaning.governance,
        driver,
        buildEstimatesSentence(focus, lang),
        buildBestSentence(focus, lang, true),
        advisoryNote,
      ];
    case 'allGood':
      return [
        fill(focus.allFiveAtLeast7 ? copy.a2.allGood : copy.a2.allGoodMeasured),
        focus.best
          ? fill(copy.a2Range, {
              low: area(focus.focus),
              lowScore: formatTenths(focus.focus.value, lang),
              high: area(focus.best),
              highScore: formatTenths(focus.best.value, lang),
            })
          : null,
        buildEstimatesSentence(focus, lang),
        // "Normal precautions are enough" would contradict a majority of governments advising
        // reconsidering travel (QAT, ARE...): their advice replaces it.
        advisoryNote ?? copy.a2Precautions,
      ];
  }
}

// Priority order for naming governments in Q3 (major advisory issuers first), used to pick a
// stable order among those at the strictest level present.
const ADVISORY_GOV_PRIORITY = [
  'us', 'uk', 'ca', 'au', 'de', 'fr', 'nl', 'nz', 'jp', 'at', 'ch', 'be', 'ie',
  'es', 'it', 'dk', 'se', 'no', 'fi', 'pl', 'cz', 'hu', 'pt', 'ro', 'sg', 'hk',
  'ee', 'hr', 'rs', 'sk', 'cn', 'in', 'br', 'ar', 'ph', 'tw', 'kr',
];

/** Shorter issuer names where the site's own country name is an official long form. */
const ISSUER_NAME_OVERRIDES: Partial<Record<Lang, Record<string, string>>> = {
  zh: { hk: '香港' },
  de: { hk: 'Hongkong' },
};

/**
 * An advisory issuer's name as it stands in the A3 sentence: the site's own country name, with the
 * article en/fr/de need after "from"/"dont"/"darunter" ("the United States", "les États-Unis",
 * "die Vereinigten Staaten"); it/es/pt/zh name issuers bare, in lists, as their press does (I19).
 */
function issuerName(key: string, lang: Lang): string {
  const override = ISSUER_NAME_OVERRIDES[lang]?.[key];
  if (override) return override;
  const iso3 = getCountryByIso2(key === 'uk' ? 'GB' : key.toUpperCase())?.iso3;
  if (!iso3) return key.toUpperCase();
  const bare = getLocalizedCountryName({ iso3, name: {} }, lang);
  if (lang === 'en') return getEnglishCountryPhrase(iso3, bare);
  if (lang === 'fr') return getFrenchDefinite(iso3, bare);
  if (lang === 'de') return getGermanNominative(iso3, bare);
  return bare;
}

/** Issuer list: zh "美国、英国和加拿大", other locales via the summary's list separators. */
function joinIssuers(names: string[], lang: Lang): string {
  if (lang !== 'zh' || names.length <= 1) return joinList(names, lang);
  return `${names.slice(0, -1).join('、')}和${names[names.length - 1]}`;
}

/**
 * A3 of the country FAQ: the government-advisory picture built from the real distribution (the
 * summary's own breakdown sentence, with the date), the strictest level and who issues it when it
 * is stricter than the most common one, and the severe-advisory note when most governments advise
 * against all travel. Never "most governments" for one advisory, never "none above a low level"
 * next to level 3 or 4, and no verdict ("reassuring") at all (2026-10-15 audit, I03 I14 I15).
 * `grey` (formula v10 insufficient_data): no "pillar scores above" to point to and no score note.
 */
function buildAdvisoryAnswer(
  country: ScoredCountry,
  lang: Lang,
  bareName: string,
  consensus: AdvisoryConsensus,
  fill: (tpl: string, extra?: Record<string, string>) => string,
  answer: (parts: Array<string | null | undefined>) => string,
  grey: boolean,
): string {
  const copy = countryFaqCopy[lang];
  const summaryCopy = countrySummaryCopy[lang];
  const entries = advisoryEntries(country);
  const { n, counts, modal, max } = consensus;
  if (n === 0) return answer([fill(grey ? copy.a3NoneGrey : copy.a3None)]);

  const cap = !grey && consensus.majorityAvoid ? copy.a3Cap : null;
  if (n === 1) {
    const level = entries[0].level as 1 | 2 | 3 | 4;
    return answer([fill(copy.a3One, { issuer: issuerName(entries[0].key, lang), phrase: summaryCopy.levelPhrases[level][0] }), cap]);
  }

  const breakdown = buildAdvisorySentence(advisoryLevels(country), lang, nameSlots(lang, country.iso3, bareName));
  const sentence = lang === 'de' ? breakdown.replace(/\.$/, '') : lang === 'zh' ? breakdown : lowercaseFirst(breakdown);

  let strictest: string | null = null;
  if (max > modal) {
    const issuers = entries
      .filter((a) => a.level === max)
      .map((a) => a.key)
      .sort((x, y) => {
        const ix = ADVISORY_GOV_PRIORITY.indexOf(x);
        const iy = ADVISORY_GOV_PRIORITY.indexOf(y);
        return (ix === -1 ? 999 : ix) - (iy === -1 ? 999 : iy);
      });
    const k = issuers.length;
    const named = (k <= 3 ? issuers : issuers.slice(0, 2)).map((key) => issuerName(key, lang));
    const template = k === 1 ? copy.a3Strictest.one : k <= 3 ? copy.a3Strictest.few : copy.a3Strictest.many;
    strictest = fill(template, { level: advisoryLevelWords[lang][max - 1], k: String(k), issuers: joinIssuers(named, lang) });
  }
  // Only levels 1 and 2, mixed: say plainly that no government advises against travel.
  const noneAbove2 = max <= 2 && counts[2] > 0 && counts[2] < n ? copy.a3NoneAbove2 : null;

  return answer([fill(copy.a3AsOf, { sentence }), strictest, noneAbove2, cap]);
}

/**
 * Build FAQPage JSON-LD for a country page with 3 dynamic FAQ items.
 * Returns an object WITHOUT @context so it can be added to an existing @graph.
 */
export function buildCountryFaqJsonLd(country: ScoredCountry, lang: Lang): Record<string, unknown> {
  const faqData = getCountryFaqData(country, lang);
  return {
    '@type': 'FAQPage',
    mainEntity: faqData.map((qa) => ({
      '@type': 'Question',
      name: qa.question,
      acceptedAnswer: { '@type': 'Answer', text: qa.answer },
    })),
  };
}

// Stable @id for the site-wide Dataset entity (all 248 countries) — shared by
// buildDatasetJsonLd (homepage + /en/api/, which spreads it) and
// buildMethodologyDatasetJsonLd (methodology page): same real-world dataset,
// described differently per page context, same pattern as WEBSITE_ID/ORGANIZATION_ID.
export const SITE_DATASET_ID = 'https://isitsafetotravel.org/#dataset';

// Dataset.name/description for the homepage + /en/api/ Dataset node — distinct
// copy from the per-country Dataset above (datasetNames/datasetDescriptions)
// since this one describes the whole 248-country collection, not one country.
const siteDatasetNames: Record<Lang, (year: number) => string> = {
  en: (y) => `Global Travel Safety Scores ${y}`,
  it: (y) => `Punteggi di sicurezza di viaggio globali ${y}`,
  es: (y) => `Puntuaciones de seguridad de viaje globales ${y}`,
  fr: (y) => `Scores de sécurité de voyage mondiaux ${y}`,
  pt: (y) => `Pontuações de segurança de viagem globais ${y}`,
  zh: (y) => `${y} 年全球旅行安全评分`,
  de: (y) => `Globale Reisesicherheits-Scores ${y}`,
};
const siteDatasetDescriptions: Record<Lang, (count: number) => string> = {
  en: (n) => `Safety scores for ${n} countries and territories, recalculated daily from government advisories, health data, conflict indicators and natural-hazard data.`,
  it: (n) => `Punteggi di sicurezza per ${n} paesi e territori, ricalcolati ogni giorno da avvisi governativi, dati sanitari, indicatori di conflitto e dati sui rischi naturali.`,
  es: (n) => `Puntuaciones de seguridad para ${n} países y territorios, recalculadas a diario a partir de avisos gubernamentales, datos sanitarios, indicadores de conflicto y datos de riesgos naturales.`,
  fr: (n) => `Scores de sécurité pour ${n} pays et territoires, recalculés chaque jour à partir des avis gouvernementaux, de données sanitaires, d'indicateurs de conflit et de données sur les risques naturels.`,
  pt: (n) => `Pontuações de segurança para ${n} países e territórios, recalculadas diariamente a partir de alertas governamentais, dados de saúde, indicadores de conflito e dados de riscos naturais.`,
  zh: (n) => `${n}个国家和地区的安全评分，每日根据政府旅行警告、卫生数据、冲突指标和自然灾害数据重新计算。`,
  de: (n) => `Sicherheits-Scores für ${n} Länder und Gebiete, täglich neu berechnet aus staatlichen Reisehinweisen, Gesundheitsdaten, Konfliktindikatoren und Daten zu Naturgefahren.`,
};

/**
 * Build Dataset JSON-LD structured data for the homepage (also reused as-is
 * by /en/api/ and /en/cite-this-data/, which override url; ApiDocs.astro also
 * overrides dateModified explicitly with the same snapshot date this function
 * now defaults to on its own).
 * Returns an object WITHOUT @context so it can be added to an existing @graph.
 *
 * `dateModified` defaults to the live snapshot date (getLastmodMap) rather
 * than being required from every caller — added 2026-09 (Google Dataset
 * Search visibility pass) because this Dataset node had NO dateModified at
 * all on the homepage before this, unlike every other dated node on the site.
 */
export function buildDatasetJsonLd(lang: Lang, dateModified: string = getLastmodMap().snapshotDate): Record<string, unknown> {
  const year = new Date().getFullYear();
  return {
    '@type': 'Dataset',
    '@id': SITE_DATASET_ID,
    name: siteDatasetNames[lang](year),
    description: siteDatasetDescriptions[lang](COUNTRY_COUNT),
    url: 'https://isitsafetotravel.org/',
    inLanguage: localeMap[lang],
    license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    // Google Dataset Search-recommended property confirming the data itself
    // isn't paywalled (S7) — distinct from the CC BY-NC "non-commercial" use
    // restriction, which is a licensing term, not an access paywall.
    isAccessibleForFree: true,
    dateModified,
    version: getCurrentDataVersion(),
    temporalCoverage: buildTemporalCoverage(),
    spatialCoverage: { '@type': 'Place', name: globalPlaceName[lang] },
    creator: { '@id': ORGANIZATION_ID, '@type': 'Organization', name: 'IsItSafeToTravel', url: 'https://isitsafetotravel.org/' },
    includedInDataCatalog: buildDataCatalog(),
    // Stable open-source reference for this dataset (Google Dataset Search
    // "identifier": URL/Text/PropertyValue, repeatable) — there is no DOI, so
    // the GitHub repository is the closest thing to a persistent identifier.
    identifier: 'https://github.com/RiccardoDominici/IsItSafeToTravel',
    // Points citers at the ready-made citation formats instead of leaving them
    // to invent their own (schema.org Dataset.citation accepts plain text/URL).
    citation: `https://isitsafetotravel.org/${lang}/${routes[lang].cite}/`,
    variableMeasured: datasetVariablesByLang[lang].map((v) => ({
      '@type': 'PropertyValue',
      name: v.name,
      description: v.description,
      ...(v.unitText && { unitText: v.unitText }),
    })),
    measurementTechnique: measurementTechniqueByLang[lang],
    // S4: was a single DataDownload (scores.json) even though /en/api/ documents
    // 6 endpoints; now the static bulk-download resources (see SITE_DATASET_DISTRIBUTION).
    distribution: SITE_DATASET_DISTRIBUTION,
  };
}

/**
 * Build JSON-LD structured data for the "Cite this data" page.
 * @graph = WebPage + Dataset (reused from buildDatasetJsonLd, as-is) + FAQPage + BreadcrumbList.
 * Inner nodes carry no @context of their own. Deliberately omits HowTo (Google
 * dropped HowTo rich results in 2023).
 */
export function buildCitePageJsonLd(
  title: string,
  description: string,
  canonicalUrl: string,
  lang: Lang,
  breadcrumbItems: { name: string; url: string }[],
  faqItems: { question: string; answer: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl,
        url: canonicalUrl,
        name: title,
        description,
        inLanguage: localeMap[lang],
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': SITE_DATASET_ID },
      },
      buildDatasetJsonLd(lang),
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map((qa) => ({
          '@type': 'Question',
          name: qa.question,
          acceptedAnswer: { '@type': 'Answer', text: qa.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      },
    ],
  };
}

// Dataset.name/description for the methodology page's Dataset node — same
// underlying dataset as buildDatasetJsonLd (shares SITE_DATASET_ID) but
// framed for the methodology audience.
const methodologyDatasetNames: Record<Lang, string> = {
  en: 'IsItSafeToTravel Global Safety Scores',
  it: 'Punteggi di sicurezza globali IsItSafeToTravel',
  es: 'Puntuaciones de seguridad globales de IsItSafeToTravel',
  fr: 'Scores de sécurité mondiaux IsItSafeToTravel',
  pt: 'Pontuações de segurança globais IsItSafeToTravel',
  zh: 'IsItSafeToTravel 全球安全评分',
  de: 'IsItSafeToTravel globale Sicherheits-Scores',
};
const methodologyDatasetDescriptions: Record<Lang, (count: number) => string> = {
  en: (n) => `Composite safety scores for ${n} countries and territories, recalculated daily from ${SOURCE_COUNT_DISPLAY} public data sources.`,
  it: (n) => `Punteggi di sicurezza compositi per ${n} paesi e territori, ricalcolati ogni giorno da ${SOURCE_COUNT_DISPLAY} fonti pubbliche.`,
  es: (n) => `Puntuaciones de seguridad compuestas para ${n} países y territorios, recalculadas a diario a partir de ${SOURCE_COUNT_DISPLAY} fuentes públicas.`,
  fr: (n) => `Scores de sécurité composites pour ${n} pays et territoires, recalculés chaque jour à partir de ${SOURCE_COUNT_DISPLAY} sources publiques.`,
  pt: (n) => `Pontuações de segurança compostas para ${n} países e territórios, recalculadas diariamente a partir de ${SOURCE_COUNT_DISPLAY} fontes públicas.`,
  zh: (n) => `${n}个国家和地区的综合安全评分，每日根据${SOURCE_COUNT_DISPLAY}个公开数据来源重新计算。`,
  de: (n) => `Zusammengesetzte Sicherheits-Scores für ${n} Länder und Gebiete, täglich neu berechnet aus ${SOURCE_COUNT_DISPLAY} öffentlichen Datenquellen.`,
};

/**
 * Build Dataset JSON-LD for methodology pages.
 * Returns an object WITHOUT @context so it can be added to an existing @graph.
 * Same dateModified/version/includedInDataCatalog/identifier/citation additions
 * as buildDatasetJsonLd (2026-09 Google Dataset Search visibility pass) — see
 * that function's docstring.
 */
export function buildMethodologyDatasetJsonLd(lang: Lang, dateModified: string = getLastmodMap().snapshotDate): Record<string, unknown> {
  return {
    '@type': 'Dataset',
    '@id': SITE_DATASET_ID,
    name: methodologyDatasetNames[lang],
    description: methodologyDatasetDescriptions[lang](COUNTRY_COUNT),
    url: 'https://isitsafetotravel.org/',
    inLanguage: localeMap[lang],
    license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    isAccessibleForFree: true,
    dateModified,
    version: getCurrentDataVersion(),
    includedInDataCatalog: buildDataCatalog(),
    identifier: 'https://github.com/RiccardoDominici/IsItSafeToTravel',
    citation: `https://isitsafetotravel.org/${lang}/${routes[lang].cite}/`,
    temporalCoverage: buildTemporalCoverage(),
    spatialCoverage: { '@type': 'Place', name: globalPlaceName[lang] },
    creator: { '@id': ORGANIZATION_ID, '@type': 'Organization', name: 'IsItSafeToTravel', url: 'https://isitsafetotravel.org/' },
    // S9: used to be name-only (no description) on 5 of these 6 PropertyValue
    // entries — now shares the same fully-described per-language table as the
    // homepage/country Dataset nodes instead of a separate, thinner copy.
    variableMeasured: datasetVariablesByLang[lang].map((v) => ({
      '@type': 'PropertyValue',
      name: v.name,
      description: v.description,
      ...(v.unitText && { unitText: v.unitText }),
    })),
    measurementTechnique: measurementTechniqueByLang[lang],
    distribution: SITE_DATASET_DISTRIBUTION,
  };
}

/**
 * Build JSON-LD for the /community-vs-data/ page (route key `community-vs-data`,
 * 2026-09-26 visibility-pages batch).
 * @graph = WebPage (dateModified = today's snapshot date) + BreadcrumbList (same
 * pattern as buildCitePageJsonLd — the visible trail is ALSO rendered by
 * Breadcrumb.astro, which emits its own separate BreadcrumbList script; that
 * duplication is the established convention on this site, not a bug) +
 * ItemList (the gap-sorted ranking). No FAQPage: this page has no visible FAQ.
 *
 * datePublished is pinned to this page's real ship date, NOT the site-wide
 * '2026-03-19' launch constant every other builder in this file uses — those
 * pages genuinely existed since launch; this one did not, and claiming
 * otherwise would be a fabricated date on a YMYL site.
 */
export function buildCommunityVsDataJsonLd(
  title: string,
  description: string,
  canonicalUrl: string,
  lang: Lang,
  breadcrumbItems: { name: string; url: string }[],
  rankedItems: { name: string; url: string }[],
  dateModified?: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl,
        url: canonicalUrl,
        name: title,
        description,
        inLanguage: localeMap[lang],
        isPartOf: { '@id': WEBSITE_ID },
        ...(dateModified && { dateModified, datePublished: VISIBILITY_PAGES_PUBLISHED }),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      },
      {
        '@type': 'ItemList',
        '@id': `${canonicalUrl}#itemlist`,
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        name: title,
        numberOfItems: rankedItems.length,
        itemListElement: rankedItems.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          url: item.url,
        })),
      },
    ],
  };
}

/**
 * Build JSON-LD structured data for the Travel Safety Index page
 * (src/components/TravelSafetyIndexPage.astro) — the flagship "travel safety
 * index" head-term page (2026-09-25 audit, SXO-05). @graph = WebPage +
 * Dataset (reused from buildDatasetJsonLd, pointed at this page's own URL) +
 * ItemList (the visible top-50 ranking) + FAQPage.
 *
 * Deliberately does NOT include a BreadcrumbList node: the page also renders
 * <Breadcrumb>, which emits its own separate BreadcrumbList JSON-LD script —
 * adding a second one here would reproduce the exact duplicate-BreadcrumbList
 * regression already fixed once on /api/ (see the "No inline BreadcrumbList
 * here" comment in ApiDocs.astro). Google/validate-seo.ts see the type either
 * way since both scripts are read from the same rendered page.
 */
export function buildTravelSafetyIndexJsonLd(
  title: string,
  description: string,
  canonicalUrl: string,
  lang: Lang,
  dateModified: string,
  itemListEntries: { name: string; url: string }[],
  faqItems: { question: string; answer: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl,
        url: canonicalUrl,
        name: title,
        description,
        inLanguage: localeMap[lang],
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': SITE_DATASET_ID },
        dateModified,
        datePublished: VISIBILITY_PAGES_PUBLISHED,
      },
      {
        ...buildDatasetJsonLd(lang, dateModified),
        url: canonicalUrl,
      },
      {
        '@type': 'ItemList',
        '@id': `${canonicalUrl}#itemlist`,
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        name: title,
        numberOfItems: itemListEntries.length,
        itemListElement: itemListEntries.map((entry, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: entry.name,
          url: entry.url,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map((qa) => ({
          '@type': 'Question',
          name: qa.question,
          acceptedAnswer: { '@type': 'Answer', text: qa.answer },
        })),
      },
    ],
  };
}

/**
 * Build a generic ItemList JSON-LD node. Returns an object WITHOUT @context
 * (same convention as buildDatasetJsonLd/buildCountryFaqJsonLd above) so a
 * caller building its own @graph by hand — the government-advisories hub,
 * per-issuer pages and the governments-disagree page (2026-09 visibility
 * pages) — can just push it in next to buildWebPageJsonLd/buildBreadcrumbJsonLd
 * without re-deriving the same ItemList shape three times.
 */
export function buildItemListJsonLd(
  name: string,
  description: string,
  url: string,
  items: { name: string; url: string }[],
  order: 'ascending' | 'descending' = 'ascending',
): Record<string, unknown> {
  return {
    '@type': 'ItemList',
    itemListOrder: order === 'ascending' ? 'https://schema.org/ItemListOrderAscending' : 'https://schema.org/ItemListOrderDescending',
    name,
    description,
    url,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}
