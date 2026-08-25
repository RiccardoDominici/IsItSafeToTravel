import { readJson } from '../utils/fs.js';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import type { RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';

/**
 * Per-source floor enforcement for multi-issuer advisory tiers.
 *
 * The "big four" fetchers (us/uk/ca/au) guard each source with runWithFloor()
 * in advisories.ts; the tier fetchers (de, nl, jp, sk, … ~30 more issuers) had
 * NO such guard, so a single site's HTML redesign could silently drop one
 * government's column to zero — the same failure mode that hit the US source
 * silently between 2026-05-27 and 2026-06-02.
 *
 * enforcePerSourceFloors() runs ONCE per tier, right before the parsed/info
 * files are written: it groups the fetched indicators by issuer (from their
 * `advisories_<key>` source tag), compares each count against an adaptive
 * floor, and restores the missing issuer's levels from the most recent cached
 * info file that actually contains healthy data for THAT issuer (caches whose
 * own count is also collapsed are skipped, so we never "restore" the bug).
 */

/** Absolute minimum countries per issuer before we treat the fetch as broken. */
const ABSOLUTE_FLOOR = 25;
/** Relative floor: below 60% of the issuer's last healthy coverage → suspicious. */
const RELATIVE_FLOOR_RATIO = 0.6;

type TierAdvisoryEntry = AdvisoryInfo & { level?: number };
/** AdvisoryInfoMap has fixed issuer keys; generic per-issuer iteration needs a loosened view. */
type LooseInfoMap = Record<string, Record<string, TierAdvisoryEntry | undefined> | undefined>;
const loose = (m: AdvisoryInfoMap): LooseInfoMap => m as unknown as LooseInfoMap;

interface EnforceOpts {
  logPrefix: string;      // e.g. '[ADVISORIES-T1]'
  infoFile: string;       // e.g. 'advisories-tier1-info.json'
  indicators: RawIndicator[];        // mutated in place (restores appended)
  advisoryInfo: AdvisoryInfoMap;     // mutated in place (missing keys filled)
  errors: string[];                  // appended with human-readable reports
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

/** Indicator rows are per-country; an issuer covering N countries yields N rows. */
function cachedHealthyCount(info: AdvisoryInfoMap, key: string): number {
  let n = 0;
  for (const entry of Object.values(loose(info))) {
    if (entry && typeof entry[key]?.level === 'number') n++;
  }
  return n;
}

/**
 * Most recent cached info file (across data/raw/YYYY-MM-DD/) containing healthy
 * (non-collapsed) data for the given issuer — skips caches that already carry
 * the regression.
 */
function findHealthyCachedInfo(infoFile: string, key: string, minCount: number): AdvisoryInfoMap | null {
  const rawBase = join(process.cwd(), 'data', 'raw');
  if (!existsSync(rawBase)) return null;

  const dateDirs = readdirSync(rawBase)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();

  for (const dateDir of dateDirs) {
    const p = join(rawBase, dateDir, infoFile);
    if (!existsSync(p)) continue;
    const data = readJson<AdvisoryInfoMap>(p);
    if (!data) continue;
    if (cachedHealthyCount(data, key) >= minCount) return data;
  }
  return null;
}

export function enforcePerSourceFloors(opts: EnforceOpts): void {
  const { logPrefix, infoFile, indicators, advisoryInfo, errors } = opts;
  const counts = countByIssuer(indicators);

  for (const [key, count] of counts) {
    // Find the issuer's last healthy coverage to derive the relative floor.
    let cachedInfo: AdvisoryInfoMap | null = null;
    let cachedCount = 0;
    const probe = findHealthyCachedInfo(infoFile, key, ABSOLUTE_FLOOR);
    if (probe) {
      cachedInfo = probe;
      cachedCount = cachedHealthyCount(probe, key);
    }

    const floor = Math.max(ABSOLUTE_FLOOR, Math.ceil(RELATIVE_FLOOR_RATIO * cachedCount));
    if (count >= floor) continue;

    const msg = `${key.toUpperCase()}: ${count} countries < floor ${floor}` +
      (cachedCount ? ` (last healthy coverage: ${cachedCount})` : '');
    console.error(`${logPrefix} PER-SOURCE FLOOR VIOLATION — ${msg}; attempting cache restore`);
    errors.push(msg);

    if (!cachedInfo) {
      console.error(`${logPrefix} ${key.toUpperCase()}: no healthy cached ${infoFile} available for restore`);
      continue;
    }
    if (cachedCount < floor) {
      // findHealthyCachedInfo guarantees >= ABSOLUTE_FLOOR, but re-check against
      // the (higher) adaptive floor before trusting the cache wholesale.
      console.warn(`${logPrefix} ${key.toUpperCase()}: cache has only ${cachedCount}, restoring anyway`);
    }

    const year = new Date().getFullYear();
    const have = new Set(
      indicators.filter((i) => i.source === `advisories_${key}`).map((i) => i.countryIso3),
    );
    const cachedLoose = loose(cachedInfo);
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
    console.warn(`${logPrefix} ${key.toUpperCase()}: restored ${restored} countries from cache`);
  }
}
