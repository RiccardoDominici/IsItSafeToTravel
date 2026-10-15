import * as XLSX from 'xlsx';
import type { RawIndicator } from '../types.js';
import { getCountryByIso3 } from '../config/countries.js';

/**
 * INFORM Risk workbook parsing (formula v10, SPEC §2 and §6).
 *
 * Column selection is EXACT: each expected header must occur exactly once in the
 * header row. A missing or duplicated header throws, so the source fails loudly
 * instead of silently mapping a similar column (the v9.1 bug read "Institutional"
 * because it came first, and "Human" as health).
 */

/** Expected INFORM header (after whitespace normalisation) -> indicator name. */
export const INFORM_COLUMN_MAP: ReadonlyArray<{ header: string; indicator: string }> = [
  { header: 'Natural', indicator: 'inform_natural' },
  { header: 'Epidemic', indicator: 'inform_epidemic' },
  { header: 'Access to health care', indicator: 'inform_health_access' },
  { header: 'Governance', indicator: 'inform_governance' },
  // Formula v10.1 (I49): the dimension score "LACK OF COPING CAPACITY" (upper case in the
  // workbook, distinct from the "Lack of Coping Capacity" sheet). An engine input only: it turns
  // natural-hazard exposure into risk (engine.ts naturalHazardRisk) and is never scored alone.
  { header: 'LACK OF COPING CAPACITY', indicator: 'inform_coping' },
];

/** Sheet carrying the edition year, e.g. "INFORM Risk 2026 (a-z)" or "INFORM Risk Mid 2025 (a-z)". */
export const INFORM_SHEET_YEAR_RE = /INFORM Risk (?:Mid )?(\d{4})/i;

/**
 * Sanity floor for the number of countries in a parsed workbook. The 2026 edition
 * has 191. A workbook yielding far fewer is treated as a broken download or a
 * layout change, not as data.
 */
export const MIN_INFORM_COUNTRIES = 150;

/** Thrown when the workbook does not have the layout we expect. Never retried, never silently mapped. */
export class InformSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InformSchemaError';
  }
}

export interface InformParseResult {
  indicators: RawIndicator[];
  sheetName: string;
  editionYear: number;
  countries: number;
  /** Values outside the 0-10 INFORM scale that were dropped (logged, not fatal). */
  outOfRangeSkipped: number;
  mapping: Array<{ header: string; indicator: string; column: number }>;
}

/** Find the first sheet whose name carries an "INFORM Risk [Mid] YYYY" year. */
export function parseInformEditionYear(
  sheetNames: readonly string[],
): { sheetName: string; editionYear: number } | null {
  for (const sheetName of sheetNames) {
    const match = INFORM_SHEET_YEAR_RE.exec(sheetName);
    if (match) return { sheetName, editionYear: Number(match[1]) };
  }
  return null;
}

/**
 * Map each expected header to its single column index. Throws if an expected
 * header is absent or appears more than once.
 */
export function resolveInformColumns(
  headers: readonly string[],
): Array<{ header: string; indicator: string; column: number }> {
  const normalized = headers.map((h) => String(h ?? '').replace(/\s+/g, ' ').trim());

  return INFORM_COLUMN_MAP.map(({ header, indicator }) => {
    const columns: number[] = [];
    normalized.forEach((value, index) => {
      if (value === header) columns.push(index);
    });
    if (columns.length === 0) {
      throw new InformSchemaError(`INFORM header "${header}" not found: the workbook layout changed`);
    }
    if (columns.length > 1) {
      throw new InformSchemaError(
        `INFORM header "${header}" is ambiguous (${columns.length} columns: ${columns.join(', ')})`,
      );
    }
    return { header, indicator, column: columns[0] };
  });
}

/** Locate the header row: the first of the top rows that contains an ISO3 cell. */
function findHeaderRow(rows: unknown[][]): number {
  const limit = Math.min(rows.length, 5);
  for (let r = 0; r < limit; r++) {
    if (rows[r].some((cell) => String(cell ?? '').trim().toUpperCase() === 'ISO3')) return r;
  }
  throw new InformSchemaError('INFORM: no ISO3 header row found in the first rows of the main sheet');
}

/**
 * Parse an INFORM Risk workbook buffer into per-country indicators stamped with the
 * edition year. Throws InformSchemaError on any layout problem.
 *
 * `minCountries` defaults to MIN_INFORM_COUNTRIES; tests lower it to run on small
 * synthetic workbooks.
 */
export function parseInformWorkbook(
  buffer: Buffer | Uint8Array,
  options: { minCountries?: number } = {},
): InformParseResult {
  const minCountries = options.minCountries ?? MIN_INFORM_COUNTRIES;
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const edition = parseInformEditionYear(workbook.SheetNames);
  if (!edition) {
    throw new InformSchemaError(
      `INFORM: no sheet named "INFORM Risk YYYY" (sheets: ${workbook.SheetNames.join(', ')})`,
    );
  }

  const sheet = workbook.Sheets[edition.sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: '', header: 1 });
  const headerRowIndex = findHeaderRow(rows);
  const headers = (rows[headerRowIndex] as unknown[]).map((cell) => String(cell ?? ''));

  const iso3Index = headers.findIndex((h) => h.trim().toUpperCase() === 'ISO3');
  const mapping = resolveInformColumns(headers);

  const dataDate = `${edition.editionYear}-01-01T00:00:00.000Z`;
  const indicators: RawIndicator[] = [];
  const countries = new Set<string>();
  let outOfRangeSkipped = 0;

  // Data starts after the header row. The "(0-10)" scale row is skipped because its
  // ISO3 cell is not a three-letter code.
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const iso3 = String(row[iso3Index] ?? '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iso3) || !getCountryByIso3(iso3)) continue;
    countries.add(iso3);

    for (const { indicator, column } of mapping) {
      const raw = row[column];
      const value = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''));
      if (!Number.isFinite(value)) continue;
      if (value < 0 || value > 10) {
        outOfRangeSkipped++;
        continue;
      }
      indicators.push({
        countryIso3: iso3,
        indicatorName: indicator,
        value,
        year: edition.editionYear,
        source: 'inform',
        dataDate,
      });
    }
  }

  if (countries.size < minCountries) {
    throw new InformSchemaError(
      `INFORM: only ${countries.size} countries parsed (expected at least ${minCountries})`,
    );
  }

  return {
    indicators,
    sheetName: edition.sheetName,
    editionYear: edition.editionYear,
    countries: countries.size,
    outOfRangeSkipped,
    mapping,
  };
}
