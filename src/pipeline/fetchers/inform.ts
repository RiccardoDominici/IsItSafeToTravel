import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByIso3 } from '../config/countries.js';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const INFORM_EXCEL_URL =
  'https://drmkc.jrc.ec.europa.eu/inform-index/Portals/0/InfoRM/2025/INFORM_Risk_Mid_2025_v071.xlsx';

/**
 * Map INFORM column headers to our indicator names.
 * INFORM Excel has columns like "INFORM Risk", "Hazard & Exposure", "Natural", "Human", etc.
 */
const COLUMN_MAP: Record<string, string> = {
  'natural': 'inform_natural',
  'human': 'inform_health',
  'epidemic': 'inform_epidemic',
  'governance': 'inform_governance',
  'institutional': 'inform_governance',
  'flood': 'inform_climate',
  'physical exposure to flood': 'inform_climate',
};

export async function fetchInform(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  try {
    console.log('[INFORM] Fetching INFORM Risk Index Excel...');
    const response = await fetch(INFORM_EXCEL_URL, {
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(join(rawDir, 'inform.xlsx'), buffer);

    const indicators = parseInformExcel(buffer, fetchedAt);
    const sourceData: RawSourceData = {
      source: 'inform',
      fetchedAt,
      indicators,
    };
    writeJson(join(rawDir, 'inform-parsed.json'), sourceData);

    const uniqueCountries = new Set(indicators.map((i) => i.countryIso3));
    console.log(
      `[INFORM] Successfully parsed data for ${uniqueCountries.size} countries (${indicators.length} indicators)`
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

function parseInformExcel(buffer: Buffer, fetchedAt: string): RawIndicator[] {
  const indicators: RawIndicator[] = [];
  const currentYear = new Date().getFullYear();
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  console.log(`[INFORM] Found sheets: ${workbook.SheetNames.join(', ')}`);

  // Find the main data sheet (contains "INFORM Risk" in name)
  const mainSheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase().includes('inform risk')
  ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[mainSheetName];
  if (!sheet) return indicators;

  // Read as array of arrays (header: 1) to handle multi-row headers
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: '', header: 1 });
  if (rawRows.length < 4) return indicators;

  // Row 1 (index 1) has the actual column headers
  const headers = (rawRows[1] as string[]).map(h => String(h).trim());
  console.log(`[INFORM] Headers: ${headers.slice(0, 20).join(', ')}...`);

  // Find ISO3 column index
  const iso3Idx = headers.findIndex(h => h.toUpperCase() === 'ISO3');
  if (iso3Idx === -1) {
    console.warn('[INFORM] Could not find ISO3 column');
    return indicators;
  }

  // Map specific columns to our indicators by header name
  const HEADER_MAP: Record<string, string> = {
    'Natural': 'inform_natural',
    'Epidemic': 'inform_epidemic',
    'Human': 'inform_health',
    'Projected Conflict Probability': 'inform_governance',
    'Current Conflict Intensity': 'inform_natural', // reuse for conflict signal
    'River Flood': 'inform_climate',
  };

  const mappedCols: Array<{ idx: number; indicator: string; header: string }> = [];
  for (let i = 0; i < headers.length; i++) {
    const mapped = HEADER_MAP[headers[i]];
    if (mapped && !mappedCols.some(m => m.indicator === mapped)) {
      mappedCols.push({ idx: i, indicator: mapped, header: headers[i] });
    }
  }

  console.log(`[INFORM] Mapped: ${mappedCols.map(m => `${m.header} -> ${m.indicator}`).join(', ')}`);

  // Data starts at row 3 (index 3), skip header rows
  for (let r = 3; r < rawRows.length; r++) {
    const row = rawRows[r] as unknown[];
    const iso3 = String(row[iso3Idx] || '').trim().toUpperCase();
    if (!iso3 || iso3.length !== 3) continue;
    if (!getCountryByIso3(iso3)) continue;

    for (const { idx, indicator } of mappedCols) {
      const value = parseFloat(String(row[idx]));
      if (isNaN(value)) continue;

      indicators.push({
        countryIso3: iso3,
        indicatorName: indicator,
        value,
        year: currentYear,
        source: 'inform',
      });
    }
  }

  return indicators;
}
