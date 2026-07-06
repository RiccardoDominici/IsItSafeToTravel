/**
 * Template copy for the country-page FAQ answers, in all 7 languages.
 * Consumed by getCountryFaqData in src/lib/seo.ts, which fills the
 * placeholders and picks the right variant per country, so every page gets
 * a self-contained answer instead of boilerplate.
 *
 * Placeholders: {name} {year} {monthYear} {score} {riskLevel}
 * {weakest} {weakestScore} {second} {secondScore} {strongest} {strongestScore}
 * {meaning} (a pillarMeaning sentence) {healthScore}.
 * Answers stay plain text: they feed both the visible FAQ and the FAQPage
 * JSON-LD, which must remain identical.
 */
import type { Lang } from '../i18n/ui';
import type { PillarName } from '../pipeline/types';

export interface CountryFaqCopy {
  /** Questions — kept verbatim from the original FAQ (stable search queries). */
  q1: string;
  q2: string;
  q3: string;
  /** A1 openers by overall risk band (score >=7 / >=4 / below). */
  a1Verdict: { low: string; moderate: string; high: string };
  a1Formula: string;
  /** A1 drivers: normal, or allStrong when even the weakest pillar is >=7/10. */
  a1Drivers: { normal: string; allStrong: string };
  a1Provenance: string;
  /** A2 variants by weakest-pillar band (<4 / 4-7 / >=7). */
  a2: { critical: string; mid: string; strong: string };
  /** What each pillar concretely means for a traveler (fills {meaning}). */
  pillarMeaning: Record<PillarName, string>;
  a3Opening: string;
  /** A3 body by health-pillar band (>=7.5 / >=5 / below). */
  a3Health: { strong: string; mixed: string; weak: string };
  /** Appended only when at least one tracked advisory is level 3+. */
  a3Advisory: string;
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

export const countryFaqCopy: Record<Lang, CountryFaqCopy> = {
  "en": {
    "q1": "Is it safe to travel to {name} in {year}?",
    "q2": "What is the biggest risk when traveling to {name}?",
    "q3": "Do I need travel insurance for {name}?",
    "a1Verdict": {
      "low": "Yes — {name} is considered a safe destination: as of {monthYear} it scores {score}/10 on our daily safety index, classified as {riskLevel}.",
      "moderate": "{name} is moderately safe: as of {monthYear} it scores {score}/10 on our daily safety index, classified as {riskLevel} — most trips are trouble-free, but some risks deserve attention.",
      "high": "{name} is currently a high-risk destination: as of {monthYear} it scores {score}/10 on our daily safety index, classified as {riskLevel}, and travel requires serious caution."
    },
    "a1Formula": "The score is a weighted geometric mean of five pillars — conflict (30%), crime (25%), health (20%), governance (15%) and environment (10%) — so a weak pillar drags the overall score down more than a strong one lifts it.",
    "a1Drivers": {
      "normal": "{name}'s result is shaped mainly by its weakest areas, {weakest} ({weakestScore}/10) and {second} ({secondScore}/10), while {strongest} ({strongestScore}/10) is its strongest pillar.",
      "allStrong": "All five pillars score well for {name}: even the weakest, {weakest} ({weakestScore}/10), sits in the low-risk band, with {strongest} ({strongestScore}/10) leading."
    },
    "a1Provenance": "It is recalculated every day from public sources including government travel advisories, the Global Peace Index, the INFORM Risk Index and World Bank indicators.",
    "a2": {
      "critical": "The main concern for {name} is {weakest}, its weakest pillar at {weakestScore}/10. {meaning} The second-lowest area is {second} at {secondScore}/10, so it deserves attention too. By contrast, {strongest} scores {strongestScore}/10 and is {name}'s strongest area.",
      "mid": "No single factor stands out as critical for {name}: its relatively weakest area is {weakest} at {weakestScore}/10, close to the global mid-range. {meaning} Its strongest pillar is {strongest} at {strongestScore}/10.",
      "strong": "No pillar signals a significant risk for {name}: even its weakest area, {weakest}, scores {weakestScore}/10, well inside the low-risk band, and its five pillars range from {weakestScore}/10 to {strongestScore}/10. For travelers this means normal, common-sense precautions are enough."
    },
    "pillarMeaning": {
      "conflict": "This pillar measures armed conflict, terrorism and political violence — a low score means instability can affect personal safety and disrupt travel plans.",
      "crime": "This pillar reflects violent crime, theft and organized criminal activity — a low score calls for extra street awareness, especially outside the main tourist areas.",
      "health": "This pillar covers healthcare quality, disease risk and emergency response capacity — a low score means reliable medical help may be hard to reach outside major cities.",
      "governance": "This pillar gauges the rule of law and the reliability of institutions — a low score means police and courts may offer limited help if something goes wrong.",
      "environment": "This pillar tracks exposure to natural hazards such as storms, floods and earthquakes, and how well the country is prepared to respond to them."
    },
    "a3Opening": "Yes — travel insurance is strongly recommended for {name}.",
    "a3Health": {
      "strong": "Its health pillar scores {healthScore}/10, indicating a solid healthcare system; visitors usually still pay out of pocket, though, so coverage for medical expenses and trip cancellation remains important.",
      "mixed": "Its health pillar scores {healthScore}/10, which points to uneven medical infrastructure — good care in major cities, limited capacity elsewhere — so choose a policy that covers emergency treatment and medical evacuation.",
      "weak": "Its health pillar scores {healthScore}/10, meaning local medical capacity is limited: comprehensive coverage including emergency care, medical evacuation and repatriation is essential rather than optional."
    },
    "a3Advisory": "Also check the fine print: some governments currently advise against travel to all or part of {name}, and many insurers void coverage in areas under such warnings."
  },
  "it": {
    "q1": "E sicuro viaggiare in {name} nel {year}?",
    "q2": "Qual e il rischio maggiore viaggiando in {name}?",
    "q3": "Ho bisogno di un'assicurazione di viaggio per {name}?",
    "a1Verdict": {
      "low": "Sì — {name} è una destinazione considerata sicura: a {monthYear} ottiene {score}/10 sul nostro indice di sicurezza aggiornato ogni giorno, un punteggio classificato come {riskLevel}.",
      "moderate": "{name} è una destinazione moderatamente sicura: a {monthYear} ottiene {score}/10 sul nostro indice di sicurezza aggiornato ogni giorno, un punteggio classificato come {riskLevel} — la maggior parte dei viaggi si svolge senza problemi, ma alcuni rischi meritano attenzione.",
      "high": "{name} è attualmente una destinazione ad alto rischio: a {monthYear} ottiene {score}/10 sul nostro indice di sicurezza aggiornato ogni giorno, un punteggio classificato come {riskLevel}, e viaggiare richiede grande prudenza."
    },
    "a1Formula": "Il punteggio è una media geometrica ponderata di cinque pilastri — conflitto (30%), criminalità (25%), salute (20%), governance (15%) e ambiente (10%) — per cui un pilastro debole trascina verso il basso il punteggio complessivo più di quanto uno forte riesca a sollevarlo.",
    "a1Drivers": {
      "normal": "Il risultato di {name} è determinato soprattutto dalle sue aree più deboli, {weakest} ({weakestScore}/10) e {second} ({secondScore}/10), mentre il pilastro più solido è {strongest} ({strongestScore}/10).",
      "allStrong": "Tutti e cinque i pilastri ottengono buoni punteggi per {name}: anche il più debole, {weakest} ({weakestScore}/10), rientra nella fascia di rischio basso, con {strongest} ({strongestScore}/10) in testa."
    },
    "a1Provenance": "Viene ricalcolato ogni giorno a partire da fonti pubbliche, tra cui avvisi di viaggio governativi, il Global Peace Index, l'INFORM Risk Index e indicatori della Banca Mondiale.",
    "a2": {
      "critical": "La principale criticità per {name} riguarda il pilastro {weakest}, il più debole con {weakestScore}/10. {meaning} Il secondo punto debole è il pilastro {second}, con {secondScore}/10, e merita quindi attenzione anch'esso. Per contro, il pilastro {strongest} ottiene {strongestScore}/10 ed è l'area più solida di {name}.",
      "mid": "Nessun singolo fattore emerge come critico per {name}: l'area relativamente più debole è il pilastro {weakest}, con {weakestScore}/10, un valore vicino alla fascia media globale. {meaning} Il suo punto di forza è il pilastro {strongest}, con {strongestScore}/10.",
      "strong": "Nessun pilastro segnala un rischio significativo per {name}: anche l'area più debole, {weakest}, ottiene {weakestScore}/10, ben dentro la fascia di rischio basso, e i cinque pilastri si collocano tra {weakestScore}/10 e {strongestScore}/10. Per chi viaggia questo significa che bastano le normali precauzioni di buon senso."
    },
    "pillarMeaning": {
      "conflict": "Questo pilastro misura conflitti armati, terrorismo e violenza politica: un punteggio basso indica che l'instabilità può incidere sulla sicurezza personale e compromettere i piani di viaggio.",
      "crime": "Questo pilastro riflette crimini violenti, furti e criminalità organizzata: un punteggio basso richiede maggiore attenzione per strada, soprattutto fuori dalle principali zone turistiche.",
      "health": "Questo pilastro copre la qualità dell'assistenza sanitaria, il rischio di malattie e la capacità di risposta alle emergenze: un punteggio basso indica che fuori dalle grandi città può essere difficile ottenere assistenza medica affidabile.",
      "governance": "Questo pilastro valuta lo stato di diritto e l'affidabilità delle istituzioni: un punteggio basso indica che polizia e tribunali potrebbero offrire un aiuto limitato se qualcosa va storto.",
      "environment": "Questo pilastro monitora l'esposizione a rischi naturali come tempeste, alluvioni e terremoti, e quanto il paese sia preparato a farvi fronte."
    },
    "a3Opening": "Sì — l'assicurazione di viaggio è fortemente raccomandata per {name}.",
    "a3Health": {
      "strong": "Il pilastro salute ottiene {healthScore}/10, segno di un sistema sanitario solido; di norma, però, i visitatori pagano comunque di tasca propria, quindi una copertura per le spese mediche e l'annullamento del viaggio resta importante.",
      "mixed": "Il pilastro salute ottiene {healthScore}/10, il che indica un'infrastruttura sanitaria disomogenea — buone cure nelle grandi città, capacità limitata altrove — quindi scegli una polizza che copra le cure d'emergenza e l'evacuazione medica.",
      "weak": "Il pilastro salute ottiene {healthScore}/10, segno di una capacità sanitaria locale limitata: una copertura completa che includa cure d'emergenza, evacuazione medica e rimpatrio è essenziale, non facoltativa."
    },
    "a3Advisory": "Leggi bene anche le clausole della polizza: alcuni governi attualmente sconsigliano i viaggi verso {name} o verso parte del suo territorio, e molte compagnie assicurative annullano la copertura nelle aree interessate da questi avvisi."
  },
  "es": {
    "q1": "Es seguro viajar a {name} en {year}?",
    "q2": "Cual es el mayor riesgo al viajar a {name}?",
    "q3": "Necesito seguro de viaje para {name}?",
    "a1Verdict": {
      "low": "Sí — {name} se considera un destino seguro: a fecha de {monthYear} obtiene {score}/10 en nuestro índice de seguridad diario, clasificado como {riskLevel}.",
      "moderate": "{name} es un destino moderadamente seguro: a fecha de {monthYear} obtiene {score}/10 en nuestro índice de seguridad diario, clasificado como {riskLevel} — la mayoría de los viajes transcurren sin incidentes, pero algunos riesgos merecen atención.",
      "high": "{name} es actualmente un destino de alto riesgo: a fecha de {monthYear} obtiene {score}/10 en nuestro índice de seguridad diario, clasificado como {riskLevel}, y viajar allí exige extremar las precauciones."
    },
    "a1Formula": "La puntuación es una media geométrica ponderada de cinco pilares (conflictos 30%, criminalidad 25%, salud 20%, gobernanza 15%, medio ambiente 10%), de modo que un pilar débil lastra la puntuación global más de lo que un pilar fuerte la eleva.",
    "a1Drivers": {
      "normal": "El resultado de {name} se explica sobre todo por sus áreas más débiles, {weakest} ({weakestScore}/10) y {second} ({secondScore}/10), mientras que su pilar más fuerte es {strongest} ({strongestScore}/10).",
      "allStrong": "Los cinco pilares de {name} obtienen buenas puntuaciones: incluso el más débil, {weakest} ({weakestScore}/10), se sitúa en la franja de riesgo bajo, con {strongest} ({strongestScore}/10) a la cabeza."
    },
    "a1Provenance": "Se recalcula cada día a partir de fuentes públicas, entre ellas los avisos de viaje gubernamentales, el Global Peace Index, el INFORM Risk Index e indicadores del Banco Mundial.",
    "a2": {
      "critical": "La principal preocupación en {name} es {weakest}, su pilar más débil con {weakestScore}/10. {meaning} La segunda área más débil es {second}, con {secondScore}/10, por lo que también merece atención. En cambio, el pilar de {strongest} alcanza {strongestScore}/10 y es el área más fuerte de {name}.",
      "mid": "Ningún factor destaca como crítico en {name}: su área relativamente más débil es {weakest}, con {weakestScore}/10, cerca de la franja media mundial. {meaning} Su pilar más fuerte es {strongest}, con {strongestScore}/10.",
      "strong": "Ningún pilar señala un riesgo significativo en {name}: incluso su área más débil, {weakest}, obtiene {weakestScore}/10, claramente dentro de la franja de riesgo bajo, y sus cinco pilares se mueven entre {weakestScore}/10 y {strongestScore}/10. Para quien viaja, esto significa que bastan las precauciones normales de sentido común."
    },
    "pillarMeaning": {
      "conflict": "Este pilar mide los conflictos armados, el terrorismo y la violencia política — una puntuación baja significa que la inestabilidad puede afectar a la seguridad personal y trastocar los planes de viaje.",
      "crime": "Este pilar refleja los delitos violentos, los robos y la actividad criminal organizada — una puntuación baja exige mayor atención en la calle, sobre todo fuera de las principales zonas turísticas.",
      "health": "Este pilar abarca la calidad de la asistencia sanitaria, el riesgo de enfermedades y la capacidad de respuesta ante emergencias — una puntuación baja significa que puede ser difícil acceder a ayuda médica fiable fuera de las grandes ciudades.",
      "governance": "Este pilar evalúa el Estado de derecho y la fiabilidad de las instituciones — una puntuación baja significa que la policía y los tribunales pueden ofrecer una ayuda limitada si algo sale mal.",
      "environment": "Este pilar registra la exposición a riesgos naturales como tormentas, inundaciones y terremotos, así como el grado de preparación del país para responder a ellos."
    },
    "a3Opening": "Sí — el seguro de viaje es muy recomendable para viajar a {name}.",
    "a3Health": {
      "strong": "Su pilar de salud obtiene {healthScore}/10, señal de un sistema sanitario sólido; aun así, los visitantes suelen tener que pagar la atención de su bolsillo, por lo que sigue siendo importante contar con cobertura de gastos médicos y de cancelación del viaje.",
      "mixed": "Su pilar de salud obtiene {healthScore}/10, lo que apunta a una infraestructura médica desigual (buena atención en las grandes ciudades, capacidad limitada en el resto del país), así que elige una póliza que cubra el tratamiento de urgencia y la evacuación médica.",
      "weak": "Su pilar de salud obtiene {healthScore}/10, lo que significa que la capacidad médica local es limitada: una cobertura completa que incluya atención de urgencia, evacuación médica y repatriación no es opcional, sino imprescindible."
    },
    "a3Advisory": "Revisa también la letra pequeña: algunos gobiernos desaconsejan actualmente viajar a {name} en su totalidad o en parte, y muchas aseguradoras anulan la cobertura en las zonas afectadas por esas advertencias."
  },
  "fr": {
    "q1": "{name} : est-ce sûr d'y voyager en {year} ?",
    "q2": "{name} : quel est le plus grand risque pour les voyageurs ?",
    "q3": "Ai-je besoin d'une assurance voyage pour {name} ?",
    "a1Verdict": {
      "low": "Oui — {name} est une destination considérée comme sûre : en {monthYear}, le pays obtient {score}/10 sur notre indice de sécurité quotidien, dans la catégorie « {riskLevel} ».",
      "moderate": "{name} est une destination modérément sûre : en {monthYear}, le pays obtient {score}/10 sur notre indice de sécurité quotidien, dans la catégorie « {riskLevel} » — la plupart des voyages se déroulent sans encombre, mais certains risques méritent une attention particulière.",
      "high": "{name} est actuellement une destination à haut risque : en {monthYear}, le pays obtient {score}/10 sur notre indice de sécurité quotidien, dans la catégorie « {riskLevel} », et tout voyage exige une grande prudence."
    },
    "a1Formula": "Le score est une moyenne géométrique pondérée de cinq piliers — conflits (30 %), criminalité (25 %), santé (20 %), gouvernance (15 %) et environnement (10 %) — de sorte qu'un pilier faible tire le score global vers le bas plus qu'un pilier fort ne le relève.",
    "a1Drivers": {
      "normal": "{name} doit surtout son résultat à ses domaines les plus faibles, les piliers {weakest} ({weakestScore}/10) et {second} ({secondScore}/10), tandis que le pilier {strongest} ({strongestScore}/10) reste son point le plus solide.",
      "allStrong": "{name} affiche de bons scores sur les cinq piliers : même le plus faible, le pilier {weakest} ({weakestScore}/10), reste dans la zone de faible risque, le pilier {strongest} ({strongestScore}/10) arrivant en tête."
    },
    "a1Provenance": "Il est recalculé chaque jour à partir de sources publiques, dont les avis aux voyageurs gouvernementaux, le Global Peace Index, l'indice de risque INFORM et des indicateurs de la Banque mondiale.",
    "a2": {
      "critical": "{name} présente un point de vigilance majeur : le pilier {weakest}, le plus faible avec {weakestScore}/10. {meaning} Le deuxième domaine le plus fragile est le pilier {second}, à {secondScore}/10 : il mérite donc lui aussi de l'attention. À l'inverse, le pilier {strongest} atteint {strongestScore}/10 : c'est le domaine où {name} est le plus solide.",
      "mid": "{name} ne présente aucun facteur véritablement critique : son domaine relativement le plus faible est le pilier {weakest}, à {weakestScore}/10, un niveau proche de la moyenne mondiale. {meaning} Côté points forts, le pilier {strongest} arrive en tête, à {strongestScore}/10.",
      "strong": "{name} ne présente de risque significatif sur aucun pilier : même son domaine le plus faible, le pilier {weakest}, obtient {weakestScore}/10, bien à l'intérieur de la zone de faible risque, et ses cinq piliers s'échelonnent de {weakestScore}/10 à {strongestScore}/10. Pour les voyageurs, cela signifie que les précautions de bon sens habituelles suffisent."
    },
    "pillarMeaning": {
      "conflict": "Ce pilier mesure les conflits armés, le terrorisme et la violence politique — un score bas signifie que l'instabilité peut affecter la sécurité personnelle et perturber les projets de voyage.",
      "crime": "Ce pilier reflète les crimes violents, les vols et la criminalité organisée — un score bas appelle une vigilance accrue dans la rue, surtout en dehors des principales zones touristiques.",
      "health": "Ce pilier couvre la qualité des soins, le risque de maladies et la capacité de réponse aux urgences — un score bas signifie qu'une aide médicale fiable peut être difficile à trouver en dehors des grandes villes.",
      "governance": "Ce pilier évalue l'état de droit et la fiabilité des institutions — un score bas signifie que la police et la justice peuvent n'offrir qu'une aide limitée en cas de problème.",
      "environment": "Ce pilier suit l'exposition aux risques naturels tels que tempêtes, inondations et séismes, ainsi que le niveau de préparation du pays pour y faire face."
    },
    "a3Opening": "Oui — {name} est une destination pour laquelle une assurance voyage est fortement recommandée.",
    "a3Health": {
      "strong": "Son pilier santé obtient {healthScore}/10, signe d'un système de santé solide ; les visiteurs paient toutefois généralement les soins de leur poche, si bien qu'une couverture des frais médicaux et de l'annulation du voyage reste importante.",
      "mixed": "Son pilier santé obtient {healthScore}/10, signe d'une infrastructure médicale inégale (de bons soins dans les grandes villes, des capacités limitées ailleurs) : choisissez donc un contrat couvrant les soins d'urgence et l'évacuation sanitaire.",
      "weak": "Son pilier santé obtient {healthScore}/10, ce qui signifie que les capacités médicales locales sont limitées : une couverture complète incluant les soins d'urgence, l'évacuation sanitaire et le rapatriement est indispensable, et non facultative."
    },
    "a3Advisory": "Vérifiez aussi les petites lignes du contrat : {name} fait actuellement l'objet, de la part de certains gouvernements, d'avis déconseillant les déplacements vers tout ou partie de son territoire, et de nombreux assureurs excluent toute couverture dans les zones visées par de telles mises en garde."
  },
  "pt": {
    "q1": "E seguro viajar para {name} em {year}?",
    "q2": "Qual e o maior risco ao viajar para {name}?",
    "q3": "Preciso de seguro de viagem para {name}?",
    "a1Verdict": {
      "low": "Sim — {name} é um destino considerado seguro: em {monthYear}, obtém {score}/10 no nosso índice diário de segurança, com classificação de {riskLevel}.",
      "moderate": "{name} é um destino moderadamente seguro: em {monthYear}, obtém {score}/10 no nosso índice diário de segurança, com classificação de {riskLevel} — a maioria das viagens transcorre sem problemas, mas alguns riscos merecem atenção.",
      "high": "{name} é atualmente um destino de alto risco: em {monthYear}, obtém {score}/10 no nosso índice diário de segurança, com classificação de {riskLevel}, e viajar exige muita cautela."
    },
    "a1Formula": "A pontuação é uma média geométrica ponderada de cinco pilares — conflitos (30%), criminalidade (25%), saúde (20%), governança (15%) e meio ambiente (10%) —, de modo que um pilar fraco puxa a pontuação geral para baixo mais do que um pilar forte a eleva.",
    "a1Drivers": {
      "normal": "O resultado de {name} é determinado principalmente por suas áreas mais fracas, {weakest} ({weakestScore}/10) e {second} ({secondScore}/10), enquanto o pilar de {strongest} ({strongestScore}/10) é o mais forte.",
      "allStrong": "Os cinco pilares de {name} apresentam boas pontuações: até o mais fraco, {weakest} ({weakestScore}/10), fica na faixa de risco baixo, com {strongest} ({strongestScore}/10) na liderança."
    },
    "a1Provenance": "Ela é recalculada todos os dias a partir de fontes públicas, incluindo avisos de viagem governamentais, o Global Peace Index, o INFORM Risk Index e indicadores do Banco Mundial.",
    "a2": {
      "critical": "A principal preocupação para {name} é o pilar de {weakest}, o mais fraco do país, com {weakestScore}/10. {meaning} A segunda área mais baixa é a de {second}, com {secondScore}/10, e também merece atenção. Em contrapartida, o pilar de {strongest} obtém {strongestScore}/10 e é a área mais forte de {name}.",
      "mid": "Nenhum fator isolado se destaca como crítico para {name}: sua área relativamente mais fraca é a de {weakest}, com {weakestScore}/10, perto da faixa intermediária global. {meaning} Seu pilar mais forte é o de {strongest}, com {strongestScore}/10.",
      "strong": "Nenhum pilar indica um risco significativo para {name}: até sua área mais fraca, a de {weakest}, obtém {weakestScore}/10, bem dentro da faixa de risco baixo, e os cinco pilares variam de {weakestScore}/10 a {strongestScore}/10. Para quem viaja, isso significa que as precauções normais de bom senso são suficientes."
    },
    "pillarMeaning": {
      "conflict": "Esse pilar mede conflitos armados, terrorismo e violência política — uma pontuação baixa significa que a instabilidade pode afetar a segurança pessoal e atrapalhar os planos de viagem.",
      "crime": "Esse pilar reflete crimes violentos, furtos e atividade do crime organizado — uma pontuação baixa exige atenção redobrada nas ruas, especialmente fora das principais áreas turísticas.",
      "health": "Esse pilar abrange a qualidade dos serviços de saúde, o risco de doenças e a capacidade de resposta a emergências — uma pontuação baixa significa que pode ser difícil encontrar atendimento médico confiável fora das grandes cidades.",
      "governance": "Esse pilar avalia o Estado de Direito e a confiabilidade das instituições — uma pontuação baixa significa que a polícia e a justiça podem oferecer ajuda limitada se algo der errado.",
      "environment": "Esse pilar acompanha a exposição a riscos naturais como tempestades, enchentes e terremotos, além do grau de preparo do país para responder a eles."
    },
    "a3Opening": "Sim — o seguro viagem é fortemente recomendado para {name}.",
    "a3Health": {
      "strong": "O pilar de saúde obtém {healthScore}/10, o que indica um sistema de saúde sólido; ainda assim, visitantes geralmente pagam do próprio bolso, então a cobertura de despesas médicas e de cancelamento de viagem continua importante.",
      "mixed": "O pilar de saúde obtém {healthScore}/10, o que aponta para uma infraestrutura médica desigual — bom atendimento nas grandes cidades, capacidade limitada no restante do país —, então escolha uma apólice que cubra tratamento de emergência e evacuação médica.",
      "weak": "O pilar de saúde obtém {healthScore}/10, o que significa que a capacidade médica local é limitada: uma cobertura abrangente, incluindo atendimento de emergência, evacuação médica e repatriação, é essencial, e não opcional."
    },
    "a3Advisory": "Verifique também as letras miúdas: alguns governos atualmente desaconselham viagens a todo o território de {name} ou a parte dele, e muitas seguradoras anulam a cobertura em áreas sob esse tipo de alerta."
  },
  "zh": {
    "q1": "{year} 年前往 {name} 旅行安全吗？",
    "q2": "前往 {name} 旅行的最大风险是什么？",
    "q3": "前往 {name} 需要旅行保险吗？",
    "a1Verdict": {
      "low": "是的——{name}被认为是一个安全的旅行目的地：截至{monthYear}，其在我们每日更新的安全指数中得分为 {score}/10，被评为{riskLevel}。",
      "moderate": "{name}的安全状况处于中等水平：截至{monthYear}，其在我们每日更新的安全指数中得分为 {score}/10，被评为{riskLevel}——大多数行程都能顺利完成，但部分风险值得留意。",
      "high": "{name}目前属于高风险目的地：截至{monthYear}，其在我们每日更新的安全指数中得分为 {score}/10，被评为{riskLevel}，前往旅行需要格外谨慎。"
    },
    "a1Formula": "该评分是五大支柱——冲突（30%）、犯罪（25%）、健康（20%）、治理（15%）和环境（10%）——的加权几何平均数，因此薄弱支柱对总分的拉低作用大于强势支柱的提升作用。",
    "a1Drivers": {
      "normal": "{name}的评分主要受其两个最薄弱领域的影响，即{weakest}（{weakestScore}/10）和{second}（{secondScore}/10），而{strongest}（{strongestScore}/10）则是其表现最强的支柱。",
      "allStrong": "{name}的五大支柱均表现良好：即使是得分最低的{weakest}（{weakestScore}/10）也处于低风险区间，其中以{strongest}（{strongestScore}/10）表现最为突出。"
    },
    "a1Provenance": "评分每天都会根据公开数据源重新计算，其中包括各国政府旅行警告、全球和平指数（Global Peace Index）、INFORM 风险指数（INFORM Risk Index）以及世界银行指标。",
    "a2": {
      "critical": "{name}最需要关注的是{weakest}，这一支柱得分最低，仅为 {weakestScore}/10。{meaning}得分第二低的领域是{second}（{secondScore}/10），同样值得留意。相比之下，{strongest}得分为 {strongestScore}/10，是{name}表现最强的领域。",
      "mid": "对{name}而言，没有任何单一因素构成突出风险：其相对最薄弱的领域是{weakest}，得分为 {weakestScore}/10，接近全球中等水平。{meaning}其表现最强的支柱是{strongest}，得分为 {strongestScore}/10。",
      "strong": "{name}的各项支柱均未显示出明显风险：即使是其最薄弱的领域{weakest}也得到了 {weakestScore}/10 的分数，稳居低风险区间，五大支柱的得分介于 {weakestScore}/10 到 {strongestScore}/10 之间。对旅行者而言，这意味着只需采取常规的常识性预防措施即可。"
    },
    "pillarMeaning": {
      "conflict": "该支柱衡量武装冲突、恐怖主义和政治暴力——得分较低意味着局势不稳可能危及人身安全并打乱旅行计划。",
      "crime": "该支柱反映暴力犯罪、盗窃和有组织犯罪活动——得分较低意味着需要在街头提高警惕，尤其是在主要旅游区之外。",
      "health": "该支柱涵盖医疗服务质量、疾病风险和应急响应能力——得分较低意味着在大城市之外可能难以获得可靠的医疗救助。",
      "governance": "该支柱评估法治水平和公共机构的可靠程度——得分较低意味着一旦出现问题，警方和法院可能只能提供有限的帮助。",
      "environment": "该支柱追踪该国面临风暴、洪水和地震等自然灾害的风险程度，以及其应对这些灾害的准备水平。"
    },
    "a3Opening": "是的——强烈建议为前往{name}的行程购买旅行保险。",
    "a3Health": {
      "strong": "其健康支柱得分为 {healthScore}/10，表明医疗体系较为健全；不过就诊时游客通常仍需自行垫付费用，因此涵盖医疗费用和行程取消的保障依然重要。",
      "mixed": "其健康支柱得分为 {healthScore}/10，反映出医疗基础设施水平参差不齐——大城市医疗条件良好，其他地区救治能力有限——因此请选择涵盖紧急救治和医疗转运的保单。",
      "weak": "其健康支柱得分为 {healthScore}/10，意味着当地医疗能力有限：涵盖紧急救治、医疗转运和送返回国的全面保障不是可选项，而是必需品。"
    },
    "a3Advisory": "另外请仔细阅读保险条款：部分国家政府目前建议避免前往{name}的全部或部分地区，而许多保险公司会将处于此类警告之下的地区排除在保障范围之外。"
  },
  "de": {
    "q1": "Ist es {year} sicher, nach {name} zu reisen?",
    "q2": "Was ist das größte Risiko bei einer Reise nach {name}?",
    "q3": "Brauche ich eine Reiseversicherung für {name}?",
    "a1Verdict": {
      "low": "Ja — {name} gilt als sicheres Reiseziel: Stand {monthYear} erreicht das Land {score}/10 auf unserem täglich aktualisierten Sicherheitsindex und ist als {riskLevel} eingestuft.",
      "moderate": "{name} ist moderat sicher: Stand {monthYear} erreicht das Land {score}/10 auf unserem täglich aktualisierten Sicherheitsindex und ist als {riskLevel} eingestuft — die meisten Reisen verlaufen problemlos, einige Risiken verdienen jedoch Aufmerksamkeit.",
      "high": "{name} ist derzeit ein Hochrisiko-Reiseziel: Stand {monthYear} erreicht das Land {score}/10 auf unserem täglich aktualisierten Sicherheitsindex, ist als {riskLevel} eingestuft, und Reisen dorthin erfordern erhebliche Vorsicht."
    },
    "a1Formula": "Der Wert ist ein gewichtetes geometrisches Mittel aus fünf Säulen — Konflikt (30 %), Kriminalität (25 %), Gesundheit (20 %), Regierungsführung (15 %) und Umwelt (10 %) —, sodass eine schwache Säule den Gesamtwert stärker nach unten zieht, als eine starke ihn anhebt.",
    "a1Drivers": {
      "normal": "{name} verdankt dieses Ergebnis vor allem den schwächsten Bereichen — {weakest} ({weakestScore}/10) und {second} ({secondScore}/10) —, während {strongest} ({strongestScore}/10) die stärkste Säule des Landes bildet.",
      "allStrong": "{name} schneidet in allen fünf Säulen gut ab: Selbst die schwächste Säule, {weakest} ({weakestScore}/10), liegt im risikoarmen Bereich, während {strongest} ({strongestScore}/10) an der Spitze steht."
    },
    "a1Provenance": "Der Wert wird jeden Tag aus öffentlichen Quellen neu berechnet, darunter staatliche Reisehinweise, der Global Peace Index, der INFORM Risk Index und Indikatoren der Weltbank.",
    "a2": {
      "critical": "Die größte Sorge für {name} ist die Säule {weakest} — mit {weakestScore}/10 die schwächste des Landes. {meaning} Der zweitschwächste Bereich ist {second} mit {secondScore}/10 und verdient daher ebenfalls Aufmerksamkeit. Im Gegensatz dazu kommt {strongest} auf {strongestScore}/10 — in diesem Bereich ist {name} am stärksten.",
      "mid": "Für {name} sticht kein einzelner Faktor als kritisch hervor: Die vergleichsweise schwächste Säule ist {weakest} mit {weakestScore}/10 und liegt damit nahe am globalen Mittelfeld. {meaning} Die stärkste Säule des Landes ist {strongest} mit {strongestScore}/10.",
      "strong": "Keine Säule signalisiert für {name} ein nennenswertes Risiko: Selbst die schwächste Säule, {weakest}, erreicht {weakestScore}/10 und liegt damit klar im risikoarmen Bereich, und insgesamt bewegen sich die fünf Säulen zwischen {weakestScore}/10 und {strongestScore}/10. Für Reisende bedeutet das: Normale, vernünftige Vorsichtsmaßnahmen genügen."
    },
    "pillarMeaning": {
      "conflict": "Diese Säule misst bewaffnete Konflikte, Terrorismus und politische Gewalt — ein niedriger Wert bedeutet, dass Instabilität die persönliche Sicherheit beeinträchtigen und Reisepläne durchkreuzen kann.",
      "crime": "Diese Säule bildet Gewaltkriminalität, Diebstahl und organisierte Kriminalität ab — ein niedriger Wert verlangt erhöhte Wachsamkeit unterwegs, besonders außerhalb der wichtigsten Touristengebiete.",
      "health": "Diese Säule umfasst die Qualität der Gesundheitsversorgung, Krankheitsrisiken und die Kapazitäten der Notfallhilfe — ein niedriger Wert bedeutet, dass verlässliche medizinische Hilfe außerhalb der großen Städte schwer zu erreichen sein kann.",
      "governance": "Diese Säule bewertet die Rechtsstaatlichkeit und die Verlässlichkeit der Institutionen — ein niedriger Wert bedeutet, dass Polizei und Gerichte nur begrenzt helfen können, wenn etwas schiefgeht.",
      "environment": "Diese Säule erfasst die Exposition gegenüber Naturgefahren wie Stürmen, Überschwemmungen und Erdbeben — und wie gut das Land auf solche Ereignisse vorbereitet ist."
    },
    "a3Opening": "Ja — eine Reiseversicherung wird für {name} dringend empfohlen.",
    "a3Health": {
      "strong": "Die Säule Gesundheit erreicht {healthScore}/10 und deutet damit auf ein solides Gesundheitssystem hin; Besucher zahlen jedoch in der Regel aus eigener Tasche, weshalb eine Absicherung von Behandlungskosten und Reiserücktritt weiterhin wichtig ist.",
      "mixed": "Die Säule Gesundheit liegt bei {healthScore}/10, was auf eine ungleiche medizinische Infrastruktur hindeutet — gute Versorgung in den Großstädten, begrenzte Kapazitäten anderswo —, weshalb die Police unbedingt Notfallbehandlungen und medizinische Evakuierung abdecken sollte.",
      "weak": "Die Säule Gesundheit erreicht {healthScore}/10, die medizinischen Kapazitäten vor Ort sind also begrenzt: Ein umfassender Schutz einschließlich Notfallversorgung, medizinischer Evakuierung und Rücktransport ist hier kein optionales Extra, sondern unverzichtbar."
    },
    "a3Advisory": "Prüfen Sie außerdem das Kleingedruckte: Einige Regierungen raten derzeit von Reisen nach {name} oder in einzelne Landesteile ab, und viele Versicherer schließen den Versicherungsschutz in Gebieten mit solchen Warnungen aus."
  }
};
