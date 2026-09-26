import type { Lang } from './ui';
import { useTranslations, type TranslationKey } from './utils';
import type { ScoredCountry } from '../pipeline/types';

/**
 * Render-time localization for the country-page data-source list
 * (src/components/country/SourcesList.astro). The pipeline bakes English-only
 * `SourceMeta.description` strings into data/scores/*.json — SOURCE_CATALOG in
 * src/pipeline/scoring/engine.ts for the 7 fixed catalog sources, and
 * buildAdvisoryDescription() for the per-country 'advisories' government list. This
 * module supplies the same facts in the other 6 published languages WITHOUT touching
 * pipeline output, so old snapshots keep rendering correctly and no re-run is needed:
 * SourcesList falls back to the stored English text for 'en' and for anything not
 * (yet) covered here.
 *
 * ADVISORY_CODES below duplicates (does not import) the pipeline's own list, for the
 * same reason src/components/country/AdvisorySection.astro keeps its own local
 * ADVISORY_KEYS copy: this is a render-time i18n module and must not pull the scoring
 * engine's runtime dependency graph (fs/path reads, weights config, etc.) into every
 * one of the ~1,892 static pages that import it transitively via SourcesList.
 */

/** SOURCE_CATALOG keys (src/pipeline/scoring/engine.ts) that carry a fixed, per-source
 *  (not per-country) English description. 'advisories' is deliberately absent — its
 *  description is per-country and handled by buildLocalizedAdvisoryDescription below. */
export type CatalogSourceKey =
  | 'worldbank'
  | 'vdem'
  | 'gpi'
  | 'inform'
  | 'reliefweb'
  | 'gdacs'
  | 'ucdp';

type CatalogDescriptions = Record<CatalogSourceKey, string>;

/**
 * Localized replacements for SOURCE_CATALOG[key].description. English is never listed
 * here — getLocalizedSourceDescription() returns the stored (English) value unchanged
 * for lang 'en', so src/pipeline/scoring/engine.ts stays the single owner of that text.
 *
 * Proper names, dataset titles, DOIs and licence codes are kept exact (matching how
 * the rest of the site already treats them — see e.g. the identical, untranslated
 * 'methodology.source.vdem' citation in every language block of src/i18n/ui.ts); only
 * the descriptive text is translated. Where src/i18n/ui.ts already carries a vetted
 * translated display name for a source ('methodology.source.wb/gpi/inform/reliefweb/
 * gdacs'), that exact wording is reused here for consistency instead of a fresh one.
 */
const CATALOG_DESCRIPTIONS: Record<Exclude<Lang, 'en'>, CatalogDescriptions> = {
  it: {
    worldbank: 'Indicatori di Sviluppo della Banca Mondiale -- tasso di mortalità infantile e inquinamento atmosferico da PM2.5',
    vdem: "V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- indici di Stato di Diritto, Corruzione Politica e Pubblica Amministrazione (Coppedge et al., DOI 10.23696/vdemds26)",
    gpi: 'Indice Globale della Pace (IEP) -- classifica annuale della pacificità',
    inform: 'Indice di Rischio INFORM (ONU OCHA) -- pericolosità, esposizione, vulnerabilità e capacità di risposta',
    reliefweb: 'ReliefWeb (ONU OCHA) -- rapporti sulla situazione umanitaria e allerte per disastri',
    gdacs: 'GDACS (Sistema Globale di Allerta e Coordinamento Disastri) -- allerte per disastri naturali',
    ucdp: 'UCDP Georeferenced Event Dataset (Uppsala Conflict Data Program) -- decessi per conflitti statali e unilaterali, tramite il mirror di Our World in Data (CC-BY)',
  },
  es: {
    worldbank: 'Indicadores de Desarrollo del Banco Mundial -- tasa de mortalidad infantil y contaminación atmosférica por PM2.5',
    vdem: "V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- índices de Estado de Derecho, Corrupción Política y Administración Pública (Coppedge et al., DOI 10.23696/vdemds26)",
    gpi: 'Índice Global de Paz (IEP) -- ranking anual de pacificidad',
    inform: 'Índice de Riesgo INFORM (ONU OCHA) -- peligrosidad, exposición, vulnerabilidad y capacidad de respuesta',
    reliefweb: 'ReliefWeb (ONU OCHA) -- informes de situación humanitaria y alertas de desastres',
    gdacs: 'GDACS (Sistema Global de Alerta y Coordinación de Desastres) -- alertas de desastres naturales',
    ucdp: 'UCDP Georeferenced Event Dataset (Uppsala Conflict Data Program) -- muertes por conflictos estatales y unilaterales, a través del espejo de Our World in Data (CC-BY)',
  },
  fr: {
    worldbank: "Indicateurs de Développement de la Banque Mondiale -- mortalité infantile et pollution de l'air aux PM2,5",
    vdem: "V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- indices d'État de droit, de Corruption Politique et d'Administration Publique (Coppedge et al., DOI 10.23696/vdemds26)",
    gpi: 'Indice Mondial de la Paix (IEP) -- classement annuel de la paix',
    inform: 'Indice de Risque INFORM (ONU OCHA) -- aléas, exposition, vulnérabilité et capacité de réponse',
    reliefweb: 'ReliefWeb (ONU OCHA) -- rapports de situation humanitaire et alertes de catastrophes',
    gdacs: "GDACS (Système Mondial d'Alerte et de Coordination des Catastrophes) -- alertes de catastrophes naturelles",
    ucdp: 'UCDP Georeferenced Event Dataset (Uppsala Conflict Data Program) -- décès liés aux conflits étatiques et unilatéraux, via le miroir Our World in Data (CC-BY)',
  },
  pt: {
    worldbank: 'Indicadores de Desenvolvimento do Banco Mundial -- taxa de mortalidade infantil e poluição atmosférica por PM2,5',
    vdem: "V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- índices de Estado de Direito, Corrupção Política e Administração Pública (Coppedge et al., DOI 10.23696/vdemds26)",
    gpi: 'Índice Global da Paz (IEP) -- ranking anual de pacificidade',
    inform: 'Índice de Risco INFORM (ONU OCHA) -- perigo, exposição, vulnerabilidade e capacidade de resposta',
    reliefweb: 'ReliefWeb (ONU OCHA) -- relatórios de situação humanitária e alertas de desastres',
    gdacs: 'GDACS (Sistema Global de Alerta e Coordenação de Desastres) -- alertas de desastres naturais',
    ucdp: 'UCDP Georeferenced Event Dataset (Uppsala Conflict Data Program) -- mortes por conflitos estatais e unilaterais, via o espelho do Our World in Data (CC-BY)',
  },
  zh: {
    worldbank: '世界银行发展指标——儿童死亡率与 PM2.5 空气污染',
    vdem: 'V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- 法治、政治腐败与公共行政指数 (Coppedge et al., DOI 10.23696/vdemds26)',
    gpi: '全球和平指数（IEP）——年度和平程度排名',
    inform: 'INFORM 风险指数（联合国 OCHA）——灾害强度、暴露度、脆弱性与应对能力',
    reliefweb: 'ReliefWeb（联合国 OCHA）——人道主义局势报告与灾害预警',
    gdacs: 'GDACS（全球灾害预警与协调系统）——自然灾害预警',
    ucdp: 'UCDP Georeferenced Event Dataset（Uppsala Conflict Data Program）——国家间及单方面暴力导致的死亡人数，通过 Our World in Data 镜像获取（CC-BY 许可）',
  },
  de: {
    worldbank: 'Weltbank-Entwicklungsindikatoren -- Kindersterblichkeit und PM2.5-Luftverschmutzung',
    vdem: 'V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- Indizes für Rechtsstaatlichkeit, politische Korruption und öffentliche Verwaltung (Coppedge et al., DOI 10.23696/vdemds26)',
    gpi: 'Globaler Friedensindex (IEP) -- jährliches Friedensranking',
    inform: 'INFORM-Risikoindex (UN OCHA) -- Gefährdung, Exposition, Vulnerabilität und Bewältigungskapazität',
    reliefweb: 'ReliefWeb (UN OCHA) -- humanitäre Lageberichte und Katastrophenwarnungen',
    gdacs: 'GDACS (Globales Katastrophenwarn- und Koordinationssystem) -- Naturkatastrophenwarnungen',
    ucdp: 'UCDP Georeferenced Event Dataset (Uppsala Conflict Data Program) -- staatliche und einseitige Konflikttote, über den Our World in Data-Spiegel (CC-BY)',
  },
};

/**
 * Localize one SOURCE_CATALOG-derived description. Returns `storedDescription`
 * (the English text already baked into data/scores/*.json) unchanged for lang 'en',
 * and as a safety net for any source key this table doesn't (yet) cover — e.g. a new
 * pipeline source added before its translation lands here. Nothing ever disappears.
 */
export function getLocalizedSourceDescription(
  lang: Lang,
  sourceKey: string,
  storedDescription: string,
): string {
  if (lang === 'en') return storedDescription;
  const table = CATALOG_DESCRIPTIONS[lang];
  return table?.[sourceKey as CatalogSourceKey] ?? storedDescription;
}

/** Short "what this measures" labels for the /sources/ methodology tables (baselineSources/
 *  signalSources in src/pages/*\/{sources,fonti,fuentes,sources,fontes,sources,quellen}/index.astro).
 *  Same catalog keys as CatalogSourceKey, minus 'ucdp' (not currently listed on that page). */
type SourceMeasuresKey = 'worldbank' | 'vdem' | 'gpi' | 'inform' | 'reliefweb' | 'gdacs';

export const SOURCE_MEASURES: Record<Exclude<Lang, 'en'>, Record<SourceMeasuresKey, string>> = {
  it: {
    worldbank: 'Mortalità Infantile, Inquinamento Atmosferico da PM2.5',
    vdem: 'Stato di Diritto, Corruzione Politica, Qualità della Pubblica Amministrazione',
    gpi: 'Pace Generale, Sicurezza e Protezione, Militarizzazione',
    inform: 'Salute, Rischio Epidemico, Governance, Rischio Naturale, Rischio Climatico',
    reliefweb: 'Disastri umanitari attivi e crisi in corso',
    gdacs: 'Allerte per disastri naturali (terremoti, alluvioni, cicloni)',
  },
  es: {
    worldbank: 'Mortalidad Infantil, Contaminación Atmosférica por PM2.5',
    vdem: 'Estado de Derecho, Corrupción Política, Calidad de la Administración Pública',
    gpi: 'Paz General, Seguridad y Protección, Militarización',
    inform: 'Salud, Riesgo Epidémico, Gobernanza, Riesgo Natural, Riesgo Climático',
    reliefweb: 'Desastres humanitarios activos y crisis en curso',
    gdacs: 'Alertas de desastres naturales (terremotos, inundaciones, ciclones)',
  },
  fr: {
    worldbank: 'Mortalité Infantile, Pollution Atmosphérique aux PM2,5',
    vdem: "État de Droit, Corruption Politique, Qualité de l'Administration Publique",
    gpi: 'Paix Générale, Sûreté et Sécurité, Militarisation',
    inform: 'Santé, Risque Épidémique, Gouvernance, Risque Naturel, Risque Climatique',
    reliefweb: 'Catastrophes humanitaires actives et crises en cours',
    gdacs: 'Alertes de catastrophes naturelles (séismes, inondations, cyclones)',
  },
  pt: {
    worldbank: 'Mortalidade Infantil, Poluição Atmosférica por PM2,5',
    vdem: 'Estado de Direito, Corrupção Política, Qualidade da Administração Pública',
    gpi: 'Paz Geral, Segurança e Proteção, Militarização',
    inform: 'Saúde, Risco Epidêmico, Governança, Risco Natural, Risco Climático',
    reliefweb: 'Desastres humanitários ativos e crises em curso',
    gdacs: 'Alertas de desastres naturais (terremotos, inundações, ciclones)',
  },
  zh: {
    worldbank: '儿童死亡率、PM2.5 空气污染',
    vdem: '法治、政治腐败、公共行政质量',
    gpi: '总体和平水平、安全与治安、军事化程度',
    inform: '健康、流行病风险、治理、自然灾害风险、气候风险',
    reliefweb: '活跃的人道主义灾难与危机',
    gdacs: '自然灾害预警（地震、洪水、飓风）',
  },
  de: {
    worldbank: 'Kindersterblichkeit, PM2.5-Luftverschmutzung',
    vdem: 'Rechtsstaatlichkeit, politische Korruption, Qualität der öffentlichen Verwaltung',
    gpi: 'Allgemeiner Frieden, Sicherheit & Schutz, Militarisierung',
    inform: 'Gesundheit, Epidemierisiko, Regierungsführung, Naturgefahrenrisiko, Klimarisiko',
    reliefweb: 'Aktive humanitäre Katastrophen und Krisen',
    gdacs: 'Naturkatastrophenwarnungen (Erdbeben, Überschwemmungen, Wirbelstürme)',
  },
};

export function getLocalizedSourceMeasures(
  lang: Lang,
  sourceKey: string,
  storedMeasures: string,
): string {
  if (lang === 'en') return storedMeasures;
  const table = SOURCE_MEASURES[lang];
  return table?.[sourceKey as SourceMeasuresKey] ?? storedMeasures;
}

/** Mirrors ADVISORY_CODES in src/pipeline/scoring/engine.ts (see file header note). */
const ADVISORY_CODES = [
  'us', 'uk', 'ca', 'au', 'de', 'nl', 'jp', 'sk',
  'fr', 'nz', 'ie', 'fi', 'hk', 'br', 'at', 'ph',
  'be', 'dk', 'sg', 'ro', 'rs', 'ee', 'hr', 'ar',
  'it', 'es', 'kr', 'tw', 'cn', 'in',
  'ch', 'se', 'no', 'pl', 'cz', 'hu', 'pt',
] as const;

/**
 * Advisory code -> ISO3, for looking up the *issuing country's* own localized name
 * (distinct from the agency name in 'country.advisory.<code>') via
 * getLocalizedCountryName (src/lib/scores.ts) — used by the /sources/ methodology
 * page's government-advisory table (issuing-country column), not by SourcesList.
 */
export const ADVISORY_ISO3: Record<(typeof ADVISORY_CODES)[number], string> = {
  us: 'USA', uk: 'GBR', ca: 'CAN', au: 'AUS', de: 'DEU', nl: 'NLD', jp: 'JPN', sk: 'SVK',
  fr: 'FRA', nz: 'NZL', ie: 'IRL', fi: 'FIN', hk: 'HKG', br: 'BRA', at: 'AUT', ph: 'PHL',
  be: 'BEL', dk: 'DNK', sg: 'SGP', ro: 'ROU', rs: 'SRB', ee: 'EST', hr: 'HRV', ar: 'ARG',
  it: 'ITA', es: 'ESP', kr: 'KOR', tw: 'TWN', cn: 'CHN', in: 'IND',
  ch: 'CHE', se: 'SWE', no: 'NOR', pl: 'POL', cz: 'CZE', hu: 'HUN', pt: 'PRT',
};

interface AdvisoryGrammar {
  /** Exactly 1 issuing government. */
  one: (name: string) => string;
  /** Exactly 2 — spelled out separately because "2 governments: X and Y" reads more
   *  naturally than a list-join special case for n=2 in every language. */
  two: (a: string, b: string) => string;
  /** 3+ — `rest` is every name except the last, `last` is the final name. */
  many: (n: number, rest: string[], last: string) => string;
}

/**
 * List grammar per language, matching buildAdvisoryDescription()'s three shapes
 * (src/pipeline/scoring/engine.ts) but with each language's own conjunction and list
 * punctuation: no serial/Oxford comma outside English, "、" + "和" enumeration for
 * Chinese, French's spaced " : " (matches e.g. 'country.last_updated' in src/i18n/ui.ts).
 */
const ADVISORY_GRAMMAR: Record<Lang, AdvisoryGrammar> = {
  en: {
    one: (x) => `Travel advisory from ${x}`,
    two: (a, b) => `Travel advisories from 2 governments: ${a} and ${b}`,
    many: (n, rest, last) => `Travel advisories from ${n} governments: ${rest.join(', ')}, and ${last}`,
  },
  it: {
    one: (x) => `Avviso di viaggio da ${x}`,
    two: (a, b) => `Avvisi di viaggio da 2 governi: ${a} e ${b}`,
    many: (n, rest, last) => `Avvisi di viaggio da ${n} governi: ${rest.join(', ')} e ${last}`,
  },
  es: {
    one: (x) => `Aviso de viaje de ${x}`,
    two: (a, b) => `Avisos de viaje de 2 gobiernos: ${a} y ${b}`,
    many: (n, rest, last) => `Avisos de viaje de ${n} gobiernos: ${rest.join(', ')} y ${last}`,
  },
  fr: {
    one: (x) => `Avis de voyage de ${x}`,
    two: (a, b) => `Avis de voyage de 2 gouvernements : ${a} et ${b}`,
    many: (n, rest, last) => `Avis de voyage de ${n} gouvernements : ${rest.join(', ')} et ${last}`,
  },
  pt: {
    one: (x) => `Aviso de viagem de ${x}`,
    two: (a, b) => `Avisos de viagem de 2 governos: ${a} e ${b}`,
    many: (n, rest, last) => `Avisos de viagem de ${n} governos: ${rest.join(', ')} e ${last}`,
  },
  zh: {
    one: (x) => `来自${x}的旅行建议`,
    two: (a, b) => `来自 2 个政府的旅行建议：${a}和${b}`,
    many: (n, rest, last) => `来自 ${n} 个政府的旅行建议：${rest.join('、')}和${last}`,
  },
  de: {
    one: (x) => `Reisehinweis von ${x}`,
    two: (a, b) => `Reisehinweise von 2 Regierungen: ${a} und ${b}`,
    many: (n, rest, last) => `Reisehinweise von ${n} Regierungen: ${rest.join(', ')} und ${last}`,
  },
};

/**
 * Rebuild the 'advisories' SourceMeta description in the page's language, from the
 * country's own advisories data — same governments, same ADVISORY_CODES order as
 * buildAdvisoryDescription() (src/pipeline/scoring/engine.ts), but with localized
 * agency names ('country.advisory.<code>' in src/i18n/ui.ts) and this module's
 * per-language list grammar instead of the English sentence baked into
 * data/scores/*.json at pipeline time.
 *
 * Returns null when there are zero issuers — mirrors buildAdvisoryDescription's own
 * "should be unreachable in practice" defensive branch — so the caller falls back to
 * the stored description, exactly like it already does for any unrecognized source.
 */
export function buildLocalizedAdvisoryDescription(
  lang: Lang,
  advisories: ScoredCountry['advisories'] | undefined,
): string | null {
  if (!advisories) return null;
  const t = useTranslations(lang);
  const names = ADVISORY_CODES
    .filter((code) => Boolean(advisories[code]))
    .map((code) => t(`country.advisory.${code}` as TranslationKey));

  if (names.length === 0) return null;
  const g = ADVISORY_GRAMMAR[lang];
  if (names.length === 1) return g.one(names[0]);
  if (names.length === 2) return g.two(names[0], names[1]);
  const last = names[names.length - 1];
  const rest = names.slice(0, -1);
  return g.many(names.length, rest, last);
}
