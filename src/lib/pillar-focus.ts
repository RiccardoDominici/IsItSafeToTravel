/**
 * The ONE place that decides which pillar a country page talks about, and how (2026-10-15
 * consistency audit, issues I01 I02 I05 I16 I25 I30 I54).
 *
 * WHY: the meta description, the top summary and the three FAQ answers each used to pick their own
 * "main risk", "strongest area" and "weakest area" with different rules (weighted drag over the
 * direct-risk pillars, plain lowest eligible pillar, a 0.30 coverage gate that the bars ignore). One
 * page could call Mozambique's conflict pillar (5.5, its BEST bar) the main concern in the
 * description and the summary, and "Mozambique's strongest pillar" in the FAQ; Nauru said "all five
 * areas score at least 7" above bars showing 5.4 and 5.7. Every surface now reads this module.
 *
 * Rules (owner decisions, 2026-10-15):
 *  - Values are compared as DISPLAYED (one decimal, /10), so two bars that both read 6.6 are a tie,
 *    never "above all" one of them. Weighted drag only breaks an exact displayed tie.
 *  - A pillar flagged on the page as low-coverage (pillarEvidenceCoverage below
 *    LOW_COVERAGE_FLAG_THRESHOLD, the asterisk in PillarBreakdown) is an ESTIMATE: it is never
 *    named as a measured main risk or strength, and every sentence that would be contradicted by a
 *    lower estimated bar must say so (`lowerEstimates`).
 *  - The focus is the lowest DIRECT-RISK pillar (conflict, crime, health, natural hazards) below
 *    7.0: the blogger who prompted the v10 rewrite objected to "the biggest concern is governance".
 *    Governance is named as the focus only when every direct-risk pillar is at 7.0 or above; when
 *    it is lower than the focus, the page says so explicitly (`governanceContext`) instead of
 *    leaving a lower bar unexplained.
 *  - A pillar is a strength only at 7.0 or above (`bestIsStrength`); below that the best area is
 *    reported as "even the best-rated area ... only".
 *
 * Pure: no I/O, unit-tested in src/lib/__tests__/pillar-focus.test.ts.
 */
import type { PillarName, PillarScore } from '../pipeline/types';
import { LOW_COVERAGE_FLAG_THRESHOLD } from '../pipeline/scoring/engine';
import weightsConfig from '../pipeline/config/weights.json';
import { pillarEvidenceCoverage } from './indicator-display';
import { roundForDisplay } from './display-number';

/** A pillar at or above this displayed value (/10) is good in absolute terms: a "strength". */
export const STRONG_PILLAR_MIN = 7.0;
/** Below this displayed value (/10) the focus pillar is "the main risk", otherwise "the main concern". */
export const MAIN_RISK_MAX = 5.0;
/** Displayed spread (/10) at or below which all five pillars are "closely matched" (prior-only profiles). */
const FLAT_SPREAD = 0.5;
/**
 * A second candidate this close to the focus (displayed /10) is named with it: Iran's natural
 * hazards 3.1 and conflict 3.2 under 23 of 24 do-not-travel advisories read as "the main risk is
 * natural hazards" otherwise (native-editor review, 2026-10-15).
 */
const NEAR_TIE = 0.2;

/** The pillars a traveller meets directly; governance (institutions) is context. */
export const DIRECT_RISK_PILLARS: ReadonlySet<PillarName> = new Set<PillarName>(['conflict', 'crime', 'health', 'environment']);

/** Pillar weights of the current formula, only to break an exact displayed tie. */
const PILLAR_WEIGHT: ReadonlyMap<string, number> = new Map(weightsConfig.pillars.map((p) => [p.name, p.weight]));

/** One pillar as the page shows it. */
export interface PillarView {
  name: PillarName;
  /** Engine value, 0-1. */
  score: number;
  /** Displayed value on the /10 scale, one decimal (what the bar prints). */
  value: number;
  /** Shown with the low-coverage asterisk: a cautious estimate, not a measurement. */
  estimate: boolean;
  /** w * -ln(p): how much the pillar pulls the geometric mean down (tie-break only). */
  drag: number;
  /** The engine pillar it was built from (indicators, coverage). */
  source: PillarScore;
}

/** How the page frames the focus pillar. */
export type FocusFrame = 'mainRisk' | 'concern' | 'weakest' | 'allGood';

export interface PillarFocus {
  /** All pillars, weakest first, as the bars list them. */
  pillars: PillarView[];
  /** The pillar every surface names as main risk / main concern / weakest / lowest area. */
  focus: PillarView;
  /** Another candidate within NEAR_TIE of `focus` (displayed): named together, never ranked above it. */
  focusTie: PillarView | null;
  /** `focusTie` has exactly the focus's displayed value (otherwise it is "almost as low"). */
  focusTieExact: boolean;
  frame: FocusFrame;
  /** The next direct-risk pillar below 7.0 after the focus (mainRisk/concern only). */
  second: PillarView | null;
  /** Measured governance displayed BELOW a direct-risk focus: named as context, never hidden. */
  governanceContext: PillarView | null;
  /** The best measured pillar (null when it is the focus itself or the profile is flat). */
  best: PillarView | null;
  /** Another measured pillar with the same displayed value as `best`. */
  bestTie: PillarView | null;
  /** `best` is at 7.0 or above (a real strength). */
  bestIsStrength: boolean;
  /** Estimated pillars displayed below what the text claims (below the focus, or below 7.0 in the weakest/allGood frames). */
  lowerEstimates: PillarView[];
  /** Every displayed bar, estimates included, is at 7.0 or above. */
  allFiveAtLeast7: boolean;
  /** All bars within FLAT_SPREAD of each other: no meaningful weakest/strongest. */
  isFlat: boolean;
}

/** Displayed /10 value of a 0-1 pillar (4.4), as the bars print it (same rounding: display-number.ts). */
export function displayValue(score01: number): number {
  return roundForDisplay(score01 * 10, 1);
}

function toView(p: PillarScore): PillarView {
  return {
    name: p.name,
    score: p.score,
    value: displayValue(p.score),
    estimate: pillarEvidenceCoverage(p) < LOW_COVERAGE_FLAG_THRESHOLD,
    drag: (PILLAR_WEIGHT.get(p.name) ?? 0) * -Math.log(Math.max(0.02, p.score)),
    source: p,
  };
}

/** Ascending by displayed value; an exact displayed tie puts the larger drag first. */
function byValueThenDrag(a: PillarView, b: PillarView): number {
  return a.value - b.value || b.drag - a.drag;
}

/** Select the focus pillar and everything the narrative needs around it. */
export function selectPillarFocus(pillarScores: readonly PillarScore[]): PillarFocus {
  const pillars = pillarScores.map(toView).sort(byValueThenDrag);
  const measuredOnly = pillars.filter((p) => !p.estimate);
  // A country whose every pillar is an estimate: describe the estimates rather than nothing.
  const measured = measuredOnly.length > 0 ? measuredOnly : pillars;
  const weakDirect = measured.filter((p) => DIRECT_RISK_PILLARS.has(p.name) && p.value < STRONG_PILLAR_MIN);

  let pool: PillarView[];
  let frame: FocusFrame;
  if (weakDirect.length > 0) {
    pool = weakDirect;
    frame = weakDirect[0].value < MAIN_RISK_MAX ? 'mainRisk' : 'concern';
  } else {
    pool = measured;
    frame = measured[0].value < STRONG_PILLAR_MIN ? 'weakest' : 'allGood';
  }
  const focus = pool[0];
  const direct = frame === 'mainRisk' || frame === 'concern';
  // Near-ties only matter for a risk; in the weakest/allGood frames only an exact tie is named.
  // Compared in tenths, so 3.2 - 3.1 is not 0.10000000000000009.
  const tieTenths = direct ? Math.round(NEAR_TIE * 10) : 0;
  const focusTie = pool.find((p) => p !== focus && Math.round((p.value - focus.value) * 10) <= tieTenths) ?? null;

  const second = direct ? weakDirect.find((p) => p !== focus && p !== focusTie) ?? null : null;
  const governance = measured.find((p) => p.name === 'governance');
  const governanceContext = direct && governance && governance.value < focus.value ? governance : null;

  const highestFirst = [...measured].sort((a, b) => b.value - a.value || a.drag - b.drag);
  const top = highestFirst[0];
  const isFlat = pillars[pillars.length - 1].value - pillars[0].value <= FLAT_SPREAD;
  const best = top && top.value > focus.value && !isFlat ? top : null;
  const bestTie = best ? highestFirst.find((p) => p !== best && p.value === best.value) ?? null : null;

  const estimateCeiling = direct ? focus.value : STRONG_PILLAR_MIN;
  const lowerEstimates = measuredOnly.length > 0 ? pillars.filter((p) => p.estimate && p.value < estimateCeiling) : [];

  return {
    pillars,
    focus,
    focusTie,
    focusTieExact: focusTie !== null && focusTie.value === focus.value,
    frame,
    second,
    governanceContext,
    best,
    bestTie,
    bestIsStrength: best !== null && best.value >= STRONG_PILLAR_MIN,
    lowerEstimates,
    allFiveAtLeast7: pillars.every((p) => p.value >= STRONG_PILLAR_MIN),
    isFlat,
  };
}
