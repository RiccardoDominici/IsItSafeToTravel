import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName } from '../config/countries.js';
import { join } from 'node:path';

/**
 * ACLED API — Armed Conflict Location & Event Data.
 *
 * Authentication: OAuth token via username/password (changed Sept 2025).
 * Env vars: ACLED_EMAIL + ACLED_PASSWORD
 *
 * The token endpoint returns a 24h access_token + 14d refresh_token.
 * We request a fresh token each pipeline run (runs daily, so 24h is fine).
 */
const ACLED_TOKEN_URL = 'https://acleddata.com/oauth/token';
const ACLED_API_URL = 'https://acleddata.com/api/acled/read';

/**
 * Get an OAuth access token from ACLED using email/password.
 */
async function getAcledToken(email: string, password: string): Promise<string> {
  const response = await fetch(ACLED_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: email,
      password: password,
      grant_type: 'password',
      client_id: 'acled',
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`ACLED OAuth failed: HTTP ${response.status} — ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('ACLED OAuth response missing access_token');
  }

  return data.access_token;
}

export async function fetchAcled(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  // Check for required credentials (new OAuth system)
  const email = process.env.ACLED_EMAIL;
  const password = process.env.ACLED_PASSWORD;
  // Legacy support: also check old API key env var
  const apiKey = process.env.ACLED_API_KEY;

  if (!email || (!password && !apiKey)) {
    const errorMessage =
      'ACLED credentials not configured. Set ACLED_EMAIL and ACLED_PASSWORD environment variables.';
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

    let response: Response;

    if (password) {
      // New OAuth flow (Sept 2025+)
      console.log('[ACLED] Authenticating via OAuth token...');
      const token = await getAcledToken(email, password);

      const url = new URL(ACLED_API_URL);
      url.searchParams.set('event_date', `${startStr}|${endStr}`);
      url.searchParams.set('event_date_where', 'BETWEEN');
      url.searchParams.set('fields', 'country|event_type|fatalities');
      url.searchParams.set('limit', '0');

      response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(60_000),
      });
    } else {
      // Legacy API key flow (pre-Sept 2025)
      console.log('[ACLED] Using legacy API key authentication...');
      const url = new URL('https://api.acleddata.com/acled/read');
      url.searchParams.set('key', apiKey!);
      url.searchParams.set('email', email);
      url.searchParams.set('event_date', `${startStr}|${endStr}`);
      url.searchParams.set('event_date_where', 'BETWEEN');
      url.searchParams.set('fields', 'country|event_type|fatalities');
      url.searchParams.set('limit', '0');

      response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(60_000),
      });
    }

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
