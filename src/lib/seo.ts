import type { ScoredCountry, PillarName, PillarScore } from '../pipeline/types';
import type { Lang } from '../i18n/ui';
import { routes } from '../i18n/ui';
import { getLocalizedCountryName, loadGlobalHistory, loadLatestSnapshot } from './scores';
import { getLastmodMap } from './lastmod';
import { getRegion } from './regions';
import { countryFaqCopy, faqPillarLabels, indicatorLabels, advisoryLevelWords, listConnector } from './country-faq-copy';
import { MIN_PILLAR_COVERAGE } from '../pipeline/scoring/engine';
import { COUNTRY_COUNT, SOURCE_COUNT_DISPLAY } from './site-stats';
import { CONTACT_EMAIL } from './contact';
import wikidataMapJson from '../data/countries-wikidata.json';
// 2026-09-25 audit fix round (I4/C2/I1/C7): buildCountryMetaDescription and the
// country-FAQ functions below now derive their risk label, strongest/weakest
// pillar and provenance clause from the same shared helpers AnswerFirstParagraph
// uses, instead of each keeping its own copy — see the docstring in each module.
import { getBand } from './bands';
import { getBandVerdictCopy } from './band-copy';
import { LOW_CONFIDENCE_THRESHOLD } from './confidence';
import { selectPillarExtremes } from './pillar-extremes';
import { getProvenanceCounts, buildProvenanceSentence } from './provenance-copy';
import { isScored } from './score-status';
import { isScoredIndicator } from './indicator-display';
import { selectDriverPillar } from './country-summary';
import {
  getEnglishCountryPhrase,
  getItalianLocative,
  getPortuguesePhrase,
  getPortugueseWithArticle,
  getGermanDirectional,
  isGermanPlural,
  getFrenchPreposition,
} from '../i18n/country-grammar';

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
 * Pick the pillar set eligible to be named as weakest/strongest.
 * Mirrors the engine's own composite-score gate (engine.ts lines 153-157):
 * keep only pillars whose dataCompleteness clears MIN_PILLAR_COVERAGE, but if
 * none clear it fall back to all pillars. This stops sparse micro-territories
 * (e.g. Monaco, whose crime/governance/environment pillars have zero data) from
 * naming a zero-data pillar as their weakest or strongest area.
 */
export function selectEligiblePillars(pillars: PillarScore[]): PillarScore[] {
  const eligible = pillars.filter((p) => p.dataCompleteness >= MIN_PILLAR_COVERAGE);
  return eligible.length > 0 ? eligible : pillars;
}

/**
 * Name the 1-2 lowest-scoring indicators driving a weak pillar, for Q2.
 * All advisory_level_* indicators collapse to the single 'advisory_group'
 * label (counted once, represented by their lowest normalizedValue). Entries
 * are sorted ascending by normalizedValue (lower = bigger drag) and the lowest
 * distinct labels are returned. Returns [] when the pillar yields no usable
 * labels, so the caller can omit the driver clause entirely.
 */
function selectPillarDriverLabels(pillar: PillarScore, lang: Lang): string[] {
  const labelMap = indicatorLabels[lang];
  const entries: { key: string; nv: number }[] = [];
  let advisoryMin: number | null = null;
  for (const ind of pillar.indicators) {
    // A pre-v10 snapshot still lists retired indicators (child mortality, PM2.5, two mislabelled
    // INFORM columns): never name them as what drives a pillar today.
    if (!ind.name.startsWith('advisory_level_') && !isScoredIndicator(ind.name)) continue;
    if (ind.name.startsWith('advisory_level_')) {
      advisoryMin = advisoryMin === null ? ind.normalizedValue : Math.min(advisoryMin, ind.normalizedValue);
    } else if (labelMap[ind.name]) {
      entries.push({ key: ind.name, nv: ind.normalizedValue });
    }
  }
  if (advisoryMin !== null) entries.push({ key: 'advisory_group', nv: advisoryMin });
  entries.sort((a, b) => a.nv - b.nv);
  const labels: string[] = [];
  for (const e of entries) {
    const lbl = labelMap[e.key];
    if (lbl && !labels.includes(lbl)) labels.push(lbl);
    if (labels.length === 2) break;
  }
  return labels;
}

// Priority order for naming governments in Q3 (major advisory issuers first),
// used to pick a stable 1-2 names among those at the highest present level.
const ADVISORY_GOV_PRIORITY = [
  'us', 'uk', 'ca', 'au', 'de', 'fr', 'nl', 'nz', 'jp', 'at', 'ch', 'be', 'ie',
  'es', 'it', 'dk', 'se', 'no', 'fi', 'pl', 'cz', 'hu', 'pt', 'ro', 'sg', 'hk',
  'ee', 'hr', 'rs', 'sk', 'cn', 'in', 'br', 'ar', 'ph',
];

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
 * Generate a unique meta description for a country page based on score data.
 * Each country gets a differentiated description using its score, risk level,
 * and weakest pillar, kept within Google's ~155-character display budget.
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

  // Strongest/weakest via the shared sort-based picker (pillar-extremes.ts):
  // a plain max/min loop names the SAME pillar as both "top concern" and
  // "strongest area" when every pillar is tied (2026-09-25 audit, I13, the
  // same root cause as content.md's C2 in AnswerFirstParagraph). Only
  // pillars with sufficient data coverage are eligible, so a zero-data
  // pillar (e.g. Monaco's crime/governance/environment) is never named.
  // The pillar named is the same one the page's summary and FAQ name (selectDriverPillar in
  // country-summary.ts), so the snippet never contradicts the page.
  const { isNearTie } = selectPillarExtremes(country.pillars);
  const weakest = selectDriverPillar(country.pillars).pillar;

  const weakestScore = (weakest.score * 10).toFixed(1);
  const weakestLabel = pillarLabels[lang][weakest.name];
  const name = getLocalizedCountryName(country, lang);

  const roundedScore = score.toFixed(1);

  // Google truncates meta descriptions around 155-160 characters. The score +
  // top-risk clause is the part that must always survive, so it is the "base";
  // the freshness/CTA sentence is appended only when it still fits. Long
  // country names ("Territorio Britannico dell'Oceano Indiano") are the only
  // cases that lose it — 4-19 territories per language, everything else keeps
  // the full sentence. Measured against the live snapshot: worst case 145-155
  // characters in every locale.
  const DESCRIPTION_MAX = 155;
  const bases: Record<Lang, string> = isNearTie
    ? {
        // Near-tie (all pillars within 0.05, e.g. zero-data territories): no
        // "top concern" clause naming an arbitrary pillar (2026-09-25 audit, I13).
        en: `${name} safety score: ${roundedScore}/10 (${riskLevel}). All five safety pillars are closely matched.`,
        it: `${name}: sicurezza ${roundedScore}/10 (${riskLevel}). I cinque pilastri di sicurezza sono molto simili tra loro.`,
        es: `${name}: seguridad ${roundedScore}/10 (${riskLevel}). Los cinco pilares de seguridad están muy igualados.`,
        fr: `${name} : sécurité ${roundedScore}/10 (${riskLevel}). Les cinq piliers de sécurité sont très proches les uns des autres.`,
        pt: `${name}: segurança ${roundedScore}/10 (${riskLevel}). Os cinco pilares de segurança estão muito equilibrados entre si.`,
        zh: `${name}当前安全评分为${roundedScore}/10（${riskLevel}），五大安全支柱得分非常接近，没有明显的强项或弱项。`,
        de: `${name}: Sicherheit ${roundedScore}/10 (${riskLevel}). Die fünf Sicherheitssäulen liegen sehr nah beieinander.`,
      }
    : {
        en: `${name} safety score: ${roundedScore}/10 (${riskLevel}). Top concern: ${weakestLabel} (${weakestScore}).`,
        it: `${name}: sicurezza ${roundedScore}/10 (${riskLevel}). Rischio principale: ${weakestLabel} (${weakestScore}).`,
        es: `${name}: seguridad ${roundedScore}/10 (${riskLevel}). Mayor riesgo: ${weakestLabel} (${weakestScore}).`,
        fr: `${name} : sécurité ${roundedScore}/10 (${riskLevel}). Risque principal : ${weakestLabel} (${weakestScore}).`,
        pt: `${name}: segurança ${roundedScore}/10 (${riskLevel}). Maior risco: ${weakestLabel} (${weakestScore}).`,
        zh: `${name}当前安全评分为${roundedScore}/10（${riskLevel}），综合评估冲突、犯罪、健康、治理和自然灾害五大安全类别。最需关注：${weakestLabel}（${weakestScore}分）。`,
        de: `${name}: Sicherheit ${roundedScore}/10 (${riskLevel}). Hauptrisiko: ${weakestLabel} (${weakestScore}).`,
      };
  // Computed, not hardcoded: this "tails" block used to declare its own
  // `const sourceCount = 40` right above, a second hardcoded "40+" the 2026-09
  // count-claim sweep initially missed because the literal string "40+" never
  // appeared in source (it was assembled from a bare `40` plus a template
  // literal's own "+") — every grep for the string "40+" walked right past it.
  // Meta descriptions are what Google shows in search results, so this was
  // live on all 1,918 country pages. Caught while building the validate-seo.ts
  // computed-count guard below, which is exactly the kind of drift it exists
  // to catch.
  // Honest cadence (formula v10, SPEC §7): the SCORE is recalculated daily; most of the data
  // behind it is not ("updated daily" claimed the opposite).
  const tails: Record<Lang, string> = {
    en: ` Free score from ${SOURCE_COUNT_DISPLAY} public sources, recalculated daily.`,
    it: ` Punteggio gratuito da ${SOURCE_COUNT_DISPLAY} fonti pubbliche, ricalcolato ogni giorno.`,
    es: ` Puntuación gratuita de ${SOURCE_COUNT_DISPLAY} fuentes públicas, recalculada a diario.`,
    fr: ` Score gratuit issu de ${SOURCE_COUNT_DISPLAY} sources publiques, recalculé chaque jour.`,
    pt: ` Pontuação gratuita de ${SOURCE_COUNT_DISPLAY} fontes públicas, recalculada diariamente.`,
    zh: `评分基于${SOURCE_COUNT_DISPLAY}个公开来源，每日重新计算，免费查询。`,
    de: ` Kostenloser Wert aus ${SOURCE_COUNT_DISPLAY} öffentlichen Quellen, täglich neu berechnet.`,
  };

  const base = bases[lang];
  const withTail = base + tails[lang];
  return withTail.length <= DESCRIPTION_MAX ? withTail : base;
}

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

/**
 * Get raw FAQ question/answer pairs for a country page.
 * Used by both the JSON-LD builder and the visible FaqSection component.
 * Questions are stable (they match long-standing search queries); answers are
 * assembled from banded templates in src/lib/country-faq-copy.ts filled with
 * per-country data, so every page gets a self-contained, citable answer
 * instead of boilerplate that defers to other sections.
 */
export function getCountryFaqData(country: ScoredCountry, lang: Lang): { question: string; answer: string }[] {
  const copy = countryFaqCopy[lang];
  const name = getLocalizedCountryName(country, lang);
  // English needs "the" for the ~15 plural/union country names (the United
  // States, the Philippines...) in EVERY subject-position sentence in this
  // file's "en" entry (q1/q2, a1Verdict, a2, a3Intro...), not just after a
  // preposition — unlike it/pt/de, a bare "United States is one of the
  // safest destinations" is not valid English at all. displayName is what
  // actually goes in the {name} slot; the bare `name` is still what the
  // other locales' preposition/article wrappers below take as input.
  const displayName = lang === 'en' ? getEnglishCountryPhrase(country.iso3, name) : name;
  const now = new Date();
  const year = now.getFullYear().toString();
  const monthYear = now.toLocaleDateString(localeMap[lang], { month: 'long', year: 'numeric' });
  const scored = isScored(country);
  // Grey place (formula v10): no score, band or pillar figure; the slots below are never read.
  const score = scored ? country.score : 0;

  // Single source of truth for band + risk label (band-copy.ts / bands.ts) —
  // must agree with ScoreHero's pill and the answer-first paragraph for this
  // exact score, or the FAQ contradicts the rest of the same page (2026-09-25
  // audit, I4: this used to be its own 3-tier {low,moderate,high} split at the
  // same 7/5 numeric boundaries as ScoreHero's 5-tier one, so e.g. Jersey at
  // 5.6 read "Only for experienced travelers" in the hero and "moderately
  // safe... most trips are trouble-free" in the FAQ, one scroll down).
  const band = getBand(score);
  const { riskLabel: riskLevel } = getBandVerdictCopy(score, lang);
  // Thin/zero-evidence countries (audit C7) get a distinct opener instead of
  // the banded a1Verdict — never a confident "Yes, generally safe" built on a
  // pure regional prior.
  const isLowConfidence = country.confidence < LOW_CONFIDENCE_THRESHOLD;

  // Sort ELIGIBLE pillars weakest-first so answers name the score's actual
  // drivers and never a zero-data pillar (Monaco fix). When only one pillar is
  // eligible, `second` falls back to the weakest so slots never render "undefined".
  const sorted = [...selectEligiblePillars(country.pillars)].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const second = sorted[1] ?? weakest;
  const strongest = sorted[sorted.length - 1];
  const weakest10 = weakest.score * 10;
  const labels = faqPillarLabels[lang];

  // Q2 ("biggest risk") talks about the same pillar as the page summary: the direct-risk pillar
  // that pulls the score down the most (selectDriverPillar, country-summary.ts), which is not
  // always the lowest pillar (Ecuador: crime 4.4, not governance 4.0). Its band picks the A2
  // variant; the "other area to watch" is the lowest remaining pillar.
  const driverPick = selectDriverPillar(country.pillars);
  const riskPillar = driverPick.pillar;
  const risk10 = riskPillar.score * 10;
  const riskOther = sorted.find((p) => p.name !== riskPillar.name) ?? riskPillar;
  const weakestBand: 'critical' | 'mid' | 'strong' =
    driverPick.frame === 'allGood' ? 'strong' : risk10 < 4 ? 'critical' : risk10 < 7 ? 'mid' : 'strong';
  let driverClause = '';
  if (weakestBand !== 'strong') {
    const driverLabels = selectPillarDriverLabels(riskPillar, lang);
    if (driverLabels.length === 1) {
      driverClause = copy.a2DriverClause.one.replace('{labels}', driverLabels[0]);
    } else if (driverLabels.length >= 2) {
      driverClause = copy.a2DriverClause.two.replace('{labels}', driverLabels.slice(0, 2).join(listConnector[lang]));
    }
  }

  // German verb-agreement slots (a1Verdict, a1Drivers.allStrong): predicate
  // adjectives don't inflect for number in German, but the finite verb still
  // must agree with a plural subject — see isGermanPlural's docstring.
  const dePlural = isGermanPlural(country.iso3, name);

  const slots: Record<string, string> = {
    name: displayName,
    year,
    monthYear,
    score: score.toFixed(1),
    riskLevel,
    weakest: labels[weakest.name],
    weakestScore: weakest10.toFixed(1),
    second: labels[second.name],
    secondScore: (second.score * 10).toFixed(1),
    strongest: labels[strongest.name],
    strongestScore: (strongest.score * 10).toFixed(1),
    meaning: copy.pillarMeaning[weakest.name],
    drivers: driverClause,
    // Locale-specific phrases for the templates that put the country name
    // after a preposition or need an article — computed from the bare `name`
    // (not `displayName`, which only applies to English). Harmless to compute
    // for every language: each locale's templates only ever reference the
    // slot(s) it actually needs (see country-grammar.ts).
    nameIn: getItalianLocative(country.iso3, name),
    namePara: getPortuguesePhrase(country.iso3, name, 'para'),
    nameA: getPortuguesePhrase(country.iso3, name, 'a'),
    nameArt: getPortugueseWithArticle(country.iso3, name),
    nameDir: getGermanDirectional(country.iso3, name),
    namePrep: getFrenchPreposition(country.iso3, name),
    deZaehlt: dePlural ? 'zählen' : 'zählt',
    deGilt: dePlural ? 'gelten' : 'gilt',
    deIstSind: dePlural ? 'sind' : 'ist',
    deBirgt: dePlural ? 'bergen' : 'birgt',
    deSchneidet: dePlural ? 'schneiden' : 'schneidet',
  };
  const fill = (tpl: string) => tpl.replace(/\{(\w+)\}/g, (m, key) => slots[key] ?? m);
  const joiner = lang === 'zh' ? '' : ' ';
  // Collapse any double ASCII spaces left when the {drivers} clause is empty.
  const tidy = (s: string) => s.replace(/ {2,}/g, ' ').trim();

  // Grey place (formula v10 insufficient_data): A1 says why there is no score (no figure at all),
  // no "biggest risk" answer (its pillar values are internal), A3 the advisories as usual.
  if (!scored) {
    const a1Grey = tidy(fill(copy.a1Grey));
    const a3Grey = buildAdvisoryAnswer(country, lang, copy, slots, fill, tidy, joiner, true);
    return [
      { question: fill(copy.q1), answer: a1Grey },
      { question: fill(copy.q3), answer: a3Grey },
    ];
  }

  // A1 — verdict, how the score works, why this country's number (drag pillars
  // + what the weakest one means), provenance. Provenance is the country's own
  // advisory/source counts (provenance-copy.ts), never a fixed "40+" claim —
  // shared with AnswerFirstParagraph so the two surfaces never disagree
  // (2026-09-25 audit, I1/I12).
  const drivers = weakest10 >= 7 ? copy.a1Drivers.allStrong : copy.a1Drivers.normal;
  const verdictOpener = isLowConfidence ? copy.a1VerdictLowConfidence : copy.a1Verdict[band];
  const provenance = buildProvenanceSentence(getProvenanceCounts(country), displayName, lang, country.iso3);
  const a1 = tidy([verdictOpener, copy.a1Formula, drivers, provenance].map(fill).join(joiner));

  // A2 — severity-banded "biggest risk" answer about the driver pillar: "biggest risk" phrasing
  // only when the pillar is genuinely weak, so top scorers don't read as alarmist. critical/mid
  // carry the pillar meaning + the indicator-driven {drivers} clause. The 'strong' variant keeps
  // the lowest/highest pillars ("even its weakest area ..."), which is then the same pillar.
  const a2Slots: Record<string, string> =
    weakestBand === 'strong'
      ? slots
      : {
          ...slots,
          weakest: labels[riskPillar.name],
          weakestScore: risk10.toFixed(1),
          second: labels[riskOther.name],
          secondScore: (riskOther.score * 10).toFixed(1),
          meaning: copy.pillarMeaning[riskPillar.name],
        };
  const a2 = tidy(copy.a2[weakestBand].replace(/\{(\w+)\}/g, (m, key) => a2Slots[key] ?? m));

  const a3 = buildAdvisoryAnswer(country, lang, copy, slots, fill, tidy, joiner, false);

  return [
    { question: fill(copy.q1), answer: a1 },
    { question: fill(copy.q2), answer: a2 },
    { question: fill(copy.q3), answer: a3 },
  ];
}

/**
 * A3 of the country FAQ: the government-advisory summary built from country.advisories (count,
 * consensus band, named governments, majority-Level-4 note) or a zero-advisory sentence. `grey`
 * (formula v10 insufficient_data): no "pillar scores above" to point to and no severe-advisory
 * score note, since there is no score.
 */
function buildAdvisoryAnswer(
  country: ScoredCountry,
  lang: Lang,
  copy: (typeof countryFaqCopy)[Lang],
  slots: Record<string, string>,
  fill: (tpl: string) => string,
  tidy: (s: string) => string,
  joiner: string,
  grey: boolean,
): string {
  const advisories = country.advisories ?? {};
  const presentAdvisories = (Object.entries(advisories) as [string, { level: number | string; source?: string }][])
    .map(([key, info]) => ({ key, level: Number(info?.level) }))
    .filter((a) => Number.isFinite(a.level) && a.level >= 1 && a.level <= 4);

  let a3: string;
  if (presentAdvisories.length === 0) {
    a3 = tidy(fill(grey ? copy.a3NoneGrey : copy.a3None));
  } else {
    const n = presentAdvisories.length;
    // Consensus (modal) level; ties resolve to the higher (more cautious) level.
    const counts = [0, 0, 0, 0, 0];
    for (const a of presentAdvisories) counts[a.level]++;
    let modal = 1;
    for (let l = 1; l <= 4; l++) if (counts[l] >= counts[modal]) modal = l;
    const band: 'normal' | 'caution' | 'reconsider' | 'avoid' =
      modal === 1 ? 'normal' : modal === 2 ? 'caution' : modal === 3 ? 'reconsider' : 'avoid';

    // Name the 1-2 governments issuing the strongest (highest-level) warning.
    const maxLevel = Math.max(...presentAdvisories.map((a) => a.level));
    const topKeys = presentAdvisories
      .filter((a) => a.level === maxLevel)
      .map((a) => a.key)
      .sort((x, y) => {
        const ix = ADVISORY_GOV_PRIORITY.indexOf(x);
        const iy = ADVISORY_GOV_PRIORITY.indexOf(y);
        return (ix === -1 ? 999 : ix) - (iy === -1 ? 999 : iy);
      })
      .slice(0, 2);
    const region = new Intl.DisplayNames([localeMap[lang]], { type: 'region' });
    const govNames = topKeys.map((key) => {
      const code = key === 'uk' ? 'GB' : key.toUpperCase();
      let display: string | undefined;
      try {
        display = region.of(code);
      } catch {
        display = undefined;
      }
      if (!display || display === code) {
        display = (advisories as Record<string, { source?: string }>)[key]?.source ?? code;
      }
      return display;
    });
    slots.governments = govNames.length <= 1 ? govNames[0] ?? '' : govNames.join(listConnector[lang]);
    slots.govLevel = advisoryLevelWords[lang][maxLevel - 1];
    slots.advisoryCount = n === 1 ? copy.advisoryCountNoun.one : copy.advisoryCountNoun.other.replace('{n}', String(n));

    const a3Parts = [copy.a3Intro, copy.a3Consensus[band]];
    // v9: no hard cap. This UI heuristic (strict MAJORITY of Level-4 advisories)
    // is a display-only simplification of the engine's actual severeEff
    // (importance-weighted severeShare, count-damped by N_SEV in engine.ts) —
    // when it fires, copy.a3Cap explains the severe-advisory DOWN-WEIGHTING
    // that nudges the score toward a low value, not a cap to a fixed number.
    if (!grey && counts[4] >= Math.ceil(n / 2 + 0.1)) a3Parts.push(copy.a3Cap);
    a3 = tidy(a3Parts.map(fill).join(joiner));
  }
  return a3;
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
