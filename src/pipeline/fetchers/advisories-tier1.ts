import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso3, COUNTRIES } from '../config/countries.js';
import {
  normalizeDeLevel,
  normalizeNlColor,
  normalizeJpLevel,
  normalizeSkLevel,
} from '../normalize/advisory-levels.js';
import { join } from 'node:path';

// --- API URLs ---
const DE_API_URL = 'https://www.auswaertiges-amt.de/opendata/travelwarning';
const NL_API_BASE =
  'https://opendata.nederlandwereldwijd.nl/v2/sources/nederlandwereldwijd/infotypes/countries';
const JP_MOFA_BASE = 'https://www.anzen.mofa.go.jp';
const SK_API_URL =
  'https://opendata.mzv.sk/api/3/action/datastore_search?resource_id=d2b4a3bf-2606-4b28-a51a-277b0708c076&limit=500';

// --- Level text maps ---
const DE_LEVEL_TEXT: Record<number, string> = {
  1: 'Keine Reisewarnung',
  2: 'Sicherheitshinweis',
  3: 'Teilreisewarnung',
  4: 'Reisewarnung',
};

const NL_LEVEL_TEXT: Record<number, string> = {
  1: 'Veilig',
  2: 'Let op, veiligheidsrisicos',
  3: 'Alleen noodzakelijke reizen',
  4: 'Niet reizen',
};

const JP_LEVEL_TEXT: Record<number, string> = {
  1: 'Exercise caution',
  2: 'Avoid non-essential travel',
  3: 'Do not travel (advisory)',
  4: 'Evacuate (advisory)',
};

const SK_LEVEL_TEXT: Record<number, string> = {
  1: 'No specific warning',
  2: 'Consider necessity of travel',
  3: 'Avoid travel',
  4: 'Do not travel',
};

// --- Japan MOFA country page ID -> ISO3 mapping ---
const JP_MOFA_ID_TO_ISO3: Record<string, string> = {
  '001': 'KOR',
  '002': 'CHN',
  '003': 'TWN',
  '004': 'MNG',
  '005': 'PHL',
  '007': 'IDN',
  '008': 'MYS',
  '009': 'SGP',
  '010': 'THA',
  '011': 'VNM',
  '012': 'MMR',
  '013': 'KHM',
  '015': 'LAO',
  '018': 'IND',
  '019': 'NPL',
  '020': 'LKA',
  '022': 'PAK',
  '023': 'BGD',
  '025': 'AFG',
  '026': 'TUR',
  '027': 'IRQ',
  '028': 'IRN',
  '029': 'SYR',
  '030': 'LBN',
  '031': 'JOR',
  '032': 'ISR',
  '033': 'SAU',
  '034': 'ARE',
  '035': 'QAT',
  '036': 'KWT',
  '037': 'BHR',
  '038': 'OMN',
  '039': 'YEM',
  '040': 'EGY',
  '041': 'USA',
  '043': 'CAN',
  '044': 'MEX',
  '045': 'GTM',
  '046': 'BLZ',
  '047': 'SLV',
  '048': 'HND',
  '049': 'NIC',
  '050': 'CRI',
  '051': 'PAN',
  '052': 'CUB',
  '053': 'JAM',
  '054': 'HTI',
  '055': 'DOM',
  '060': 'COL',
  '061': 'VEN',
  '062': 'ECU',
  '063': 'PER',
  '064': 'BOL',
  '065': 'BRA',
  '066': 'ARG',
  '067': 'CHL',
  '068': 'PRY',
  '069': 'URY',
  '070': 'GBR',
  '071': 'IRL',
  '072': 'FRA',
  '074': 'NLD',
  '075': 'BEL',
  '076': 'LUX',
  '077': 'DEU',
  '078': 'AUT',
  '079': 'CHE',
  '080': 'ITA',
  '082': 'ESP',
  '083': 'PRT',
  '084': 'GRC',
  '086': 'SWE',
  '087': 'NOR',
  '088': 'DNK',
  '089': 'FIN',
  '090': 'ISL',
  '091': 'POL',
  '092': 'CZE',
  '093': 'SVK',
  '094': 'HUN',
  '095': 'ROU',
  '096': 'BGR',
  '098': 'HRV',
  '099': 'SVN',
  '100': 'BIH',
  '101': 'SRB',
  '103': 'ALB',
  '104': 'MKD',
  '105': 'MNE',
  '106': 'RUS',
  '107': 'UKR',
  '108': 'MDA',
  '109': 'BLR',
  '110': 'GEO',
  '111': 'ARM',
  '112': 'AZE',
  '113': 'KAZ',
  '114': 'UZB',
  '115': 'TKM',
  '116': 'TJK',
  '117': 'KGZ',
  '118': 'EST',
  '119': 'LVA',
  '120': 'LTU',
  '122': 'AUS',
  '123': 'NZL',
  '124': 'FJI',
  '125': 'PNG',
  '127': 'ZAF',
  '130': 'KEN',
  '131': 'TZA',
  '132': 'UGA',
  '133': 'ETH',
  '134': 'NGA',
  '135': 'GHA',
  '136': 'SEN',
  '138': 'MAR',
  '139': 'TUN',
  '140': 'LBY',
  '141': 'DZA',
  '143': 'MOZ',
  '147': 'COD',
  '148': 'CMR',
  '153': 'SDN',
  '154': 'SSD',
  '156': 'SOM',
  '159': 'MLI',
  '160': 'BFA',
  '161': 'NER',
  '162': 'TCD',
  '165': 'MDG',
  '171': 'PRK',
};

interface FetcherResult {
  indicators: RawIndicator[];
  advisoryInfo: AdvisoryInfoMap;
}

/** Fetch a batch of items concurrently with worker queue pattern */
async function fetchBatch<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await fn(item);
    }
  });
  await Promise.allSettled(workers);
}

/** Merge source advisory info into the combined map */
function mergeAdvisoryInfo(target: AdvisoryInfoMap, source: AdvisoryInfoMap): void {
  for (const [iso3, info] of Object.entries(source)) {
    if (!target[iso3]) target[iso3] = {};
    Object.assign(target[iso3], info);
  }
}

// =============================================================================
// Sub-fetcher 1: Germany (Auswaertiges Amt)
// =============================================================================

async function fetchDeAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const response = await fetch(DE_API_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const rawData = await response.json();
  writeJson(join(rawDir, 'advisories-de.json'), rawData);

  const r = (rawData as Record<string, unknown>).response as Record<string, unknown> | undefined;
  if (!r) throw new Error('No response field in Germany API data');

  const contentList = r.contentList as number[];
  if (!Array.isArray(contentList)) throw new Error('No contentList in Germany API response');

  for (const id of contentList) {
    const entry = r[String(id)] as Record<string, unknown> | undefined;
    if (!entry) continue;

    const iso3 = String(entry.iso3CountryCode || '').toUpperCase();
    if (!iso3 || iso3.length !== 3) continue;

    const country = getCountryByIso3(iso3);
    if (!country) continue;

    const level = normalizeDeLevel({
      warning: Boolean(entry.warning),
      partialWarning: Boolean(entry.partialWarning),
      situationWarning: Boolean(entry.situationWarning),
      situationPartWarning: Boolean(entry.situationPartWarning),
    });

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_de',
      value: level,
      year: currentYear,
      source: 'advisories_de',
      fetchedAt,
    });

    // Build advisory info
    const lastModified = entry.lastModified
      ? new Date(Number(entry.lastModified) * 1000).toISOString()
      : fetchedAt;

    if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
    advisoryInfo[country.iso3].de = {
      level,
      text: DE_LEVEL_TEXT[level] || `Level ${level}`,
      source: 'German Federal Foreign Office',
      url: 'https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/reise-und-sicherheitshinweise',
      updatedAt: lastModified,
    };
  }

  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 2: Netherlands (nederlandwereldwijd.nl)
// =============================================================================

async function fetchNlAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};
  const summary: { total: number; found: number; samples: string[] } = {
    total: COUNTRIES.length,
    found: 0,
    samples: [],
  };

  // Iterate all countries from our list (listing endpoint only returns 25)
  await fetchBatch(
    [...COUNTRIES],
    async (country) => {
      const url = `${NL_API_BASE}/${country.iso3.toLowerCase()}/traveladvice`;
      try {
        const r = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
        });

        if (!r.ok) return; // No data for this country, skip silently

        const xml = await r.text();

        // Find ALL color mentions in the introduction to handle multi-region entries
        const allColors = xml.match(/(?:kleurcode|reisadvies)[^.]*?(rood|oranje|geel|groen)/gi);
        let maxLevel = 0;

        if (allColors && allColors.length > 0) {
          for (const colorMatch of allColors) {
            const colorWord = colorMatch.match(/(rood|oranje|geel|groen)/i);
            if (colorWord) {
              const level = normalizeNlColor(colorWord[1]);
              if (level > maxLevel) maxLevel = level;
            }
          }
        }

        if (maxLevel === 0) return; // No color found, skip

        const level = maxLevel as 1 | 2 | 3 | 4;

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_nl',
          value: level,
          year: currentYear,
          source: 'advisories_nl',
          fetchedAt,
        });

        // Extract last modified date if available
        const lastModMatch = xml.match(/<lastmodified>([^<]+)<\/lastmodified>/);
        const updatedAt = lastModMatch ? lastModMatch[1] : fetchedAt;

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].nl = {
          level,
          text: NL_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Netherlands Ministry of Foreign Affairs',
          url: `https://www.nederlandwereldwijd.nl/reisadvies/${country.name.en.toLowerCase().replace(/\s+/g, '-')}`,
          updatedAt,
        };

        summary.found++;
        if (summary.samples.length < 5) {
          summary.samples.push(`${country.iso3}=${level}`);
        }
      } catch {
        // Individual country fetch failed, skip silently
      }
    },
    10, // Concurrency 10 (lower than UK's 20 for smaller API)
  );

  writeJson(join(rawDir, 'advisories-nl.json'), {
    fetchedAt,
    countriesQueried: summary.total,
    countriesWithData: summary.found,
    samples: summary.samples,
  });

  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 3: Japan (MOFA anzen.mofa.go.jp)
// =============================================================================

/** Convert fullwidth digit to number: 1->1, 2->2 etc */
function parseJpDigit(char: string): number {
  const code = char.charCodeAt(0);
  // Fullwidth digits: \uFF10 (0) through \uFF19 (9)
  if (code >= 0xff10 && code <= 0xff19) {
    return code - 0xff10;
  }
  // ASCII digits
  if (code >= 0x30 && code <= 0x39) {
    return code - 0x30;
  }
  return 0;
}

async function fetchJpAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};
  const pageResults: Record<string, { iso3: string; level: number }> = {};

  const entries = Object.entries(JP_MOFA_ID_TO_ISO3);

  await fetchBatch(
    entries,
    async ([pageId, iso3]) => {
      const country = getCountryByIso3(iso3);
      if (!country) return;

      const url = `${JP_MOFA_BASE}/info/pcinfectionspothazardinfo_${pageId}.html`;
      try {
        const r = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
        });

        if (!r.ok) return; // Page doesn't exist for this country

        const html = await r.text();

        // Look for danger level patterns: レベル followed by a digit (1-4)
        // Digits may be fullwidth (１-４) or ASCII (1-4)
        const levelPattern = /\u30EC\u30D9\u30EB\s*([１-４1-4])/g;
        let maxLevel = 0;
        let match;

        while ((match = levelPattern.exec(html)) !== null) {
          const digit = parseJpDigit(match[1]);
          if (digit >= 1 && digit <= 4 && digit > maxLevel) {
            maxLevel = digit;
          }
        }

        if (maxLevel === 0) return; // No level found

        const level = normalizeJpLevel(maxLevel);

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_jp',
          value: level,
          year: currentYear,
          source: 'advisories_jp',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].jp = {
          level,
          text: JP_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Japan Ministry of Foreign Affairs',
          url,
          updatedAt: fetchedAt,
        };

        pageResults[pageId] = { iso3: country.iso3, level };
      } catch {
        // Individual page fetch failed, skip silently
      }
    },
    5, // Concurrency 5 (be polite to MOFA servers)
  );

  writeJson(join(rawDir, 'advisories-jp.json'), {
    fetchedAt,
    totalMappings: entries.length,
    countriesWithData: Object.keys(pageResults).length,
    pageResults,
  });

  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 4: Slovakia (MZV open data)
// =============================================================================

async function fetchSkAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const response = await fetch(SK_API_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const rawData = await response.json();
  writeJson(join(rawDir, 'advisories-sk.json'), rawData);

  const result = (rawData as Record<string, unknown>).result as Record<string, unknown> | undefined;
  if (!result) throw new Error('No result field in Slovakia API data');

  const records = result.records as Record<string, unknown>[];
  if (!Array.isArray(records)) throw new Error('No records array in Slovakia API response');

  let withData = 0;
  const total = records.length;

  for (const record of records) {
    const englishName = String(record['Oficialny anglicky nazov'] || '').trim();
    const riskText = String(record['Stupen rizika CO'] || '').trim();

    if (!englishName) continue;

    const country = getCountryByName(englishName);
    if (!country) continue;

    // Only produce indicator if risk text is non-empty
    if (!riskText) continue;

    withData++;
    const level = normalizeSkLevel(riskText);

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_sk',
      value: level,
      year: currentYear,
      source: 'advisories_sk',
      fetchedAt,
    });

    // Extract date if available
    const dateStr = String(record['Datum zmeny'] || '').trim();
    let updatedAt = fetchedAt;
    if (dateStr) {
      // Format: "DD.MM.YYYY HH:MM:SS"
      const parts = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (parts) {
        updatedAt = `${parts[3]}-${parts[2]}-${parts[1]}T00:00:00Z`;
      }
    }

    if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
    advisoryInfo[country.iso3].sk = {
      level,
      text: SK_LEVEL_TEXT[level] || riskText,
      source: 'Slovak Ministry of Foreign Affairs',
      url: 'https://www.mzv.sk/cestovanie/cestovne-odporucania',
      updatedAt,
    };
  }

  console.log(
    `[ADVISORIES-T1] SK: ${withData} countries with risk data out of ${total} records`,
  );

  return { indicators, advisoryInfo };
}

// =============================================================================
// Main orchestrator
// =============================================================================

/**
 * Fetch Tier 1 advisory sources: Germany, Netherlands, Japan, Slovakia.
 * Each sub-fetcher runs independently in try/catch blocks.
 * Falls back to cached data if ALL sub-fetchers fail.
 */
export async function fetchTier1Advisories(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const currentYear = new Date().getFullYear();

  const allIndicators: RawIndicator[] = [];
  const combinedAdvisoryInfo: AdvisoryInfoMap = {};
  const errors: string[] = [];

  // Fetch Germany advisories
  try {
    console.log('[ADVISORIES-T1] Fetching Germany (Auswaertiges Amt) advisories...');
    const result = await fetchDeAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const deCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES-T1] DE: ${deCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T1] DE fetch failed: ${msg}`);
    errors.push(`DE: ${msg}`);
  }

  // Fetch Netherlands advisories
  try {
    console.log('[ADVISORIES-T1] Fetching Netherlands (BZ) advisories...');
    const result = await fetchNlAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const nlCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES-T1] NL: ${nlCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T1] NL fetch failed: ${msg}`);
    errors.push(`NL: ${msg}`);
  }

  // Fetch Japan advisories
  try {
    console.log('[ADVISORIES-T1] Fetching Japan (MOFA) advisories...');
    const result = await fetchJpAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const jpCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES-T1] JP: ${jpCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T1] JP fetch failed: ${msg}`);
    errors.push(`JP: ${msg}`);
  }

  // Fetch Slovakia advisories
  try {
    console.log('[ADVISORIES-T1] Fetching Slovakia (MZV) advisories...');
    const result = await fetchSkAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const skCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES-T1] SK: ${skCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T1] SK fetch failed: ${msg}`);
    errors.push(`SK: ${msg}`);
  }

  // If all failed, try cached data
  if (allIndicators.length === 0) {
    const cached = findLatestCached('advisories-tier1-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[ADVISORIES-T1] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'advisories-tier1-parsed.json'), cachedData);
        const cachedInfoPath = cached.replace(
          'advisories-tier1-parsed.json',
          'advisories-tier1-info.json',
        );
        const cachedInfo = readJson<AdvisoryInfoMap>(cachedInfoPath);
        if (cachedInfo) {
          writeJson(join(rawDir, 'advisories-tier1-info.json'), cachedInfo);
        }
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'advisories_tier1',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Errors: ${errors.join('; ')}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'advisories_tier1',
      success: false,
      countriesFound: 0,
      error: errors.join('; '),
      fetchedAt,
    };
  }

  // Save combined parsed data
  const sourceData: RawSourceData = {
    source: 'advisories_tier1',
    fetchedAt,
    indicators: allIndicators,
  };
  writeJson(join(rawDir, 'advisories-tier1-parsed.json'), sourceData);

  // Save advisory info side-channel
  writeJson(join(rawDir, 'advisories-tier1-info.json'), combinedAdvisoryInfo);

  const totalCountries = new Set(allIndicators.map((i) => i.countryIso3)).size;
  console.log(
    `[ADVISORIES-T1] Successfully processed ${totalCountries} countries total (${allIndicators.length} indicators)`,
  );

  return {
    source: 'advisories_tier1',
    success: true,
    countriesFound: totalCountries,
    error: errors.length > 0 ? `Partial: ${errors.join('; ')}` : undefined,
    fetchedAt,
  };
}
