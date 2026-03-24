import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName } from '../config/countries.js';
import { join } from 'node:path';

/**
 * UCDP GED API — Uppsala Conflict Data Program, Georeferenced Event Dataset.
 *
 * Free and open access, no authentication required.
 * Provides verified conflict event data including battles, violence against
 * civilians, and non-state conflicts with fatality estimates.
 *
 * API docs: https://ucdpapi.pcr.uu.se/api/gedevents/
 */
const UCDP_API_URL = 'https://ucdpapi.pcr.uu.se/api/gedevents/24.1';
const UCDP_UA = 'IsItSafeToTravel/3.0 (https://isitsafetotravel.org; data pipeline)';
const PAGE_SIZE = 1000;

interface UcdpEvent {
  id: number;
  country: string;
  best: number; // best estimate of fatalities
  type_of_violence: number; // 1=state-based, 2=non-state, 3=one-sided
  date_start: string;
  date_end: string;
}

interface UcdpResponse {
  TotalCount: number;
  NextPageUrl: string | null;
  Result: UcdpEvent[];
}

export async function fetchUcdp(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  try {
    console.log('[UCDP] Fetching conflict event data...');

    // Calculate date range: last 365 days
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 365);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch all pages
    const allEvents: UcdpEvent[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(UCDP_API_URL);
      url.searchParams.set('pagesize', String(PAGE_SIZE));
      url.searchParams.set('page', String(page));
      url.searchParams.set('StartDate', startStr);
      url.searchParams.set('EndDate', endStr);

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': UCDP_UA,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as UcdpResponse;
      allEvents.push(...data.Result);

      console.log(`[UCDP] Page ${page}: ${data.Result.length} events (total so far: ${allEvents.length}/${data.TotalCount})`);

      hasMore = data.NextPageUrl !== null && data.Result.length === PAGE_SIZE;
      page++;

      // Safety: cap at 50 pages to avoid infinite loops
      if (page >= 50) {
        console.warn('[UCDP] Reached max page limit (50), stopping pagination');
        break;
      }
    }

    // Write raw data
    writeJson(join(rawDir, 'ucdp.json'), { fetchedAt, events: allEvents });

    const indicators = parseUcdpData(allEvents, fetchedAt);
    const sourceData: RawSourceData = {
      source: 'ucdp',
      fetchedAt,
      indicators,
    };
    writeJson(join(rawDir, 'ucdp-parsed.json'), sourceData);

    const uniqueCountries = new Set(indicators.map((i) => i.countryIso3));
    console.log(
      `[UCDP] Successfully processed data for ${uniqueCountries.size} countries (${indicators.length} indicators from ${allEvents.length} events)`
    );

    return {
      source: 'ucdp',
      success: true,
      countriesFound: uniqueCountries.size,
      fetchedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[UCDP] Fetch failed: ${errorMessage}`);

    // Try fallback to cached data
    const cached = findLatestCached('ucdp-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[UCDP] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'ucdp-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'ucdp',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Original error: ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'ucdp',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }
}

function parseUcdpData(events: UcdpEvent[], fetchedAt: string): RawIndicator[] {
  const indicators: RawIndicator[] = [];
  const currentYear = new Date().getFullYear();

  // Aggregate by country: total events and total fatalities
  const countryStats = new Map<string, { events: number; fatalities: number }>();

  for (const event of events) {
    const countryName = event.country;
    if (!countryName) continue;

    const stats = countryStats.get(countryName) || { events: 0, fatalities: 0 };
    stats.events += 1;
    stats.fatalities += Number(event.best) || 0;
    countryStats.set(countryName, stats);
  }

  // Convert to indicators with ISO3 codes
  for (const [countryName, stats] of countryStats) {
    const country = getCountryByName(countryName);
    if (!country) continue;

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'ucdp_events',
      value: stats.events,
      year: currentYear,
      source: 'ucdp',
    });

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'ucdp_fatalities',
      value: stats.fatalities,
      year: currentYear,
      source: 'ucdp',
    });
  }

  return indicators;
}
