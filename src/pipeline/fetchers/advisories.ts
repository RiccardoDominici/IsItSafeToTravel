import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import { writeJson, readJson, getRawDir } from '../utils/fs.js';
import { getCountryByName, getCountryByIso2, COUNTRIES } from '../config/countries.js';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { dropSelfAdvisoriesLogged } from './advisory-self.js';
import { parseUkAdvisory, type UkAdvisory } from './advisories-uk.js';
import { CA_FETCH_HEADERS, CA_OPEN_DATA_URLS, parseCaOpenData, summarizeCaOpenData } from './advisories-ca.js';
import {
  MAX_FALLBACK_AGE_DAYS,
  daysBetween,
  isFallbackFresh,
  writeAdvisoryFallbackReport,
  type AdvisoryIssuerStatus,
} from './advisory-fallback.js';

// Kept importable from here: tests and older callers read it from advisories.ts.
export { daysBetween } from './advisory-fallback.js';

/**
 * Minimum per-source country count expected from each tier-1 fetcher.
 * If a fetcher produces fewer, we treat it as a regression and fall back to
 * the most recent cached info for THAT specific source.
 * Picked at ~150 because the US/UK/CA/AU each cover 200+ destinations in
 * normal operation, but allow some slack for legitimate transient drops.
 */
const PER_SOURCE_FLOOR = 150;

// US State Department: ordered chain of independent ways to get the same data,
// tried in order by fetchUsAdvisories() until one returns usable data. See the
// big comment above US_ENDPOINTS for why the HTML page is last, not first.
const US_JSON_API_URL = 'https://cadataapi.state.gov/api/TravelAdvisories';
const US_RSS_URL = 'https://travel.state.gov/_res/rss/TAsTWs.xml';
const US_ADVISORIES_URL =
  'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html';
const UK_FCDO_API_URL = 'https://www.gov.uk/api/content/foreign-travel-advice';
const AU_ADVISORIES_URL = 'https://www.smartraveller.gov.au/api/smartraveller/destinations';
const AU_ADVISORIES_FALLBACK_URL = 'https://www.smartraveller.gov.au/destinations';

/** Advisory info map: iso3 -> { us?, uk?, ca?, au?, de?, nl?, jp?, sk?, fr?, nz?, ie?, fi?, hk?, br?, at?, ph?, be?, dk?, sg?, ro?, rs?, ee?, hr?, ar?, it?, es?, kr?, tw?, cn?, in?, ch?, se?, no?, pl?, cz?, hu?, pt? } */
export type AdvisoryInfoMap = Record<string, {
  us?: AdvisoryInfo;
  uk?: AdvisoryInfo;
  ca?: AdvisoryInfo;
  au?: AdvisoryInfo;
  de?: AdvisoryInfo;
  nl?: AdvisoryInfo;
  jp?: AdvisoryInfo;
  sk?: AdvisoryInfo;
  // Tier 2a
  fr?: AdvisoryInfo;
  nz?: AdvisoryInfo;
  ie?: AdvisoryInfo;
  fi?: AdvisoryInfo;
  hk?: AdvisoryInfo;
  br?: AdvisoryInfo;
  at?: AdvisoryInfo;
  ph?: AdvisoryInfo;
  // Tier 2b
  be?: AdvisoryInfo;
  dk?: AdvisoryInfo;
  sg?: AdvisoryInfo;
  ro?: AdvisoryInfo;
  rs?: AdvisoryInfo;
  ee?: AdvisoryInfo;
  hr?: AdvisoryInfo;
  ar?: AdvisoryInfo;
  // Tier 3a
  it?: AdvisoryInfo;
  es?: AdvisoryInfo;
  kr?: AdvisoryInfo;
  tw?: AdvisoryInfo;
  cn?: AdvisoryInfo;
  in?: AdvisoryInfo;
  // Tier 3b
  ch?: AdvisoryInfo;
  se?: AdvisoryInfo;
  no?: AdvisoryInfo;
  pl?: AdvisoryInfo;
  cz?: AdvisoryInfo;
  hu?: AdvisoryInfo;
  pt?: AdvisoryInfo;
}>;

/** US level number to descriptive text */
const US_LEVEL_TEXT: Record<number, string> = {
  1: 'Exercise Normal Precautions',
  2: 'Exercise Increased Caution',
  3: 'Reconsider Travel',
  4: 'Do Not Travel',
};

/** Australia level number to descriptive text */
const AU_LEVEL_TEXT: Record<number, string> = {
  1: 'Exercise normal safety precautions',
  2: 'Exercise a high degree of caution',
  3: 'Reconsider your need to travel',
  4: 'Do not travel',
};

interface FetcherResult {
  indicators: RawIndicator[];
  advisoryInfo: AdvisoryInfoMap;
}

export async function fetchAdvisories(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const currentYear = new Date().getFullYear();

  const allIndicators: RawIndicator[] = [];
  const combinedAdvisoryInfo: AdvisoryInfoMap = {};
  const errors: string[] = [];
  let totalCountries = 0;

  // Run each tier-1 sub-fetcher with a per-source floor + per-source cache fallback.
  // This prevents future silent regressions where one source (e.g. US) breaks but
  // the others keep returning data, masking the failure.
  const sourceKey = {
    US: 'us' as const,
    UK: 'uk' as const,
    CA: 'ca' as const,
    AU: 'au' as const,
  };

  // US: pass `errors` straight into the fetcher too, so each endpoint in its
  // internal json-api -> rss -> html chain can log its own failure reason even
  // when a later endpoint in the chain ends up succeeding (see US_ENDPOINTS).
  const issuers: { label: string; key: AdvisorySourceKey; fetch: () => Promise<FetcherResult> }[] = [
    { label: 'US', key: sourceKey.US, fetch: () => fetchUsAdvisories(rawDir, fetchedAt, currentYear, errors) },
    { label: 'UK', key: sourceKey.UK, fetch: () => fetchUkAdvisories(rawDir, fetchedAt, currentYear) },
    { label: 'CA', key: sourceKey.CA, fetch: () => fetchCaAdvisories(rawDir, fetchedAt, currentYear) },
    { label: 'AU', key: sourceKey.AU, fetch: () => fetchAuAdvisories(rawDir, fetchedAt, currentYear) },
  ];
  const statuses: AdvisoryIssuerStatus[] = [];
  for (const issuer of issuers) {
    const { result, status } = await runWithFloor(issuer.label, issuer.key, issuer.fetch, errors, date);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    statuses.push(status);
  }

  // Per-issuer fallback state (live / restored / dropped), read by the staleness monitor:
  // a dropped issuer is a violation there and fires the ntfy alert (advisory-fallback.ts).
  writeAdvisoryFallbackReport(rawDir, { date, maxAgeDays: MAX_FALLBACK_AGE_DAYS, issuers: statuses });
  console.log(`[ADVISORIES] Fallback status: ${statuses.map(describeIssuerStatus).join('; ')}`);

  // Nothing live and no fallback young enough for any issuer. There used to be a second,
  // whole-file fallback here (copy the newest advisories-parsed.json, whatever its age);
  // it would bypass the age limit runWithFloor just applied per issuer, so it is gone.
  if (allIndicators.length === 0) {
    return {
      source: 'advisories',
      success: false,
      countriesFound: 0,
      error: errors.join('; '),
      fetchedAt,
    };
  }

  // I51: a ministry's page about its own country is never an advisory (advisory-self.ts).
  dropSelfAdvisoriesLogged('[ADVISORIES]', allIndicators, combinedAdvisoryInfo);

  // Save combined parsed data
  const sourceData: RawSourceData = {
    source: 'advisories',
    fetchedAt,
    indicators: allIndicators,
  };
  writeJson(join(rawDir, 'advisories-parsed.json'), sourceData);

  // Save advisory info side-channel
  writeJson(join(rawDir, 'advisories-info.json'), combinedAdvisoryInfo);

  totalCountries = new Set(allIndicators.map((i) => i.countryIso3)).size;
  console.log(
    `[ADVISORIES] Successfully processed ${totalCountries} countries total (${allIndicators.length} indicators)`,
  );

  return {
    source: 'advisories',
    success: true,
    countriesFound: totalCountries,
    error: errors.length > 0 ? `Partial: ${errors.join('; ')}` : undefined,
    fetchedAt,
  };
}

/** Merge source advisory info into the combined map. */
function mergeAdvisoryInfo(target: AdvisoryInfoMap, source: AdvisoryInfoMap): void {
  for (const [iso3, info] of Object.entries(source)) {
    if (!target[iso3]) target[iso3] = {};
    Object.assign(target[iso3], info);
  }
}

type AdvisorySourceKey = 'us' | 'uk' | 'ca' | 'au';

/**
 * Run a sub-fetcher with a per-source floor check and an age-limited cache fallback.
 *
 * If the fetcher throws OR returns fewer than PER_SOURCE_FLOOR countries, we
 * log loudly and try to recover by loading the most-recent cached
 * `advisories-info.json` that actually contains data for this source. This way
 * a single-source HTML-structure regression (like the US one that ran silently
 * 2026-05-27 → 2026-06-02) cannot drop the column to all-null again.
 *
 * The fallback counts only for MAX_FALLBACK_AGE_DAYS after the reading was last
 * fetched live (advisory-fallback.ts): an older reading is refused and the issuer
 * is dropped for the day. Before this rule the CA column republished its
 * 2026-10-01 levels for two weeks after travel.gc.ca changed.
 *
 * Exported for tests; `rawBase` points them at a throwaway archive.
 */
export async function runWithFloor(
  label: string,
  sourceKey: AdvisorySourceKey,
  fn: () => Promise<FetcherResult>,
  errors: string[],
  todayDate: string,
  rawBase: string = join(process.cwd(), 'data', 'raw'),
): Promise<{ result: FetcherResult; status: AdvisoryIssuerStatus }> {
  console.log(`[ADVISORIES] Fetching ${label} advisories...`);
  let result: FetcherResult = { indicators: [], advisoryInfo: {} };
  try {
    result = await fn();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES] ${label} fetch failed: ${msg}`);
    errors.push(`${label}: ${msg}`);
  }

  const liveCountries = new Set(result.indicators.map((i) => i.countryIso3)).size;
  console.log(`[ADVISORIES] ${label}: ${liveCountries} countries`);
  const status: AdvisoryIssuerStatus = {
    issuer: sourceKey,
    label,
    state: 'live',
    liveCountries,
    restoredCountries: 0,
    droppedCountries: 0,
    lastLive: null,
    ageDays: null,
    maxAgeDays: MAX_FALLBACK_AGE_DAYS,
  };
  if (liveCountries >= PER_SOURCE_FLOOR) return { result, status };

  console.error(
    `[ADVISORIES] ${label} below per-source floor ` +
      `(${liveCountries} < ${PER_SOURCE_FLOOR}) — attempting per-source cache fallback`,
  );
  errors.push(`${label}: below floor (${liveCountries} < ${PER_SOURCE_FLOOR})`);

  const cached = findLatestCachedSourceInfo(sourceKey, todayDate, rawBase);
  if (!cached) {
    status.state = 'dropped';
    status.reason = 'no cached reading';
    console.error(`[ADVISORIES] ${label}: no cached info available for fallback — ${label} dropped for ${todayDate}`);
    errors.push(`${label}: dropped (no cached reading to fall back on)`);
    return { result, status };
  }

  console.warn(`[ADVISORIES] ${label}: using cached ${sourceKey} info from ${cached.path}`);
  const fallback = selectFallback(cached.data, sourceKey, cached.date, todayDate);

  // Merge: keep any indicators we did get (better than nothing), and
  // overlay the cached ones for countries we missed.
  const have = new Set(result.indicators.map((i) => i.countryIso3));
  let restoredCountries = 0;
  for (const ind of fallback.fresh.indicators) {
    if (have.has(ind.countryIso3)) continue;
    result.indicators.push(ind);
    restoredCountries++;
  }
  for (const [iso3, info] of Object.entries(fallback.fresh.advisoryInfo)) {
    if (!result.advisoryInfo[iso3]) result.advisoryInfo[iso3] = {};
    // Only fill in this specific source if missing
    if (!result.advisoryInfo[iso3][sourceKey] && info[sourceKey]) {
      result.advisoryInfo[iso3][sourceKey] = info[sourceKey];
    }
  }
  status.restoredCountries = restoredCountries;
  status.droppedCountries = fallback.staleIso3.length;

  if (fallback.staleIso3.length > 0) {
    const ageDays = daysBetween(todayDate, fallback.newestStale!);
    console.error(
      `[ADVISORIES] ${label}: FALLBACK TOO OLD — ${fallback.staleIso3.length} cached countries last live on ` +
        `${fallback.newestStale} (${ageDays}d > ${MAX_FALLBACK_AGE_DAYS}d) not restored`,
    );
    errors.push(
      `${label}: ${fallback.staleIso3.length} cached readings from ${fallback.newestStale} refused ` +
        `(${ageDays}d old, max ${MAX_FALLBACK_AGE_DAYS}d)`,
    );
  }

  if (fallback.fresh.indicators.length === 0) {
    status.state = 'dropped';
    status.reason = fallback.staleIso3.length > 0 ? 'fallback too old' : 'no cached reading';
    status.lastLive = fallback.newestStale;
    status.ageDays = fallback.newestStale ? daysBetween(todayDate, fallback.newestStale) : null;
    console.error(
      `[ADVISORIES] ${label}: dropped for ${todayDate} (${status.reason}` +
        `${status.lastLive ? `, last live ${status.lastLive}` : ''}); ${liveCountries} live countries kept`,
    );
    return { result, status };
  }

  // The OLDEST origin among what was merged, so the staleness reported reflects the true
  // last-genuinely-live date even after this fallback has chained forward across days.
  status.state = 'restored';
  status.lastLive = fallback.oldestFresh;
  status.ageDays = fallback.oldestFresh ? daysBetween(todayDate, fallback.oldestFresh) : null;
  const finalCountries = new Set(result.indicators.map((i) => i.countryIso3));
  console.warn(`[ADVISORIES] ${label}: after cache fallback ${finalCountries.size} countries`);
  console.error(
    `[ADVISORIES] ${label}: restored data last genuinely live on ${status.lastLive} ` +
      `(${status.ageDays}d stale, counts until ${MAX_FALLBACK_AGE_DAYS}d)`,
  );
  errors.push(`${label}: restored from cache dated ${status.lastLive} (${status.ageDays}d stale)`);
  return { result, status };
}

/** One "CA dropped (fallback too old, last live 2026-10-01, 14d)" fragment of the status log line. */
function describeIssuerStatus(s: AdvisoryIssuerStatus): string {
  if (s.state === 'live') return `${s.label} live (${s.liveCountries})`;
  const since = s.lastLive ? `, last live ${s.lastLive}, ${s.ageDays}d` : '';
  if (s.state === 'restored') return `${s.label} restored (${s.restoredCountries} countries${since})`;
  return `${s.label} DROPPED (${s.reason}${since}, max ${s.maxAgeDays}d)`;
}

/**
 * Split a cached info map's entries for one source into those still young enough to
 * restore (last live at most `maxAgeDays` before `runDate`) and those refused. An
 * entry's last live date is its propagated `restoredFrom`, else the cache's own date.
 * Pure.
 */
export function selectFallback(
  cached: AdvisoryInfoMap,
  sourceKey: AdvisorySourceKey,
  cacheDate: string,
  runDate: string,
  maxAgeDays: number = MAX_FALLBACK_AGE_DAYS,
): { fresh: FetcherResult; staleIso3: string[]; oldestFresh: string | null; newestStale: string | null } {
  const restored = restoreFromCachedInfo(cached, sourceKey, cacheDate, Number(runDate.slice(0, 4)));
  const fresh: FetcherResult = { indicators: [], advisoryInfo: {} };
  const staleIso3: string[] = [];
  let oldestFresh: string | null = null;
  let newestStale: string | null = null;

  for (const ind of restored.indicators) {
    const entry = restored.advisoryInfo[ind.countryIso3]?.[sourceKey];
    const lastLive = entry?.restoredFrom ?? cacheDate;
    if (isFallbackFresh(lastLive, runDate, maxAgeDays)) {
      fresh.indicators.push(ind);
      if (entry) fresh.advisoryInfo[ind.countryIso3] = { [sourceKey]: entry } as AdvisoryInfoMap[string];
      if (!oldestFresh || lastLive < oldestFresh) oldestFresh = lastLive;
    } else {
      staleIso3.push(ind.countryIso3);
      if (!newestStale || lastLive > newestStale) newestStale = lastLive;
    }
  }
  return { fresh, staleIso3, oldestFresh, newestStale };
}

/**
 * Find the most recent cached `advisories-info.json` (across data/raw/YYYY-MM-DD/,
 * on or before the run date) that actually contains non-null data for the given
 * source key. We skip cached files that already have all-null for this source —
 * otherwise we'd happily "restore" a broken cache. Age is not judged here:
 * selectFallback applies the limit per entry.
 */
function findLatestCachedSourceInfo(
  sourceKey: AdvisorySourceKey,
  runDate: string,
  rawBase: string,
): { path: string; date: string; data: AdvisoryInfoMap } | null {
  // Scan in date order ourselves — `findLatestCached` would stop at the most
  // recent file, but we want the most recent file whose data for THIS source
  // is non-empty (skipping cached snapshots that already had the regression).
  if (!existsSync(rawBase)) return null;
  const dateDirs = readdirSync(rawBase)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= runDate)
    .sort()
    .reverse();
  for (const dateDir of dateDirs) {
    const p = join(rawBase, dateDir, 'advisories-info.json');
    if (!existsSync(p)) continue;
    const data = readJson<AdvisoryInfoMap>(p);
    if (!data) continue;
    // Does this file have meaningful data for the source we're trying to restore?
    let nonNull = 0;
    for (const info of Object.values(data)) {
      if (info && info[sourceKey]) nonNull++;
    }
    if (nonNull >= PER_SOURCE_FLOOR) {
      return { path: p, date: dateDir, data };
    }
  }
  return null;
}

/**
 * Rebuild a partial FetcherResult (indicators + advisoryInfo restricted to the
 * given source) from a cached AdvisoryInfoMap. `cacheDate` is the YYYY-MM-DD of
 * the raw dir the cache came from (findLatestCachedSourceInfo's `date`).
 */
function restoreFromCachedInfo(
  cached: AdvisoryInfoMap,
  sourceKey: AdvisorySourceKey,
  cacheDate: string,
  year: number,
): FetcherResult {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};
  const indicatorName = `advisory_level_${sourceKey}` as const;
  const sourceTag = `advisories_${sourceKey}`;

  for (const [iso3, info] of Object.entries(cached)) {
    const entry = info?.[sourceKey];
    if (!entry || typeof entry.level !== 'number') continue;
    indicators.push({
      countryIso3: iso3,
      indicatorName,
      value: entry.level,
      year,
      source: sourceTag,
    });
    // Propagate the ORIGINAL restoredFrom date forward if this cached entry was
    // itself already a restore, so a 10-week-stale value doesn't reset its
    // staleness clock to "1 day old" just because it got re-persisted into
    // yesterday's snapshot. If this is the first fallback in the chain (no
    // restoredFrom yet), the cache file's own date IS the last time it was
    // genuinely live.
    const restoredEntry: AdvisoryInfo = {
      ...entry,
      restoredFrom: entry.restoredFrom ?? cacheDate,
    };
    advisoryInfo[iso3] = { [sourceKey]: restoredEntry } as AdvisoryInfoMap[string];
  }
  return { indicators, advisoryInfo };
}

/**
 * Country-name aliases where the State Department's own label text differs from
 * the ISO-based English name in COUNTRIES (same pattern as gpi.ts NAME_ALIASES).
 * Verified 2026-09-25 (SOURCE-REPAIR-BRIEF) against a live fetch of both the JSON
 * API and RSS feed: 20 of 218 titles did not resolve via getCountryByName without
 * this table -- these 12 are genuine renames; the other 8 are handled separately
 * below (grouped China/HK/Macau title, split territories, fan-out territory, and
 * one destination -- Bermuda -- that isn't in our 248-country list at all).
 */
const US_NAME_ALIASES: Record<string, string> = {
  'curaçao': 'Curacao',
  'curacao': 'Curacao',
  'macau': 'Macao',
  'the bahamas': 'Bahamas',
  'federated states of micronesia': 'Micronesia',
  'burma': 'Myanmar',
  'cote d ivoire': "Cote d'Ivoire",
  'the kyrgyz republic': 'Kyrgyzstan',
  'the gambia': 'Gambia',
  'czechia': 'Czech Republic',
  'republic of the congo': 'Congo',
  'kingdom of denmark': 'Denmark',
};

function resolveUsCountryName(rawName: string): string {
  const key = rawName.trim().toLowerCase();
  return US_NAME_ALIASES[key] || rawName.trim();
}

/**
 * The State Department groups China/Hong Kong/Macau advisories under one shared
 * headline ("Mainland China, Hong Kong & Macau - See Summaries") but still links
 * each row to a DIFFERENT per-territory page with a different level. Hong Kong and
 * Macau each ALSO get their own cleanly-titled row elsewhere in the same feed
 * (verified 2026-09-25), so the only territory we actually need to rescue from the
 * shared headline is mainland China, which has no clean row of its own. Any other
 * row using this shared headline is therefore a redundant duplicate of a row we
 * already capture cleanly -- return null to skip it rather than risk swapping
 * China's, Hong Kong's, and Macau's levels around.
 */
const US_CHINA_GROUP_TITLE = 'mainland china, hong kong & macau - see summaries';

function resolveUsGroupedTitle(rawName: string, url: string): string | null {
  if (rawName.trim().toLowerCase() !== US_CHINA_GROUP_TITLE) return rawName;
  return /\/china-travel-advisory\.html$/i.test(url) ? 'China' : null;
}

/**
 * Territories the State Department publishes as SEPARATE advisory pages but that
 * map to a single entry in our 248-country list: iso3 -> the merge is "take the
 * MOST SEVERE of the constituent levels". This is NOT the same situation the
 * DE/NL sub-national guard (data-pipeline.yml) exists to prevent -- that guard
 * stops one dangerous region from dragging down an otherwise-safe, much larger
 * country. Here, West Bank + Gaza together ARE the entirety of Palestine's
 * territory, and Bonaire + Saba/Sint Eustatius together ARE the entirety of the
 * BES islands -- there is no "safe majority of the country" being unfairly
 * outweighed. Per SOURCE-REPAIR-BRIEF rule 1, "a wrong level on a war zone is far
 * worse than no data"; the same reasoning means picking the calmer half here
 * would silently understate risk for whichever half is actually the worse one.
 */
const US_COMPOSITE_TERRITORIES: Record<string, string> = {
  'west bank': 'PSE',
  'gaza': 'PSE',
  'bonaire': 'BES',
  'saba and sint eustatius': 'BES',
};

/**
 * The reverse situation: ONE State Department advisory page that explicitly
 * covers MULTIPLE of our countries at once. Apply the same level to every iso3
 * listed -- the source itself treats them as one unit, so there's no conflicting
 * data to reconcile (unlike US_COMPOSITE_TERRITORIES above).
 */
const US_FANOUT_TERRITORIES: Record<string, string[]> = {
  'french west indies': ['MTQ', 'GLP'],
};

interface CollectedUsEntry {
  level: number;
  url: string;
  updatedAt?: string;
}

/**
 * Feed one parsed (name, level, url, updatedAt) row into the accumulator,
 * resolving fan-out/composite/alias handling uniformly no matter which endpoint
 * produced the row. Composite territories (US_COMPOSITE_TERRITORIES) are the only
 * case where a second row for an already-seen iso3 can change the stored level;
 * any other duplicate (e.g. the feed lists "Saint Kitts and Nevis" twice, once per
 * URL scheme) keeps whichever row arrived first -- same semantics as the old
 * per-endpoint `seen` set.
 */
function collectUsEntry(
  collected: Map<string, CollectedUsEntry>,
  rawName: string,
  level: number,
  url: string,
  updatedAt: string | undefined,
): void {
  const key = rawName.trim().toLowerCase();

  const fanoutTargets = US_FANOUT_TERRITORIES[key];
  if (fanoutTargets) {
    for (const iso3 of fanoutTargets) {
      if (!collected.has(iso3)) collected.set(iso3, { level, url, updatedAt });
    }
    return;
  }

  const compositeIso3 = US_COMPOSITE_TERRITORIES[key];
  if (compositeIso3) {
    const existing = collected.get(compositeIso3);
    if (!existing || level > existing.level) {
      collected.set(compositeIso3, { level, url, updatedAt });
    }
    return;
  }

  const country = getCountryByName(resolveUsCountryName(rawName));
  if (!country) return;
  if (!collected.has(country.iso3)) {
    collected.set(country.iso3, { level, url, updatedAt });
  }
}

/** Turn the resolved iso3 -> level/url/updatedAt map into the FetcherResult shape. */
function finalizeUsEntries(
  collected: Map<string, CollectedUsEntry>,
  currentYear: number,
): FetcherResult {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  for (const [iso3, entry] of collected) {
    indicators.push({
      countryIso3: iso3,
      indicatorName: 'advisory_level_us',
      value: entry.level,
      year: currentYear,
      source: 'advisories_us',
    });
    advisoryInfo[iso3] = {
      us: {
        level: entry.level,
        text: US_LEVEL_TEXT[entry.level] || `Level ${entry.level}`,
        source: 'US State Department',
        url: entry.url,
        updatedAt: entry.updatedAt,
      },
    };
  }

  return { indicators, advisoryInfo };
}

/** Extract { name, level } from a "<Name>[ Travel Advisory] - Level N: ..." title. */
function parseUsTitle(title: string): { name: string; level: number } | null {
  const m = title.match(/^(.*?)(?:\s+Travel Advisory)?\s*-\s*Level\s+(\d)\s*:/i);
  if (!m) return null;
  const level = parseInt(m[2], 10);
  if (level < 1 || level > 4) return null;
  return { name: m[1].trim(), level };
}

const MONTH_ABBR: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Parse an RSS `pubDate` like "Tue, 08 Sep 2026" (no time component) into our
 * standard `YYYY-MM-DDT00:00:00Z` updatedAt format WITHOUT going through the JS
 * Date constructor -- parsing a time-less date string with `new Date()` uses the
 * process's local timezone and can shift the calendar day by +/-1, which would
 * silently vary between a dev machine and a UTC CI runner.
 */
function parseRssPubDate(text: string): string | undefined {
  const m = text.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return undefined;
  const month = MONTH_ABBR[m[2].toLowerCase()];
  if (!month) return undefined;
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}T00:00:00Z`;
}

/**
 * Parse the JSON API's `Updated`/`Published` ("2026-09-08T20:00:00-04:00") into
 * our standard format, keeping the LOCAL calendar date exactly as published
 * rather than the UTC-shifted instant (which lands on the next day for any
 * negative offset -- 20:00 -04:00 is already past midnight UTC).
 */
function parseJsonApiDate(text: string): string | undefined {
  const m = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? `${m[1]}T00:00:00Z` : undefined;
}

/**
 * Fetch with one retry for TRANSIENT failures only: network-level throws
 * (timeout, DNS, connection reset) and 5xx responses. Never retries a 4xx -- a
 * 403 is a deterministic block, not a blip, and hammering the same blocked
 * endpoint a second time in a row is both pointless and impolite (repair-brief
 * rule 4).
 */
async function fetchWithRetry(url: string, init: RequestInit, retries = 1): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      if (attempt < retries) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[ADVISORIES] network error fetching ${url} (${msg}), retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        continue;
      }
      throw error;
    }
    if (response.ok) return response;
    if (response.status >= 500 && attempt < retries) {
      console.warn(
        `[ADVISORIES] HTTP ${response.status} fetching ${url}, retrying...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      continue;
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

const US_FETCH_HEADERS = { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' };

/**
 * Pure parser: JSON API entries -> FetcherResult. Split out from
 * fetchUsFromJsonApi (which only adds the network fetch + raw-debug-dump
 * around this) so it can be unit-tested against a saved fixture without any
 * network access -- see advisories-us.test.ts.
 */
export function parseUsJsonApiData(data: unknown[], currentYear: number): FetcherResult {
  const collected = new Map<string, CollectedUsEntry>();
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;
    const title = String(obj.Title || '').trim();
    const url = String(obj.Link || '').trim();
    if (!title || !url) continue;

    const parsed = parseUsTitle(title);
    if (!parsed) continue;

    const resolvedName = resolveUsGroupedTitle(parsed.name, url);
    if (resolvedName === null) continue;

    const updatedAt = parseJsonApiDate(String(obj.Updated || obj.Published || ''));
    collectUsEntry(collected, resolvedName, parsed.level, url, updatedAt);
  }

  return finalizeUsEntries(collected, currentYear);
}

/**
 * Endpoint 1 (tried first): the State Department's own public JSON API, the data
 * source behind their interactive advisories map. Confirmed 2026-09-25: returns
 * HTTP 200 with our existing User-Agent (no browser/JS challenge), 218 entries,
 * all 10 SOURCE-REPAIR-BRIEF spot-check countries match travel.state.gov exactly
 * (cross-checked against the RSS feed below and, for Colombia, an independent
 * news source). It is NOT the HTML advisories page -- different path, different
 * bot-protection rule.
 */
async function fetchUsFromJsonApi(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const response = await fetchWithRetry(US_JSON_API_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: 'application/json', ...US_FETCH_HEADERS },
  });

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error('unexpected response shape (not an array)');
  }
  writeJson(join(rawDir, 'advisories-us.json'), {
    url: US_JSON_API_URL,
    fetchedAt,
    endpoint: 'json-api',
    entryCount: data.length,
  });

  return parseUsJsonApiData(data, currentYear);
}

/**
 * Pure parser: RSS XML text -> FetcherResult. Split out from fetchUsFromRss for
 * the same fixture-testing reason as parseUsJsonApiData above.
 */
export function parseUsRssXml(xml: string, currentYear: number): FetcherResult {
  const $ = cheerio.load(xml, { xmlMode: true });
  const collected = new Map<string, CollectedUsEntry>();

  $('item').each((_, item) => {
    const $item = $(item);
    const title = $item.find('title').first().text().trim();
    const url = $item.find('link').first().text().trim();
    if (!title || !url) return;

    const parsed = parseUsTitle(title);
    if (!parsed) return;

    // Prefer the explicit <category domain="Threat-Level"> field over the title
    // text for the level itself -- it's structured metadata rather than a string
    // we have to regex, so less likely to break if the title wording changes.
    let level = parsed.level;
    const categoryText = $item.find('category[domain="Threat-Level"]').first().text();
    const catMatch = categoryText.match(/Level\s+(\d)/i);
    if (catMatch) {
      const catLevel = parseInt(catMatch[1], 10);
      if (catLevel >= 1 && catLevel <= 4) level = catLevel;
    }

    const resolvedName = resolveUsGroupedTitle(parsed.name, url);
    if (resolvedName === null) return;

    const updatedAt = parseRssPubDate($item.find('pubDate').first().text());
    collectUsEntry(collected, resolvedName, level, url, updatedAt);
  });

  return finalizeUsEntries(collected, currentYear);
}

/**
 * Endpoint 2 (tried second): the official travel-advisories RSS feed. Confirmed
 * 2026-09-25: HTTP 200 with our existing User-Agent, 216 items, agrees with the
 * JSON API on every spot-checked country. Kept as an independent fallback in case
 * the JSON API's path/shape ever changes without the RSS feed changing too (or
 * vice versa) -- they are plausibly generated by different code on the State
 * Department's side even though they read from the same underlying data.
 */
async function fetchUsFromRss(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const response = await fetchWithRetry(US_RSS_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: 'application/rss+xml, text/xml', ...US_FETCH_HEADERS },
  });

  const xml = await response.text();
  writeJson(join(rawDir, 'advisories-us.json'), {
    url: US_RSS_URL,
    fetchedAt,
    endpoint: 'rss',
    contentLength: xml.length,
  });

  return parseUsRssXml(xml, currentYear);
}

/**
 * Endpoint 3 (last resort): scrape the HTML advisories page directly. As of
 * 2026-09-25 this returns HTTP 403 from every network we tried it from --
 * GitHub Actions runners (CI logs, every run since ~2026-07-14/16), this repo's
 * own dev machine via plain curl, and Anthropic's WebFetch tool -- while the two
 * endpoints above, on the same *.state.gov domain family behind the same
 * Cloudflare, both return 200. Kept as a fallback anyway: it costs one extra
 * request only when the two structured endpoints both fail, and IP/bot-rule
 * blocks like this do get relaxed or change over time.
 */
async function fetchUsFromHtml(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const response = await fetchWithRetry(US_ADVISORIES_URL, {
    signal: AbortSignal.timeout(30_000),
    redirect: 'follow',
    headers: US_FETCH_HEADERS,
  });

  const html = await response.text();
  writeJson(join(rawDir, 'advisories-us.json'), {
    url: US_ADVISORIES_URL,
    fetchedAt,
    endpoint: 'html',
    contentLength: html.length,
  });

  // travel.state.gov changed its HTML around 2026-05: the old `level-badge-N`
  // CSS classes were renamed to `level-title-N`, which silently broke our regex
  // and produced an all-null US column for ~6 days. We now parse with cheerio
  // and are tolerant of either class scheme.
  //
  // Each <tr> in the advisories table looks like:
  //   <th data-label="Destination"><a href="...">CountryName</a></th>
  //   <td data-label="Level"><p class="level-title level-title-N">Level N: ...</p></td>
  //   <td data-label="Risk Indicators">...</td>
  //   <td data-label="Date Issued"><p>MM/DD/YYYY</p></td>
  const $ = cheerio.load(html);
  const collected = new Map<string, CollectedUsEntry>();
  const destinationCells = $('th[data-label="Destination"]');

  destinationCells.each((_, th) => {
    const $th = $(th);
    const countryName = $th.find('a').first().text().trim() || $th.text().trim();
    if (!countryName || countryName.length < 2) return;

    const $row = $th.closest('tr');

    // Level: prefer class-based detection (level-title-N OR legacy level-badge-N),
    // then fall back to parsing the visible text "Level N: ...".
    let level = 0;
    const $levelCell = $row.find('[data-label="Level"]');
    const levelHtml = $levelCell.html() ?? '';
    const classMatch = levelHtml.match(/level-(?:title|badge)-(\d)/i);
    if (classMatch) {
      level = parseInt(classMatch[1], 10);
    } else {
      const textMatch = $levelCell.text().match(/Level\s+(\d)/i);
      if (textMatch) level = parseInt(textMatch[1], 10);
    }
    if (level < 1 || level > 4) return;

    // Date: prefer the "Date Issued" cell, fall back to scanning the row.
    let dateStr: string | null = null;
    const dateText = $row.find('[data-label="Date Issued"]').text();
    const dateInCell = dateText.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateInCell) {
      dateStr = dateInCell[1];
    } else {
      const dateInRow = $row.text().match(/(\d{2}\/\d{2}\/\d{4})/);
      if (dateInRow) dateStr = dateInRow[1];
    }
    let updatedAt: string | undefined;
    if (dateStr) {
      const parts = dateStr.split('/');
      if (parts.length === 3) updatedAt = `${parts[2]}-${parts[0]}-${parts[1]}T00:00:00Z`;
    }

    // Prefer the country's own link (deep link to its advisory page) over the
    // generic listing page URL, matching what the JSON/RSS endpoints give us.
    const href = $th.find('a').first().attr('href') || '';
    let url = US_ADVISORIES_URL;
    if (href) {
      try {
        url = new URL(href, US_ADVISORIES_URL).toString();
      } catch {
        // malformed href -- keep the generic listing page URL
      }
    }

    const resolvedName = resolveUsGroupedTitle(countryName, url);
    if (resolvedName === null) return;
    collectUsEntry(collected, resolvedName, level, url, updatedAt);
  });

  return finalizeUsEntries(collected, currentYear);
}

/**
 * Ordered chain of independent ways to obtain US State Department advisory
 * levels, tried in order until one returns at least one country. Each attempt's
 * failure reason is pushed into `errors` (which flows into FetchResult.error)
 * even when a LATER endpoint succeeds -- so a JSON API regression is visible in
 * the daily log/report even on a day the RSS fallback quietly covers for it.
 */
const US_ENDPOINTS: {
  name: string;
  fetch: (rawDir: string, fetchedAt: string, currentYear: number) => Promise<FetcherResult>;
}[] = [
  { name: 'json-api', fetch: fetchUsFromJsonApi },
  { name: 'rss', fetch: fetchUsFromRss },
  { name: 'html', fetch: fetchUsFromHtml },
];

async function fetchUsAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
  errors: string[],
): Promise<FetcherResult> {
  for (const endpoint of US_ENDPOINTS) {
    try {
      const result = await endpoint.fetch(rawDir, fetchedAt, currentYear);
      const countryCount = new Set(result.indicators.map((i) => i.countryIso3)).size;
      if (countryCount > 0) {
        console.log(`[ADVISORIES] US: succeeded via ${endpoint.name} (${countryCount} countries)`);
        return result;
      }
      console.warn(`[ADVISORIES] US/${endpoint.name}: parsed 0 countries, trying next endpoint`);
      errors.push(`US/${endpoint.name}: parsed 0 countries`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[ADVISORIES] US/${endpoint.name} failed: ${msg}`);
      errors.push(`US/${endpoint.name}: ${msg}`);
    }
  }
  return { indicators: [], advisoryInfo: {} };
}

/** Fetch a batch of URLs concurrently */
async function fetchBatch<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await fn(item);
    }
  });
  await Promise.allSettled(workers);
}

/**
 * Fetch UK FCDO travel advisories.
 * Step 1: Get country list from /api/content/foreign-travel-advice
 * Step 2: Batch-fetch individual country pages to get alert_status
 */
async function fetchUkAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Step 1: Get the list of all countries
  const response = await fetch(UK_FCDO_API_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: 'application/json',
      'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const rawData = await response.json();
  writeJson(join(rawDir, 'advisories-uk.json'), rawData);

  const links = (rawData as Record<string, unknown>)?.links as Record<string, unknown[]> | undefined;
  const children = links?.children || links?.related || [];

  if (!Array.isArray(children)) {
    console.warn('[ADVISORIES] UK: No children links found in response');
    return { indicators, advisoryInfo };
  }

  // Build list of countries to fetch
  interface UkCountryEntry {
    countryName: string;
    /** Names the FCDO text can use for the country: its own title name and ours. */
    countryNames: string[];
    slug: string;
    iso3: string;
    updatedAt?: string;
    apiUrl: string;
  }
  const countriesToFetch: UkCountryEntry[] = [];

  for (const child of children) {
    if (!child || typeof child !== 'object') continue;
    const childObj = child as Record<string, unknown>;
    const title = String(childObj.title || '').trim();
    if (!title) continue;

    const countryName = title.replace(/\s*travel advice\s*$/i, '').trim();
    const country = getCountryByName(countryName);
    if (!country) continue;

    const basePath = String(childObj.base_path || '');
    const slug = basePath ? basePath.replace(/^\/foreign-travel-advice\//, '') : countryName.toLowerCase().replace(/\s+/g, '-');
    const updatedAt = childObj.public_updated_at ? String(childObj.public_updated_at) : undefined;

    countriesToFetch.push({
      countryName,
      countryNames: [countryName, country.name.en],
      slug,
      iso3: country.iso3,
      updatedAt,
      apiUrl: `https://www.gov.uk/api/content/foreign-travel-advice/${slug}`,
    });
  }

  // Step 2: Batch-fetch individual country pages for alert_status (20 concurrent)
  await fetchBatch(countriesToFetch, async (entry) => {
    let advisory: UkAdvisory;

    try {
      const r = await fetch(entry.apiUrl, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)',
        },
      });

      // A failed/errored fetch means we don't actually know this country's
      // status — skip it (no indicator) rather than guess level 1. This is
      // DIFFERENT from an empty alert_status below: that comes from a
      // SUCCESSFUL response and is FCDO's own genuine "no advice against
      // travel" signal, not a guess.
      if (!r.ok) return;

      // Level from alert_status, raised when the warnings text names the whole country;
      // the label always describes that level, never the page description (I45/I46,
      // advisories-uk.ts). An empty alert_status is FCDO's own "no advice against
      // travel", level 1, not a parse failure.
      const data = await r.json() as Record<string, unknown>;
      advisory = parseUkAdvisory(data, entry.countryNames);
    } catch {
      // Network-level failure (timeout, DNS, connection reset) — skip this
      // country rather than guess level 1 (audit 2026-09-25: this used to
      // default to 1 here, asserting "normal precautions" for a country we
      // simply failed to reach).
      return;
    }

    indicators.push({
      countryIso3: entry.iso3,
      indicatorName: 'advisory_level_uk',
      value: advisory.level,
      year: currentYear,
      source: 'advisories_uk',
    });

    if (!advisoryInfo[entry.iso3]) advisoryInfo[entry.iso3] = {};
    advisoryInfo[entry.iso3].uk = {
      level: advisory.level,
      text: advisory.text,
      source: 'UK FCDO',
      url: `https://www.gov.uk/foreign-travel-advice/${entry.slug}`,
      updatedAt: entry.updatedAt,
    };
  }, 20);

  return { indicators, advisoryInfo };
}

/**
 * Fetch Canada's advisories from Global Affairs Canada's open-data JSON index (Open
 * Government Licence - Canada; parser and source notes in advisories-ca.ts). Tries the
 * alphabetical index, then the chronological one, and stops at the first that parses to
 * at least one country.
 */
async function fetchCaAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const failures: string[] = [];
  for (const url of CA_OPEN_DATA_URLS) {
    try {
      const response = await fetchWithRetry(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { Accept: 'application/json', ...CA_FETCH_HEADERS },
      });
      const json = (await response.json()) as unknown;
      const parsed = parseCaOpenData(json, currentYear);
      const generated = (json as { metadata?: { generated?: { date?: string } } })?.metadata?.generated?.date;

      writeJson(join(rawDir, 'advisories-ca.json'), {
        url,
        fetchedAt,
        endpoint: 'open-data-json',
        generated,
        countries: parsed.indicators.length,
        unmatched: parsed.unmatched,
        mismatches: parsed.mismatches,
        unreadable: parsed.unreadable,
        entries: summarizeCaOpenData(json),
      });

      if (parsed.unmatched.length > 0) {
        console.log(`[ADVISORIES] CA: ${parsed.unmatched.length} entries match no country of ours (skipped): ${parsed.unmatched.join(', ')}`);
      }
      if (parsed.mismatches.length > 0) {
        console.warn(`[ADVISORIES] CA: advisory-state and label disagree (advisory-state used): ${parsed.mismatches.join('; ')}`);
      }
      if (parsed.unreadable.length > 0) {
        console.warn(`[ADVISORIES] CA: no readable level, skipped (never guessed): ${parsed.unreadable.join(', ')}`);
      }
      if (parsed.indicators.length > 0) {
        console.log(`[ADVISORIES] CA: ${parsed.indicators.length} countries from ${url} (generated ${generated ?? 'unknown'})`);
        return { indicators: parsed.indicators, advisoryInfo: parsed.advisoryInfo };
      }
      failures.push(`${url}: parsed 0 countries`);
    } catch (error) {
      failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.warn(`[ADVISORIES] CA: ${failures[failures.length - 1]}`);
  }
  throw new Error(`every Canada open-data endpoint failed (${failures.join('; ')})`);
}

/**
 * Fetch Australia Smartraveller travel advisories.
 * Tries JSON API first, falls back to HTML scraping.
 * Australia uses 4 levels matching the standard 1-4 scale.
 */
async function fetchAuAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Try JSON API first
  let data: unknown[] | null = null;
  try {
    const response = await fetch(AU_ADVISORIES_URL, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)',
      },
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        data = await response.json() as unknown[];
        writeJson(join(rawDir, 'advisories-au.json'), data);
      }
    }
  } catch {
    console.warn('[ADVISORIES] AU: JSON API failed, trying HTML fallback...');
  }

  if (Array.isArray(data) && data.length > 0) {
    // Parse JSON API response
    const seen = new Set<string>();
    for (const entry of data) {
      if (!entry || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;

      const name = String(obj.name || obj.title || obj.country || '').trim();
      if (!name) continue;

      const country = getCountryByName(name);
      if (!country || seen.has(country.iso3)) continue;
      seen.add(country.iso3);

      // Extract level from various possible fields
      const levelText = String(obj.advisory_level || obj.level || obj.advice || obj.travel_advice || '').toLowerCase();
      const level = parseAuLevel(levelText);
      const slug = String(obj.url || obj.slug || obj.path || name.toLowerCase().replace(/\s+/g, '-'));

      indicators.push({
        countryIso3: country.iso3,
        indicatorName: 'advisory_level_au',
        value: level,
        year: currentYear,
        source: 'advisories_au',
      });

      if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
      advisoryInfo[country.iso3].au = {
        level,
        text: AU_LEVEL_TEXT[level] || `Level ${level}`,
        source: 'Australian Government',
        url: slug.startsWith('http') ? slug : `https://www.smartraveller.gov.au/destinations/${slug}`,
      };
    }
  } else {
    // Fallback: HTML scraping
    try {
      const response = await fetch(AU_ADVISORIES_FALLBACK_URL, {
        signal: AbortSignal.timeout(30_000),
        redirect: 'follow',
        headers: {
          'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)',
          Accept: 'text/html',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      writeJson(join(rawDir, 'advisories-au.json'), {
        url: AU_ADVISORIES_FALLBACK_URL,
        fetchedAt,
        contentLength: html.length,
        type: 'html',
      });

      // Parse HTML for country advisory data
      const seen = new Set<string>();
      const blockPattern = /href="\/destinations\/([^"]+)"[^>]*>([^<]+)<[\s\S]*?(?:Exercise normal safety precautions|Exercise a high degree of caution|Reconsider your need to travel|Do not travel)/gi;

      let match;
      while ((match = blockPattern.exec(html)) !== null) {
        const slug = match[1].trim();
        const countryName = match[2].trim();
        const blockText = match[0].toLowerCase();

        const level = parseAuLevel(blockText);

        const country = getCountryByName(countryName);
        if (!country || seen.has(country.iso3)) continue;
        seen.add(country.iso3);

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_au',
          value: level,
          year: currentYear,
          source: 'advisories_au',
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].au = {
          level,
          text: AU_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Australian Government',
          url: `https://www.smartraveller.gov.au/destinations/${slug}`,
        };
      }

      if (indicators.length === 0) {
        console.warn('[ADVISORIES] AU: HTML parser matched 0 countries -- page format may have changed');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`AU HTML fallback failed: ${msg}`);
    }
  }

  return { indicators, advisoryInfo };
}

/** Parse Australian advisory level text to 1-4 numeric scale. */
function parseAuLevel(text: string): number {
  const lower = text.toLowerCase();
  if (lower.includes('do not travel')) return 4;
  if (lower.includes('reconsider your need to travel') || lower.includes('reconsider')) return 3;
  if (lower.includes('high degree of caution')) return 2;
  if (lower.includes('normal safety precautions')) return 1;
  return 2; // default to caution
}
