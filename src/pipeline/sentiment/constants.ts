/**
 * Community-sentiment constants (formula v10, SPEC §5). Every tunable of the vote aggregation
 * lives here, so the pipeline, its tests and the UI copy read the same numbers.
 *
 * Pure module: no Node imports, so the Astro build can import it as well.
 */

/** Votes older than this are ignored. Matches the D1 read window used by the pipeline. */
export const SENTIMENT_WINDOW_DAYS = 180;

/** A vote's weight halves every this many days: w = 0.5 ** (ageDays / SENTIMENT_HALF_LIFE_DAYS). */
export const SENTIMENT_HALF_LIFE_DAYS = 30;

/** Activation floor (1 of 2): at least this many usable votes in the window. */
export const SENTIMENT_MIN_VOTES = 30;

/** Activation floor (2 of 2): at least this many distinct known countries of origin. */
export const SENTIMENT_MIN_ORIGINS = 3;

/** No single origin may hold more than this share of a country's vote weight. */
export const SENTIMENT_ORIGIN_SHARE_CAP = 0.5;

/** Relative vote: perceived = S_shown + SENTIMENT_DELTA_SCALE * delta, with delta in -2..+2. */
export const SENTIMENT_DELTA_SCALE = 0.5;

/** Absolute vote: rating 1..5 (very unsafe .. very safe) maps to these perceived scores. */
export const SENTIMENT_ABSOLUTE_SCORES: readonly number[] = [2, 4, 6, 8, 10];

/**
 * Legacy relative votes carry no stored score, so they are anchored to the published score of
 * their UTC date. If that date has no snapshot, the nearest earlier snapshot within this many
 * days stands in (it is the score that was live then).
 */
export const SENTIMENT_LEGACY_FALLBACK_DAYS = 7;

/** Largest community adjustment the score engine may apply, in score points (SPEC §5). */
export const SENTIMENT_ADJUSTMENT_CAP = 1.0;
