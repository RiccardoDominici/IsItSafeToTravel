import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso3 } from '../config/countries.js';
import { join } from 'node:path';

const GDACS_API_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH';

export async function fetchGdacs(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  try {
    console.log('[GDACS] Fetching disaster alerts (orange/red)...');

    const url = new URL(GDACS_API_URL);
    url.searchParams.set('alertlevel', 'Red;Orange');
    url.searchParams.set('eventlist', 'EQ;TC;FL;VO');
    url.searchParams.set('country', '');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // GDACS may return XML instead of JSON in some cases
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      console.warn(`[GDACS] Response content-type is not JSON: ${contentType}`);
      throw new Error(`Unexpected content-type: ${contentType}`);
    }

    const rawData = await response.json();
    writeJson(join(rawDir, 'gdacs.json'), rawData);

    const indicators = parseGdacsData(rawData, fetchedAt);
    const sourceData: RawSourceData = {
      source: 'gdacs',
      fetchedAt,
      indicators,
    };
    writeJson(join(rawDir, 'gdacs-parsed.json'), sourceData);

    const uniqueCountries = new Set(indicators.map((i) => i.countryIso3));
    console.log(
      `[GDACS] Successfully processed data for ${uniqueCountries.size} countries (${indicators.length} indicators)`
    );

    return {
      source: 'gdacs',
      success: true,
      countriesFound: uniqueCountries.size,
      fetchedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[GDACS] Fetch failed: ${errorMessage}`);

    // Try fallback to cached data
    const cached = findLatestCached('gdacs-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[GDACS] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'gdacs-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'gdacs',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Original error: ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'gdacs',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }
}

interface GdacsFeature {
  properties: {
    alertlevel?: string;
    eventtype?: string;
    country?: string;
    iso3?: string;
    fromdate?: string;
    todate?: string;
  };
}

function parseGdacsData(rawData: unknown, fetchedAt: string): RawIndicator[] {
  const indicators: RawIndicator[] = [];
  const currentYear = new Date().getFullYear();

  const features = (rawData as Record<string, unknown>)?.features;
  if (!Array.isArray(features)) {
    // Empty features array is valid (no active alerts)
    console.log('[GDACS] No active disaster features found');
    return indicators;
  }

  // Count qualifying alerts per country ISO3
  const countryAlerts = new Map<string, number>();

  for (const feature of features as GdacsFeature[]) {
    const props = feature.properties;
    if (!props) continue;

    // Only count Orange or Red alerts (case-insensitive)
    const alertLevel = (props.alertlevel || '').toLowerCase();
    if (alertLevel !== 'red' && alertLevel !== 'orange') continue;

    // Resolve ISO3: try iso3 field first, then country name lookup
    let iso3 = props.iso3?.toUpperCase();
    if (!iso3 || iso3.length !== 3) {
      if (props.country) {
        const resolved = getCountryByName(props.country);
        if (resolved) {
          iso3 = resolved.iso3;
        }
      }
    } else {
      // Validate the ISO3 code exists in our country list
      const validated = getCountryByIso3(iso3);
      if (!validated) {
        iso3 = undefined;
      }
    }

    if (!iso3) continue;

    countryAlerts.set(iso3, (countryAlerts.get(iso3) || 0) + 1);
  }

  // Convert to indicators
  for (const [iso3, count] of countryAlerts) {
    indicators.push({
      countryIso3: iso3,
      indicatorName: 'gdacs_disaster_alerts',
      value: count,
      year: currentYear,
      source: 'gdacs',
      fetchedAt,
    });
  }

  return indicators;
}
