/**
 * Data-coverage floor (formula v10, SPEC §4): ONE definition of "how many independent sources
 * cover a place", shared by
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

/** True when the place has at least MIN_COVERAGE_SOURCES coverage sources. */
export function meetsCoverageFloor(sources: ReadonlyArray<{ name?: string }> | undefined): boolean {
  return coverageSourceCount(sources) >= MIN_COVERAGE_SOURCES;
}
