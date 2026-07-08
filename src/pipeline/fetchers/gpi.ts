import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso3 } from '../config/countries.js';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const GPI_EXCEL_URL =
  'https://www.visionofhumanity.org/wp-content/uploads/2023/06/GPI-2023-overall-scores-and-domains-2008-2023.xlsx';

// v9.1 (SHIP-SPEC 1.1c, D3): primary GPI source is the IEP's own JSON manifest,
// which carries the CURRENT (2026) edition across ALL published years — including
// retroactive revisions the frozen 2023 xlsx snapshot below can never reflect.
// The xlsx above is kept as a documented fallback (D3 fallback chain).
const GPI_MANIFEST_URL = 'https://gpi.economicsandpeace.org/data/gpi/manifest.json';
const GPI_JSON_YEAR_URL = (year: number) => `https://gpi.economicsandpeace.org/data/gpi/${year}.json`;

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

/**
 * v9.1 (SHIP-SPEC 1.1c, D3) — fetch the IEP GPI JSON manifest + every published
 * year's JSON (2008 through whatever the manifest's `years` array currently
 * tops out at, e.g. 2026) into the SAME Map<year, RawIndicator[]> shape as
 * parseGpiExcelAllYears, so selectGpiIndicatorsForYear() works identically
 * regardless of which source produced the map.
 *
 * Field mapping (per-year JSON entry): iso3 -> countryIso3; overall ->
 * gpi_overall; safety -> gpi_safety_security; militarisation -> gpi_militarisation.
 * A year whose fetch fails is skipped (not fatal) — the manifest lists 19 years
 * as of 2026; losing one still leaves the vintage-selection logic usable.
 */
export async function parseGpiJsonAllYears(): Promise<Map<number, RawIndicator[]>> {
  const manifestRes = await fetch(GPI_MANIFEST_URL, { signal: AbortSignal.timeout(30_000) });
  if (!manifestRes.ok) {
    throw new Error(`manifest.json: HTTP ${manifestRes.status}`);
  }
  const manifest = (await manifestRes.json()) as { years?: number[] };
  const years = Array.isArray(manifest.years) ? manifest.years : [];
  if (years.length === 0) {
    throw new Error('manifest.json: no years array');
  }

  const byYear = new Map<number, RawIndicator[]>();

  await Promise.all(
    years.map(async (year) => {
      try {
        const res = await fetch(GPI_JSON_YEAR_URL(year), { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) {
          console.warn(`[GPI] JSON ${year}.json: HTTP ${res.status} — skipping this year`);
          return;
        }
        const entries = (await res.json()) as Array<{
          iso3?: string;
          overall?: number;
          safety?: number;
          militarisation?: number;
        }>;
        if (!Array.isArray(entries)) return;

        const indicators: RawIndicator[] = [];
        for (const entry of entries) {
          const iso3 = (entry.iso3 || '').toUpperCase();
          if (!iso3 || !getCountryByIso3(iso3)) continue;

          if (typeof entry.overall === 'number' && !isNaN(entry.overall)) {
            indicators.push({ countryIso3: iso3, indicatorName: 'gpi_overall', value: entry.overall, year, source: 'gpi' });
          }
          if (typeof entry.safety === 'number' && !isNaN(entry.safety)) {
            indicators.push({ countryIso3: iso3, indicatorName: 'gpi_safety_security', value: entry.safety, year, source: 'gpi' });
          }
          if (typeof entry.militarisation === 'number' && !isNaN(entry.militarisation)) {
            indicators.push({ countryIso3: iso3, indicatorName: 'gpi_militarisation', value: entry.militarisation, year, source: 'gpi' });
          }
        }
        if (indicators.length > 0) byYear.set(year, indicators);
      } catch (yearError) {
        const msg = yearError instanceof Error ? yearError.message : String(yearError);
        console.warn(`[GPI] JSON ${year}.json: fetch failed (${msg}) — skipping this year`);
      }
    }),
  );

  return byYear;
}

/** Serialize a Map<year, RawIndicator[]> to a plain JSON-friendly object for disk persistence. */
export function serializeGpiByYear(byYear: Map<number, RawIndicator[]>): Record<string, RawIndicator[]> {
  const out: Record<string, RawIndicator[]> = {};
  for (const [year, indicators] of byYear) out[String(year)] = indicators;
  return out;
}

/** Inverse of serializeGpiByYear — reconstruct the Map from a persisted JSON file. */
export function deserializeGpiByYear(obj: Record<string, RawIndicator[]>): Map<number, RawIndicator[]> {
  const byYear = new Map<number, RawIndicator[]>();
  for (const [yearStr, indicators] of Object.entries(obj)) {
    const year = Number(yearStr);
    if (Number.isFinite(year)) byYear.set(year, indicators);
  }
  return byYear;
}

/**
 * xlsx fallback path (D3 fallback chain step 2): fetch + parse the frozen 2023
 * GPI workbook exactly as fetchGpi always did pre-v9.1. Extracted into its own
 * function so fetchGpi can try the JSON primary source first and fall back here
 * without duplicating the xlsx parse/persist logic.
 */
async function fetchGpiXlsxFallback(rawDir: string, fetchedAt: string): Promise<FetchResult> {
  console.log('[GPI] Fetching Global Peace Index data (xlsx fallback)...');
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
    `[GPI] xlsx fallback: parsed data for ${uniqueCountries.size} countries (${indicators.length} indicators)`
  );

  return {
    source: 'gpi',
    success: true,
    countriesFound: uniqueCountries.size,
    fetchedAt,
  };
}

export async function fetchGpi(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const errors: string[] = [];

  // Primary (v9.1, D3): IEP GPI JSON manifest — current edition, all published
  // years, so retroactive revisions to earlier years are picked up too.
  try {
    console.log('[GPI] Fetching Global Peace Index data (JSON manifest, primary)...');
    const byYear = await parseGpiJsonAllYears();
    if (byYear.size === 0) throw new Error('no years parsed from JSON manifest');

    // Persist the FULL all-years table for backfill vintage-selection (mirrors
    // gpi.xlsx's role for the xlsx path — see backfill.ts injectGpiForDate).
    writeJson(join(rawDir, 'gpi-json-all-years.json'), serializeGpiByYear(byYear));

    const latestYear = Math.max(...byYear.keys());
    const indicators = byYear.get(latestYear) ?? [];
    if (indicators.length === 0) throw new Error(`no indicators for latest year ${latestYear}`);

    const sourceData: RawSourceData = { source: 'gpi', fetchedAt, indicators };
    writeJson(join(rawDir, 'gpi-parsed.json'), sourceData);

    const uniqueCountries = new Set(indicators.map((i) => i.countryIso3));
    console.log(
      `[GPI] JSON: ${uniqueCountries.size} countries for ${latestYear} (${byYear.size} years persisted for backfill)`,
    );

    return {
      source: 'gpi',
      success: true,
      countriesFound: uniqueCountries.size,
      fetchedAt,
    };
  } catch (jsonError) {
    const msg = jsonError instanceof Error ? jsonError.message : String(jsonError);
    console.warn(`[GPI] JSON fetch failed: ${msg} — falling back to xlsx`);
    errors.push(`JSON: ${msg}`);
  }

  // Fallback 1 (D3 fallback chain): existing 2023 xlsx.
  try {
    return await fetchGpiXlsxFallback(rawDir, fetchedAt);
  } catch (xlsxError) {
    const msg = xlsxError instanceof Error ? xlsxError.message : String(xlsxError);
    console.warn(`[GPI] xlsx fallback failed: ${msg}`);
    errors.push(`xlsx: ${msg}`);
  }

  // Fallback 2: last cached gpi-parsed.json (either source).
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
        error: `Used cached data. Errors: ${errors.join('; ')}`,
        fetchedAt: cachedData.fetchedAt,
      };
    }
  }

  return {
    source: 'gpi',
    success: false,
    countriesFound: 0,
    error: errors.join('; '),
    fetchedAt,
  };
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

/**
 * Map GPI workbook sheet names to their indicator name, by matching on
 * substrings (case-insensitive) — the same rule used by the live latest-year
 * parser and the historical per-year parser below, so both stay consistent.
 */
function resolveGpiSheetMap(workbook: XLSX.WorkBook): [string, string][] {
  const sheetMap: [string, string][] = [];
  for (const name of workbook.SheetNames) {
    const lower = name.toLowerCase();
    if (lower.includes('overall') || lower.includes('score')) {
      sheetMap.push([name, 'gpi_overall']);
    } else if (lower.includes('safety') || lower.includes('security')) {
      sheetMap.push([name, 'gpi_safety_security']);
    } else if (lower.includes('militari')) {
      sheetMap.push([name, 'gpi_militarisation']);
    }
  }
  return sheetMap;
}

function parseGpiExcel(buffer: Buffer, fetchedAt: string): RawIndicator[] {
  const indicators: RawIndicator[] = [];
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  console.log(`[GPI] Found sheets: ${workbook.SheetNames.join(', ')}`);

  const sheetMap = resolveGpiSheetMap(workbook);
  for (const [sheetName, indicatorName] of sheetMap) {
    const result = parseGpiSheet(workbook, sheetName, indicatorName, fetchedAt);
    indicators.push(...result.indicators);
  }

  return indicators;
}

/**
 * Parse ONE GPI sheet's data for EVERY year column present (2008-2023 as of the
 * GPI-2023 release), grouped by year. Historical-backfill helper (SHIP-SPEC 1.3):
 * gpi.xlsx carries the full Overall Scores / Safety and Security / Militarisation
 * history across all published years in a single file, so backfill can select the
 * correct vintage per historical snapshot date instead of only ever seeing the
 * latest year (which is all fetchGpi's live path emits — UNCHANGED, see
 * parseGpiExcel/fetchGpi above).
 */
function parseGpiSheetAllYears(
  workbook: XLSX.WorkBook,
  sheetName: string,
  indicatorName: string,
): Map<number, RawIndicator[]> {
  const byYear = new Map<number, RawIndicator[]>();
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return byYear;

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length < 2) return byYear;

  const headerRow = rows.find(
    (r) => String(r['__EMPTY'] || '').toLowerCase() === 'country'
  );
  if (!headerRow) return byYear;

  const colKeys = Object.keys(headerRow);
  const yearCols = new Map<string, number>(); // column key -> year
  for (const col of colKeys) {
    const val = headerRow[col];
    const num = typeof val === 'number' ? val : parseInt(String(val));
    if (num >= 2000 && num <= 2100) yearCols.set(col, num);
  }
  if (yearCols.size === 0) return byYear;

  const countryCol = colKeys.find(
    (c) => String(headerRow[c] || '').toLowerCase() === 'country'
  ) || '__EMPTY';
  const iso3Col = colKeys.find(
    (c) => String(headerRow[c] || '').toLowerCase() === 'iso3c'
  );

  const headerIdx = rows.indexOf(headerRow);
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const rawCountryName = String(row[countryCol] || '').trim();
    if (!rawCountryName || rawCountryName.toLowerCase() === 'country') continue;

    let country = iso3Col
      ? getCountryByName(String(row[iso3Col] || '').trim())
      : null;
    if (!country) {
      const resolvedName = resolveCountryName(rawCountryName);
      country = getCountryByName(resolvedName) || getCountryByName(rawCountryName);
    }
    if (!country) continue;

    for (const [col, year] of yearCols) {
      const score = parseFloat(String(row[col]));
      if (isNaN(score)) continue;
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year)!.push({
        countryIso3: country.iso3,
        indicatorName,
        value: score,
        year,
        source: 'gpi',
      });
    }
  }

  return byYear;
}

/**
 * Parse a full GPI workbook into per-year indicator sets across all 3 GPI sheets
 * (gpi_overall / gpi_safety_security / gpi_militarisation). Exported for backfill.
 */
export function parseGpiExcelAllYears(buffer: Buffer): Map<number, RawIndicator[]> {
  const merged = new Map<number, RawIndicator[]>();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetMap = resolveGpiSheetMap(workbook);

  for (const [sheetName, indicatorName] of sheetMap) {
    const byYear = parseGpiSheetAllYears(workbook, sheetName, indicatorName);
    for (const [year, indicators] of byYear) {
      if (!merged.has(year)) merged.set(year, []);
      merged.get(year)!.push(...indicators);
    }
  }

  return merged;
}

/**
 * Select the GPI indicator set for a given snapshot year: the largest available
 * year <= snapshotYear (i.e. year = min(snapshotYear, latest available year), per
 * SHIP-SPEC 1.3). Falls back to the earliest available year if snapshotYear
 * predates the workbook's coverage. Returns [] if the workbook has no year data.
 */
export function selectGpiIndicatorsForYear(
  byYear: Map<number, RawIndicator[]>,
  snapshotYear: number,
): RawIndicator[] {
  const availableYears = [...byYear.keys()];
  if (availableYears.length === 0) return [];

  let best: number | null = null;
  for (const y of availableYears) {
    if (y <= snapshotYear && (best === null || y > best)) best = y;
  }
  if (best === null) best = Math.min(...availableYears);

  return byYear.get(best) ?? [];
}
