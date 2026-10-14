import type { VoteRow } from '../types.js';
import { SENTIMENT_ABSOLUTE_SCORES, SENTIMENT_DELTA_SCALE } from './constants.js';

/**
 * Per-vote "perceived score" (formula v10, SPEC §5). Pure: the legacy score lookup is injected.
 */

/**
 * Score the site was publishing for a country at a moment (unix seconds), or null when unknown.
 * Asked with the vote's exact `created_at`, not just its day: the live score can change during a
 * UTC day (the daily deploy lands mid-morning), and the frozen legacy-anchor table resolves to the
 * second (see legacy-scores.ts).
 */
export interface PublishedScoreLookup {
  scoreAt(iso3: string, epochSeconds: number): number | null;
}

/** UTC calendar day (YYYY-MM-DD) of a unix-seconds timestamp. */
export function utcDateOf(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

/** True for a published score on the 1..10 scale. */
export function isScore(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x >= 1 && x <= 10;
}

/**
 * True for a legacy relative vote: one cast before the widget stored the published score, so its
 * anchor must come from the score history. Absolute (rating) votes never need it.
 */
export function needsLegacyLookup(row: VoteRow): boolean {
  return row.rating == null && !isScore(row.official_score);
}

/**
 * Perceived score of one vote on the 1..10 scale, or null when the vote cannot be placed.
 *
 *  - Absolute vote (grey country, rating 1..5): 2, 4, 6, 8 or 10.
 *  - Relative vote (scored country, delta -2..+2): S_shown + 0.5 * delta. S_shown is the score
 *    stored with the vote; for legacy rows it is the score the lookup says was live when the vote
 *    was cast (legacy-scores.ts: frozen anchor table, else the snapshot of the vote's UTC date).
 *
 * An out-of-range rating or delta, or a legacy row whose score cannot be resolved, yields null.
 * The caller drops such votes and counts them. No clamping: the spec's formula is exact.
 */
export function perceivedScore(row: VoteRow, lookup: PublishedScoreLookup): number | null {
  if (row.rating != null) {
    if (!Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5) return null;
    return SENTIMENT_ABSOLUTE_SCORES[row.rating - 1];
  }

  if (!Number.isInteger(row.delta) || row.delta < -2 || row.delta > 2) return null;
  const shown = isScore(row.official_score) ? row.official_score : lookup.scoreAt(row.iso3, row.created_at);
  if (!isScore(shown)) return null;
  return shown + SENTIMENT_DELTA_SCALE * row.delta;
}
