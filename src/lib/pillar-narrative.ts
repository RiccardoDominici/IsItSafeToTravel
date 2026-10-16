/**
 * Pillar sentences shared by the top summary (country-summary.ts) and the FAQ (seo.ts), built from
 * the one focus selection in pillar-focus.ts and the one advisory count in advisory-consensus.ts.
 *
 * WHY: the 2026-10-15 audit found the summary, the meta description and the FAQ naming different
 * "main risks" and "strongest areas" on the same page (I01 I02 I05 I16 I25 I30). Building every
 * pillar sentence here, from the same selection and the same copy table
 * (src/i18n/country-summary-copy.ts), makes the surfaces agree by construction: they can only
 * differ in how much they say, never in what they say.
 *
 * Pure: no I/O.
 */
import type { Lang } from '../i18n/ui';
import { countrySummaryCopy } from '../i18n/country-summary-copy';
import type { AdvisoryConsensus } from './advisory-consensus';
import { describeDriver, selectBadDriver } from './indicator-display';
import { formatTenths } from './display-number';
import { DIRECT_RISK_PILLARS, type PillarFocus, type PillarView } from './pillar-focus';

export function fillTemplate(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => slots[key] ?? match);
}

/** "a", "a and b", "a, b and c" with the locale's separators (zh: "a，b，c", for clauses). */
export function joinList(items: readonly string[], lang: Lang): string {
  const copy = countrySummaryCopy[lang];
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(copy.listSeparator)}${copy.listLastSeparator}${items[items.length - 1]}`;
}

/** Like joinList for names and short items; zh enumerates them with 、 and 和 ("美国、英国和加拿大"). */
export function joinNames(items: readonly string[], lang: Lang): string {
  if (lang !== 'zh' || items.length <= 1) return joinList(items, lang);
  return `${items.slice(0, -1).join('、')}和${items[items.length - 1]}`;
}

/**
 * Italian articles before a number agree with how it is read: "degli 8 governi" (otto), "tutti gli
 * 11 governi" (undici), not "dei 8" / "tutti i 11" (a vowel sound takes "gli").
 */
export function fixItalianNumberArticles(text: string): string {
  return text.replace(/\b([Dd])ei (?=(?:8\d*|11)\b)/g, '$1egli ').replace(/\b([Tt])utti i (?=(?:8\d*|11)\b)/g, '$1utti gli ');
}

function area(p: PillarView, lang: Lang): string {
  return countrySummaryCopy[lang].pillarArea[p.name];
}

function value(p: PillarView, lang: Lang): string {
  return formatTenths(p.value, lang);
}

/** The bad-half driver of the focus pillar as {topic, fact}, or null when its indicators are not bad. */
export function describeFocusDriver(focus: PillarFocus, lang: Lang): { topic: string; fact: string } | null {
  const driver = selectBadDriver(focus.focus.source);
  return driver ? describeDriver(driver, lang) : null;
}

/**
 * "11 of 21 governments advise reconsidering travel or avoiding it altogether" — only when a strict
 * majority advises reconsidering travel or against all travel (null otherwise). `avoid`: count only
 * the level-4 advisories ("20 of 23 governments advise against all travel"), for a strict majority.
 */
export function buildAdviceClause(consensus: AdvisoryConsensus, lang: Lang, mode: 'reconsiderOrWorse' | 'avoid' = 'reconsiderOrWorse'): string | null {
  if (mode === 'avoid' ? !consensus.majorityAvoid : !consensus.majorityReconsiderOrWorse) return null;
  const copy = countrySummaryCopy[lang];
  const { n, counts } = consensus;
  const k = mode === 'avoid' ? counts[4] : consensus.reconsiderOrWorse;
  const subject = k === n ? (n === 1 ? copy.adviceSubject.one : copy.adviceSubject.all) : copy.adviceSubject.some;
  const plural = !(k === n && n === 1) ? 1 : 0;
  const verb = counts[4] === k ? copy.levelPhrases[4][plural] : counts[3] === k ? copy.levelPhrases[3][plural] : copy.adviceMixed;
  const clause = fillTemplate(`${subject}${lang === 'zh' ? '' : ' '}${verb}`, { n: String(n), k: String(k) });
  return lang === 'it' ? fixItalianNumberArticles(clause) : clause;
}

/** {advice} as written, {Advice} capitalised (German starts a full sentence after a colon with a capital). */
export function adviceSlots(advice: string): { advice: string; Advice: string } {
  return { advice, Advice: advice.charAt(0).toUpperCase() + advice.slice(1) };
}

/**
 * The advisory clause a page leads with: the level-4 count when most governments say do not travel
 * ("23 of 24 governments advise against all travel"), otherwise the level-3-or-worse count.
 */
export function buildStrongestAdviceClause(consensus: AdvisoryConsensus, lang: Lang): string | null {
  return consensus.majorityAvoid ? buildAdviceClause(consensus, lang, 'avoid') : buildAdviceClause(consensus, lang);
}

/** True when the focus is conflict, no indicator of it is bad, and most governments advise reconsidering travel or worse. */
function isAdvisoryDriven(focus: PillarFocus, consensus: AdvisoryConsensus, lang: Lang): boolean {
  return focus.focus.name === 'conflict' && describeFocusDriver(focus, lang) === null && consensus.majorityReconsiderOrWorse;
}

/**
 * The sentence naming the focus pillar. `withFact`: quote the driver indicator with its source value
 * when it is bad (summary), or name the pillar with its /10 value only (FAQ answer 1). When no
 * indicator explains a conflict focus, buildAdvisoryPressureSentence gives the real cause.
 */
export function buildFocusSentences(focus: PillarFocus, lang: Lang, withFact: boolean): string[] {
  const copy = countrySummaryCopy[lang];
  const p = focus.focus;
  const slots = { pillar: area(p, lang), score: value(p, lang) };
  const described = withFact ? describeFocusDriver(focus, lang) : null;
  switch (focus.frame) {
    case 'mainRisk':
    case 'concern':
      // Pillar and its /10 value first, then the indicator: the reader sees the bar's number before
      // a source value on another scale (native-editor review, 2026-10-15).
      if (described) return [fillTemplate(focus.frame === 'mainRisk' ? copy.driverMainRisk : copy.driverConcern, { ...slots, ...described })];
      return [fillTemplate(focus.frame === 'mainRisk' ? copy.mainRiskPlain : copy.concernPlain, slots)];
    case 'weakest':
      return [described ? fillTemplate(copy.driverWeakest, { ...slots, ...described }) : fillTemplate(copy.weakestPlain, slots)];
    case 'allGood':
      return [fillTemplate(focus.allFiveAtLeast7 ? copy.allGood : copy.allGoodMeasured, slots)];
  }
}

/**
 * Government advice, not an indicator, holds the conflict focus down: say so, with the advisory
 * count, or `short` without it when an advisoryLead sentence has already given the numbers.
 */
export function buildAdvisoryPressureSentence(focus: PillarFocus, lang: Lang, consensus: AdvisoryConsensus, short = false): string | null {
  if (!isAdvisoryDriven(focus, consensus, lang)) return null;
  const copy = countrySummaryCopy[lang];
  const pillar = area(focus.focus, lang);
  if (short) return fillTemplate(copy.advisoryPressureShort, { pillar });
  const advice = buildAdviceClause(consensus, lang);
  return advice ? fillTemplate(copy.advisoryPressure, { pillar, ...adviceSlots(advice) }) : null;
}

/**
 * When most governments advise reconsidering travel or worse, that is the strongest signal on the
 * page and the summary says it first, before any pillar (Kuwait 6.9 with 17 of 21 governments at
 * level 3-4 led with "the main concern is natural hazards").
 */
export function buildAdvisoryLeadSentence(consensus: AdvisoryConsensus, lang: Lang): string | null {
  const advice = buildStrongestAdviceClause(consensus, lang);
  return advice ? fillTemplate(countrySummaryCopy[lang].advisoryLead, adviceSlots(advice)) : null;
}

/** "The health score is the same (6.6/10)." / "… almost as low (3.2/10)." for a (near-)tie with the focus. */
export function buildTieSentence(focus: PillarFocus, lang: Lang): string | null {
  const tie = focus.focusTie;
  if (!tie) return null;
  const copy = countrySummaryCopy[lang];
  return fillTemplate(focus.focusTieExact ? copy.tieExact : copy.tieNear, { pillar: area(tie, lang), score: value(tie, lang) });
}

/**
 * Governance shown below a direct-risk focus: named as context rather than left as an unexplained
 * lower bar. `template` lets the FAQ use its longer form (what it means for a visitor).
 */
export function buildGovernanceContext(focus: PillarFocus, lang: Lang, template = countrySummaryCopy[lang].governanceContext): string | null {
  const g = focus.governanceContext;
  // Compared with the focus pillar by name and value: "lower still" after an indicator sentence
  // had no referent (native-editor review, 2026-10-15).
  return g ? fillTemplate(template, { score: value(g, lang), focus: area(focus.focus, lang), focusScore: value(focus.focus, lang) }) : null;
}

/**
 * Estimated (asterisked) bars that sit below what the text says, flagged as estimates with their
 * value; then the bars that read "No data", named without one ("There is no data on crime yet":
 * a number there would contradict the bar, task 7).
 */
export function buildEstimatesSentence(focus: PillarFocus, lang: Lang): string | null {
  const copy = countrySummaryCopy[lang];
  const sentences: string[] = [];
  const list = focus.lowerEstimates;
  if (list.length > 0) {
    const items = list.map((p) => fillTemplate(copy.estimateItem, { pillar: area(p, lang), score: value(p, lang) }));
    sentences.push(fillTemplate(list.length === 1 ? copy.estimates.one : copy.estimates.other, { list: joinNames(items, lang) }));
  }
  const none = focus.noData;
  if (none.length > 0) {
    const names = joinNames(none.map((p) => area(p, lang)), lang);
    sentences.push(fillTemplate(none.length === 1 ? copy.noDataPillars.one : copy.noDataPillars.other, { list: names }));
  }
  return sentences.length > 0 ? sentences.join(lang === 'zh' ? '' : ' ') : null;
}

/**
 * The best-rated area: a strength only at 7.0+ ("Its best-rated area is health (8.9/10)"); below that,
 * with `includeWeak`, "Even its best-rated area, health, scores only 4.1/10" (I16), else nothing.
 */
export function buildBestSentence(focus: PillarFocus, lang: Lang, includeWeak: boolean): string | null {
  const best = focus.best;
  if (!best) return null;
  const copy = countrySummaryCopy[lang];
  const tie = focus.bestTie;
  const slots = { pillar: area(best, lang), pillar2: tie ? area(tie, lang) : '', score: value(best, lang) };
  if (focus.bestIsStrength) return fillTemplate(tie ? copy.strongAreaTie : copy.strongArea, slots);
  return includeWeak ? fillTemplate(tie ? copy.weakBestTie : copy.weakBest, slots) : null;
}

/**
 * True when a DIRECT-risk pillar is displayed below 7.0 only as an estimate, or reads "No data"
 * (weakest frame wording: "among the areas measured with enough data").
 */
export function hasLowDirectEstimate(focus: PillarFocus): boolean {
  return [...focus.lowerEstimates, ...focus.noData].some((p) => DIRECT_RISK_PILLARS.has(p.name));
}
