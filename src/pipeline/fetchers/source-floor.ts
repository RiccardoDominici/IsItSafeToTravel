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
 * Three mechanisms:
 *   1. EXPECTED ISSUERS — the caller passes the tier's full issuer list from
 *      code, so a zero-row issuer is checked too (count treated as 0).
 *   2. HIGH-WATER BASELINE — each issuer's floor adapts to its historical
 *      maximum coverage across ALL cached info files (not just the most
 *      recent one, which would ratchet down during slow decay).
 *   3. PER-ISSUER FLOORS — small issuers legitimately cover few countries;
 *      callers pass measured minimums so they don't trigger daily false
 *      positives that would mask real regressions.
 *
 * On violation the issuer's missing countries are restored from the cached
 * file holding its historical maximum, so users keep last-known advisory
 * levels while the error surfaces loudly in FetchResult.errors / CI logs.
 */

/** Default absolute floor for issuers without an explicit override. */
const DEFAULT_ABSOLUTE_FLOOR = 25;
/** Relative floor fraction of the issuer's historical high-water mark. */
const RELATIVE_FLOOR_RATIO = 0.6;

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

function healthyCount(data: LooseInfoMap, key: string): number {
  let n = 0;
  for (const entry of Object.values(data)) {
    if (typeof entry?.[key]?.level === 'number') n++;
  }
  return n;
}

interface HighWater {
  count: number;
  path: string | null;
}

// One full archive scan per infoFile per process — the five tiers share run.ts's
// lifetime, so this memo keeps the daily pipeline cost to ~N_raw_dirs reads total.
const highWaterCache = new Map<string, Map<string, HighWater>>();

/**
 * Historical maximum coverage per issuer across ALL cached info files.
 * Scanning only the newest cache would let the baseline ratchet down during a
 * gradual decay (200→150→110…); the all-time max makes sustained decay visible
 * immediately. Returns {count, path} — path lets the restore re-read the file
 * that actually held the maximum.
 */
function computeHighWater(infoFile: string): Map<string, HighWater> {
  const memo = highWaterCache.get(infoFile);
  if (memo) return memo;

  const rawBase = join(process.cwd(), 'data', 'raw');
  const best = new Map<string, HighWater>();
  if (existsSync(rawBase)) {
    const dateDirs = readdirSync(rawBase)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    for (const dateDir of dateDirs) {
      const p = join(rawBase, dateDir, infoFile);
      if (!existsSync(p)) continue;
      const data = readJson<AdvisoryInfoMap>(p);
      if (!data) continue;
      const looseData = loose(data);
      // Cheap pre-count of every key present in this file.
      const counts = new Map<string, number>();
      for (const entry of Object.values(looseData)) {
        if (!entry) continue;
        for (const k of Object.keys(entry)) {
          if (typeof entry[k]?.level === 'number') counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
      for (const [k, c] of counts) {
        const prev = best.get(k);
        if (!prev || c > prev.count) best.set(k, { count: c, path: p });
      }
    }
  }
  highWaterCache.set(infoFile, best);
  return best;
}

export function enforcePerSourceFloors(opts: EnforceOpts): void {
  const { logPrefix, infoFile, expectedIssuers, floors, indicators, advisoryInfo, errors } = opts;
  const fetchedCounts = countByIssuer(indicators);

  // Union: every expected issuer is checked even when it produced zero rows.
  const keys = new Set([...expectedIssuers, ...fetchedCounts.keys()]);
  const highWater = computeHighWater(infoFile);

  for (const key of keys) {
    const count = fetchedCounts.get(key) ?? 0;
    const hw = highWater.get(key);
    const absoluteFloor = floors?.[key] ?? DEFAULT_ABSOLUTE_FLOOR;
    const floor = Math.max(absoluteFloor, Math.ceil(RELATIVE_FLOOR_RATIO * (hw?.count ?? 0)));
    if (count >= floor) continue;

    const kind = count === 0 ? 'COLLAPSED TO ZERO' : 'below floor';
    const msg =
      `${key.toUpperCase()}: ${kind} (${count} countries, floor ${floor}` +
      `${hw ? `, historical max ${hw.count}` : ', no cached history'})`;
    console.error(`${logPrefix} PER-SOURCE FLOOR VIOLATION — ${msg}; attempting cache restore`);
    errors.push(msg);

    if (!hw?.path) {
      console.error(`${logPrefix} ${key.toUpperCase()}: no cached ${infoFile} available for restore`);
      continue;
    }

    // Re-read ONLY the file that holds this issuer's historical maximum.
    const cached = readJson<AdvisoryInfoMap>(hw.path);
    if (!cached) {
      console.error(`${logPrefix} ${key.toUpperCase()}: cache at ${hw.path} unreadable`);
      continue;
    }

    const year = new Date().getFullYear();
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
        target[iso3][key] = info;
      }
    }
    console.warn(
      `${logPrefix} ${key.toUpperCase()}: restored ${restored} countries from ` +
      `${hw.path} (historical max ${hw.count})`,
    );
  }
}
