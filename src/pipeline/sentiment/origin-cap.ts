import { SENTIMENT_ORIGIN_SHARE_CAP } from './constants.js';

/**
 * Origin handling and the origin cap (formula v10, SPEC §5).
 *
 * Votes are grouped by the voter's country of origin (CF's ISO-2 geolocation, stored as
 * votes.country_iso). A single origin must not decide a country's community reading, so no
 * origin may carry more than half of the vote weight.
 *
 * Pure module: no Node imports.
 */

/**
 * Group for votes that name no country: null, empty, Tor ("T1") and unknown ("XX"). All of them
 * share one group and never count as a known origin, so a Tor user cannot fake country diversity.
 */
export const UNKNOWN_ORIGIN = 'unknown';

/** Normalise a raw country code to an ISO-2 origin, or UNKNOWN_ORIGIN when it names no country. */
export function normalizeOrigin(raw: unknown): string {
  if (typeof raw !== 'string') return UNKNOWN_ORIGIN;
  const code = raw.trim().toUpperCase();
  // 'T1' (Tor) fails the two-letter test; 'XX' is CF's explicit "unknown".
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX') return UNKNOWN_ORIGIN;
  return code;
}

export interface OriginVote {
  /** Normalised origin (see normalizeOrigin). */
  origin: string;
  /** Recency weight before capping, > 0. */
  weight: number;
}

export interface OriginCapResult {
  /** Capped weight of each input vote, in input order. */
  weights: number[];
  /** Each origin's share of the capped total. Shares sum to 1 when there is any weight. */
  shares: Map<string, number>;
}

/** Safety bound on cap passes. One pass already yields a stable result for a 50% cap. */
const MAX_CAP_PASSES = 10;

/** Float tolerance: a share exactly at the cap must not be treated as over it. */
const CAP_EPSILON = 1e-12;

/**
 * Cap every origin at `cap` of the total vote weight (SPEC §5).
 *
 * The cap applies only when there are at least two origin groups: a lone origin is the whole
 * signal, not an over-representation. An origin above the cap is scaled down so its share is
 * exactly `cap`, that is its weight becomes cap * rest / (1 - cap), where `rest` is the weight of
 * all other origins. For cap = 0.5 this is simply `rest`. Votes inside an origin keep their
 * relative weights; only the origin's total moves. The loop repeats until stable, as the spec
 * requires, although with a 50% cap a single pass already settles it.
 */
export function applyOriginCap(votes: readonly OriginVote[], cap = SENTIMENT_ORIGIN_SHARE_CAP): OriginCapResult {
  const baseWeight = new Map<string, number>();
  for (const v of votes) baseWeight.set(v.origin, (baseWeight.get(v.origin) ?? 0) + v.weight);

  const factor = new Map<string, number>();
  for (const origin of baseWeight.keys()) factor.set(origin, 1);

  const weightOf = (origin: string): number => (baseWeight.get(origin) ?? 0) * (factor.get(origin) ?? 1);
  const totalWeight = (): number => {
    let total = 0;
    for (const origin of baseWeight.keys()) total += weightOf(origin);
    return total;
  };

  for (let pass = 0; pass < MAX_CAP_PASSES && baseWeight.size >= 2; pass++) {
    const total = totalWeight();
    let over: string | null = null;
    for (const origin of baseWeight.keys()) {
      if (weightOf(origin) / total > cap + CAP_EPSILON) {
        over = origin;
        break;
      }
    }
    if (over === null) break;

    const rest = total - weightOf(over);
    const target = (cap * rest) / (1 - cap);
    factor.set(over, target / (baseWeight.get(over) ?? 1));
  }

  const weights = votes.map((v) => v.weight * (factor.get(v.origin) ?? 1));
  const total = totalWeight();
  const shares = new Map<string, number>();
  for (const origin of baseWeight.keys()) {
    shares.set(origin, total > 0 ? weightOf(origin) / total : 0);
  }
  return { weights, shares };
}
