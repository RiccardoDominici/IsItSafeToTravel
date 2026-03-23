import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByIso3 } from '../config/countries.js';
import { FIPS_TO_ISO3 } from '../config/fips-to-iso3.js';
import Papa from 'papaparse';
import { join } from 'node:path';

/**
 * GDELT DOC 2.0 API — timelinetone mode returns average media tone over time.
 * We use `sourcecountry:{FIPS}` to get per-country tone data.
 * Tone ranges roughly -10 to +10 (negative = negative sentiment = instability proxy).
 * We convert to an instability score 0-1 via: instability = clamp((0 - avgTone) / 10 + 0.5, 0, 1)
 * This maps tone=0 to 0.5, tone=-5 to 1.0, tone=+5 to 0.0.
 *
 * Rate limit: 1 request per 5 seconds (documented).
 * Smoothing: TIMELINESMOOTH=3 for 3-point rolling average to reduce noise.
 */
const GDELT_BASE_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

/**
 * Convert GDELT average tone (-10 to +10) to instability score (0 to 1).
 * More negative tone = higher instability.
 */
function toneToInstability(tone: number): number {
  // Map: tone=-5 -> 1.0 (max instability), tone=0 -> 0.5, tone=+5 -> 0.0
  const instability = (0 - tone) / 10 + 0.5;
  return Math.max(0, Math.min(1, instability));
}

/**
 * Fetch instability score for a single country from GDELT DOC v2 API.
 * Uses timelinetone mode with sourcecountry filter.
 * Returns the average tone of the last 24h converted to instability (0-1), or null on failure.
 */
async function fetchCountryInstability(
  fips: string,
): Promise<{ fips: string; value: number } | null> {
  try {
    const url = `${GDELT_BASE_URL}?query=sourcecountry:${fips}&mode=timelinetone&format=csv&TIMELINESMOOTH=3&TIMESPAN=7d`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(`[GDELT] HTTP ${response.status} for FIPS=${fips}`);
      return null;
    }

    const text = await response.text();

    // Check for rate-limit or error text responses
    if (text.includes('Please limit requests') || text.includes('Invalid mode')) {
      console.warn(`[GDELT] Rate limited or invalid response for FIPS=${fips}`);
      return null;
    }

    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (!parsed.data || parsed.data.length === 0) {
      return null;
    }

    // Take the last 24 rows (last 24 hours of hourly data) and average their tone
    // If fewer rows available, use all of them
    const recentRows = parsed.data.slice(-24);
    const toneValues: number[] = [];

    for (const row of recentRows) {
      const val = parseFloat(row['Value'] || '');
      if (!isNaN(val)) {
        toneValues.push(val);
      }
    }

    if (toneValues.length === 0) {
      return null;
    }

    const avgTone = toneValues.reduce((sum, v) => sum + v, 0) / toneValues.length;
    const instability = toneToInstability(avgTone);

    return { fips, value: instability };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[GDELT] Failed for FIPS=${fips}: ${msg}`);
    return null;
  }
}

/**
 * Fetch GDELT media tone data for all countries with FIPS codes.
 * Fetches sequentially with 5s delay to respect documented rate limits.
 * Falls back to cached data on total failure.
 */
export async function fetchGdelt(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const currentYear = new Date().getFullYear();

  try {
    console.log('[GDELT] Fetching instability scores from DOC v2 API (timelinetone mode)...');

    // Filter FIPS codes to only those whose ISO3 maps to a valid country in our list
    const fipsCodes = Object.keys(FIPS_TO_ISO3).filter((fips) => {
      const iso3 = FIPS_TO_ISO3[fips];
      return iso3 && getCountryByIso3(iso3) !== undefined;
    });

    console.log(`[GDELT] Fetching ${fipsCodes.length} countries sequentially (5s spacing)...`);

    const results = new Map<string, number>();
    let fetched = 0;

    for (const fips of fipsCodes) {
      const result = await fetchCountryInstability(fips);
      fetched++;

      if (result) {
        const iso3 = FIPS_TO_ISO3[fips];
        // If multiple FIPS map to the same ISO3 (e.g. Gaza + West Bank -> PSE),
        // keep the higher instability value (worst case)
        const existing = results.get(iso3);
        if (existing === undefined || result.value > existing) {
          results.set(iso3, result.value);
        }
      }

      if (fetched % 25 === 0) {
        console.log(`[GDELT] Progress: ${fetched}/${fipsCodes.length} countries fetched...`);
      }

      // Rate-limit: 5s delay between requests (GDELT documented limit)
      if (fetched < fipsCodes.length) {
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }

    console.log(
      `[GDELT] Completed: ${results.size} countries with instability data out of ${fipsCodes.length} attempted`,
    );

    // Write raw results
    writeJson(join(rawDir, 'gdelt-raw.json'), {
      fetchedAt,
      results: Object.fromEntries(results),
    });

    // Convert to RawIndicator array
    const indicators: RawIndicator[] = [];
    for (const [iso3, value] of results) {
      indicators.push({
        countryIso3: iso3,
        indicatorName: 'gdelt_instability',
        value,
        year: currentYear,
        source: 'gdelt',
      });
    }

    // Write parsed output
    const sourceData: RawSourceData = {
      source: 'gdelt',
      fetchedAt,
      indicators,
    };
    writeJson(join(rawDir, 'gdelt-parsed.json'), sourceData);

    return {
      source: 'gdelt',
      success: true,
      countriesFound: results.size,
      fetchedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[GDELT] Fetch failed: ${errorMessage}`);

    // Try fallback to cached data
    const cached = findLatestCached('gdelt-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[GDELT] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'gdelt-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'gdelt',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Original error: ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'gdelt',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }
}
