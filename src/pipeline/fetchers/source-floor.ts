import { readJson } from '../utils/fs.js';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import type { RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';

/**
 * Per-source floor enforcement for multi-issuer advisory tiers.
 *
 * Guards every issuer of a tier against silent coverage collapse — including
 * the hardest case, an issuer dropping to ZERO rows (its parser breaking with
 * the site's HTML redesign), which is invisible to any check that only looks
 * at what was fetched. The US source failed exactly like that, unnoticed,
 * between 2026-05-27 and 2026-06-02; later post-mortems found it, pt/be/ie/
 * it/pl and sk had died the same way by August 2026.
 *
 * Four mechanisms:
 *   1. EXPECTED ISSUERS — the caller passes the tier's full issuer list from
 *      code, so a zero-row issuer is checked too (count treated as 0).
 *   2. HIGH-WATER BASELINE — each issuer's floor adapts to its historical
 *      maximum coverage across ALL cached info files (not just the most
 *      recent one, which would ratchet down during slow decay).
 *   3. PER-ISSUER FLOORS — small issuers legitimately cover few countries;
 *      callers pass measured minimums so they don't trigger daily false
 *      positives that would mask real regressions.
 *   4. BOUNDED, RECENCY-AWARE RESTORE — on violation we restore from the
 *      MOST RECENT cached file in which the issuer was healthy (not
 *      whichever file happened to hold the all-time max — that could be
 *      months stale and republish a since-changed advisory level), and only
 *      if that file is at most MAX_RESTORE_AGE_DAYS old. An issuer dead
 *      longer than that gets NO restore and a loud, unmissable error instead
 *      — showing nothing is safer than quietly serving a months-old level
 *      forever (this is exactly how 9 dead issuers kept republishing their
 *      pre-August historical-maximum data through 2026-09-25, some of it
 *      flatly wrong, e.g. Italy/Ireland showing "normal precautions" for
 *      Afghanistan from a 2026-03-27 cache).
 */

/** Default absolute floor for issuers without an explicit override. */
const DEFAULT_ABSOLUTE_FLOOR = 25;
/** Relative floor fraction of the issuer's historical high-water mark. */
const RELATIVE_FLOOR_RATIO = 0.6;

/**
 * Restores are only trusted up to this many days old. Beyond that we stop
 * restoring and error loudly instead — a country's real advisory level can
 * change substantially in two weeks, so quietly republishing an older and
 * older snapshot forever would drift from reality with no signal that
 * anything is wrong. 14 days rides out a transient site hiccup, a missed
 * run, or a slow parser fix without silently going stale.
 */
export const MAX_RESTORE_AGE_DAYS = 14;

type TierAdvisoryEntry = AdvisoryInfo & { level?: number };
/** AdvisoryInfoMap has fixed issuer keys; generic per-issuer iteration needs a loosened view. */
type LooseInfoMap = Record<string, Record<string, TierAdvisoryEntry | undefined> | undefined>;
const loose = (m: AdvisoryInfoMap): LooseInfoMap => m as unknown as LooseInfoMap;

interface EnforceOpts {
  logPrefix: string;                // e.g. '[ADVISORIES-T1]'
  infoFile: string;                 // e.g. 'advisories-tier1-info.json'
  /** Full issuer list for this tier (from code) — catches zero-row collapses. */
  expectedIssuers: string[];
  /** Measured absolute minimums per issuer (small issuers need lower floors). */
  floors?: Record<string, number>;
  indicators: RawIndicator[];       // mutated in place (restores appended)
  advisoryInfo: AdvisoryInfoMap;    // mutated in place (missing keys filled)
  errors: string[];                 // appended with human-readable reports
  /**
   * The pipeline's run date (YYYY-MM-DD) — NEVER Date.now(). The pipeline can
   * be re-run for a past date (`run.ts 2026-08-01`); "how old is this cache"
   * must be measured against the date being processed, not wall-clock time,
   * or a backfill run would treat every cache as ancient (or as brand new).
   */
  runDate: string;
  /**
   * Root of the per-day raw-data cache, one subdirectory per YYYY-MM-DD.
   * Defaults to `data/raw` under CWD; overridable so tests can point at a
   * throwaway fixture directory instead of the real multi-year archive.
   */
  rawBaseDir?: string;
}

/** Group indicator counts by issuer key parsed from the `advisories_<key>` source tag. */
function countByIssuer(indicators: RawIndicator[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ind of indicators) {
    const m = /^advisories_([a-z]{2})$/.exec(ind.source);
    if (!m) continue;
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  return counts;
}

interface HighWater {
  count: number;
  path: string | null;
}

interface ArchiveStats {
  /** All-time max coverage per issuer, used ONLY to size the relative floor. */
  highWater: Map<string, HighWater>;
  /**
   * Per-date, per-issuer GENUINE-only counts (restored entries excluded) —
   * used to find the most recent healthy day. Restored entries are excluded
   * so a restore can never "look" healthy to tomorrow's scan and re-restore
   * itself forever: without this, day N restores from day N-1, day N+1 then
   * sees day N as healthy (it has a full count!) and restores from IT
   * instead, and the chain never terminates — verified live 2026-09-25,
   * see source-floor.test.ts 'a restored day never counts as healthy'.
   * Pre-fix archive days never carry restoredFrom (the field didn't exist),
   * so they still count as healthy at face value — a one-time, bounded
   * grace period of at most MAX_RESTORE_AGE_DAYS from whichever day this
   * fix first runs, not a permanent loophole.
   */
  genuineDaily: Map<string, Map<string, number>>; // dateDir -> (issuerKey -> count)
}

// One full archive scan per (rawBaseDir, infoFile) per process — the five
// tiers share run.ts's lifetime, so this memo keeps the daily pipeline cost
// to ~N_raw_dirs reads total. Keyed by rawBaseDir too so tests that inject a
// fixture dir never share a memo with the real archive (or with each other).
const archiveStatsCache = new Map<string, ArchiveStats>();

function listDateDirs(rawBaseDir: string): string[] {
  if (!existsSync(rawBaseDir)) return [];
  return readdirSync(rawBaseDir)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
}

/**
 * Scans every cached info file once, building both the all-time high-water
 * mark per issuer (for floor sizing) and a per-date breakdown (for finding
 * the most recent healthy day to restore from). Scanning only the newest
 * cache for the high-water mark would let the baseline ratchet down during a
 * gradual decay (200→150→110…); the all-time max makes sustained decay
 * visible immediately.
 */
function computeArchiveStats(infoFile: string, rawBaseDir: string): ArchiveStats {
  const cacheKey = `${rawBaseDir}::${infoFile}`;
  const memo = archiveStatsCache.get(cacheKey);
  if (memo) return memo;

  const highWater = new Map<string, HighWater>();
  const genuineDaily = new Map<string, Map<string, number>>();

  for (const dateDir of listDateDirs(rawBaseDir)) {
    const p = join(rawBaseDir, dateDir, infoFile);
    if (!existsSync(p)) continue;
    const data = readJson<AdvisoryInfoMap>(p);
    if (!data) continue;
    const looseData = loose(data);

    // rawCounts sizes the floor (unchanged semantics: every entry counts,
    // restored or not — "keep the high-water mark for computing the floor").
    // genuineCounts drives the healthy-day scan below (restored entries
    // excluded — see the ArchiveStats.genuineDaily doc comment).
    const rawCounts = new Map<string, number>();
    const genuineCounts = new Map<string, number>();
    for (const entry of Object.values(looseData)) {
      if (!entry) continue;
      for (const k of Object.keys(entry)) {
        if (typeof entry[k]?.level !== 'number') continue;
        rawCounts.set(k, (rawCounts.get(k) ?? 0) + 1);
        if (!entry[k]?.restoredFrom) genuineCounts.set(k, (genuineCounts.get(k) ?? 0) + 1);
      }
    }

    genuineDaily.set(dateDir, genuineCounts);
    for (const [k, c] of rawCounts) {
      const prev = highWater.get(k);
      if (!prev || c > prev.count) highWater.set(k, { count: c, path: p });
    }
  }

  const stats: ArchiveStats = { highWater, genuineDaily };
  archiveStatsCache.set(cacheKey, stats);
  return stats;
}

/** Whole-day difference between two YYYY-MM-DD dates (always >= 0). */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.abs(Math.round(ms / 86_400_000));
}

interface HealthyDay {
  date: string;
  path: string;
}

/**
 * Most recent date (strictly before runDate) on which `key` met `floor`, and
 * the LAST healthy date ever seen (even if too old to restore from) — the
 * latter drives the "dead since <date>" error message.
 */
function findMostRecentHealthyDay(
  stats: ArchiveStats,
  key: string,
  floor: number,
  runDate: string,
  rawBaseDir: string,
  infoFile: string,
): { mostRecent: HealthyDay | null; lastEverHealthy: string | null } {
  let mostRecent: HealthyDay | null = null;
  let lastEverHealthy: string | null = null;

  // Dates are YYYY-MM-DD strings, lexicographic order == chronological order.
  const dates = [...stats.genuineDaily.keys()].sort();
  for (const dateDir of dates) {
    if (dateDir >= runDate) continue; // never restore from today-or-later
    const count = stats.genuineDaily.get(dateDir)?.get(key) ?? 0;
    if (count < floor) continue;
    lastEverHealthy = dateDir; // dates are scanned ascending, so this keeps advancing
    mostRecent = { date: dateDir, path: join(rawBaseDir, dateDir, infoFile) };
  }

  return { mostRecent, lastEverHealthy };
}

export function enforcePerSourceFloors(opts: EnforceOpts): void {
  const {
    logPrefix,
    infoFile,
    expectedIssuers,
    floors,
    indicators,
    advisoryInfo,
    errors,
    runDate,
    rawBaseDir = join(process.cwd(), 'data', 'raw'),
  } = opts;
  const fetchedCounts = countByIssuer(indicators);

  // Union: every expected issuer is checked even when it produced zero rows.
  const keys = new Set([...expectedIssuers, ...fetchedCounts.keys()]);
  const stats = computeArchiveStats(infoFile, rawBaseDir);

  for (const key of keys) {
    const count = fetchedCounts.get(key) ?? 0;
    const hw = stats.highWater.get(key);
    const absoluteFloor = floors?.[key] ?? DEFAULT_ABSOLUTE_FLOOR;
    const floor = Math.max(absoluteFloor, Math.ceil(RELATIVE_FLOOR_RATIO * (hw?.count ?? 0)));
    if (count >= floor) continue;

    const kind = count === 0 ? 'COLLAPSED TO ZERO' : 'below floor';
    const msg =
      `${key.toUpperCase()}: ${kind} (${count} countries, floor ${floor}` +
      `${hw ? `, historical max ${hw.count}` : ', no cached history'})`;
    console.error(`${logPrefix} PER-SOURCE FLOOR VIOLATION — ${msg}; checking for a recent healthy cache`);
    errors.push(msg);

    const { mostRecent, lastEverHealthy } = findMostRecentHealthyDay(
      stats, key, floor, runDate, rawBaseDir, infoFile,
    );

    const age = mostRecent ? daysBetween(runDate, mostRecent.date) : null;
    if (!mostRecent || age === null || age > MAX_RESTORE_AGE_DAYS) {
      const deadSince = lastEverHealthy ?? 'never';
      const staleMsg =
        `${key.toUpperCase()}: dead since ${deadSince} — not restored ` +
        `(older than ${MAX_RESTORE_AGE_DAYS} days); parser needs repair`;
      console.error(`${logPrefix} ${staleMsg}`);
      errors.push(staleMsg);
      continue;
    }

    const cached = readJson<AdvisoryInfoMap>(mostRecent.path);
    if (!cached) {
      console.error(`${logPrefix} ${key.toUpperCase()}: cache at ${mostRecent.path} unreadable`);
      continue;
    }

    const year = Number(runDate.slice(0, 4));
    const have = new Set(
      indicators.filter((i) => i.source === `advisories_${key}`).map((i) => i.countryIso3),
    );
    const cachedLoose = loose(cached);
    const target = loose(advisoryInfo);
    let restored = 0;
    for (const [iso3, entry] of Object.entries(cachedLoose)) {
      const info = entry?.[key];
      if (!info || typeof info.level !== 'number') continue;
      if (!have.has(iso3)) {
        indicators.push({
          countryIso3: iso3,
          indicatorName: `advisory_level_${key}`,
          value: info.level,
          year,
          source: `advisories_${key}`,
        });
        restored++;
      }
      if (!target[iso3]) target[iso3] = {};
      if (!target[iso3][key]) {
        // restoredFrom is informational only (debugging/UI provenance) —
        // never read back by the scoring engine.
        target[iso3][key] = { ...info, restoredFrom: mostRecent.date };
      }
    }
    console.warn(
      `${logPrefix} ${key.toUpperCase()}: restored ${restored} countries from ` +
      `${mostRecent.path} (healthy on ${mostRecent.date}, ${age}d old)`,
    );
  }
}
