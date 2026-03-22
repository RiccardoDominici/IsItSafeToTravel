import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName } from '../config/countries.js';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const GPI_EXCEL_URL =
  'https://www.visionofhumanity.org/wp-content/uploads/2023/06/GPI-2023-overall-scores-and-domains-2008-2023.xlsx';

/**
 * Common country name aliases that differ between GPI and ISO standard names.
 * GPI uses informal names; our countries.ts uses ISO standard names.
 */
const NAME_ALIASES: Record<string, string> = {
  'united states of america': 'United States',
  'united states': 'United States',
  'usa': 'United States',
  'u.s.a.': 'United States',
  'uk': 'United Kingdom',
  'united kingdom of great britain and northern ireland': 'United Kingdom',
  'republic of korea': 'South Korea',
  'korea, republic of': 'South Korea',
  "korea, dem. people's rep.": 'North Korea',
  "democratic people's republic of korea": 'North Korea',
  'russian federation': 'Russia',
  'iran, islamic republic of': 'Iran',
  'iran (islamic republic of)': 'Iran',
  'syrian arab republic': 'Syria',
  'venezuela, bolivarian republic of': 'Venezuela',
  'bolivia, plurinational state of': 'Bolivia',
  'tanzania, united republic of': 'Tanzania',
  "lao people's democratic republic": 'Laos',
  'viet nam': 'Vietnam',
  "cote d'ivoire": "Cote d'Ivoire",
  'ivory coast': "Cote d'Ivoire",
  'czech republic': 'Czech Republic',
  'czechia': 'Czech Republic',
  'eswatini': 'Eswatini',
  'swaziland': 'Eswatini',
  'north macedonia': 'North Macedonia',
  'republic of north macedonia': 'North Macedonia',
  'macedonia': 'North Macedonia',
  'timor leste': 'Timor-Leste',
  'east timor': 'Timor-Leste',
  'brunei darussalam': 'Brunei',
  'myanmar (burma)': 'Myanmar',
  'burma': 'Myanmar',
  'palestine, state of': 'Palestine',
  'state of palestine': 'Palestine',
  'congo, democratic republic of the': 'Democratic Republic of the Congo',
  'dr congo': 'Democratic Republic of the Congo',
  'drc': 'Democratic Republic of the Congo',
  'congo, republic of the': 'Congo',
  'republic of the congo': 'Congo',
  'cape verde': 'Cabo Verde',
  'taiwan, province of china': 'Taiwan',
  'chinese taipei': 'Taiwan',
  'hong kong sar': 'Hong Kong',
  'macao sar': 'Macao',
  'türkiye': 'Turkey',
  'turkiye': 'Turkey',
};

function resolveCountryName(rawName: string): string {
  const lower = rawName.trim().toLowerCase();
  return NAME_ALIASES[lower] || rawName.trim();
}

export async function fetchGpi(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  try {
    console.log('[GPI] Fetching Global Peace Index data...');
    const response = await fetch(GPI_EXCEL_URL, {
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(join(rawDir, 'gpi.xlsx'), buffer);

    const indicators = parseGpiExcel(buffer, fetchedAt);
    const sourceData: RawSourceData = {
      source: 'gpi',
      fetchedAt,
      indicators,
    };
    writeJson(join(rawDir, 'gpi-parsed.json'), sourceData);

    const uniqueCountries = new Set(indicators.map((i) => i.countryIso3));
    console.log(
      `[GPI] Successfully parsed data for ${uniqueCountries.size} countries (${indicators.length} indicators)`
    );

    return {
      source: 'gpi',
      success: true,
      countriesFound: uniqueCountries.size,
      fetchedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[GPI] Fetch failed: ${errorMessage}`);

    // Try fallback to cached data
    const cached = findLatestCached('gpi-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[GPI] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'gpi-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'gpi',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Original error: ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'gpi',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }
}

/**
 * Parse a single GPI sheet. The Excel has a header row (Row 1 in the JSON)
 * where __EMPTY = "Country", __EMPTY_1 = "iso3c", __EMPTY_2..N = year numbers.
 * Data rows follow from Row 2 onward.
 */
function parseGpiSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  indicatorName: string,
  fetchedAt: string
): { indicators: RawIndicator[]; latestYear: number } {
  const indicators: RawIndicator[] = [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { indicators, latestYear: 0 };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length < 2) return { indicators, latestYear: 0 };

  // Row 0 is empty/spacer, Row 1 is the real header
  const headerRow = rows.find(
    (r) => String(r['__EMPTY'] || '').toLowerCase() === 'country'
  );
  if (!headerRow) return { indicators, latestYear: 0 };

  // Build column-to-year mapping from header row
  const colKeys = Object.keys(headerRow);
  const yearMap = new Map<string, number>();
  let latestYear = 0;
  for (const col of colKeys) {
    const val = headerRow[col];
    const num = typeof val === 'number' ? val : parseInt(String(val));
    if (num >= 2000 && num <= 2100) {
      yearMap.set(col, num);
      if (num > latestYear) latestYear = num;
    }
  }

  // Find the column key for the latest year
  let latestYearCol: string | null = null;
  for (const [col, year] of yearMap) {
    if (year === latestYear) {
      latestYearCol = col;
      break;
    }
  }

  if (!latestYearCol) return { indicators, latestYear: 0 };

  // Find country and iso3c column keys
  const countryCol = colKeys.find(
    (c) => String(headerRow[c] || '').toLowerCase() === 'country'
  ) || '__EMPTY';
  const iso3Col = colKeys.find(
    (c) => String(headerRow[c] || '').toLowerCase() === 'iso3c'
  );

  console.log(
    `[GPI] Sheet "${sheetName}": latest year ${latestYear}, col "${latestYearCol}"`
  );

  // Parse data rows (skip header and spacer rows)
  const headerIdx = rows.indexOf(headerRow);
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const rawCountryName = String(row[countryCol] || '').trim();
    if (!rawCountryName || rawCountryName.toLowerCase() === 'country') continue;

    // Try ISO3 first, then name resolution
    let country = iso3Col
      ? getCountryByName(String(row[iso3Col] || '').trim())
      : null;
    if (!country) {
      const resolvedName = resolveCountryName(rawCountryName);
      country = getCountryByName(resolvedName) || getCountryByName(rawCountryName);
    }
    if (!country) continue;

    const score = parseFloat(String(row[latestYearCol]));
    if (!isNaN(score)) {
      indicators.push({
        countryIso3: country.iso3,
        indicatorName,
        value: score,
        year: latestYear,
        source: 'gpi',
      });
    }
  }

  return { indicators, latestYear };
}

function parseGpiExcel(buffer: Buffer, fetchedAt: string): RawIndicator[] {
  const indicators: RawIndicator[] = [];
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = workbook.SheetNames;
  console.log(`[GPI] Found sheets: ${sheetNames.join(', ')}`);

  // Map sheet names to indicator names
  const sheetMap: [string, string][] = [];
  for (const name of sheetNames) {
    const lower = name.toLowerCase();
    if (lower.includes('overall') || lower.includes('score')) {
      sheetMap.push([name, 'gpi_overall']);
    } else if (lower.includes('safety') || lower.includes('security')) {
      sheetMap.push([name, 'gpi_safety_security']);
    } else if (lower.includes('militari')) {
      sheetMap.push([name, 'gpi_militarisation']);
    }
  }

  for (const [sheetName, indicatorName] of sheetMap) {
    const result = parseGpiSheet(workbook, sheetName, indicatorName, fetchedAt);
    indicators.push(...result.indicators);
  }

  return indicators;
}
