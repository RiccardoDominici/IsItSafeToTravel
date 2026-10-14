/**
 * Copy for the top summary of every country page (AnswerFirstParagraph.astro, built by
 * src/lib/country-summary.ts), all 7 locales.
 *
 * WHY it was rewritten (formula v10, SPEC §7): the old second sentence read "the biggest concern
 * is governance (3.9/10), while the strongest area is conflict (6.9/10)": two normalised numbers
 * nobody can check, and a "strongest area" that was only relatively strong. It now names the
 * concrete driver of the weakest pillar with the source's own value, year and source (e.g. "The
 * main risk is violent crime: 45.7 homicides per 100,000 people (World Bank, 2023)"), the
 * government advisories by level, and a strong area only when it is good in absolute terms
 * (pillar >= 7.0).
 *
 * Tokens: {name} {score} {date} {riskLevel} {rank} {total} (opener); {topic} {fact} (driver,
 * from src/i18n/indicator-copy.ts); {pillar} {score} (fallback/strong area, `pillarArea` form);
 * {n} {breakdown} {phrase} {count} plus the locale's own country-phrase token (advisories).
 *
 * Grammar: every country name inside a sentence goes through country-grammar.ts (see the
 * `advisory*` templates: it uses the locative "in Ecuador / negli Stati Uniti", fr "en Équateur",
 * pt "ao Equador" / "do Equador", de "für die Türkei"); es and zh take the bare name. it/fr/pt never put
 * the bare name in subject position (it and fr need an article the grammar tables do not carry for
 * every country, pt plural names would need "têm"): the openers start from the score instead. German subjects that could
 * be plural ("die Vereinigten Staaten") are avoided with "für {name}" and "das Land". zh never
 * puts a space between the country name and the Chinese text.
 */
import type { Lang } from './ui';
import type { PillarName } from '../pipeline/types';

/** Advisory level 1..4 -> [singular verb phrase, plural verb phrase]. */
export type LevelPhrases = Record<1 | 2 | 3 | 4, readonly [string, string]>;

export interface CountrySummaryCopy {
  scored: string;
  scoredLowConfidence: string;
  /** Driver pillar (the weakest direct-risk pillar) below 5.0/10. */
  driverMainRisk: string;
  /** Driver pillar at 5.0-6.9/10. */
  driverConcern: string;
  /** Every direct-risk pillar is at 7.0+ but governance is lower: governance is named as the weakest area. */
  driverWeakest: string;
  /** Every pillar at 7.0/10 or above. */
  driverAllGood: string;
  /** No describable indicator behind the weakest pillar. */
  driverFallback: string;
  /** Strongest pillar, only when it is at 7.0/10 or above. */
  strongArea: string;
  /** Pillar name in the form `driverFallback` / `strongArea` take ("della salute", "Gesundheit"). */
  pillarArea: Record<PillarName, string>;
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
    driverWeakest: 'The weakest area is {topic}: {fact}.',
    driverAllGood: 'All five areas score at least 7 out of 10; the lowest-rated is {topic}: {fact}.',
    driverFallback: 'Its weakest area is {pillar} ({score}/10).',
    strongArea: 'Its best-rated area is {pillar} ({score}/10).',
    pillarArea: { conflict: 'conflict', crime: 'crime', health: 'health', governance: 'governance', environment: 'natural hazards' },
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
    driverWeakest: 'Il punto più debole è {topic}: {fact}.',
    driverAllGood: 'Tutte e cinque le aree raggiungono almeno 7 su 10; la più bassa riguarda {topic}: {fact}.',
    driverFallback: "L'area più debole è quella {pillar} ({score}/10).",
    strongArea: "L'area con il punteggio migliore è quella {pillar} ({score}/10).",
    pillarArea: {
      conflict: 'dei conflitti',
      crime: 'della criminalità',
      health: 'della salute',
      governance: 'della governance',
      environment: 'dei rischi naturali',
    },
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
    driverWeakest: 'El punto más débil es {topic}: {fact}.',
    driverAllGood: 'Las cinco áreas obtienen al menos un 7 sobre 10; la peor valorada es {topic}: {fact}.',
    driverFallback: 'Su área más débil es la de {pillar} ({score}/10).',
    strongArea: 'Su área mejor valorada es la de {pillar} ({score}/10).',
    pillarArea: { conflict: 'conflictos', crime: 'criminalidad', health: 'salud', governance: 'gobernanza', environment: 'riesgos naturales' },
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
    driverWeakest: `Le point le plus faible est {topic}${NBSP}: {fact}.`,
    driverAllGood: `Les cinq domaines obtiennent au moins 7 sur 10${NBSP}; le moins bien noté est {topic}${NBSP}: {fact}.`,
    driverFallback: 'Son domaine le plus faible est celui {pillar} ({score}/10).',
    strongArea: 'Son domaine le mieux noté est celui {pillar} ({score}/10).',
    pillarArea: {
      conflict: 'des conflits',
      crime: 'de la criminalité',
      health: 'de la santé',
      governance: 'de la gouvernance',
      environment: 'des risques naturels',
    },
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
    driverWeakest: 'O ponto mais fraco é {topic}: {fact}.',
    driverAllGood: 'As cinco áreas têm pelo menos 7 de 10; a mais baixa é {topic}: {fact}.',
    driverFallback: 'Sua área mais fraca é a {pillar} ({score}/10).',
    strongArea: 'Sua área mais bem avaliada é a {pillar} ({score}/10).',
    pillarArea: {
      conflict: 'de conflitos',
      crime: 'de criminalidade',
      health: 'de saúde',
      governance: 'de governança',
      environment: 'de riscos naturais',
    },
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
    scored: '截至{date}，{name}的安全评分为{score}/10，风险等级为{riskLevel}，在{total}个有官方评分的国家和地区中排名第{rank}。',
    scoredLowConfidence:
      '截至{date}，{name}的安全评分为{score}/10（暂定），风险等级初步评为{riskLevel}——由于可用数据有限，请将此视为审慎的估计，而非确定的结论。在{total}个有官方评分的国家和地区中排名第{rank}。',
    driverMainRisk: '主要风险是{topic}：{fact}。',
    driverConcern: '最需关注的是{topic}：{fact}。',
    driverWeakest: '最薄弱的方面是{topic}：{fact}。',
    driverAllGood: '五个方面的评分均不低于7/10，其中评分最低的是{topic}：{fact}。',
    driverFallback: '最薄弱的方面是{pillar}（{score}/10）。',
    strongArea: '表现最好的方面是{pillar}（{score}/10）。',
    pillarArea: { conflict: '冲突', crime: '犯罪', health: '健康', governance: '治理', environment: '自然灾害' },
    advisoryNone: '我们的数据中没有任何国家政府为{name}发布旅行警告。',
    advisoryOne: '只有1个国家政府为{name}发布了旅行警告，{phrase}。',
    advisoryAll: '为{name}发布旅行警告的{n}个国家政府均{phrase}。',
    advisoryMany: '在为{name}发布旅行警告的{n}个国家政府中，{breakdown}。',
    levelPhrases: {
      1: ['建议采取正常预防措施', '建议采取正常预防措施'],
      2: ['建议提高警惕', '建议提高警惕'],
      3: ['建议重新考虑出行', '建议重新考虑出行'],
      4: ['建议避免一切旅行', '建议避免一切旅行'],
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
    driverWeakest: 'Der schwächste Bereich ist {topic}: {fact}.',
    driverAllGood: 'Alle fünf Bereiche erreichen mindestens 7 von 10; am niedrigsten bewertet ist {topic}: {fact}.',
    driverFallback: 'Am schwächsten ist der Bereich {pillar} ({score}/10).',
    strongArea: 'Am besten bewertet ist der Bereich {pillar} ({score}/10).',
    pillarArea: {
      conflict: 'Konflikt',
      crime: 'Kriminalität',
      health: 'Gesundheit',
      governance: 'Regierungsführung',
      environment: 'Naturgefahren',
    },
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
