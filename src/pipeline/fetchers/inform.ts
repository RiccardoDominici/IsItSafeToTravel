import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByIso3 } from '../config/countries.js';
import { join } from 'node:path';

const INFORM_API_URL =
  'https://drmkc.jrc.ec.europa.eu/inform-index/API/InformAPI/countries/Scores';

/**
 * Map INFORM indicator IDs to our pipeline indicator names.
 * INFORM uses hierarchical IDs like "HA.NAT", "HH.HEA", etc.
 */
const INDICATOR_MAP: Record<string, string> = {
  'HA.NAT': 'inform_natural',
  'HH.HEA': 'inform_health',
  'HH.HEA.EPI': 'inform_epidemic',
  'VU.SEV.GOV': 'inform_governance',
  'HA.NAT.FL': 'inform_climate', // Flood risk as climate proxy
  'CC.INF': 'inform_climate', // Alternative: coping capacity infrastructure
};

// Broader mapping to try if specific indicators are not found
const FALLBACK_INDICATOR_MAP: Record<string, string> = {
  'HA.NAT': 'inform_natural',
  'HH': 'inform_health',
  'VU': 'inform_governance',
  'HA.NAT': 'inform_climate',
};

export async function fetchInform(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  try {
    console.log('[INFORM] Fetching data from INFORM Risk Index API...');
    const response = await fetch(INFORM_API_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();
    writeJson(join(rawDir, 'inform.json'), rawData);

    const indicators = parseInformData(rawData, fetchedAt);
    const sourceData: RawSourceData = {
      source: 'inform',
      fetchedAt,
      indicators,
    };
    writeJson(join(rawDir, 'inform-parsed.json'), sourceData);

    const uniqueCountries = new Set(indicators.map((i) => i.countryIso3));
    console.log(
      `[INFORM] Successfully fetched data for ${uniqueCountries.size} countries (${indicators.length} indicators)`
    );

    return {
      source: 'inform',
      success: true,
      countriesFound: uniqueCountries.size,
      fetchedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[INFORM] Fetch failed: ${errorMessage}`);

    // Try fallback to cached data
    const cached = findLatestCached('inform-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[INFORM] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'inform-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'inform',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Original error: ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'inform',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }
}

function parseInformData(rawData: unknown, fetchedAt: string): RawIndicator[] {
  const indicators: RawIndicator[] = [];
  const currentYear = new Date().getFullYear();

  // INFORM API returns an array of country score objects
  // Each object has Iso3, IndicatorId, IndicatorScore, etc.
  if (!Array.isArray(rawData)) {
    console.warn('[INFORM] Unexpected data format: not an array');
    return indicators;
  }

  for (const entry of rawData) {
    if (!entry || typeof entry !== 'object') continue;

    const iso3 = entry.Iso3 || entry.iso3 || entry.ISO3;
    const indicatorId = entry.IndicatorId || entry.indicatorId;
    const score = parseFloat(entry.IndicatorScore || entry.indicatorScore || entry.Score || '0');

    if (!iso3 || !indicatorId || isNaN(score)) continue;

    // Check if this is an indicator we care about
    const mappedName = INDICATOR_MAP[indicatorId] || FALLBACK_INDICATOR_MAP[indicatorId];
    if (!mappedName) continue;

    // Verify we know this country
    if (!getCountryByIso3(iso3)) continue;

    indicators.push({
      countryIso3: iso3.toUpperCase(),
      indicatorName: mappedName,
      value: score,
      year: currentYear,
      source: 'inform',
    });
  }

  return indicators;
}
