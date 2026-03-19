import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName } from '../config/countries.js';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const GPI_EXCEL_URL =
  'https://www.visionofhumanity.org/wp-content/uploads/2024/06/GPI-2024-overall-scores-and-domains-2008-2024.xlsx';

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

function parseGpiExcel(buffer: Buffer, fetchedAt: string): RawIndicator[] {
  const indicators: RawIndicator[] = [];
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // GPI Excel typically has sheets for overall scores and domain scores
  // Try to find the most relevant sheet
  const sheetNames = workbook.SheetNames;
  console.log(`[GPI] Found sheets: ${sheetNames.join(', ')}`);

  // Look for the overall scores sheet first
  const overallSheet =
    sheetNames.find(
      (name) =>
        name.toLowerCase().includes('overall') || name.toLowerCase().includes('score')
    ) || sheetNames[0];

  const sheet = workbook.Sheets[overallSheet];
  if (!sheet) return indicators;

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length === 0) return indicators;

  // Find the year columns - GPI typically has columns like "2024", "2023", etc.
  const sampleRow = rows[0];
  const columns = Object.keys(sampleRow);

  // Find country name column
  const countryCol =
    columns.find(
      (c) =>
        c.toLowerCase().includes('country') || c.toLowerCase().includes('name')
    ) || columns[0];

  // Find the most recent year column
  const yearCols = columns
    .filter((c) => /^20\d{2}$/.test(c.trim()))
    .sort()
    .reverse();
  const latestYearCol = yearCols[0];
  const latestYear = latestYearCol ? parseInt(latestYearCol) : new Date().getFullYear();

  console.log(
    `[GPI] Using country column: "${countryCol}", year column: "${latestYearCol || 'N/A'}"`
  );

  for (const row of rows) {
    const rawCountryName = String(row[countryCol] || '').trim();
    if (!rawCountryName) continue;

    const resolvedName = resolveCountryName(rawCountryName);
    const country = getCountryByName(resolvedName);
    if (!country) {
      // Try original name as well
      const countryAlt = getCountryByName(rawCountryName);
      if (!countryAlt) continue;
      // Use the alt match
      const score = latestYearCol ? parseFloat(String(row[latestYearCol])) : NaN;
      if (!isNaN(score)) {
        indicators.push({
          countryIso3: countryAlt.iso3,
          indicatorName: 'gpi_overall',
          value: score,
          year: latestYear,
          source: 'gpi',
        });
      }
      continue;
    }

    // Extract overall GPI score from latest year column
    if (latestYearCol) {
      const score = parseFloat(String(row[latestYearCol]));
      if (!isNaN(score)) {
        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'gpi_overall',
          value: score,
          year: latestYear,
          source: 'gpi',
        });
      }
    }
  }

  // Try to find domain-specific sheets for safety_security and militarisation
  for (const sheetName of sheetNames) {
    const lowerName = sheetName.toLowerCase();
    let indicatorName: string | null = null;

    if (lowerName.includes('safety') || lowerName.includes('security')) {
      indicatorName = 'gpi_safety_security';
    } else if (lowerName.includes('militari')) {
      indicatorName = 'gpi_militarisation';
    }

    if (!indicatorName || sheetName === overallSheet) continue;

    const domainSheet = workbook.Sheets[sheetName];
    if (!domainSheet) continue;

    const domainRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(domainSheet, {
      defval: '',
    });
    if (domainRows.length === 0) continue;

    const domainCols = Object.keys(domainRows[0]);
    const domainCountryCol =
      domainCols.find(
        (c) =>
          c.toLowerCase().includes('country') || c.toLowerCase().includes('name')
      ) || domainCols[0];
    const domainYearCols = domainCols
      .filter((c) => /^20\d{2}$/.test(c.trim()))
      .sort()
      .reverse();
    const domainLatestYearCol = domainYearCols[0];

    for (const row of domainRows) {
      const rawName = String(row[domainCountryCol] || '').trim();
      if (!rawName) continue;

      const resolvedName = resolveCountryName(rawName);
      const country = getCountryByName(resolvedName) || getCountryByName(rawName);
      if (!country) continue;

      if (domainLatestYearCol) {
        const score = parseFloat(String(row[domainLatestYearCol]));
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
    }
  }

  return indicators;
}
