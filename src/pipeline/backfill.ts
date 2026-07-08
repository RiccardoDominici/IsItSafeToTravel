/**
 * Historical backfill script.
 *
 * Re-scores all historical snapshots from raw data using the current
 * weights configuration and scoring engine. This ensures consistency
 * across all dates when weights or normalization logic changes.
 *
 * Usage: npx tsx src/pipeline/backfill.ts [--dry-run]
 */

import { computeAllScores } from './scoring/engine.js';
import { writeSnapshot } from './scoring/snapshot.js';
import { writeHistoryIndex } from './scoring/history.js';
import { readJson, writeJson, getRawDir, getScoresDir, findLatestCached } from './utils/fs.js';
import { parseGpiExcelAllYears, selectGpiIndicatorsForYear, deserializeGpiByYear } from './fetchers/gpi.js';
import { getCountryByIso3 } from './config/countries.js';
import type { WeightsConfig, RawSourceData, FetchResult, RawIndicator } from './types.js';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface BackfillResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ date: string; error: string }>;
}

/**
 * Load all parsed raw data for a given date directory.
 */
/**
 * Check if a source's fetchedAt timestamp is consistent with the date directory.
 * Advisory data fetched on 2026-03-20 should NOT be used for a 2012 snapshot.
 * Allows up to 7 days of tolerance for pipeline timing differences.
 */
function isFetchedAtConsistent(fetchedAt: string, directoryDate: string, toleranceDays = 7): boolean {
  const fetchDate = new Date(fetchedAt);
  const dirDate = new Date(directoryDate);
  const diffMs = Math.abs(fetchDate.getTime() - dirDate.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= toleranceDays;
}

// Sources whose raw files carry true per-year vintages (the indicators' own `year`
// field matches the directory date), as opposed to sources that only ever hold
// CURRENT data (advisories, INFORM). worldbank has always been year-based; vdem's
// historical raw files (data/raw/<date>/vdem-parsed.json for each backfilled date)
// are ALSO vintage-per-file (quick-260706-x81 SHIP-SPEC 1.3) but were previously
// skipped here because their fetchedAt (when the vdem backfill ran) doesn't match
// the directory date — fixed by adding 'vdem' below. GPI is handled separately by
// injectGpiForDate() (per-year selection from the workbook's full history), so it
// is intentionally NOT in this set.
const YEAR_BASED_SOURCES = new Set(['worldbank', 'vdem']);

function loadRawDataForDate(date: string): Map<string, RawSourceData> | null {
  const rawDir = getRawDir(date);
  if (!existsSync(rawDir)) return null;

  const rawDataMap = new Map<string, RawSourceData>();
  const parsedFiles = readdirSync(rawDir).filter((f) => f.endsWith('-parsed.json'));

  for (const file of parsedFiles) {
    const filePath = join(rawDir, file);
    const data = readJson<RawSourceData>(filePath);
    if (data) {
      // Only worldbank/vdem data is truly historical — their indicators have
      // per-year values (year field matches the directory date). All other
      // sources (INFORM, advisories, GPI, etc.) in historical directories
      // contain CURRENT data fetched recently and must be skipped if fetchedAt
      // doesn't match the directory date.
      const isYearBased = YEAR_BASED_SOURCES.has(data.source);

      if (!isYearBased && data.fetchedAt && !isFetchedAtConsistent(data.fetchedAt, date)) {
        continue;
      }
      rawDataMap.set(data.source, data);
    }
  }

  injectGpiForDate(date, rawDataMap);
  injectUcdpForDate(date, rawDataMap);
  injectWorldbankHistoryForDate(date, rawDataMap);

  return rawDataMap.size > 0 ? rawDataMap : null;
}

// Cache parsed {year -> indicators} maps per gpi.xlsx path — there are only ~27
// distinct workbook files across 668 snapshot dates, and every one holds the
// FULL 2008-2023 history, so parsing each file once and reusing it is safe and
// avoids re-parsing the same workbook hundreds of times during a full backfill.
const gpiByYearCache = new Map<string, Map<number, RawIndicator[]>>();

function loadGpiByYear(xlsxPath: string): Map<number, RawIndicator[]> {
  let cached = gpiByYearCache.get(xlsxPath);
  if (!cached) {
    cached = parseGpiExcelAllYears(readFileSync(xlsxPath));
    gpiByYearCache.set(xlsxPath, cached);
  }
  return cached;
}

// v9.1 (D3): cache for the JSON-sourced (IEP GPI-2026 edition) all-years table
// persisted by gpi.ts's fetchGpi (gpi-json-all-years.json), same parse-once
// discipline as gpiByYearCache above.
const gpiJsonByYearCache = new Map<string, Map<number, RawIndicator[]>>();

function loadGpiJsonByYear(jsonPath: string): Map<number, RawIndicator[]> {
  let cached = gpiJsonByYearCache.get(jsonPath);
  if (!cached) {
    const obj = readJson<Record<string, RawIndicator[]>>(jsonPath);
    cached = obj ? deserializeGpiByYear(obj) : new Map<number, RawIndicator[]>();
    gpiJsonByYearCache.set(jsonPath, cached);
  }
  return cached;
}

/**
 * Inject GPI (gpi_overall / gpi_safety_security / gpi_militarisation) indicators
 * for a snapshot date into rawDataMap, selecting the historically-correct vintage
 * (SHIP-SPEC 1.3): year = min(snapshotYear, latest year available), sourced from
 * TWO tables merged together — the xlsx-derived table (broad 2008-2023 historical
 * coverage) as the base, with the JSON-derived table (v9.1 D3: IEP GPI-2026
 * edition, all published years, retroactive revisions) OVERLAID on top (JSON
 * wins for any year present in both, since it reflects the CURRENT edition vs
 * the frozen 2023 xlsx snapshot). Each table is sourced from the date's OWN
 * gpi.xlsx/gpi-json-all-years.json when present, else deterministically the
 * NEWEST one across all data/raw dirs (every published file carries the full
 * history, so the choice of file only affects availability, never which year
 * is selected). Replaces whatever 'gpi' entry loadRawDataForDate already
 * loaded — preserving the one-value-per-indicator-per-country contract.
 */
function injectGpiForDate(date: string, rawDataMap: Map<string, RawSourceData>): void {
  const ownXlsxPath = join(getRawDir(date), 'gpi.xlsx');
  const xlsxPath = existsSync(ownXlsxPath) ? ownXlsxPath : findLatestCached('gpi.xlsx');
  const xlsxByYear = xlsxPath ? loadGpiByYear(xlsxPath) : new Map<number, RawIndicator[]>();

  const ownJsonPath = join(getRawDir(date), 'gpi-json-all-years.json');
  const jsonPath = existsSync(ownJsonPath) ? ownJsonPath : findLatestCached('gpi-json-all-years.json');
  const jsonByYear = jsonPath ? loadGpiJsonByYear(jsonPath) : new Map<number, RawIndicator[]>();

  const mergedByYear = new Map<number, RawIndicator[]>(xlsxByYear);
  for (const [year, indicators] of jsonByYear) mergedByYear.set(year, indicators); // JSON wins on overlap
  if (mergedByYear.size === 0) return; // neither source available yet — leave rawDataMap as-is

  const snapshotYear = parseInt(date.slice(0, 4), 10);
  const indicators = selectGpiIndicatorsForYear(mergedByYear, snapshotYear);
  if (indicators.length === 0) return;

  rawDataMap.set('gpi', {
    source: 'gpi',
    fetchedAt: new Date(`${date}T00:00:00.000Z`).toISOString(),
    indicators,
  });
}

// =============================================================================
// v9.1 (SHIP-SPEC 1.3) — UCDP conflict-deaths vintage injection.
//
// ucdp-parsed.json (from ucdp.ts's fetchUcdp) is a SINGLE consolidated file
// holding ALL years 1989-latest for every project country OWID/UCDP covers
// (verified: every one of the 196 covered countries has full 1989-2025
// coverage, unlike homicide/population which have real per-country gaps — see
// injectWorldbankHistoryForDate below for the per-country variant). This
// mirrors the GPI injection pattern EXACTLY: group by year (parse once,
// cached), select ONE global year = min(snapshotYear, latest year present),
// replace rawDataMap's 'ucdp' entry with that single vintage.
//
// MUST also be called from run.ts Stage 2 (after the *-parsed.json load loop)
// — a freshly-fetched ucdp-parsed.json for TODAY's date already contains ALL
// years, so without this injection the engine's rawByName Map.set would keep
// an ARBITRARY year's row per country (whichever happens to iterate last).
// =============================================================================

const ucdpByYearCache = new Map<string, Map<number, RawIndicator[]>>();

/** Group a consolidated ucdp-parsed.json's indicators by year (parse-once, cached by file path). */
export function loadUcdpByYear(jsonPath: string): Map<number, RawIndicator[]> {
  let cached = ucdpByYearCache.get(jsonPath);
  if (!cached) {
    cached = new Map<number, RawIndicator[]>();
    const data = readJson<RawSourceData>(jsonPath);
    if (data) {
      for (const ind of data.indicators) {
        if (!cached.has(ind.year)) cached.set(ind.year, []);
        cached.get(ind.year)!.push(ind);
      }
    }
    ucdpByYearCache.set(jsonPath, cached);
  }
  return cached;
}

/** Select the UCDP indicator set for a snapshot year: year = min(snapshotYear, latest available year). Mirrors selectGpiIndicatorsForYear exactly. */
export function selectUcdpIndicatorsForYear(
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

/**
 * Inject a single-vintage-per-country UCDP dataset for a snapshot date,
 * REPLACING whatever loadRawDataForDate's generic loop already put in
 * rawDataMap's 'ucdp' slot (which, if present at all, is the raw ALL-YEARS
 * file — arbitrary/wrong for scoring). Sourced from the date's OWN
 * ucdp-parsed.json when present, else deterministically the NEWEST one across
 * all data/raw dirs (every consolidated file carries the full history, so the
 * choice of file only affects availability, never which year is selected).
 */
export function injectUcdpForDate(date: string, rawDataMap: Map<string, RawSourceData>): void {
  const ownJsonPath = join(getRawDir(date), 'ucdp-parsed.json');
  const jsonPath = existsSync(ownJsonPath) ? ownJsonPath : findLatestCached('ucdp-parsed.json');
  if (!jsonPath) return; // no ucdp-parsed.json anywhere yet — leave rawDataMap as-is

  const byYear = loadUcdpByYear(jsonPath);
  const snapshotYear = parseInt(date.slice(0, 4), 10);
  const indicators = selectUcdpIndicatorsForYear(byYear, snapshotYear);
  if (indicators.length === 0) return;

  rawDataMap.set('ucdp', {
    source: 'ucdp',
    fetchedAt: new Date(`${date}T00:00:00.000Z`).toISOString(),
    indicators,
  });
}

// =============================================================================
// v9.1 (SHIP-SPEC 1.3, round-2 F1) — WB homicide + population historical
// injection. Unlike GPI/UCDP (one "edition" covers every country uniformly per
// year), WB VC.IHR.PSRC.P5/SP.POP.TOTL have REAL per-country data gaps (a
// country's most recent homicide reading might be 2021 while another's is
// 2023) — so selection here is PER-COUNTRY, mirroring
// prototype-scorer-v91.mjs's buildLatestMap/loadPopMap exactly: for each
// country, year = largest available <= snapshotYear, falling back to that
// country's EARLIEST available year if every row postdates snapshotYear.
//
// Historical worldbank-parsed.json files predate homicide/population entirely
// (both are NEW v9.1 indicators — see worldbank.ts) — this backfills them in.
// 'worldbank' stays in YEAR_BASED_SOURCES; this function MERGES into whatever
// per-date worldbank RawSourceData is already loaded, WITHOUT touching its
// existing wb_child_mortality/wb_air_pollution rows.
// =============================================================================

const WB_HISTORY_CACHE_PATH = join(process.cwd(), 'data', 'raw', 'wb-history-homicide-population.json');
const WB_HISTORY_INDICATORS: Array<{ wbCode: string; name: 'wb_homicide' | 'wb_population' }> = [
  { wbCode: 'VC.IHR.PSRC.P5', name: 'wb_homicide' },
  { wbCode: 'SP.POP.TOTL', name: 'wb_population' },
];

interface WbHistoryTable {
  homicide: RawIndicator[];
  population: RawIndicator[];
}

let wbHistoryTable: WbHistoryTable | null = null;

/** Bulk (non-mrnev) fetch of ONE WB indicator's FULL history (1989-current year), all project countries. */
async function fetchWbFullHistoryIndicator(wbCode: string, indicatorName: string): Promise<RawIndicator[]> {
  const currentYear = new Date().getFullYear();
  const url = `https://api.worldbank.org/v2/country/all/indicator/${wbCode}?format=json&per_page=20000&date=1989:${currentYear}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${wbCode}: HTTP ${response.status}`);
  const json = await response.json();
  if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) return [];

  const entries = json[1] as Array<Record<string, unknown>>;
  const out: RawIndicator[] = [];
  for (const entry of entries) {
    const iso3 = String(entry.countryiso3code || '').toUpperCase();
    const value = entry.value;
    const year = Number(entry.date);
    if (!iso3 || value === null || value === undefined || !Number.isFinite(year)) continue;
    if (!getCountryByIso3(iso3)) continue;
    const numValue = Number(value);
    if (isNaN(numValue)) continue;
    out.push({
      countryIso3: iso3,
      indicatorName,
      value: numValue,
      year,
      source: 'worldbank',
      dataDate: `${year}-01-01T00:00:00.000Z`,
    });
  }
  return out;
}

/**
 * MUST be awaited ONCE before any loadRawDataForDate() call relies on
 * injectWorldbankHistoryForDate (i.e. before backfill or the parity gate
 * runs) — fetches both indicators' full history in one bulk call each,
 * caches in-memory + persists to disk, and falls back to the persisted cache
 * if the live fetch fails (documented resilience per SHIP-SPEC: "momentarily
 * unreachable" sources use the last-known-good cache, never block the run).
 */
export async function preloadWbHistoryTable(): Promise<void> {
  if (wbHistoryTable) return;
  try {
    const [homicide, population] = await Promise.all(
      WB_HISTORY_INDICATORS.map((ind) => fetchWbFullHistoryIndicator(ind.wbCode, ind.name)),
    );
    if (homicide.length === 0 && population.length === 0) {
      throw new Error('empty bulk WB history response for both indicators');
    }
    wbHistoryTable = { homicide, population };
    writeJson(WB_HISTORY_CACHE_PATH, wbHistoryTable);
    console.log(
      `[BACKFILL] WB full-history table: ${homicide.length} homicide rows (${new Set(homicide.map((h) => h.countryIso3)).size} countries), ` +
        `${population.length} population rows (${new Set(population.map((p) => p.countryIso3)).size} countries) — fetched live, cached to ${WB_HISTORY_CACHE_PATH}`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[BACKFILL] WB full-history live fetch failed (${msg}) — trying cached table at ${WB_HISTORY_CACHE_PATH}`);
    const cached = readJson<WbHistoryTable>(WB_HISTORY_CACHE_PATH);
    if (cached) {
      wbHistoryTable = cached;
      console.warn(
        `[BACKFILL] Using cached WB full-history table (${cached.homicide.length} homicide rows, ${cached.population.length} population rows)`,
      );
    } else {
      console.error(
        '[BACKFILL] No WB full-history table available (live fetch failed, no cache) — wb_homicide/wb_population will NOT be injected for historical dates',
      );
      wbHistoryTable = { homicide: [], population: [] };
    }
  }
}

/**
 * Per-country vintage selection mirroring prototype-scorer-v91.mjs's
 * buildLatestMap: for each country, year = largest available <= snapshotYear;
 * falls back to that country's EARLIEST available year if every row postdates
 * snapshotYear (keeps very-old backfill dates, e.g. 2012, populated once the
 * country's data series eventually begins, rather than empty).
 */
function selectPerCountryVintage(rows: RawIndicator[], snapshotYear: number): RawIndicator[] {
  const byIso3 = new Map<string, RawIndicator>();
  const earliestFallback = new Map<string, RawIndicator>();
  for (const ind of rows) {
    const existingEarliest = earliestFallback.get(ind.countryIso3);
    if (!existingEarliest || ind.year < existingEarliest.year) earliestFallback.set(ind.countryIso3, ind);
    if (ind.year > snapshotYear) continue;
    const selected = byIso3.get(ind.countryIso3);
    if (!selected || ind.year > selected.year) byIso3.set(ind.countryIso3, ind);
  }
  for (const [iso3, ind] of earliestFallback) {
    if (!byIso3.has(iso3)) byIso3.set(iso3, ind); // every available year postdates snapshotYear
  }
  return [...byIso3.values()];
}

/**
 * Merge per-country-vintage-selected wb_homicide + wb_population into the
 * date's 'worldbank' RawSourceData, WITHOUT clobbering its existing
 * wb_child_mortality/wb_air_pollution rows (or, for TODAY's date, its own
 * mrnev=1-fetched wb_homicide/wb_population — this REPLACES those with the
 * bulk-table-selected equivalents, which select the exact same "most recent"
 * data point via a different but equivalent method, so the values match).
 * No-op if preloadWbHistoryTable() was never awaited (wbHistoryTable is null).
 */
function injectWorldbankHistoryForDate(date: string, rawDataMap: Map<string, RawSourceData>): void {
  if (!wbHistoryTable) return;
  const snapshotYear = parseInt(date.slice(0, 4), 10);
  const homicideSelected = selectPerCountryVintage(wbHistoryTable.homicide, snapshotYear);
  const populationSelected = selectPerCountryVintage(wbHistoryTable.population, snapshotYear);
  if (homicideSelected.length === 0 && populationSelected.length === 0) return;

  const existing = rawDataMap.get('worldbank');
  const preservedIndicators = existing
    ? existing.indicators.filter((ind) => ind.indicatorName !== 'wb_homicide' && ind.indicatorName !== 'wb_population')
    : [];

  rawDataMap.set('worldbank', {
    source: 'worldbank',
    fetchedAt: existing?.fetchedAt ?? new Date(`${date}T00:00:00.000Z`).toISOString(),
    indicators: [...preservedIndicators, ...homicideSelected, ...populationSelected],
  });
}

/**
 * List all date directories under data/raw/ sorted ascending.
 */
function listRawDates(): string[] {
  const rawBase = join(process.cwd(), 'data', 'raw');
  if (!existsSync(rawBase)) return [];

  return readdirSync(rawBase)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
}

/**
 * Run historical backfill: re-score all dates from raw data.
 */
async function runBackfill(dryRun: boolean = false): Promise<BackfillResult> {
  const result: BackfillResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // Load weights config
  const weightsPath = join(process.cwd(), 'src/pipeline/config/weights.json');
  const weightsConfig = readJson<WeightsConfig>(weightsPath);
  if (!weightsConfig) {
    console.error('FATAL: Could not load weights config from', weightsPath);
    process.exit(1);
  }

  console.log(`=== Historical Backfill (weights v${weightsConfig.version}) ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  // v9.1 (SHIP-SPEC 1.3): preload the WB homicide/population full-history
  // table ONCE before the per-date loop — loadRawDataForDate() is synchronous
  // and calls injectWorldbankHistoryForDate() per date, which reads this cache.
  await preloadWbHistoryTable();

  const dates = listRawDates();
  result.total = dates.length;
  console.log(`Found ${dates.length} raw data directories to process\n`);

  let processed = 0;

  for (const date of dates) {
    processed++;
    const rawDataMap = loadRawDataForDate(date);

    if (!rawDataMap) {
      result.skipped++;
      if (processed % 100 === 0 || processed === dates.length) {
        console.log(`  [${processed}/${dates.length}] ${date} - SKIPPED (no parsable raw data)`);
      }
      continue;
    }

    try {
      const scoredCountries = computeAllScores(rawDataMap, weightsConfig);

      if (!dryRun) {
        // Build minimal fetch results for snapshot compatibility
        const fetchResults: FetchResult[] = Array.from(rawDataMap.keys()).map((source) => ({
          source,
          success: true,
          countriesFound: rawDataMap.get(source)!.indicators.length,
          fetchedAt: new Date().toISOString(),
        }));

        writeSnapshot(date, scoredCountries, fetchResults, weightsConfig.version);
      }

      result.succeeded++;

      // Progress every 50 dates
      if (processed % 50 === 0 || processed === dates.length) {
        console.log(
          `  [${processed}/${dates.length}] ${date} - ${scoredCountries.length} countries scored`,
        );
      }
    } catch (err) {
      result.failed++;
      const errorMsg = err instanceof Error ? err.message : String(err);
      result.errors.push({ date, error: errorMsg });
      console.error(`  [${processed}/${dates.length}] ${date} - FAILED: ${errorMsg}`);
    }
  }

  // Rebuild history index after all snapshots updated
  if (!dryRun) {
    console.log('\n--- Rebuilding history-index.json ---');
    const historyIndex = writeHistoryIndex();
    console.log(
      `History index rebuilt: ${historyIndex.global.length} dates, ${Object.keys(historyIndex.countries).length} countries`,
    );
  }

  // Summary
  console.log(`\n=== Backfill Complete ===`);
  console.log(`Total: ${result.total}`);
  console.log(`Succeeded: ${result.succeeded}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Skipped: ${result.skipped}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors:`);
    for (const { date, error } of result.errors) {
      console.log(`  ${date}: ${error}`);
    }
  }

  return result;
}

// Auto-run when executed directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('backfill.ts');

if (isMainModule) {
  const dryRun = process.argv.includes('--dry-run');
  runBackfill(dryRun)
    .then((result) => {
      if (result.failed > 0) process.exit(1);
    })
    .catch((err) => {
      console.error('Backfill failed:', err);
      process.exit(2);
    });
}

export { runBackfill, listRawDates, loadRawDataForDate };
