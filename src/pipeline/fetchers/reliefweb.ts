import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { join } from 'node:path';

const RELIEFWEB_API_URL = 'https://api.reliefweb.int/v2/disasters';

export async function fetchReliefweb(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  try {
    console.log('[RELIEFWEB] Fetching active disaster data...');

    const appname = process.env.RELIEFWEB_APPNAME || 'isitsafetotravel.com';

    const url = `${RELIEFWEB_API_URL}?appname=${encodeURIComponent(appname)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { field: 'status', value: 'current' },
        fields: { include: ['country', 'type', 'status', 'glide'] },
        limit: 1000,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();
    writeJson(join(rawDir, 'reliefweb.json'), rawData);

    const indicators = parseReliefwebData(rawData, fetchedAt);
    const sourceData: RawSourceData = {
      source: 'reliefweb',
      fetchedAt,
      indicators,
    };
    writeJson(join(rawDir, 'reliefweb-parsed.json'), sourceData);

    const uniqueCountries = new Set(indicators.map((i) => i.countryIso3));
    console.log(
      `[RELIEFWEB] Successfully processed data for ${uniqueCountries.size} countries (${indicators.length} indicators)`
    );

    return {
      source: 'reliefweb',
      success: true,
      countriesFound: uniqueCountries.size,
      fetchedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[RELIEFWEB] Fetch failed: ${errorMessage}`);

    // Try fallback to cached data
    const cached = findLatestCached('reliefweb-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[RELIEFWEB] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'reliefweb-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'reliefweb',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Original error: ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'reliefweb',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }
}

interface ReliefwebDisaster {
  id: number;
  fields: {
    country?: Array<{ iso3: string; name: string }>;
    type?: Array<{ name: string }>;
    status?: string;
    glide?: string;
  };
}

function parseReliefwebData(rawData: unknown, fetchedAt: string): RawIndicator[] {
  const indicators: RawIndicator[] = [];
  const currentYear = new Date().getFullYear();

  const data = (rawData as Record<string, unknown>)?.data;
  if (!Array.isArray(data)) {
    console.warn('[RELIEFWEB] Unexpected data format: missing data array');
    return indicators;
  }

  // Count active disasters per country ISO3
  const countryDisasters = new Map<string, number>();

  for (const disaster of data as ReliefwebDisaster[]) {
    const countries = disaster.fields?.country;
    if (!Array.isArray(countries)) continue;

    for (const country of countries) {
      const iso3 = country.iso3?.toUpperCase();
      if (!iso3 || iso3.length !== 3) continue;
      countryDisasters.set(iso3, (countryDisasters.get(iso3) || 0) + 1);
    }
  }

  // Convert to indicators
  for (const [iso3, count] of countryDisasters) {
    indicators.push({
      countryIso3: iso3,
      indicatorName: 'reliefweb_active_disasters',
      value: count,
      year: currentYear,
      source: 'reliefweb',
    });
  }

  return indicators;
}
