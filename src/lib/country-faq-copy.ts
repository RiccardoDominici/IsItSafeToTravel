/**
 * Template copy for the country-page FAQ answers, in all 7 languages.
 * Consumed by getCountryFaqData in src/lib/seo.ts, which fills the
 * placeholders and picks the right variant per country, so every page gets
 * a self-contained answer instead of boilerplate.
 *
 * Placeholders: {name} {year} {monthYear} {score} {riskLevel}
 * {weakest} {weakestScore} {second} {secondScore} {strongest} {strongestScore}
 * {meaning} (a pillarMeaning sentence, Q1 + Q2) {drivers} (an indicator-driven
 * clause naming the lowest-scoring signals, Q2) {advisoryCount} (a localized
 * advisory-count phrase, Q3) {governments} (1-2 localized government names, Q3)
 * {govLevel} (an advisoryLevelWords tier label, Q3).
 * Answers stay plain text: they feed both the visible FAQ and the FAQPage
 * JSON-LD, which must remain identical.
 */
import type { Lang } from '../i18n/ui';
import type { PillarName } from '../pipeline/types';

export interface CountryFaqCopy {
  /** Questions — Q1/Q2 kept verbatim; Q3 is the government-advisory question. */
  q1: string;
  q2: string;
  q3: string;
  /** A1 openers by overall risk band (score >=7 / >=5 / below). */
  a1Verdict: { low: string; moderate: string; high: string };
  a1Formula: string;
  /** A1 drivers: normal (names drag pillars + {meaning}), or allStrong when even the weakest pillar is >=7/10. */
  a1Drivers: { normal: string; allStrong: string };
  a1Provenance: string;
  /** A2 variants by weakest-pillar band (<4 / 4-7 / >=7). critical/mid carry {meaning} + {drivers}. */
  a2: { critical: string; mid: string; strong: string };
  /** Indicator-driver clause (fills {drivers}); {labels} = 1-2 joined indicator names. */
  a2DriverClause: { one: string; two: string };
  /** What each pillar concretely means for a traveler (fills {meaning}). */
  pillarMeaning: Record<PillarName, string>;
  /** A3 intro naming the advisory count on record. */
  a3Intro: string;
  /** A3 consensus sentence by modal advisory band (1 / 2 / 3 / 4). */
  a3Consensus: { normal: string; caution: string; reconsider: string; avoid: string };
  /** Appended only when a strict MAJORITY of advisories are Level 4 (v9: severe-advisory down-weighting, not a hard cap). */
  a3Cap: string;
  /** Zero-advisory sentence for micro-territories with no advisory on record. */
  a3None: string;
  /** Singular/plural advisory-count noun phrase; {n} is the count (fills {advisoryCount}). */
  advisoryCountNoun: { one: string; other: string };
}

/** Pillar labels with proper diacritics, for use inside FAQ answer prose. */
export const faqPillarLabels: Record<Lang, Record<PillarName, string>> = {
  "en": {
    "conflict": "conflict",
    "crime": "crime",
    "health": "health",
    "governance": "governance",
    "environment": "environment"
  },
  "it": {
    "conflict": "conflitto",
    "crime": "criminalità",
    "health": "salute",
    "governance": "governance",
    "environment": "ambiente"
  },
  "es": {
    "conflict": "conflicto",
    "crime": "criminalidad",
    "health": "salud",
    "governance": "gobernanza",
    "environment": "medio ambiente"
  },
  "fr": {
    "conflict": "conflit",
    "crime": "criminalité",
    "health": "santé",
    "governance": "gouvernance",
    "environment": "environnement"
  },
  "pt": {
    "conflict": "conflito",
    "crime": "criminalidade",
    "health": "saúde",
    "governance": "governança",
    "environment": "meio ambiente"
  },
  "zh": {
    "conflict": "冲突",
    "crime": "犯罪",
    "health": "健康",
    "governance": "治理",
    "environment": "环境"
  },
  "de": {
    "conflict": "Konflikt",
    "crime": "Kriminalität",
    "health": "Gesundheit",
    "governance": "Regierungsführung",
    "environment": "Umwelt"
  }
};

/**
 * Anchor labels for the distinct scoring indicators, used to name what
 * concretely drives a weak pillar in Q2. All advisory_level_* indicators
 * collapse to the single 'advisory_group' label (counted once). Keyed to the
 * indicator .name values emitted by the scoring engine.
 */
export const indicatorLabels: Record<Lang, Record<string, string>> = {
  "en": {
    "gpi_overall": "overall peacefulness (Global Peace Index)",
    "gpi_safety_security": "societal safety and security (Global Peace Index)",
    "gpi_militarisation": "militarisation (Global Peace Index)",
    "vdem_rule_of_law": "rule of law (V-Dem)",
    "inform_health": "health-system capacity (INFORM)",
    "inform_epidemic": "epidemic and disease risk (INFORM)",
    "wb_child_mortality": "child mortality (World Bank)",
    "vdem_corruption_control": "control of corruption (V-Dem)",
    "vdem_gov_effectiveness": "government effectiveness (V-Dem)",
    "inform_governance": "institutional and governance fragility (INFORM)",
    "inform_natural": "exposure to natural hazards (INFORM)",
    "inform_climate": "climate-related hazard exposure (INFORM)",
    "gdacs_disaster_alerts": "active disaster alerts (GDACS)",
    "reliefweb_active_disasters": "ongoing humanitarian emergencies (ReliefWeb)",
    "advisory_group": "government travel-advisory levels"
  },
  "it": {
    "gpi_overall": "pacificità complessiva (Global Peace Index)",
    "gpi_safety_security": "sicurezza sociale (Global Peace Index)",
    "gpi_militarisation": "militarizzazione (Global Peace Index)",
    "vdem_rule_of_law": "stato di diritto (V-Dem)",
    "inform_health": "capacità del sistema sanitario (INFORM)",
    "inform_epidemic": "rischio di epidemie e malattie (INFORM)",
    "wb_child_mortality": "mortalità infantile (Banca Mondiale)",
    "vdem_corruption_control": "controllo della corruzione (V-Dem)",
    "vdem_gov_effectiveness": "efficacia del governo (V-Dem)",
    "inform_governance": "fragilità istituzionale e di governance (INFORM)",
    "inform_natural": "esposizione ai rischi naturali (INFORM)",
    "inform_climate": "esposizione ai rischi climatici (INFORM)",
    "gdacs_disaster_alerts": "allerte per disastri in corso (GDACS)",
    "reliefweb_active_disasters": "emergenze umanitarie in corso (ReliefWeb)",
    "advisory_group": "livelli degli avvisi di viaggio governativi"
  },
  "es": {
    "gpi_overall": "paz general (Global Peace Index)",
    "gpi_safety_security": "seguridad social (Global Peace Index)",
    "gpi_militarisation": "militarización (Global Peace Index)",
    "vdem_rule_of_law": "Estado de derecho (V-Dem)",
    "inform_health": "capacidad del sistema sanitario (INFORM)",
    "inform_epidemic": "riesgo de epidemias y enfermedades (INFORM)",
    "wb_child_mortality": "mortalidad infantil (Banco Mundial)",
    "vdem_corruption_control": "control de la corrupción (V-Dem)",
    "vdem_gov_effectiveness": "eficacia del gobierno (V-Dem)",
    "inform_governance": "fragilidad institucional y de gobernanza (INFORM)",
    "inform_natural": "exposición a riesgos naturales (INFORM)",
    "inform_climate": "exposición a riesgos climáticos (INFORM)",
    "gdacs_disaster_alerts": "alertas de desastres activas (GDACS)",
    "reliefweb_active_disasters": "emergencias humanitarias en curso (ReliefWeb)",
    "advisory_group": "niveles de los avisos de viaje gubernamentales"
  },
  "fr": {
    "gpi_overall": "niveau de paix global (Global Peace Index)",
    "gpi_safety_security": "sûreté et sécurité sociétales (Global Peace Index)",
    "gpi_militarisation": "militarisation (Global Peace Index)",
    "vdem_rule_of_law": "état de droit (V-Dem)",
    "inform_health": "capacité du système de santé (INFORM)",
    "inform_epidemic": "risque d'épidémies et de maladies (INFORM)",
    "wb_child_mortality": "mortalité infantile (Banque mondiale)",
    "vdem_corruption_control": "contrôle de la corruption (V-Dem)",
    "vdem_gov_effectiveness": "efficacité du gouvernement (V-Dem)",
    "inform_governance": "fragilité institutionnelle et de gouvernance (INFORM)",
    "inform_natural": "exposition aux risques naturels (INFORM)",
    "inform_climate": "exposition aux risques climatiques (INFORM)",
    "gdacs_disaster_alerts": "alertes de catastrophes en cours (GDACS)",
    "reliefweb_active_disasters": "urgences humanitaires en cours (ReliefWeb)",
    "advisory_group": "niveaux des avis aux voyageurs gouvernementaux"
  },
  "pt": {
    "gpi_overall": "paz geral (Global Peace Index)",
    "gpi_safety_security": "segurança social (Global Peace Index)",
    "gpi_militarisation": "militarização (Global Peace Index)",
    "vdem_rule_of_law": "Estado de Direito (V-Dem)",
    "inform_health": "capacidade do sistema de saúde (INFORM)",
    "inform_epidemic": "risco de epidemias e doenças (INFORM)",
    "wb_child_mortality": "mortalidade infantil (Banco Mundial)",
    "vdem_corruption_control": "controle da corrupção (V-Dem)",
    "vdem_gov_effectiveness": "eficácia do governo (V-Dem)",
    "inform_governance": "fragilidade institucional e de governança (INFORM)",
    "inform_natural": "exposição a riscos naturais (INFORM)",
    "inform_climate": "exposição a riscos climáticos (INFORM)",
    "gdacs_disaster_alerts": "alertas de desastres ativos (GDACS)",
    "reliefweb_active_disasters": "emergências humanitárias em curso (ReliefWeb)",
    "advisory_group": "níveis dos avisos de viagem governamentais"
  },
  "zh": {
    "gpi_overall": "整体和平程度（全球和平指数）",
    "gpi_safety_security": "社会安全与治安（全球和平指数）",
    "gpi_militarisation": "军事化程度（全球和平指数）",
    "vdem_rule_of_law": "法治水平（V-Dem）",
    "inform_health": "医疗系统能力（INFORM）",
    "inform_epidemic": "流行病与疾病风险（INFORM）",
    "wb_child_mortality": "儿童死亡率（世界银行）",
    "vdem_corruption_control": "腐败控制（V-Dem）",
    "vdem_gov_effectiveness": "政府效能（V-Dem）",
    "inform_governance": "制度与治理脆弱性（INFORM）",
    "inform_natural": "自然灾害暴露程度（INFORM）",
    "inform_climate": "气候相关灾害暴露程度（INFORM）",
    "gdacs_disaster_alerts": "活跃灾害预警（GDACS）",
    "reliefweb_active_disasters": "持续中的人道主义紧急情况（ReliefWeb）",
    "advisory_group": "各国政府旅行警告级别"
  },
  "de": {
    "gpi_overall": "allgemeine Friedfertigkeit (Global Peace Index)",
    "gpi_safety_security": "gesellschaftliche Sicherheit (Global Peace Index)",
    "gpi_militarisation": "Militarisierung (Global Peace Index)",
    "vdem_rule_of_law": "Rechtsstaatlichkeit (V-Dem)",
    "inform_health": "Kapazität des Gesundheitssystems (INFORM)",
    "inform_epidemic": "Epidemie- und Krankheitsrisiko (INFORM)",
    "wb_child_mortality": "Kindersterblichkeit (Weltbank)",
    "vdem_corruption_control": "Korruptionskontrolle (V-Dem)",
    "vdem_gov_effectiveness": "Regierungseffektivität (V-Dem)",
    "inform_governance": "institutionelle Fragilität und Regierungsführung (INFORM)",
    "inform_natural": "Exposition gegenüber Naturgefahren (INFORM)",
    "inform_climate": "Exposition gegenüber klimabedingten Gefahren (INFORM)",
    "gdacs_disaster_alerts": "aktive Katastrophenwarnungen (GDACS)",
    "reliefweb_active_disasters": "laufende humanitäre Notlagen (ReliefWeb)",
    "advisory_group": "Stufen staatlicher Reisehinweise"
  }
};

/** Advisory tier labels (level 1..4), used as appositive labels in Q3. */
export const advisoryLevelWords: Record<Lang, [string, string, string, string]> = {
  "en": ["exercise normal precautions", "exercise increased caution", "reconsider travel", "do not travel"],
  "it": ["osservare le normali precauzioni", "usare maggiore prudenza", "riconsiderare il viaggio", "non viaggiare"],
  "es": ["tomar precauciones normales", "extremar la precaución", "reconsiderar el viaje", "no viajar"],
  "fr": ["observer les précautions normales", "redoubler de vigilance", "reconsidérer le voyage", "ne pas voyager"],
  "pt": ["adotar precauções normais", "redobrar a cautela", "reconsiderar a viagem", "não viajar"],
  "zh": ["正常预防", "提高警惕", "重新考虑出行", "切勿前往"],
  "de": ["normale Vorsicht walten lassen", "erhöhte Vorsicht walten lassen", "Reise überdenken", "nicht reisen"]
};

/** Connector to join up to two names (indicator labels or government names). */
export const listConnector: Record<Lang, string> = {
  "en": " and ",
  "it": " e ",
  "es": " y ",
  "fr": " et ",
  "pt": " e ",
  "zh": "和",
  "de": " und "
};

export const countryFaqCopy: Record<Lang, CountryFaqCopy> = {
  "en": {
    "q1": "Is it safe to travel to {name} in {year}?",
    "q2": "What is the biggest risk when traveling to {name}?",
    "q3": "What do government travel advisories say about {name}?",
    "a1Verdict": {
      "low": "Yes, generally — {name} is considered a safe destination: as of {monthYear} it scores {score}/10 on our daily safety index, classified as {riskLevel}.",
      "moderate": "Yes, but with caution — {name} is moderately safe: as of {monthYear} it scores {score}/10 on our daily safety index, classified as {riskLevel}. Most trips are trouble-free, but some risks deserve attention.",
      "high": "No — {name} is currently a high-risk destination: as of {monthYear} it scores {score}/10 on our daily safety index, classified as {riskLevel}, and travel requires serious caution."
    },
    "a1Formula": "The score is an uncertainty-weighted (Bayesian shrinkage) geometric mean of five pillars — conflict (30%), crime (25%), health (20%), governance (15%) and environment (10%) — combined with a calibrated consensus of government travel advisories, so a weak pillar drags the overall score down more than a strong one lifts it, and thin or stale data pulls a country's score toward a cautious regional baseline rather than guessing.",
    "a1Drivers": {
      "normal": "{strongest} ({strongestScore}/10) is {name}'s strongest pillar, while the score is pulled down by {second} ({secondScore}/10) and above all by {weakest} ({weakestScore}/10). {meaning}",
      "allStrong": "All five pillars score well for {name}: even the weakest, {weakest} ({weakestScore}/10), sits in the low-risk band, with {strongest} ({strongestScore}/10) leading."
    },
    "a1Provenance": "It is recalculated every day from public sources including government travel advisories, the Global Peace Index, the INFORM Risk Index and World Bank indicators.",
    "a2": {
      "critical": "The main concern for {name} is {weakest}, its weakest pillar at {weakestScore}/10. {meaning} {drivers} The second-lowest area is {second} at {secondScore}/10, so it deserves attention too. By contrast, {strongest} scores {strongestScore}/10 and is {name}'s strongest area.",
      "mid": "No single factor stands out as critical for {name}: its relatively weakest area is {weakest} at {weakestScore}/10, close to the global mid-range. {meaning} {drivers} Its strongest pillar is {strongest} at {strongestScore}/10.",
      "strong": "No pillar signals a significant risk for {name}: even its weakest area, {weakest}, scores {weakestScore}/10, well inside the low-risk band, and its five pillars range from {weakestScore}/10 to {strongestScore}/10. For travelers this means normal, common-sense precautions are enough."
    },
    "a2DriverClause": {
      "one": "The main signal behind this is {labels}.",
      "two": "The lowest-scoring signals here are {labels}."
    },
    "pillarMeaning": {
      "conflict": "This pillar measures armed conflict, terrorism and political violence — a low score means instability can affect personal safety and disrupt travel plans.",
      "crime": "This pillar reflects violent crime, theft and organized criminal activity — a low score calls for extra street awareness, especially outside the main tourist areas.",
      "health": "This pillar covers healthcare quality, disease risk and emergency response capacity — a low score means reliable medical help may be hard to reach outside major cities.",
      "governance": "This pillar gauges the rule of law and the reliability of institutions — a low score means police and courts may offer limited help if something goes wrong.",
      "environment": "This pillar tracks exposure to natural hazards such as storms, floods and earthquakes, and how well the country is prepared to respond to them."
    },
    "a3Intro": "As of {monthYear}, {name} has {advisoryCount} on record.",
    "a3Consensus": {
      "normal": "The overall picture is reassuring: most governments advise only normal precautions for {name}, and none currently raises it above a low-level advisory.",
      "caution": "The prevailing guidance is to exercise increased caution when visiting {name}; the strongest current warning — {govLevel} — comes from {governments}.",
      "reconsider": "The prevailing guidance is to reconsider travel to {name}: the most severe warnings — {govLevel} — have been issued by {governments}.",
      "avoid": "Most governments now advise against all travel to {name}: the highest-level warning — {govLevel} — has been issued by {governments}, among others."
    },
    "a3Cap": "These warnings are severe enough to weigh heavily on our index: when a majority of governments issue a do-not-travel advisory, {name}'s overall score is pulled sharply toward the low end, on top of whatever its other pillars show.",
    "a3None": "As of {monthYear}, no government in our dataset publishes a travel advisory for {name} — typically the case for very small or remote territories. Base your decision on the pillar scores above and check your own government's latest guidance before you travel.",
    "advisoryCountNoun": {
      "one": "one government travel advisory",
      "other": "{n} government travel advisories"
    }
  },
  "it": {
    "q1": "E sicuro viaggiare in {name} nel {year}?",
    "q2": "Qual e il rischio maggiore viaggiando in {name}?",
    "q3": "Cosa dicono gli avvisi di viaggio governativi su {name}?",
    "a1Verdict": {
      "low": "Sì, in genere — {name} è una destinazione considerata sicura: a {monthYear} ottiene {score}/10 sul nostro indice di sicurezza aggiornato ogni giorno, un punteggio classificato come {riskLevel}.",
      "moderate": "Sì, ma con cautela — {name} è una destinazione moderatamente sicura: a {monthYear} ottiene {score}/10 sul nostro indice di sicurezza aggiornato ogni giorno, un punteggio classificato come {riskLevel}. La maggior parte dei viaggi si svolge senza problemi, ma alcuni rischi meritano attenzione.",
      "high": "No — {name} è attualmente una destinazione ad alto rischio: a {monthYear} ottiene {score}/10 sul nostro indice di sicurezza aggiornato ogni giorno, un punteggio classificato come {riskLevel}, e viaggiare richiede grande prudenza."
    },
    "a1Formula": "Il punteggio è una media geometrica ponderata e corretta per l'incertezza (Bayesian shrinkage) di cinque pilastri — conflitto (30%), criminalità (25%), salute (20%), governance (15%) e ambiente (10%) — combinata con un consenso calibrato degli avvisi di viaggio governativi, per cui un pilastro debole trascina verso il basso il punteggio complessivo più di quanto uno forte riesca a sollevarlo, e i dati scarsi o datati avvicinano il punteggio di un paese a un valore di riferimento regionale prudente invece di essere stimati a caso.",
    "a1Drivers": {
      "normal": "Il pilastro più solido di {name} è {strongest} ({strongestScore}/10), mentre a pesare sul punteggio sono {second} ({secondScore}/10) e, più di tutto, {weakest} ({weakestScore}/10). {meaning}",
      "allStrong": "Tutti e cinque i pilastri ottengono buoni punteggi per {name}: anche il più debole, {weakest} ({weakestScore}/10), rientra nella fascia di rischio basso, con {strongest} ({strongestScore}/10) in testa."
    },
    "a1Provenance": "Viene ricalcolato ogni giorno a partire da fonti pubbliche, tra cui avvisi di viaggio governativi, il Global Peace Index, l'INFORM Risk Index e indicatori della Banca Mondiale.",
    "a2": {
      "critical": "La principale criticità per {name} riguarda il pilastro {weakest}, il più debole con {weakestScore}/10. {meaning} {drivers} Il secondo punto debole è il pilastro {second}, con {secondScore}/10, e merita quindi attenzione anch'esso. Per contro, il pilastro {strongest} ottiene {strongestScore}/10 ed è l'area più solida di {name}.",
      "mid": "Nessun singolo fattore emerge come critico per {name}: l'area relativamente più debole è il pilastro {weakest}, con {weakestScore}/10, un valore vicino alla fascia media globale. {meaning} {drivers} Il suo punto di forza è il pilastro {strongest}, con {strongestScore}/10.",
      "strong": "Nessun pilastro segnala un rischio significativo per {name}: anche l'area più debole, {weakest}, ottiene {weakestScore}/10, ben dentro la fascia di rischio basso, e i cinque pilastri si collocano tra {weakestScore}/10 e {strongestScore}/10. Per chi viaggia questo significa che bastano le normali precauzioni di buon senso."
    },
    "a2DriverClause": {
      "one": "Il segnale principale alla base di questo dato è {labels}.",
      "two": "I segnali con il punteggio più basso in quest'area sono {labels}."
    },
    "pillarMeaning": {
      "conflict": "Questo pilastro misura conflitti armati, terrorismo e violenza politica: un punteggio basso indica che l'instabilità può incidere sulla sicurezza personale e compromettere i piani di viaggio.",
      "crime": "Questo pilastro riflette crimini violenti, furti e criminalità organizzata: un punteggio basso richiede maggiore attenzione per strada, soprattutto fuori dalle principali zone turistiche.",
      "health": "Questo pilastro copre la qualità dell'assistenza sanitaria, il rischio di malattie e la capacità di risposta alle emergenze: un punteggio basso indica che fuori dalle grandi città può essere difficile ottenere assistenza medica affidabile.",
      "governance": "Questo pilastro valuta lo stato di diritto e l'affidabilità delle istituzioni: un punteggio basso indica che polizia e tribunali potrebbero offrire un aiuto limitato se qualcosa va storto.",
      "environment": "Questo pilastro monitora l'esposizione a rischi naturali come tempeste, alluvioni e terremoti, e quanto il paese sia preparato a farvi fronte."
    },
    "a3Intro": "A {monthYear}, {name} conta {advisoryCount}.",
    "a3Consensus": {
      "normal": "Il quadro complessivo è rassicurante: la maggior parte dei governi raccomanda solo precauzioni normali per {name} e nessuno lo colloca oltre un avviso di basso livello.",
      "caution": "L'indicazione prevalente è di usare maggiore prudenza in {name}; l'avviso più severo — {govLevel} — arriva da {governments}.",
      "reconsider": "L'indicazione prevalente è di riconsiderare il viaggio in {name}: gli avvisi più severi — {govLevel} — sono stati emessi da {governments}.",
      "avoid": "La maggior parte dei governi sconsiglia ormai del tutto i viaggi in {name}: un avviso di livello massimo — {govLevel} — è stato emesso da {governments}, tra gli altri."
    },
    "a3Cap": "Questi avvisi sono abbastanza gravi da pesare fortemente sul nostro indice: quando la maggioranza dei governi emette un avviso di non viaggiare, il punteggio complessivo di {name} viene spinto decisamente verso il basso, oltre a quanto già indicato dagli altri pilastri.",
    "a3None": "A {monthYear}, nessun governo presente nel nostro set di dati pubblica un avviso di viaggio per {name}: è il caso tipico di territori molto piccoli o remoti. Basa la tua decisione sui punteggi dei pilastri qui sopra e verifica le indicazioni più recenti del tuo governo prima di partire.",
    "advisoryCountNoun": {
      "one": "un avviso di viaggio governativo",
      "other": "{n} avvisi di viaggio governativi"
    }
  },
  "es": {
    "q1": "Es seguro viajar a {name} en {year}?",
    "q2": "Cual es el mayor riesgo al viajar a {name}?",
    "q3": "¿Qué dicen los avisos de viaje gubernamentales sobre {name}?",
    "a1Verdict": {
      "low": "Sí, en general — {name} se considera un destino seguro: a fecha de {monthYear} obtiene {score}/10 en nuestro índice de seguridad diario, clasificado como {riskLevel}.",
      "moderate": "Sí, pero con precaución — {name} es un destino moderadamente seguro: a fecha de {monthYear} obtiene {score}/10 en nuestro índice de seguridad diario, clasificado como {riskLevel}. La mayoría de los viajes transcurren sin incidentes, pero algunos riesgos merecen atención.",
      "high": "No — {name} es actualmente un destino de alto riesgo: a fecha de {monthYear} obtiene {score}/10 en nuestro índice de seguridad diario, clasificado como {riskLevel}, y viajar allí exige extremar las precauciones."
    },
    "a1Formula": "La puntuación es una media geométrica ponderada con corrección por incertidumbre (Bayesian shrinkage) de cinco pilares (conflictos 30%, criminalidad 25%, salud 20%, gobernanza 15%, medio ambiente 10%), combinada con un consenso calibrado de los avisos de viaje gubernamentales, de modo que un pilar débil lastra la puntuación global más de lo que un pilar fuerte la eleva, y los datos escasos o desactualizados acercan la puntuación de un país a un valor de referencia regional prudente en lugar de adivinar.",
    "a1Drivers": {
      "normal": "El pilar más fuerte de {name} es {strongest} ({strongestScore}/10), mientras que la puntuación se ve lastrada por {second} ({secondScore}/10) y, sobre todo, por {weakest} ({weakestScore}/10). {meaning}",
      "allStrong": "Los cinco pilares de {name} obtienen buenas puntuaciones: incluso el más débil, {weakest} ({weakestScore}/10), se sitúa en la franja de riesgo bajo, con {strongest} ({strongestScore}/10) a la cabeza."
    },
    "a1Provenance": "Se recalcula cada día a partir de fuentes públicas, entre ellas los avisos de viaje gubernamentales, el Global Peace Index, el INFORM Risk Index e indicadores del Banco Mundial.",
    "a2": {
      "critical": "La principal preocupación en {name} es {weakest}, su pilar más débil con {weakestScore}/10. {meaning} {drivers} La segunda área más débil es {second}, con {secondScore}/10, por lo que también merece atención. En cambio, el pilar de {strongest} alcanza {strongestScore}/10 y es el área más fuerte de {name}.",
      "mid": "Ningún factor destaca como crítico en {name}: su área relativamente más débil es {weakest}, con {weakestScore}/10, cerca de la franja media mundial. {meaning} {drivers} Su pilar más fuerte es {strongest}, con {strongestScore}/10.",
      "strong": "Ningún pilar señala un riesgo significativo en {name}: incluso su área más débil, {weakest}, obtiene {weakestScore}/10, claramente dentro de la franja de riesgo bajo, y sus cinco pilares se mueven entre {weakestScore}/10 y {strongestScore}/10. Para quien viaja, esto significa que bastan las precauciones normales de sentido común."
    },
    "a2DriverClause": {
      "one": "La señal principal detrás de esto es {labels}.",
      "two": "Las señales con la puntuación más baja en este ámbito son {labels}."
    },
    "pillarMeaning": {
      "conflict": "Este pilar mide los conflictos armados, el terrorismo y la violencia política — una puntuación baja significa que la inestabilidad puede afectar a la seguridad personal y trastocar los planes de viaje.",
      "crime": "Este pilar refleja los delitos violentos, los robos y la actividad criminal organizada — una puntuación baja exige mayor atención en la calle, sobre todo fuera de las principales zonas turísticas.",
      "health": "Este pilar abarca la calidad de la asistencia sanitaria, el riesgo de enfermedades y la capacidad de respuesta ante emergencias — una puntuación baja significa que puede ser difícil acceder a ayuda médica fiable fuera de las grandes ciudades.",
      "governance": "Este pilar evalúa el Estado de derecho y la fiabilidad de las instituciones — una puntuación baja significa que la policía y los tribunales pueden ofrecer una ayuda limitada si algo sale mal.",
      "environment": "Este pilar registra la exposición a riesgos naturales como tormentas, inundaciones y terremotos, así como el grado de preparación del país para responder a ellos."
    },
    "a3Intro": "A fecha de {monthYear}, {name} cuenta con {advisoryCount}.",
    "a3Consensus": {
      "normal": "El panorama general es tranquilizador: la mayoría de los gobiernos solo recomiendan precauciones normales para {name} y ninguno lo sitúa por encima de un aviso de bajo nivel.",
      "caution": "La recomendación predominante es extremar la precaución al visitar {name}; la advertencia más severa — {govLevel} — proviene de {governments}.",
      "reconsider": "La recomendación predominante es reconsiderar el viaje a {name}: las advertencias más severas — {govLevel} — han sido emitidas por {governments}.",
      "avoid": "La mayoría de los gobiernos desaconsejan ya todo viaje a {name}: la advertencia del nivel más alto — {govLevel} — ha sido emitida por {governments}, entre otros."
    },
    "a3Cap": "Estas advertencias son lo bastante graves como para pesar mucho en nuestro índice: cuando la mayoría de los gobiernos emiten un aviso de no viajar, la puntuación global de {name} se empuja marcadamente hacia el extremo bajo, además de lo que ya indiquen sus otros pilares.",
    "a3None": "A fecha de {monthYear}, ningún gobierno de nuestro conjunto de datos publica un aviso de viaje para {name}, algo habitual en territorios muy pequeños o remotos. Basa tu decisión en las puntuaciones de los pilares anteriores y consulta las indicaciones más recientes de tu propio gobierno antes de viajar.",
    "advisoryCountNoun": {
      "one": "un aviso de viaje gubernamental",
      "other": "{n} avisos de viaje gubernamentales"
    }
  },
  "fr": {
    "q1": "{name} : est-ce sûr d'y voyager en {year} ?",
    "q2": "{name} : quel est le plus grand risque pour les voyageurs ?",
    "q3": "Que disent les avis aux voyageurs officiels concernant {name} ?",
    "a1Verdict": {
      "low": "Oui, en général — {name} est une destination considérée comme sûre : en {monthYear}, le pays obtient {score}/10 sur notre indice de sécurité quotidien, dans la catégorie « {riskLevel} ».",
      "moderate": "Oui, mais avec prudence — {name} est une destination modérément sûre : en {monthYear}, le pays obtient {score}/10 sur notre indice de sécurité quotidien, dans la catégorie « {riskLevel} ». La plupart des voyages se déroulent sans encombre, mais certains risques méritent une attention particulière.",
      "high": "Non — {name} est actuellement une destination à haut risque : en {monthYear}, le pays obtient {score}/10 sur notre indice de sécurité quotidien, dans la catégorie « {riskLevel} », et tout voyage exige une grande prudence."
    },
    "a1Formula": "Le score est une moyenne géométrique pondérée corrigée pour l'incertitude (Bayesian shrinkage) de cinq piliers — conflits (30 %), criminalité (25 %), santé (20 %), gouvernance (15 %) et environnement (10 %) — combinée à un consensus calibré des avis de voyage gouvernementaux, de sorte qu'un pilier faible tire le score global vers le bas plus qu'un pilier fort ne le relève, et que des données rares ou obsolètes rapprochent le score d'un pays d'une référence régionale prudente plutôt que d'être devinées.",
    "a1Drivers": {
      "normal": "Le pilier le plus solide de {name} est {strongest} ({strongestScore}/10), tandis que le score est tiré vers le bas par {second} ({secondScore}/10) et surtout par {weakest} ({weakestScore}/10). {meaning}",
      "allStrong": "{name} affiche de bons scores sur les cinq piliers : même le plus faible, le pilier {weakest} ({weakestScore}/10), reste dans la zone de faible risque, le pilier {strongest} ({strongestScore}/10) arrivant en tête."
    },
    "a1Provenance": "Il est recalculé chaque jour à partir de sources publiques, dont les avis aux voyageurs gouvernementaux, le Global Peace Index, l'indice de risque INFORM et des indicateurs de la Banque mondiale.",
    "a2": {
      "critical": "{name} présente un point de vigilance majeur : le pilier {weakest}, le plus faible avec {weakestScore}/10. {meaning} {drivers} Le deuxième domaine le plus fragile est le pilier {second}, à {secondScore}/10 : il mérite donc lui aussi de l'attention. À l'inverse, le pilier {strongest} atteint {strongestScore}/10 : c'est le domaine où {name} est le plus solide.",
      "mid": "{name} ne présente aucun facteur véritablement critique : son domaine relativement le plus faible est le pilier {weakest}, à {weakestScore}/10, un niveau proche de la moyenne mondiale. {meaning} {drivers} Côté points forts, le pilier {strongest} arrive en tête, à {strongestScore}/10.",
      "strong": "{name} ne présente de risque significatif sur aucun pilier : même son domaine le plus faible, le pilier {weakest}, obtient {weakestScore}/10, bien à l'intérieur de la zone de faible risque, et ses cinq piliers s'échelonnent de {weakestScore}/10 à {strongestScore}/10. Pour les voyageurs, cela signifie que les précautions de bon sens habituelles suffisent."
    },
    "a2DriverClause": {
      "one": "Le principal signal à l'origine de ce résultat est {labels}.",
      "two": "Les signaux les moins bien notés dans ce domaine sont {labels}."
    },
    "pillarMeaning": {
      "conflict": "Ce pilier mesure les conflits armés, le terrorisme et la violence politique — un score bas signifie que l'instabilité peut affecter la sécurité personnelle et perturber les projets de voyage.",
      "crime": "Ce pilier reflète les crimes violents, les vols et la criminalité organisée — un score bas appelle une vigilance accrue dans la rue, surtout en dehors des principales zones touristiques.",
      "health": "Ce pilier couvre la qualité des soins, le risque de maladies et la capacité de réponse aux urgences — un score bas signifie qu'une aide médicale fiable peut être difficile à trouver en dehors des grandes villes.",
      "governance": "Ce pilier évalue l'état de droit et la fiabilité des institutions — un score bas signifie que la police et la justice peuvent n'offrir qu'une aide limitée en cas de problème.",
      "environment": "Ce pilier suit l'exposition aux risques naturels tels que tempêtes, inondations et séismes, ainsi que le niveau de préparation du pays pour y faire face."
    },
    "a3Intro": "En {monthYear}, on recense {advisoryCount} pour {name}.",
    "a3Consensus": {
      "normal": "Le tableau d'ensemble est rassurant : la plupart des gouvernements ne recommandent que des précautions normales pour {name}, et aucun ne le place au-dessus d'un avis de faible niveau.",
      "caution": "La consigne dominante est de redoubler de vigilance lors d'une visite en {name} ; l'avertissement le plus sévère — {govLevel} — émane de {governments}.",
      "reconsider": "La consigne dominante est de reconsidérer tout voyage en {name} : les avertissements les plus sévères — {govLevel} — ont été émis par {governments}.",
      "avoid": "La plupart des gouvernements déconseillent désormais tout voyage en {name} : l'avertissement du niveau le plus élevé — {govLevel} — a été émis par {governments}, entre autres."
    },
    "a3Cap": "Ces avertissements sont assez graves pour peser fortement sur notre indice : lorsqu'une majorité de gouvernements émet un avis « ne pas voyager », le score global de {name} est fortement tiré vers le bas, en plus de ce qu'indiquent déjà ses autres piliers.",
    "a3None": "En {monthYear}, aucun gouvernement de notre jeu de données ne publie d'avis aux voyageurs pour {name}, ce qui est courant pour les territoires très petits ou reculés. Fondez votre décision sur les scores des piliers ci-dessus et vérifiez les dernières recommandations de votre propre gouvernement avant de partir.",
    "advisoryCountNoun": {
      "one": "un avis aux voyageurs officiel",
      "other": "{n} avis aux voyageurs officiels"
    }
  },
  "pt": {
    "q1": "E seguro viajar para {name} em {year}?",
    "q2": "Qual e o maior risco ao viajar para {name}?",
    "q3": "O que dizem os avisos de viagem governamentais sobre {name}?",
    "a1Verdict": {
      "low": "Sim, em geral — {name} é um destino considerado seguro: em {monthYear}, obtém {score}/10 no nosso índice diário de segurança, com classificação de {riskLevel}.",
      "moderate": "Sim, mas com cautela — {name} é um destino moderadamente seguro: em {monthYear}, obtém {score}/10 no nosso índice diário de segurança, com classificação de {riskLevel}. A maioria das viagens transcorre sem problemas, mas alguns riscos merecem atenção.",
      "high": "Não — {name} é atualmente um destino de alto risco: em {monthYear}, obtém {score}/10 no nosso índice diário de segurança, com classificação de {riskLevel}, e viajar exige muita cautela."
    },
    "a1Formula": "A pontuação é uma média geométrica ponderada com correção de incerteza (Bayesian shrinkage) de cinco pilares — conflitos (30%), criminalidade (25%), saúde (20%), governança (15%) e meio ambiente (10%) —, combinada com um consenso calibrado dos avisos de viagem governamentais, de modo que um pilar fraco puxa a pontuação geral para baixo mais do que um pilar forte a eleva, e dados escassos ou desatualizados aproximam a pontuação de um país de um valor de referência regional prudente em vez de serem estimados ao acaso.",
    "a1Drivers": {
      "normal": "O pilar mais forte de {name} é {strongest} ({strongestScore}/10), enquanto a pontuação é puxada para baixo por {second} ({secondScore}/10) e, sobretudo, por {weakest} ({weakestScore}/10). {meaning}",
      "allStrong": "Os cinco pilares de {name} apresentam boas pontuações: até o mais fraco, {weakest} ({weakestScore}/10), fica na faixa de risco baixo, com {strongest} ({strongestScore}/10) na liderança."
    },
    "a1Provenance": "Ela é recalculada todos os dias a partir de fontes públicas, incluindo avisos de viagem governamentais, o Global Peace Index, o INFORM Risk Index e indicadores do Banco Mundial.",
    "a2": {
      "critical": "A principal preocupação para {name} é o pilar de {weakest}, o mais fraco do país, com {weakestScore}/10. {meaning} {drivers} A segunda área mais baixa é a de {second}, com {secondScore}/10, e também merece atenção. Em contrapartida, o pilar de {strongest} obtém {strongestScore}/10 e é a área mais forte de {name}.",
      "mid": "Nenhum fator isolado se destaca como crítico para {name}: sua área relativamente mais fraca é a de {weakest}, com {weakestScore}/10, perto da faixa intermediária global. {meaning} {drivers} Seu pilar mais forte é o de {strongest}, com {strongestScore}/10.",
      "strong": "Nenhum pilar indica um risco significativo para {name}: até sua área mais fraca, a de {weakest}, obtém {weakestScore}/10, bem dentro da faixa de risco baixo, e os cinco pilares variam de {weakestScore}/10 a {strongestScore}/10. Para quem viaja, isso significa que as precauções normais de bom senso são suficientes."
    },
    "a2DriverClause": {
      "one": "O principal sinal por trás disso é {labels}.",
      "two": "Os sinais com a pontuação mais baixa nesta área são {labels}."
    },
    "pillarMeaning": {
      "conflict": "Esse pilar mede conflitos armados, terrorismo e violência política — uma pontuação baixa significa que a instabilidade pode afetar a segurança pessoal e atrapalhar os planos de viagem.",
      "crime": "Esse pilar reflete crimes violentos, furtos e atividade do crime organizado — uma pontuação baixa exige atenção redobrada nas ruas, especialmente fora das principais áreas turísticas.",
      "health": "Esse pilar abrange a qualidade dos serviços de saúde, o risco de doenças e a capacidade de resposta a emergências — uma pontuação baixa significa que pode ser difícil encontrar atendimento médico confiável fora das grandes cidades.",
      "governance": "Esse pilar avalia o Estado de Direito e a confiabilidade das instituições — uma pontuação baixa significa que a polícia e a justiça podem oferecer ajuda limitada se algo der errado.",
      "environment": "Esse pilar acompanha a exposição a riscos naturais como tempestades, enchentes e terremotos, além do grau de preparo do país para responder a eles."
    },
    "a3Intro": "Em {monthYear}, {name} conta com {advisoryCount}.",
    "a3Consensus": {
      "normal": "O panorama geral é tranquilizador: a maioria dos governos recomenda apenas precauções normais para {name} e nenhum o coloca acima de um aviso de baixo nível.",
      "caution": "A orientação predominante é redobrar a cautela ao visitar {name}; o alerta mais severo — {govLevel} — vem de {governments}.",
      "reconsider": "A orientação predominante é reconsiderar a viagem a {name}: os alertas mais severos — {govLevel} — foram emitidos por {governments}.",
      "avoid": "A maioria dos governos já desaconselha qualquer viagem a {name}: o alerta de nível mais alto — {govLevel} — foi emitido por {governments}, entre outros."
    },
    "a3Cap": "Esses alertas são graves o suficiente para pesar fortemente em nosso índice: quando a maioria dos governos emite um aviso de não viajar, a pontuação geral de {name} é fortemente puxada para o lado mais baixo, além do que já indicam seus outros pilares.",
    "a3None": "Em {monthYear}, nenhum governo do nosso conjunto de dados publica um aviso de viagem para {name}, o que é comum em territórios muito pequenos ou remotos. Baseie sua decisão nas pontuações dos pilares acima e verifique as orientações mais recentes do seu próprio governo antes de viajar.",
    "advisoryCountNoun": {
      "one": "um aviso de viagem governamental",
      "other": "{n} avisos de viagem governamentais"
    }
  },
  "zh": {
    "q1": "{year} 年前往 {name} 旅行安全吗？",
    "q2": "前往 {name} 旅行的最大风险是什么？",
    "q3": "各国政府的旅行警告对 {name} 有何评价？",
    "a1Verdict": {
      "low": "总体而言是的——{name}被认为是一个安全的旅行目的地：截至{monthYear}，其在我们每日更新的安全指数中得分为 {score}/10，被评为{riskLevel}。",
      "moderate": "可以，但需保持警惕——{name}的安全状况处于中等水平：截至{monthYear}，其在我们每日更新的安全指数中得分为 {score}/10，被评为{riskLevel}。大多数行程都能顺利完成，但部分风险值得留意。",
      "high": "不安全——{name}目前属于高风险目的地：截至{monthYear}，其在我们每日更新的安全指数中得分为 {score}/10，被评为{riskLevel}，前往旅行需要格外谨慎。"
    },
    "a1Formula": "该评分是五大支柱——冲突（30%）、犯罪（25%）、健康（20%）、治理（15%）和环境（10%）——经不确定性加权（贝叶斯收缩）的几何平均数，并结合经校准的政府旅行警告共识，因此薄弱支柱对总分的拉低作用大于强势支柱的提升作用，数据稀疏或陈旧的国家，其评分会向审慎的区域基准靠拢，而不是被凭空估计。",
    "a1Drivers": {
      "normal": "{strongest}（{strongestScore}/10）是{name}表现最强的支柱，而拉低总分的主要是{second}（{secondScore}/10），尤其是{weakest}（{weakestScore}/10）。{meaning}",
      "allStrong": "{name}的五大支柱均表现良好：即使是得分最低的{weakest}（{weakestScore}/10）也处于低风险区间，其中以{strongest}（{strongestScore}/10）表现最为突出。"
    },
    "a1Provenance": "评分每天都会根据公开数据源重新计算，其中包括各国政府旅行警告、全球和平指数（Global Peace Index）、INFORM 风险指数（INFORM Risk Index）以及世界银行指标。",
    "a2": {
      "critical": "{name}最需要关注的是{weakest}，这一支柱得分最低，仅为 {weakestScore}/10。{meaning}{drivers}得分第二低的领域是{second}（{secondScore}/10），同样值得留意。相比之下，{strongest}得分为 {strongestScore}/10，是{name}表现最强的领域。",
      "mid": "对{name}而言，没有任何单一因素构成突出风险：其相对最薄弱的领域是{weakest}，得分为 {weakestScore}/10，接近全球中等水平。{meaning}{drivers}其表现最强的支柱是{strongest}，得分为 {strongestScore}/10。",
      "strong": "{name}的各项支柱均未显示出明显风险：即使是其最薄弱的领域{weakest}也得到了 {weakestScore}/10 的分数，稳居低风险区间，五大支柱的得分介于 {weakestScore}/10 到 {strongestScore}/10 之间。对旅行者而言，这意味着只需采取常规的常识性预防措施即可。"
    },
    "a2DriverClause": {
      "one": "造成这一低分的主要指标是{labels}。",
      "two": "该领域得分最低的指标是{labels}。"
    },
    "pillarMeaning": {
      "conflict": "该支柱衡量武装冲突、恐怖主义和政治暴力——得分较低意味着局势不稳可能危及人身安全并打乱旅行计划。",
      "crime": "该支柱反映暴力犯罪、盗窃和有组织犯罪活动——得分较低意味着需要在街头提高警惕，尤其是在主要旅游区之外。",
      "health": "该支柱涵盖医疗服务质量、疾病风险和应急响应能力——得分较低意味着在大城市之外可能难以获得可靠的医疗救助。",
      "governance": "该支柱评估法治水平和公共机构的可靠程度——得分较低意味着一旦出现问题，警方和法院可能只能提供有限的帮助。",
      "environment": "该支柱追踪该国面临风暴、洪水和地震等自然灾害的风险程度，以及其应对这些灾害的准备水平。"
    },
    "a3Intro": "截至{monthYear}，我们已收录 {name} 的{advisoryCount}。",
    "a3Consensus": {
      "normal": "总体情况令人安心：多数政府对 {name} 仅建议采取正常预防措施，没有任何一国将其提升至低级别以上的警告。",
      "caution": "主流建议是前往 {name} 时提高警惕；目前最严厉的警告——{govLevel}——来自{governments}。",
      "reconsider": "主流建议是重新考虑前往 {name} 的行程：最严厉的警告——{govLevel}——由{governments}发布。",
      "avoid": "多数政府目前建议完全避免前往 {name}：最高级别的警告——{govLevel}——已由{governments}等国发布。"
    },
    "a3Cap": "这些警告严重到足以在我们的指数中占据很大权重：当多数政府发布切勿前往的警告时，{name}的总分会被明显拉低，这还是在其他支柱已有表现的基础之上。",
    "a3None": "截至{monthYear}，我们的数据集中没有任何政府发布针对 {name} 的旅行警告——这在面积很小或偏远的地区很常见。请参考上方各支柱的得分，并在出行前查阅你所在国家政府的最新指引。",
    "advisoryCountNoun": {
      "one": "1 条政府旅行警告",
      "other": "{n} 条政府旅行警告"
    }
  },
  "de": {
    "q1": "Ist es {year} sicher, nach {name} zu reisen?",
    "q2": "Was ist das größte Risiko bei einer Reise nach {name}?",
    "q3": "Was sagen staatliche Reisehinweise über {name}?",
    "a1Verdict": {
      "low": "Ja, im Allgemeinen — {name} gilt als sicheres Reiseziel: Stand {monthYear} erreicht das Land {score}/10 auf unserem täglich aktualisierten Sicherheitsindex und ist als {riskLevel} eingestuft.",
      "moderate": "Ja, aber mit Vorsicht — {name} ist moderat sicher: Stand {monthYear} erreicht das Land {score}/10 auf unserem täglich aktualisierten Sicherheitsindex und ist als {riskLevel} eingestuft. Die meisten Reisen verlaufen problemlos, einige Risiken verdienen jedoch Aufmerksamkeit.",
      "high": "Nein — {name} ist derzeit ein Hochrisiko-Reiseziel: Stand {monthYear} erreicht das Land {score}/10 auf unserem täglich aktualisierten Sicherheitsindex, ist als {riskLevel} eingestuft, und Reisen dorthin erfordern erhebliche Vorsicht."
    },
    "a1Formula": "Der Wert ist ein unsicherheitsgewichtetes (Bayesian Shrinkage) geometrisches Mittel aus fünf Säulen — Konflikt (30 %), Kriminalität (25 %), Gesundheit (20 %), Regierungsführung (15 %) und Umwelt (10 %) —, kombiniert mit einem kalibrierten Konsens staatlicher Reisehinweise, sodass eine schwache Säule den Gesamtwert stärker nach unten zieht, als eine starke ihn anhebt, und spärliche oder veraltete Daten den Wert eines Landes zu einem vorsichtigen regionalen Richtwert hin ziehen, statt geschätzt zu werden.",
    "a1Drivers": {
      "normal": "Die stärkste Säule von {name} ist {strongest} ({strongestScore}/10), während {second} ({secondScore}/10) und vor allem {weakest} ({weakestScore}/10) den Wert nach unten ziehen. {meaning}",
      "allStrong": "{name} schneidet in allen fünf Säulen gut ab: Selbst die schwächste Säule, {weakest} ({weakestScore}/10), liegt im risikoarmen Bereich, während {strongest} ({strongestScore}/10) an der Spitze steht."
    },
    "a1Provenance": "Der Wert wird jeden Tag aus öffentlichen Quellen neu berechnet, darunter staatliche Reisehinweise, der Global Peace Index, der INFORM Risk Index und Indikatoren der Weltbank.",
    "a2": {
      "critical": "Die größte Sorge für {name} ist die Säule {weakest} — mit {weakestScore}/10 die schwächste des Landes. {meaning} {drivers} Der zweitschwächste Bereich ist {second} mit {secondScore}/10 und verdient daher ebenfalls Aufmerksamkeit. Im Gegensatz dazu kommt {strongest} auf {strongestScore}/10 — in diesem Bereich ist {name} am stärksten.",
      "mid": "Für {name} sticht kein einzelner Faktor als kritisch hervor: Die vergleichsweise schwächste Säule ist {weakest} mit {weakestScore}/10 und liegt damit nahe am globalen Mittelfeld. {meaning} {drivers} Die stärkste Säule des Landes ist {strongest} mit {strongestScore}/10.",
      "strong": "Keine Säule signalisiert für {name} ein nennenswertes Risiko: Selbst die schwächste Säule, {weakest}, erreicht {weakestScore}/10 und liegt damit klar im risikoarmen Bereich, und insgesamt bewegen sich die fünf Säulen zwischen {weakestScore}/10 und {strongestScore}/10. Für Reisende bedeutet das: Normale, vernünftige Vorsichtsmaßnahmen genügen."
    },
    "a2DriverClause": {
      "one": "Das wichtigste Signal dahinter ist {labels}.",
      "two": "Die am schlechtesten bewerteten Signale in diesem Bereich sind {labels}."
    },
    "pillarMeaning": {
      "conflict": "Diese Säule misst bewaffnete Konflikte, Terrorismus und politische Gewalt — ein niedriger Wert bedeutet, dass Instabilität die persönliche Sicherheit beeinträchtigen und Reisepläne durchkreuzen kann.",
      "crime": "Diese Säule bildet Gewaltkriminalität, Diebstahl und organisierte Kriminalität ab — ein niedriger Wert verlangt erhöhte Wachsamkeit unterwegs, besonders außerhalb der wichtigsten Touristengebiete.",
      "health": "Diese Säule umfasst die Qualität der Gesundheitsversorgung, Krankheitsrisiken und die Kapazitäten der Notfallhilfe — ein niedriger Wert bedeutet, dass verlässliche medizinische Hilfe außerhalb der großen Städte schwer zu erreichen sein kann.",
      "governance": "Diese Säule bewertet die Rechtsstaatlichkeit und die Verlässlichkeit der Institutionen — ein niedriger Wert bedeutet, dass Polizei und Gerichte nur begrenzt helfen können, wenn etwas schiefgeht.",
      "environment": "Diese Säule erfasst die Exposition gegenüber Naturgefahren wie Stürmen, Überschwemmungen und Erdbeben — und wie gut das Land auf solche Ereignisse vorbereitet ist."
    },
    "a3Intro": "Stand {monthYear} verzeichnen wir für {name} {advisoryCount}.",
    "a3Consensus": {
      "normal": "Das Gesamtbild ist beruhigend: Die meisten Regierungen empfehlen für {name} nur normale Vorsicht, und keine stuft es über einen Hinweis niedriger Stufe hinaus ein.",
      "caution": "Die vorherrschende Empfehlung lautet, bei einem Besuch in {name} erhöhte Vorsicht walten zu lassen; die schärfste aktuelle Warnung — {govLevel} — stammt von {governments}.",
      "reconsider": "Die vorherrschende Empfehlung lautet, eine Reise nach {name} zu überdenken: Die schwersten Warnungen — {govLevel} — wurden von {governments} ausgesprochen.",
      "avoid": "Die meisten Regierungen raten inzwischen von jeder Reise nach {name} ab: Die Warnung der höchsten Stufe — {govLevel} — wurde unter anderem von {governments} ausgesprochen."
    },
    "a3Cap": "Diese Warnungen sind schwerwiegend genug, um in unserem Index stark ins Gewicht zu fallen: Wenn eine Mehrheit der Regierungen eine Nicht-reisen-Warnung ausspricht, wird der Gesamtwert von {name} deutlich nach unten gezogen — zusätzlich zu dem, was die übrigen Säulen bereits zeigen.",
    "a3None": "Stand {monthYear} veröffentlicht keine Regierung in unserem Datensatz einen Reisehinweis für {name} — typisch für sehr kleine oder abgelegene Gebiete. Stützen Sie Ihre Entscheidung auf die Säulenwerte oben und prüfen Sie vor der Reise die aktuellen Hinweise Ihrer eigenen Regierung.",
    "advisoryCountNoun": {
      "one": "einen staatlichen Reisehinweis",
      "other": "{n} staatliche Reisehinweise"
    }
  }
};
