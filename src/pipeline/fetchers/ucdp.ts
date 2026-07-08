import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByIso3 } from '../config/countries.js';
import { join } from 'node:path';

/**
 * UCDP (Uppsala Conflict Data Program) GED conflict-deaths fetcher — NEW in v9.1
 * (SHIP-SPEC 1.1b, D2). Sourced from the OWID grapher mirror (CC-BY) rather than
 * hitting UCDP's own API directly — OWID pre-aggregates per-country-year totals
 * from the raw GED event data and ships them as simple CSVs.
 *
 * Three conflict-type CSVs are summed per (iso3, year): interstate + intrastate +
 * one-sided violence. Non-state conflict deaths are EXCLUDED (design D2 — cartel/
 * gang violence between non-state actors is a different phenomenon the formula
 * does not want conflated with state-involved armed conflict).
 *
 * Attribution: Uppsala Conflict Data Program (UCDP) via Our World in Data mirror,
 * CC-BY. https://ourworldindata.org/grapher/deaths-in-interstate-conflicts
 */

const OWID_CSV_BASE = 'https://ourworldindata.org/grapher';

interface UcdpCsvSpec {
  slug: string;
  column: string;
}

const UCDP_CSVS: UcdpCsvSpec[] = [
  { slug: 'deaths-in-interstate-conflicts', column: 'number_deaths_ongoing_conflicts__conflict_type_interstate' },
  { slug: 'deaths-in-intrastate-conflicts', column: 'number_deaths_ongoing_conflicts__conflict_type_intrastate' },
  { slug: 'deaths-from-one-sided-violence', column: 'number_deaths_ongoing_conflicts__conflict_type_one_sided_violence' },
];

const MIN_YEAR = 1989;

/** Minimal CSV parser sufficient for OWID's simple entity,code,year,<col> grapher exports. */
function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(',');
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < header.length) continue;
    const rec: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) rec[header[j]] = cols[j];
    rows.push(rec);
  }
  return rows;
}

/** Fetch and sum one OWID conflict-deaths CSV into a (iso3, year) -> deaths map. */
async function fetchOwidCsv(spec: UcdpCsvSpec): Promise<Map<string, number>> {
  const url = `${OWID_CSV_BASE}/${spec.slug}.csv?csvType=full&useColumnShortNames=true`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`${spec.slug}: HTTP ${response.status}`);
  }
  const text = await response.text();
  const rows = parseCsv(text);

  const out = new Map<string, number>();
  for (const row of rows) {
    const iso3 = (row.code || '').trim().toUpperCase();
    if (!iso3 || !getCountryByIso3(iso3)) continue; // filters project countries + OWID aggregate/region codes

    const year = parseInt(row.year, 10);
    if (!Number.isFinite(year) || year < MIN_YEAR) continue;

    const raw = row[spec.column];
    if (raw === undefined || raw === '') continue;
    const val = Number(raw);
    if (!Number.isFinite(val) || isNaN(val)) continue;

    const key = `${iso3}|${year}`;
    out.set(key, (out.get(key) ?? 0) + val);
  }
  return out;
}

/** Sum the three conflict-type maps into one consolidated (iso3, year) -> total-deaths map. */
function sumConflictMaps(maps: Map<string, number>[]): Map<string, number> {
  const total = new Map<string, number>();
  for (const m of maps) {
    for (const [key, val] of m) {
      total.set(key, (total.get(key) ?? 0) + val);
    }
  }
  return total;
}

export async function fetchUcdp(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  try {
    console.log('[UCDP] Fetching OWID/UCDP GED conflict-deaths mirror (interstate + intrastate + one-sided)...');

    const results = await Promise.all(UCDP_CSVS.map((spec) => fetchOwidCsv(spec)));
    const totals = sumConflictMaps(results);

    if (totals.size === 0) {
      throw new Error('All 3 OWID conflict-deaths CSVs returned 0 project-country rows');
    }

    const indicators: RawIndicator[] = [];
    for (const [key, deaths] of totals) {
      const [iso3, yearStr] = key.split('|');
      indicators.push({
        countryIso3: iso3,
        indicatorName: 'ucdp_conflict_deaths',
        value: deaths,
        year: Number(yearStr),
        source: 'ucdp',
        dataDate: `${yearStr}-01-01T00:00:00.000Z`,
      });
    }

    const sourceData: RawSourceData = {
      source: 'ucdp',
      fetchedAt,
      indicators,
    };
    writeJson(join(rawDir, 'ucdp-parsed.json'), sourceData);

    const uniqueCountries = new Set(indicators.map((i) => i.countryIso3));
    const years = indicators.map((i) => i.year);
    console.log(
      `[UCDP] ${uniqueCountries.size} countries, ${indicators.length} country-year rows, years ${Math.min(...years)}-${Math.max(...years)}`,
    );

    return {
      source: 'ucdp',
      success: true,
      countriesFound: uniqueCountries.size,
      fetchedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[UCDP] Fetch failed: ${errorMessage}`);

    const cached = findLatestCached('ucdp-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[UCDP] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'ucdp-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'ucdp',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Original error: ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'ucdp',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }
}
