/**
 * Visible FAQ content for the 7 hub/ranking page types, in all 7 languages.
 * Used by HubPageLayout for both the visible <HubFaq> section and the
 * FAQPage JSON-LD node (via buildFaqPageJsonLd in src/lib/seo.ts).
 *
 * Answers are intentionally factual and citable: they reference the 5-pillar
 * weighted methodology (conflict 30%, crime 25%, health 20%, governance 15%,
 * environment 10%), daily updates from 40+ public sources, and the 1-10 scale.
 */
import type { Lang } from '../i18n/ui';

export type HubType =
  | 'safest-countries'
  | 'most-dangerous-countries'
  | 'countries-to-avoid'
  | 'safest-for-families'
  | 'safest-for-solo-travelers'
  | 'improving-safety'
  | 'declining-safety';

export interface HubFaqItem {
  question: string;
  answer: string;
}

const HUB_FAQ: Record<HubType, Record<Lang, HubFaqItem[]>> = {
  'safest-countries': {
    en: [
      {
        question: 'How is this ranking of the safest countries calculated?',
        answer:
          'Each country receives a safety score from 1 to 10, computed as a weighted geometric mean of five pillars: conflict (30%), crime (25%), health (20%), governance (15%) and environment (10%). The ranking lists the countries with the highest overall scores, and only countries with sufficient data coverage are included.',
      },
      {
        question: 'How often is the safest-countries ranking updated?',
        answer:
          'Scores are recalculated every day from more than 40 public sources, including government travel advisories, the Global Peace Index and World Bank indicators. The ranking always reflects the most recent daily snapshot.',
      },
      {
        question: 'What makes a country one of the safest to visit?',
        answer:
          'The safest countries combine very low levels of armed conflict and violent crime with strong healthcare systems, stable institutions and low exposure to natural hazards. On our 1-10 scale, top-ranked countries typically score above 8.',
      },
    ],
    it: [
      {
        question: 'Come viene calcolata questa classifica dei paesi più sicuri?',
        answer:
          'Ogni paese riceve un punteggio di sicurezza da 1 a 10, calcolato come media geometrica ponderata di cinque pilastri: conflitti (30%), criminalità (25%), sanità (20%), governance (15%) e ambiente (10%). La classifica elenca i paesi con i punteggi complessivi più alti e include solo i paesi con una copertura dati sufficiente.',
      },
      {
        question: 'Con quale frequenza viene aggiornata la classifica dei paesi più sicuri?',
        answer:
          "I punteggi vengono ricalcolati ogni giorno a partire da oltre 40 fonti pubbliche, tra cui avvisi di viaggio governativi, il Global Peace Index e indicatori della Banca Mondiale. La classifica riflette sempre l'ultimo aggiornamento giornaliero.",
      },
      {
        question: 'Cosa rende un paese tra i più sicuri da visitare?',
        answer:
          'I paesi più sicuri combinano livelli molto bassi di conflitti armati e crimini violenti con sistemi sanitari solidi, istituzioni stabili e bassa esposizione ai rischi naturali. Sulla nostra scala da 1 a 10, i paesi in cima alla classifica superano in genere quota 8.',
      },
    ],
    es: [
      {
        question: '¿Cómo se calcula esta clasificación de los países más seguros?',
        answer:
          'Cada país recibe una puntuación de seguridad de 1 a 10, calculada como media geométrica ponderada de cinco pilares: conflictos (30%), criminalidad (25%), salud (20%), gobernanza (15%) y medio ambiente (10%). La clasificación muestra los países con las puntuaciones globales más altas e incluye solo países con suficiente cobertura de datos.',
      },
      {
        question: '¿Con qué frecuencia se actualiza la clasificación de los países más seguros?',
        answer:
          'Las puntuaciones se recalculan cada día a partir de más de 40 fuentes públicas, incluidos los avisos de viaje gubernamentales, el Global Peace Index e indicadores del Banco Mundial. La clasificación refleja siempre la actualización diaria más reciente.',
      },
      {
        question: '¿Qué hace que un país sea uno de los más seguros para visitar?',
        answer:
          'Los países más seguros combinan niveles muy bajos de conflicto armado y delitos violentos con sistemas sanitarios sólidos, instituciones estables y baja exposición a riesgos naturales. En nuestra escala de 1 a 10, los países mejor clasificados suelen superar el 8.',
      },
    ],
    fr: [
      {
        question: 'Comment ce classement des pays les plus sûrs est-il calculé ?',
        answer:
          "Chaque pays reçoit un score de sécurité de 1 à 10, calculé comme une moyenne géométrique pondérée de cinq piliers : conflits (30 %), criminalité (25 %), santé (20 %), gouvernance (15 %) et environnement (10 %). Le classement présente les pays aux scores globaux les plus élevés et n'inclut que les pays disposant d'une couverture de données suffisante.",
      },
      {
        question: 'À quelle fréquence le classement des pays les plus sûrs est-il mis à jour ?',
        answer:
          'Les scores sont recalculés chaque jour à partir de plus de 40 sources publiques, dont les avis aux voyageurs gouvernementaux, le Global Peace Index et des indicateurs de la Banque mondiale. Le classement reflète toujours la mise à jour quotidienne la plus récente.',
      },
      {
        question: "Qu'est-ce qui fait d'un pays l'un des plus sûrs à visiter ?",
        answer:
          'Les pays les plus sûrs combinent des niveaux très faibles de conflits armés et de crimes violents avec des systèmes de santé solides, des institutions stables et une faible exposition aux risques naturels. Sur notre échelle de 1 à 10, les pays en tête dépassent généralement 8.',
      },
    ],
    pt: [
      {
        question: 'Como é calculado este ranking dos países mais seguros?',
        answer:
          'Cada país recebe uma pontuação de segurança de 1 a 10, calculada como média geométrica ponderada de cinco pilares: conflitos (30%), criminalidade (25%), saúde (20%), governança (15%) e meio ambiente (10%). O ranking lista os países com as pontuações gerais mais altas e inclui apenas países com cobertura de dados suficiente.',
      },
      {
        question: 'Com que frequência o ranking dos países mais seguros é atualizado?',
        answer:
          'As pontuações são recalculadas todos os dias a partir de mais de 40 fontes públicas, incluindo avisos de viagem governamentais, o Global Peace Index e indicadores do Banco Mundial. O ranking reflete sempre a atualização diária mais recente.',
      },
      {
        question: 'O que torna um país um dos mais seguros para visitar?',
        answer:
          'Os países mais seguros combinam níveis muito baixos de conflito armado e crimes violentos com sistemas de saúde sólidos, instituições estáveis e baixa exposição a riscos naturais. Na nossa escala de 1 a 10, os países no topo geralmente pontuam acima de 8.',
      },
    ],
    zh: [
      {
        question: '最安全国家排名是如何计算的？',
        answer:
          '每个国家都会获得一个 1 到 10 分的安全评分，由五大支柱的加权几何平均数计算得出：冲突（30%）、犯罪（25%）、医疗（20%）、治理（15%）和环境（10%）。排名列出综合得分最高的国家，且仅收录数据覆盖充分的国家。',
      },
      {
        question: '最安全国家排名多久更新一次？',
        answer:
          '评分每天根据 40 多个公开数据源重新计算，包括各国政府旅行警告、全球和平指数（Global Peace Index）以及世界银行指标。排名始终反映最新的每日数据快照。',
      },
      {
        question: '是什么让一个国家成为最安全的旅行目的地之一？',
        answer:
          '最安全的国家通常武装冲突和暴力犯罪水平极低，同时拥有完善的医疗体系、稳定的制度和较低的自然灾害风险。在我们的 1-10 评分体系中，排名靠前的国家得分通常高于 8 分。',
      },
    ],
    de: [
      {
        question: 'Wie wird dieses Ranking der sichersten Länder berechnet?',
        answer:
          'Jedes Land erhält einen Sicherheitswert von 1 bis 10, berechnet als gewichtetes geometrisches Mittel aus fünf Säulen: Konflikt (30 %), Kriminalität (25 %), Gesundheit (20 %), Regierungsführung (15 %) und Umwelt (10 %). Das Ranking führt die Länder mit den höchsten Gesamtwerten auf und berücksichtigt nur Länder mit ausreichender Datenabdeckung.',
      },
      {
        question: 'Wie oft wird das Ranking der sichersten Länder aktualisiert?',
        answer:
          'Die Werte werden täglich aus mehr als 40 öffentlichen Quellen neu berechnet, darunter staatliche Reisehinweise, der Global Peace Index und Indikatoren der Weltbank. Das Ranking spiegelt stets den aktuellsten Tagesstand wider.',
      },
      {
        question: 'Was macht ein Land zu einem der sichersten Reiseziele?',
        answer:
          'Die sichersten Länder verbinden sehr geringe Werte bei bewaffneten Konflikten und Gewaltkriminalität mit starken Gesundheitssystemen, stabilen Institutionen und geringer Exposition gegenüber Naturgefahren. Auf unserer Skala von 1 bis 10 erreichen die bestplatzierten Länder in der Regel Werte über 8.',
      },
    ],
  },

  'most-dangerous-countries': {
    en: [
      {
        question: 'Why do these countries have such low safety scores?',
        answer:
          'Low scores are driven by active armed conflict, high violent-crime rates, weak healthcare and governance, or severe natural hazards. Because the score is a weighted geometric mean of five pillars (conflict 30%, crime 25%, health 20%, governance 15%, environment 10%), a critical failure in any single pillar pulls the overall 1-10 score down sharply.',
      },
      {
        question: 'What does a Level 4 "Do Not Travel" advisory mean?',
        answer:
          "Level 4 is the highest warning issued by government travel advisories such as the US State Department's, indicating life-threatening risks. In our methodology, a Level 4 advisory caps a country's overall score at 2 out of 10, regardless of the other pillars.",
      },
      {
        question: 'Can you still travel to the most dangerous countries?',
        answer:
          'Travel is sometimes possible but strongly discouraged: insurance may be void, embassies may offer no consular help, and conditions can change within hours. If a trip is essential, check daily-updated advisories — our scores are recalculated every day from 40+ public sources.',
      },
    ],
    it: [
      {
        question: 'Perché questi paesi hanno punteggi di sicurezza così bassi?',
        answer:
          'I punteggi bassi derivano da conflitti armati attivi, alti tassi di crimini violenti, sanità e governance deboli o gravi rischi naturali. Poiché il punteggio è una media geometrica ponderata di cinque pilastri (conflitti 30%, criminalità 25%, sanità 20%, governance 15%, ambiente 10%), una criticità in un singolo pilastro abbassa nettamente il punteggio complessivo da 1 a 10.',
      },
      {
        question: 'Cosa significa un avviso di Livello 4 "Do Not Travel"?',
        answer:
          'Il Livello 4 è il massimo grado di allerta emesso dagli avvisi di viaggio governativi, come quelli del Dipartimento di Stato USA, e indica rischi potenzialmente letali. Nella nostra metodologia, un avviso di Livello 4 limita il punteggio complessivo del paese a un massimo di 2 su 10, indipendentemente dagli altri pilastri.',
      },
      {
        question: 'Si può comunque viaggiare nei paesi più pericolosi?',
        answer:
          "A volte è possibile, ma fortemente sconsigliato: l'assicurazione può non essere valida, le ambasciate possono non garantire assistenza consolare e le condizioni possono cambiare in poche ore. Se il viaggio è indispensabile, consulta gli avvisi aggiornati quotidianamente: i nostri punteggi vengono ricalcolati ogni giorno da oltre 40 fonti pubbliche.",
      },
    ],
    es: [
      {
        question: '¿Por qué estos países tienen puntuaciones de seguridad tan bajas?',
        answer:
          'Las puntuaciones bajas se deben a conflictos armados activos, altas tasas de delitos violentos, sistemas sanitarios y de gobernanza débiles o graves riesgos naturales. Como la puntuación es una media geométrica ponderada de cinco pilares (conflictos 30%, criminalidad 25%, salud 20%, gobernanza 15%, medio ambiente 10%), un fallo crítico en un solo pilar reduce drásticamente la puntuación global de 1 a 10.',
      },
      {
        question: '¿Qué significa un aviso de Nivel 4 "Do Not Travel" (no viajar)?',
        answer:
          'El Nivel 4 es la advertencia más alta emitida por los avisos de viaje gubernamentales, como los del Departamento de Estado de EE. UU., e indica riesgos potencialmente mortales. En nuestra metodología, un aviso de Nivel 4 limita la puntuación global del país a un máximo de 2 sobre 10, independientemente de los demás pilares.',
      },
      {
        question: '¿Se puede viajar de todos modos a los países más peligrosos?',
        answer:
          'A veces es posible, pero está fuertemente desaconsejado: el seguro puede quedar anulado, las embajadas pueden no ofrecer asistencia consular y las condiciones pueden cambiar en cuestión de horas. Si el viaje es imprescindible, consulta los avisos actualizados a diario: nuestras puntuaciones se recalculan cada día a partir de más de 40 fuentes públicas.',
      },
    ],
    fr: [
      {
        question: 'Pourquoi ces pays ont-ils des scores de sécurité aussi bas ?',
        answer:
          "Les scores bas s'expliquent par des conflits armés actifs, des taux élevés de crimes violents, des systèmes de santé et de gouvernance fragiles ou de graves risques naturels. Le score étant une moyenne géométrique pondérée de cinq piliers (conflits 30 %, criminalité 25 %, santé 20 %, gouvernance 15 %, environnement 10 %), une défaillance critique d'un seul pilier fait chuter fortement le score global de 1 à 10.",
      },
      {
        question: 'Que signifie un avis de niveau 4 « Do Not Travel » ?',
        answer:
          "Le niveau 4 est l'alerte la plus élevée émise par les avis aux voyageurs gouvernementaux, comme ceux du Département d'État américain, et signale des risques potentiellement mortels. Dans notre méthodologie, un avis de niveau 4 plafonne le score global du pays à 2 sur 10, quels que soient les autres piliers.",
      },
      {
        question: 'Peut-on quand même voyager dans les pays les plus dangereux ?',
        answer:
          "C'est parfois possible, mais fortement déconseillé : l'assurance peut être invalidée, les ambassades peuvent ne fournir aucune aide consulaire et la situation peut changer en quelques heures. Si le voyage est indispensable, consultez les avis mis à jour quotidiennement : nos scores sont recalculés chaque jour à partir de plus de 40 sources publiques.",
      },
    ],
    pt: [
      {
        question: 'Por que esses países têm pontuações de segurança tão baixas?',
        answer:
          'As pontuações baixas resultam de conflitos armados ativos, altas taxas de crimes violentos, saúde e governança frágeis ou graves riscos naturais. Como a pontuação é uma média geométrica ponderada de cinco pilares (conflitos 30%, criminalidade 25%, saúde 20%, governança 15%, meio ambiente 10%), uma falha crítica em um único pilar derruba fortemente a pontuação geral de 1 a 10.',
      },
      {
        question: 'O que significa um aviso de Nível 4 "Do Not Travel" (não viaje)?',
        answer:
          'O Nível 4 é o alerta mais alto emitido pelos avisos de viagem governamentais, como os do Departamento de Estado dos EUA, e indica riscos potencialmente fatais. Na nossa metodologia, um aviso de Nível 4 limita a pontuação geral do país a no máximo 2 em 10, independentemente dos demais pilares.',
      },
      {
        question: 'Ainda é possível viajar para os países mais perigosos?',
        answer:
          'Às vezes é possível, mas fortemente desaconselhado: o seguro pode perder a validade, as embaixadas podem não oferecer assistência consular e as condições podem mudar em poucas horas. Se a viagem for essencial, consulte os avisos atualizados diariamente: nossas pontuações são recalculadas todos os dias a partir de mais de 40 fontes públicas.',
      },
    ],
    zh: [
      {
        question: '为什么这些国家的安全评分如此之低？',
        answer:
          '低分主要源于持续的武装冲突、高暴力犯罪率、薄弱的医疗与治理体系或严重的自然灾害风险。由于评分是五大支柱（冲突 30%、犯罪 25%、医疗 20%、治理 15%、环境 10%）的加权几何平均数，任何一个支柱出现严重问题都会显著拉低 1-10 的总分。',
      },
      {
        question: '四级"切勿前往"（Do Not Travel）警告意味着什么？',
        answer:
          '四级是美国国务院等政府旅行警告体系中的最高级别，表示存在危及生命的风险。在我们的方法论中，四级警告会将该国总分上限压至 10 分中的 2 分，无论其他支柱表现如何。',
      },
      {
        question: '仍然可以前往最危险的国家旅行吗？',
        answer:
          '有时可行，但强烈不建议：旅行保险可能失效，使领馆可能无法提供领事协助，局势也可能在数小时内变化。如果行程确有必要，请查看每日更新的警告信息——我们的评分每天根据 40 多个公开数据源重新计算。',
      },
    ],
    de: [
      {
        question: 'Warum haben diese Länder so niedrige Sicherheitswerte?',
        answer:
          'Niedrige Werte entstehen durch aktive bewaffnete Konflikte, hohe Gewaltkriminalität, schwache Gesundheits- und Regierungssysteme oder gravierende Naturgefahren. Da der Wert ein gewichtetes geometrisches Mittel aus fünf Säulen ist (Konflikt 30 %, Kriminalität 25 %, Gesundheit 20 %, Regierungsführung 15 %, Umwelt 10 %), zieht ein kritischer Ausfall in einer einzigen Säule den Gesamtwert auf der Skala von 1 bis 10 stark nach unten.',
      },
      {
        question: 'Was bedeutet eine Stufe-4-Warnung "Do Not Travel"?',
        answer:
          'Stufe 4 ist die höchste Warnstufe staatlicher Reisehinweise, etwa des US-Außenministeriums, und signalisiert lebensbedrohliche Risiken. In unserer Methodik begrenzt eine Stufe-4-Warnung den Gesamtwert eines Landes auf maximal 2 von 10 Punkten — unabhängig von den übrigen Säulen.',
      },
      {
        question: 'Kann man trotzdem in die gefährlichsten Länder reisen?',
        answer:
          'Manchmal ist es möglich, aber dringend abzuraten: Versicherungen können ihre Gültigkeit verlieren, Botschaften können keine konsularische Hilfe leisten und die Lage kann sich binnen Stunden ändern. Ist die Reise unvermeidbar, prüfen Sie die täglich aktualisierten Hinweise — unsere Werte werden jeden Tag aus über 40 öffentlichen Quellen neu berechnet.',
      },
    ],
  },

  'countries-to-avoid': {
    en: [
      {
        question: "What's the difference between countries to avoid and the most dangerous countries ranking?",
        answer:
          'The most-dangerous ranking is sorted purely by the lowest 1-10 safety scores, while this list focuses on countries that official government advisories currently recommend avoiding. The two overlap heavily but are not identical, because advisories also reflect diplomatic and consular factors.',
      },
      {
        question: 'Which government advisories does this list rely on?',
        answer:
          'We aggregate official travel advisories from multiple governments, including the United States, Canada, Australia and several European foreign ministries. Together with 40+ other public sources they feed the five weighted pillars (conflict 30%, crime 25%, health 20%, governance 15%, environment 10%), refreshed daily.',
      },
      {
        question: 'How current is this list of countries to avoid?',
        answer:
          'It is rebuilt every day from the latest advisory levels and safety scores. A Level 4 "Do Not Travel" advisory automatically caps a country\'s score at 2 on the 1-10 scale, so escalations show up within 24 hours.',
      },
    ],
    it: [
      {
        question: 'Qual è la differenza tra "paesi da evitare" e la classifica dei paesi più pericolosi?',
        answer:
          'La classifica dei più pericolosi è ordinata esclusivamente in base ai punteggi di sicurezza più bassi sulla scala 1-10, mentre questa lista si concentra sui paesi che gli avvisi governativi ufficiali raccomandano attualmente di evitare. Le due liste si sovrappongono in gran parte, ma non coincidono, perché gli avvisi riflettono anche fattori diplomatici e consolari.',
      },
      {
        question: 'Su quali avvisi governativi si basa questa lista?',
        answer:
          'Aggreghiamo gli avvisi di viaggio ufficiali di più governi, tra cui Stati Uniti, Canada, Australia e diversi ministeri degli esteri europei. Insieme ad altre 40+ fonti pubbliche alimentano i cinque pilastri ponderati (conflitti 30%, criminalità 25%, sanità 20%, governance 15%, ambiente 10%), aggiornati ogni giorno.',
      },
      {
        question: 'Quanto è aggiornata questa lista di paesi da evitare?',
        answer:
          'Viene ricostruita ogni giorno a partire dai livelli di avviso e dai punteggi di sicurezza più recenti. Un avviso di Livello 4 "Do Not Travel" limita automaticamente il punteggio di un paese a 2 sulla scala da 1 a 10, quindi gli aggravamenti compaiono entro 24 ore.',
      },
    ],
    es: [
      {
        question: '¿Cuál es la diferencia entre "países a evitar" y la clasificación de los países más peligrosos?',
        answer:
          'La clasificación de los más peligrosos se ordena únicamente por las puntuaciones más bajas en la escala de 1 a 10, mientras que esta lista se centra en los países que los avisos gubernamentales oficiales recomiendan evitar actualmente. Ambas listas se superponen en gran medida, pero no son idénticas, porque los avisos también reflejan factores diplomáticos y consulares.',
      },
      {
        question: '¿En qué avisos gubernamentales se basa esta lista?',
        answer:
          'Agregamos los avisos de viaje oficiales de varios gobiernos, incluidos Estados Unidos, Canadá, Australia y varios ministerios de exteriores europeos. Junto con más de 40 fuentes públicas alimentan los cinco pilares ponderados (conflictos 30%, criminalidad 25%, salud 20%, gobernanza 15%, medio ambiente 10%), actualizados a diario.',
      },
      {
        question: '¿Qué tan actualizada está esta lista de países a evitar?',
        answer:
          'Se reconstruye cada día a partir de los niveles de aviso y las puntuaciones de seguridad más recientes. Un aviso de Nivel 4 "Do Not Travel" limita automáticamente la puntuación de un país a 2 en la escala de 1 a 10, por lo que las escaladas aparecen en menos de 24 horas.',
      },
    ],
    fr: [
      {
        question: 'Quelle est la différence entre « pays à éviter » et le classement des pays les plus dangereux ?',
        answer:
          "Le classement des plus dangereux est trié uniquement selon les scores les plus bas sur l'échelle de 1 à 10, tandis que cette liste se concentre sur les pays que les avis gouvernementaux officiels recommandent actuellement d'éviter. Les deux listes se recoupent largement sans être identiques, car les avis intègrent aussi des facteurs diplomatiques et consulaires.",
      },
      {
        question: "Sur quels avis gouvernementaux cette liste s'appuie-t-elle ?",
        answer:
          "Nous agrégeons les avis aux voyageurs officiels de plusieurs gouvernements, dont les États-Unis, le Canada, l'Australie et plusieurs ministères européens des Affaires étrangères. Avec plus de 40 autres sources publiques, ils alimentent les cinq piliers pondérés (conflits 30 %, criminalité 25 %, santé 20 %, gouvernance 15 %, environnement 10 %), actualisés chaque jour.",
      },
      {
        question: 'Cette liste de pays à éviter est-elle à jour ?',
        answer:
          "Elle est reconstruite chaque jour à partir des niveaux d'avis et des scores de sécurité les plus récents. Un avis de niveau 4 « Do Not Travel » plafonne automatiquement le score d'un pays à 2 sur l'échelle de 1 à 10, de sorte que les aggravations apparaissent sous 24 heures.",
      },
    ],
    pt: [
      {
        question: 'Qual é a diferença entre "países a evitar" e o ranking dos países mais perigosos?',
        answer:
          'O ranking dos mais perigosos é ordenado apenas pelas pontuações mais baixas na escala de 1 a 10, enquanto esta lista se concentra nos países que os avisos governamentais oficiais recomendam evitar no momento. As duas listas se sobrepõem bastante, mas não são idênticas, porque os avisos também refletem fatores diplomáticos e consulares.',
      },
      {
        question: 'Em quais avisos governamentais esta lista se baseia?',
        answer:
          'Agregamos os avisos de viagem oficiais de vários governos, incluindo Estados Unidos, Canadá, Austrália e diversos ministérios de relações exteriores europeus. Junto com mais de 40 outras fontes públicas, eles alimentam os cinco pilares ponderados (conflitos 30%, criminalidade 25%, saúde 20%, governança 15%, meio ambiente 10%), atualizados diariamente.',
      },
      {
        question: 'Quão atualizada é esta lista de países a evitar?',
        answer:
          'Ela é reconstruída todos os dias a partir dos níveis de aviso e das pontuações de segurança mais recentes. Um aviso de Nível 4 "Do Not Travel" limita automaticamente a pontuação de um país a 2 na escala de 1 a 10, então os agravamentos aparecem em até 24 horas.',
      },
    ],
    zh: [
      {
        question: '"应避免前往的国家"与"最危险国家"排名有何区别？',
        answer:
          '最危险国家排名完全按 1-10 安全评分从低到高排序，而本列表聚焦于各国政府官方旅行警告当前建议避免前往的国家。两者高度重叠但并不完全相同，因为官方警告还会考虑外交和领事因素。',
      },
      {
        question: '这份列表依据哪些政府旅行警告？',
        answer:
          '我们汇总了多国政府的官方旅行警告，包括美国、加拿大、澳大利亚以及多个欧洲国家外交部。这些警告与其他 40 多个公开数据源一起，构成每日更新的五大加权支柱（冲突 30%、犯罪 25%、医疗 20%、治理 15%、环境 10%）。',
      },
      {
        question: '这份应避免前往国家的列表有多新？',
        answer:
          '列表每天根据最新的警告级别和安全评分重新生成。四级"切勿前往"警告会自动将该国评分上限压至 1-10 分制中的 2 分，因此局势恶化会在 24 小时内体现出来。',
      },
    ],
    de: [
      {
        question: 'Was unterscheidet "zu meidende Länder" vom Ranking der gefährlichsten Länder?',
        answer:
          'Das Ranking der gefährlichsten Länder ist rein nach den niedrigsten Werten auf der 1-10-Skala sortiert, während sich diese Liste auf Länder konzentriert, von deren Besuch offizielle staatliche Reisehinweise derzeit abraten. Beide Listen überschneiden sich stark, sind aber nicht identisch, da Reisehinweise auch diplomatische und konsularische Faktoren berücksichtigen.',
      },
      {
        question: 'Auf welche staatlichen Reisehinweise stützt sich diese Liste?',
        answer:
          'Wir aggregieren offizielle Reisehinweise mehrerer Regierungen, darunter die USA, Kanada, Australien und mehrere europäische Außenministerien. Zusammen mit über 40 weiteren öffentlichen Quellen speisen sie die fünf gewichteten Säulen (Konflikt 30 %, Kriminalität 25 %, Gesundheit 20 %, Regierungsführung 15 %, Umwelt 10 %), die täglich aktualisiert werden.',
      },
      {
        question: 'Wie aktuell ist diese Liste der zu meidenden Länder?',
        answer:
          'Sie wird jeden Tag aus den neuesten Warnstufen und Sicherheitswerten neu erstellt. Eine Stufe-4-Warnung "Do Not Travel" begrenzt den Wert eines Landes automatisch auf 2 auf der Skala von 1 bis 10, sodass Verschärfungen innerhalb von 24 Stunden sichtbar werden.',
      },
    ],
  },

  'safest-for-families': {
    en: [
      {
        question: 'How is the ranking of safest countries for families calculated?',
        answer:
          'It starts from the same 1-10 safety score — a weighted geometric mean of conflict (30%), crime (25%), health (20%), governance (15%) and environment (10%) — with particular relevance for the pillars families care about most: healthcare quality and low crime. Data is refreshed daily from 40+ public sources.',
      },
      {
        question: 'Which safety pillars matter most when travelling with children?',
        answer:
          'Health and crime are the most relevant pillars for family travel: reliable hospitals and pediatric care on one side, low rates of street crime and theft on the other. Countries at the top of this list score strongly on both.',
      },
      {
        question: 'Are the safest countries for families also the safest in general?',
        answer:
          'There is large overlap, but not always: a country can rank high overall yet have weaker healthcare infrastructure, which matters more with children. That is why checking the health and crime pillar scores on each country page is recommended.',
      },
    ],
    it: [
      {
        question: 'Come viene calcolata la classifica dei paesi più sicuri per le famiglie?',
        answer:
          'Parte dallo stesso punteggio di sicurezza da 1 a 10 — una media geometrica ponderata di conflitti (30%), criminalità (25%), sanità (20%), governance (15%) e ambiente (10%) — con particolare rilievo per i pilastri più importanti per le famiglie: qualità della sanità e bassa criminalità. I dati vengono aggiornati ogni giorno da oltre 40 fonti pubbliche.',
      },
      {
        question: 'Quali pilastri di sicurezza contano di più quando si viaggia con bambini?',
        answer:
          "Sanità e criminalità sono i pilastri più rilevanti per i viaggi in famiglia: ospedali affidabili e cure pediatriche da un lato, bassi tassi di furti e criminalità di strada dall'altro. I paesi in cima a questa lista ottengono punteggi elevati in entrambi.",
      },
      {
        question: 'I paesi più sicuri per le famiglie sono anche i più sicuri in generale?',
        answer:
          'La sovrapposizione è ampia ma non totale: un paese può avere un punteggio complessivo alto ma infrastrutture sanitarie più deboli, un fattore che pesa di più viaggiando con bambini. Per questo conviene controllare i punteggi dei pilastri sanità e criminalità nella pagina di ogni paese.',
      },
    ],
    es: [
      {
        question: '¿Cómo se calcula la clasificación de los países más seguros para familias?',
        answer:
          'Parte de la misma puntuación de seguridad de 1 a 10 — una media geométrica ponderada de conflictos (30%), criminalidad (25%), salud (20%), gobernanza (15%) y medio ambiente (10%) — con especial relevancia de los pilares que más importan a las familias: la calidad sanitaria y la baja criminalidad. Los datos se actualizan cada día a partir de más de 40 fuentes públicas.',
      },
      {
        question: '¿Qué pilares de seguridad importan más al viajar con niños?',
        answer:
          'Salud y criminalidad son los pilares más relevantes para los viajes en familia: hospitales fiables y atención pediátrica por un lado, y bajas tasas de robos y delincuencia callejera por otro. Los países en lo alto de esta lista puntúan alto en ambos.',
      },
      {
        question: '¿Los países más seguros para familias son también los más seguros en general?',
        answer:
          'Hay una gran superposición, pero no siempre: un país puede tener una puntuación global alta y, aun así, una infraestructura sanitaria más débil, algo que pesa más al viajar con niños. Por eso conviene revisar las puntuaciones de los pilares de salud y criminalidad en la página de cada país.',
      },
    ],
    fr: [
      {
        question: 'Comment le classement des pays les plus sûrs pour les familles est-il calculé ?',
        answer:
          'Il part du même score de sécurité de 1 à 10 — une moyenne géométrique pondérée des piliers conflits (30 %), criminalité (25 %), santé (20 %), gouvernance (15 %) et environnement (10 %) — en accordant une attention particulière aux piliers qui comptent le plus pour les familles : la qualité des soins et la faible criminalité. Les données sont actualisées chaque jour à partir de plus de 40 sources publiques.',
      },
      {
        question: "Quels piliers de sécurité comptent le plus lorsqu'on voyage avec des enfants ?",
        answer:
          "La santé et la criminalité sont les piliers les plus pertinents pour les voyages en famille : des hôpitaux fiables et des soins pédiatriques d'un côté, de faibles taux de vols et de délinquance de rue de l'autre. Les pays en tête de cette liste obtiennent de bons scores sur les deux.",
      },
      {
        question: 'Les pays les plus sûrs pour les familles sont-ils aussi les plus sûrs en général ?',
        answer:
          'Le recoupement est large, mais pas systématique : un pays peut être très bien classé globalement tout en ayant des infrastructures de santé plus faibles, un facteur qui pèse davantage avec des enfants. Il est donc conseillé de vérifier les scores des piliers santé et criminalité sur la page de chaque pays.',
      },
    ],
    pt: [
      {
        question: 'Como é calculado o ranking dos países mais seguros para famílias?',
        answer:
          'Ele parte da mesma pontuação de segurança de 1 a 10 — uma média geométrica ponderada de conflitos (30%), criminalidade (25%), saúde (20%), governança (15%) e meio ambiente (10%) — com destaque para os pilares que mais importam às famílias: qualidade da saúde e baixa criminalidade. Os dados são atualizados todos os dias a partir de mais de 40 fontes públicas.',
      },
      {
        question: 'Quais pilares de segurança importam mais ao viajar com crianças?',
        answer:
          'Saúde e criminalidade são os pilares mais relevantes para viagens em família: hospitais confiáveis e atendimento pediátrico de um lado, baixas taxas de furtos e crimes de rua do outro. Os países no topo desta lista pontuam bem em ambos.',
      },
      {
        question: 'Os países mais seguros para famílias também são os mais seguros em geral?',
        answer:
          'Há grande sobreposição, mas nem sempre: um país pode ter pontuação geral alta e, ainda assim, infraestrutura de saúde mais fraca, o que pesa mais quando se viaja com crianças. Por isso, vale conferir as pontuações dos pilares de saúde e criminalidade na página de cada país.',
      },
    ],
    zh: [
      {
        question: '最适合家庭出行的安全国家排名是如何计算的？',
        answer:
          '排名基于同样的 1-10 安全评分——由冲突（30%）、犯罪（25%）、医疗（20%）、治理（15%）和环境（10%）的加权几何平均数构成——并特别关注家庭最在意的支柱：医疗质量和低犯罪率。数据每天根据 40 多个公开数据源更新。',
      },
      {
        question: '带孩子旅行时哪些安全支柱最重要？',
        answer:
          '医疗和犯罪是家庭旅行最相关的两大支柱：一方面需要可靠的医院和儿科医疗，另一方面需要较低的街头犯罪和盗窃率。本列表中排名靠前的国家在这两方面均表现出色。',
      },
      {
        question: '对家庭最安全的国家也是总体上最安全的国家吗？',
        answer:
          '两者高度重叠，但并不总是一致：一个国家可能总体评分很高，医疗基础设施却相对薄弱，而带孩子出行时这一点更为关键。因此建议在各国页面上查看医疗和犯罪支柱的具体得分。',
      },
    ],
    de: [
      {
        question: 'Wie wird das Ranking der sichersten Länder für Familien berechnet?',
        answer:
          'Es basiert auf demselben Sicherheitswert von 1 bis 10 — einem gewichteten geometrischen Mittel aus Konflikt (30 %), Kriminalität (25 %), Gesundheit (20 %), Regierungsführung (15 %) und Umwelt (10 %) — mit besonderem Augenmerk auf die für Familien wichtigsten Säulen: Gesundheitsversorgung und niedrige Kriminalität. Die Daten werden täglich aus über 40 öffentlichen Quellen aktualisiert.',
      },
      {
        question: 'Welche Sicherheitssäulen zählen beim Reisen mit Kindern am meisten?',
        answer:
          'Gesundheit und Kriminalität sind für Familienreisen die relevantesten Säulen: verlässliche Krankenhäuser und Kindermedizin auf der einen, niedrige Diebstahls- und Straßenkriminalität auf der anderen Seite. Die Länder an der Spitze dieser Liste schneiden in beiden stark ab.',
      },
      {
        question: 'Sind die sichersten Länder für Familien auch insgesamt die sichersten?',
        answer:
          'Die Überschneidung ist groß, aber nicht immer gegeben: Ein Land kann insgesamt hoch eingestuft sein und dennoch eine schwächere Gesundheitsinfrastruktur haben — ein Faktor, der mit Kindern stärker ins Gewicht fällt. Deshalb lohnt sich der Blick auf die Säulenwerte Gesundheit und Kriminalität auf der jeweiligen Länderseite.',
      },
    ],
  },

  'safest-for-solo-travelers': {
    en: [
      {
        question: 'How is the ranking of safest countries for solo travelers calculated?',
        answer:
          'It is based on the overall 1-10 safety score — a weighted geometric mean of five pillars (conflict 30%, crime 25%, health 20%, governance 15%, environment 10%) — with special attention to the pillars that matter most when travelling alone: crime and governance. Scores are updated daily from 40+ public sources.',
      },
      {
        question: 'Why do crime and governance matter most for solo travelers?',
        answer:
          'Travelling alone means relying on local police, courts and institutions if something goes wrong, and being more exposed to theft, scams and harassment. Countries with low crime and strong, trustworthy institutions therefore make the safest solo destinations.',
      },
      {
        question: 'What data-driven precautions should solo travelers take?',
        answer:
          "Check the country's daily-updated score and its crime pillar before booking, register with your embassy where possible, and re-check advisories close to departure — scores are recalculated every day from more than 40 public sources, so conditions can shift.",
      },
    ],
    it: [
      {
        question: 'Come viene calcolata la classifica dei paesi più sicuri per chi viaggia da solo?',
        answer:
          'Si basa sul punteggio complessivo da 1 a 10 — una media geometrica ponderata di cinque pilastri (conflitti 30%, criminalità 25%, sanità 20%, governance 15%, ambiente 10%) — con particolare attenzione ai pilastri più importanti per chi viaggia da solo: criminalità e governance. I punteggi sono aggiornati ogni giorno da oltre 40 fonti pubbliche.',
      },
      {
        question: 'Perché criminalità e governance contano di più per i viaggiatori solitari?',
        answer:
          'Viaggiare da soli significa dover contare su polizia, tribunali e istituzioni locali se qualcosa va storto, oltre a essere più esposti a furti, truffe e molestie. I paesi con bassa criminalità e istituzioni solide e affidabili sono quindi le destinazioni più sicure per i viaggi in solitaria.',
      },
      {
        question: 'Quali precauzioni basate sui dati dovrebbe prendere chi viaggia da solo?',
        answer:
          'Controlla il punteggio aggiornato quotidianamente e il pilastro criminalità del paese prima di prenotare, registrati presso la tua ambasciata dove possibile e ricontrolla gli avvisi a ridosso della partenza: i punteggi vengono ricalcolati ogni giorno da oltre 40 fonti pubbliche e le condizioni possono cambiare.',
      },
    ],
    es: [
      {
        question: '¿Cómo se calcula la clasificación de los países más seguros para viajeros en solitario?',
        answer:
          'Se basa en la puntuación global de 1 a 10 — una media geométrica ponderada de cinco pilares (conflictos 30%, criminalidad 25%, salud 20%, gobernanza 15%, medio ambiente 10%) — con especial atención a los pilares más importantes al viajar solo: criminalidad y gobernanza. Las puntuaciones se actualizan a diario a partir de más de 40 fuentes públicas.',
      },
      {
        question: '¿Por qué la criminalidad y la gobernanza importan más para quienes viajan solos?',
        answer:
          'Viajar solo implica depender de la policía, los tribunales y las instituciones locales si algo sale mal, además de estar más expuesto a robos, estafas y acoso. Por eso, los países con baja criminalidad e instituciones sólidas y fiables son los destinos más seguros para viajar en solitario.',
      },
      {
        question: '¿Qué precauciones basadas en datos debería tomar un viajero en solitario?',
        answer:
          'Revisa la puntuación del país, actualizada a diario, y su pilar de criminalidad antes de reservar; regístrate en tu embajada cuando sea posible y vuelve a consultar los avisos cerca de la salida: las puntuaciones se recalculan cada día a partir de más de 40 fuentes públicas y las condiciones pueden cambiar.',
      },
    ],
    fr: [
      {
        question: 'Comment le classement des pays les plus sûrs pour les voyageurs en solo est-il calculé ?',
        answer:
          'Il repose sur le score global de 1 à 10 — une moyenne géométrique pondérée de cinq piliers (conflits 30 %, criminalité 25 %, santé 20 %, gouvernance 15 %, environnement 10 %) — avec une attention particulière aux piliers les plus importants quand on voyage seul : la criminalité et la gouvernance. Les scores sont mis à jour quotidiennement à partir de plus de 40 sources publiques.',
      },
      {
        question: 'Pourquoi la criminalité et la gouvernance comptent-elles le plus pour les voyageurs en solo ?',
        answer:
          "Voyager seul signifie dépendre de la police, de la justice et des institutions locales en cas de problème, tout en étant plus exposé aux vols, aux arnaques et au harcèlement. Les pays à faible criminalité dotés d'institutions solides et fiables sont donc les destinations les plus sûres pour les voyages en solo.",
      },
      {
        question: 'Quelles précautions fondées sur les données un voyageur en solo devrait-il prendre ?',
        answer:
          "Vérifiez le score du pays, mis à jour quotidiennement, et son pilier criminalité avant de réserver ; inscrivez-vous auprès de votre ambassade lorsque c'est possible et revérifiez les avis peu avant le départ : les scores sont recalculés chaque jour à partir de plus de 40 sources publiques et la situation peut évoluer.",
      },
    ],
    pt: [
      {
        question: 'Como é calculado o ranking dos países mais seguros para quem viaja sozinho?',
        answer:
          'Ele se baseia na pontuação geral de 1 a 10 — uma média geométrica ponderada de cinco pilares (conflitos 30%, criminalidade 25%, saúde 20%, governança 15%, meio ambiente 10%) — com atenção especial aos pilares que mais importam para quem viaja só: criminalidade e governança. As pontuações são atualizadas diariamente a partir de mais de 40 fontes públicas.',
      },
      {
        question: 'Por que criminalidade e governança importam mais para quem viaja sozinho?',
        answer:
          'Viajar sozinho significa depender da polícia, da justiça e das instituições locais se algo der errado, além de estar mais exposto a furtos, golpes e assédio. Por isso, países com baixa criminalidade e instituições sólidas e confiáveis são os destinos mais seguros para viagens solo.',
      },
      {
        question: 'Quais precauções baseadas em dados quem viaja sozinho deve tomar?',
        answer:
          'Verifique a pontuação do país, atualizada diariamente, e o pilar de criminalidade antes de reservar; registre-se na sua embaixada quando possível e confira novamente os avisos perto da partida: as pontuações são recalculadas todos os dias a partir de mais de 40 fontes públicas e as condições podem mudar.',
      },
    ],
    zh: [
      {
        question: '最适合独自旅行的安全国家排名是如何计算的？',
        answer:
          '排名基于 1-10 的综合安全评分——五大支柱（冲突 30%、犯罪 25%、医疗 20%、治理 15%、环境 10%）的加权几何平均数——并特别关注独自旅行时最重要的支柱：犯罪和治理。评分每天根据 40 多个公开数据源更新。',
      },
      {
        question: '为什么犯罪和治理对独自旅行者最重要？',
        answer:
          '独自旅行意味着一旦出现问题只能依靠当地警方、司法和公共机构，同时更容易遭遇盗窃、诈骗和骚扰。因此，犯罪率低且制度健全可靠的国家是最安全的独行目的地。',
      },
      {
        question: '独自旅行者应采取哪些基于数据的预防措施？',
        answer:
          '预订前查看该国每日更新的评分及其犯罪支柱得分，可能的话向本国使领馆登记行程，并在出发前再次核查旅行警告——评分每天根据 40 多个公开数据源重新计算，局势可能发生变化。',
      },
    ],
    de: [
      {
        question: 'Wie wird das Ranking der sichersten Länder für Alleinreisende berechnet?',
        answer:
          'Es basiert auf dem Gesamtwert von 1 bis 10 — einem gewichteten geometrischen Mittel aus fünf Säulen (Konflikt 30 %, Kriminalität 25 %, Gesundheit 20 %, Regierungsführung 15 %, Umwelt 10 %) — mit besonderem Fokus auf die für Alleinreisende wichtigsten Säulen: Kriminalität und Regierungsführung. Die Werte werden täglich aus über 40 öffentlichen Quellen aktualisiert.',
      },
      {
        question: 'Warum sind Kriminalität und Regierungsführung für Alleinreisende am wichtigsten?',
        answer:
          'Wer allein reist, ist im Ernstfall auf lokale Polizei, Justiz und Institutionen angewiesen und zugleich stärker Diebstahl, Betrug und Belästigung ausgesetzt. Länder mit niedriger Kriminalität und stabilen, vertrauenswürdigen Institutionen sind daher die sichersten Ziele für Soloreisen.',
      },
      {
        question: 'Welche datenbasierten Vorsichtsmaßnahmen sollten Alleinreisende treffen?',
        answer:
          'Prüfen Sie vor der Buchung den täglich aktualisierten Länderwert und die Kriminalitätssäule, registrieren Sie sich nach Möglichkeit bei Ihrer Botschaft und kontrollieren Sie die Reisehinweise kurz vor Abreise erneut — die Werte werden jeden Tag aus über 40 öffentlichen Quellen neu berechnet, die Lage kann sich also ändern.',
      },
    ],
  },

  'improving-safety': {
    en: [
      {
        question: 'How is the safety improvement trend calculated?',
        answer:
          "We compare each country's current 1-10 safety score with its historical snapshots and rank countries by the largest positive change. Because scores are recalculated daily from 40+ public sources, the trend captures real shifts in conflict, crime, health, governance and environment data.",
      },
      {
        question: "What causes a country's safety score to improve?",
        answer:
          'Typical drivers are the end or de-escalation of conflict, falling crime rates, advisory downgrades by governments, and better health or governance indicators. Each pillar feeds the weighted score (conflict 30%, crime 25%, health 20%, governance 15%, environment 10%), so improvements in heavier pillars move the score most.',
      },
      {
        question: 'Does an improving trend mean a country is safe to visit?',
        answer:
          'Not necessarily — a country can improve quickly yet still have a low absolute score on the 1-10 scale. Always check the current score and any active government advisories, both updated daily, before planning a trip.',
      },
    ],
    it: [
      {
        question: 'Come viene calcolato il trend di miglioramento della sicurezza?',
        answer:
          'Confrontiamo il punteggio di sicurezza attuale da 1 a 10 di ogni paese con i suoi snapshot storici e ordiniamo i paesi in base alla variazione positiva maggiore. Poiché i punteggi vengono ricalcolati ogni giorno da oltre 40 fonti pubbliche, il trend cattura cambiamenti reali nei dati su conflitti, criminalità, sanità, governance e ambiente.',
      },
      {
        question: 'Cosa fa migliorare il punteggio di sicurezza di un paese?',
        answer:
          'I fattori tipici sono la fine o la de-escalation di un conflitto, il calo della criminalità, la riduzione dei livelli di avviso da parte dei governi e migliori indicatori sanitari o di governance. Ogni pilastro alimenta il punteggio ponderato (conflitti 30%, criminalità 25%, sanità 20%, governance 15%, ambiente 10%), quindi i miglioramenti nei pilastri con peso maggiore spostano di più il punteggio.',
      },
      {
        question: 'Un trend in miglioramento significa che un paese è sicuro da visitare?',
        answer:
          'Non necessariamente: un paese può migliorare rapidamente e avere comunque un punteggio assoluto basso sulla scala 1-10. Controlla sempre il punteggio attuale e gli eventuali avvisi governativi attivi, entrambi aggiornati ogni giorno, prima di pianificare un viaggio.',
      },
    ],
    es: [
      {
        question: '¿Cómo se calcula la tendencia de mejora de la seguridad?',
        answer:
          'Comparamos la puntuación actual de 1 a 10 de cada país con sus registros históricos y ordenamos los países según el mayor cambio positivo. Como las puntuaciones se recalculan a diario a partir de más de 40 fuentes públicas, la tendencia refleja cambios reales en los datos de conflictos, criminalidad, salud, gobernanza y medio ambiente.',
      },
      {
        question: '¿Qué hace que mejore la puntuación de seguridad de un país?',
        answer:
          'Los factores típicos son el fin o la desescalada de un conflicto, la caída de la delincuencia, la rebaja de los avisos gubernamentales y mejores indicadores sanitarios o de gobernanza. Cada pilar alimenta la puntuación ponderada (conflictos 30%, criminalidad 25%, salud 20%, gobernanza 15%, medio ambiente 10%), por lo que las mejoras en los pilares de mayor peso mueven más la puntuación.',
      },
      {
        question: '¿Una tendencia de mejora significa que un país es seguro para visitar?',
        answer:
          'No necesariamente: un país puede mejorar rápidamente y seguir teniendo una puntuación absoluta baja en la escala de 1 a 10. Comprueba siempre la puntuación actual y los avisos gubernamentales activos, ambos actualizados a diario, antes de planificar un viaje.',
      },
    ],
    fr: [
      {
        question: "Comment la tendance d'amélioration de la sécurité est-elle calculée ?",
        answer:
          "Nous comparons le score actuel de 1 à 10 de chaque pays avec ses relevés historiques et classons les pays selon la plus forte variation positive. Les scores étant recalculés chaque jour à partir de plus de 40 sources publiques, la tendance reflète des évolutions réelles des données sur les conflits, la criminalité, la santé, la gouvernance et l'environnement.",
      },
      {
        question: "Qu'est-ce qui fait progresser le score de sécurité d'un pays ?",
        answer:
          "Les moteurs typiques sont la fin ou la désescalade d'un conflit, la baisse de la criminalité, l'abaissement des avis gouvernementaux et de meilleurs indicateurs de santé ou de gouvernance. Chaque pilier alimente le score pondéré (conflits 30 %, criminalité 25 %, santé 20 %, gouvernance 15 %, environnement 10 %) : les améliorations des piliers les plus lourds font donc le plus bouger le score.",
      },
      {
        question: "Une tendance à l'amélioration signifie-t-elle qu'un pays est sûr à visiter ?",
        answer:
          "Pas nécessairement : un pays peut progresser rapidement tout en conservant un score absolu bas sur l'échelle de 1 à 10. Vérifiez toujours le score actuel et les avis gouvernementaux en vigueur, tous deux mis à jour quotidiennement, avant de planifier un voyage.",
      },
    ],
    pt: [
      {
        question: 'Como é calculada a tendência de melhora da segurança?',
        answer:
          'Comparamos a pontuação atual de 1 a 10 de cada país com seus registros históricos e classificamos os países pela maior variação positiva. Como as pontuações são recalculadas diariamente a partir de mais de 40 fontes públicas, a tendência captura mudanças reais nos dados de conflitos, criminalidade, saúde, governança e meio ambiente.',
      },
      {
        question: 'O que faz a pontuação de segurança de um país melhorar?',
        answer:
          'Os fatores típicos são o fim ou a desescalada de um conflito, a queda da criminalidade, a redução dos níveis de aviso pelos governos e melhores indicadores de saúde ou governança. Cada pilar alimenta a pontuação ponderada (conflitos 30%, criminalidade 25%, saúde 20%, governança 15%, meio ambiente 10%), então melhorias nos pilares de maior peso movem mais a pontuação.',
      },
      {
        question: 'Uma tendência de melhora significa que o país é seguro para visitar?',
        answer:
          'Não necessariamente: um país pode melhorar rapidamente e ainda ter uma pontuação absoluta baixa na escala de 1 a 10. Verifique sempre a pontuação atual e os avisos governamentais ativos, ambos atualizados diariamente, antes de planejar a viagem.',
      },
    ],
    zh: [
      {
        question: '安全改善趋势是如何计算的？',
        answer:
          '我们将每个国家当前的 1-10 安全评分与其历史数据快照进行比较，并按最大正向变化排序。由于评分每天根据 40 多个公开数据源重新计算，该趋势反映的是冲突、犯罪、医疗、治理和环境数据的真实变化。',
      },
      {
        question: '是什么让一个国家的安全评分上升？',
        answer:
          '常见因素包括冲突结束或降级、犯罪率下降、政府下调旅行警告级别，以及医疗或治理指标改善。每个支柱都计入加权评分（冲突 30%、犯罪 25%、医疗 20%、治理 15%、环境 10%），因此权重越大的支柱改善对总分影响越大。',
      },
      {
        question: '改善趋势是否意味着该国适合前往旅行？',
        answer:
          '不一定——一个国家可能改善迅速，但在 1-10 分制中的绝对分数仍然偏低。出行前请务必查看当前评分和现行政府旅行警告，两者均每日更新。',
      },
    ],
    de: [
      {
        question: 'Wie wird der Trend zur Sicherheitsverbesserung berechnet?',
        answer:
          'Wir vergleichen den aktuellen 1-10-Sicherheitswert jedes Landes mit seinen historischen Datenständen und sortieren die Länder nach der größten positiven Veränderung. Da die Werte täglich aus über 40 öffentlichen Quellen neu berechnet werden, bildet der Trend reale Veränderungen bei Konflikt-, Kriminalitäts-, Gesundheits-, Regierungs- und Umweltdaten ab.',
      },
      {
        question: 'Wodurch verbessert sich der Sicherheitswert eines Landes?',
        answer:
          'Typische Treiber sind das Ende oder die Deeskalation eines Konflikts, sinkende Kriminalität, herabgestufte staatliche Reisehinweise sowie bessere Gesundheits- oder Governance-Indikatoren. Jede Säule fließt in den gewichteten Wert ein (Konflikt 30 %, Kriminalität 25 %, Gesundheit 20 %, Regierungsführung 15 %, Umwelt 10 %), Verbesserungen in den stärker gewichteten Säulen bewegen den Wert daher am meisten.',
      },
      {
        question: 'Bedeutet ein Verbesserungstrend, dass ein Land sicher zu bereisen ist?',
        answer:
          'Nicht unbedingt — ein Land kann sich schnell verbessern und dennoch einen niedrigen absoluten Wert auf der Skala von 1 bis 10 haben. Prüfen Sie vor der Reiseplanung immer den aktuellen Wert und aktive staatliche Reisehinweise, beide täglich aktualisiert.',
      },
    ],
  },

  'declining-safety': {
    en: [
      {
        question: 'How is the declining safety trend calculated?',
        answer:
          "We compare each country's current 1-10 score with historical snapshots and rank countries by the largest negative change. Scores are recomputed daily from 40+ public sources, so new conflicts, crime waves or advisory upgrades appear in the trend quickly.",
      },
      {
        question: "What causes a country's safety score to decline?",
        answer:
          'Common causes include new or escalating conflict, rising crime, political instability, disease outbreaks and natural disasters. The weighted methodology (conflict 30%, crime 25%, health 20%, governance 15%, environment 10%) means deteriorations in conflict and crime have the largest impact.',
      },
      {
        question: 'Should I cancel a trip to a country with declining safety?',
        answer:
          'A declining trend is a warning sign, not automatically a reason to cancel: a country can drop and still keep a solid score on the 1-10 scale. Review the absolute score, the affected pillars and current government advisories — all updated daily — before deciding.',
      },
    ],
    it: [
      {
        question: 'Come viene calcolato il trend di peggioramento della sicurezza?',
        answer:
          'Confrontiamo il punteggio attuale da 1 a 10 di ogni paese con gli snapshot storici e ordiniamo i paesi in base alla variazione negativa maggiore. I punteggi vengono ricalcolati ogni giorno da oltre 40 fonti pubbliche, quindi nuovi conflitti, ondate di criminalità o innalzamenti degli avvisi emergono rapidamente nel trend.',
      },
      {
        question: 'Cosa fa peggiorare il punteggio di sicurezza di un paese?',
        answer:
          'Le cause più comuni sono conflitti nuovi o in escalation, criminalità in aumento, instabilità politica, epidemie e disastri naturali. Con la metodologia ponderata (conflitti 30%, criminalità 25%, sanità 20%, governance 15%, ambiente 10%), i peggioramenti in conflitti e criminalità hanno l\'impatto maggiore.',
      },
      {
        question: 'Dovrei cancellare un viaggio verso un paese con sicurezza in calo?',
        answer:
          "Un trend in calo è un segnale d'allarme, non automaticamente un motivo per cancellare: un paese può peggiorare e mantenere comunque un punteggio solido sulla scala 1-10. Valuta il punteggio assoluto, i pilastri coinvolti e gli avvisi governativi attuali — tutti aggiornati quotidianamente — prima di decidere.",
      },
    ],
    es: [
      {
        question: '¿Cómo se calcula la tendencia de deterioro de la seguridad?',
        answer:
          'Comparamos la puntuación actual de 1 a 10 de cada país con sus registros históricos y ordenamos los países según el mayor cambio negativo. Las puntuaciones se recalculan cada día a partir de más de 40 fuentes públicas, por lo que los nuevos conflictos, las olas de delincuencia o las subidas de los avisos aparecen rápidamente en la tendencia.',
      },
      {
        question: '¿Qué hace que empeore la puntuación de seguridad de un país?',
        answer:
          'Las causas más comunes son conflictos nuevos o en escalada, aumento de la delincuencia, inestabilidad política, brotes de enfermedades y desastres naturales. Con la metodología ponderada (conflictos 30%, criminalidad 25%, salud 20%, gobernanza 15%, medio ambiente 10%), los deterioros en conflictos y criminalidad tienen el mayor impacto.',
      },
      {
        question: '¿Debería cancelar un viaje a un país con seguridad en declive?',
        answer:
          'Una tendencia a la baja es una señal de alerta, no automáticamente un motivo para cancelar: un país puede empeorar y mantener una puntuación sólida en la escala de 1 a 10. Revisa la puntuación absoluta, los pilares afectados y los avisos gubernamentales vigentes — todos actualizados a diario — antes de decidir.',
      },
    ],
    fr: [
      {
        question: 'Comment la tendance de dégradation de la sécurité est-elle calculée ?',
        answer:
          "Nous comparons le score actuel de 1 à 10 de chaque pays avec ses relevés historiques et classons les pays selon la plus forte variation négative. Les scores sont recalculés chaque jour à partir de plus de 40 sources publiques : nouveaux conflits, vagues de criminalité ou relèvements d'avis apparaissent donc rapidement dans la tendance.",
      },
      {
        question: "Qu'est-ce qui fait baisser le score de sécurité d'un pays ?",
        answer:
          "Les causes les plus fréquentes sont des conflits nouveaux ou en escalade, la hausse de la criminalité, l'instabilité politique, des épidémies et des catastrophes naturelles. Avec la méthodologie pondérée (conflits 30 %, criminalité 25 %, santé 20 %, gouvernance 15 %, environnement 10 %), les dégradations des piliers conflits et criminalité ont l'impact le plus fort.",
      },
      {
        question: 'Faut-il annuler un voyage vers un pays dont la sécurité se dégrade ?',
        answer:
          "Une tendance à la baisse est un signal d'alerte, pas automatiquement une raison d'annuler : un pays peut reculer tout en conservant un score solide sur l'échelle de 1 à 10. Examinez le score absolu, les piliers concernés et les avis gouvernementaux en vigueur — tous mis à jour quotidiennement — avant de décider.",
      },
    ],
    pt: [
      {
        question: 'Como é calculada a tendência de piora da segurança?',
        answer:
          'Comparamos a pontuação atual de 1 a 10 de cada país com os registros históricos e classificamos os países pela maior variação negativa. As pontuações são recalculadas todos os dias a partir de mais de 40 fontes públicas, então novos conflitos, ondas de criminalidade ou elevações de avisos aparecem rapidamente na tendência.',
      },
      {
        question: 'O que faz a pontuação de segurança de um país piorar?',
        answer:
          'As causas mais comuns são conflitos novos ou em escalada, aumento da criminalidade, instabilidade política, surtos de doenças e desastres naturais. Com a metodologia ponderada (conflitos 30%, criminalidade 25%, saúde 20%, governança 15%, meio ambiente 10%), as deteriorações em conflitos e criminalidade têm o maior impacto.',
      },
      {
        question: 'Devo cancelar uma viagem para um país com segurança em declínio?',
        answer:
          'Uma tendência de queda é um sinal de alerta, não automaticamente um motivo para cancelar: um país pode piorar e ainda manter uma pontuação sólida na escala de 1 a 10. Avalie a pontuação absoluta, os pilares afetados e os avisos governamentais vigentes — todos atualizados diariamente — antes de decidir.',
      },
    ],
    zh: [
      {
        question: '安全恶化趋势是如何计算的？',
        answer:
          '我们将每个国家当前的 1-10 评分与历史数据快照进行比较，并按最大负向变化排序。评分每天根据 40 多个公开数据源重新计算，因此新的冲突、犯罪潮或警告升级会很快体现在趋势中。',
      },
      {
        question: '是什么导致一个国家的安全评分下降？',
        answer:
          '常见原因包括新发或升级的冲突、犯罪上升、政局不稳、疫情暴发和自然灾害。在加权方法论（冲突 30%、犯罪 25%、医疗 20%、治理 15%、环境 10%）下，冲突和犯罪支柱的恶化影响最大。',
      },
      {
        question: '我应该取消前往安全状况恶化国家的行程吗？',
        answer:
          '下行趋势是一个警示信号，但并不自动意味着需要取消行程：一个国家评分下滑后仍可能在 1-10 分制中保持较高水平。请在决定前综合查看绝对评分、受影响的支柱以及现行政府旅行警告——所有数据均每日更新。',
      },
    ],
    de: [
      {
        question: 'Wie wird der Trend zur Sicherheitsverschlechterung berechnet?',
        answer:
          'Wir vergleichen den aktuellen 1-10-Wert jedes Landes mit historischen Datenständen und sortieren die Länder nach der größten negativen Veränderung. Die Werte werden täglich aus über 40 öffentlichen Quellen neu berechnet, sodass neue Konflikte, Kriminalitätswellen oder hochgestufte Warnungen schnell im Trend erscheinen.',
      },
      {
        question: 'Wodurch verschlechtert sich der Sicherheitswert eines Landes?',
        answer:
          'Häufige Ursachen sind neue oder eskalierende Konflikte, steigende Kriminalität, politische Instabilität, Krankheitsausbrüche und Naturkatastrophen. In der gewichteten Methodik (Konflikt 30 %, Kriminalität 25 %, Gesundheit 20 %, Regierungsführung 15 %, Umwelt 10 %) wirken sich Verschlechterungen bei Konflikt und Kriminalität am stärksten aus.',
      },
      {
        question: 'Sollte ich eine Reise in ein Land mit sinkender Sicherheit absagen?',
        answer:
          'Ein Abwärtstrend ist ein Warnsignal, aber nicht automatisch ein Grund zur Absage: Ein Land kann absinken und dennoch einen soliden Wert auf der 1-10-Skala behalten. Prüfen Sie vor der Entscheidung den absoluten Wert, die betroffenen Säulen und die aktuellen staatlichen Reisehinweise — alle täglich aktualisiert.',
      },
    ],
  },
};

export function getHubFaq(hubType: HubType, lang: Lang): HubFaqItem[] {
  return HUB_FAQ[hubType][lang] ?? HUB_FAQ[hubType].en;
}
