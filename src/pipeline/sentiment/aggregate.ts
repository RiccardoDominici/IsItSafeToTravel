import type { VoteRow, SentimentEntry, SentimentSnapshot } from '../types.js';

/**
 * Compute a recency-weighted, capped, display-only "Community Sentiment" correction
 * for each country from raw vote deltas.
 *
 * This module is intentionally pure and structurally independent of the scoring
 * engine (`src/pipeline/scoring/engine.ts`) and its closed `PillarName` union — the
 * output NEVER feeds `computeAllScores`'s weighted geometric mean (D-06).
 *
 * Recency weighting mirrors `src/pipeline/scoring/freshness.ts`'s exponential
 * half-life shape: weight_i = 0.5 ** (ageDays_i / SENTIMENT_HALF_LIFE_DAYS).
 */

/** Number of days until a vote's recency weight reaches 0.5. */
export const SENTIMENT_HALF_LIFE_DAYS = 30;

/** Score-points of correction per unit of (recency-weighted) average delta. */
export const SENTIMENT_DELTA_SCALE = 0.5;

/** Hard cap (in score points, 1-10 scale) on how far sentiment can nudge a score (D-08). */
export const SENTIMENT_CORRECTION_CAP = 1.0;

/** Minimum vote count required before a country's sentiment is surfaced (D-09). */
export const SENTIMENT_MIN_VOTES = 5;

/** Clamp `v` to the inclusive range [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Aggregate raw vote rows into a per-country SentimentSnapshot.
 *
 * @param rows - Raw vote rows (untrusted deltas, already range-validated at ingestion).
 * @param officialScores - Map of iso3 -> official score (1-10) at aggregation time.
 *   Countries without an entry here are skipped entirely (no perceived value possible).
 * @param nowMs - Reference "now" in epoch milliseconds, used to compute vote age.
 */
export function aggregateVotes(
  rows: VoteRow[],
  officialScores: Map<string, number>,
  nowMs: number,
): SentimentSnapshot {
  const nowS = nowMs / 1000;

  // Group rows by iso3.
  const byIso3 = new Map<string, VoteRow[]>();
  for (const row of rows) {
    const list = byIso3.get(row.iso3);
    if (list) {
      list.push(row);
    } else {
      byIso3.set(row.iso3, [row]);
    }
  }

  const countries: Record<string, SentimentEntry> = {};

  for (const [iso3, countryRows] of byIso3) {
    const official = officialScores.get(iso3);
    if (official === undefined) continue; // no official score to correct — skip

    if (countryRows.length < SENTIMENT_MIN_VOTES) continue; // below display floor (D-09)

    let weightedSum = 0;
    let weightTotal = 0;
    for (const row of countryRows) {
      const ageDays = (nowS - row.created_at) / 86_400;
      // Guard negative ages (clock skew / future timestamps) by treating as fresh.
      const weight = ageDays <= 0 ? 1 : Math.pow(0.5, ageDays / SENTIMENT_HALF_LIFE_DAYS);
      weightedSum += weight * row.delta;
      weightTotal += weight;
    }

    const avgDelta = weightTotal > 0 ? weightedSum / weightTotal : 0;
    const correction = clamp(avgDelta * SENTIMENT_DELTA_SCALE, -SENTIMENT_CORRECTION_CAP, SENTIMENT_CORRECTION_CAP);
    const perceived = clamp(official + correction, 1, 10);

    countries[iso3] = {
      iso3,
      count: countryRows.length,
      avgDelta,
      correction,
      perceived,
      official,
    };
  }

  return {
    generatedAt: new Date(nowMs).toISOString(),
    countries,
  };
}
