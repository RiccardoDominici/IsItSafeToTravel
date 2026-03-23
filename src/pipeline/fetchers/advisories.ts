import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso2, COUNTRIES } from '../config/countries.js';
import { join } from 'node:path';

const US_ADVISORIES_URL =
  'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html';
const UK_FCDO_API_URL = 'https://www.gov.uk/api/content/foreign-travel-advice';
const CA_ADVISORIES_URL = 'https://travel.gc.ca/destinations';
const AU_ADVISORIES_URL = 'https://www.smartraveller.gov.au/api/smartraveller/destinations';
const AU_ADVISORIES_FALLBACK_URL = 'https://www.smartraveller.gov.au/destinations';

/** Advisory info map: iso3 -> { us?, uk?, ca?, au? } */
export type AdvisoryInfoMap = Record<string, {
  us?: AdvisoryInfo;
  uk?: AdvisoryInfo;
  ca?: AdvisoryInfo;
  au?: AdvisoryInfo;
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

  // Fetch US advisories
  try {
    console.log('[ADVISORIES] Fetching US State Department advisories...');
    const result = await fetchUsAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const usCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES] US: ${usCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES] US fetch failed: ${msg}`);
    errors.push(`US: ${msg}`);
  }

  // Fetch UK FCDO advisories
  try {
    console.log('[ADVISORIES] Fetching UK FCDO advisories...');
    const result = await fetchUkAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const ukCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES] UK: ${ukCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES] UK fetch failed: ${msg}`);
    errors.push(`UK: ${msg}`);
  }

  // Fetch Canada advisories
  try {
    console.log('[ADVISORIES] Fetching Canada travel advisories...');
    const result = await fetchCaAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const caCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES] CA: ${caCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES] CA fetch failed: ${msg}`);
    errors.push(`CA: ${msg}`);
  }

  // Fetch Australia advisories
  try {
    console.log('[ADVISORIES] Fetching Australia Smartraveller advisories...');
    const result = await fetchAuAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const auCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES] AU: ${auCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES] AU fetch failed: ${msg}`);
    errors.push(`AU: ${msg}`);
  }

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

  // Strip HTML tags and normalize whitespace for plain text parsing
  const plainText = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

  // Pattern: date DD/DD/YYYY followed by "Country Name Level N:"
  const countryLevelPattern =
    /(\d{2}\/\d{2}\/\d{4})\s+([A-Z][a-z]+(?:\s+(?:and\s+)?[A-Za-z'&\-]+)*?)\s+Level\s+(\d)/g;

  const seen = new Set<string>();
  let match;
  while ((match = countryLevelPattern.exec(plainText)) !== null) {
    const dateStr = match[1];
    const countryName = match[2].trim();
    const level = parseInt(match[3]);

    if (level < 1 || level > 4) continue;
    if (countryName.length < 3) continue;

    const country = getCountryByName(countryName);
    if (!country) continue;
    if (seen.has(country.iso3)) continue;
    seen.add(country.iso3);

    // Store RAW level (1-4). The normalizer handles the conversion.
    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_us',
      value: level,
      year: currentYear,
      source: 'advisories_us',
    });

    // Build AdvisoryInfo
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
  }

  return { indicators, advisoryInfo };
}

/**
 * Fetch UK FCDO travel advisories.
 * The GOV.UK API provides structured JSON data for travel advice.
 * Stores advisory levels as 1-4 integer scale matching US system.
 */
async function fetchUkAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

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

  // GOV.UK API returns a content item with links to country pages
  const links = (rawData as Record<string, unknown>)?.links as Record<string, unknown[]> | undefined;
  const children = links?.children || links?.related || [];

  if (!Array.isArray(children)) {
    console.warn('[ADVISORIES] UK: No children links found in response');
    return { indicators, advisoryInfo };
  }

  for (const child of children) {
    if (!child || typeof child !== 'object') continue;

    const childObj = child as Record<string, unknown>;
    const title = String(childObj.title || '').trim();
    if (!title) continue;

    // Strip " travel advice" suffix from title to get country name
    const countryName = title.replace(/\s*travel advice\s*$/i, '').trim();
    const country = getCountryByName(countryName);
    if (!country) continue;

    // UK FCDO uses text-based advisory levels in the description
    const description = String(childObj.description || '').toLowerCase();
    const basePath = String(childObj.base_path || '');

    // Map to 1-4 scale matching US system
    let level = 2; // Default: some caution (Exercise Increased Caution)
    let levelText = description;
    if (
      description.includes('advise against all travel') ||
      description.includes('do not travel')
    ) {
      level = 4; // Do Not Travel
    } else if (
      description.includes('advise against all but essential travel') ||
      description.includes('reconsider')
    ) {
      level = 3; // Reconsider Travel
    } else if (
      description.includes('no travel restrictions') ||
      description.includes('is generally safe') ||
      description.includes('normal precautions')
    ) {
      level = 1; // Normal Precautions
    }

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_uk',
      value: level,
      year: currentYear,
      source: 'advisories_uk',
    });

    // Build AdvisoryInfo
    const slug = basePath ? basePath.replace(/^\/foreign-travel-advice\//, '') : countryName.toLowerCase().replace(/\s+/g, '-');
    const updatedAt = String(childObj.public_updated_at || fetchedAt);

    if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
    advisoryInfo[country.iso3].uk = {
      level: String(childObj.description || '').trim() || `Level ${level}`,
      text: String(childObj.description || '').trim(),
      source: 'UK FCDO',
      url: `https://www.gov.uk/foreign-travel-advice/${slug}`,
      updatedAt,
    };
  }

  return { indicators, advisoryInfo };
}

/**
 * Fetch Canada Government travel advisories.
 * Parses HTML from travel.gc.ca/destinations to extract advisory levels.
 * Canada uses 4 levels matching the standard 1-4 scale.
 */
async function fetchCaAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

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

  // Parse: look for country links with advisory text
  // Pattern: country name followed by or associated with advisory level text
  // The page typically has rows with country name and advisory level
  const seen = new Set<string>();

  // Try to find patterns like: href="/destinations/countryslug" ... advisory text
  // Canada page uses a table/list with country names and advisory levels
  const countryBlockPattern = /href="\/destinations\/([^"]+)"[^>]*>([^<]+)<[\s\S]*?(?:Exercise normal security precautions|Exercise a high degree of caution|Avoid non-essential travel|Avoid all travel)/gi;

  let match;
  while ((match = countryBlockPattern.exec(html)) !== null) {
    const slug = match[1].trim();
    const countryName = match[2].trim();
    const blockText = match[0].toLowerCase();

    let level = 2;
    if (blockText.includes('avoid all travel')) {
      level = 4;
    } else if (blockText.includes('avoid non-essential travel')) {
      level = 3;
    } else if (blockText.includes('exercise a high degree of caution')) {
      level = 2;
    } else if (blockText.includes('exercise normal security precautions')) {
      level = 1;
    }

    const country = getCountryByName(countryName);
    if (!country) continue;
    if (seen.has(country.iso3)) continue;
    seen.add(country.iso3);

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_ca',
      value: level,
      year: currentYear,
      source: 'advisories_ca',
    });

    if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
    advisoryInfo[country.iso3].ca = {
      level,
      text: CA_LEVEL_TEXT[level] || `Level ${level}`,
      source: 'Government of Canada',
      url: `https://travel.gc.ca/destinations/${slug}`,
      updatedAt: fetchedAt,
    };
  }

  // Fallback: if regex didn't match, try simpler line-by-line approach
  if (indicators.length === 0) {
    console.warn('[ADVISORIES] CA: Primary pattern matched 0 countries, trying fallback parser...');

    // Strip tags, look for country names near advisory text
    const plainText = html.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ');

    for (const levelEntry of Object.entries(CA_LEVEL_TEXT)) {
      const [lvlStr, lvlText] = levelEntry;
      const lvl = parseInt(lvlStr);
      // Find country names near this text
      const escapedText = lvlText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nearPattern = new RegExp(`([A-Z][a-z]+(?:\\s+[A-Za-z]+){0,3})\\s*[-:]?\\s*${escapedText}`, 'gi');
      let m;
      while ((m = nearPattern.exec(plainText)) !== null) {
        const name = m[1].trim();
        const country = getCountryByName(name);
        if (!country || seen.has(country.iso3)) continue;
        seen.add(country.iso3);

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_ca',
          value: lvl,
          year: currentYear,
          source: 'advisories_ca',
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].ca = {
          level: lvl,
          text: lvlText,
          source: 'Government of Canada',
          url: `https://travel.gc.ca/destinations/${name.toLowerCase().replace(/\s+/g, '-')}`,
          updatedAt: fetchedAt,
        };
      }
    }

    if (indicators.length === 0) {
      console.warn('[ADVISORIES] CA: Fallback parser also matched 0 countries — page format may have changed');
    }
  }

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
