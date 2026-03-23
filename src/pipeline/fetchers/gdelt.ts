import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByIso3 } from '../config/countries.js';
import { FIPS_TO_ISO3 } from '../config/fips-to-iso3.js';
import Papa from 'papaparse';
import { join } from 'node:path';

/**
 * GDELT DOC 2.0 API — timelinetone mode returns average media tone over time.
 * We use `sourcecountry:{FIPS}` to get per-country tone data.
 *
 * SELF-RELATIVE NORMALIZATION (media bias containment):
 * Instead of mapping absolute tone to instability, we compute each country's
 * own 30-day baseline median and express current tone as a relative deviation.
 * This prevents English-language media bias from making heavily-covered countries
 * appear systematically more dangerous (GDELT over-represents Western media).
 *
 * instability = clamp(baselineTone - recentTone, 0, 1) / scale
 * Where: baseline = median tone over 30 days, recent = last 3 days average.
 * A country whose tone drops significantly below its own baseline = spike.
 *
 * Rate limit: 1 request per 5 seconds (conservative).
 * Fetches ALL countries with valid FIPS codes (~190).
 * At 10s/request this takes ~32 minutes. Pipeline timeout set to 45 min.
 * Priority countries fetched first (war zones + top destinations).
 */
const GDELT_BASE_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

/** Delay between requests in ms — 10s to avoid 429 rate limits */
const REQUEST_DELAY_MS = 10_000;

/** Scale factor for tone deviation → instability conversion */
const TONE_DEVIATION_SCALE = 5;

/**
 * Priority FIPS codes — most-traveled destinations + conflict-prone regions.
 * These are fetched first; remaining countries get GDELT data only if time allows.
 */
const PRIORITY_FIPS = new Set([
  'US', 'UK', 'FR', 'GM', 'IT', 'SP', 'TU', 'EG', 'MX', 'TH',
  'JA', 'IN', 'CH', 'BR', 'AU', 'CA', 'GR', 'PO', 'NL', 'SZ',
  'IS', 'SA', 'IZ', 'AF', 'SY', 'YM', 'SO', 'SU', 'NG', 'CO',
  'VE', 'PK', 'IR', 'RS', 'UP', 'BO', 'MO', 'KN', 'KS', 'CB',
  'RP', 'ID', 'MY', 'VM', 'BM', 'CE', 'ET', 'KE', 'SF', 'AG',
]);

/**
 * Compute instability from a country's tone time series.
 * Uses ABSOLUTE tone mapping (not self-relative) because self-relative
 * normalization makes chronic conflict zones (Ukraine, Syria) appear "stable"
 * since their bad tone is already their baseline.
 *
 * Tone ranges roughly -10 to +10:
 *  -5 or lower = very negative coverage (conflict/crisis) → instability 1.0
 *   0 = neutral coverage → instability 0.5
 *  +5 or higher = very positive coverage → instability 0.0
 *
 * Additionally applies a spike boost: if recent tone is significantly worse
 * than the 30-day baseline, add extra instability (capped at 1.0).
 */
function computeInstability(toneValues: number[]): number {
  if (toneValues.length === 0) return 0;

  // Recent average: last 3 data points (or all if fewer)
  const recentCount = Math.min(3, toneValues.length);
  const recentValues = toneValues.slice(-recentCount);
  const recentAvg = recentValues.reduce((s, v) => s + v, 0) / recentValues.length;

  // Absolute mapping: tone → instability
  // tone=-5 → 1.0, tone=0 → 0.5, tone=+5 → 0.0
  const absoluteInstability = Math.max(0, Math.min(1, (0 - recentAvg) / 10 + 0.5));

  // Spike boost: if we have enough data, compare recent vs baseline
  let spikeBoost = 0;
  if (toneValues.length >= 10) {
    const baselineValues = toneValues.slice(0, -recentCount);
    const baselineAvg = baselineValues.reduce((s, v) => s + v, 0) / baselineValues.length;
    const deviation = baselineAvg - recentAvg; // positive = tone dropped
    if (deviation > 0) {
      spikeBoost = Math.min(0.2, deviation / TONE_DEVIATION_SCALE); // max 0.2 boost
    }
  }

  return Math.min(1, absoluteInstability + spikeBoost);
}

/**
 * Fetch instability score for a single country from GDELT DOC v2 API.
 * Uses timelinetone mode with 30-day timespan for self-relative analysis.
 * Returns the self-relative instability score (0-1), or null on failure.
 */
async function fetchCountryInstability(
  fips: string,
): Promise<{ fips: string; value: number } | null> {
  try {
    const url = `${GDELT_BASE_URL}?query=sourcecountry:${fips}&mode=timelinetone&format=csv&TIMELINESMOOTH=3&TIMESPAN=30d`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      console.warn(`[GDELT] HTTP ${response.status} for FIPS=${fips}`);
      return null;
    }

    const text = await response.text();

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

    // Extract tone values from the 30-day time series
    const toneValues: number[] = [];
    for (const row of parsed.data) {
      const val = parseFloat(row['Value'] || '');
      if (!isNaN(val)) {
        toneValues.push(val);
      }
    }

    if (toneValues.length === 0) {
      return null;
    }

    // Absolute instability with spike boost
    const instability = computeInstability(toneValues);

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
    const allFipsCodes = Object.keys(FIPS_TO_ISO3).filter((fips) => {
      const iso3 = FIPS_TO_ISO3[fips];
      return iso3 && getCountryByIso3(iso3) !== undefined;
    });

    // Sort: priority countries first, then rest alphabetically. No limit.
    const fipsCodes = allFipsCodes
      .sort((a, b) => {
        const aPriority = PRIORITY_FIPS.has(a) ? 0 : 1;
        const bPriority = PRIORITY_FIPS.has(b) ? 0 : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.localeCompare(b);
      });

    console.log(`[GDELT] Fetching ${fipsCodes.length} priority countries (${REQUEST_DELAY_MS / 1000}s spacing)...`);

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

      // Rate-limit delay between requests
      if (fetched < fipsCodes.length) {
        await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
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
