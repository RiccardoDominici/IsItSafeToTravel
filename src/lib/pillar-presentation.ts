/**
 * How the country page presents the pillars and their indicators (PillarBreakdown.astro), beyond
 * the per-indicator formatting in indicator-display.ts:
 *
 *  - Estimated pillars (audit I31). A pillar with no measured indicator behind it has no data of
 *    its own: the engine's Bayesian shrinkage collapses it to the conservative regional prior
 *    (scoring/engine.ts shrinkPillar, n = 0). Printing that prior as "Crime 5.7/10" made it look
 *    measured on 16 scored places (Pacific islands, Cabo Verde, Taiwan's health...), so the page
 *    labels it "No data" and says a cautious estimate stands in for it in the overall score.
 *
 *  - Country context indicators (audit I34, owner decision 2026-10-15). GPI militarisation and the
 *    V-Dem public-administration and corruption measures describe the state, not anything a
 *    traveller meets, so they move out of the main indicator tables into a collapsed "Country
 *    context" section. They stay in the score: this is display only, the engine is untouched.
 *
 * Pure module (weights.json only), so the rules are unit-tested without rendering.
 */
import weightsConfig from '../pipeline/config/weights.json';
import type { IndicatorScore, PillarScore, WeightsConfig } from '../pipeline/types';
import type { IndicatorValueDisplay } from './indicator-display';
import { roundForDisplay } from './display-number';

/** One row of an indicator table (IndicatorTable.astro), already in display form. */
export interface IndicatorRow {
  ind: IndicatorScore;
  label: string;
  display: IndicatorValueDisplay | null;
  source: string;
  worldBank: boolean;
  /** Optional small line under the label (the country-context rows: "Counts toward: Conflict"). */
  note?: string;
}

/**
 * Scored indicators shown under "Country context" instead of the main indicator tables. One that
 * the formula stops scoring simply disappears from both (displayedIndicators lists scored ones only).
 */
export const COUNTRY_CONTEXT_INDICATORS: ReadonlySet<string> = new Set([
  'gpi_militarisation',
  'vdem_gov_effectiveness', // "Impartial public administration (V-Dem)"
  'vdem_corruption_control', // "Political corruption (V-Dem)"
]);

/** True for an indicator shown under "Country context" rather than in the main table. */
export function isCountryContextIndicator(name: string): boolean {
  return COUNTRY_CONTEXT_INDICATORS.has(name);
}

/** Split a pillar's displayed indicators into the traveller table and the country-context rows (order kept). */
export function splitContextIndicators<T extends Pick<IndicatorScore, 'name'>>(
  indicators: readonly T[],
): { traveller: T[]; context: T[] } {
  const traveller: T[] = [];
  const context: T[] = [];
  for (const ind of indicators) (isCountryContextIndicator(ind.name) ? context : traveller).push(ind);
  return { traveller, context };
}

type PillarDef = WeightsConfig['pillars'][number];
const PILLAR_DEFS: ReadonlyMap<string, PillarDef> = new Map(
  (weightsConfig.pillars as unknown as PillarDef[]).map((p) => [p.name, p]),
);

/**
 * True when the displayed overall score is above every displayed pillar bar (audit I47; BRA, DNK,
 * EST, KEN and THA on 2026-10-15). Not an error: the bars show each pillar as 10·p on 0-10, while
 * the engine combines the pillars (weighted geometric mean, the conflict/crime soft-min and the
 * severe-advisory factor, scoring/engine.ts composeScore) and maps the result with
 * 1 + 9·composite^0.96 onto its own 1-10 scale, which sits above 10·composite everywhere below 10;
 * the community adjustment can add up to ±1 on top. The page then explains it in a note.
 * Compared on the printed one-decimal values; estimated pillars print no number and are skipped.
 */
export function scoreAboveAllBars(score: number | null | undefined, pillars: readonly PillarScore[]): boolean {
  if (typeof score !== 'number' || !Number.isFinite(score)) return false;
  const bars = pillars.filter((p) => !isEstimatedPillar(p)).map((p) => roundForDisplay(p.score * 10, 1));
  if (bars.length === 0) return false;
  return roundForDisplay(score, 1) > Math.max(...bars);
}

/**
 * True when nothing measured stands behind the pillar's value: none of its indicators with a
 * positive evidence weight is present, and (conflict) no government advisory feeds the synthetic
 * advisory-consensus slot "A". The value is then the engine's regional prior, an estimate.
 *
 * Zero-precision alert feeds (ReliefWeb, GDACS) do not count as measurements: the engine gives
 * them no evidence weight, so a pillar resting on them alone is still the prior. The advisory slot
 * is not listed in `indicators`; it is present when dataCompleteness counts more found slots than
 * the listed indicators account for.
 */
export function isEstimatedPillar(pillar: PillarScore): boolean {
  const def = PILLAR_DEFS.get(pillar.name);
  if (!def) return pillar.dataCompleteness === 0;
  const listed = pillar.indicators.filter((ind) => def.indicators.includes(ind.name));
  const measured = listed.some((ind) => (def.indicatorPrecision?.[ind.name] ?? 1) > 0);
  if (measured) return false;
  if (def.indicators.includes('A')) {
    const foundSlots = Math.round(pillar.dataCompleteness * def.indicators.length);
    if (foundSlots > listed.length) return false;
  }
  return true;
}
