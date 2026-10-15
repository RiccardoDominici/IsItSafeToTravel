/**
 * Copy for the top summary of every country page (AnswerFirstParagraph.astro, built by
 * src/lib/country-summary.ts), all 7 locales, and the pillar sentences the FAQ shares with it
 * (src/lib/pillar-narrative.ts): the same pillar is named with the same words in both places.
 *
 * WHY it was rewritten (formula v10, SPEC §7): the old second sentence read "the biggest concern
 * is governance (3.9/10), while the strongest area is conflict (6.9/10)": two normalised numbers
 * nobody can check, and a "strongest area" that was only relatively strong. It names the concrete
 * driver of the focus pillar with the source's own value, year and source (e.g. "The main risk is
 * violent crime: 45.7 homicides per 100,000 people (World Bank, 2023)"), the government advisories
 * by level, and a strong area only when it is good in absolute terms (pillar >= 7.0).
 *
 * 2026-10-15 consistency audit: the focus pillar comes from src/lib/pillar-focus.ts, shared with
 * the meta description and the FAQ. A driver fact is quoted only when the value is bad (I04);
 * otherwise the plain forms name the pillar with its /10 value. "All five areas" only when all five
 * bars, estimates included, are at 7.0+ (I05); the lowest area is given on the page's own /10 scale,
 * never as an inverted INFORM number (I07). A lower governance bar and lower estimated bars are
 * explained instead of left contradicting the text (I02, I05). Ties are named as ties (I54).
 *
 * Tokens: {name} {score} {date} {riskLevel} {rank} {total} (opener); {topic} {fact} (driver, from
 * src/i18n/indicator-copy.ts); {pillar} {pillar2} {score} (`pillarArea` form); {list} (estimates);
 * {advice} / {Advice} (advisory majority, lowercase / capitalised after a German colon); {n} {k} {breakdown} {phrase} {count} plus the locale's own
 * country-phrase token (advisories).
 *
 * Grammar: every country name inside a sentence goes through country-grammar.ts (see the
 * `advisory*` templates: it uses the locative "in Ecuador / negli Stati Uniti", fr "en Équateur",
 * pt "ao Equador" / "do Equador", de "für die Türkei"); es and zh take the bare name. it/fr/pt never put
 * the bare name in subject position (it and fr need an article the grammar tables do not carry for
 * every country, pt plural names would need "têm"): the openers start from the score instead. German subjects that could
 * be plural ("die Vereinigten Staaten") are avoided with "für {name}" and "das Land". zh never
 * puts a space between the country name and the Chinese text. Pillar names never stand bare as a
 * subject or after "is" in it/es/fr/pt/de: they sit in an "area" frame ("l'area della salute",
 * "el área de salud", "le domaine de la santé", "a área de saúde", "der Bereich Gesundheit"), so no
 * article or number agreement depends on the pillar.
 */
import type { Lang } from './ui';
import type { PillarName } from '../pipeline/types';

/** Advisory level 1..4 -> [singular verb phrase, plural verb phrase]. */
export type LevelPhrases = Record<1 | 2 | 3 | 4, readonly [string, string]>;

export interface CountrySummaryCopy {
  scored: string;
  scoredLowConfidence: string;
  /** Focus pillar below 5.0/10 whose driver value is bad: {topic} {fact}. */
  driverMainRisk: string;
  /** Focus pillar at 5.0-6.9/10 whose driver value is bad: {topic} {fact}. */
  driverConcern: string;
  /** Every direct-risk pillar at 7.0+, governance below: {score} {topic} {fact}. */
  driverWeakest: string;
  /** The same without a bad driver value: {score}. */
  weakestPlain: string;
  /** Focus pillar below 5.0/10 without a bad driver value: {pillar} {score}. */
  mainRiskPlain: string;
  /** Focus pillar at 5.0-6.9/10 without a bad driver value: {pillar} {score}. */
  concernPlain: string;
  /** Every displayed pillar, estimates included, at 7.0+: {pillar} {score} = the lowest one. */
  allGood: string;
  /** Every MEASURED pillar at 7.0+ while a lower estimate is shown: {pillar} {score}. */
  allGoodMeasured: string;
  /** Conflict pillar held down by government advice rather than an indicator: {advice}. */
  advisoryPressure: string;
  /** Another pillar at exactly the focus's displayed value: {pillar} {score}. */
  tie: string;
  /** Measured governance below a direct-risk focus: {score} (short form; the FAQ's a2GovernanceContext adds what it means). */
  governanceContext: string;
  /** Estimated (asterisked) pillars below what the text claims: {list} of `estimateItem`. */
  estimates: { one: string; other: string };
  estimateItem: string;
  /** Best pillar at 7.0/10 or above: {pillar} {score}. */
  strongArea: string;
  strongAreaTie: string;
  /** Best pillar below 7.0/10 (used by the FAQ): {pillar} {score}. */
  weakBest: string;
  weakBestTie: string;
  /** Pillar name in the form the area frames take ("della salute", "de salud", "Gesundheit"). */
  pillarArea: Record<PillarName, string>;
  /** Subject of the advisory-majority clause: {n} governments with a level, {k} at level 3 or 4. */
  adviceSubject: { one: string; all: string; some: string };
  /** Verb phrase for a mix of level-3 and level-4 advisories (always plural). */
  adviceMixed: string;
  advisoryNone: string;
  advisoryOne: string;
  advisoryAll: string;
  advisoryMany: string;
  levelPhrases: LevelPhrases;
  /** One breakdown item: {count} {phrase}. */
  breakdownItem: string;
  listSeparator: string;
  listLastSeparator: string;
  /** Grey place (formula v10 insufficient_data): no score, no rank, no pillar figures. */
  grey: string;
}

const NBSP = ' ';

export const countrySummaryCopy: Record<Lang, CountrySummaryCopy> = {
  en: {
    scored:
      '{name} has a safety score of {score}/10 as of {date}, rated as {riskLevel} and ranking {rank} of the {total} countries with an official score.',
    scoredLowConfidence:
      '{name} has a provisional safety score of {score}/10 as of {date}, tentatively rated as {riskLevel}: there is limited data behind it, so treat it as a cautious estimate rather than a confident verdict. It ranks {rank} of the {total} countries with an official score.',
    driverMainRisk: 'The main risk is {topic}: {fact}.',
    driverConcern: 'The main concern is {topic}: {fact}.',
    driverWeakest: 'The weakest area is governance ({score}/10), driven mainly by {topic}: {fact}.',
    weakestPlain: 'The weakest area is governance ({score}/10).',
    mainRiskPlain: 'The main risk is {pillar} ({score}/10).',
    concernPlain: 'The main concern is {pillar} ({score}/10).',
    allGood: 'All five areas score at least 7 out of 10; the lowest is {pillar} ({score}/10).',
    allGoodMeasured: 'Every area measured with enough data scores at least 7 out of 10; the lowest of them is {pillar} ({score}/10).',
    advisoryPressure: 'That score reflects government warnings more than any indicator: {advice}.',
    tie: 'The same score ({score}/10) goes to {pillar}.',
    governanceContext:
      'Governance is rated lower still ({score}/10): it reflects institutions and the rule of law rather than a direct danger to visitors.',
    estimates: {
      one: 'The value for {list} is a cautious estimate: there is too little data to measure it.',
      other: 'The values for {list} are cautious estimates: there is too little data to measure them.',
    },
    estimateItem: '{pillar} ({score}/10)',
    strongArea: 'Its best-rated area is {pillar} ({score}/10).',
    strongAreaTie: 'Its best-rated areas are {pillar} and {pillar2} (both {score}/10).',
    weakBest: 'Even its best-rated area, {pillar}, scores only {score}/10.',
    weakBestTie: 'Even its best-rated areas, {pillar} and {pillar2}, score only {score}/10.',
    pillarArea: { conflict: 'conflict', crime: 'crime', health: 'health', governance: 'governance', environment: 'natural hazards' },
    adviceSubject: { one: 'the only government with an advisory', all: 'all {n} governments', some: '{k} of {n} governments' },
    adviceMixed: 'advise reconsidering travel or avoiding it altogether',
    advisoryNone: 'No government in our dataset publishes a travel advisory for {name}.',
    advisoryOne: 'One government publishes a travel advisory for {name}, and it {phrase}.',
    advisoryAll: 'All {n} governments that publish a travel advisory for {name} {phrase}.',
    advisoryMany: 'Of the {n} governments that publish a travel advisory for {name}, {breakdown}.',
    levelPhrases: {
      1: ['advises normal precautions', 'advise normal precautions'],
      2: ['advises increased caution', 'advise increased caution'],
      3: ['advises reconsidering travel', 'advise reconsidering travel'],
      4: ['advises against all travel', 'advise against all travel'],
    },
    breakdownItem: '{count} {phrase}',
    listSeparator: ', ',
    listLastSeparator: ' and ',
    grey: 'There is no official safety score for {name} yet: fewer than four independent sources cover this place, so its data is partial.',
  },
  it: {
    scored:
      'Per chi viaggia {nameIn}, il punteggio di sicurezza al {date} è {score}/10, classificato come {riskLevel}: {rank} posto su {total} paesi con un punteggio ufficiale.',
    scoredLowConfidence:
      'Per chi viaggia {nameIn}, il punteggio di sicurezza provvisorio al {date} è {score}/10, classificato in via preliminare come {riskLevel}: i dati disponibili sono limitati, quindi consideralo una stima prudente e non un verdetto definitivo. È al {rank} posto su {total} paesi con un punteggio ufficiale.',
    driverMainRisk: 'Il rischio principale è {topic}: {fact}.',
    driverConcern: 'La principale criticità è {topic}: {fact}.',
    driverWeakest: 'Il punto più debole è la governance ({score}/10); pesa soprattutto {topic}: {fact}.',
    weakestPlain: 'Il punto più debole è la governance ({score}/10).',
    mainRiskPlain: "Il rischio principale riguarda l'area {pillar} ({score}/10).",
    concernPlain: "La principale criticità riguarda l'area {pillar} ({score}/10).",
    allGood: 'Tutte e cinque le aree raggiungono almeno 7 su 10; la più bassa è quella {pillar} ({score}/10).',
    allGoodMeasured: 'Tutte le aree misurate con dati sufficienti raggiungono almeno 7 su 10; la più bassa è quella {pillar} ({score}/10).',
    advisoryPressure: 'Su questo valore pesano più gli avvisi dei governi che i singoli indicatori: {advice}.',
    tie: "Lo stesso punteggio ({score}/10) va all'area {pillar}.",
    governanceContext:
      'La governance ha un punteggio ancora più basso ({score}/10): riguarda istituzioni e stato di diritto, non un pericolo diretto per chi viaggia.',
    estimates: {
      one: 'Il valore {list} è solo una stima prudente: i dati disponibili sono troppo pochi per misurarlo.',
      other: 'I valori {list} sono solo stime prudenti: i dati disponibili sono troppo pochi per misurarli.',
    },
    estimateItem: '{pillar} ({score}/10)',
    strongArea: "L'area con il punteggio migliore è quella {pillar} ({score}/10).",
    strongAreaTie: 'Le aree con il punteggio migliore sono quella {pillar} e quella {pillar2} (entrambe {score}/10).',
    weakBest: "Anche l'area con il punteggio migliore, quella {pillar}, arriva solo a {score}/10.",
    weakBestTie: 'Anche le aree con il punteggio migliore, quella {pillar} e quella {pillar2}, arrivano solo a {score}/10.',
    pillarArea: {
      conflict: 'dei conflitti',
      crime: 'della criminalità',
      health: 'della salute',
      governance: 'della governance',
      environment: 'dei rischi naturali',
    },
    adviceSubject: { one: "l'unico governo che pubblica un avviso", all: 'tutti i {n} governi', some: '{k} governi su {n}' },
    adviceMixed: 'invitano a riconsiderare il viaggio o lo sconsigliano del tutto',
    advisoryNone: 'Nessun governo nei nostri dati pubblica avvisi per chi viaggia {nameIn}.',
    advisoryOne: 'Un solo governo pubblica avvisi per chi viaggia {nameIn}, e {phrase}.',
    advisoryAll: 'Tutti i {n} governi che pubblicano avvisi per chi viaggia {nameIn} {phrase}.',
    advisoryMany: 'Dei {n} governi che pubblicano avvisi per chi viaggia {nameIn}, {breakdown}.',
    levelPhrases: {
      1: ['raccomanda le normali precauzioni', 'raccomandano le normali precauzioni'],
      2: ['raccomanda maggiore prudenza', 'raccomandano maggiore prudenza'],
      3: ['invita a riconsiderare il viaggio', 'invitano a riconsiderare il viaggio'],
      4: ['sconsiglia qualsiasi viaggio', 'sconsigliano qualsiasi viaggio'],
    },
    breakdownItem: '{count} {phrase}',
    listSeparator: ', ',
    listLastSeparator: ' e ',
    grey: 'Questa destinazione non ha ancora un punteggio di sicurezza ufficiale: la coprono meno di quattro fonti indipendenti, quindi i dati sono parziali.',
  },
  es: {
    scored:
      '{name} tiene una puntuación de seguridad de {score}/10 a fecha de {date}, clasificada como {riskLevel}: puesto {rank} de los {total} países con puntuación oficial.',
    scoredLowConfidence:
      '{name} tiene una puntuación de seguridad provisional de {score}/10 a fecha de {date}, clasificada de forma preliminar como {riskLevel}: los datos disponibles son limitados, así que tómala como una estimación prudente y no como un veredicto definitivo. Ocupa el puesto {rank} de los {total} países con puntuación oficial.',
    driverMainRisk: 'El principal riesgo es {topic}: {fact}.',
    driverConcern: 'La principal preocupación es {topic}: {fact}.',
    driverWeakest: 'El punto más débil es la gobernanza ({score}/10); pesa sobre todo {topic}: {fact}.',
    weakestPlain: 'El punto más débil es la gobernanza ({score}/10).',
    mainRiskPlain: 'El principal riesgo está en el área de {pillar} ({score}/10).',
    concernPlain: 'La principal preocupación está en el área de {pillar} ({score}/10).',
    allGood: 'Las cinco áreas obtienen al menos un 7 sobre 10; la más baja es la de {pillar} ({score}/10).',
    allGoodMeasured: 'Todas las áreas medidas con datos suficientes obtienen al menos un 7 sobre 10; la más baja es la de {pillar} ({score}/10).',
    advisoryPressure: 'En esta puntuación pesan más los avisos de los gobiernos que los indicadores: {advice}.',
    tie: 'El área de {pillar} obtiene la misma puntuación ({score}/10).',
    governanceContext:
      'La gobernanza puntúa todavía más bajo ({score}/10): se refiere a las instituciones y al Estado de derecho, no a un peligro directo para el viajero.',
    estimates: {
      one: 'El valor del área {list} es solo una estimación prudente: no hay datos suficientes para medirlo.',
      other: 'Los valores de las áreas {list} son solo estimaciones prudentes: no hay datos suficientes para medirlos.',
    },
    estimateItem: 'de {pillar} ({score}/10)',
    strongArea: 'Su área mejor valorada es la de {pillar} ({score}/10).',
    strongAreaTie: 'Sus áreas mejor valoradas son la de {pillar} y la de {pillar2} (ambas con {score}/10).',
    weakBest: 'Incluso su área mejor valorada, la de {pillar}, se queda en {score}/10.',
    weakBestTie: 'Incluso sus áreas mejor valoradas, la de {pillar} y la de {pillar2}, se quedan en {score}/10.',
    pillarArea: { conflict: 'conflictos', crime: 'criminalidad', health: 'salud', governance: 'gobernanza', environment: 'riesgos naturales' },
    adviceSubject: { one: 'el único gobierno que publica un aviso', all: 'los {n} gobiernos', some: '{k} de los {n} gobiernos' },
    adviceMixed: 'aconsejan reconsiderar el viaje o lo desaconsejan por completo',
    advisoryNone: 'Ningún gobierno de nuestros datos publica avisos para quien viaja a {name}.',
    advisoryOne: 'Solo un gobierno publica avisos para quien viaja a {name}, y {phrase}.',
    advisoryAll: 'Los {n} gobiernos que publican avisos para quien viaja a {name} {phrase}.',
    advisoryMany: 'De los {n} gobiernos que publican avisos para quien viaja a {name}, {breakdown}.',
    levelPhrases: {
      1: ['recomienda las precauciones habituales', 'recomiendan las precauciones habituales'],
      2: ['recomienda extremar la precaución', 'recomiendan extremar la precaución'],
      3: ['aconseja reconsiderar el viaje', 'aconsejan reconsiderar el viaje'],
      4: ['desaconseja todo viaje', 'desaconsejan todo viaje'],
    },
    breakdownItem: '{count} {phrase}',
    listSeparator: ', ',
    listLastSeparator: ' y ',
    grey: 'Este destino todavía no tiene una puntuación de seguridad oficial: lo cubren menos de cuatro fuentes independientes, así que sus datos son parciales.',
  },
  fr: {
    scored: `Pour un voyage {namePrep}, le score de sécurité est de {score}/10 au {date}, classé comme {riskLevel}${NBSP}: {rank} sur les {total} pays dotés d’un score officiel.`,
    scoredLowConfidence: `Pour un voyage {namePrep}, le score de sécurité provisoire est de {score}/10 au {date}, classé à titre préliminaire comme {riskLevel}${NBSP}: les données disponibles sont limitées, il s’agit donc d’une estimation prudente plutôt que d’un verdict fiable. Classement${NBSP}: {rank} sur les {total} pays dotés d’un score officiel.`,
    driverMainRisk: `Le principal risque est {topic}${NBSP}: {fact}.`,
    driverConcern: `Le principal point de vigilance est {topic}${NBSP}: {fact}.`,
    driverWeakest: `Le point le plus faible est la gouvernance ({score}/10)${NBSP}; en cause surtout {topic}${NBSP}: {fact}.`,
    weakestPlain: 'Le point le plus faible est la gouvernance ({score}/10).',
    mainRiskPlain: 'Le principal risque concerne le domaine {pillar} ({score}/10).',
    concernPlain: 'Le principal point de vigilance concerne le domaine {pillar} ({score}/10).',
    allGood: `Les cinq domaines obtiennent au moins 7 sur 10${NBSP}; le moins bien noté est celui {pillar} ({score}/10).`,
    allGoodMeasured: `Tous les domaines mesurés avec suffisamment de données obtiennent au moins 7 sur 10${NBSP}; le moins bien noté est celui {pillar} ({score}/10).`,
    advisoryPressure: `Ce score reflète davantage les avertissements officiels que les indicateurs${NBSP}: {advice}.`,
    tie: 'Le domaine {pillar} obtient le même score ({score}/10).',
    governanceContext:
      `La gouvernance obtient un score encore plus bas ({score}/10)${NBSP}: elle concerne les institutions et l’État de droit, pas un danger direct pour les voyageurs.`,
    estimates: {
      one: `La valeur {list} n’est qu’une estimation prudente${NBSP}: les données sont trop rares pour la mesurer.`,
      other: `Les valeurs {list} ne sont que des estimations prudentes${NBSP}: les données sont trop rares pour les mesurer.`,
    },
    estimateItem: '{pillar} ({score}/10)',
    strongArea: 'Son domaine le mieux noté est celui {pillar} ({score}/10).',
    strongAreaTie: 'Ses domaines les mieux notés sont celui {pillar} et celui {pillar2} (tous deux à {score}/10).',
    weakBest: 'Même son domaine le mieux noté, celui {pillar}, n’obtient que {score}/10.',
    weakBestTie: 'Même ses domaines les mieux notés, celui {pillar} et celui {pillar2}, n’obtiennent que {score}/10.',
    pillarArea: {
      conflict: 'des conflits',
      crime: 'de la criminalité',
      health: 'de la santé',
      governance: 'de la gouvernance',
      environment: 'des risques naturels',
    },
    adviceSubject: { one: 'le seul gouvernement qui publie un avis', all: 'les {n} gouvernements', some: '{k} des {n} gouvernements' },
    adviceMixed: 'déconseillent le voyage sauf raison impérative, voire tout voyage',
    advisoryNone: 'Aucun gouvernement de nos données ne publie de conseils aux voyageurs se rendant {namePrep}.',
    advisoryOne: `Un seul gouvernement publie des conseils aux voyageurs se rendant {namePrep}${NBSP}: il {phrase}.`,
    advisoryAll: 'Les {n} gouvernements qui publient des conseils aux voyageurs se rendant {namePrep} {phrase}.',
    advisoryMany: 'Parmi les {n} gouvernements qui publient des conseils aux voyageurs se rendant {namePrep}, {breakdown}.',
    levelPhrases: {
      1: ['recommande les précautions habituelles', 'recommandent les précautions habituelles'],
      2: ['recommande une vigilance renforcée', 'recommandent une vigilance renforcée'],
      3: ['déconseille le voyage sauf raison impérative', 'déconseillent le voyage sauf raison impérative'],
      4: ['déconseille formellement tout voyage', 'déconseillent formellement tout voyage'],
    },
    breakdownItem: '{count} {phrase}',
    listSeparator: ', ',
    listLastSeparator: ' et ',
    grey: `Cette destination n’a pas encore de score de sécurité officiel${NBSP}: moins de quatre sources indépendantes la couvrent, ses données sont donc partielles.`,
  },
  pt: {
    scored:
      'A pontuação de segurança {nameDe} é de {score}/10 em {date}, classificada como {riskLevel}: {rank} lugar entre os {total} países com pontuação oficial.',
    scoredLowConfidence:
      'A pontuação de segurança {nameDe} é provisória: {score}/10 em {date}, classificada de forma preliminar como {riskLevel}. Os dados disponíveis são limitados, portanto trate-a como uma estimativa prudente, e não como um veredito confiável. Ocupa o {rank} lugar entre os {total} países com pontuação oficial.',
    driverMainRisk: 'O principal risco é {topic}: {fact}.',
    driverConcern: 'A principal preocupação é {topic}: {fact}.',
    driverWeakest: 'O ponto mais fraco é a governança ({score}/10); pesa sobretudo {topic}: {fact}.',
    weakestPlain: 'O ponto mais fraco é a governança ({score}/10).',
    mainRiskPlain: 'O principal risco está na área {pillar} ({score}/10).',
    concernPlain: 'A principal preocupação está na área {pillar} ({score}/10).',
    allGood: 'As cinco áreas têm pelo menos 7 de 10; a mais baixa é a {pillar} ({score}/10).',
    allGoodMeasured: 'Todas as áreas medidas com dados suficientes têm pelo menos 7 de 10; a mais baixa é a {pillar} ({score}/10).',
    advisoryPressure: 'Nessa pontuação pesam mais os alertas dos governos do que os indicadores: {advice}.',
    tie: 'A área {pillar} tem a mesma pontuação ({score}/10).',
    governanceContext:
      'A governança tem pontuação ainda mais baixa ({score}/10): ela diz respeito às instituições e ao Estado de direito, não a um perigo direto para quem viaja.',
    estimates: {
      one: 'O valor da área {list} é só uma estimativa prudente: há poucos dados para medi-lo.',
      other: 'Os valores das áreas {list} são só estimativas prudentes: há poucos dados para medi-los.',
    },
    estimateItem: '{pillar} ({score}/10)',
    strongArea: 'Sua área mais bem avaliada é a {pillar} ({score}/10).',
    strongAreaTie: 'Suas áreas mais bem avaliadas são a {pillar} e a {pillar2} (ambas com {score}/10).',
    weakBest: 'Mesmo sua área mais bem avaliada, a {pillar}, fica em apenas {score}/10.',
    weakBestTie: 'Mesmo suas áreas mais bem avaliadas, a {pillar} e a {pillar2}, ficam em apenas {score}/10.',
    pillarArea: {
      conflict: 'de conflitos',
      crime: 'de criminalidade',
      health: 'de saúde',
      governance: 'de governança',
      environment: 'de riscos naturais',
    },
    adviceSubject: { one: 'o único governo que publica um alerta', all: 'os {n} governos', some: '{k} dos {n} governos' },
    adviceMixed: 'recomendam reconsiderar a viagem ou a desaconselham por completo',
    advisoryNone: 'Nenhum governo em nossos dados publica alertas para quem viaja {nameA}.',
    advisoryOne: 'Só um governo publica alertas para quem viaja {nameA}, e {phrase}.',
    advisoryAll: 'Os {n} governos que publicam alertas para quem viaja {nameA} {phrase}.',
    advisoryMany: 'Dos {n} governos que publicam alertas para quem viaja {nameA}, {breakdown}.',
    levelPhrases: {
      1: ['recomenda as precauções normais', 'recomendam as precauções normais'],
      2: ['recomenda cautela redobrada', 'recomendam cautela redobrada'],
      3: ['recomenda reconsiderar a viagem', 'recomendam reconsiderar a viagem'],
      4: ['desaconselha qualquer viagem', 'desaconselham qualquer viagem'],
    },
    breakdownItem: '{count} {phrase}',
    listSeparator: ', ',
    listLastSeparator: ' e ',
    grey: 'Este destino ainda não tem uma pontuação de segurança oficial: menos de quatro fontes independentes o cobrem, por isso seus dados são parciais.',
  },
  zh: {
    // The band label goes in parentheses: "风险等级为{riskLevel}" doubled 风险 with labels such as
    // 风险极低 and read oddly with 高度谨慎 (2026-10-15 audit, I60).
    scored: '截至{date}，{name}的安全评分为{score}/10（{riskLevel}），在{total}个有官方评分的国家和地区中排名第{rank}。',
    scoredLowConfidence:
      '截至{date}，{name}的安全评分为{score}/10（暂定，{riskLevel}）——由于可用数据有限，请将此视为审慎的估计，而非确定的结论。在{total}个有官方评分的国家和地区中排名第{rank}。',
    driverMainRisk: '主要风险来自{topic}：{fact}。',
    driverConcern: '最需关注的是{topic}：{fact}。',
    driverWeakest: '最薄弱的方面是治理（{score}/10），主要原因是{topic}：{fact}。',
    weakestPlain: '最薄弱的方面是治理（{score}/10）。',
    mainRiskPlain: '主要风险在于{pillar}方面（{score}/10）。',
    concernPlain: '最需关注的是{pillar}方面（{score}/10）。',
    allGood: '五个方面的评分均不低于7/10，其中最低的是{pillar}（{score}/10）。',
    allGoodMeasured: '数据充足的各个方面评分均不低于7/10，其中最低的是{pillar}（{score}/10）。',
    advisoryPressure: '这一得分主要反映的是各国政府的旅行警告，而非具体指标：{advice}。',
    tie: '{pillar}方面的得分与之相同（{score}/10）。',
    governanceContext:
      '治理得分更低（{score}/10）：它反映的是制度与法治状况，而非对旅行者的直接危险。',
    estimates: {
      one: '{list}的数值只是审慎估计：现有数据不足以进行测量。',
      other: '{list}的数值只是审慎估计：现有数据不足以进行测量。',
    },
    estimateItem: '{pillar}（{score}/10）',
    strongArea: '表现最好的方面是{pillar}（{score}/10）。',
    strongAreaTie: '表现最好的方面是{pillar}和{pillar2}（均为{score}/10）。',
    weakBest: '即使是表现最好的{pillar}方面，也只有{score}/10。',
    weakBestTie: '即使是表现最好的{pillar}和{pillar2}方面，也只有{score}/10。',
    pillarArea: { conflict: '冲突', crime: '犯罪', health: '健康', governance: '治理', environment: '自然灾害' },
    adviceSubject: { one: '唯一发布警告的政府', all: '全部{n}国政府均', some: '{n}国政府中有{k}国' },
    adviceMixed: '建议重新考虑出行或切勿前往',
    advisoryNone: '我们的数据中没有任何国家政府为{name}发布旅行警告。',
    advisoryOne: '只有1个国家政府为{name}发布了旅行警告，{phrase}。',
    advisoryAll: '为{name}发布旅行警告的{n}个国家政府均{phrase}。',
    advisoryMany: '在为{name}发布旅行警告的{n}个国家政府中，{breakdown}。',
    // Level 4 is 切勿前往 here as in the FAQ and the advisory glossary (it read 避免一切旅行 here
    // and 切勿前往 a few lines below on the same page: 2026-10-15 audit, I64).
    levelPhrases: {
      1: ['建议采取正常预防措施', '建议采取正常预防措施'],
      2: ['建议提高警惕', '建议提高警惕'],
      3: ['建议重新考虑出行', '建议重新考虑出行'],
      4: ['建议切勿前往', '建议切勿前往'],
    },
    breakdownItem: '{count}个{phrase}',
    listSeparator: '，',
    listLastSeparator: '，',
    grey: '{name}目前还没有官方安全评分：覆盖该地的独立数据来源少于四个，数据并不完整。',
  },
  de: {
    scored:
      'Die Sicherheitsbewertung {nameFuer} liegt zum {date} bei {score}/10 (Einstufung: {riskLevel}). Unter den {total} Ländern mit offizieller Bewertung steht das Land auf Rang {rank}.',
    scoredLowConfidence:
      'Die vorläufige Sicherheitsbewertung {nameFuer} liegt zum {date} bei {score}/10 (vorläufige Einstufung: {riskLevel}). Die verfügbaren Daten sind begrenzt; betrachten Sie den Wert daher als vorsichtige Schätzung und nicht als gesichertes Urteil. Unter den {total} Ländern mit offizieller Bewertung steht das Land auf Rang {rank}.',
    driverMainRisk: 'Das größte Risiko ist {topic}: {fact}.',
    driverConcern: 'Am meisten Aufmerksamkeit verdient {topic}: {fact}.',
    driverWeakest: 'Der schwächste Bereich ist die Regierungsführung ({score}/10); ausschlaggebend ist vor allem {topic}: {fact}.',
    weakestPlain: 'Der schwächste Bereich ist die Regierungsführung ({score}/10).',
    mainRiskPlain: 'Das größte Risiko liegt im Bereich {pillar} ({score}/10).',
    concernPlain: 'Am meisten Aufmerksamkeit verdient der Bereich {pillar} ({score}/10).',
    allGood: 'Alle fünf Bereiche erreichen mindestens 7 von 10; am niedrigsten bewertet ist der Bereich {pillar} ({score}/10).',
    allGoodMeasured: 'Alle Bereiche mit ausreichender Datenlage erreichen mindestens 7 von 10; am niedrigsten bewertet ist der Bereich {pillar} ({score}/10).',
    advisoryPressure: 'Dieser Wert spiegelt eher die staatlichen Reisewarnungen als einzelne Indikatoren wider: {Advice}.',
    tie: 'Denselben Wert ({score}/10) erreicht der Bereich {pillar}.',
    governanceContext:
      'Die Regierungsführung schneidet noch schlechter ab ({score}/10): Sie betrifft Institutionen und Rechtsstaatlichkeit, keine direkte Gefahr für Reisende.',
    estimates: {
      one: 'Der Wert für {list} ist nur eine vorsichtige Schätzung: Für eine Messung gibt es zu wenige Daten.',
      other: 'Die Werte für {list} sind nur vorsichtige Schätzungen: Für eine Messung gibt es zu wenige Daten.',
    },
    estimateItem: '{pillar} ({score}/10)',
    strongArea: 'Am besten bewertet ist der Bereich {pillar} ({score}/10).',
    strongAreaTie: 'Am besten bewertet sind die Bereiche {pillar} und {pillar2} (beide {score}/10).',
    weakBest: 'Selbst der am besten bewertete Bereich, {pillar}, erreicht nur {score}/10.',
    weakBestTie: 'Selbst die am besten bewerteten Bereiche, {pillar} und {pillar2}, erreichen nur {score}/10.',
    pillarArea: {
      conflict: 'Konflikt',
      crime: 'Kriminalität',
      health: 'Gesundheit',
      governance: 'Regierungsführung',
      environment: 'Naturgefahren',
    },
    adviceSubject: { one: 'die einzige Regierung mit einem Reisehinweis', all: 'alle {n} Regierungen', some: '{k} der {n} Regierungen' },
    adviceMixed: 'raten, die Reise zu überdenken oder ganz darauf zu verzichten',
    advisoryNone: 'Keine Regierung in unseren Daten veröffentlicht Reisehinweise {nameFuer}.',
    advisoryOne: 'Nur eine Regierung veröffentlicht Reisehinweise {nameFuer}; sie {phrase}.',
    advisoryAll: 'Alle {n} Regierungen, die Reisehinweise {nameFuer} veröffentlichen, {phrase}.',
    advisoryMany: '{n} Regierungen veröffentlichen Reisehinweise {nameFuer}: {breakdown}.',
    levelPhrases: {
      1: ['empfiehlt normale Vorsicht', 'empfehlen normale Vorsicht'],
      2: ['empfiehlt erhöhte Vorsicht', 'empfehlen erhöhte Vorsicht'],
      3: ['rät, die Reise zu überdenken', 'raten, die Reise zu überdenken'],
      4: ['rät von allen Reisen ab', 'raten von allen Reisen ab'],
    },
    breakdownItem: '{count} {phrase}',
    listSeparator: ', ',
    listLastSeparator: ' und ',
    grey: 'Für dieses Reiseziel gibt es noch keine offizielle Sicherheitsbewertung: Weniger als vier unabhängige Quellen decken es ab, die Datenlage ist daher unvollständig.',
  },
};
