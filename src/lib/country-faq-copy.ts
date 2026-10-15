/**
 * Template copy for the country-page FAQ answers, in all 7 languages.
 * Consumed by getCountryFaqData in src/lib/seo.ts, which picks the variant per country and fills the
 * placeholders. The answers feed both the visible FAQ and the FAQPage JSON-LD, which stay identical.
 *
 * Rewritten after the 2026-10-15 consistency audit (scripts/calibration/consistency/issues.json):
 *  - the pillar each answer names comes from src/lib/pillar-focus.ts, the same selection the summary
 *    and the meta description use, and the shared pillar sentences (tie, lower governance bar,
 *    estimates, best area) come from src/i18n/country-summary-copy.ts via pillar-narrative.ts, so
 *    the FAQ cannot name another "main risk" or call a 4.1/10 pillar a strength (I01 I02 I05 I16);
 *  - the verdict follows the government advisories as well as the band: no plain "Yes" when most
 *    governments advise reconsidering travel or worse, and a "No" that says so when most advise
 *    against all travel (I06 I18); the 5-6 band opens with the hero badge's own words (I23);
 *  - the advisory answer is built from the real distribution (the summary's breakdown sentence),
 *    never "most governments" for one advisory or "none above a low level" next to level 3-4 (I03
 *    I14 I15); issuers are named with their article where the language needs one (I19);
 *  - country names never stand bare after a preposition or as a subject where the language needs an
 *    article: it uses the locative ({nameIn}), fr the au/en/aux phrase ({namePrep}), pt the
 *    contracted forms ({nameDe} {nameA} {nameArt}), de the nominative/directional/für/über forms
 *    (I38 I39 I40 I48); en avoids possessives on plural names ("the Philippines's", I65).
 *
 * Placeholders: {name} (en: with "the" where needed; other locales: bare) and the locale phrases
 * above; {year} {monthYear} {score} {riskLevel} (overall score, inline band label); {advice} /
 * {Advice} (advisory-majority clause, lowercase / capitalised); {pillar} {pillarScore} (a pillar in
 * the summary copy's `pillarArea` form, with its /10 value); {low} {lowScore} {high} {highScore}
 * (range); {topic} {fact} (indicator driver, src/i18n/indicator-copy.ts); {sentence} (the summary's
 * advisory breakdown); {issuer} {issuers} {k} {level} {phrase} (advisory answer).
 */
import type { Lang } from '../i18n/ui';
import type { PillarName } from '../pipeline/types';
import type { BandKey } from '../pipeline/news/types';

/** French no-break space before ":", ";", "?" and inside guillemets. */
const NB = ' ';

export interface CountryFaqCopy {
  /** Questions: q1/q2 match long-standing search queries; q3 is the government-advisory question. */
  q1: string;
  q2: string;
  q3: string;
  /** A1 openers by score band (bands.ts getBand), the same bands as ScoreHero and band-copy.ts. */
  a1Verdict: Record<BandKey, string>;
  /** Opener when confidence is below LOW_CONFIDENCE_THRESHOLD: never a confident Yes/No. */
  a1VerdictLowConfidence: string;
  /** Opener when most governments advise reconsidering travel or worse, outside the danger band: {advice}. */
  a1VerdictAdvisories: string;
  /** Danger-band opener when most governments advise against all travel: {advice}. */
  a1VerdictAvoid: string;
  a1Formula: string;
  /** A2 openers by focus frame (pillar-focus.ts); the *Measured variants when an estimated bar is lower. */
  a2: {
    mainRisk: string;
    concern: string;
    weakest: string;
    weakestMeasured: string;
    allGood: string;
    allGoodMeasured: string;
  };
  /** {low} {lowScore} {high} {highScore}: lowest and highest measured pillar (allGood frames). */
  a2Range: string;
  /** The focus pillar's bad-half driver indicator: {topic} {fact}. */
  a2Driver: string;
  /** The next weak direct-risk pillar: {pillar} {pillarScore}. */
  a2Second: string;
  /** allGood frames without an advisory majority at level 3+. */
  a2Precautions: string;
  /** Most governments advise reconsidering travel or worse while the pillars look better (outside the danger band): {advice}/{Advice}. */
  a2AdvisoryNote: string;
  /** Measured governance below the focus, with what it means for a visitor: {score}. */
  a2GovernanceContext: string;
  /** What each pillar concretely means for a traveler. */
  pillarMeaning: Record<PillarName, string>;
  /** Wraps the summary's advisory breakdown sentence with the date: {monthYear} {sentence}. */
  a3AsOf: string;
  /** Exactly one government publishes an advisory: {issuer} {phrase}. */
  a3One: string;
  /** Strictest level above the most common one: one issuer / 2-3 issuers / more (first two named). */
  a3Strictest: { one: string; few: string; many: string };
  /** Mix of level 1 and 2 only. */
  a3NoneAbove2: string;
  /** Scored place where a strict majority advises against all travel. */
  a3Cap: string;
  /** No advisory on record (scored place). */
  a3None: string;
  /** Singular/plural advisory-count noun phrase; {n} is the count (provenance-copy.ts). */
  advisoryCountNoun: { one: string; other: string };
  /**
   * Formula v10 grey place (insufficient_data): A1 without any score, band or pillar figure. Spells
   * the four-source floor out ("four", not "4": validate-seo reads "<n> sources" as a site-wide
   * count). Only en/zh carry {name}; the other locales say "this destination" (article-free).
   */
  a1Grey: string;
  /** a3None for a grey place: no "pillar scores above" to point to. */
  a3NoneGrey: string;
}

/** Pillar labels with proper diacritics (hub pages and the community-vs-data page). */
export const faqPillarLabels: Record<Lang, Record<PillarName, string>> = {
  en: { conflict: 'conflict', crime: 'crime', health: 'health', governance: 'governance', environment: 'natural hazards' },
  it: { conflict: 'conflitto', crime: 'criminalità', health: 'salute', governance: 'governance', environment: 'rischi naturali' },
  es: { conflict: 'conflicto', crime: 'criminalidad', health: 'salud', governance: 'gobernanza', environment: 'riesgos naturales' },
  fr: { conflict: 'conflit', crime: 'criminalité', health: 'santé', governance: 'gouvernance', environment: 'risques naturels' },
  pt: { conflict: 'conflito', crime: 'criminalidade', health: 'saúde', governance: 'governança', environment: 'riscos naturais' },
  zh: { conflict: '冲突', crime: '犯罪', health: '健康', governance: '治理', environment: '自然灾害' },
  de: { conflict: 'Konflikt', crime: 'Kriminalität', health: 'Gesundheit', governance: 'Regierungsführung', environment: 'Naturgefahren' },
};

/** Advisory tier labels (level 1..4), quoted in A3 and on hub pages. */
export const advisoryLevelWords: Record<Lang, [string, string, string, string]> = {
  en: ['exercise normal precautions', 'exercise increased caution', 'reconsider travel', 'do not travel'],
  it: ['osservare le normali precauzioni', 'usare maggiore prudenza', 'riconsiderare il viaggio', 'non viaggiare'],
  es: ['tomar precauciones normales', 'extremar la precaución', 'reconsiderar el viaje', 'no viajar'],
  fr: ['observer les précautions normales', 'redoubler de vigilance', 'reconsidérer le voyage', 'ne pas voyager'],
  pt: ['adotar precauções normais', 'redobrar a cautela', 'reconsiderar a viagem', 'não viajar'],
  zh: ['正常预防', '提高警惕', '重新考虑出行', '切勿前往'],
  de: ['normale Vorsicht walten lassen', 'erhöhte Vorsicht walten lassen', 'Reise überdenken', 'nicht reisen'],
};

/** Connector to join two names (hub pages). */
export const listConnector: Record<Lang, string> = {
  en: ' and ',
  it: ' e ',
  es: ' y ',
  fr: ' et ',
  pt: ' e ',
  zh: '和',
  de: ' und ',
};

export const countryFaqCopy: Record<Lang, CountryFaqCopy> = {
  en: {
    q1: 'Is it safe to travel to {name} in {year}?',
    q2: 'What is the biggest risk when traveling to {name}?',
    q3: 'What do government travel advisories say about {name}?',
    a1Verdict: {
      excellent: 'Yes — {name} is one of the safest destinations on our index: as of {monthYear} it scores {score}/10, classified as {riskLevel}.',
      good: 'Yes, generally — {name} is considered a safe destination: as of {monthYear} it scores {score}/10 on our safety index, classified as {riskLevel}.',
      moderate: 'Yes, with some caution — {name} is reasonably safe for most travelers: as of {monthYear} it scores {score}/10 on our safety index, classified as {riskLevel}.',
      high_caution: 'Only for experienced travelers — {name} carries real risk: as of {monthYear} it scores {score}/10 on our safety index, classified as {riskLevel}. Many trips go fine, but this is not a low-risk destination.',
      danger: 'No — {name} is currently a high-risk destination: as of {monthYear} it scores {score}/10 on our safety index, classified as {riskLevel}, and travel requires serious caution.',
    },
    a1VerdictLowConfidence: 'The data available for {name} is thin, so treat this score with caution: as of {monthYear} it stands at {score}/10, provisionally classified as {riskLevel} based mostly on regional patterns rather than country-specific evidence.',
    a1VerdictAdvisories: 'The score is {score}/10 as of {monthYear}, classified as {riskLevel}, but {advice}: read their warnings below before you decide.',
    a1VerdictAvoid: 'No — {advice}, and as of {monthYear} {name} scores only {score}/10 on our safety index, classified as {riskLevel}. We advise against travel there.',
    a1Formula: 'The score is an uncertainty-weighted (Bayesian shrinkage) geometric mean of five pillars: conflict (30%), crime (25%), health (20%), governance (15%) and natural hazards (10%). A weak pillar drags the overall score down more than a strong one lifts it, and the mix also folds in a calibrated consensus of government travel advisories. Thin or stale data pulls a country’s score toward a cautious regional baseline instead of guessing — see our methodology page for the full statistical detail.',
    a2: {
      mainRisk: 'The main risk for travelers to {name} is {pillar}, at {pillarScore}/10.',
      concern: 'The main concern for travelers to {name} is {pillar}, at {pillarScore}/10.',
      weakest: 'No direct risk stands out for travelers to {name}: conflict, crime, health and natural hazards all score at least 7/10, and the weakest area is governance, at {pillarScore}/10.',
      weakestMeasured: 'Among the areas measured with enough data, none signals a direct risk for travelers to {name}: the weakest is governance, at {pillarScore}/10.',
      allGood: 'No area signals a significant risk for travelers to {name}: all five score at least 7/10.',
      allGoodMeasured: 'No area measured with enough data signals a significant risk for travelers to {name}: they all score at least 7/10.',
    },
    a2Range: 'They range from {low} ({lowScore}/10) to {high} ({highScore}/10).',
    a2Driver: 'The main driver is {topic}: {fact}.',
    a2Second: 'The {pillar} score ({pillarScore}/10) also needs attention.',
    a2Precautions: 'For travelers this means normal, common-sense precautions are enough.',
    a2AdvisoryNote: 'Government advice is stricter, though: {advice}.',
    a2GovernanceContext: 'Governance is rated lower still ({score}/10): it is not a direct danger to visitors, but it means police and courts may offer limited help if something goes wrong.',
    pillarMeaning: {
      conflict: 'This pillar measures armed conflict, terrorism and political violence — a low score means instability can affect personal safety and disrupt travel plans.',
      crime: 'This pillar reflects violent crime, theft and organized criminal activity — a low score calls for extra street awareness, especially outside the main tourist areas.',
      health: 'This pillar covers healthcare quality, disease risk and emergency response capacity — a low score means reliable medical help may be hard to reach outside major cities.',
      governance: 'This pillar gauges the rule of law and the reliability of institutions — a low score means police and courts may offer limited help if something goes wrong.',
      environment: 'This pillar tracks exposure to natural hazards such as storms, floods and earthquakes, and how well the country is prepared to respond to them.',
    },
    a3AsOf: 'As of {monthYear}, {sentence}',
    a3One: 'As of {monthYear}, only one government in our dataset publishes a travel advisory for {name}: {issuer}, which {phrase}.',
    a3Strictest: {
      one: 'The strictest advice, “{level}”, comes from one government: {issuers}.',
      few: 'The strictest advice, “{level}”, comes from {k} governments: {issuers}.',
      many: 'The strictest advice, “{level}”, comes from {k} governments, including {issuers}.',
    },
    a3NoneAbove2: 'No government advises reconsidering travel or avoiding it.',
    a3Cap: 'These warnings weigh heavily in our index: when most governments advise against all travel, the score drops well below what the pillars alone would give.',
    a3None: 'As of {monthYear}, no government in our dataset publishes a travel advisory for {name}. Base your decision on the pillar scores above and check your own government’s latest guidance before you travel.',
    advisoryCountNoun: {
      one: 'one government travel advisory',
      other: '{n} government travel advisories',
    },
    a1Grey: 'We cannot give {name} an official safety score yet: we publish one only when at least four independent sources cover a place, and fewer do here. Read the government advisories below and check your own government’s travel advice before you go.',
    a3NoneGrey: 'As of {monthYear}, no government in our dataset publishes a travel advisory for {name}. Check your own government’s latest guidance before you travel.',
  },
  it: {
    // {nameIn} is the full locative ("in Giappone", "negli Stati Uniti", "alle Maldive",
    // getItalianLocative): the answers never put the bare name after di/su/per or in subject
    // position, where most names would need an article the grammar tables do not carry.
    q1: 'È sicuro viaggiare {nameIn} nel {year}?',
    q2: 'Qual è il rischio maggiore viaggiando {nameIn}?',
    q3: 'Cosa dicono gli avvisi di viaggio dei governi per chi viaggia {nameIn}?',
    a1Verdict: {
      excellent: 'Sì — è una delle destinazioni più sicure del nostro indice: a {monthYear} il punteggio di sicurezza {nameIn} è {score}/10, classificato come {riskLevel}.',
      good: 'Sì, in genere — è una destinazione considerata sicura: a {monthYear} il punteggio di sicurezza {nameIn} è {score}/10, classificato come {riskLevel}.',
      moderate: 'Sì, con qualche cautela — per la maggior parte dei viaggiatori è una destinazione ragionevolmente sicura: a {monthYear} il punteggio di sicurezza {nameIn} è {score}/10, classificato come {riskLevel}.',
      high_caution: 'Solo per viaggiatori esperti — {nameIn} il rischio è concreto: a {monthYear} il punteggio di sicurezza è {score}/10, classificato come {riskLevel}. Molti viaggi si svolgono senza problemi, ma non è una destinazione a basso rischio.',
      danger: 'No — al momento è una destinazione ad alto rischio: a {monthYear} il punteggio di sicurezza {nameIn} è {score}/10, classificato come {riskLevel}, e viaggiare richiede grande prudenza.',
    },
    a1VerdictLowConfidence: 'Per questa destinazione i dati disponibili sono scarsi, quindi considera il punteggio con cautela: a {monthYear} è {score}/10, classificato in via provvisoria come {riskLevel} sulla base soprattutto di andamenti regionali più che di dati specifici del paese.',
    a1VerdictAdvisories: 'A {monthYear} il punteggio di sicurezza {nameIn} è {score}/10, classificato come {riskLevel}, ma {advice}: leggi i loro avvisi qui sotto prima di decidere.',
    a1VerdictAvoid: 'No — {advice}, e a {monthYear} il punteggio di sicurezza {nameIn} è solo {score}/10, classificato come {riskLevel}. Sconsigliamo di partire.',
    a1Formula: "Il punteggio è una media geometrica ponderata, corretta per l'incertezza, di cinque pilastri: conflitto (30%), criminalità (25%), salute (20%), governance (15%) e rischi naturali (10%). Un pilastro debole abbassa il punteggio complessivo più di quanto uno forte riesca ad alzarlo, e il calcolo tiene conto anche di un consenso calibrato degli avvisi di viaggio governativi. Quando i dati sono scarsi o datati, il punteggio si avvicina a un valore di riferimento regionale prudente anziché basarsi su supposizioni: tutti i dettagli statistici sono nella nostra pagina sulla metodologia.",
    a2: {
      mainRisk: "Per chi viaggia {nameIn}, il rischio principale riguarda l'area {pillar}, con {pillarScore}/10.",
      concern: "Per chi viaggia {nameIn}, la principale criticità riguarda l'area {pillar}, con {pillarScore}/10.",
      weakest: "Per chi viaggia {nameIn} non spicca alcun rischio diretto: conflitti, criminalità, salute e rischi naturali ottengono tutti almeno 7/10, e l'area più debole è la governance, con {pillarScore}/10.",
      weakestMeasured: 'Tra le aree misurate con dati sufficienti, nessuna segnala un rischio diretto per chi viaggia {nameIn}: la più debole è la governance, con {pillarScore}/10.',
      allGood: 'Nessuna area segnala un rischio significativo per chi viaggia {nameIn}: tutte e cinque ottengono almeno 7/10.',
      allGoodMeasured: 'Nessuna area misurata con dati sufficienti segnala un rischio significativo per chi viaggia {nameIn}: ottengono tutte almeno 7/10.',
    },
    a2Range: 'Si va da quella {low} ({lowScore}/10) a quella {high} ({highScore}/10).',
    a2Driver: 'Il fattore principale è {topic}: {fact}.',
    a2Second: "Merita attenzione anche l'area {pillar} ({pillarScore}/10).",
    a2Precautions: 'Per chi viaggia questo significa che bastano le normali precauzioni di buon senso.',
    a2AdvisoryNote: 'Gli avvisi dei governi però sono più severi: {advice}.',
    a2GovernanceContext: 'La governance ha un punteggio ancora più basso ({score}/10): non è un pericolo diretto per chi viaggia, ma significa che polizia e tribunali potrebbero aiutare poco se qualcosa va storto.',
    pillarMeaning: {
      conflict: "Questo pilastro misura conflitti armati, terrorismo e violenza politica: un punteggio basso indica che l'instabilità può incidere sulla sicurezza personale e compromettere i piani di viaggio.",
      crime: 'Questo pilastro riflette crimini violenti, furti e criminalità organizzata: un punteggio basso richiede maggiore attenzione per strada, soprattutto fuori dalle principali zone turistiche.',
      health: "Questo pilastro copre la qualità dell'assistenza sanitaria, il rischio di malattie e la capacità di risposta alle emergenze: un punteggio basso indica che fuori dalle grandi città può essere difficile ottenere assistenza medica affidabile.",
      governance: "Questo pilastro valuta lo stato di diritto e l'affidabilità delle istituzioni: un punteggio basso indica che polizia e tribunali potrebbero offrire un aiuto limitato se qualcosa va storto.",
      environment: "Questo pilastro monitora l'esposizione a rischi naturali come tempeste, alluvioni e terremoti, e quanto il paese sia preparato a farvi fronte.",
    },
    a3AsOf: 'A {monthYear}, {sentence}',
    a3One: 'A {monthYear} un solo governo nei nostri dati pubblica avvisi per chi viaggia {nameIn}: {issuer}, che {phrase}.',
    a3Strictest: {
      one: "L'avviso più severo, «{level}», viene da un solo governo: {issuers}.",
      few: "L'avviso più severo, «{level}», viene da {k} governi: {issuers}.",
      many: "L'avviso più severo, «{level}», viene da {k} governi, tra cui {issuers}.",
    },
    a3NoneAbove2: 'Nessun governo invita a riconsiderare il viaggio o lo sconsiglia.',
    a3Cap: 'Questi avvisi pesano molto sul nostro indice: quando la maggior parte dei governi sconsiglia qualsiasi viaggio, il punteggio scende ben al di sotto di quanto indicherebbero i soli pilastri.',
    a3None: 'A {monthYear}, nessun governo nei nostri dati pubblica avvisi per chi viaggia {nameIn}. Basa la tua decisione sui punteggi dei pilastri qui sopra e verifica le indicazioni più recenti del tuo governo prima di partire.',
    advisoryCountNoun: {
      one: 'un avviso di viaggio governativo',
      other: '{n} avvisi di viaggio governativi',
    },
    a1Grey: 'Per questa destinazione non possiamo ancora dare un punteggio di sicurezza ufficiale: lo pubblichiamo solo quando almeno quattro fonti indipendenti coprono un luogo, e qui sono meno. Leggi gli avvisi governativi qui sotto e controlla le indicazioni del tuo governo prima di partire.',
    a3NoneGrey: 'A {monthYear}, nessun governo nei nostri dati pubblica avvisi per chi viaggia {nameIn}. Verifica le indicazioni più recenti del tuo governo prima di partire.',
  },
  es: {
    q1: '¿Es seguro viajar a {name} en {year}?',
    q2: '¿Cuál es el mayor riesgo al viajar a {name}?',
    q3: '¿Qué dicen los avisos de viaje gubernamentales sobre {name}?',
    a1Verdict: {
      excellent: 'Sí — {name} es uno de los destinos más seguros de nuestro índice: a fecha de {monthYear} obtiene {score}/10, clasificado como {riskLevel}.',
      good: 'Sí, en general — {name} se considera un destino seguro: a fecha de {monthYear} obtiene {score}/10 en nuestro índice de seguridad, clasificado como {riskLevel}.',
      moderate: 'Sí, con cierta precaución — {name} es un destino razonablemente seguro para la mayoría de los viajeros: a fecha de {monthYear} obtiene {score}/10 en nuestro índice de seguridad, clasificado como {riskLevel}.',
      high_caution: 'Solo para viajeros expertos — {name} presenta un riesgo considerable: a fecha de {monthYear} obtiene {score}/10 en nuestro índice de seguridad, clasificado como {riskLevel}. Muchos viajes transcurren sin problemas, pero no es un destino de bajo riesgo.',
      danger: 'No — {name} es actualmente un destino de alto riesgo: a fecha de {monthYear} obtiene {score}/10 en nuestro índice de seguridad, clasificado como {riskLevel}, y viajar allí exige extremar las precauciones.',
    },
    a1VerdictLowConfidence: 'Los datos disponibles para {name} son escasos, así que considera esta puntuación con cautela: a fecha de {monthYear} se sitúa en {score}/10, clasificada de forma provisional como {riskLevel}, basada sobre todo en patrones regionales y no en datos específicos del país.',
    a1VerdictAdvisories: 'A fecha de {monthYear}, {name} obtiene {score}/10, clasificado como {riskLevel}, pero {advice}: lee sus avisos más abajo antes de decidir.',
    a1VerdictAvoid: 'No — {advice}, y a fecha de {monthYear} {name} obtiene solo {score}/10 en nuestro índice de seguridad, clasificado como {riskLevel}. Desaconsejamos viajar allí.',
    a1Formula: 'La puntuación es una media geométrica ponderada, con corrección por incertidumbre, de cinco pilares: conflictos (30%), criminalidad (25%), salud (20%), gobernanza (15%) y riesgos naturales (10%). Un pilar débil lastra la puntuación global más de lo que un pilar fuerte la eleva, y la combinación incluye también un consenso calibrado de los avisos de viaje gubernamentales. Cuando los datos son escasos o antiguos, la puntuación de un país se acerca a un valor de referencia regional prudente en lugar de adivinar — consulta nuestra página de metodología para todos los detalles estadísticos.',
    a2: {
      mainRisk: 'Para quien viaja a {name}, el principal riesgo está en el área de {pillar}, con {pillarScore}/10.',
      concern: 'Para quien viaja a {name}, la principal preocupación está en el área de {pillar}, con {pillarScore}/10.',
      weakest: 'Para quien viaja a {name} no destaca ningún riesgo directo: conflictos, criminalidad, salud y riesgos naturales obtienen al menos 7/10, y el área más débil es la gobernanza, con {pillarScore}/10.',
      weakestMeasured: 'Entre las áreas medidas con datos suficientes, ninguna indica un riesgo directo para quien viaja a {name}: la más débil es la gobernanza, con {pillarScore}/10.',
      allGood: 'Ningún área indica un riesgo significativo para quien viaja a {name}: las cinco obtienen al menos 7/10.',
      allGoodMeasured: 'Ningún área medida con datos suficientes indica un riesgo significativo para quien viaja a {name}: todas obtienen al menos 7/10.',
    },
    a2Range: 'Van desde la de {low} ({lowScore}/10) hasta la de {high} ({highScore}/10).',
    a2Driver: 'El factor principal es {topic}: {fact}.',
    a2Second: 'También merece atención el área de {pillar} ({pillarScore}/10).',
    a2Precautions: 'Para quien viaja, esto significa que bastan las precauciones normales de sentido común.',
    a2AdvisoryNote: 'Sin embargo, los avisos de los gobiernos son más estrictos: {advice}.',
    a2GovernanceContext: 'La gobernanza puntúa todavía más bajo ({score}/10): no es un peligro directo para el viajero, pero significa que la policía y los tribunales pueden ayudar poco si algo sale mal.',
    pillarMeaning: {
      conflict: 'Este pilar mide los conflictos armados, el terrorismo y la violencia política — una puntuación baja significa que la inestabilidad puede afectar a la seguridad personal y trastocar los planes de viaje.',
      crime: 'Este pilar refleja los delitos violentos, los robos y la actividad criminal organizada — una puntuación baja exige mayor atención en la calle, sobre todo fuera de las principales zonas turísticas.',
      health: 'Este pilar abarca la calidad de la asistencia sanitaria, el riesgo de enfermedades y la capacidad de respuesta ante emergencias — una puntuación baja significa que puede ser difícil acceder a ayuda médica fiable fuera de las grandes ciudades.',
      governance: 'Este pilar evalúa el estado de derecho y la fiabilidad de las instituciones — una puntuación baja significa que la policía y los tribunales pueden ofrecer una ayuda limitada si algo sale mal.',
      environment: 'Este pilar registra la exposición a riesgos naturales como tormentas, inundaciones y terremotos, así como el grado de preparación del país para responder a ellos.',
    },
    a3AsOf: 'A fecha de {monthYear}, {sentence}',
    a3One: 'A fecha de {monthYear}, solo un gobierno de nuestros datos publica avisos para quien viaja a {name}: {issuer}, que {phrase}.',
    a3Strictest: {
      one: 'La advertencia más severa, «{level}», procede de un solo gobierno: {issuers}.',
      few: 'La advertencia más severa, «{level}», procede de {k} gobiernos: {issuers}.',
      many: 'La advertencia más severa, «{level}», procede de {k} gobiernos, entre ellos {issuers}.',
    },
    a3NoneAbove2: 'Ningún gobierno aconseja reconsiderar el viaje ni lo desaconseja.',
    a3Cap: 'Estas advertencias pesan mucho en nuestro índice: cuando la mayoría de los gobiernos desaconseja todo viaje, la puntuación baja bastante más de lo que indicarían los pilares por sí solos.',
    a3None: 'A fecha de {monthYear}, ningún gobierno de nuestros datos publica avisos para quien viaja a {name}. Basa tu decisión en las puntuaciones de los pilares de arriba y consulta las indicaciones más recientes de tu propio gobierno antes de viajar.',
    advisoryCountNoun: {
      one: 'un aviso de viaje gubernamental',
      other: '{n} avisos de viaje gubernamentales',
    },
    a1Grey: 'Todavía no podemos dar una puntuación de seguridad oficial para este destino: solo la publicamos cuando al menos cuatro fuentes independientes cubren un lugar, y aquí son menos. Lee los avisos gubernamentales más abajo y consulta las recomendaciones de tu gobierno antes de viajar.',
    a3NoneGrey: 'A fecha de {monthYear}, ningún gobierno de nuestros datos publica avisos para quien viaja a {name}. Consulta las indicaciones más recientes de tu propio gobierno antes de viajar.',
  },
  fr: {
    // {namePrep} is the full au/en/aux/à phrase (getFrenchPreposition): the answers never put the
    // bare name after "de"/"pour" or in subject position, where French needs its article.
    q1: `{name}${NB}: est-ce sûr d’y voyager en {year}${NB}?`,
    q2: `{name}${NB}: quel est le plus grand risque pour les voyageurs${NB}?`,
    q3: `Que disent les avis officiels aux voyageurs se rendant {namePrep}${NB}?`,
    a1Verdict: {
      excellent: `Oui — c’est l’une des destinations les plus sûres de notre indice${NB}: en {monthYear}, le score de sécurité {namePrep} est de {score}/10, dans la catégorie «${NB}{riskLevel}${NB}».`,
      good: `Oui, en général — c’est une destination considérée comme sûre${NB}: en {monthYear}, le score de sécurité {namePrep} est de {score}/10 sur notre indice, dans la catégorie «${NB}{riskLevel}${NB}».`,
      moderate: `Oui, avec quelques précautions — pour la plupart des voyageurs, c’est une destination raisonnablement sûre${NB}: en {monthYear}, le score de sécurité {namePrep} est de {score}/10 sur notre indice, dans la catégorie «${NB}{riskLevel}${NB}».`,
      high_caution: `Uniquement pour des voyageurs expérimentés — le risque y est réel${NB}: en {monthYear}, le score de sécurité {namePrep} est de {score}/10 sur notre indice, dans la catégorie «${NB}{riskLevel}${NB}». La plupart des voyages se passent bien, mais ce n’est pas une destination à faible risque.`,
      danger: `Non — c’est actuellement une destination à haut risque${NB}: en {monthYear}, le score de sécurité {namePrep} est de {score}/10 sur notre indice, dans la catégorie «${NB}{riskLevel}${NB}», et tout voyage exige une grande prudence.`,
    },
    a1VerdictLowConfidence: `Les données disponibles sur cette destination sont limitées, considérez donc ce score avec prudence${NB}: en {monthYear}, il s’établit à {score}/10, classé à titre provisoire dans la catégorie «${NB}{riskLevel}${NB}», surtout d’après des tendances régionales plutôt que des données propres au pays.`,
    a1VerdictAdvisories: `En {monthYear}, le score de sécurité {namePrep} est de {score}/10, dans la catégorie «${NB}{riskLevel}${NB}», mais {advice}${NB}: lisez leurs avis ci-dessous avant de décider.`,
    a1VerdictAvoid: `Non — {advice}, et en {monthYear} le score de sécurité {namePrep} n’est que de {score}/10, dans la catégorie «${NB}{riskLevel}${NB}». Nous déconseillons de s’y rendre.`,
    a1Formula: `Le score est une moyenne géométrique pondérée, corrigée de l’incertitude, de cinq piliers${NB}: conflits (30${NB}%), criminalité (25${NB}%), santé (20${NB}%), gouvernance (15${NB}%) et risques naturels (10${NB}%). Un pilier faible tire le score global vers le bas plus qu’un pilier fort ne le relève, et la combinaison intègre aussi un consensus calibré des avis de voyage gouvernementaux. Lorsque les données sont rares ou anciennes, le score d’un pays se rapproche d’une référence régionale prudente au lieu de reposer sur des suppositions — consultez notre page de méthodologie pour le détail statistique complet.`,
    a2: {
      mainRisk: 'Pour un voyage {namePrep}, le principal risque concerne le domaine {pillar}, à {pillarScore}/10.',
      concern: 'Pour un voyage {namePrep}, le principal point de vigilance concerne le domaine {pillar}, à {pillarScore}/10.',
      weakest: `Pour un voyage {namePrep}, aucun risque direct ne ressort${NB}: conflits, criminalité, santé et risques naturels obtiennent tous au moins 7/10, et le domaine le plus faible est la gouvernance, à {pillarScore}/10.`,
      weakestMeasured: `Parmi les domaines mesurés avec suffisamment de données, aucun ne signale de risque direct pour un voyage {namePrep}${NB}: le plus faible est la gouvernance, à {pillarScore}/10.`,
      allGood: `Aucun domaine ne signale de risque significatif pour un voyage {namePrep}${NB}: les cinq obtiennent au moins 7/10.`,
      allGoodMeasured: `Aucun domaine mesuré avec suffisamment de données ne signale de risque significatif pour un voyage {namePrep}${NB}: tous obtiennent au moins 7/10.`,
    },
    a2Range: 'Ils vont de celui {low} ({lowScore}/10) à celui {high} ({highScore}/10).',
    a2Driver: `Le facteur principal est {topic}${NB}: {fact}.`,
    a2Second: 'Le domaine {pillar} ({pillarScore}/10) mérite lui aussi de l’attention.',
    a2Precautions: 'Pour les voyageurs, cela signifie que les précautions de bon sens habituelles suffisent.',
    a2AdvisoryNote: `Les avis officiels sont toutefois plus sévères${NB}: {advice}.`,
    a2GovernanceContext: `La gouvernance obtient un score encore plus bas ({score}/10)${NB}: ce n’est pas un danger direct pour les voyageurs, mais la police et la justice risquent de n’être que d’un faible secours en cas de problème.`,
    pillarMeaning: {
      conflict: 'Ce pilier mesure les conflits armés, le terrorisme et la violence politique — un score bas signifie que l’instabilité peut affecter la sécurité personnelle et perturber les projets de voyage.',
      crime: 'Ce pilier reflète les crimes violents, les vols et la criminalité organisée — un score bas appelle une vigilance accrue dans la rue, surtout en dehors des principales zones touristiques.',
      health: 'Ce pilier couvre la qualité des soins, le risque de maladies et la capacité de réponse aux urgences — un score bas signifie qu’une aide médicale fiable peut être difficile à trouver en dehors des grandes villes.',
      governance: 'Ce pilier évalue l’état de droit et la fiabilité des institutions — un score bas signifie que la police et la justice peuvent n’offrir qu’une aide limitée en cas de problème.',
      environment: 'Ce pilier suit l’exposition aux risques naturels tels que tempêtes, inondations et séismes, ainsi que le niveau de préparation du pays pour y faire face.',
    },
    a3AsOf: 'En {monthYear}, {sentence}',
    a3One: `En {monthYear}, un seul gouvernement de nos données publie des conseils aux voyageurs se rendant {namePrep}${NB}: {issuer}, qui {phrase}.`,
    a3Strictest: {
      one: `L’avertissement le plus sévère, «${NB}{level}${NB}», émane d’un seul gouvernement${NB}: {issuers}.`,
      few: `L’avertissement le plus sévère, «${NB}{level}${NB}», émane de {k} gouvernements${NB}: {issuers}.`,
      many: `L’avertissement le plus sévère, «${NB}{level}${NB}», émane de {k} gouvernements, dont {issuers}.`,
    },
    a3NoneAbove2: 'Aucun gouvernement ne déconseille de s’y rendre.',
    a3Cap: `Ces avertissements pèsent lourd dans notre indice${NB}: lorsque la plupart des gouvernements déconseillent tout voyage, le score descend nettement plus bas que ne le placeraient les seuls piliers.`,
    a3None: 'En {monthYear}, aucun gouvernement de nos données ne publie de conseils aux voyageurs se rendant {namePrep}. Fondez votre décision sur les scores des piliers ci-dessus et vérifiez les dernières recommandations de votre propre gouvernement avant de partir.',
    advisoryCountNoun: {
      one: 'un avis aux voyageurs officiel',
      other: '{n} avis aux voyageurs officiels',
    },
    a1Grey: `Nous ne pouvons pas encore attribuer de score de sécurité officiel à cette destination${NB}: nous n’en publions un que si au moins quatre sources indépendantes couvrent un lieu, et elles sont moins nombreuses ici. Consultez les avis gouvernementaux ci-dessous et les conseils de votre propre gouvernement avant de partir.`,
    a3NoneGrey: 'En {monthYear}, aucun gouvernement de nos données ne publie de conseils aux voyageurs se rendant {namePrep}. Vérifiez les dernières recommandations de votre propre gouvernement avant de partir.',
  },
  pt: {
    // {nameDe} ("do Japão", "dos Estados Unidos"), {nameA} ("ao Japão"), {nameArt} ("o Japão"),
    // {namePara} ("para o Japão") come from country-grammar.ts: the answers never put the bare name
    // in subject position (plural names would need "são") or after "de" (I40).
    q1: 'É seguro viajar {namePara} em {year}?',
    q2: 'Qual é o maior risco ao viajar {namePara}?',
    q3: 'O que dizem os avisos de viagem governamentais sobre {nameArt}?',
    a1Verdict: {
      excellent: 'Sim — é um dos destinos mais seguros do nosso índice: em {monthYear}, a pontuação de segurança {nameDe} é de {score}/10, com classificação de {riskLevel}.',
      good: 'Sim, em geral — é um destino considerado seguro: em {monthYear}, a pontuação de segurança {nameDe} é de {score}/10 no nosso índice, com classificação de {riskLevel}.',
      moderate: 'Sim, com alguma cautela — para a maioria dos viajantes é um destino razoavelmente seguro: em {monthYear}, a pontuação de segurança {nameDe} é de {score}/10 no nosso índice, com classificação de {riskLevel}.',
      high_caution: 'Apenas para viajantes experientes — o risco é real: em {monthYear}, a pontuação de segurança {nameDe} é de {score}/10 no nosso índice, com classificação de {riskLevel}. Muitas viagens correm bem, mas não é um destino de baixo risco.',
      danger: 'Não — atualmente é um destino de alto risco: em {monthYear}, a pontuação de segurança {nameDe} é de {score}/10 no nosso índice, com classificação de {riskLevel}, e viajar exige muita cautela.',
    },
    a1VerdictLowConfidence: 'Os dados disponíveis sobre este destino são escassos, portanto considere esta pontuação com cautela: em {monthYear}, ela está em {score}/10, classificada de forma provisória como {riskLevel}, com base principalmente em padrões regionais e não em dados específicos do país.',
    a1VerdictAdvisories: 'Em {monthYear}, a pontuação de segurança {nameDe} é de {score}/10, com classificação de {riskLevel}, mas {advice}: leia os alertas abaixo antes de decidir.',
    a1VerdictAvoid: 'Não — {advice}, e em {monthYear} a pontuação de segurança {nameDe} é de apenas {score}/10, com classificação de {riskLevel}. Desaconselhamos a viagem.',
    a1Formula: 'A pontuação é uma média geométrica ponderada, com correção de incerteza, de cinco pilares: conflitos (30%), criminalidade (25%), saúde (20%), governança (15%) e riscos naturais (10%). Um pilar fraco puxa a pontuação geral para baixo mais do que um pilar forte a eleva, e a combinação também inclui um consenso calibrado dos avisos de viagem governamentais. Quando os dados são escassos ou desatualizados, a pontuação de um país se aproxima de um valor de referência regional prudente em vez de se basear em suposições — consulte nossa página de metodologia para todos os detalhes estatísticos.',
    a2: {
      mainRisk: 'Para quem viaja {nameA}, o principal risco está na área {pillar}, com {pillarScore}/10.',
      concern: 'Para quem viaja {nameA}, a principal preocupação está na área {pillar}, com {pillarScore}/10.',
      weakest: 'Para quem viaja {nameA}, nenhum risco direto se destaca: conflitos, criminalidade, saúde e riscos naturais têm pelo menos 7/10, e a área mais fraca é a governança, com {pillarScore}/10.',
      weakestMeasured: 'Entre as áreas medidas com dados suficientes, nenhuma indica um risco direto para quem viaja {nameA}: a mais fraca é a governança, com {pillarScore}/10.',
      allGood: 'Nenhuma área indica um risco significativo para quem viaja {nameA}: as cinco têm pelo menos 7/10.',
      allGoodMeasured: 'Nenhuma área medida com dados suficientes indica um risco significativo para quem viaja {nameA}: todas têm pelo menos 7/10.',
    },
    a2Range: 'Vão da área {low} ({lowScore}/10) à área {high} ({highScore}/10).',
    a2Driver: 'O fator principal é {topic}: {fact}.',
    a2Second: 'A área {pillar} ({pillarScore}/10) também merece atenção.',
    a2Precautions: 'Para quem viaja, isso significa que as precauções normais de bom senso são suficientes.',
    a2AdvisoryNote: 'Os alertas dos governos, porém, são mais rigorosos: {advice}.',
    a2GovernanceContext: 'A governança tem pontuação ainda mais baixa ({score}/10): não é um perigo direto para quem viaja, mas significa que a polícia e a justiça podem ajudar pouco se algo der errado.',
    pillarMeaning: {
      conflict: 'Esse pilar mede conflitos armados, terrorismo e violência política — uma pontuação baixa significa que a instabilidade pode afetar a segurança pessoal e atrapalhar os planos de viagem.',
      crime: 'Esse pilar reflete crimes violentos, furtos e atividade do crime organizado — uma pontuação baixa exige atenção redobrada nas ruas, especialmente fora das principais áreas turísticas.',
      health: 'Esse pilar abrange a qualidade dos serviços de saúde, o risco de doenças e a capacidade de resposta a emergências — uma pontuação baixa significa que pode ser difícil encontrar atendimento médico confiável fora das grandes cidades.',
      governance: 'Esse pilar avalia o estado de direito e a confiabilidade das instituições — uma pontuação baixa significa que a polícia e a justiça podem oferecer ajuda limitada se algo der errado.',
      environment: 'Esse pilar acompanha a exposição a riscos naturais como tempestades, enchentes e terremotos, além do grau de preparo do país para responder a eles.',
    },
    a3AsOf: 'Em {monthYear}, {sentence}',
    a3One: 'Em {monthYear}, só um governo em nossos dados publica alertas para quem viaja {nameA}: {issuer}, que {phrase}.',
    a3Strictest: {
      one: 'O alerta mais severo, “{level}”, vem de um único governo: {issuers}.',
      few: 'O alerta mais severo, “{level}”, vem de {k} governos: {issuers}.',
      many: 'O alerta mais severo, “{level}”, vem de {k} governos, entre eles {issuers}.',
    },
    a3NoneAbove2: 'Nenhum governo recomenda reconsiderar a viagem nem a desaconselha.',
    a3Cap: 'Esses alertas pesam muito no nosso índice: quando a maioria dos governos desaconselha qualquer viagem, a pontuação cai bem abaixo do que os pilares indicariam por si sós.',
    a3None: 'Em {monthYear}, nenhum governo em nossos dados publica alertas para quem viaja {nameA}. Baseie sua decisão nas pontuações dos pilares acima e verifique as orientações mais recentes do seu próprio governo antes de viajar.',
    advisoryCountNoun: {
      one: 'um aviso de viagem governamental',
      other: '{n} avisos de viagem governamentais',
    },
    a1Grey: 'Ainda não podemos dar uma pontuação de segurança oficial para este destino: só a publicamos quando pelo menos quatro fontes independentes cobrem um lugar, e aqui são menos. Leia os alertas governamentais abaixo e consulte as orientações do seu governo antes de viajar.',
    a3NoneGrey: 'Em {monthYear}, nenhum governo em nossos dados publica alertas para quem viaja {nameA}. Verifique as orientações mais recentes do seu próprio governo antes de viajar.',
  },
  zh: {
    // No spaces around {name} or between a number and 年 (the summary writes 2026年 too: I60).
    q1: '{year}年前往{name}旅行安全吗？',
    q2: '前往{name}旅行的最大风险是什么？',
    q3: '各国政府的旅行警告对{name}有何评价？',
    a1Verdict: {
      excellent: '是的——{name}是我们指数中最安全的目的地之一：截至{monthYear}，其得分为{score}/10（{riskLevel}）。',
      good: '总体而言是的——{name}被认为是安全的旅行目的地：截至{monthYear}，其在我们的安全指数中得分为{score}/10（{riskLevel}）。',
      moderate: '可以，但需留意——对大多数旅行者而言，{name}相对安全：截至{monthYear}，其在我们的安全指数中得分为{score}/10（{riskLevel}）。',
      high_caution: '仅建议经验丰富的旅行者前往——{name}存在不容忽视的风险：截至{monthYear}，其在我们的安全指数中得分为{score}/10（{riskLevel}）。多数行程能够顺利完成，但这并非低风险目的地。',
      danger: '不安全——{name}目前属于高风险目的地：截至{monthYear}，其在我们的安全指数中得分为{score}/10（{riskLevel}），前往旅行需要格外谨慎。',
    },
    a1VerdictLowConfidence: '{name}的可用数据非常有限，请谨慎看待此评分：截至{monthYear}，其得分为{score}/10，暂定为{riskLevel}，主要依据区域规律，而非该国自身的具体证据。',
    a1VerdictAdvisories: '截至{monthYear}，{name}的安全评分为{score}/10（{riskLevel}），但{advice}，请在决定前阅读下方的政府旅行警告。',
    a1VerdictAvoid: '不安全——{advice}；截至{monthYear}，{name}在我们的安全指数中仅得{score}/10（{riskLevel}）。我们建议不要前往。',
    a1Formula: '该评分是五大支柱——冲突（30%）、犯罪（25%）、健康（20%）、治理（15%）和自然灾害（10%）——经不确定性加权（贝叶斯收缩）计算得出的几何平均数。薄弱支柱对总分的拉低作用大于强势支柱的提升作用，评分还结合了经校准的政府旅行警告共识。数据稀疏或陈旧时，评分会向审慎的区域基准靠拢，而不是凭空估计——完整的统计细节请参见我们的方法论页面。',
    a2: {
      mainRisk: '前往{name}旅行，主要风险在于{pillar}方面（{pillarScore}/10）。',
      concern: '前往{name}旅行，最需关注的是{pillar}方面（{pillarScore}/10）。',
      weakest: '前往{name}旅行，没有突出的直接风险：冲突、犯罪、健康和自然灾害的得分均不低于7/10，最薄弱的是治理（{pillarScore}/10）。',
      weakestMeasured: '在数据充足的各个方面中，没有哪一项对前往{name}的旅行者构成直接风险：最薄弱的是治理（{pillarScore}/10）。',
      allGood: '前往{name}旅行，各个方面均未显示明显风险：五个方面的得分均不低于7/10。',
      allGoodMeasured: '在数据充足的各个方面中，没有哪一项对前往{name}的旅行者显示明显风险：其得分均不低于7/10。',
    },
    a2Range: '得分从{low}方面的{lowScore}/10到{high}方面的{highScore}/10不等。',
    a2Driver: '主要原因是{topic}：{fact}。',
    a2Second: '{pillar}方面（{pillarScore}/10）同样值得留意。',
    a2Precautions: '对旅行者而言，这意味着只需采取常规的常识性预防措施即可。',
    a2AdvisoryNote: '不过，各国政府的旅行建议更为严格：{advice}。',
    a2GovernanceContext: '治理得分更低（{score}/10）：这对旅行者并非直接危险，但意味着一旦出现问题，警方和法院能提供的帮助可能有限。',
    pillarMeaning: {
      conflict: '该支柱衡量武装冲突、恐怖主义和政治暴力——得分较低意味着局势不稳可能危及人身安全并打乱旅行计划。',
      crime: '该支柱反映暴力犯罪、盗窃和有组织犯罪活动——得分较低意味着需要在街头提高警惕，尤其是在主要旅游区之外。',
      health: '该支柱涵盖医疗服务质量、疾病风险和应急响应能力——得分较低意味着在大城市之外可能难以获得可靠的医疗救助。',
      governance: '该支柱评估法治水平和公共机构的可靠程度——得分较低意味着一旦出现问题，警方和法院可能只能提供有限的帮助。',
      environment: '该支柱追踪该国面临风暴、洪水和地震等自然灾害的风险程度，以及其应对这些灾害的准备水平。',
    },
    a3AsOf: '截至{monthYear}，{sentence}',
    a3One: '截至{monthYear}，我们的数据中只有{issuer}政府为{name}发布了旅行警告，{phrase}。',
    a3Strictest: {
      one: '最严格的建议（“{level}”）仅来自{issuers}政府。',
      few: '最严格的建议（“{level}”）来自{k}国政府：{issuers}。',
      many: '最严格的建议（“{level}”）来自{k}国政府，包括{issuers}。',
    },
    a3NoneAbove2: '没有任何国家政府建议重新考虑出行或切勿前往。',
    a3Cap: '这些警告在我们的指数中权重很高：当多数政府建议切勿前往时，总分会被明显拉低，低于仅凭各支柱得出的水平。',
    a3None: '截至{monthYear}，我们的数据中没有任何国家政府为{name}发布旅行警告。请参考上方各支柱的得分，并在出行前查阅您所在国家政府的最新指引。',
    advisoryCountNoun: {
      one: '1条政府旅行警告',
      other: '{n}条政府旅行警告',
    },
    a1Grey: '我们目前还无法为{name}给出官方安全评分：只有当至少四个独立来源覆盖某地时，我们才会发布评分，而这里的来源不足四个。请阅读下方的政府旅行警告，并在出行前查看本国政府的旅行建议。',
    a3NoneGrey: '截至{monthYear}，我们的数据中没有任何国家政府为{name}发布旅行警告。请在出行前查阅您所在国家政府的最新指引。',
  },
  de: {
    // {nameNom} ("der Iran", "die Philippinen"), {nameDir} ("in den Iran"), {nameFuer} ("für den
    // Iran") and {nameUeber} ("über den Iran") carry the article and case German needs (I48); the
    // verb slots {deZaehlt}/{deGilt} agree with plural names ("die Niederlande zählen").
    q1: 'Ist es {year} sicher, {nameDir} zu reisen?',
    q2: 'Was ist das größte Risiko bei einer Reise {nameDir}?',
    q3: 'Was sagen staatliche Reisehinweise {nameUeber}?',
    a1Verdict: {
      excellent: 'Ja — {nameNom} {deZaehlt} zu den sichersten Reisezielen in unserem Index: Stand {monthYear} erreicht das Land {score}/10 (Einstufung: {riskLevel}).',
      good: 'Ja, im Allgemeinen — {nameNom} {deGilt} als sicheres Reiseziel: Stand {monthYear} erreicht das Land {score}/10 auf unserem Sicherheitsindex (Einstufung: {riskLevel}).',
      moderate: 'Ja, mit etwas Vorsicht — für die meisten Reisenden ist das Land ausreichend sicher: Stand {monthYear} erreicht es {score}/10 auf unserem Sicherheitsindex (Einstufung: {riskLevel}).',
      high_caution: 'Nur für erfahrene Reisende — das Risiko ist spürbar: Stand {monthYear} erreicht das Land {score}/10 auf unserem Sicherheitsindex (Einstufung: {riskLevel}). Die meisten Reisen verlaufen gut, doch dies ist kein risikoarmes Reiseziel.',
      danger: 'Nein — {nameNom} {deZaehlt} derzeit zu den Hochrisiko-Reisezielen: Stand {monthYear} erreicht das Land {score}/10 auf unserem Sicherheitsindex (Einstufung: {riskLevel}), und Reisen dorthin erfordern erhebliche Vorsicht.',
    },
    a1VerdictLowConfidence: '{nameFuer} liegen nur wenige Daten vor; betrachten Sie diese Bewertung daher mit Vorsicht: Stand {monthYear} liegt sie bei {score}/10 (vorläufige Einstufung: {riskLevel}), vor allem auf Basis regionaler Muster statt länderspezifischer Belege.',
    a1VerdictAdvisories: 'Stand {monthYear} liegt der Wert bei {score}/10 (Einstufung: {riskLevel}), aber {advice}: Lesen Sie ihre Hinweise weiter unten, bevor Sie entscheiden.',
    a1VerdictAvoid: 'Nein — {advice}, und Stand {monthYear} erreicht das Land auf unserem Sicherheitsindex nur {score}/10 (Einstufung: {riskLevel}). Wir raten von Reisen {nameDir} ab.',
    a1Formula: 'Der Wert ist ein unsicherheitsgewichtetes geometrisches Mittel aus fünf Säulen: Konflikt (30 %), Kriminalität (25 %), Gesundheit (20 %), Regierungsführung (15 %) und Naturgefahren (10 %). Eine schwache Säule zieht den Gesamtwert stärker nach unten, als eine starke ihn anhebt, und die Berechnung bezieht zudem einen kalibrierten Konsens staatlicher Reisehinweise mit ein. Sind die Daten spärlich oder veraltet, nähert sich der Wert eines Landes einem vorsichtigen regionalen Richtwert an, statt zu raten — die vollständigen statistischen Details finden Sie auf unserer Methodik-Seite.',
    a2: {
      mainRisk: 'Bei einer Reise {nameDir} liegt das größte Risiko im Bereich {pillar} ({pillarScore}/10).',
      concern: 'Bei einer Reise {nameDir} verdient der Bereich {pillar} die meiste Aufmerksamkeit ({pillarScore}/10).',
      weakest: 'Bei einer Reise {nameDir} sticht kein direktes Risiko hervor: Konflikt, Kriminalität, Gesundheit und Naturgefahren erreichen jeweils mindestens 7/10; am schwächsten ist die Regierungsführung mit {pillarScore}/10.',
      weakestMeasured: 'Unter den Bereichen mit ausreichender Datenlage zeigt keiner ein direktes Risiko für eine Reise {nameDir}: Am schwächsten ist die Regierungsführung mit {pillarScore}/10.',
      allGood: 'Kein Bereich zeigt ein nennenswertes Risiko für eine Reise {nameDir}: Alle fünf erreichen mindestens 7/10.',
      allGoodMeasured: 'Kein Bereich mit ausreichender Datenlage zeigt ein nennenswertes Risiko für eine Reise {nameDir}: Alle erreichen mindestens 7/10.',
    },
    a2Range: 'Die Spanne reicht vom Bereich {low} ({lowScore}/10) bis zum Bereich {high} ({highScore}/10).',
    a2Driver: 'Ausschlaggebend ist vor allem {topic}: {fact}.',
    a2Second: 'Auch der Bereich {pillar} ({pillarScore}/10) verdient Aufmerksamkeit.',
    a2Precautions: 'Für Reisende bedeutet das: Normale, vernünftige Vorsichtsmaßnahmen genügen.',
    a2AdvisoryNote: 'Die staatlichen Reisehinweise sind allerdings strenger: {Advice}.',
    a2GovernanceContext: 'Die Regierungsführung schneidet noch schlechter ab ({score}/10): Sie ist keine direkte Gefahr für Reisende, bedeutet aber, dass Polizei und Gerichte im Ernstfall nur begrenzt helfen können.',
    pillarMeaning: {
      conflict: 'Diese Säule misst bewaffnete Konflikte, Terrorismus und politische Gewalt — ein niedriger Wert bedeutet, dass Instabilität die persönliche Sicherheit beeinträchtigen und Reisepläne durchkreuzen kann.',
      crime: 'Diese Säule bildet Gewaltkriminalität, Diebstahl und organisierte Kriminalität ab — ein niedriger Wert verlangt erhöhte Wachsamkeit unterwegs, besonders außerhalb der wichtigsten Touristengebiete.',
      health: 'Diese Säule umfasst die Qualität der Gesundheitsversorgung, Krankheitsrisiken und die Kapazitäten der Notfallhilfe — ein niedriger Wert bedeutet, dass verlässliche medizinische Hilfe außerhalb der großen Städte schwer zu erreichen sein kann.',
      governance: 'Diese Säule bewertet die Rechtsstaatlichkeit und die Verlässlichkeit der Institutionen — ein niedriger Wert bedeutet, dass Polizei und Gerichte nur begrenzt helfen können, wenn etwas schiefgeht.',
      environment: 'Diese Säule erfasst die Exposition gegenüber Naturgefahren wie Stürmen, Überschwemmungen und Erdbeben — und wie gut das Land auf solche Ereignisse vorbereitet ist.',
    },
    // The summary's breakdown sentence starts with the count ("20 Regierungen veröffentlichen…"),
    // so the date goes after it instead of forcing an inversion.
    a3AsOf: '{sentence} (Stand: {monthYear}).',
    a3One: 'Stand {monthYear} veröffentlicht nur eine Regierung in unseren Daten Reisehinweise {nameFuer}: {issuer}; sie {phrase}.',
    a3Strictest: {
      // Issuers stand in apposition to the nominative subject ("… sprechen 8 Regierungen aus,
      // darunter die Vereinigten Staaten"), never after the dative "von" (I19).
      one: 'Die strengste Stufe, „{level}“, spricht nur eine Regierung aus: {issuers}.',
      few: 'Die strengste Stufe, „{level}“, sprechen {k} Regierungen aus: {issuers}.',
      many: 'Die strengste Stufe, „{level}“, sprechen {k} Regierungen aus, darunter {issuers}.',
    },
    a3NoneAbove2: 'Keine Regierung rät, die Reise zu überdenken oder ganz darauf zu verzichten.',
    a3Cap: 'Diese Warnungen fallen in unserem Index stark ins Gewicht: Raten die meisten Regierungen von allen Reisen ab, sinkt der Wert deutlich unter das Niveau, das die Säulen allein ergäben.',
    a3None: 'Stand {monthYear} veröffentlicht keine Regierung in unseren Daten Reisehinweise {nameFuer}. Stützen Sie Ihre Entscheidung auf die Säulenwerte oben und prüfen Sie vor der Reise die aktuellen Hinweise Ihrer eigenen Regierung.',
    advisoryCountNoun: {
      one: 'einen staatlichen Reisehinweis',
      other: '{n} staatliche Reisehinweise',
    },
    a1Grey: 'Für dieses Reiseziel können wir noch keine offizielle Sicherheitsbewertung angeben: Wir veröffentlichen eine nur, wenn mindestens vier unabhängige Quellen einen Ort abdecken, und hier sind es weniger. Lesen Sie die staatlichen Reisehinweise weiter unten und prüfen Sie vor der Reise die Hinweise Ihrer eigenen Regierung.',
    a3NoneGrey: 'Stand {monthYear} veröffentlicht keine Regierung in unseren Daten Reisehinweise {nameFuer}. Prüfen Sie vor der Reise die aktuellen Hinweise Ihrer eigenen Regierung.',
  },
};
