import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName } from '../config/countries.js';
import { join } from 'node:path';

const ACLED_API_URL = 'https://api.acleddata.com/acled/read';

export async function fetchAcled(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  // Check for required credentials
  const apiKey = process.env.ACLED_API_KEY;
  const email = process.env.ACLED_EMAIL;

  if (!apiKey || !email) {
    const errorMessage =
      'ACLED credentials not configured. Set ACLED_API_KEY and ACLED_EMAIL environment variables.';
    console.warn(`[ACLED] ${errorMessage}`);

    // Try fallback to cached data
    const cached = findLatestCached('acled-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[ACLED] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'acled-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'acled',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'acled',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }

  try {
    console.log('[ACLED] Fetching conflict event data...');

    // Calculate date range: last 30 days
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const url = new URL(ACLED_API_URL);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('email', email);
    url.searchParams.set('event_date', `${startStr}|${endStr}`);
    url.searchParams.set('event_date_where', 'BETWEEN');
    url.searchParams.set('fields', 'country|event_type|fatalities');
    url.searchParams.set('limit', '0'); // No limit — get all events

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();
    writeJson(join(rawDir, 'acled.json'), rawData);

    const indicators = parseAcledData(rawData, fetchedAt);
    const sourceData: RawSourceData = {
      source: 'acled',
      fetchedAt,
      indicators,
    };
    writeJson(join(rawDir, 'acled-parsed.json'), sourceData);

    const uniqueCountries = new Set(indicators.map((i) => i.countryIso3));
    console.log(
      `[ACLED] Successfully processed data for ${uniqueCountries.size} countries (${indicators.length} indicators)`
    );

    return {
      source: 'acled',
      success: true,
      countriesFound: uniqueCountries.size,
      fetchedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[ACLED] Fetch failed: ${errorMessage}`);

    // Try fallback to cached data
    const cached = findLatestCached('acled-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[ACLED] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'acled-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'acled',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Original error: ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'acled',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }
}

interface AcledEvent {
  country: string;
  event_type: string;
  fatalities: string | number;
}

function parseAcledData(rawData: unknown, fetchedAt: string): RawIndicator[] {
  const indicators: RawIndicator[] = [];
  const currentYear = new Date().getFullYear();

  // ACLED API returns { success: true, data: [...] }
  const data = (rawData as Record<string, unknown>)?.data;
  if (!Array.isArray(data)) {
    console.warn('[ACLED] Unexpected data format: missing data array');
    return indicators;
  }

  // Aggregate by country: total events and total fatalities
  const countryStats = new Map<string, { events: number; fatalities: number }>();

  for (const event of data as AcledEvent[]) {
    const countryName = event.country;
    if (!countryName) continue;

    const stats = countryStats.get(countryName) || { events: 0, fatalities: 0 };
    stats.events += 1;
    stats.fatalities += Number(event.fatalities) || 0;
    countryStats.set(countryName, stats);
  }

  // Convert to indicators with ISO3 codes
  for (const [countryName, stats] of countryStats) {
    const country = getCountryByName(countryName);
    if (!country) continue;

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'acled_events',
      value: stats.events,
      year: currentYear,
      source: 'acled',
    });

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'acled_fatalities',
      value: stats.fatalities,
      year: currentYear,
      source: 'acled',
    });
  }

  return indicators;
}
