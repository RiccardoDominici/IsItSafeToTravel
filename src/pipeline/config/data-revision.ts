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
 *
 *     Same revision, same run: the broader source-repair pass from the
 *     2026-09-25 audit (findings/inconsistencies.md I2) landed alongside a/b
 *     above. Status as of that run, kept here (not just in a commit message)
 *     because it explains score movement that isn't a real overnight change:
 *       - Repaired (now fetch live again): us (JSON API/RSS chain rebuilt),
 *         fr, ie, be, it, es, pl, pt, sk, cz, hu, sg, br.
 *       - uk/jp/hk/dk/rs/ch/in advisory parsers no longer default to level 1
 *         when they can't determine a real level (see (b) above for
 *         hk/dk/ch/rs specifically; uk/jp/in got the same treatment here).
 *       - de: parser now also recognizes the "wird abgeraten" ("advised
 *         against") phrasing the source site uses for partial warnings —
 *         previously unmatched text fell through to a stale/default level;
 *         this alone changes the resolved level for 36 countries.
 *       - Still blocked by anti-bot challenges (no/fi/ph/ro): fetchers run
 *         but the source blocks the request before any level can be parsed.
 *       - Still not implemented (hr/kr/se): no fetcher exists yet, distinct
 *         from the anti-bot cases above — there is nothing to repair, only
 *         to build.
 */
export const DATA_REVISION = 2;

/**
 * The calendar date (YYYY-MM-DD, pipeline run date) this revision first takes
 * effect — the first SCHEDULED run using the rev-2 code, not the day the PR
 * merged. `source-floor.ts` uses this as a hard floor on restore eligibility,
 * in addition to MAX_RESTORE_AGE_DAYS: a cache dated before this is NEVER
 * used as a restore source, no matter how high its count or how recent it is
 * relative to MAX_RESTORE_AGE_DAYS. Every cache before this date was written
 * by the parsers rev 2 fixed (hk/dk/ch/rs defaulting to level 1, and the
 * unbounded historical-max restore itself) — a "healthy" pre-revision count
 * just means the bug was productive, not that the data is trustworthy. Without
 * this cutoff, the 14-day bound alone still lets a currently-broken issuer's
 * LAST pre-fix day (which always looks recent and healthy) keep getting
 * restored for up to 14 more days after rev 2 ships, before finally erroring
 * — this closes that gap outright: from DATA_REVISION_SINCE's first run
 * onward, a fixed parser's deliberate omissions stay omitted immediately.
 */
export const DATA_REVISION_SINCE = '2026-09-26';
