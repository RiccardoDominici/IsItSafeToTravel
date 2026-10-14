import type { RawIndicator, RawSourceData } from '../types.js';

/**
 * Formula v10 max-age filter (SPEC §1.2 and §6).
 *
 * A non-advisory indicator whose data year is older than (run year - maxAgeYears) is
 * treated as missing. The filter runs once per scoring run, BEFORE pillar computation
 * and BEFORE source counting, so a source whose rows for a country are all too old
 * does not count toward that country's minimum-source rule either.
 *
 * Exempt rows:
 *  - Government advisories: they are current by construction (fetched daily), and
 *    their `year` field is not a data vintage.
 *  - wb_population: never scored, only damps wb_homicide's precision (engine.ts
 *    P_HALF). Dropping a stale population would raise that precision, the opposite of
 *    the conservative intent, and populations change slowly.
 */

/** Indicators that are engine inputs rather than scored values, exempt from the age rule. */
export const MAX_AGE_EXEMPT_INDICATORS: ReadonlySet<string> = new Set(['wb_population']);

export interface DroppedIndicator {
  source: string;
  countryIso3: string;
  indicatorName: string;
  year: number;
}

export interface MaxAgeResult {
  /** The same sources, with stale rows removed. Sources are copied, never mutated. */
  data: Map<string, RawSourceData>;
  /** First year that is still accepted (run year - maxAgeYears). */
  minYear: number;
  dropped: DroppedIndicator[];
}

/** True for rows that come from a government advisory source. */
export function isAdvisoryRow(sourceKey: string, ind: RawIndicator): boolean {
  return (
    sourceKey.startsWith('advisories') ||
    ind.source.startsWith('advisories') ||
    ind.indicatorName.startsWith('advisory_level_')
  );
}

/**
 * Drop stale non-advisory rows. With `maxAgeYears` undefined (pre-v10 or synthetic
 * configs) the input is returned unchanged (same Map instance, nothing dropped).
 */
export function applyMaxAge(
  rawDataBySource: Map<string, RawSourceData>,
  runYear: number,
  maxAgeYears: number | undefined,
): MaxAgeResult {
  if (maxAgeYears === undefined || !Number.isFinite(maxAgeYears)) {
    return { data: rawDataBySource, minYear: Number.NEGATIVE_INFINITY, dropped: [] };
  }

  const minYear = runYear - maxAgeYears;
  const data = new Map<string, RawSourceData>();
  const dropped: DroppedIndicator[] = [];

  for (const [key, sourceData] of rawDataBySource) {
    const kept: RawIndicator[] = [];
    for (const ind of sourceData.indicators) {
      const stale =
        !isAdvisoryRow(key, ind) &&
        !MAX_AGE_EXEMPT_INDICATORS.has(ind.indicatorName) &&
        typeof ind.year === 'number' &&
        Number.isFinite(ind.year) &&
        ind.year < minYear;
      if (stale) {
        dropped.push({ source: key, countryIso3: ind.countryIso3.toUpperCase(), indicatorName: ind.indicatorName, year: ind.year });
      } else {
        kept.push(ind);
      }
    }
    data.set(key, kept.length === sourceData.indicators.length ? sourceData : { ...sourceData, indicators: kept });
  }

  return { data, minYear, dropped };
}

/**
 * One log line per indicator: how many rows were dropped and which country/year pairs
 * (sorted by country), e.g. "[MAX-AGE] wb_homicide: 75 row(s) older than 2021 dropped: AFG 2016, ...".
 */
export function formatMaxAgeLog(result: MaxAgeResult): string[] {
  if (result.dropped.length === 0) {
    return Number.isFinite(result.minYear)
      ? [`[MAX-AGE] No indicator older than ${result.minYear} (all data within the age limit)`]
      : [];
  }
  const byIndicator = new Map<string, DroppedIndicator[]>();
  for (const d of result.dropped) {
    const list = byIndicator.get(d.indicatorName);
    if (list) list.push(d);
    else byIndicator.set(d.indicatorName, [d]);
  }
  const lines = [
    `[MAX-AGE] ${result.dropped.length} row(s) with data year < ${result.minYear} treated as missing (${byIndicator.size} indicator(s))`,
  ];
  for (const [indicator, rows] of [...byIndicator].sort((a, b) => a[0].localeCompare(b[0]))) {
    const pairs = [...rows]
      .sort((a, b) => a.countryIso3.localeCompare(b.countryIso3))
      .map((r) => `${r.countryIso3} ${r.year}`)
      .join(', ');
    lines.push(`[MAX-AGE] ${indicator}: ${rows.length} row(s) dropped: ${pairs}`);
  }
  return lines;
}
