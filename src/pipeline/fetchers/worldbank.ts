import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByIso3 } from '../config/countries.js';
import { join } from 'node:path';

const WB_BASE_URL = 'https://api.worldbank.org/v2/country/all/indicator';

/**
 * World Bank indicators to fetch.
 *
 * As of v8.1.0, the four retired Worldwide Governance Indicators (PV.EST, RL.EST,
 * GE.EST, CC.EST) are replaced by V-Dem v16 indicators — see src/pipeline/fetchers/vdem.ts.
 *
 * v9.1 (SHIP-SPEC 1.1a): every query below now appends `mrnev=1` ("most recent
 * non-empty value") instead of a fixed 3-year date window. This is REQUIRED —
 * verified live: without it, VC.IHR.PSRC.P5 (homicide) returns 0 rows for the
 * project's countries (most recent homicide data is 1-3 years old and frequently
 * falls outside a narrow window), and EN.ATM.PM25.MC.M3 (air pollution, latest
 * vintage 2023) was SILENTLY EMPTY in production because the pipeline always
 * requested a window ending at the CURRENT year. mrnev=1 fixes both by asking
 * the API to find each country's own most recent non-null observation, whatever
 * year that happens to be.
 *
 * wb_homicide (VC.IHR.PSRC.P5) is new in v9.1 (crime pillar, D1). wb_population
 * (SP.POP.TOTL) is also new in v9.1 but is an INTERNAL engine input, NOT a scored
 * indicator (F1 population-scaled homicide precision) — it is persisted here as
 * an ordinary RawIndicator named `wb_population`, but normalize.ts intentionally
 * has NO range entry for it, so normalizeIndicators() silently skips it and it
 * never enters any pillar.
 */
const INDICATORS: Array<{ wbCode: string; name: string; description: string }> = [
  { wbCode: 'SH.DYN.MORT', name: 'wb_child_mortality', description: 'Under-5 Mortality Rate (per 1,000)' },
  { wbCode: 'EN.ATM.PM25.MC.M3', name: 'wb_air_pollution', description: 'PM2.5 Air Pollution (µg/m³)' },
  { wbCode: 'VC.IHR.PSRC.P5', name: 'wb_homicide', description: 'Intentional Homicides (per 100,000 people)' },
  { wbCode: 'SP.POP.TOTL', name: 'wb_population', description: 'Total Population (internal engine input, not scored)' },
];

async function fetchIndicator(
  wbCode: string,
  indicatorName: string,
): Promise<RawIndicator[]> {
  // mrnev=1 ("most recent non-empty value"): the WB API itself finds each
  // country's own latest non-null observation, whatever year that is — no
  // date window needed (verified live: this matches a bare `mrnev=1` query
  // with no `date=` param, one row per country).
  const url = `${WB_BASE_URL}/${wbCode}?format=json&per_page=500&mrnev=1`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
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

  // Group by country, keep only the most recent year with data (defensive —
  // mrnev=1 should already return a single row per country, but a duplicate
  // is handled gracefully rather than silently double-counted).
  const byCountry = new Map<string, { value: number; year: number }>();

  for (const entry of entries) {
    const iso3 = String(entry.countryiso3code || '').toUpperCase();
    const value = entry.value;
    const entryYear = Number(entry.date);

    if (!iso3 || value === null || value === undefined || !Number.isFinite(entryYear)) continue;
    if (!getCountryByIso3(iso3)) continue;

    const numValue = Number(value);
    if (isNaN(numValue)) continue;

    const existing = byCountry.get(iso3);
    if (!existing || entryYear > existing.year) {
      byCountry.set(iso3, { value: numValue, year: entryYear });
    }
  }

  const indicators: RawIndicator[] = [];
  for (const [iso3, data] of byCountry) {
    indicators.push({
      countryIso3: iso3,
      indicatorName,
      value: data.value,
      year: data.year,
      source: 'worldbank',
      // v9.1 (SHIP-SPEC 1.1a) freshness-honesty fix: stamp each indicator with
      // its OWN vintage year instead of leaving dataDate unset. NOTE: 'worldbank'
      // is intentionally NOT present in source-tiers.json (see that file's
      // comment) so this dataDate does NOT feed freshness decay — the frozen
      // v9.1 parity fixture assumes fw=1.0 for baseline sources, and flipping
      // decay on here would move scores across ~199 countries relative to it.
      // dataDate is persisted regardless, for citability/documentation.
      dataDate: `${data.year}-01-01T00:00:00.000Z`,
    });
  }

  return indicators;
}

export async function fetchWorldBank(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  try {
    console.log(`[WORLDBANK] Fetching World Bank indicators (mrnev=1, most-recent-non-empty)...`);
    const allIndicators: RawIndicator[] = [];
    const errors: string[] = [];

    // Fetch all indicators in parallel
    const results = await Promise.allSettled(
      INDICATORS.map((ind) => fetchIndicator(ind.wbCode, ind.name)),
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

    // Partial failure: merge cached data for failed indicators
    const succeededNames = new Set(allIndicators.map((ind) => ind.indicatorName));
    const failedIndicators = INDICATORS.filter((ind) => !succeededNames.has(ind.name));

    if (failedIndicators.length > 0 && allIndicators.length > 0) {
      const cached = findLatestCached('worldbank-parsed.json');
      if (cached) {
        const cachedData = readJson<RawSourceData>(cached);
        if (cachedData) {
          const failedNames = new Set(failedIndicators.map((ind) => ind.name));
          const cachedFill = cachedData.indicators.filter((ind) => failedNames.has(ind.indicatorName));
          if (cachedFill.length > 0) {
            allIndicators.push(...cachedFill);
            console.log(`[WORLDBANK] Merged cached data for failed indicators: ${[...failedNames].join(', ')} (${cachedFill.length} data points)`);
          }
        }
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
