/**
 * Copy for the pillar bars and indicator tables on the country page (PillarBreakdown.astro), all 7
 * locales: the "No data" state of an estimated pillar (audit I31), the low-coverage note, and the
 * collapsed "Country context" section (audit I34). Rules in src/lib/pillar-presentation.ts.
 *
 * WHY a module instead of ui.ts: ui.ts is a merge hot spot shared by several workstreams this round
 * (same precedent as community-copy.ts and grey-copy.ts). The low-coverage note moved here from
 * ui.ts `country.pillar_low_coverage_note`, whose wording ("its contribution to the overall score
 * is reduced or excluded") described an older formula: since v9 a thinly covered pillar is pulled
 * toward a cautious regional estimate, never dropped. zh uses full-width punctuation throughout.
 */
import type { Lang } from './ui';

const NBSP = ' '; // French: no line break before : ; ? !

export interface PillarPresentationCopy {
  /** Shown in place of "5.7/10" for a pillar with nothing measured behind it. */
  noData: string;
  /** Why an estimated pillar has no number, and what the overall score uses instead. */
  estimateNote: string;
  /** Asterisk note on a pillar with low (but not zero) data coverage. */
  lowCoverageNote: string;
  /** Summary of the collapsed section. */
  contextSummary: string;
  /** One-paragraph explanation at the top of the section: why apart, why still in the score. */
  contextIntro: string;
  /** Small line under each context indicator. {pillar} = the localized pillar name. */
  contextCountsIn: string;
  /**
   * Under the bars when the overall score is above every bar (audit I47): it is not an average of
   * them. Wording checked against scoring/engine.ts composeScore: pillars combined, then
   * 1 + 9·composite^0.96 on a 1-10 scale, then the community adjustment. {link} = the link below.
   */
  scoreAboveBarsNote: string;
  /** Text of the methodology link inside scoreAboveBarsNote. */
  scoreAboveBarsLinkText: string;
}

export const pillarPresentationCopy: Record<Lang, PillarPresentationCopy> = {
  en: {
    noData: 'No data',
    estimateNote: 'No source measures this category here yet, so the overall score uses a cautious regional estimate in its place.',
    lowCoverageNote: 'Little data covers this category here, so its value leans toward a cautious regional estimate.',
    contextSummary: 'Country context',
    contextIntro:
      'These indicators describe the state itself rather than what a visitor meets day to day, so they are listed apart. They still count in the score of the category shown with each one, because they say how stable the country is and how its institutions work.',
    contextCountsIn: 'Counts toward: {pillar}',
    scoreAboveBarsNote:
      'The overall score is not an average of these bars. Each bar shows one category on a 0–10 scale; the score combines the categories and places the result on its own 1–10 scale, so it can sit above every bar. It can also include the community adjustment. {link}',
    scoreAboveBarsLinkText: 'How the score is calculated',
  },
  it: {
    noData: 'Nessun dato',
    estimateNote: 'Nessuna fonte misura ancora questa categoria qui, quindi il punteggio complessivo usa al suo posto una stima regionale prudente.',
    lowCoverageNote: 'Pochi dati coprono questa categoria qui, quindi il suo valore tende verso una stima regionale prudente.',
    contextSummary: 'Contesto del paese',
    contextIntro:
      'Questi indicatori descrivono lo Stato in sé, non ciò che un viaggiatore incontra ogni giorno, perciò sono elencati a parte. Contano comunque nel punteggio della categoria indicata accanto a ciascuno, perché dicono quanto è stabile il paese e come funzionano le sue istituzioni.',
    contextCountsIn: 'Rientra in: {pillar}',
    scoreAboveBarsNote:
      'Il punteggio complessivo non è una media di queste barre. Ogni barra mostra una categoria su una scala da 0 a 10; il punteggio combina le categorie e colloca il risultato su una propria scala da 1 a 10, quindi può superare tutte le barre. Può anche includere la correzione della community. {link}',
    scoreAboveBarsLinkText: 'Come si calcola il punteggio',
  },
  es: {
    noData: 'Sin datos',
    estimateNote: 'Ninguna fuente mide todavía esta categoría aquí, así que la puntuación general usa en su lugar una estimación regional prudente.',
    lowCoverageNote: 'Hay pocos datos sobre esta categoría aquí, así que su valor se acerca a una estimación regional prudente.',
    contextSummary: 'Contexto del país',
    contextIntro:
      'Estos indicadores describen el propio Estado, no lo que un viajero encuentra en el día a día, por eso aparecen aparte. Siguen contando en la puntuación de la categoría indicada junto a cada uno, porque reflejan lo estable que es el país y cómo funcionan sus instituciones.',
    contextCountsIn: 'Forma parte de: {pillar}',
    scoreAboveBarsNote:
      'La puntuación general no es una media de estas barras. Cada barra muestra una categoría en una escala de 0 a 10; la puntuación combina las categorías y sitúa el resultado en su propia escala de 1 a 10, por lo que puede quedar por encima de todas las barras. También puede incluir el ajuste de la comunidad. {link}',
    scoreAboveBarsLinkText: 'Cómo se calcula la puntuación',
  },
  fr: {
    noData: 'Pas de données',
    estimateNote: `Aucune source ne mesure encore cette catégorie ici${NBSP}: le score global utilise donc à sa place une estimation régionale prudente.`,
    lowCoverageNote: `Peu de données couvrent cette catégorie ici${NBSP}: sa valeur se rapproche donc d’une estimation régionale prudente.`,
    contextSummary: 'Contexte du pays',
    contextIntro:
      'Ces indicateurs décrivent l’État lui-même, et non ce qu’un voyageur rencontre au quotidien, c’est pourquoi ils sont présentés à part. Ils comptent toujours dans le score de la catégorie indiquée pour chacun, car ils disent à quel point le pays est stable et comment fonctionnent ses institutions.',
    contextCountsIn: `Fait partie de${NBSP}: {pillar}`,
    scoreAboveBarsNote: `Le score global n’est pas une moyenne de ces barres. Chaque barre montre une catégorie sur une échelle de 0 à 10${NBSP}; le score combine les catégories et place le résultat sur sa propre échelle de 1 à 10, il peut donc dépasser toutes les barres. Il peut aussi inclure l’ajustement communautaire. {link}`,
    scoreAboveBarsLinkText: 'Comment le score est calculé',
  },
  pt: {
    noData: 'Sem dados',
    estimateNote: 'Nenhuma fonte mede ainda esta categoria aqui, por isso a pontuação geral usa em seu lugar uma estimativa regional prudente.',
    lowCoverageNote: 'Há poucos dados sobre esta categoria aqui, por isso o seu valor se aproxima de uma estimativa regional prudente.',
    contextSummary: 'Contexto do país',
    contextIntro:
      'Estes indicadores descrevem o próprio Estado, e não o que um viajante encontra no dia a dia, por isso aparecem separados. Eles continuam contando na pontuação da categoria indicada em cada um, porque mostram o quanto o país é estável e como funcionam suas instituições.',
    contextCountsIn: 'Faz parte de: {pillar}',
    scoreAboveBarsNote:
      'A pontuação geral não é uma média destas barras. Cada barra mostra uma categoria em uma escala de 0 a 10; a pontuação combina as categorias e coloca o resultado em sua própria escala de 1 a 10, por isso pode ficar acima de todas as barras. Ela também pode incluir o ajuste da comunidade. {link}',
    scoreAboveBarsLinkText: 'Como a pontuação é calculada',
  },
  zh: {
    noData: '暂无数据',
    estimateNote: '目前还没有任何来源衡量该地的这一类别，因此总体评分以审慎的区域估计值代替。',
    lowCoverageNote: '该地这一类别的数据较少，因此其数值偏向审慎的区域估计值。',
    contextSummary: '国家背景',
    contextIntro:
      '这些指标描述的是国家本身，而不是旅行者日常会遇到的情况，因此单独列出。它们仍计入各自所标注类别的评分，因为它们反映了该国的稳定程度及其机构的运作方式。',
    contextCountsIn: '计入：{pillar}',
    scoreAboveBarsNote:
      '总体评分并不是这些条形的平均值。每个条形以 0–10 分显示一个类别；总体评分将各类别综合后放在它自己的 1–10 分尺度上，因此可能高于所有条形。它还可能包含社区调整。{link}',
    scoreAboveBarsLinkText: '评分的计算方式',
  },
  de: {
    noData: 'Keine Daten',
    estimateNote: 'Noch keine Quelle misst diese Kategorie hier, daher verwendet die Gesamtbewertung an ihrer Stelle eine vorsichtige regionale Schätzung.',
    lowCoverageNote: 'Für diese Kategorie liegen hier nur wenige Daten vor, daher nähert sich ihr Wert einer vorsichtigen regionalen Schätzung an.',
    contextSummary: 'Länderkontext',
    contextIntro:
      'Diese Indikatoren beschreiben den Staat selbst, nicht das, was Reisende im Alltag erleben, und werden deshalb gesondert aufgeführt. Sie fließen weiterhin in die Bewertung der jeweils angegebenen Kategorie ein, weil sie zeigen, wie stabil das Land ist und wie seine Institutionen funktionieren.',
    contextCountsIn: 'Fließt ein in: {pillar}',
    scoreAboveBarsNote:
      'Die Gesamtbewertung ist kein Durchschnitt dieser Balken. Jeder Balken zeigt eine Kategorie auf einer Skala von 0 bis 10; die Gesamtbewertung kombiniert die Kategorien und setzt das Ergebnis auf ihre eigene Skala von 1 bis 10, daher kann sie über allen Balken liegen. Sie kann außerdem die Community-Anpassung enthalten. {link}',
    scoreAboveBarsLinkText: 'So wird die Bewertung berechnet',
  },
};
