import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByIso3 } from '../config/countries.js';
import { join } from 'node:path';

const WB_BASE_URL = 'https://api.worldbank.org/v2/country/all/indicator';

/**
 * World Bank indicators to fetch.
 * These replace the defunct INFORM and GPI APIs with reliable, free data.
 *
 * WGI indicators range from -2.5 to 2.5 (higher = better).
 * Health/environment indicators are raw values (lower = better, handled by normalizer).
 */
const INDICATORS: Array<{ wbCode: string; name: string; description: string }> = [
  { wbCode: 'PV.EST', name: 'wb_political_stability', description: 'Political Stability & Absence of Violence' },
  { wbCode: 'RL.EST', name: 'wb_rule_of_law', description: 'Rule of Law' },
  { wbCode: 'GE.EST', name: 'wb_gov_effectiveness', description: 'Government Effectiveness' },
  { wbCode: 'CC.EST', name: 'wb_corruption_control', description: 'Control of Corruption' },
  { wbCode: 'SH.DYN.MORT', name: 'wb_child_mortality', description: 'Under-5 Mortality Rate (per 1,000)' },
  { wbCode: 'EN.ATM.PM25.MC.M3', name: 'wb_air_pollution', description: 'PM2.5 Air Pollution (µg/m³)' },
];

async function fetchIndicator(
  wbCode: string,
  indicatorName: string,
  year: number,
): Promise<RawIndicator[]> {
  // mrnev=1 gets most recent non-empty value for each country
  const url = `${WB_BASE_URL}/${wbCode}?format=json&per_page=300&mrnev=1`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`${wbCode}: HTTP ${response.status}`);
  }

  const json = await response.json();

  // World Bank API returns [metadata, data] array
  if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
    console.warn(`[WORLDBANK] ${wbCode}: unexpected response format`);
    return [];
  }

  const entries = json[1] as Array<Record<string, unknown>>;
  const indicators: RawIndicator[] = [];

  for (const entry of entries) {
    const iso3 = String(entry.countryiso3code || '').toUpperCase();
    const value = entry.value;

    if (!iso3 || value === null || value === undefined) continue;
    if (!getCountryByIso3(iso3)) continue;

    const numValue = Number(value);
    if (isNaN(numValue)) continue;

    indicators.push({
      countryIso3: iso3,
      indicatorName,
      value: numValue,
      year: Number(entry.date) || year,
      source: 'worldbank',
    });
  }

  return indicators;
}

export async function fetchWorldBank(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const currentYear = new Date().getFullYear();

  try {
    console.log('[WORLDBANK] Fetching World Bank indicators...');
    const allIndicators: RawIndicator[] = [];
    const errors: string[] = [];

    // Fetch all indicators in parallel
    const results = await Promise.allSettled(
      INDICATORS.map((ind) => fetchIndicator(ind.wbCode, ind.name, currentYear)),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const ind = INDICATORS[i];
      if (result.status === 'fulfilled') {
        const count = result.value.length;
        console.log(`  ${ind.wbCode} (${ind.name}): ${count} countries`);
        allIndicators.push(...result.value);
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.warn(`  ${ind.wbCode}: FAILED — ${msg}`);
        errors.push(`${ind.wbCode}: ${msg}`);
      }
    }

    if (allIndicators.length === 0) {
      throw new Error(`All indicators failed: ${errors.join('; ')}`);
    }

    // Save raw and parsed data
    const sourceData: RawSourceData = {
      source: 'worldbank',
      fetchedAt,
      indicators: allIndicators,
    };
    writeJson(join(rawDir, 'worldbank-parsed.json'), sourceData);

    const uniqueCountries = new Set(allIndicators.map((i) => i.countryIso3));
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    console.log(
      `[WORLDBANK] ${successCount}/${INDICATORS.length} indicators fetched, ${uniqueCountries.size} countries, ${allIndicators.length} data points`,
    );

    return {
      source: 'worldbank',
      success: true,
      countriesFound: uniqueCountries.size,
      error: errors.length > 0 ? `Partial: ${errors.join('; ')}` : undefined,
      fetchedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[WORLDBANK] Fetch failed: ${errorMessage}`);

    const cached = findLatestCached('worldbank-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[WORLDBANK] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'worldbank-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'worldbank',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Original error: ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'worldbank',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }
}
