/**
 * Copy for the "where governments disagree" page (route key
 * `governments-disagree`), all 7 locales. Separate module for the same
 * reason as government-advisories-copy.ts / about-copy.ts: ui.ts is a merge
 * hot spot other workstreams are editing this same round.
 *
 * Every {token} is filled in by the page from src/lib/advisory-views.ts at
 * build time (spreads, medians, percentages, government names) — nothing
 * here is a pre-written claim about a specific country or government; see
 * CLAUDE.md's "Honesty is non-negotiable" rule and the module docstring in
 * advisory-views.ts for how the underlying numbers are kept bias-corrected.
 */
import type { Lang } from './ui';

export interface GovernmentsDisagreeCopy {
  /** {count} = number of qualifying countries (>= 8 issuers reporting) today. Used as both <title> and <h1>. */
  title: string;
  description: string;
  intro: string;
  /** The one-sentence, journalist-readable definition of the ranking measure (VISIBILITY-BRIEF Task B). */
  measureExplainer: string;
  /** Contains one {link} token -> the methodology page. */
  methodologyNote: string;
  methodologyLinkText: string;
  breadcrumbLabel: string;

  /** {country} = localized country name, {min}/{max} = the level range. */
  factMostContested: string;
  /**
   * {government} = localized issuing-country name (used as a label, "{government}: ...",
   * never as a sentence subject a verb must agree with -- some eligible issuers are
   * grammatically plural countries in it/es/fr/pt/de; see the equivalent note in
   * government-advisories-copy.ts's hub.mostRestrictive docstring).
   * {pct} = share of its ratings that are 2+ levels from the median, one decimal.
   */
  factMostDivergent: string;
  factInsufficientDivergentData: string;
  /** {n} = countries with full consensus, {total} = qualifying countries. */
  factFullConsensus: string;

  listIntro: string;
  labelGovernmentsRating: string; // "{n} governments rate this destination"
  labelSpread: string;
  labelMedian: string;
  labelOutliers: string;
  noOutliers: string;
  /** Bar-chart legend, index 0 = level 1 .. index 3 = level 4 (short noun labels, not full clauses). */
  levelShortLabels: [string, string, string, string];
  /** Per-card sentence clauses ("{governments} " + clause), index 0 = level 1 .. index 3 = level 4. */
  levelClauses: [string, string, string, string];
  /** Separator between the two clauses of the per-card sentence (French needs a space before ";"). */
  clauseSeparator: string;

  whyTitle: string;
  whyParagraphs: string[];
}

export const governmentsDisagreeCopy: Record<Lang, GovernmentsDisagreeCopy> = {
  en: {
    title: 'Where Governments Disagree on Travel Safety',
    description: "Ranked by how much {count} widely-rated countries divide governments' travel advisories, updated daily.",
    intro: "Every government publishes its own travel advisory, and most of the time they roughly agree. This page ranks the countries where they don't — and names which governments are the outliers.",
    measureExplainer: "The disagreement score is the spread — the highest advisory level reported for a country minus the lowest — with countries tied on spread ranked by how spread out (standard deviation) the levels are.",
    methodologyNote: 'Every level here is mapped onto the same 1–4 scale explained in our {link}.',
    methodologyLinkText: 'methodology',
    breadcrumbLabel: 'Where governments disagree',
    factMostContested: 'The most contested destination is {country}, where reported levels range from {min} to {max}.',
    factMostDivergent: '{government}: diverges from the pack most often — 2+ levels from the consensus on {pct}% of the countries it rates.',
    factInsufficientDivergentData: "There isn't yet enough data to name the government that diverges most often.",
    factFullConsensus: '{n} of the {total} widely-rated countries have full consensus: every government reports the same level.',
    listIntro: 'Top 30 most-contested destinations, ranked by spread:',
    labelGovernmentsRating: '{n} governments rate this destination',
    labelSpread: 'Spread',
    labelMedian: 'Median level',
    labelOutliers: 'Outliers',
    noOutliers: 'No single government is a clear outlier here — the disagreement is more gradual, spread across several levels.',
    levelShortLabels: ['Normal', 'Caution', 'Reconsider', 'Avoid'],
    levelClauses: [
      'report normal precautions',
      'advise increased caution',
      'recommend reconsidering travel',
      'advise against all travel',
    ],
    clauseSeparator: '; ',
    whyTitle: 'Why governments disagree',
    whyParagraphs: [
      "Governments don't disagree because one of them is wrong. Each sets its own risk appetite: some advisories are written to cover the most cautious traveller and shift early, others are meant as a floor of practical guidance and move only when the facts clearly demand it.",
      'Consular capacity plays a role too. A government with a large embassy network and consular staff on the ground can support its citizens through a higher-risk situation, and may keep a lower advisory level as a result; a government with little or no local presence has less room to help if something goes wrong, and tends to advise more cautiously.',
      'Diplomatic relationships and update timing matter as well: advisories are drafted by people, on different schedules, sometimes shaped by bilateral ties that have nothing to do with the actual risk on the ground. None of this means any single advisory is unreliable — it means no single one tells the whole story, which is exactly why comparing them side by side is useful.',
    ],
  },

  it: {
    title: 'Dove i governi non concordano sulla sicurezza',
    description: 'Classifica di {count} paesi ampiamente valutati in base a quanto i governi si dividono sui loro avvisi di viaggio, aggiornata ogni giorno.',
    intro: "Ogni governo pubblica un proprio avviso di viaggio, e nella maggior parte dei casi sono grosso modo d'accordo. Questa pagina classifica i paesi in cui non lo sono, indicando quali governi si discostano dagli altri.",
    measureExplainer: "Il punteggio di disaccordo è lo scarto — il livello di avviso più alto registrato per un paese meno il più basso — e a parità di scarto i paesi sono ordinati in base a quanto i livelli sono dispersi (deviazione standard).",
    methodologyNote: 'Ogni livello qui riportato è convertito sulla stessa scala 1–4 spiegata nella nostra {link}.',
    methodologyLinkText: 'metodologia',
    breadcrumbLabel: 'Dove i governi non concordano',
    factMostContested: 'La destinazione più contesa è {country}, dove i livelli riportati vanno da {min} a {max}.',
    factMostDivergent: '{government}: il governo che si discosta più spesso dal gruppo, a 2 o più livelli dal consenso nel {pct}% dei paesi che valuta.',
    factInsufficientDivergentData: 'Non ci sono ancora abbastanza dati per indicare il governo che si discosta più spesso.',
    factFullConsensus: '{n} degli {total} paesi ampiamente valutati registrano pieno consenso: ogni governo riporta lo stesso livello.',
    listIntro: 'Le 30 destinazioni più contese, in ordine di scarto:',
    labelGovernmentsRating: '{n} governi valutano questa destinazione',
    labelSpread: 'Scarto',
    labelMedian: 'Livello mediano',
    labelOutliers: 'Casi anomali',
    noOutliers: 'Nessun singolo governo si distacca nettamente qui: il disaccordo è più graduale, distribuito su più livelli.',
    levelShortLabels: ['Normale', 'Prudenza', 'Da valutare', 'Evitare'],
    levelClauses: [
      'segnalano normali precauzioni',
      'raccomandano maggiore prudenza',
      'consigliano di riconsiderare il viaggio',
      'sconsigliano ogni viaggio',
    ],
    clauseSeparator: '; ',
    whyTitle: 'Perché i governi non concordano',
    whyParagraphs: [
      "I governi non sono in disaccordo perché uno di loro sbaglia. Ognuno definisce la propria propensione al rischio: alcuni avvisi sono pensati per tutelare il viaggiatore più prudente e si aggiornano in anticipo, altri sono pensati come base minima di indicazioni pratiche e cambiano solo quando i fatti lo richiedono chiaramente.",
      "Conta anche la capacità consolare. Un governo con un'ampia rete di ambasciate e personale consolare sul posto può assistere meglio i propri cittadini in una situazione a rischio più elevato, e per questo può mantenere un livello di avviso più basso; un governo con poca o nessuna presenza locale ha meno margine per intervenire se qualcosa va storto, e tende a essere più prudente.",
      "Contano anche i rapporti diplomatici e i tempi di aggiornamento: gli avvisi sono redatti da persone, con calendari diversi, a volte influenzati da legami bilaterali che nulla hanno a che vedere con il rischio reale sul terreno. Nulla di tutto questo rende un singolo avviso inaffidabile: significa solo che nessuno, da solo, racconta l'intera storia — ed è proprio per questo che confrontarli è utile.",
    ],
  },

  es: {
    title: 'Dónde los gobiernos discrepan sobre la seguridad',
    description: 'Clasificación de {count} países ampliamente evaluados según cuánto discrepan los gobiernos en sus avisos de viaje, actualizada a diario.',
    intro: 'Cada gobierno publica su propio aviso de viaje y, la mayoría de las veces, coinciden a grandes rasgos. Esta página clasifica los países en los que no coinciden, señalando qué gobiernos se apartan del resto.',
    measureExplainer: 'La puntuación de discrepancia es el rango: el nivel de aviso más alto registrado para un país menos el más bajo. En caso de empate, los países se ordenan según cuán dispersos están los niveles (desviación estándar).',
    methodologyNote: 'Cada nivel se traduce a la misma escala 1-4 que explicamos en nuestra {link}.',
    methodologyLinkText: 'metodología',
    breadcrumbLabel: 'Dónde los gobiernos discrepan',
    factMostContested: 'El destino más disputado es {country}, donde los niveles registrados van de {min} a {max}.',
    factMostDivergent: '{government}: el gobierno que más se aparta del grupo, a 2 o más niveles del consenso en el {pct}% de los países que evalúa.',
    factInsufficientDivergentData: 'Todavía no hay suficientes datos para señalar al gobierno que más se aparta del resto.',
    factFullConsensus: '{n} de los {total} países ampliamente evaluados tienen consenso total: todos los gobiernos reportan el mismo nivel.',
    listIntro: 'Los 30 destinos más disputados, ordenados por rango:',
    labelGovernmentsRating: '{n} gobiernos evalúan este destino',
    labelSpread: 'Rango',
    labelMedian: 'Nivel mediano',
    labelOutliers: 'Casos atípicos',
    noOutliers: 'Ningún gobierno se aparta claramente aquí: la discrepancia es más gradual, repartida entre varios niveles.',
    levelShortLabels: ['Normal', 'Precaución', 'A reconsiderar', 'Evitar'],
    levelClauses: [
      'señalan precauciones normales',
      'recomiendan extremar la precaución',
      'aconsejan reconsiderar el viaje',
      'desaconsejan todo viaje',
    ],
    clauseSeparator: '; ',
    whyTitle: 'Por qué los gobiernos discrepan',
    whyParagraphs: [
      'Los gobiernos no discrepan porque uno de ellos se equivoque. Cada uno define su propia tolerancia al riesgo: algunos avisos están pensados para proteger al viajero más cauteloso y se adelantan a los hechos; otros funcionan como un mínimo de orientación práctica y solo cambian cuando los hechos lo exigen con claridad.',
      'La capacidad consular también influye. Un gobierno con una amplia red de embajadas y personal consular sobre el terreno puede apoyar mejor a sus ciudadanos ante una situación de mayor riesgo, y por eso puede mantener un nivel de aviso más bajo; uno con poca o ninguna presencia local tiene menos margen para ayudar si algo sale mal, y tiende a ser más cauteloso.',
      'Las relaciones diplomáticas y los tiempos de actualización también cuentan: los avisos los redactan personas, con calendarios distintos, a veces influidos por vínculos bilaterales que nada tienen que ver con el riesgo real sobre el terreno. Nada de esto hace que un aviso concreto no sea fiable; solo significa que ninguno cuenta la historia completa por sí solo, y por eso comparar todos ellos resulta útil.',
    ],
  },

  fr: {
    title: 'Où les gouvernements divergent sur la sécurité',
    description: 'Classement de {count} pays largement évalués selon le degré de désaccord entre gouvernements sur leurs avis aux voyageurs, mis à jour chaque jour.',
    intro: "Chaque gouvernement publie son propre avis aux voyageurs et, la plupart du temps, ils sont globalement d'accord. Cette page classe les pays où ce n'est pas le cas, en nommant les gouvernements qui s'écartent des autres.",
    measureExplainer: "Le score de désaccord est l'écart : le niveau d'avis le plus élevé enregistré pour un pays moins le plus bas ; à écart égal, les pays sont classés selon la dispersion des niveaux (écart-type).",
    methodologyNote: 'Chaque niveau est converti sur la même échelle 1-4, expliquée dans notre {link}.',
    methodologyLinkText: 'méthodologie',
    breadcrumbLabel: 'Où les gouvernements divergent',
    factMostContested: "La destination la plus disputée est {country}, où les niveaux rapportés vont de {min} à {max}.",
    factMostDivergent: "{government} : le gouvernement qui s'écarte le plus souvent du groupe, à 2 niveaux ou plus du consensus sur {pct} % des pays qu'il évalue.",
    factInsufficientDivergentData: "Les données ne sont pas encore suffisantes pour désigner le gouvernement qui diverge le plus souvent.",
    factFullConsensus: '{n} des {total} pays largement évalués font l\'objet d\'un consensus total : tous les gouvernements rapportent le même niveau.',
    listIntro: 'Les 30 destinations les plus disputées, classées par écart :',
    labelGovernmentsRating: '{n} gouvernements évaluent cette destination',
    labelSpread: 'Écart',
    labelMedian: 'Niveau médian',
    labelOutliers: 'Cas atypiques',
    noOutliers: "Aucun gouvernement ne s'écarte nettement ici : le désaccord est plus graduel, réparti sur plusieurs niveaux.",
    levelShortLabels: ['Normal', 'Prudence', 'À reconsidérer', 'À éviter'],
    levelClauses: [
      'signalent des précautions normales',
      'recommandent une vigilance renforcée',
      'conseillent de reconsidérer le voyage',
      'déconseillent tout voyage',
    ],
    clauseSeparator: ' ; ',
    whyTitle: 'Pourquoi les gouvernements divergent',
    whyParagraphs: [
      "Les gouvernements ne divergent pas parce que l'un d'eux se trompe. Chacun définit sa propre tolérance au risque : certains avis sont rédigés pour protéger le voyageur le plus prudent et évoluent tôt, d'autres se veulent un socle d'indications pratiques et ne changent que lorsque les faits l'exigent clairement.",
      "La capacité consulaire joue aussi un rôle. Un gouvernement disposant d'un large réseau d'ambassades et de personnel consulaire sur place peut mieux soutenir ses citoyens face à une situation à risque plus élevé, et peut de ce fait maintenir un niveau d'avis plus bas ; un gouvernement peu ou pas présent localement a moins de marge de manœuvre en cas de problème, et tend à se montrer plus prudent.",
      "Les relations diplomatiques et les calendriers de mise à jour comptent également : les avis sont rédigés par des personnes, selon des rythmes différents, parfois influencés par des liens bilatéraux qui n'ont rien à voir avec le risque réel sur place. Rien de tout cela ne rend un avis pris isolément peu fiable — cela signifie simplement qu'aucun ne raconte, à lui seul, toute l'histoire, ce qui est précisément l'intérêt de les comparer.",
    ],
  },

  pt: {
    title: 'Onde os governos discordam sobre segurança',
    description: 'Classificação de {count} países amplamente avaliados conforme o grau de discordância entre os alertas de viagem dos governos, atualizada todos os dias.',
    intro: 'Cada governo publica o seu próprio alerta de viagem e, na maioria das vezes, concordam a grandes traços. Esta página classifica os países em que isso não acontece, apontando quais governos se destacam dos demais.',
    measureExplainer: 'A pontuação de discordância é a amplitude — o nível de alerta mais alto registado para um país menos o mais baixo —, com empates desempatados por quão dispersos estão os níveis (desvio padrão).',
    methodologyNote: 'Cada nível é convertido para a mesma escala 1-4 explicada na nossa {link}.',
    methodologyLinkText: 'metodologia',
    breadcrumbLabel: 'Onde os governos discordam',
    factMostContested: 'O destino mais disputado é {country}, onde os níveis registados vão de {min} a {max}.',
    factMostDivergent: '{government}: o governo que mais se afasta do grupo, a 2 ou mais níveis do consenso em {pct}% dos países que avalia.',
    factInsufficientDivergentData: 'Ainda não há dados suficientes para apontar o governo que mais diverge dos demais.',
    factFullConsensus: '{n} dos {total} países amplamente avaliados têm consenso total: todos os governos reportam o mesmo nível.',
    listIntro: 'Os 30 destinos mais disputados, ordenados por amplitude:',
    labelGovernmentsRating: '{n} governos avaliam este destino',
    labelSpread: 'Amplitude',
    labelMedian: 'Nível mediano',
    labelOutliers: 'Casos atípicos',
    noOutliers: 'Nenhum governo se destaca claramente aqui: a discordância é mais gradual, distribuída por vários níveis.',
    levelShortLabels: ['Normal', 'Cautela', 'A reconsiderar', 'Evitar'],
    levelClauses: [
      'reportam precaução normal',
      'recomendam cautela redobrada',
      'aconselham reconsiderar a viagem',
      'desaconselham qualquer viagem',
    ],
    clauseSeparator: '; ',
    whyTitle: 'Por que os governos discordam',
    whyParagraphs: [
      'Os governos não discordam porque um deles esteja errado. Cada um define a sua própria tolerância ao risco: alguns alertas são redigidos para proteger o viajante mais cauteloso e mudam mais cedo; outros funcionam como um mínimo de orientação prática e só mudam quando os factos o exigem claramente.',
      'A capacidade consular também conta. Um governo com uma ampla rede de embaixadas e pessoal consular no terreno pode apoiar melhor os seus cidadãos numa situação de maior risco, e por isso pode manter um nível de alerta mais baixo; um governo com pouca ou nenhuma presença local tem menos margem para ajudar se algo correr mal, e tende a ser mais cauteloso.',
      'As relações diplomáticas e os prazos de atualização também importam: os alertas são redigidos por pessoas, com calendários diferentes, por vezes influenciados por laços bilaterais que nada têm a ver com o risco real no terreno. Nada disto torna um único alerta pouco fiável — significa apenas que nenhum deles conta, sozinho, toda a história, e é exatamente por isso que compará-los é útil.',
    ],
  },

  zh: {
    title: '各国政府在旅行安全评估上的分歧',
    description: '对 {count} 个被广泛评估的国家进行排名，衡量各国政府对其评估的分歧程度——从完全一致，到最审慎与最宽松警示之间相差 3 个等级。',
    intro: '每个政府都会发布自己的旅行警示，多数情况下评估大致相符。本页对分歧最大的目的地进行排名，并指出哪些政府的评估明显偏离其他政府。',
    measureExplainer: '分歧程度以"差值"衡量——即某国获得的最高警示等级减去最低等级；差值相同时，再按各等级的离散程度（标准差）排序。',
    methodologyNote: '本页所有等级均已换算为统一的 1-4 分级标准，详见我们的{link}。',
    methodologyLinkText: '方法论说明',
    breadcrumbLabel: '各国政府评估分歧',
    factMostContested: '分歧最大的目的地是{country}，各国报告的等级从 {min} 级到 {max} 级不等。',
    factMostDivergent: '{government}：最常偏离整体共识的政府——在其评估的国家中，有 {pct}% 的比例与共识相差 2 个等级以上。',
    factInsufficientDivergentData: '目前数据尚不充分，暂时无法判断哪个政府最常偏离共识。',
    factFullConsensus: '在 {total} 个被广泛评估的国家中，有 {n} 个国家达成完全共识：所有政府给出的等级完全一致。',
    listIntro: '分歧最大的 30 个目的地，按差值排序：',
    labelGovernmentsRating: '{n} 个政府对该目的地作出评估',
    labelSpread: '差值',
    labelMedian: '中位等级',
    labelOutliers: '异常值',
    noOutliers: '这里没有哪个政府明显偏离整体——分歧更为渐进，分散在多个等级之间。',
    levelShortLabels: ['正常', '谨慎', '重新考虑', '避免'],
    levelClauses: [
      '认为应正常防范',
      '建议加强防范',
      '建议重新考虑此行程',
      '建议避免所有出行',
    ],
    clauseSeparator: '；',
    whyTitle: '各国政府为何存在分歧',
    whyParagraphs: [
      '各国政府之间的分歧，并不意味着其中一方判断有误。每个政府都有自己对风险的容忍尺度：有些警示体系倾向于照顾最谨慎的旅行者，因而更早作出调整；另一些则被视为一套基本的实用指引，只有在事实明确要求时才会改变。',
      '领事保障能力也是原因之一。拥有庞大使领馆网络和驻地领事人员的政府，能够在风险较高的情况下为本国公民提供更多支持，因而可能维持相对较低的警示等级；而在当地缺乏或几乎没有存在的政府，一旦出现问题可提供的协助有限，因此往往给出更审慎的评估。',
      '外交关系和更新节奏同样会产生影响：警示内容由人来撰写，各自的更新周期不同，有时还会受到与实际风险无关的双边关系因素影响。这些都不意味着某一份警示不可信——只是说明任何单一警示都无法讲述完整的故事，这也正是将它们并列比较的价值所在。',
    ],
  },

  de: {
    title: 'Wo Regierungen bei der Reisesicherheit uneins sind',
    description: 'Rangliste von {count} breit bewerteten Ländern danach, wie stark sich Regierungen bei ihren Reisewarnungen uneinig sind, täglich aktualisiert.',
    intro: 'Jede Regierung veröffentlicht ihre eigene Reisewarnung, und meistens stimmen sie grob überein. Diese Seite listet die Länder, bei denen das nicht der Fall ist, und benennt, welche Regierungen von den anderen abweichen.',
    measureExplainer: 'Der Uneinigkeits-Wert ist die Spannweite — die höchste für ein Land gemeldete Warnstufe minus die niedrigste; bei Gleichstand entscheidet, wie stark die Stufen streuen (Standardabweichung).',
    methodologyNote: 'Jede Stufe wird auf dieselbe 1-4-Skala übertragen, die wir in unserer {link} erklären.',
    methodologyLinkText: 'Methodik',
    breadcrumbLabel: 'Wo Regierungen uneins sind',
    factMostContested: 'Das umstrittenste Reiseziel ist {country}, wo die gemeldeten Stufen von {min} bis {max} reichen.',
    factMostDivergent: '{government}: die Regierung, die am häufigsten von der Gruppe abweicht — bei den von ihr bewerteten Ländern liegt sie in {pct}% der Fälle 2 oder mehr Stufen vom Konsens entfernt.',
    factInsufficientDivergentData: 'Es liegen noch nicht genügend Daten vor, um die am häufigsten abweichende Regierung zu benennen.',
    factFullConsensus: 'Bei {n} von {total} breit bewerteten Ländern herrscht völlige Einigkeit: Jede Regierung meldet dieselbe Stufe.',
    listIntro: 'Die 30 umstrittensten Reiseziele, nach Spannweite geordnet:',
    labelGovernmentsRating: '{n} Regierungen bewerten dieses Reiseziel',
    labelSpread: 'Spannweite',
    labelMedian: 'Median-Stufe',
    labelOutliers: 'Ausreißer',
    noOutliers: 'Keine einzelne Regierung weicht hier deutlich ab — die Uneinigkeit verteilt sich schrittweise über mehrere Stufen.',
    levelShortLabels: ['Normal', 'Vorsicht', 'Überdenken', 'Meiden'],
    levelClauses: [
      'melden normale Vorsicht',
      'raten zu erhöhter Vorsicht',
      'empfehlen, die Reise zu überdenken',
      'raten von jeder Reise ab',
    ],
    clauseSeparator: '; ',
    whyTitle: 'Warum Regierungen uneins sind',
    whyParagraphs: [
      'Regierungen sind nicht deshalb uneins, weil eine von ihnen falschliegt. Jede legt ihre eigene Risikobereitschaft fest: Manche Warnungen sind so verfasst, dass sie die vorsichtigste Reisende absichern und früh reagieren, andere verstehen sich als Mindestmaß an praktischer Orientierung und ändern sich erst, wenn die Fakten es eindeutig verlangen.',
      'Auch die konsularische Kapazität spielt eine Rolle. Eine Regierung mit einem großen Botschaftsnetz und Konsularpersonal vor Ort kann ihre Bürger in einer riskanteren Lage besser unterstützen und deshalb eine niedrigere Warnstufe halten; eine Regierung mit wenig oder keiner Präsenz vor Ort hat weniger Spielraum, im Ernstfall zu helfen, und neigt zu vorsichtigeren Einschätzungen.',
      'Auch diplomatische Beziehungen und Aktualisierungsrhythmen spielen eine Rolle: Warnungen werden von Menschen verfasst, nach unterschiedlichen Zeitplänen, manchmal beeinflusst von bilateralen Beziehungen, die nichts mit dem tatsächlichen Risiko vor Ort zu tun haben. Das macht keine einzelne Warnung unzuverlässig — es bedeutet nur, dass keine für sich allein die ganze Geschichte erzählt, und genau deshalb lohnt sich der Vergleich.',
    ],
  },
};
