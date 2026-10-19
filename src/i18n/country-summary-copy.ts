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
  /** Focus pillar below 5.0/10 whose driver value is bad: {pillar} {score} {topic} {fact}. */
  driverMainRisk: string;
  /** Focus pillar at 5.0-6.9/10 whose driver value is bad: {pillar} {score} {topic} {fact}. */
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
  /** First after the opener when most governments advise reconsidering travel or worse: {advice}/{Advice}. */
  advisoryLead: string;
  /** Conflict pillar held down by government advice rather than an indicator: {pillar} {advice}/{Advice}. */
  advisoryPressure: string;
  /** The same after advisoryLead has given the numbers: {pillar}. */
  advisoryPressureShort: string;
  /** Another risk pillar at exactly the focus's displayed value: {pillar} {score}. */
  tieExact: string;
  /** Another risk pillar within 0.2 of the focus: {pillar} {score}. */
  tieNear: string;
  /** Measured governance below a direct-risk focus, compared with it: {score} {focus} {focusScore}. */
  governanceContext: string;
  /** Estimated (asterisked) pillars below what the text claims: {list} of `estimateItem`. */
  estimates: { one: string; other: string };
  /**
   * Pillars whose bar reads "No data" (isEstimatedPillar): named without a value, {list} of
   * `pillarArea` forms. Never a number: the engine value behind them is the regional prior.
   */
  noDataPillars: { one: string; other: string };
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
  /** `grey` for a place with enough sources but none that measures crime (coverage.ts coverageShortfall 'crime'). */
  greyNoCrime: string;
}

const NBSP = ' ';

export const countrySummaryCopy: Record<Lang, CountrySummaryCopy> = {
  en: {
    scored:
      '{name} has a safety score of {score}/10 as of {date}, rated as {riskLevel} and ranking {rank} of the {total} countries we score.',
    scoredLowConfidence:
      '{name} has a provisional safety score of {score}/10 as of {date}, tentatively rated as {riskLevel}: there is limited data behind it, so treat it as a cautious estimate rather than a confident verdict. It ranks {rank} of the {total} countries we score.',
    driverMainRisk: 'The main risk is {pillar} ({score}/10), above all {topic}: {fact}.',
    driverConcern: 'The main concern is {pillar} ({score}/10), above all {topic}: {fact}.',
    driverWeakest: 'The weakest area is governance ({score}/10), driven mainly by {topic}: {fact}.',
    weakestPlain: 'The weakest area is governance ({score}/10).',
    mainRiskPlain: 'The main risk is {pillar} ({score}/10).',
    concernPlain: 'The main concern is {pillar} ({score}/10).',
    allGood: 'All five areas score at least 7 out of 10; the lowest is {pillar} ({score}/10).',
    allGoodMeasured: 'Every area measured with enough data scores at least 7 out of 10; the lowest of them is {pillar} ({score}/10).',
    advisoryPressure: 'The {pillar} score reflects government warnings more than any measured indicator: {advice}.',
    advisoryPressureShort: 'The {pillar} score reflects these warnings more than any measured indicator.',
    advisoryLead: 'Government advice is the strongest warning here: {advice}.',
    tieExact: 'The {pillar} score is the same ({score}/10).',
    tieNear: 'The {pillar} score is almost as low ({score}/10).',
    governanceContext:
      'At {score}/10, governance scores even lower than {focus} ({focusScore}/10), but it reflects institutions and the rule of law rather than a direct danger to visitors.',
    estimates: {
      one: 'The value for {list} is a cautious estimate: there is too little data to measure it.',
      other: 'The values for {list} are cautious estimates: there is too little data to measure them.',
    },
    noDataPillars: {
      one: 'There is no data on {list} yet.',
      other: 'There is no data on {list} yet.',
    },
    estimateItem: '{pillar} ({score}/10)',
    strongArea: 'The best-rated area is {pillar} ({score}/10).',
    strongAreaTie: 'The best-rated areas are {pillar} and {pillar2} (both {score}/10).',
    weakBest: 'Even the best-rated area, {pillar}, scores only {score}/10.',
    weakBestTie: 'Even the best-rated areas, {pillar} and {pillar2}, score only {score}/10.',
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
    grey: 'There is no safety score for {name} yet: fewer than four independent sources cover this place, so its data is partial.',
    greyNoCrime: 'There is no safety score for {name} yet: several independent sources cover this place, but none of them measures crime, so its data is partial.',
  },
  it: {
    scored:
      'Per chi viaggia {nameIn}, il punteggio di sicurezza al {date} è {score}/10, classificato come {riskLevel}: {rank} posto su {total} paesi valutati.',
    scoredLowConfidence:
      'Per chi viaggia {nameIn}, il punteggio di sicurezza provvisorio al {date} è {score}/10, classificato in via preliminare come {riskLevel}: i dati disponibili sono limitati, quindi consideralo una stima prudente e non un verdetto definitivo. È al {rank} posto su {total} paesi valutati.',
    driverMainRisk: 'Il rischio principale riguarda l\'area {pillar} ({score}/10), soprattutto per {topic}: {fact}.',
    driverConcern: 'La principale criticità riguarda l\'area {pillar} ({score}/10), soprattutto per {topic}: {fact}.',
    driverWeakest: 'Il punto più debole è la governance ({score}/10); pesa soprattutto {topic}: {fact}.',
    weakestPlain: 'Il punto più debole è la governance ({score}/10).',
    mainRiskPlain: "Il rischio principale riguarda l'area {pillar} ({score}/10).",
    concernPlain: "La principale criticità riguarda l'area {pillar} ({score}/10).",
    allGood: 'Tutte e cinque le aree raggiungono almeno 7 su 10; la più bassa è quella {pillar} ({score}/10).',
    allGoodMeasured: 'Tutte le aree misurate con dati sufficienti raggiungono almeno 7 su 10; la più bassa è quella {pillar} ({score}/10).',
    advisoryPressure: 'Sul punteggio dell\'area {pillar} pesano più gli avvisi dei governi che gli indicatori misurati: {advice}.',
    advisoryPressureShort: 'Sul punteggio dell\'area {pillar} pesano più questi avvisi che gli indicatori misurati.',
    advisoryLead: 'L\'avvertimento più forte viene dai governi: {advice}.',
    tieExact: 'Anche l\'area {pillar} ha lo stesso punteggio ({score}/10).',
    tieNear: 'Di poco più alta è l\'area {pillar} ({score}/10).',
    governanceContext:
      'Con {score}/10, la governance ha un punteggio ancora più basso dell\'area {focus} ({focusScore}/10), ma misura la solidità delle istituzioni e dello stato di diritto e non è un pericolo diretto per chi viaggia.',
    estimates: {
      one: 'Il valore {list} è solo una stima prudente: i dati disponibili sono troppo pochi per misurarlo.',
      other: 'I valori {list} sono solo stime prudenti: i dati disponibili sono troppo pochi per misurarli.',
    },
    noDataPillars: {
      one: "Per l'area {list} non ci sono ancora dati.",
      other: 'Per le aree {list} non ci sono ancora dati.',
    },
    estimateItem: '{pillar} ({score}/10)',
    strongArea: "L'area con il punteggio migliore è quella {pillar} ({score}/10).",
    strongAreaTie: 'Le aree con il punteggio migliore sono quella {pillar} e quella {pillar2} (entrambe {score}/10).',
    weakBest: 'Nemmeno l\'area con il punteggio migliore, quella {pillar}, supera {score}/10.',
    weakBestTie: 'Nemmeno le aree con il punteggio migliore, quella {pillar} e quella {pillar2}, superano {score}/10.',
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
    grey: 'Questa destinazione non ha ancora un punteggio di sicurezza: la coprono meno di quattro fonti indipendenti, quindi i dati sono parziali.',
    greyNoCrime: 'Questa destinazione non ha ancora un punteggio di sicurezza: la coprono diverse fonti indipendenti, ma nessuna misura la criminalità, quindi i dati sono parziali.',
  },
  es: {
    scored:
      '{NameEsSubj} tiene una puntuación de seguridad de {score}/10 a fecha de {date}, clasificada como {riskLevel}: puesto {rank} de los {total} países evaluados.',
    scoredLowConfidence:
      '{NameEsSubj} tiene una puntuación de seguridad provisional de {score}/10 a fecha de {date}, clasificada de forma preliminar como {riskLevel}: los datos disponibles son limitados, así que tómala como una estimación prudente y no como un veredicto definitivo. Ocupa el puesto {rank} de los {total} países evaluados.',
    driverMainRisk: 'El principal riesgo está en el área de {pillar} ({score}/10), sobre todo por {topic}: {fact}.',
    driverConcern: 'La principal preocupación está en el área de {pillar} ({score}/10), sobre todo por {topic}: {fact}.',
    driverWeakest: 'El punto más débil es la gobernanza ({score}/10); pesa sobre todo {topic}: {fact}.',
    weakestPlain: 'El punto más débil es la gobernanza ({score}/10).',
    mainRiskPlain: 'El principal riesgo está en el área de {pillar} ({score}/10).',
    concernPlain: 'La principal preocupación está en el área de {pillar} ({score}/10).',
    allGood: 'Las cinco áreas obtienen al menos un 7 sobre 10; la más baja es la de {pillar} ({score}/10).',
    allGoodMeasured: 'Todas las áreas medidas con datos suficientes obtienen al menos un 7 sobre 10; la más baja es la de {pillar} ({score}/10).',
    advisoryPressure: 'La puntuación del área de {pillar} refleja más los avisos de los gobiernos que los indicadores medidos: {advice}.',
    advisoryPressureShort: 'La puntuación del área de {pillar} refleja más estos avisos que los indicadores medidos.',
    advisoryLead: 'La advertencia más clara viene de los gobiernos: {advice}.',
    tieExact: 'El área de {pillar} tiene la misma puntuación ({score}/10).',
    tieNear: 'El área de {pillar} queda apenas por encima ({score}/10).',
    governanceContext:
      'La gobernanza obtiene una nota aún más baja ({score}/10) que el área de {focus} ({focusScore}/10), pero no supone un peligro directo para el viajero: mide las instituciones y el Estado de derecho.',
    estimates: {
      one: 'El valor del área {list} es solo una estimación prudente: no hay datos suficientes para medirlo.',
      other: 'Los valores de las áreas {list} son solo estimaciones prudentes: no hay datos suficientes para medirlos.',
    },
    noDataPillars: {
      one: 'Todavía no hay datos sobre el área de {list}.',
      other: 'Todavía no hay datos sobre las áreas de {list}.',
    },
    estimateItem: 'de {pillar} ({score}/10)',
    strongArea: 'El área mejor valorada es la de {pillar} ({score}/10).',
    strongAreaTie: 'Las áreas mejor valoradas son la de {pillar} y la de {pillar2} (ambas con {score}/10).',
    weakBest: 'Ni siquiera el área mejor valorada, la de {pillar}, pasa de {score}/10.',
    weakBestTie: 'Ni siquiera las áreas mejor valoradas, la de {pillar} y la de {pillar2}, pasan de {score}/10.',
    pillarArea: { conflict: 'conflictos', crime: 'criminalidad', health: 'salud', governance: 'gobernanza', environment: 'riesgos naturales' },
    adviceSubject: { one: 'el único gobierno que publica un aviso', all: 'los {n} gobiernos', some: '{k} de los {n} gobiernos' },
    adviceMixed: 'aconsejan reconsiderar el viaje o lo desaconsejan por completo',
    advisoryNone: 'Ningún gobierno de nuestros datos publica avisos para quien viaja {nameEsA}.',
    advisoryOne: 'Solo un gobierno publica avisos para quien viaja {nameEsA}, y {phrase}.',
    advisoryAll: 'Los {n} gobiernos que publican avisos para quien viaja {nameEsA} {phrase}.',
    advisoryMany: 'De los {n} gobiernos que publican avisos para quien viaja {nameEsA}, {breakdown}.',
    levelPhrases: {
      1: ['recomienda las precauciones habituales', 'recomiendan las precauciones habituales'],
      2: ['recomienda extremar la precaución', 'recomiendan extremar la precaución'],
      3: ['aconseja reconsiderar el viaje', 'aconsejan reconsiderar el viaje'],
      4: ['desaconseja todo viaje', 'desaconsejan todo viaje'],
    },
    breakdownItem: '{count} {phrase}',
    listSeparator: ', ',
    listLastSeparator: ' y ',
    grey: 'Este destino todavía no tiene una puntuación de seguridad: lo cubren menos de cuatro fuentes independientes, así que sus datos son parciales.',
    greyNoCrime: 'Este destino todavía no tiene una puntuación de seguridad: lo cubren varias fuentes independientes, pero ninguna mide la delincuencia, así que sus datos son parciales.',
  },
  fr: {
    scored: `Pour un voyage {namePrep}, le score de sécurité est de {score}/10 au {date}, classé comme {riskLevel}${NBSP}: {rank} sur les {total} pays notés.`,
    scoredLowConfidence: `Pour un voyage {namePrep}, le score de sécurité provisoire est de {score}/10 au {date}, classé à titre préliminaire comme {riskLevel}${NBSP}: les données disponibles sont limitées, il s’agit donc d’une estimation prudente plutôt que d’un verdict fiable. Classement${NBSP}: {rank} sur les {total} pays notés.`,
    driverMainRisk: `Le principal risque concerne le domaine {pillar} ({score}/10)${NBSP}; en cause surtout {topic}${NBSP}: {fact}.`,
    driverConcern: `Le principal point de vigilance concerne le domaine {pillar} ({score}/10)${NBSP}; en cause surtout {topic}${NBSP}: {fact}.`,
    driverWeakest: `Le point le plus faible est la gouvernance ({score}/10)${NBSP}; en cause surtout {topic}${NBSP}: {fact}.`,
    weakestPlain: 'Le point le plus faible est la gouvernance ({score}/10).',
    mainRiskPlain: 'Le principal risque concerne le domaine {pillar} ({score}/10).',
    concernPlain: 'Le principal point de vigilance concerne le domaine {pillar} ({score}/10).',
    allGood: `Les cinq domaines obtiennent au moins 7 sur 10${NBSP}; le moins bien noté est celui {pillar} ({score}/10).`,
    allGoodMeasured: `Tous les domaines mesurés avec suffisamment de données obtiennent au moins 7 sur 10${NBSP}; le moins bien noté est celui {pillar} ({score}/10).`,
    advisoryPressure: `Le score du domaine {pillar} reflète davantage les avertissements officiels que les indicateurs mesurés${NBSP}: {advice}.`,
    advisoryPressureShort: 'Le score du domaine {pillar} reflète davantage ces avertissements que les indicateurs mesurés.',
    advisoryLead: `L’alerte la plus nette vient des gouvernements${NBSP}: {advice}.`,
    tieExact: 'Le domaine {pillar} obtient le même score ({score}/10).',
    tieNear: 'Le domaine {pillar} n’est guère plus haut ({score}/10).',
    governanceContext:
      'Avec {score}/10, la gouvernance obtient un score encore plus bas que le domaine {focus} ({focusScore}/10), mais elle mesure les institutions et l’État de droit et ne représente pas un danger direct pour les voyageurs.',
    estimates: {
      one: `La valeur {list} n’est qu’une estimation prudente${NBSP}: les données sont trop rares pour la mesurer.`,
      other: `Les valeurs {list} ne sont que des estimations prudentes${NBSP}: les données sont trop rares pour les mesurer.`,
    },
    noDataPillars: {
      one: 'Il n’y a pas encore de données pour le domaine {list}.',
      other: 'Il n’y a pas encore de données pour les domaines {list}.',
    },
    estimateItem: '{pillar} ({score}/10)',
    strongArea: 'Le domaine le mieux noté est celui {pillar} ({score}/10).',
    strongAreaTie: 'Les domaines les mieux notés sont celui {pillar} et celui {pillar2} (tous deux à {score}/10).',
    weakBest: 'Même le domaine le mieux noté, celui {pillar}, n’obtient que {score}/10.',
    weakBestTie: 'Même les domaines les mieux notés, celui {pillar} et celui {pillar2}, n’obtiennent que {score}/10.',
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
    grey: `Cette destination n’a pas encore de score de sécurité${NBSP}: moins de quatre sources indépendantes la couvrent, ses données sont donc partielles.`,
    greyNoCrime: `Cette destination n’a pas encore de score de sécurité${NBSP}: plusieurs sources indépendantes la couvrent, mais aucune ne mesure la criminalité, ses données sont donc partielles.`,
  },
  pt: {
    scored:
      'A pontuação de segurança {nameDe} é de {score}/10 em {date}, classificada como {riskLevel}: {rank} lugar entre os {total} países avaliados.',
    scoredLowConfidence:
      'A pontuação de segurança {nameDe} é provisória: {score}/10 em {date}, classificada de forma preliminar como {riskLevel}. Os dados disponíveis são limitados, portanto trate-a como uma estimativa prudente, e não como um veredito confiável. Ocupa o {rank} lugar entre os {total} países avaliados.',
    driverMainRisk: 'O principal risco está na área {pillar} ({score}/10); pesa sobretudo {topic}: {fact}.',
    driverConcern: 'A principal preocupação está na área {pillar} ({score}/10); pesa sobretudo {topic}: {fact}.',
    driverWeakest: 'O ponto mais fraco é a governança ({score}/10); pesa sobretudo {topic}: {fact}.',
    weakestPlain: 'O ponto mais fraco é a governança ({score}/10).',
    mainRiskPlain: 'O principal risco está na área {pillar} ({score}/10).',
    concernPlain: 'A principal preocupação está na área {pillar} ({score}/10).',
    allGood: 'As cinco áreas têm pelo menos 7 de 10; a mais baixa é a {pillar} ({score}/10).',
    allGoodMeasured: 'Todas as áreas medidas com dados suficientes têm pelo menos 7 de 10; a mais baixa é a {pillar} ({score}/10).',
    advisoryPressure: 'A nota da área {pillar} reflete mais os alertas dos governos do que os indicadores medidos: {advice}.',
    advisoryPressureShort: 'A nota da área {pillar} reflete mais esses alertas do que os indicadores medidos.',
    advisoryLead: 'O alerta mais forte vem dos governos: {advice}.',
    tieExact: 'A área {pillar} tem a mesma pontuação ({score}/10).',
    tieNear: 'A área {pillar} fica pouco acima ({score}/10).',
    governanceContext:
      'Com {score}/10, a governança tem nota ainda mais baixa que a área {focus} ({focusScore}/10), mas mede as instituições e o Estado de direito, não um perigo direto para quem viaja.',
    estimates: {
      one: 'O valor da área {list} é só uma estimativa prudente: há poucos dados para medi-lo.',
      other: 'Os valores das áreas {list} são só estimativas prudentes: há poucos dados para medi-los.',
    },
    noDataPillars: {
      one: 'Ainda não há dados para a área {list}.',
      other: 'Ainda não há dados para as áreas {list}.',
    },
    estimateItem: '{pillar} ({score}/10)',
    strongArea: 'A área mais bem avaliada é a {pillar} ({score}/10).',
    strongAreaTie: 'As áreas mais bem avaliadas são a {pillar} e a {pillar2} (ambas com {score}/10).',
    weakBest: 'Mesmo a área mais bem avaliada, a {pillar}, fica em apenas {score}/10.',
    weakBestTie: 'Mesmo as áreas mais bem avaliadas, a {pillar} e a {pillar2}, ficam em apenas {score}/10.',
    pillarArea: {
      conflict: 'de conflitos',
      crime: 'de criminalidade',
      health: 'de saúde',
      governance: 'de governança',
      environment: 'de riscos naturais',
    },
    adviceSubject: { one: 'o único governo que publica um alerta', all: 'todos os {n} governos', some: '{k} dos {n} governos' },
    adviceMixed: 'recomendam reconsiderar a viagem ou a desaconselham por completo',
    advisoryNone: 'Nenhum governo em nossos dados publica alertas para quem viaja {nameA}.',
    advisoryOne: 'Só um governo publica alertas para quem viaja {nameA}, e {phrase}.',
    advisoryAll: 'Todos os {n} governos que publicam alertas para quem viaja {nameA} {phrase}.',
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
    grey: 'Este destino ainda não tem uma pontuação de segurança: menos de quatro fontes independentes o cobrem, por isso seus dados são parciais.',
    greyNoCrime: 'Este destino ainda não tem uma pontuação de segurança: várias fontes independentes o cobrem, mas nenhuma mede a criminalidade, por isso seus dados são parciais.',
  },
  zh: {
    // The band label goes in parentheses: "风险等级为{riskLevel}" doubled 风险 with labels such as
    // 风险极低 and read oddly with 高度谨慎 (2026-10-15 audit, I60).
    scored: '截至{date}，{name}的安全评分为{score}/10（{riskLevel}），在{total}个已评分的国家和地区中排名第{rank}位。',
    scoredLowConfidence:
      '截至{date}，{name}的安全评分为{score}/10（暂定，{riskLevel}）——由于可用数据有限，请将此视为审慎的估计，而非确定的结论。在{total}个已评分的国家和地区中排名第{rank}位。',
    driverMainRisk: '主要风险在于{pillar}方面（{score}/10），尤其是{topic}：{fact}。',
    driverConcern: '最需关注的是{pillar}方面（{score}/10），尤其是{topic}：{fact}。',
    driverWeakest: '最薄弱的方面是治理（{score}/10），主要原因是{topic}：{fact}。',
    weakestPlain: '最薄弱的方面是治理（{score}/10）。',
    mainRiskPlain: '主要风险在于{pillar}方面（{score}/10）。',
    concernPlain: '最需关注的是{pillar}方面（{score}/10）。',
    allGood: '五个方面的评分均不低于7/10，其中最低的是{pillar}（{score}/10）。',
    allGoodMeasured: '数据充足的各个方面评分均不低于7/10，其中最低的是{pillar}（{score}/10）。',
    advisoryPressure: '{pillar}方面的得分主要反映各国政府的旅行警告，而非实测指标：{advice}。',
    advisoryPressureShort: '{pillar}方面的得分主要反映这些警告，而非实测指标。',
    advisoryLead: '最明确的警示来自各国政府：{advice}。',
    tieExact: '{pillar}方面的得分与之相同（{score}/10）。',
    tieNear: '{pillar}方面的得分仅略高（{score}/10）。',
    governanceContext:
      '治理得分为{score}/10，比{focus}方面（{focusScore}/10）还低，但这一项反映的是制度与法治状况，并不直接威胁旅行者安全。',
    estimates: {
      one: '{list}的数值因数据不足，只是保守估计。',
      other: '{list}的数值因数据不足，只是保守估计。',
    },
    noDataPillars: {
      one: '{list}方面暂无数据。',
      other: '{list}方面暂无数据。',
    },
    estimateItem: '{pillar}（{score}/10）',
    strongArea: '得分最高的是{pillar}方面（{score}/10）。',
    strongAreaTie: '得分最高的是{pillar}和{pillar2}方面（均为{score}/10）。',
    weakBest: '即使得分最高的{pillar}方面，也只有{score}/10。',
    weakBestTie: '即使得分最高的{pillar}和{pillar2}方面，也只有{score}/10。',
    pillarArea: { conflict: '冲突', crime: '犯罪', health: '健康', governance: '治理', environment: '自然灾害' },
    adviceSubject: { one: '唯一发布警告的政府', all: '全部{n}个政府均', some: '{n}个政府中有{k}个' },
    adviceMixed: '建议重新考虑出行或切勿前往',
    advisoryNone: '我们的数据中没有任何政府为{name}发布旅行警告。',
    advisoryOne: '只有1个政府为{name}发布了旅行警告，{phrase}。',
    advisoryAll: '为{name}发布旅行警告的{n}个政府均{phrase}。',
    advisoryMany: '在为{name}发布旅行警告的{n}个政府中，{breakdown}。',
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
    grey: '{name}目前还没有安全评分：覆盖该地的独立数据来源少于四个，数据并不完整。',
    greyNoCrime: '{name}目前还没有安全评分：有多个独立数据来源覆盖该地，但没有一个衡量犯罪情况，数据并不完整。',
  },
  de: {
    scored:
      'Die Sicherheitsbewertung {nameFuer} liegt zum {date} bei {score}/10 (Einstufung: {riskLevel}). Unter den {total} von uns bewerteten Ländern steht das Land auf Rang {rank}.',
    scoredLowConfidence:
      'Die vorläufige Sicherheitsbewertung {nameFuer} liegt zum {date} bei {score}/10 (vorläufige Einstufung: {riskLevel}). Die verfügbaren Daten sind begrenzt; betrachten Sie den Wert daher als vorsichtige Schätzung und nicht als gesichertes Urteil. Unter den {total} von uns bewerteten Ländern steht das Land auf Rang {rank}.',
    driverMainRisk: 'Das größte Risiko liegt im Bereich {pillar} ({score}/10); ausschlaggebend ist vor allem {topic}: {fact}.',
    driverConcern: 'Die meiste Aufmerksamkeit verdient der Bereich {pillar} ({score}/10); ausschlaggebend ist vor allem {topic}: {fact}.',
    driverWeakest: 'Der schwächste Bereich ist die Regierungsführung ({score}/10); ausschlaggebend ist vor allem {topic}: {fact}.',
    weakestPlain: 'Der schwächste Bereich ist die Regierungsführung ({score}/10).',
    mainRiskPlain: 'Das größte Risiko liegt im Bereich {pillar} ({score}/10).',
    concernPlain: 'Die meiste Aufmerksamkeit verdient der Bereich {pillar} ({score}/10).',
    allGood: 'Alle fünf Bereiche erreichen mindestens 7 von 10; am niedrigsten bewertet ist der Bereich {pillar} ({score}/10).',
    allGoodMeasured: 'Alle Bereiche mit ausreichender Datenlage erreichen mindestens 7 von 10; am niedrigsten bewertet ist der Bereich {pillar} ({score}/10).',
    advisoryPressure: 'Der Wert im Bereich {pillar} beruht eher auf den staatlichen Reisehinweisen als auf Messdaten: {Advice}.',
    advisoryPressureShort: 'Der Wert im Bereich {pillar} beruht eher auf diesen Reisehinweisen als auf Messdaten.',
    advisoryLead: 'Am deutlichsten warnen die Regierungen: {Advice}.',
    tieExact: 'Denselben Wert erreicht der Bereich {pillar} ({score}/10).',
    tieNear: 'Kaum besser schneidet der Bereich {pillar} ab ({score}/10).',
    governanceContext:
      'Mit {score}/10 liegt die Regierungsführung noch unter dem Bereich {focus} ({focusScore}/10); sie bewertet Institutionen und Rechtsstaatlichkeit und ist für Reisende keine unmittelbare Gefahr.',
    estimates: {
      one: 'Der Wert für {list} ist nur eine vorsichtige Schätzung: Für eine Messung gibt es zu wenige Daten.',
      other: 'Die Werte für {list} sind nur vorsichtige Schätzungen: Für eine Messung gibt es zu wenige Daten.',
    },
    noDataPillars: {
      one: 'Für den Bereich {list} liegen noch keine Daten vor.',
      other: 'Für die Bereiche {list} liegen noch keine Daten vor.',
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
    grey: 'Für dieses Reiseziel gibt es noch keine Sicherheitsbewertung: Weniger als vier unabhängige Quellen decken es ab, die Datenlage ist daher unvollständig.',
    greyNoCrime: 'Für dieses Reiseziel gibt es noch keine Sicherheitsbewertung: Mehrere unabhängige Quellen decken es ab, aber keine misst die Kriminalität, die Datenlage ist daher unvollständig.',
  },
};
