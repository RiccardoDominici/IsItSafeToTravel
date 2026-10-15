/**
 * Copy for a grey place's country page (formula v10, SPEC §4/§7): fewer than four independent
 * sources, so no official score is published. Used by the hero (ScoreHero.astro) and the page
 * title; the summary sentence lives in country-summary-copy.ts, the FAQ/meta/JSON-LD variants in
 * src/lib/seo.ts, the "Partial data" label itself in community-copy.ts (`partialDataTitle`), which
 * the vote widget already shows.
 *
 * Numbers: the four-source floor is spelled out ("four", "quattro", "vier"...), never "4 sources":
 * scripts/validate-seo.ts reads "<number> sources" as a site-wide source-count claim.
 *
 * What counts toward the four (src/pipeline/scoring/coverage.ts): every government advisory
 * together is ONE source, the disaster-alert feeds none. The list says so on each item (audit
 * I21: "advisories from 17 governments" under "fewer than four sources" read as a contradiction).
 * A place with nothing at all to list (no advisory, no source: NFK, CCK, CXR, UMI) gets its own
 * "No data yet" label and sentence instead of "Partial data" over an empty list (audit I27).
 * zh never puts a space between a country name and the Chinese text around it.
 */
import type { Lang } from './ui';
import { isEventFeedSource } from '../pipeline/scoring/coverage';

export interface GreyCopy {
  /** Big neutral line in place of the score. */
  noScore: string;
  /** Why there is no score. {name} = the place (en with its article; zh bare). */
  why: string;
  /** Heading of the list of what we do have. */
  haveHeading: string;
  /** Advisory item: [one government, n governments]; {n}. Says that all advisories count as one source. */
  advisories: readonly [string, string];
  /**
   * Replaces `why` when there is nothing to list (no advisory, no source at all). {name} as in `why`.
   */
  whyNone: string;
  /** Hero label (in place of "Partial data") when there is nothing to list. */
  noDataTitle: string;
  /** Title suffix (in place of `titleSuffix`) when there is nothing to list. */
  noDataTitleSuffix: string;
  /** Link text to the methodology's grey rule. */
  methodologyLink: string;
  /** Title suffix after the question, e.g. "Partial data". */
  titleSuffix: string;
  /** Display names of the non-advisory sources. */
  sources: Record<'worldbank' | 'gpi' | 'inform' | 'vdem' | 'ucdp' | 'reliefweb' | 'gdacs', string>;
  /**
   * A disaster-alert feed in the list: it covers the place only while a disaster is under way,
   * so it does not count toward the four-source minimum (src/pipeline/scoring/coverage.ts).
   * {source} = its name.
   */
  alertItem: string;
}

export const greyCopy: Record<Lang, GreyCopy> = {
  en: {
    noScore: 'No official safety score',
    why: 'We publish a safety score only when at least four independent sources cover a place. Fewer than four cover {name}.',
    haveHeading: 'What we do have',
    advisories: ['A travel advisory from {n} government (counted as one source)', 'Travel advisories from {n} governments (counted together as one source)'],
    whyNone: 'We publish a safety score only when at least four independent sources cover a place. Neither an independent source nor a government travel advisory covers {name} yet.',
    noDataTitle: 'No data yet',
    noDataTitleSuffix: 'No Data Yet',
    methodologyLink: 'How we decide when to publish a score',
    titleSuffix: 'Partial Data, No Score Yet',
    sources: { worldbank: 'World Bank', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'UCDP conflict data', reliefweb: 'ReliefWeb', gdacs: 'GDACS disaster alerts' },
    alertItem: '{source} (only while a disaster is under way, so not counted toward the four-source minimum)',
  },
  it: {
    noScore: 'Nessun punteggio di sicurezza ufficiale',
    why: 'Pubblichiamo un punteggio di sicurezza solo quando almeno quattro fonti indipendenti coprono una destinazione; per questa ne abbiamo meno di quattro.',
    haveHeading: 'Cosa abbiamo',
    advisories: ["L'avviso di viaggio di {n} governo (conta come una fonte)", 'Gli avvisi di viaggio di {n} governi (contano insieme come una sola fonte)'],
    whyNone: 'Pubblichiamo un punteggio di sicurezza solo quando almeno quattro fonti indipendenti coprono una destinazione; per questa non abbiamo ancora né una fonte indipendente né un avviso di viaggio governativo.',
    noDataTitle: 'Ancora nessun dato',
    noDataTitleSuffix: 'Ancora nessun dato',
    methodologyLink: 'Come decidiamo quando pubblicare un punteggio',
    titleSuffix: 'Dati parziali',
    sources: { worldbank: 'Banca Mondiale', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'dati sui conflitti UCDP', reliefweb: 'ReliefWeb', gdacs: 'allerte per disastri GDACS' },
    alertItem: '{source} (solo durante un disastro in corso, quindi non conta per il minimo di quattro fonti)',
  },
  es: {
    noScore: 'Sin puntuación de seguridad oficial',
    why: 'Solo publicamos una puntuación de seguridad cuando al menos cuatro fuentes independientes cubren un destino; para este tenemos menos de cuatro.',
    haveHeading: 'Lo que sí tenemos',
    advisories: ['El aviso de viaje de {n} gobierno (cuenta como una fuente)', 'Los avisos de viaje de {n} gobiernos (cuentan juntos como una sola fuente)'],
    whyNone: 'Solo publicamos una puntuación de seguridad cuando al menos cuatro fuentes independientes cubren un destino; para este todavía no tenemos ni una fuente independiente ni un aviso de viaje gubernamental.',
    noDataTitle: 'Sin datos todavía',
    noDataTitleSuffix: 'Sin datos todavía',
    methodologyLink: 'Cómo decidimos cuándo publicar una puntuación',
    titleSuffix: 'Datos parciales',
    sources: { worldbank: 'Banco Mundial', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'datos de conflictos de UCDP', reliefweb: 'ReliefWeb', gdacs: 'alertas de desastres de GDACS' },
    alertItem: '{source} (solo mientras hay un desastre en curso, así que no cuenta para el mínimo de cuatro fuentes)',
  },
  fr: {
    noScore: 'Pas de score de sécurité officiel',
    why: 'Nous ne publions un score de sécurité que si au moins quatre sources indépendantes couvrent une destination ; pour celle-ci, nous en avons moins de quatre.',
    haveHeading: 'Ce dont nous disposons',
    advisories: ['Les conseils aux voyageurs de {n} gouvernement (comptés comme une source)', 'Les conseils aux voyageurs de {n} gouvernements (comptés ensemble comme une seule source)'],
    whyNone: "Nous ne publions un score de sécurité que si au moins quatre sources indépendantes couvrent une destination ; pour celle-ci, nous n'avons encore ni source indépendante ni conseils aux voyageurs d'un gouvernement.",
    noDataTitle: 'Pas encore de données',
    noDataTitleSuffix: 'Pas encore de données',
    methodologyLink: 'Comment nous décidons de publier un score',
    titleSuffix: 'Données partielles',
    sources: { worldbank: 'Banque mondiale', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'données de conflits UCDP', reliefweb: 'ReliefWeb', gdacs: 'alertes aux catastrophes GDACS' },
    alertItem: '{source} (seulement pendant une catastrophe en cours, donc non comptée dans le minimum de quatre sources)',
  },
  pt: {
    noScore: 'Sem pontuação de segurança oficial',
    why: 'Só publicamos uma pontuação de segurança quando pelo menos quatro fontes independentes cobrem um destino; para este, temos menos de quatro.',
    haveHeading: 'O que temos',
    advisories: ['O alerta de viagem de {n} governo (conta como uma fonte)', 'Os alertas de viagem de {n} governos (contam juntos como uma única fonte)'],
    whyNone: 'Só publicamos uma pontuação de segurança quando pelo menos quatro fontes independentes cobrem um destino; para este, ainda não temos nem uma fonte independente nem um alerta de viagem de algum governo.',
    noDataTitle: 'Ainda sem dados',
    noDataTitleSuffix: 'Ainda sem dados',
    methodologyLink: 'Como decidimos quando publicar uma pontuação',
    titleSuffix: 'Dados parciais',
    sources: { worldbank: 'Banco Mundial', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'dados de conflitos do UCDP', reliefweb: 'ReliefWeb', gdacs: 'alertas de desastres do GDACS' },
    alertItem: '{source} (apenas enquanto há um desastre em curso, por isso não conta para o mínimo de quatro fontes)',
  },
  zh: {
    noScore: '暂无官方安全评分',
    why: '只有当至少四个独立来源覆盖某地时，我们才会发布安全评分；覆盖{name}的来源不足四个。',
    haveHeading: '现有数据',
    advisories: ['{n}个国家政府的旅行警告（计为一个来源）', '{n}个国家政府的旅行警告（合计只算一个来源）'],
    whyNone: '只有当至少四个独立来源覆盖某地时，我们才会发布安全评分；目前既没有任何独立来源覆盖{name}，也没有任何国家政府针对该地发布的旅行警告。',
    noDataTitle: '暂无数据',
    noDataTitleSuffix: '暂无数据',
    methodologyLink: '我们如何决定是否发布评分',
    titleSuffix: '数据不完整',
    sources: { worldbank: '世界银行', gpi: '全球和平指数', inform: 'INFORM 风险指数', vdem: 'V-Dem', ucdp: 'UCDP 冲突数据', reliefweb: 'ReliefWeb', gdacs: 'GDACS 灾害警报' },
    alertItem: '{source}（仅在灾害发生期间提供，因此不计入发布评分所需的至少四个独立来源）',
  },
  de: {
    noScore: 'Keine offizielle Sicherheitsbewertung',
    why: 'Wir veröffentlichen eine Sicherheitsbewertung nur, wenn mindestens vier unabhängige Quellen ein Reiseziel abdecken. Für dieses Reiseziel sind es weniger als vier.',
    haveHeading: 'Was vorliegt',
    advisories: ['Reisehinweis von {n} Regierung (zählt als eine Quelle)', 'Reisehinweise von {n} Regierungen (zählen zusammen als eine Quelle)'],
    whyNone: 'Wir veröffentlichen eine Sicherheitsbewertung nur, wenn mindestens vier unabhängige Quellen ein Reiseziel abdecken. Für dieses Reiseziel liegt noch weder eine unabhängige Quelle noch ein Reisehinweis einer Regierung vor.',
    noDataTitle: 'Noch keine Daten',
    noDataTitleSuffix: 'Noch keine Daten',
    methodologyLink: 'Wann wir eine Bewertung veröffentlichen',
    titleSuffix: 'Unvollständige Datenlage',
    sources: { worldbank: 'Weltbank', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'UCDP-Konfliktdaten', reliefweb: 'ReliefWeb', gdacs: 'GDACS-Katastrophenwarnungen' },
    alertItem: '{source} (nur während einer laufenden Katastrophe, zählt daher nicht zum Minimum von vier Quellen)',
  },
};

/** The minimum a grey place's data needs for the helpers below. */
export interface GreyPlaceData {
  advisories?: Record<string, unknown> | null;
  sources?: ReadonlyArray<{ name: string }> | null;
}

/** greySourceItems for a place, from its snapshot entry. */
export function greySourceItemsFor(lang: Lang, place: GreyPlaceData): string[] {
  return greySourceItems(lang, Object.keys(place.advisories ?? {}).length, (place.sources ?? []).map((s) => s.name));
}

/** True when a grey place has nothing at all to list: no government advisory and no source. */
export function greyHasNoData(place: GreyPlaceData): boolean {
  return greySourceItemsFor('en', place).length === 0;
}

/** Title suffix of a grey place: "Partial data", or "No data yet" when there is nothing to list. */
export function greyTitleSuffix(lang: Lang, place: GreyPlaceData): string {
  return greyHasNoData(place) ? greyCopy[lang].noDataTitleSuffix : greyCopy[lang].titleSuffix;
}

/** What we have for a grey place: one advisory item (if any) plus the non-advisory sources, in display form. */
export function greySourceItems(
  lang: Lang,
  advisoryCount: number,
  sourceNames: readonly string[],
): string[] {
  const copy = greyCopy[lang];
  const items: string[] = [];
  if (advisoryCount > 0) {
    items.push(copy.advisories[advisoryCount === 1 ? 0 : 1].replace('{n}', String(advisoryCount)));
  }
  for (const name of sourceNames) {
    if (name === 'advisories') continue;
    const label = (copy.sources as Record<string, string>)[name] ?? name;
    // A disaster-alert feed is listed (it is data we have) but marked as not counting, so the
    // list never shows four items under "fewer than four cover this place".
    items.push(isEventFeedSource(name) ? copy.alertItem.replace('{source}', label) : label);
  }
  return items;
}
