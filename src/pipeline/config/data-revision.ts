/**
 * Data-revision marker for the daily snapshot format/content.
 *
 * Bump this whenever a pipeline change would make a naive day-over-day diff
 * misleading — either a schema change, or (as with rev 2) a one-time
 * correction to score inputs that isn't a real change in conditions on the
 * ground. `writeSnapshot` stamps every new snapshot with the current value;
 * `computeNews` (src/pipeline/news/engine.ts) compares prev vs curr and, on
 * a mismatch, suppresses the four DELTA-derived event types (score_jump,
 * band_change, rank_overtake, top10_change) for that one run — otherwise the
 * correction itself would be reported as "movement". new_country and
 * severe_advisory are existence/threshold checks, not deltas, and are exempt.
 *
 * Changelog:
 *   1 (implicit/default) — every snapshot written before 2026-09-25. No
 *     `dataRevision` field on disk; `?? 1` is the fallback everywhere this
 *     is read, so old snapshots are treated as revision 1 without a backfill.
 *   2 (2026-09-25) — audit cleanup, two corrections landing in the same run:
 *       a) source-floor.ts restore policy bounded to MAX_RESTORE_AGE_DAYS
 *          (14). Previously an issuer past its floor was restored from
 *          whichever cached file held its ALL-TIME MAXIMUM coverage, with no
 *          age limit — nine issuers that had been dead since spring 2026
 *          (it/pl/pt/be/ie among them) kept republishing pre-death data every
 *          day through 2026-09-25, e.g. Italy/Ireland showing "normal
 *          precautions" for Afghanistan from a 2026-03-27 cache.
 *       b) hk/dk/ch/rs advisory parsers stopped defaulting to level 1 when
 *          they could not determine a real level (dead/redesigned source
 *          page, unrecognized phrasing) — they now emit nothing for that
 *          country instead.
 *     Countries affected by either fix see a score change that reflects the
 *     correction, not a real overnight change in safety.
 */
export const DATA_REVISION = 2;
