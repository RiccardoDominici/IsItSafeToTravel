/**
 * Copy for a grey place's country page (formula v10, SPEC §4/§7): fewer than four independent
 * sources, so no official score is published. Used by the hero (ScoreHero.astro) and the page
 * title; the summary sentence lives in country-summary-copy.ts, the FAQ/meta/JSON-LD variants in
 * src/lib/seo.ts, the "Partial data" label itself in community-copy.ts (`partialDataTitle`), which
 * the vote widget already shows.
 *
 * Numbers: the four-source floor is spelled out ("four", "quattro", "vier"...), never "4 sources":
 * scripts/validate-seo.ts reads "<number> sources" as a site-wide source-count claim.
 * zh never puts a space between a country name and the Chinese text around it.
 */
import type { Lang } from './ui';

export interface GreyCopy {
  /** Big neutral line in place of the score. */
  noScore: string;
  /** Why there is no score. {name} = the place (en with its article; zh bare). */
  why: string;
  /** Heading of the list of what we do have. */
  haveHeading: string;
  /** Advisory item: [one government, n governments]; {n}. */
  advisories: readonly [string, string];
  /** Shown when not a single source covers the place. */
  nothing: string;
  /** Link text to the methodology's grey rule. */
  methodologyLink: string;
  /** Title suffix after the question, e.g. "Partial data". */
  titleSuffix: string;
  /** Display names of the non-advisory sources. */
  sources: Record<'worldbank' | 'gpi' | 'inform' | 'vdem' | 'ucdp' | 'reliefweb' | 'gdacs', string>;
}

export const greyCopy: Record<Lang, GreyCopy> = {
  en: {
    noScore: 'No official safety score',
    why: 'We publish a safety score only when at least four independent sources cover a place. Fewer than four cover {name}.',
    haveHeading: 'What we do have',
    advisories: ['A travel advisory from {n} government', 'Travel advisories from {n} governments'],
    nothing: 'No independent source covers this place yet.',
    methodologyLink: 'How we decide when to publish a score',
    titleSuffix: 'Partial Data, No Score Yet',
    sources: { worldbank: 'World Bank', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'UCDP conflict data', reliefweb: 'ReliefWeb', gdacs: 'GDACS disaster alerts' },
  },
  it: {
    noScore: 'Nessun punteggio di sicurezza ufficiale',
    why: 'Pubblichiamo un punteggio di sicurezza solo quando almeno quattro fonti indipendenti coprono una destinazione; per questa ne abbiamo meno di quattro.',
    haveHeading: 'Cosa abbiamo',
    advisories: ["L'avviso di viaggio di {n} governo", 'Gli avvisi di viaggio di {n} governi'],
    nothing: 'Nessuna fonte indipendente copre ancora questa destinazione.',
    methodologyLink: 'Come decidiamo quando pubblicare un punteggio',
    titleSuffix: 'Dati parziali',
    sources: { worldbank: 'Banca Mondiale', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'dati sui conflitti UCDP', reliefweb: 'ReliefWeb', gdacs: 'allerte per disastri GDACS' },
  },
  es: {
    noScore: 'Sin puntuación de seguridad oficial',
    why: 'Solo publicamos una puntuación de seguridad cuando al menos cuatro fuentes independientes cubren un destino; para este tenemos menos de cuatro.',
    haveHeading: 'Lo que sí tenemos',
    advisories: ['El aviso de viaje de {n} gobierno', 'Los avisos de viaje de {n} gobiernos'],
    nothing: 'Todavía ninguna fuente independiente cubre este destino.',
    methodologyLink: 'Cómo decidimos cuándo publicar una puntuación',
    titleSuffix: 'Datos parciales',
    sources: { worldbank: 'Banco Mundial', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'datos de conflictos de UCDP', reliefweb: 'ReliefWeb', gdacs: 'alertas de desastres de GDACS' },
  },
  fr: {
    noScore: 'Pas de score de sécurité officiel',
    why: 'Nous ne publions un score de sécurité que si au moins quatre sources indépendantes couvrent une destination ; pour celle-ci, nous en avons moins de quatre.',
    haveHeading: 'Ce dont nous disposons',
    advisories: ['Les conseils aux voyageurs de {n} gouvernement', 'Les conseils aux voyageurs de {n} gouvernements'],
    nothing: 'Aucune source indépendante ne couvre encore cette destination.',
    methodologyLink: 'Comment nous décidons de publier un score',
    titleSuffix: 'Données partielles',
    sources: { worldbank: 'Banque mondiale', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'données de conflits UCDP', reliefweb: 'ReliefWeb', gdacs: 'alertes aux catastrophes GDACS' },
  },
  pt: {
    noScore: 'Sem pontuação de segurança oficial',
    why: 'Só publicamos uma pontuação de segurança quando pelo menos quatro fontes independentes cobrem um destino; para este, temos menos de quatro.',
    haveHeading: 'O que temos',
    advisories: ['O alerta de viagem de {n} governo', 'Os alertas de viagem de {n} governos'],
    nothing: 'Nenhuma fonte independente cobre este destino ainda.',
    methodologyLink: 'Como decidimos quando publicar uma pontuação',
    titleSuffix: 'Dados parciais',
    sources: { worldbank: 'Banco Mundial', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'dados de conflitos do UCDP', reliefweb: 'ReliefWeb', gdacs: 'alertas de desastres do GDACS' },
  },
  zh: {
    noScore: '暂无官方安全评分',
    why: '只有当至少四个独立来源覆盖某地时，我们才会发布安全评分；覆盖{name}的来源不足四个。',
    haveHeading: '现有数据',
    advisories: ['{n}个国家政府的旅行警告', '{n}个国家政府的旅行警告'],
    nothing: '目前还没有任何独立来源覆盖该地。',
    methodologyLink: '我们如何决定是否发布评分',
    titleSuffix: '数据不完整',
    sources: { worldbank: '世界银行', gpi: '全球和平指数', inform: 'INFORM 风险指数', vdem: 'V-Dem', ucdp: 'UCDP 冲突数据', reliefweb: 'ReliefWeb', gdacs: 'GDACS 灾害警报' },
  },
  de: {
    noScore: 'Keine offizielle Sicherheitsbewertung',
    why: 'Wir veröffentlichen eine Sicherheitsbewertung nur, wenn mindestens vier unabhängige Quellen ein Reiseziel abdecken. Für dieses Reiseziel sind es weniger als vier.',
    haveHeading: 'Was vorliegt',
    advisories: ['Reisehinweis von {n} Regierung', 'Reisehinweise von {n} Regierungen'],
    nothing: 'Noch keine unabhängige Quelle deckt dieses Reiseziel ab.',
    methodologyLink: 'Wann wir eine Bewertung veröffentlichen',
    titleSuffix: 'Unvollständige Datenlage',
    sources: { worldbank: 'Weltbank', gpi: 'Global Peace Index', inform: 'INFORM Risk Index', vdem: 'V-Dem', ucdp: 'UCDP-Konfliktdaten', reliefweb: 'ReliefWeb', gdacs: 'GDACS-Katastrophenwarnungen' },
  },
};

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
    const label = (copy.sources as Record<string, string>)[name];
    items.push(label ?? name);
  }
  return items;
}
