import { join } from 'node:path';
import type { VoteRow } from '../types.js';
import { listSnapshotDates, loadSnapshot } from '../scoring/snapshot.js';
import { readJson } from '../utils/fs.js';
import { SENTIMENT_LEGACY_FALLBACK_DAYS } from './constants.js';
import { LEGACY_ANCHORS_PATH, legacyAnchorKey, parseLegacyAnchors } from './legacy-anchors.js';
import { needsLegacyLookup, utcDateOf, type PublishedScoreLookup } from './perceive.js';

/**
 * Anchor for legacy relative votes, the rows stored without the score their voter saw (formula
 * v10, SPEC §5). Two sources, in order:
 *
 *  1. The frozen table data/sentiment/legacy-anchors.json: the score that was live on the site at
 *     the vote's exact moment, rebuilt from master's git history (see legacy-anchors.ts and
 *     scripts/build-legacy-vote-anchors.ts). Preferred, because it is what the voter actually saw.
 *  2. Only for rows not in that table: the per-day score snapshot data/scores/YYYY-MM-DD.json of
 *     the vote's UTC date (never the 50+ MB history index). These files can differ from what was
 *     live (they were regenerated under formula v9/v9.1 on 2026-07-08, and a vote cast before the
 *     day's deploy saw the previous day's score), so they are the fallback, not the source.
 *
 * Only the snapshot days that table-less rows need are loaded.
 */

/** Per-day published scores: iso3 -> score, null where that day's entry has no number (grey). */
export type DayScores = ReadonlyMap<string, number | null>;

/** How the snapshot fallback resolved the dates it was asked for (counts DATES, not rows). */
export interface LegacyLookupStats {
  /** Needed dates that had their own snapshot. */
  exact: number;
  /** Needed dates served by the nearest earlier snapshot. */
  fallback: number;
  /** Needed dates with no snapshot at all within the fallback window. */
  missing: number;
}

/** What loadLegacyScoreLookup did: rows per source, plus the snapshot fallback's date counts. */
export interface LegacyLoadStats extends LegacyLookupStats {
  /** Legacy rows answered by the frozen anchor table. */
  anchoredRows: number;
  /** Legacy rows left to the per-day snapshots (their dates are what exact/fallback/missing count). */
  snapshotRows: number;
}

/** Days from `earlier` to `later` (both YYYY-MM-DD, UTC). */
function daysBetween(earlier: string, later: string): number {
  return (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000;
}

/**
 * Pure core of the snapshot fallback. For each needed UTC date, use that date's snapshot. If it
 * has none, use the nearest EARLIER snapshot within `maxFallbackDays`: that is the score the site
 * was publishing then. Never a later one, which would be a score from the future relative to the
 * vote. The returned lookup answers by the UTC date of the moment it is asked about.
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
    scoreAt: (iso3, epochSeconds) => byDate.get(utcDateOf(epochSeconds))?.get(iso3) ?? null,
  };
  return { lookup, stats };
}

/**
 * Pure: a lookup that answers from the frozen anchor table when it has the row's
 * (country, moment), and asks `fallback` only otherwise.
 */
export function preferLegacyAnchors(
  anchors: ReadonlyMap<string, number>,
  fallback: PublishedScoreLookup,
): PublishedScoreLookup {
  return {
    scoreAt: (iso3, epochSeconds) =>
      anchors.get(legacyAnchorKey(iso3, epochSeconds)) ?? fallback.scoreAt(iso3, epochSeconds),
  };
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
 * Read the frozen anchor table. A missing or unreadable file, or a malformed entry, is not fatal:
 * the rows concerned fall back to the snapshots, and the log says so.
 */
export function readLegacyAnchors(path: string): ReadonlyMap<string, number> {
  const data = readJson<unknown>(path);
  if (data === null) {
    console.warn(`[Sentiment] Legacy anchor table missing or unreadable (${path}): legacy rows use the per-day snapshots`);
    return new Map();
  }
  const { anchors, rejected } = parseLegacyAnchors(data);
  if (rejected > 0) {
    console.warn(`[Sentiment] Legacy anchor table: ignored ${rejected} malformed entr${rejected === 1 ? 'y' : 'ies'}`);
  }
  return anchors;
}

/**
 * Build the legacy lookup for the votes in `votes`: the frozen table first, then the snapshot files
 * that the remaining legacy rows need (plus any fallback file). Reads nothing when no row is
 * legacy. Logs how the rows were resolved, so a gap shows up in the pipeline output.
 *
 * @param anchorsPath - The frozen table; the committed data/sentiment/legacy-anchors.json by default.
 */
export function loadLegacyScoreLookup(
  votes: readonly VoteRow[],
  anchorsPath: string = join(process.cwd(), LEGACY_ANCHORS_PATH),
): { lookup: PublishedScoreLookup; stats: LegacyLoadStats } {
  const legacyRows = votes.filter(needsLegacyLookup);
  if (legacyRows.length === 0) {
    const { lookup, stats } = resolveLegacyLookup([], () => null, []);
    return { lookup, stats: { ...stats, anchoredRows: 0, snapshotRows: 0 } };
  }

  const anchors = readLegacyAnchors(anchorsPath);
  const neededDates = new Set<string>();
  let anchoredRows = 0;
  for (const row of legacyRows) {
    if (anchors.has(legacyAnchorKey(row.iso3, row.created_at))) anchoredRows++;
    else neededDates.add(utcDateOf(row.created_at));
  }
  const snapshotRows = legacyRows.length - anchoredRows;

  const snapshots =
    neededDates.size > 0
      ? resolveLegacyLookup(neededDates, readDayScores, listSnapshotDates())
      : resolveLegacyLookup([], () => null, []);
  const { exact, fallback, missing } = snapshots.stats;
  console.log(
    `[Sentiment] Legacy vote anchors: ${legacyRows.length} row(s) — ${anchoredRows} from the frozen table, ` +
      `${snapshotRows} from snapshots (${neededDates.size} date(s): ${exact} exact, ${fallback} fallback, ${missing} missing)`,
  );

  return {
    lookup: preferLegacyAnchors(anchors, snapshots.lookup),
    stats: { ...snapshots.stats, anchoredRows, snapshotRows },
  };
}
