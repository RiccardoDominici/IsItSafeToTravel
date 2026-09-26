/**
 * Copy for the /community-vs-data/ page (route key `community-vs-data`), all 7 locales.
 *
 * WHY this lives here instead of ui.ts: same reasoning as about-copy.ts — this
 * is a brand-new feature page with a lot of copy, and ui.ts is a merge hot spot
 * several other workstreams are editing this same round (2026-09-26 visibility-
 * pages batch). A fresh module avoids all of that churn.
 *
 * Grammar note (IMPORTANT for translators/editors): the headline and gap-chip
 * templates deliberately avoid any adjective that would need to agree in
 * gender/number with the country name ("plus sûr(e)(s)", "más segura(s)",
 * "più sicuro/a/i/e"...) — country-grammar.ts exists precisely because that
 * class of bug is easy to introduce and easy to miss (see its docstring). This
 * module sidesteps it entirely by phrasing the comparison as a direction
 * relative to a place ("above/below our score") rather than as an adjective
 * modifying the country ("safer than our score") in every locale except
 * English, where "safer"/"less safe" carries no agreement at all. The pillar
 * driver sentence has the same property for a different reason: it names a
 * PILLAR, never the country, so no agreement risk exists there in any locale.
 *
 * Every {token} is resolved by CommunityVsDataPage.astro with a plain
 * String.replace — same convention as about-copy.ts / AnswerFirstParagraph.astro.
 * countryNoun.one/other lets callers pick the grammatically correct number for
 * "{count} countries" in the few languages that inflect it (see pickCountryNoun
 * below); votesLabel has no singular form because MIN_VOTE_FLOOR (5) means a
 * displayed entry never has fewer than 5 votes — see src/lib/sentiment.ts.
 */
import type { Lang } from './ui';
import type { PillarName } from '../pipeline/types';

export interface CommunityVsDataCopy {
  /** <title> / breadcrumb current-page crumb / <h1> (one field, like HubPageLayout's `title`). */
  title: string;
  /** Meta description, ~120-160 chars in latin-script locales. */
  description: string;

  introLead: string;

  /** {name} {gap} {count} {countryNoun} — community rates the country SAFER than our score. */
  headlineSafer: string;
  /** {name} {gap} {count} {countryNoun} — community rates the country LESS SAFE than our score. */
  headlineLessSafe: string;
  /** {date} */
  dataAsOf: string;

  rankingTitle: string;
  ourScoreLabel: string;
  communityScoreLabel: string;
  /** {gap} — short, prominent per-row chip. */
  gapChipSafer: string;
  /** {gap} */
  gapChipLessSafe: string;
  /**
   * Shown instead of a signed chip when |gap| rounds to 0.0 — same guard as
   * ScoreHero.astro's `Math.abs(scoreDelta.delta) >= 0.05` (2026-09-25 audit,
   * V4: a rounded "+0.0"/"−0.0" reads as a rendering bug, not information).
   */
  gapChipNeutral: string;
  /** {count} — always plural-safe, see file header. */
  votesLabel: string;

  /** {pillar} {score} {note} — one sentence naming the weakest pillar behind OUR score (not the gap). */
  driverTemplate: string;
  /** Fallback when the five pillars are within pillar-extremes.ts's NEAR_TIE_SPREAD of each other. */
  driverNeutral: string;
  /** Per-pillar closing clause slotted into {note} above. */
  pillarNote: Record<PillarName, string>;

  /** Shown instead of the ranking when zero countries currently clear MIN_VOTE_FLOOR. */
  emptyStateTitle: string;
  /** {floor} */
  emptyStateBody: string;

  /** Shown below the ranking whenever fewer than 10 countries qualify. */
  growingTitle: string;
  /** {floor} {count} {countryNoun} */
  growingBody: string;
  /** Small label above the suggested-country links grid (not a full heading). */
  suggestedLabel: string;
  /** {name} — link text for each suggested country. */
  voteLinkText: string;

  howToReadTitle: string;
  howToReadP1: string;
  howToReadP2: string;
  howToReadP3: string;

  /** {link} token — split around the methodology page anchor. */
  methodologyText: string;
  methodologyLinkText: string;

  countryNoun: { one: string; other: string };
}

/** Picks the grammatically correct noun form for a count — see file header. */
export function pickCountryNoun(count: number, noun: { one: string; other: string }): string {
  return count === 1 ? noun.one : noun.other;
}

export const communityVsDataCopy: Record<Lang, CommunityVsDataCopy> = {
  en: {
    title: 'Community vs. Data: How Travelers Rate Country Safety',
    description:
      "See where travelers' real-world experience and our data-driven safety score diverge most, and by how much, for every country with enough votes to be meaningful.",
    introLead:
      'Our safety scores are built from government travel advisories, conflict and crime data, and other structural indicators. But people who have actually been somewhere sometimes see it differently. Every country page invites travelers to say whether our score feels right — this page lines up their answers against our data, for every country with enough votes to be meaningful.',
    headlineSafer:
      'Travelers rate {name} {gap} points safer than our data — the widest gap among the {count} {countryNoun} with enough votes so far.',
    headlineLessSafe:
      'Travelers rate {name} {gap} points less safe than our data — the widest gap among the {count} {countryNoun} with enough votes so far.',
    dataAsOf: 'Data as of {date}.',
    rankingTitle: 'Countries Ranked by Gap',
    ourScoreLabel: 'Our score',
    communityScoreLabel: 'Community score',
    gapChipSafer: '{gap} safer, per travelers',
    gapChipLessSafe: '{gap} less safe, per travelers',
    gapChipNeutral: 'Matches our score',
    votesLabel: '{count} votes',
    driverTemplate: 'Our score is held down most by {pillar} ({score}/10) — {note}.',
    driverNeutral: "This country's five safety pillars are closely matched, with none standing out as the main driver.",
    pillarNote: {
      conflict: "a risk that's easy to miss unless it flares up during your exact travel dates",
      crime: 'a pattern residents notice more than someone just passing through',
      health: 'a system most travelers only really put to the test if something goes wrong',
      governance: 'a structural weakness that rarely surfaces on an ordinary short trip',
      environment: 'a hazard whose impact depends more on timing than on the destination itself',
    },
    emptyStateTitle: 'Not enough votes yet',
    emptyStateBody:
      "No country has reached {floor} votes yet, so there's nothing to rank here yet — but every country page has a quick voting widget, and the first countries to cross the line will appear here automatically.",
    growingTitle: 'More countries are joining',
    growingBody:
      "A country only appears in this ranking once at least {floor} people have voted on its safety score — enough for the average to mean something. Right now that's {count} {countryNoun}. Help the list grow:",
    suggestedLabel: 'Popular destinations waiting for your vote',
    voteLinkText: 'Vote on {name} →',
    howToReadTitle: 'How to Read This Page',
    howToReadP1:
      '"Our score" is the data-driven number you see on every country page: a composite of conflict, crime, health, governance and environment indicators, recomputed daily. "Community score" is what you get once we fold in what travelers tell us: each vote is a slider between "much less safe" and "much safer" than our score, saved as a signed adjustment.',
    howToReadP2:
      "We don't just average every vote equally. Newer votes count a little more than older ones — their weight fades on roughly a one-month half-life — and however strong the collective opinion, it can only move the score by at most 1 point in either direction. That cap keeps a handful of very vocal votes from swamping a number meant to reflect broad, verified data.",
    howToReadP3:
      'A gap between the two is genuinely useful information: our score weighs structural risk indicators a short trip may never touch, while travelers report what daily life actually felt like — including things no dataset fully captures, and occasionally one loud trip report more than a broad pattern. Neither number is "the truth" by itself; read together, they tell you more than either one alone.',
    methodologyText: 'Curious how the data-driven score is actually built? Read our {link}.',
    methodologyLinkText: 'full methodology',
    countryNoun: { one: 'country', other: 'countries' },
  },
  it: {
    title: 'Community vs. Dati: Come i Viaggiatori Giudicano i Paesi',
    description:
      'Confrontiamo il nostro punteggio di sicurezza basato sui dati con il giudizio reale dei viaggiatori, paese per paese, per ogni destinazione con voti sufficienti.',
    introLead:
      'I nostri punteggi di sicurezza si basano su avvisi di viaggio governativi, dati su conflitti e criminalità e altri indicatori strutturali. Ma chi è stato davvero in un posto a volte lo vede in modo diverso. Ogni pagina paese chiede ai viaggiatori se il nostro punteggio corrisponde alla realtà: qui confrontiamo le loro risposte con i nostri dati, per ogni paese con voti sufficienti a essere significativo.',
    headlineSafer:
      'I voti della community collocano {name} {gap} punti sopra il nostro punteggio — il distacco più ampio tra i {count} {countryNoun} con voti sufficienti finora.',
    headlineLessSafe:
      'I voti della community collocano {name} {gap} punti sotto il nostro punteggio — il distacco più ampio tra i {count} {countryNoun} con voti sufficienti finora.',
    dataAsOf: 'Dati aggiornati al {date}.',
    rankingTitle: 'Paesi in Classifica per Divario',
    ourScoreLabel: 'Il nostro punteggio',
    communityScoreLabel: 'Punteggio della community',
    gapChipSafer: '{gap} sopra il punteggio',
    gapChipLessSafe: '{gap} sotto il punteggio',
    gapChipNeutral: 'In linea con i nostri dati',
    votesLabel: '{count} voti',
    driverTemplate: 'Il nostro punteggio è frenato soprattutto da {pillar} ({score}/10) — {note}.',
    driverNeutral: 'I cinque pilastri di sicurezza di questo paese sono molto simili tra loro, senza che nessuno emerga come fattore principale.',
    pillarNote: {
      conflict: 'un rischio facile da non notare, a meno che non si intensifichi proprio nei giorni del tuo viaggio',
      crime: 'una dinamica che chi vive sul posto nota più di chi è solo di passaggio',
      health: 'un sistema che la maggior parte dei viaggiatori mette alla prova solo se qualcosa va storto',
      governance: 'una debolezza strutturale che raramente emerge in un breve viaggio ordinario',
      environment: "un rischio il cui impatto dipende più dal momento del viaggio che dalla destinazione in sé",
    },
    emptyStateTitle: 'Non ci sono ancora abbastanza voti',
    emptyStateBody:
      "Nessun paese ha ancora raggiunto {floor} voti, quindi per ora non c'è nulla da classificare — ma ogni pagina paese ha un piccolo strumento di voto, e i primi paesi a superare la soglia compariranno qui automaticamente.",
    growingTitle: 'Altri paesi si aggiungeranno presto',
    growingBody:
      "Un paese entra in questa classifica solo dopo aver raccolto almeno {floor} voti sul suo punteggio di sicurezza — abbastanza perché la media abbia senso. Al momento sono {count} {countryNoun}. Aiuta la lista a crescere:",
    suggestedLabel: 'Destinazioni popolari in attesa del tuo voto',
    voteLinkText: 'Vota {name} →',
    howToReadTitle: 'Come Leggere Questa Pagina',
    howToReadP1:
      '«Il nostro punteggio» è il numero basato sui dati che vedi su ogni pagina paese: un composito di indicatori su conflitti, criminalità, salute, governance e ambiente, ricalcolato ogni giorno. «Il punteggio della community» nasce quando vi aggiungiamo ciò che dicono i viaggiatori: ogni voto è un cursore tra «molto meno sicuro» e «molto più sicuro» del nostro punteggio, registrato come una correzione con segno.',
    howToReadP2:
      "Non facciamo una semplice media di tutti i voti. I voti più recenti contano un po' di più di quelli vecchi — il loro peso si dimezza all'incirca ogni mese — e per quanto forte sia l'opinione collettiva, può spostare il punteggio al massimo di 1 punto in una direzione o nell'altra. Questo limite evita che un piccolo gruppo di voti molto convinti stravolga un numero che deve riflettere dati ampi e verificati.",
    howToReadP3:
      'Uno scarto tra i due numeri è di per sé un\'informazione utile: il nostro punteggio pesa indicatori di rischio strutturale che un viaggio breve può non incontrare mai, mentre i viaggiatori raccontano com\'è davvero la vita quotidiana sul posto — comprese cose che nessun dataset coglie del tutto, e talvolta anche il racconto isolato di un singolo viaggio più che una tendenza diffusa. Nessuno dei due numeri è «la verità» da solo: letti insieme, dicono più di quanto direbbe ciascuno per conto proprio.',
    methodologyText: 'Curioso di sapere come viene calcolato il punteggio basato sui dati? Leggi la nostra {link}.',
    methodologyLinkText: 'metodologia completa',
    countryNoun: { one: 'paese', other: 'paesi' },
  },
  es: {
    title: 'Community vs. Datos: Cómo Valoran los Viajeros Cada País',
    description:
      'Comparamos nuestra puntuación de seguridad basada en datos con la opinión real de los viajeros, país por país, para cada destino con votos suficientes.',
    introLead:
      'Nuestras puntuaciones de seguridad se construyen a partir de avisos de viaje gubernamentales, datos de conflictos y criminalidad, y otros indicadores estructurales. Pero quien ha estado realmente en un lugar a veces lo ve de otra manera. Cada página de país invita a los viajeros a decir si nuestra puntuación les parece acertada — esta página compara sus respuestas con nuestros datos, para cada país con votos suficientes para ser significativos.',
    headlineSafer:
      'Los votos de la comunidad sitúan a {name} {gap} puntos por encima de nuestra puntuación — la mayor diferencia entre los {count} {countryNoun} con votos suficientes hasta ahora.',
    headlineLessSafe:
      'Los votos de la comunidad sitúan a {name} {gap} puntos por debajo de nuestra puntuación — la mayor diferencia entre los {count} {countryNoun} con votos suficientes hasta ahora.',
    dataAsOf: 'Datos actualizados a fecha de {date}.',
    rankingTitle: 'Países Clasificados por Diferencia',
    ourScoreLabel: 'Nuestra puntuación',
    communityScoreLabel: 'Puntuación de la comunidad',
    gapChipSafer: '{gap} por encima',
    gapChipLessSafe: '{gap} por debajo',
    gapChipNeutral: 'Coincide con nuestros datos',
    votesLabel: '{count} votos',
    driverTemplate: 'Nuestra puntuación se ve más lastrada por {pillar} ({score}/10) — {note}.',
    driverNeutral: 'Los cinco pilares de seguridad de este país están muy igualados, sin que ninguno destaque como factor principal.',
    pillarNote: {
      conflict: 'un riesgo fácil de pasar por alto, salvo que se intensifique justo en tus fechas de viaje',
      crime: 'una dinámica que los residentes notan más que quien solo está de paso',
      health: 'un sistema que la mayoría de los viajeros solo pone a prueba si algo sale mal',
      governance: 'una debilidad estructural que rara vez se nota en un viaje corto y corriente',
      environment: 'un riesgo cuyo impacto depende más del momento del viaje que del destino en sí',
    },
    emptyStateTitle: 'Todavía no hay suficientes votos',
    emptyStateBody:
      'Ningún país ha alcanzado aún {floor} votos, así que por ahora no hay nada que clasificar — pero cada página de país tiene una pequeña herramienta de voto, y los primeros países en superar el umbral aparecerán aquí automáticamente.',
    growingTitle: 'Más países se sumarán pronto',
    growingBody:
      'Un país solo aparece en esta clasificación cuando ha reunido al menos {floor} votos sobre su puntuación de seguridad — suficientes para que la media tenga sentido. Ahora mismo son {count} {countryNoun}. Ayuda a que la lista crezca:',
    suggestedLabel: 'Destinos populares que esperan tu voto',
    voteLinkText: 'Vota por {name} →',
    howToReadTitle: 'Cómo Leer Esta Página',
    howToReadP1:
      '«Nuestra puntuación» es el número basado en datos que ves en cada página de país: un compuesto de indicadores de conflicto, criminalidad, salud, gobernanza y medio ambiente, recalculado cada día. «La puntuación de la comunidad» surge cuando incorporamos lo que dicen los viajeros: cada voto es un control deslizante entre «mucho menos seguro» y «mucho más seguro» que nuestra puntuación, guardado como un ajuste con signo.',
    howToReadP2:
      'No calculamos una media simple de todos los votos. Los votos más recientes cuentan algo más que los antiguos — su peso se reduce a la mitad cada mes, aproximadamente —, y por fuerte que sea la opinión colectiva, solo puede mover la puntuación como máximo 1 punto en cualquier dirección. Ese límite evita que un puñado de votos muy vehementes desborde un número que debe reflejar datos amplios y verificados.',
    howToReadP3:
      'Una diferencia entre ambos números ya es, en sí misma, información útil: nuestra puntuación pondera indicadores de riesgo estructural que un viaje corto puede no llegar a rozar nunca, mientras que los viajeros cuentan cómo fue de verdad el día a día — incluidas cosas que ningún conjunto de datos capta del todo, y a veces también el relato aislado de un solo viaje más que una tendencia amplia. Ninguno de los dos números es «la verdad» por sí solo: leídos juntos, dicen más que cualquiera de ellos por separado.',
    methodologyText: '¿Tienes curiosidad por saber cómo se calcula la puntuación basada en datos? Lee nuestra {link}.',
    methodologyLinkText: 'metodología completa',
    countryNoun: { one: 'país', other: 'países' },
  },
  fr: {
    title: "Communauté vs Données : l'Avis des Voyageurs sur la Sécurité",
    description:
      "Nous comparons notre score de sécurité fondé sur les données à l'avis réel des voyageurs, pays par pays, pour chaque destination ayant assez de votes.",
    introLead:
      "Nos scores de sécurité reposent sur les avis de voyage gouvernementaux, des données de conflit et de criminalité, et d'autres indicateurs structurels. Mais ceux qui sont réellement allés quelque part le voient parfois autrement. Chaque page pays invite les voyageurs à dire si notre score leur semble juste — cette page compare leurs réponses à nos données, pour chaque pays ayant assez de votes pour être significatif.",
    headlineSafer:
      'Les votes de la communauté placent {name} {gap} points au-dessus de notre score — le plus grand écart parmi les {count} {countryNoun} ayant assez de votes à ce jour.',
    headlineLessSafe:
      'Les votes de la communauté placent {name} {gap} points en dessous de notre score — le plus grand écart parmi les {count} {countryNoun} ayant assez de votes à ce jour.',
    dataAsOf: 'Données à jour au {date}.',
    rankingTitle: 'Pays Classés par Écart',
    ourScoreLabel: 'Notre score',
    communityScoreLabel: 'Score de la communauté',
    gapChipSafer: '{gap} au-dessus',
    gapChipLessSafe: '{gap} en dessous',
    gapChipNeutral: 'Conforme à nos données',
    votesLabel: '{count} votes',
    driverTemplate: 'Notre score est surtout tiré vers le bas par {pillar} ({score}/10) — {note}.',
    driverNeutral: "Les cinq piliers de sécurité de ce pays sont très proches les uns des autres, sans qu'aucun ne se distingue comme facteur principal.",
    pillarNote: {
      conflict: "un risque facile à manquer, sauf s'il s'intensifie précisément pendant votre séjour",
      crime: 'une réalité que les résidents remarquent plus qu\'un visiteur de passage',
      health: 'un système que la plupart des voyageurs ne testent vraiment qu\'en cas de pépin',
      governance: 'une faiblesse structurelle qui se manifeste rarement lors d\'un court séjour ordinaire',
      environment: "un risque dont l'impact dépend plus de la période du voyage que de la destination elle-même",
    },
    emptyStateTitle: 'Pas encore assez de votes',
    emptyStateBody:
      "Aucun pays n'a encore atteint {floor} votes, donc il n'y a rien à classer pour l'instant — mais chaque page pays propose un petit outil de vote, et les premiers pays à franchir ce seuil apparaîtront ici automatiquement.",
    growingTitle: "D'autres pays vont bientôt s'ajouter",
    growingBody:
      "Un pays n'apparaît dans ce classement qu'après avoir réuni au moins {floor} votes sur son score de sécurité — assez pour que la moyenne ait un sens. Ce sont pour l'instant {count} {countryNoun}. Aidez la liste à s'allonger :",
    suggestedLabel: 'Destinations populaires en attente de votre vote',
    voteLinkText: 'Votez pour {name} →',
    howToReadTitle: 'Comment Lire Cette Page',
    howToReadP1:
      '« Notre score » est le chiffre fondé sur les données que vous voyez sur chaque page pays : un composite d\'indicateurs de conflit, de criminalité, de santé, de gouvernance et d\'environnement, recalculé chaque jour. « Le score de la communauté » apparaît quand nous y ajoutons ce que disent les voyageurs : chaque vote est un curseur entre « bien moins sûr » et « bien plus sûr » que notre score, enregistré comme un ajustement signé.',
    howToReadP2:
      "Nous ne faisons pas une simple moyenne de tous les votes. Les votes récents comptent un peu plus que les anciens — leur poids diminue de moitié environ tous les mois —, et aussi forte soit l'opinion collective, elle ne peut déplacer le score que d'au plus 1 point, dans un sens ou dans l'autre. Ce plafond évite qu'une poignée de votes très tranchés ne submerge un chiffre censé refléter des données larges et vérifiées.",
    howToReadP3:
      "Un écart entre les deux chiffres est en soi une information utile : notre score pèse des indicateurs de risque structurel qu'un court séjour ne croisera peut-être jamais, tandis que les voyageurs racontent ce que le quotidien sur place a vraiment été — y compris des choses qu'aucun jeu de données ne capture entièrement, et parfois aussi le récit isolé d'un seul voyage plus qu'une tendance de fond. Aucun des deux chiffres n'est « la vérité » à lui seul : lus ensemble, ils en disent plus que chacun pris séparément.",
    methodologyText: 'Curieux de savoir comment le score fondé sur les données est calculé ? Lisez notre {link}.',
    methodologyLinkText: 'méthodologie complète',
    countryNoun: { one: 'pays', other: 'pays' },
  },
  pt: {
    title: 'Comunidade vs. Dados: Como os Viajantes Avaliam Cada País',
    description:
      'Comparamos a nossa pontuação de segurança baseada em dados com a opinião real dos viajantes, país a país, para cada destino com votos suficientes.',
    introLead:
      'As nossas pontuações de segurança são construídas a partir de avisos de viagem governamentais, dados de conflito e criminalidade, e outros indicadores estruturais. Mas quem já esteve mesmo num lugar às vezes vê as coisas de outra forma. Cada página de país convida os viajantes a dizer se a nossa pontuação parece correta — esta página compara as respostas deles com os nossos dados, para cada país com votos suficientes para serem significativos.',
    headlineSafer:
      'Os votos da comunidade colocam {name} {gap} pontos acima da nossa pontuação — a maior diferença entre os {count} {countryNoun} com votos suficientes até agora.',
    headlineLessSafe:
      'Os votos da comunidade colocam {name} {gap} pontos abaixo da nossa pontuação — a maior diferença entre os {count} {countryNoun} com votos suficientes até agora.',
    dataAsOf: 'Dados atualizados em {date}.',
    rankingTitle: 'Países Classificados por Diferença',
    ourScoreLabel: 'Nossa pontuação',
    communityScoreLabel: 'Pontuação da comunidade',
    gapChipSafer: '{gap} acima',
    gapChipLessSafe: '{gap} abaixo',
    gapChipNeutral: 'Alinhado com os nossos dados',
    votesLabel: '{count} votos',
    driverTemplate: 'Nossa pontuação é mais puxada para baixo por {pillar} ({score}/10) — {note}.',
    driverNeutral: 'Os cinco pilares de segurança deste país estão muito equilibrados entre si, sem que nenhum se destaque como fator principal.',
    pillarNote: {
      conflict: 'um risco fácil de não perceber, a menos que se intensifique justo nas suas datas de viagem',
      crime: 'uma dinâmica que os moradores notam mais do que quem está só de passagem',
      health: 'um sistema que a maioria dos viajantes só testa de fato se algo der errado',
      governance: 'uma fragilidade estrutural que raramente aparece numa viagem curta e comum',
      environment: 'um risco cujo impacto depende mais da época da viagem do que do destino em si',
    },
    emptyStateTitle: 'Ainda não há votos suficientes',
    emptyStateBody:
      'Nenhum país atingiu ainda {floor} votos, por isso não há nada para classificar por aqui — mas cada página de país tem uma pequena ferramenta de voto, e os primeiros países a ultrapassar esse limite aparecerão aqui automaticamente.',
    growingTitle: 'Mais países vão entrar em breve',
    growingBody:
      'Um país só aparece neste ranking depois de reunir pelo menos {floor} votos sobre a sua pontuação de segurança — o suficiente para que a média faça sentido. Agora mesmo são {count} {countryNoun}. Ajude a lista a crescer:',
    suggestedLabel: 'Destinos populares à espera do seu voto',
    voteLinkText: 'Vote em {name} →',
    howToReadTitle: 'Como Ler Esta Página',
    howToReadP1:
      '«Nossa pontuação» é o número baseado em dados que você vê em cada página de país: um composto de indicadores de conflito, criminalidade, saúde, governança e meio ambiente, recalculado todos os dias. «A pontuação da comunidade» surge quando incorporamos o que os viajantes dizem: cada voto é um controlo deslizante entre «bem menos seguro» e «bem mais seguro» do que a nossa pontuação, guardado como um ajuste com sinal.',
    howToReadP2:
      'Não fazemos uma simples média de todos os votos. Votos mais recentes contam um pouco mais do que os antigos — o peso deles cai pela metade a cada mês, aproximadamente —, e por mais forte que seja a opinião coletiva, ela só pode mover a pontuação em, no máximo, 1 ponto em qualquer direção. Esse limite evita que um punhado de votos muito vocais domine um número que deveria refletir dados amplos e verificados.',
    howToReadP3:
      'Uma diferença entre os dois números já é, por si só, uma informação útil: a nossa pontuação pesa indicadores de risco estrutural que uma viagem curta pode nunca chegar a tocar, enquanto os viajantes contam como o dia a dia realmente foi — incluindo coisas que nenhum conjunto de dados capta por completo, e às vezes também o relato isolado de uma única viagem mais do que uma tendência ampla. Nenhum dos dois números é «a verdade» sozinho: lidos em conjunto, dizem mais do que cada um por si.',
    methodologyText: 'Tem curiosidade em saber como a pontuação baseada em dados é calculada? Leia a nossa {link}.',
    methodologyLinkText: 'metodologia completa',
    countryNoun: { one: 'país', other: 'países' },
  },
  zh: {
    title: '社区评价 vs 数据评分：旅行者如何评价各国安全',
    description: '我们将基于数据的安全评分与旅行者的真实反馈逐国对比，展示每个已有足够投票的目的地之间的差异有多大。',
    introLead:
      '我们的安全评分基于政府旅行警告、冲突与犯罪数据以及其他结构性指标计算得出。但真正去过一个地方的人，感受有时并不一样。每个国家页面都会邀请旅行者说说我们的评分是否符合实际——本页把他们的反馈与我们的数据放在一起比较，涵盖所有已获得足够投票、结果具有参考意义的国家。',
    headlineSafer: '旅行者投票认为{name}比我们的评分高 {gap} 分——这是目前有足够投票的 {count} {countryNoun}中差距最大的一个。',
    headlineLessSafe: '旅行者投票认为{name}比我们的评分低 {gap} 分——这是目前有足够投票的 {count} {countryNoun}中差距最大的一个。',
    dataAsOf: '数据截至 {date}。',
    rankingTitle: '按差距排名的国家',
    ourScoreLabel: '我们的评分',
    communityScoreLabel: '社区评分',
    gapChipSafer: '{gap} 更安全',
    gapChipLessSafe: '{gap} 较不安全',
    gapChipNeutral: '与我们的评分基本一致',
    votesLabel: '{count} 票',
    driverTemplate: '拉低我们评分最多的是{pillar}（{score}/10 分）——{note}。',
    driverNeutral: '这个国家的五大安全支柱得分非常接近，没有哪一项明显是主要因素。',
    pillarNote: {
      conflict: '这类风险不易察觉，除非恰好在你出行期间爆发',
      crime: '当地居民比短暂停留的游客更容易感受到这一点',
      health: '大多数旅行者只有在真正出问题时才会真正用到这套系统',
      governance: '这是一种结构性的弱点，在普通的短途旅行中很少显现出来',
      environment: '其影响更多取决于出行的时间，而非目的地本身',
    },
    emptyStateTitle: '投票数量还不够',
    emptyStateBody: '目前还没有国家获得 {floor} 票，因此暂时无法排名——不过每个国家页面都有一个简单的投票工具，率先达到门槛的国家会自动出现在这里。',
    growingTitle: '更多国家即将加入',
    growingBody: '只有当一个国家的安全评分获得至少 {floor} 票后，才会出现在这份排行榜中——这样平均值才有意义。目前共有 {count} {countryNoun}。帮助这份榜单继续壮大：',
    suggestedLabel: '等待你投票的热门目的地',
    voteLinkText: '为{name}投票 →',
    howToReadTitle: '如何解读这个页面',
    howToReadP1:
      '「我们的评分」就是你在每个国家页面上看到的、基于数据计算出的数字：由冲突、犯罪、健康、治理和环境这五类指标综合而成，每天重新计算。「社区评分」则是在此基础上加入了旅行者的反馈：每一票都是在「比我们的评分低得多」和「比我们的评分高得多」之间的一个滑动值，被记录为一个带正负号的调整量。',
    howToReadP2:
      '我们并不是简单地把所有投票取平均。较新的投票权重会略高于较早的投票——其权重大约每月衰减一半——而且无论集体意见有多强烈，最多也只能把评分向任一方向调整 1 分。这个上限可以防止少数意见强烈的投票，压过了本应反映大量、可核实数据的评分。',
    howToReadP3:
      '两个数字之间的差距本身就是有用的信息：我们的评分权衡的是结构性风险指标，短途旅行未必会真正接触到；而旅行者反映的则是当地日常生活的真实感受——包括任何数据集都无法完全捕捉的细节，有时也可能只是某一次旅行经历的个别反馈，而非普遍趋势。两个数字都不能单独代表「真相」：把它们放在一起看，会比单看其中一个更有参考价值。',
    methodologyText: '想知道基于数据的评分是如何计算出来的？请阅读我们的{link}。',
    methodologyLinkText: '完整方法论',
    countryNoun: { one: '个国家', other: '个国家' },
  },
  de: {
    title: 'Community vs. Daten: Wie Reisende die Sicherheit Bewerten',
    description:
      'Wir vergleichen unsere datenbasierte Sicherheitsbewertung mit der echten Einschätzung von Reisenden, Land für Land, für jedes Reiseziel mit genügend Stimmen.',
    introLead:
      'Unsere Sicherheits-Scores basieren auf staatlichen Reisehinweisen, Konflikt- und Kriminalitätsdaten sowie weiteren strukturellen Indikatoren. Wer aber wirklich vor Ort war, sieht das manchmal anders. Jede Länderseite lädt Reisende ein zu sagen, ob unsere Bewertung stimmig wirkt — diese Seite stellt ihre Antworten unseren Daten gegenüber, für jedes Land mit genügend Stimmen, um aussagekräftig zu sein.',
    headlineSafer:
      'Community-Stimmen sehen {name} {gap} Punkte über unserer Bewertung — der größte Unterschied unter den {count} {countryNoun} mit bisher ausreichend Stimmen.',
    headlineLessSafe:
      'Community-Stimmen sehen {name} {gap} Punkte unter unserer Bewertung — der größte Unterschied unter den {count} {countryNoun} mit bisher ausreichend Stimmen.',
    dataAsOf: 'Stand der Daten: {date}.',
    rankingTitle: 'Länder nach Abweichung Sortiert',
    ourScoreLabel: 'Unsere Bewertung',
    communityScoreLabel: 'Community-Bewertung',
    gapChipSafer: '{gap} höher',
    gapChipLessSafe: '{gap} niedriger',
    gapChipNeutral: 'Entspricht unserer Bewertung',
    votesLabel: '{count} Stimmen',
    driverTemplate: 'Am stärksten belastet wird unsere Bewertung von {pillar} ({score}/10) — {note}.',
    driverNeutral: 'Die fünf Sicherheitssäulen dieses Landes liegen sehr nah beieinander, keine sticht als Hauptfaktor hervor.',
    pillarNote: {
      conflict: 'ein Risiko, das leicht zu übersehen ist – außer es eskaliert genau während Ihrer Reisetermine',
      crime: 'ein Muster, das Einheimische eher bemerken als jemand auf der Durchreise',
      health: 'ein System, das die meisten Reisenden nur dann wirklich auf die Probe stellen, wenn etwas schiefgeht',
      governance: 'eine strukturelle Schwäche, die sich auf einer gewöhnlichen Kurzreise selten zeigt',
      environment: 'ein Risiko, dessen Auswirkung stärker vom Reisezeitpunkt abhängt als vom Reiseziel selbst',
    },
    emptyStateTitle: 'Noch nicht genug Stimmen',
    emptyStateBody:
      'Noch kein Land hat {floor} Stimmen erreicht, daher gibt es hier noch nichts einzustufen — aber jede Länderseite hat ein kurzes Abstimmungs-Tool, und die ersten Länder, die diese Schwelle überschreiten, erscheinen hier automatisch.',
    growingTitle: 'Weitere Länder kommen bald dazu',
    growingBody:
      'Ein Land erscheint erst in diesem Ranking, wenn mindestens {floor} Stimmen zu seiner Sicherheitsbewertung vorliegen — genug, damit der Durchschnitt aussagekräftig ist. Aktuell sind das {count} {countryNoun}. Helfen Sie mit, die Liste wachsen zu lassen:',
    suggestedLabel: 'Beliebte Reiseziele, die auf Ihre Stimme warten',
    voteLinkText: 'Für {name} abstimmen →',
    howToReadTitle: 'So Lesen Sie Diese Seite',
    howToReadP1:
      '„Unsere Bewertung" ist die datenbasierte Zahl, die Sie auf jeder Länderseite sehen: ein Composite aus Indikatoren zu Konflikt, Kriminalität, Gesundheit, Regierungsführung und Umwelt, täglich neu berechnet. Die „Community-Bewertung" entsteht, wenn wir hinzufügen, was Reisende berichten: Jede Stimme ist ein Regler zwischen „viel unsicherer" und „viel sicherer" als unsere Bewertung, gespeichert als vorzeichenbehaftete Korrektur.',
    howToReadP2:
      'Wir bilden keinen einfachen Durchschnitt aller Stimmen. Neuere Stimmen zählen etwas mehr als ältere — ihr Gewicht halbiert sich etwa alle einen Monat —, und so stark die kollektive Meinung auch sein mag, sie kann die Bewertung höchstens um 1 Punkt in die eine oder andere Richtung verschieben. Diese Obergrenze verhindert, dass eine Handvoll sehr lautstarker Stimmen eine Zahl überrollt, die breite, geprüfte Daten widerspiegeln soll.',
    howToReadP3:
      'Ein Unterschied zwischen beiden Zahlen ist für sich genommen schon eine nützliche Information: Unsere Bewertung gewichtet strukturelle Risikoindikatoren, mit denen eine kurze Reise vielleicht nie in Berührung kommt, während Reisende schildern, wie sich der Alltag vor Ort tatsächlich angefühlt hat — einschließlich Dingen, die kein Datensatz vollständig erfasst, und manchmal auch nur den Bericht einer einzelnen lauten Reise statt eines breiten Musters. Keine der beiden Zahlen ist für sich allein „die Wahrheit" — zusammen gelesen sagen sie mehr aus als jede für sich.',
    methodologyText: 'Neugierig, wie die datenbasierte Bewertung berechnet wird? Lesen Sie unsere {link}.',
    methodologyLinkText: 'vollständige Methodik',
    countryNoun: { one: 'Land', other: 'Länder' },
  },
};
