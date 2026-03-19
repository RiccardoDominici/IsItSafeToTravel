import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso2, COUNTRIES } from '../config/countries.js';
import { join } from 'node:path';

const US_ADVISORIES_URL =
  'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html';
const UK_FCDO_API_URL = 'https://www.gov.uk/api/content/foreign-travel-advice';

export async function fetchAdvisories(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const currentYear = new Date().getFullYear();

  const allIndicators: RawIndicator[] = [];
  const errors: string[] = [];
  let totalCountries = 0;

  // Fetch US advisories
  try {
    console.log('[ADVISORIES] Fetching US State Department advisories...');
    const usIndicators = await fetchUsAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...usIndicators);
    const usCountries = new Set(usIndicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES] US: ${usCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES] US fetch failed: ${msg}`);
    errors.push(`US: ${msg}`);
  }

  // Fetch UK FCDO advisories
  try {
    console.log('[ADVISORIES] Fetching UK FCDO advisories...');
    const ukIndicators = await fetchUkAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...ukIndicators);
    const ukCountries = new Set(ukIndicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES] UK: ${ukCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES] UK fetch failed: ${msg}`);
    errors.push(`UK: ${msg}`);
  }

  // If both failed, try cached data
  if (allIndicators.length === 0) {
    const cached = findLatestCached('advisories-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[ADVISORIES] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'advisories-parsed.json'), cachedData);
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

/**
 * Fetch US State Department travel advisories.
 * Parses HTML to extract country advisory levels (1-4).
 * Stores RAW level values (1-4) — normalization is handled by the scoring engine.
 */
async function fetchUsAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<RawIndicator[]> {
  const indicators: RawIndicator[] = [];

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
  // The page lists entries in a table with date then country then level
  const countryLevelPattern =
    /\d{2}\/\d{2}\/\d{4}\s+([A-Z][a-z]+(?:\s+(?:and\s+)?[A-Za-z'&\-]+)*?)\s+Level\s+(\d)/g;

  const seen = new Set<string>();
  let match;
  while ((match = countryLevelPattern.exec(plainText)) !== null) {
    const countryName = match[1].trim();
    const level = parseInt(match[2]);

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
  }

  return indicators;
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
): Promise<RawIndicator[]> {
  const indicators: RawIndicator[] = [];

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
    return indicators;
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

    // Map to 1-4 scale matching US system
    let level = 2; // Default: some caution (Exercise Increased Caution)
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
  }

  return indicators;
}
