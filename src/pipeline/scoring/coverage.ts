/**
 * Data-coverage floor (formula v10, SPEC §4): ONE definition of "how many independent sources
 * cover a place" (and, since 2026-10-19, "does it have any crime data", REQUIRED_PILLARS), shared by
 *   - the engine's grey rule (scoring/engine.ts -> status.ts decideScoreStatus),
 *   - the rankings (src/lib/hub-data.ts hasSufficientData),
 *   - llms.txt (scripts/generate-llms-full.ts),
 *   - the news engine's rank-based events (news/engine.ts).
 * Before 2026-10-15 each of them counted `sources.length` against its own copy of the number 4.
 *
 * WHY the disaster-alert feeds are left out: a source counts toward the floor when it describes
 * the place whatever happens on a given day. GDACS and ReliefWeb list a place only while a
 * disaster is under way (31 and 77 places on 2026-10-15), so counting them made a place's
 * coverage depend on the weather: that day a GDACS alert gave Guam its fourth "source"
 * (advisories, World Bank, ReliefWeb, GDACS) and with it an official score resting on two real
 * datasets plus regional priors, which would have gone grey again once the alert expired. The
 * feeds still enter the natural-hazards pillar; they just never make a place's data sufficient.
 *
 * Pure and dependency-free: imported by the pipeline, the site and the scripts alike.
 */

/** Source keys (ScoredCountry.sources[].name) that appear only while an event is under way. */
export const EVENT_FEED_SOURCES: ReadonlySet<string> = new Set(['gdacs', 'reliefweb']);

/**
 * Minimum number of coverage sources for an official score and for the rankings. Must equal
 * weights.json formulaV9.minSources (the engine reads that value; a unit test pins the two).
 */
export const MIN_COVERAGE_SOURCES = 4;

/** A source key that lists a place only while a disaster is under way (GDACS, ReliefWeb). */
export function isEventFeedSource(name: string | undefined): boolean {
  return name !== undefined && EVENT_FEED_SOURCES.has(name);
}

/** Sources that count toward the floor: every entry except the disaster-alert feeds. */
export function coverageSourceCount(sources: ReadonlyArray<{ name?: string }> | undefined): number {
  if (!sources) return 0;
  return sources.filter((s) => !isEventFeedSource(s.name)).length;
}

/**
 * The source key of the government advisories. Its levels feed the advisory consensus A, a
 * synthetic indicator that never appears among the pillars' indicators.
 */
export const ADVISORY_SOURCE = 'advisories';

/**
 * A source supplies a value the score uses (owner rule, 2026-10-15, audit issue I29). Same logic
 * as the alert feeds above: a source is data FOR A PLACE only when the formula reads one of its
 * values for that place. The World Bank feed was listed, counted toward the floor and named in
 * the "combines N advisories and M other datasets" sentence for 96 places whose only World Bank
 * rows were the population (an engine input that only damps the homicide weight, so it means
 * nothing without a homicide rate) and series the formula no longer scores; for nine Pacific
 * and Asian places (BRN, FSM, KIR, MHL, NRU, PLW, TON, TUV, WSM) that "source" was the fourth.
 *
 * `scoredSources`: the source keys of the indicators the pillars actually used for this place
 * (IndicatorScore.source), plus ADVISORY_SOURCE when its advisory consensus was computed.
 */
export function suppliesScoredValue(name: string | undefined, scoredSources: ReadonlySet<string>): boolean {
  return name !== undefined && scoredSources.has(name);
}

/**
 * The place's sources that supply a value the score uses, in their original order: the list the
 * engine publishes in ScoredCountry.sources, so the floor (coverageSourceCount), the rankings,
 * llms.txt, the news engine, the provenance sentence and the page's source list all count the
 * same sources.
 */
export function sourcesSupplyingScoredValues<T extends { name?: string }>(
  sources: readonly T[],
  scoredSources: ReadonlySet<string>,
): T[] {
  return sources.filter((s) => suppliesScoredValue(s.name, scoredSources));
}

/**
 * Pillars that need at least one measured value for an official score, on top of the source
 * count (owner decision 2026-10-19). Must equal weights.json formulaV9.requiredPillars (the engine
 * reads that list; a unit test pins the two).
 *
 * WHY crime: with no GPI and no World Bank homicide rate the crime pillar is the conservative
 * prior alone. scripts/calibration/coverage-floor-study.ts removed those two sources from the 98
 * places that have all six and measured the scores 0.51 too low on average (half of them by 0.5
 * or more), as unreliable as the 3-source places the floor already greys; the count could not see
 * it, because the Caribbean 4-source places keep the homicide rate and are off by only 0.22.
 * Greyed on 2026-10-19: Comoros, Cabo Verde, Maldives, Solomon Islands, Sao Tome and Principe,
 * Vanuatu.
 */
export const REQUIRED_PILLARS: readonly string[] = ['crime'];

/** A pillar as published (ScoredCountry.pillars): what the coverage rule needs of it. */
export interface PillarCoverage {
  name: string;
  indicators?: ReadonlyArray<unknown>;
}

/**
 * The required pillars without a measured value. pillars[].indicators lists only the indicators
 * the engine found, so a required pillar present with an EMPTY list is the prior alone: missing.
 * Without that detail (no `pillars`, the pillar not listed, no `indicators` array: hand-built
 * records and test fixtures) nothing is known and nothing counts as missing. Every engine output
 * and snapshot carries all five pillars with their lists, so on real data the two readings agree;
 * the engine itself decides from its own indicator lists (engine.ts), not from this helper.
 */
export function missingRequiredPillars(
  pillars: ReadonlyArray<PillarCoverage> | undefined,
  required: readonly string[] = REQUIRED_PILLARS,
): string[] {
  if (!pillars) return [];
  return required.filter((name) => {
    const indicators = pillars.find((p) => p.name === name)?.indicators;
    return Array.isArray(indicators) && indicators.length === 0;
  });
}

/** Why a place falls short of the coverage rule, or null when it meets it. */
export type CoverageShortfall = 'sources' | 'crime';

/**
 * The reason a place falls short of the coverage rule: 'sources' (fewer than MIN_COVERAGE_SOURCES
 * coverage sources; checked first, so a 3-source place without crime data reads "fewer than four
 * sources") or 'crime' (enough sources, no crime value). The pages pick their explanation by it.
 */
export function coverageShortfall(place: {
  sources?: ReadonlyArray<{ name?: string }>;
  pillars?: ReadonlyArray<PillarCoverage>;
}): CoverageShortfall | null {
  if (coverageSourceCount(place.sources) < MIN_COVERAGE_SOURCES) return 'sources';
  if (missingRequiredPillars(place.pillars).length > 0) return 'crime';
  return null;
}

/**
 * True when the place meets the coverage rule: at least MIN_COVERAGE_SOURCES coverage sources and
 * a measured value in every required pillar. The rankings, llms.txt and the news engine use it, so
 * a place the danger guard keeps scored is still left out of the lists.
 */
export function meetsCoverageFloor(place: {
  sources?: ReadonlyArray<{ name?: string }>;
  pillars?: ReadonlyArray<PillarCoverage>;
}): boolean {
  return coverageShortfall(place) === null;
}
