import type { SentimentEntry, SentimentSnapshot, VoteRow } from '../types.js';
import {
  SENTIMENT_HALF_LIFE_DAYS,
  SENTIMENT_MIN_ORIGINS,
  SENTIMENT_MIN_VOTES,
  SENTIMENT_WINDOW_DAYS,
} from './constants.js';
import { applyOriginCap, normalizeOrigin, UNKNOWN_ORIGIN } from './origin-cap.js';
import { perceivedScore, type PublishedScoreLookup } from './perceive.js';

/**
 * Community aggregation (formula v10, SPEC §5). Turns raw vote rows into one entry per country:
 * the recency-weighted mean perceived score P, after the origin cap, with an activation status.
 *
 * The output is data only. The score engine reads it and decides how much the community moves the
 * score (SPEC §5: adjustment = clamp(Z · (P − S_data), −1, +1)). This module never touches scores.
 *
 * Pure given `lookup` and `nowMs`, so it is deterministic under test.
 */

export interface AggregationResult {
  snapshot: SentimentSnapshot;
  /** Votes inside the window that could not be placed on the scale (see perceivedScore). */
  droppedVotes: number;
}

interface PlacedVote {
  perceived: number;
  weight: number;
  origin: string;
}

/**
 * Aggregate raw vote rows into per-country entries. A country appears only if at least one of its
 * votes could be placed. Entries carry status 'active' only when BOTH activation floors hold:
 * at least SENTIMENT_MIN_VOTES usable votes and at least SENTIMENT_MIN_ORIGINS known origins.
 */
export function aggregateVotes(
  rows: readonly VoteRow[],
  lookup: PublishedScoreLookup,
  nowMs: number,
): AggregationResult {
  const nowS = nowMs / 1000;
  const windowStartS = nowS - SENTIMENT_WINDOW_DAYS * 86_400;

  const byIso3 = new Map<string, VoteRow[]>();
  for (const row of rows) {
    if (row.created_at < windowStartS) continue;
    const list = byIso3.get(row.iso3);
    if (list) list.push(row);
    else byIso3.set(row.iso3, [row]);
  }

  const countries: Record<string, SentimentEntry> = {};
  let droppedVotes = 0;

  for (const [iso3, countryRows] of byIso3) {
    const placed: PlacedVote[] = [];
    for (const row of countryRows) {
      const perceived = perceivedScore(row, lookup);
      if (perceived === null) {
        droppedVotes++;
        continue;
      }
      // Ages at or below zero (clock skew, same-second votes) count as fresh, as before.
      const ageDays = (nowS - row.created_at) / 86_400;
      const weight = ageDays <= 0 ? 1 : Math.pow(0.5, ageDays / SENTIMENT_HALF_LIFE_DAYS);
      placed.push({ perceived, weight, origin: normalizeOrigin(row.country_iso) });
    }
    if (placed.length === 0) continue;

    const { weights, shares } = applyOriginCap(
      placed.map((p) => ({ origin: p.origin, weight: p.weight })),
    );

    let totalWeight = 0;
    let sumSquaredWeight = 0;
    let weightedPerceived = 0;
    placed.forEach((p, i) => {
      const w = weights[i];
      totalWeight += w;
      sumSquaredWeight += w * w;
      weightedPerceived += w * p.perceived;
    });

    const knownOrigins = new Set(placed.map((p) => p.origin).filter((o) => o !== UNKNOWN_ORIGIN));
    const votes = placed.length;

    countries[iso3] = {
      iso3,
      votes,
      origins: knownOrigins.size,
      topOriginShare: Math.max(...shares.values()),
      nEff: (totalWeight * totalWeight) / sumSquaredWeight,
      perceived: weightedPerceived / totalWeight,
      status: votes >= SENTIMENT_MIN_VOTES && knownOrigins.size >= SENTIMENT_MIN_ORIGINS ? 'active' : 'insufficient',
    };
  }

  return {
    snapshot: { generatedAt: new Date(nowMs).toISOString(), countries },
    droppedVotes,
  };
}
