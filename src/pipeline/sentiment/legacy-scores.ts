import type { VoteRow } from '../types.js';
import { listSnapshotDates, loadSnapshot } from '../scoring/snapshot.js';
import { SENTIMENT_LEGACY_FALLBACK_DAYS } from './constants.js';
import { needsLegacyLookup, utcDateOf, type PublishedScoreLookup } from './perceive.js';

/**
 * Anchor for legacy relative votes: the published score each country had on the vote's UTC date
 * (formula v10, SPEC §5). Read from the per-day score snapshots data/scores/YYYY-MM-DD.json,
 * never from the 50+ MB history index. Only the days that legacy votes actually need are loaded.
 */

/** Per-day published scores: iso3 -> score, null where that day's entry has no number (grey). */
export type DayScores = ReadonlyMap<string, number | null>;

export interface LegacyLookupStats {
  /** Needed dates that had their own snapshot. */
  exact: number;
  /** Needed dates served by the nearest earlier snapshot. */
  fallback: number;
  /** Needed dates with no snapshot at all within the fallback window. */
  missing: number;
}

/** Days from `earlier` to `later` (both YYYY-MM-DD, UTC). */
function daysBetween(earlier: string, later: string): number {
  return (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000;
}

/**
 * Pure core. For each needed UTC date, use that date's snapshot. If it has none, use the nearest
 * EARLIER snapshot within `maxFallbackDays`: that is the score the site was publishing then.
 * Never a later one, which would be a score from the future relative to the vote.
 *
 * @param neededDates - UTC dates of the legacy votes (duplicates allowed).
 * @param loadDay - Loads one date's scores; null when no snapshot exists for that exact date.
 * @param availableDates - Ascending YYYY-MM-DD dates that have snapshots.
 */
export function resolveLegacyLookup(
  neededDates: Iterable<string>,
  loadDay: (date: string) => DayScores | null,
  availableDates: readonly string[],
  maxFallbackDays = SENTIMENT_LEGACY_FALLBACK_DAYS,
): { lookup: PublishedScoreLookup; stats: LegacyLookupStats } {
  const cache = new Map<string, DayScores | null>();
  const load = (date: string): DayScores | null => {
    if (!cache.has(date)) cache.set(date, loadDay(date));
    return cache.get(date) ?? null;
  };

  const byDate = new Map<string, DayScores>();
  const stats: LegacyLookupStats = { exact: 0, fallback: 0, missing: 0 };

  for (const date of new Set(neededDates)) {
    const exact = load(date);
    if (exact) {
      byDate.set(date, exact);
      stats.exact++;
      continue;
    }

    let fallbackDate: string | null = null;
    for (let i = availableDates.length - 1; i >= 0; i--) {
      const candidate = availableDates[i];
      if (candidate >= date) continue;
      if (daysBetween(candidate, date) <= maxFallbackDays) fallbackDate = candidate;
      break;
    }

    const fallback = fallbackDate ? load(fallbackDate) : null;
    if (fallback) {
      byDate.set(date, fallback);
      stats.fallback++;
    } else {
      stats.missing++;
    }
  }

  const lookup: PublishedScoreLookup = {
    scoreOn: (iso3, utcDate) => byDate.get(utcDate)?.get(iso3) ?? null,
  };
  return { lookup, stats };
}

/** Read one day's snapshot into a DayScores map. null when the file is missing or unreadable. */
function readDayScores(date: string): DayScores | null {
  const snapshot = loadSnapshot(date);
  if (!snapshot || !Array.isArray(snapshot.countries)) return null;

  const scores = new Map<string, number | null>();
  for (const country of snapshot.countries) {
    const score: unknown = country.score;
    scores.set(country.iso3, typeof score === 'number' && Number.isFinite(score) ? score : null);
  }
  return scores;
}

/**
 * Build the legacy lookup for the votes in `votes`. Reads only the snapshot files those votes need
 * (plus any fallback file). Logs how each needed date was resolved, so a gap in the history shows
 * up in the pipeline output.
 */
export function loadLegacyScoreLookup(votes: readonly VoteRow[]): {
  lookup: PublishedScoreLookup;
  stats: LegacyLookupStats;
} {
  const needed = new Set<string>();
  for (const row of votes) {
    if (needsLegacyLookup(row)) needed.add(utcDateOf(row.created_at));
  }
  if (needed.size === 0) {
    return resolveLegacyLookup([], () => null, []);
  }

  const result = resolveLegacyLookup(needed, readDayScores, listSnapshotDates());
  const { exact, fallback, missing } = result.stats;
  console.log(
    `[Sentiment] Legacy vote anchors: ${needed.size} date(s) — ${exact} exact, ${fallback} fallback, ${missing} missing`,
  );
  return result;
}
