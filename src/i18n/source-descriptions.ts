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
    worldbank: 'Indicatori di sviluppo della Banca Mondiale -- tasso di omicidi volontari (con la popolazione)',
    vdem: "V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- indici di Stato di Diritto, Corruzione Politica e Pubblica Amministrazione (Coppedge et al., DOI 10.23696/vdemds26)",
    gpi: 'Global Peace Index (IEP) -- punteggio complessivo e domini militarizzazione e sicurezza',
    inform: 'INFORM Risk Index (Commissione europea, JRC) -- rischi naturali ponderati per la capacità di risposta, rischio di epidemie, accesso alle cure mediche e governance',
    reliefweb: 'ReliefWeb (ONU OCHA) -- rapporti sulla situazione umanitaria e allerte per disastri',
    gdacs: 'GDACS (Sistema Globale di Allerta e Coordinamento Disastri) -- allerte per disastri naturali',
    ucdp: 'UCDP Georeferenced Event Dataset (Uppsala Conflict Data Program) -- decessi per conflitti statali e unilaterali, tramite il mirror di Our World in Data (CC-BY)',
  },
  es: {
    worldbank: 'Indicadores de desarrollo del Banco Mundial -- tasa de homicidios intencionales (con la población)',
    vdem: "V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- índices de Estado de Derecho, Corrupción Política y Administración Pública (Coppedge et al., DOI 10.23696/vdemds26)",
    gpi: 'Global Peace Index (IEP) -- puntuación general y dominios de militarización y seguridad',
    inform: 'INFORM Risk Index (Comisión Europea, JRC) -- riesgos naturales ponderados por la capacidad de respuesta, riesgo de epidemias, acceso a la atención sanitaria y gobernanza',
    reliefweb: 'ReliefWeb (ONU OCHA) -- informes de situación humanitaria y alertas de desastres',
    gdacs: 'GDACS (Sistema Global de Alerta y Coordinación de Desastres) -- alertas de desastres naturales',
    ucdp: 'UCDP Georeferenced Event Dataset (Uppsala Conflict Data Program) -- muertes por conflictos estatales y unilaterales, a través del espejo de Our World in Data (CC-BY)',
  },
  fr: {
    worldbank: "Indicateurs de développement de la Banque mondiale -- taux d'homicides volontaires (avec la population)",
    vdem: "V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- indices d'État de droit, de Corruption Politique et d'Administration Publique (Coppedge et al., DOI 10.23696/vdemds26)",
    gpi: 'Global Peace Index (IEP) -- score global et domaines militarisation et sûreté',
    inform: "INFORM Risk Index (Commission européenne, JRC) -- risques naturels pondérés par la capacité d'adaptation, risque d'épidémie, accès aux soins et gouvernance",
    reliefweb: 'ReliefWeb (ONU OCHA) -- rapports de situation humanitaire et alertes de catastrophes',
    gdacs: "GDACS (Système Mondial d'Alerte et de Coordination des Catastrophes) -- alertes de catastrophes naturelles",
    ucdp: 'UCDP Georeferenced Event Dataset (Uppsala Conflict Data Program) -- décès liés aux conflits étatiques et unilatéraux, via le miroir Our World in Data (CC-BY)',
  },
  pt: {
    worldbank: 'Indicadores de desenvolvimento do Banco Mundial -- taxa de homicídios intencionais (com a população)',
    vdem: "V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- índices de Estado de Direito, Corrupção Política e Administração Pública (Coppedge et al., DOI 10.23696/vdemds26)",
    gpi: 'Global Peace Index (IEP) -- pontuação geral e domínios de militarização e segurança',
    inform: 'INFORM Risk Index (Comissão Europeia, JRC) -- riscos naturais ponderados pela capacidade de resposta, risco de epidemias, acesso a cuidados de saúde e governança',
    reliefweb: 'ReliefWeb (ONU OCHA) -- relatórios de situação humanitária e alertas de desastres',
    gdacs: 'GDACS (Sistema Global de Alerta e Coordenação de Desastres) -- alertas de desastres naturais',
    ucdp: 'UCDP Georeferenced Event Dataset (Uppsala Conflict Data Program) -- mortes por conflitos estatais e unilaterais, via o espelho do Our World in Data (CC-BY)',
  },
  zh: {
    worldbank: '世界银行发展指标——故意杀人率（含人口数据）',
    vdem: 'V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- 法治、政治腐败与公共行政指数 (Coppedge et al., DOI 10.23696/vdemds26)',
    gpi: '全球和平指数（IEP）——总体评分及军事化、安全与治安领域',
    inform: 'INFORM风险指数（欧盟委员会联合研究中心）——结合应对能力的自然灾害、流行病风险、医疗服务可及性与治理',
    reliefweb: 'ReliefWeb（联合国 OCHA）——人道主义局势报告与灾害预警',
    gdacs: 'GDACS（全球灾害预警与协调系统）——自然灾害预警',
    ucdp: 'UCDP Georeferenced Event Dataset（Uppsala Conflict Data Program）——国家间及单方面暴力导致的死亡人数，通过 Our World in Data 镜像获取（CC-BY 许可）',
  },
  de: {
    worldbank: 'Weltbank-Entwicklungsindikatoren -- Rate vorsätzlicher Tötungsdelikte (mit Bevölkerungszahl)',
    vdem: 'V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- Indizes für Rechtsstaatlichkeit, politische Korruption und öffentliche Verwaltung (Coppedge et al., DOI 10.23696/vdemds26)',
    gpi: 'Global Peace Index (IEP) -- Gesamtwert sowie die Bereiche Militarisierung und Sicherheit',
    inform: 'INFORM Risk Index (Europäische Kommission, JRC) -- Naturgefahren, gewichtet nach Bewältigungskapazität, Epidemierisiko, Zugang zur Gesundheitsversorgung und Regierungsführung',
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
 *  Same catalog keys as CatalogSourceKey. Formula v10 indicator set (no child mortality, PM2.5 or
 *  INFORM "climate"/"health" columns any more). */
type SourceMeasuresKey = 'worldbank' | 'vdem' | 'gpi' | 'inform' | 'reliefweb' | 'gdacs' | 'ucdp';

export const SOURCE_MEASURES: Record<Exclude<Lang, 'en'>, Record<SourceMeasuresKey, string>> = {
  it: {
    worldbank: 'Tasso di omicidi volontari (con la popolazione)',
    vdem: 'Stato di diritto, corruzione politica, imparzialità della pubblica amministrazione',
    gpi: 'Pace complessiva, sicurezza e protezione, militarizzazione',
    inform: 'Rischi naturali, rischio di epidemie, accesso alle cure mediche, governance',
    ucdp: 'Morti nei conflitti armati per paese e anno',
    reliefweb: 'Disastri umanitari attivi e crisi in corso',
    gdacs: 'Allerte per disastri naturali (terremoti, alluvioni, cicloni)',
  },
  es: {
    worldbank: 'Tasa de homicidios intencionales (con la población)',
    vdem: 'Estado de derecho, corrupción política, imparcialidad de la administración pública',
    gpi: 'Paz general, seguridad y protección, militarización',
    inform: 'Riesgos naturales, riesgo de epidemias, acceso a la atención sanitaria, gobernanza',
    ucdp: 'Muertes en conflictos armados por país y año',
    reliefweb: 'Desastres humanitarios activos y crisis en curso',
    gdacs: 'Alertas de desastres naturales (terremotos, inundaciones, ciclones)',
  },
  fr: {
    worldbank: "Taux d'homicides volontaires (avec la population)",
    vdem: "État de droit, corruption politique, impartialité de l'administration publique",
    gpi: 'Paix globale, sûreté et sécurité, militarisation',
    inform: "Risques naturels, risque d'épidémie, accès aux soins, gouvernance",
    ucdp: 'Morts dans les conflits armés par pays et par année',
    reliefweb: 'Catastrophes humanitaires actives et crises en cours',
    gdacs: 'Alertes de catastrophes naturelles (séismes, inondations, cyclones)',
  },
  pt: {
    worldbank: 'Taxa de homicídios intencionais (com a população)',
    vdem: 'Estado de direito, corrupção política, imparcialidade da administração pública',
    gpi: 'Paz geral, segurança e proteção, militarização',
    inform: 'Riscos naturais, risco de epidemias, acesso a cuidados de saúde, governança',
    ucdp: 'Mortes em conflitos armados por país e ano',
    reliefweb: 'Desastres humanitários ativos e crises em curso',
    gdacs: 'Alertas de desastres naturais (terremotos, inundações, ciclones)',
  },
  zh: {
    worldbank: '故意杀人率（含人口数据）',
    vdem: '法治、政治腐败、公共行政公正性',
    gpi: '总体和平水平、安全与治安、军事化程度',
    inform: '自然灾害、流行病风险、医疗服务可及性、治理',
    ucdp: '各国每年武装冲突死亡人数',
    reliefweb: '活跃的人道主义灾难与危机',
    gdacs: '自然灾害预警（地震、洪水、飓风）',
  },
  de: {
    worldbank: 'Rate vorsätzlicher Tötungsdelikte (mit Bevölkerungszahl)',
    vdem: 'Rechtsstaatlichkeit, politische Korruption, unparteiische öffentliche Verwaltung',
    gpi: 'Allgemeiner Frieden, Sicherheit und Schutz, Militarisierung',
    inform: 'Naturgefahren, Epidemierisiko, Zugang zur Gesundheitsversorgung, Regierungsführung',
    ucdp: 'Tote in bewaffneten Konflikten je Land und Jahr',
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

/** Per-locale "edition" lines for the /sources/ baseline table (formula v10, SPEC §7). */
const EDITION_LINE: Record<Lang, Record<'gpi' | 'inform' | 'vdem' | 'worldbank' | 'ucdp', string>> = {
  en: { gpi: 'Edition: GPI {gpi}', inform: 'Edition: {inform}', vdem: 'Edition: V-Dem v16, data year {vdem}', worldbank: 'Latest published year varies by country', ucdp: 'Latest data year: {ucdp}' },
  it: { gpi: 'Edizione: GPI {gpi}', inform: 'Edizione: {inform}', vdem: 'Edizione: V-Dem v16, dati {vdem}', worldbank: "L'ultimo anno pubblicato varia da paese a paese", ucdp: 'Ultimo anno di dati: {ucdp}' },
  es: { gpi: 'Edición: GPI {gpi}', inform: 'Edición: {inform}', vdem: 'Edición: V-Dem v16, datos de {vdem}', worldbank: 'El último año publicado varía según el país', ucdp: 'Último año con datos: {ucdp}' },
  fr: { gpi: 'Édition\u00a0: GPI {gpi}', inform: 'Édition\u00a0: {inform}', vdem: 'Édition\u00a0: V-Dem v16, données {vdem}', worldbank: 'La dernière année publiée varie selon le pays', ucdp: 'Dernière année de données\u00a0: {ucdp}' },
  pt: { gpi: 'Edição: GPI {gpi}', inform: 'Edição: {inform}', vdem: 'Edição: V-Dem v16, dados de {vdem}', worldbank: 'O último ano publicado varia de país para país', ucdp: 'Último ano com dados: {ucdp}' },
  zh: { gpi: '版本：GPI {gpi}', inform: '版本：{inform}', vdem: '版本：V-Dem v16，{vdem}年数据', worldbank: '各国最新发布年份不同', ucdp: '最新数据年份：{ucdp}' },
  de: { gpi: 'Ausgabe: GPI {gpi}', inform: 'Ausgabe: {inform}', vdem: 'Ausgabe: V-Dem v16, Daten von {vdem}', worldbank: 'Das neueste veröffentlichte Jahr ist je nach Land unterschiedlich', ucdp: 'Neuestes Datenjahr: {ucdp}' },
};

/**
 * The edition line of a baseline source on /sources/ ("Edition: INFORM Risk 2026 (v0.7.3)"),
 * filled from src/lib/source-editions.ts; '' for sources without one.
 */
export function sourceEditionLine(
  lang: Lang,
  sourceKey: string,
  editions: { gpi: string; inform: string; vdem: string; ucdp: string },
): string {
  const table = EDITION_LINE[lang] as Record<string, string>;
  const template = table[sourceKey];
  if (!template) return '';
  return template
    .replace('{gpi}', editions.gpi)
    .replace('{inform}', editions.inform)
    .replace('{vdem}', editions.vdem)
    .replace('{ucdp}', editions.ucdp);
}
