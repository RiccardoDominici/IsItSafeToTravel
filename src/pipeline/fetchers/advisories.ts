import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso2, COUNTRIES } from '../config/countries.js';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import * as cheerio from 'cheerio';

/**
 * Minimum per-source country count expected from each tier-1 fetcher.
 * If a fetcher produces fewer, we treat it as a regression and fall back to
 * the most recent cached info for THAT specific source.
 * Picked at ~150 because the US/UK/CA/AU each cover 200+ destinations in
 * normal operation, but allow some slack for legitimate transient drops.
 */
const PER_SOURCE_FLOOR = 150;

const US_ADVISORIES_URL =
  'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html';
const UK_FCDO_API_URL = 'https://www.gov.uk/api/content/foreign-travel-advice';
const CA_ADVISORIES_URL = 'https://travel.gc.ca/destinations';
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

/** Canada level number to descriptive text */
const CA_LEVEL_TEXT: Record<number, string> = {
  1: 'Exercise normal security precautions',
  2: 'Exercise a high degree of caution',
  3: 'Avoid non-essential travel',
  4: 'Avoid all travel',
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

  const usResult = await runWithFloor('US', sourceKey.US, () =>
    fetchUsAdvisories(rawDir, fetchedAt, currentYear), errors);
  allIndicators.push(...usResult.indicators);
  mergeAdvisoryInfo(combinedAdvisoryInfo, usResult.advisoryInfo);

  const ukResult = await runWithFloor('UK', sourceKey.UK, () =>
    fetchUkAdvisories(rawDir, fetchedAt, currentYear), errors);
  allIndicators.push(...ukResult.indicators);
  mergeAdvisoryInfo(combinedAdvisoryInfo, ukResult.advisoryInfo);

  const caResult = await runWithFloor('CA', sourceKey.CA, () =>
    fetchCaAdvisories(rawDir, fetchedAt, currentYear), errors);
  allIndicators.push(...caResult.indicators);
  mergeAdvisoryInfo(combinedAdvisoryInfo, caResult.advisoryInfo);

  const auResult = await runWithFloor('AU', sourceKey.AU, () =>
    fetchAuAdvisories(rawDir, fetchedAt, currentYear), errors);
  allIndicators.push(...auResult.indicators);
  mergeAdvisoryInfo(combinedAdvisoryInfo, auResult.advisoryInfo);

  // If all failed, try cached data
  if (allIndicators.length === 0) {
    const cached = findLatestCached('advisories-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[ADVISORIES] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'advisories-parsed.json'), cachedData);
        // Also try to copy cached advisory info
        const cachedInfoPath = cached.replace('advisories-parsed.json', 'advisories-info.json');
        const cachedInfo = readJson<AdvisoryInfoMap>(cachedInfoPath);
        if (cachedInfo) {
          writeJson(join(rawDir, 'advisories-info.json'), cachedInfo);
        }
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'advisories',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Errors: ${errors.join('; ')}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'advisories',
      success: false,
      countriesFound: 0,
      error: errors.join('; '),
      fetchedAt,
    };
  }

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

/**
 * Run a sub-fetcher with a per-source floor check.
 *
 * If the fetcher throws OR returns fewer than PER_SOURCE_FLOOR countries, we
 * log loudly and try to recover by loading the most-recent cached
 * `advisories-info.json` that actually contains data for this source. This way
 * a single-source HTML-structure regression (like the US one that ran silently
 * 2026-05-27 → 2026-06-02) cannot drop the column to all-null again.
 */
type AdvisorySourceKey = 'us' | 'uk' | 'ca' | 'au';

async function runWithFloor(
  label: string,
  sourceKey: AdvisorySourceKey,
  fn: () => Promise<FetcherResult>,
  errors: string[],
): Promise<FetcherResult> {
  console.log(`[ADVISORIES] Fetching ${label} advisories...`);
  let result: FetcherResult = { indicators: [], advisoryInfo: {} };
  try {
    result = await fn();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES] ${label} fetch failed: ${msg}`);
    errors.push(`${label}: ${msg}`);
  }

  const countries = new Set(result.indicators.map((i) => i.countryIso3));
  console.log(`[ADVISORIES] ${label}: ${countries.size} countries`);

  if (countries.size < PER_SOURCE_FLOOR) {
    console.error(
      `[ADVISORIES] ${label} below per-source floor ` +
        `(${countries.size} < ${PER_SOURCE_FLOOR}) — attempting per-source cache fallback`,
    );
    errors.push(`${label}: below floor (${countries.size} < ${PER_SOURCE_FLOOR})`);

    const cached = findLatestCachedSourceInfo(sourceKey);
    if (cached) {
      console.warn(`[ADVISORIES] ${label}: using cached ${sourceKey} info from ${cached.path}`);
      const restored = restoreFromCachedInfo(cached.data, sourceKey);
      // Merge: keep any indicators we did get (better than nothing), and
      // overlay the cached ones for countries we missed.
      const have = new Set(result.indicators.map((i) => i.countryIso3));
      for (const ind of restored.indicators) {
        if (!have.has(ind.countryIso3)) result.indicators.push(ind);
      }
      for (const [iso3, info] of Object.entries(restored.advisoryInfo)) {
        if (!result.advisoryInfo[iso3]) result.advisoryInfo[iso3] = {};
        // Only fill in this specific source if missing
        if (!result.advisoryInfo[iso3][sourceKey] && info[sourceKey]) {
          result.advisoryInfo[iso3][sourceKey] = info[sourceKey];
        }
      }
      const finalCountries = new Set(result.indicators.map((i) => i.countryIso3));
      console.warn(
        `[ADVISORIES] ${label}: after cache fallback ${finalCountries.size} countries`,
      );
    } else {
      console.error(`[ADVISORIES] ${label}: no cached info available for fallback`);
    }
  }

  return result;
}

/**
 * Find the most recent cached `advisories-info.json` (across data/raw/YYYY-MM-DD/)
 * that actually contains non-null data for the given source key. We skip
 * cached files that already have all-null for this source — otherwise we'd
 * happily "restore" a broken cache.
 */
function findLatestCachedSourceInfo(
  sourceKey: AdvisorySourceKey,
): { path: string; data: AdvisoryInfoMap } | null {
  const rawBase = join(process.cwd(), 'data', 'raw');
  // Scan in date order ourselves — `findLatestCached` would stop at the most
  // recent file, but we want the most recent file whose data for THIS source
  // is non-empty (skipping cached snapshots that already had the regression).
  if (!existsSync(rawBase)) return null;
  const dateDirs = readdirSync(rawBase)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
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
      return { path: p, data };
    }
  }
  return null;
}

/**
 * Rebuild a partial FetcherResult (indicators + advisoryInfo restricted to the
 * given source) from a cached AdvisoryInfoMap.
 */
function restoreFromCachedInfo(
  cached: AdvisoryInfoMap,
  sourceKey: AdvisorySourceKey,
): FetcherResult {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};
  const indicatorName = `advisory_level_${sourceKey}` as const;
  const sourceTag = `advisories_${sourceKey}`;
  const year = new Date().getFullYear();

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
    advisoryInfo[iso3] = { [sourceKey]: entry } as AdvisoryInfoMap[string];
  }
  return { indicators, advisoryInfo };
}

/**
 * Fetch US State Department travel advisories.
 * Parses HTML to extract country advisory levels (1-4).
 * Stores RAW level values (1-4) -- normalization is handled by the scoring engine.
 */
async function fetchUsAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const response = await fetch(US_ADVISORIES_URL, {
    signal: AbortSignal.timeout(30_000),
    redirect: 'follow',
    headers: {
      'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  writeJson(join(rawDir, 'advisories-us.json'), {
    url: US_ADVISORIES_URL,
    fetchedAt,
    contentLength: html.length,
    type: 'html',
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
  const seen = new Set<string>();

  // Find every destination row by its TH cell, then walk siblings.
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

    const country = getCountryByName(countryName);
    if (!country) return;
    if (seen.has(country.iso3)) return;
    seen.add(country.iso3);

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_us',
      value: level,
      year: currentYear,
      source: 'advisories_us',
    });

    // Parse date from MM/DD/YYYY format
    let updatedAt = fetchedAt;
    if (dateStr) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        updatedAt = `${parts[2]}-${parts[0]}-${parts[1]}T00:00:00Z`;
      }
    }

    if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
    advisoryInfo[country.iso3].us = {
      level,
      text: US_LEVEL_TEXT[level] || `Level ${level}`,
      source: 'US State Department',
      url: US_ADVISORIES_URL,
      updatedAt,
    };
  });

  if (indicators.length === 0) {
    console.warn(
      '[ADVISORIES] US: HTML parser matched 0 countries — page format may have changed again',
    );
  }

  return { indicators, advisoryInfo };
}

/** UK FCDO alert_status values mapped to 1-4 advisory levels */
const UK_ALERT_LEVEL: Record<string, number> = {
  avoid_all_travel_to_whole_country: 4,
  avoid_all_but_essential_travel_to_whole_country: 3,
  avoid_all_travel_to_parts: 3,
  avoid_all_but_essential_travel_to_parts: 2,
};

/** UK level number to descriptive text */
const UK_LEVEL_TEXT: Record<number, string> = {
  1: 'No specific advisory — see latest advice',
  2: 'Exercise caution in some areas — see latest advice',
  3: 'Advise against all but essential travel',
  4: 'Advise against all travel',
};

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
    slug: string;
    iso3: string;
    updatedAt: string;
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
    const updatedAt = String(childObj.public_updated_at || fetchedAt);

    countriesToFetch.push({
      countryName,
      slug,
      iso3: country.iso3,
      updatedAt,
      apiUrl: `https://www.gov.uk/api/content/foreign-travel-advice/${slug}`,
    });
  }

  // Step 2: Batch-fetch individual country pages for alert_status (20 concurrent)
  await fetchBatch(countriesToFetch, async (entry) => {
    let level = 1; // Default: no specific advisory
    let alertText = '';

    try {
      const r = await fetch(entry.apiUrl, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)',
        },
      });

      if (r.ok) {
        const data = await r.json() as Record<string, unknown>;
        const details = data.details as Record<string, unknown> | undefined;
        const alertStatus = (details?.alert_status || []) as string[];

        // Use the most severe alert status
        let maxLevel = 1;
        for (const status of alertStatus) {
          const statusLevel = UK_ALERT_LEVEL[status] ?? 1;
          if (statusLevel > maxLevel) maxLevel = statusLevel;
        }
        level = maxLevel;

        // Use the description from the individual page if available
        const desc = String(data.description || '').trim();
        if (desc && !desc.startsWith('FCDO travel advice')) {
          alertText = desc;
        }
      }
    } catch {
      // Individual country fetch failed — use default level 1
    }

    indicators.push({
      countryIso3: entry.iso3,
      indicatorName: 'advisory_level_uk',
      value: level,
      year: currentYear,
      source: 'advisories_uk',
    });

    if (!advisoryInfo[entry.iso3]) advisoryInfo[entry.iso3] = {};
    advisoryInfo[entry.iso3].uk = {
      level,
      text: alertText || UK_LEVEL_TEXT[level] || `Level ${level}`,
      source: 'UK FCDO',
      url: `https://www.gov.uk/foreign-travel-advice/${entry.slug}`,
      updatedAt: entry.updatedAt,
    };
  }, 20);

  return { indicators, advisoryInfo };
}

/** Parse Canada advisory level from individual country page HTML.
 *  Only match the actual banner class (not the legend section which lists all levels). */
function parseCaAdvisoryLevel(html: string): number {
  // The active advisory banner uses class="banner-X" with the advisory text inside
  // e.g. <div class='banner-do-not-travel'>Avoid all travel</div>
  const bannerMatch = html.match(/class=['"]banner-(do-not-travel|reconsider-travel|increased-caution|normal-precautions)['"]/i);
  if (bannerMatch) {
    const bannerType = bannerMatch[1].toLowerCase();
    if (bannerType === 'do-not-travel') return 4;
    if (bannerType === 'reconsider-travel') return 3;
    if (bannerType === 'increased-caution') return 2;
    if (bannerType === 'normal-precautions') return 1;
  }
  return 2; // default to caution
}

/**
 * Fetch Canada Government travel advisories.
 * Step 1: Extract country slugs from the dropdown on travel.gc.ca/destinations
 * Step 2: Batch-fetch individual country pages to extract advisory levels
 */
async function fetchCaAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Step 1: Get the destinations page with the dropdown
  const response = await fetch(CA_ADVISORIES_URL, {
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
  writeJson(join(rawDir, 'advisories-ca.json'), {
    url: CA_ADVISORIES_URL,
    fetchedAt,
    contentLength: html.length,
    type: 'html',
  });

  // Extract country slugs from <option value="slug">Country Name</option>
  const optionPattern = /<option\s+value="([^"]+)">([^<]+)<\/option>/gi;
  interface CaEntry { slug: string; name: string; iso3: string }
  const entries: CaEntry[] = [];

  let match;
  while ((match = optionPattern.exec(html)) !== null) {
    const slug = match[1].trim();
    const name = match[2].trim();
    if (!slug || slug === '') continue; // skip empty "Select" option

    const country = getCountryByName(name);
    if (!country) continue;

    entries.push({ slug, name, iso3: country.iso3 });
  }

  console.log(`[ADVISORIES] CA: Found ${entries.length} countries in dropdown, fetching advisory levels...`);

  // Step 2: Batch-fetch individual country pages (20 concurrent)
  const seen = new Set<string>();

  await fetchBatch(entries, async (entry) => {
    if (seen.has(entry.iso3)) return;

    try {
      const r = await fetch(`https://travel.gc.ca/destinations/${entry.slug}`, {
        signal: AbortSignal.timeout(15_000),
        redirect: 'follow',
        headers: {
          'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)',
          Accept: 'text/html',
        },
      });

      if (!r.ok) return;

      const pageHtml = await r.text();
      const level = parseCaAdvisoryLevel(pageHtml);

      seen.add(entry.iso3);

      indicators.push({
        countryIso3: entry.iso3,
        indicatorName: 'advisory_level_ca',
        value: level,
        year: currentYear,
        source: 'advisories_ca',
      });

      if (!advisoryInfo[entry.iso3]) advisoryInfo[entry.iso3] = {};
      advisoryInfo[entry.iso3].ca = {
        level,
        text: CA_LEVEL_TEXT[level] || `Level ${level}`,
        source: 'Government of Canada',
        url: `https://travel.gc.ca/destinations/${entry.slug}`,
        updatedAt: fetchedAt,
      };
    } catch {
      // Individual country fetch failed — skip it
    }
  }, 20);

  return { indicators, advisoryInfo };
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
        updatedAt: fetchedAt,
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
          updatedAt: fetchedAt,
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
