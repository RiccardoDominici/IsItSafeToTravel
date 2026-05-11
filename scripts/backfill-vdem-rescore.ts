/**
 * Backfill V-Dem governance indicators into every historical snapshot, then
 * rescore each snapshot under weights.json v8.1.0.
 *
 * Strategy:
 *   Step A — Validate the new fetcher against today's date (2026-05-11) by
 *            invoking fetchVdem directly and verifying USA has a vdem_rule_of_law
 *            indicator. The validated fetch becomes the canonical 2026 V-Dem
 *            payload reused below.
 *   Step B — Group all data/scores/YYYY-MM-DD.json by year. For each year Y, call
 *            fetchVdem(firstDate) which writes data/raw/{firstDate}/vdem-parsed.json
 *            with targetYear = Y (the fetcher picks min(Y, 2025) automatically — for
 *            Y=2026 this returns V-Dem's latest 2025 data; see vdem.test.ts case (g)).
 *            Then copy that file into every other snapshot date in the same year.
 *   Step C — For each snapshot D in chronological order:
 *              * Read data/scores/{D}.json. If weightsVersion === "8.1.0", SKIP
 *                (resume gate — makes the script idempotent and retry-safe).
 *              * Otherwise: load all existing data/raw/{D}/*-parsed.json files,
 *                call computeAllScores() with the new v8.1.0 weights, and
 *                writeSnapshot(D, ...) with weightsVersion = "8.1.0".
 *                We intentionally DO NOT call runPipeline(D) because runPipeline
 *                re-fetches all sources (which would (a) apply 2026 advisories to
 *                a 2012 snapshot — incorrect, and (b) take ~3-5s per source × 13
 *                sources × 611 snapshots = many hours). Reusing the cached parsed
 *                JSON in data/raw/{D}/ preserves the original year-appropriate
 *                indicator values for every source EXCEPT vdem (which we just
 *                wrote in Step B).
 *   Step D — Call writeHistoryIndex() to regenerate data/scores/history-index.json.
 *
 * Run commands:
 *
 *   # First run (full backfill, ~10-30 min wall-clock for 611 snapshots):
 *   npx tsx scripts/backfill-vdem-rescore.ts
 *
 *   # Re-run (idempotent, ~10s — skips snapshots already at weightsVersion=8.1.0):
 *   npx tsx scripts/backfill-vdem-rescore.ts
 *
 *   # Force full re-rescore: bump weights.json version OR delete the
 *   # data/scores/*.json files you want rebuilt.
 *
 * Single-threaded only — the snapshot writer is not concurrency-safe.
 * Errors on a single snapshot are logged but do not abort the run.
 */

import { readdirSync, existsSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchVdem } from '../src/pipeline/fetchers/vdem.js';
import { computeAllScores } from '../src/pipeline/scoring/engine.js';
import { writeSnapshot } from '../src/pipeline/scoring/snapshot.js';
import { writeHistoryIndex } from '../src/pipeline/scoring/history.js';
import { readJson } from '../src/pipeline/utils/fs.js';
import type { WeightsConfig, RawSourceData, FetchResult } from '../src/pipeline/types.js';

const SCORES_DIR = join(process.cwd(), 'data', 'scores');
const RAW_DIR = join(process.cwd(), 'data', 'raw');
const TARGET_WEIGHTS_VERSION = '8.1.0';

interface SnapshotEnvelope {
  weightsVersion?: string;
}

function readWeightsVersion(date: string): string | undefined {
  const path = join(SCORES_DIR, `${date}.json`);
  if (!existsSync(path)) return undefined;
  try {
    const json = JSON.parse(readFileSync(path, 'utf-8')) as SnapshotEnvelope;
    return json.weightsVersion;
  } catch {
    return undefined;
  }
}

/**
 * Rescore a single snapshot from existing data/raw/{date}/*-parsed.json files.
 * Returns true on success, false on failure.
 */
function rescoreSnapshot(date: string, weightsConfig: WeightsConfig): boolean {
  const rawDir = join(RAW_DIR, date);
  if (!existsSync(rawDir)) {
    console.warn(`  ${date}: data/raw/${date}/ missing — skipping`);
    return false;
  }

  // Load every *-parsed.json file. The cached data preserves the original
  // year-appropriate values for every source; vdem-parsed.json was just
  // refreshed in Step B with year-Y V-Dem data.
  const rawDataMap = new Map<string, RawSourceData>();
  const parsedFiles = readdirSync(rawDir).filter((f) => f.endsWith('-parsed.json'));
  for (const file of parsedFiles) {
    const filePath = join(rawDir, file);
    const data = readJson<RawSourceData>(filePath);
    if (data) rawDataMap.set(data.source, data);
  }

  if (rawDataMap.size === 0) {
    console.warn(`  ${date}: no parsed JSON files found in raw dir — skipping`);
    return false;
  }

  // Synthesize FetchResult entries from the parsed data so the snapshot
  // envelope's fetchResults stays accurate for the rescore step.
  const fetchResults: FetchResult[] = [];
  for (const [source, sourceData] of rawDataMap) {
    const uniqueCountries = new Set(sourceData.indicators.map((i) => i.countryIso3));
    fetchResults.push({
      source,
      success: true,
      countriesFound: uniqueCountries.size,
      fetchedAt: sourceData.fetchedAt,
    });
  }

  const scoredCountries = computeAllScores(rawDataMap, weightsConfig);
  writeSnapshot(date, scoredCountries, fetchResults, weightsConfig.version);
  return true;
}

async function main() {
  const startTime = Date.now();
  console.log('=== V-Dem rescore backfill ===');
  console.log(`Target weightsVersion: ${TARGET_WEIGHTS_VERSION}`);

  // Load weights config once.
  const weightsPath = join(process.cwd(), 'src/pipeline/config/weights.json');
  const weightsConfig = readJson<WeightsConfig>(weightsPath);
  if (!weightsConfig) {
    console.error('FATAL: could not load weights config');
    process.exit(1);
  }
  if (weightsConfig.version !== TARGET_WEIGHTS_VERSION) {
    console.error(`FATAL: weights.json version is ${weightsConfig.version}, expected ${TARGET_WEIGHTS_VERSION}`);
    process.exit(1);
  }
  console.log(`Loaded weights v${weightsConfig.version}`);
  console.log('');

  // ----- Step A: validate fetcher end-to-end -----
  console.log('--- Step A: Validate V-Dem fetcher against today ---');
  const todayDate = new Date().toISOString().slice(0, 10);
  const todayResult = await fetchVdem(todayDate);
  if (!todayResult.success) {
    console.error(`FATAL: fetchVdem(${todayDate}) failed: ${todayResult.error}`);
    process.exit(1);
  }
  const todayParsedPath = join(RAW_DIR, todayDate, 'vdem-parsed.json');
  if (!existsSync(todayParsedPath)) {
    console.error(`FATAL: ${todayParsedPath} does not exist after fetch`);
    process.exit(1);
  }
  const todayParsed = JSON.parse(readFileSync(todayParsedPath, 'utf-8')) as {
    indicators: Array<{ countryIso3: string; indicatorName: string }>;
  };
  const hasUsaRoL = todayParsed.indicators.some(
    (i) => i.countryIso3 === 'USA' && i.indicatorName === 'vdem_rule_of_law',
  );
  if (!hasUsaRoL) {
    console.error('FATAL: USA vdem_rule_of_law missing from today\'s fetch');
    process.exit(1);
  }
  console.log(`  Step A OK: ${todayResult.countriesFound} countries fetched, USA vdem_rule_of_law present`);
  console.log('');

  // ----- Enumerate snapshot dates -----
  const allDates = readdirSync(SCORES_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace('.json', ''))
    .sort();
  console.log(`Found ${allDates.length} snapshot dates`);

  // Group by year
  const byYear = new Map<number, string[]>();
  for (const date of allDates) {
    const year = parseInt(date.slice(0, 4), 10);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(date);
  }
  console.log(`Years: ${[...byYear.keys()].sort((a, b) => a - b).join(', ')}`);
  console.log('');

  // ----- Step B: per-year V-Dem fetch + intra-year copy -----
  console.log('--- Step B: per-year V-Dem fetch ---');
  for (const [year, yearDates] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const firstDate = yearDates[0];
    const firstParsedPath = join(RAW_DIR, firstDate, 'vdem-parsed.json');

    let needFetch = !existsSync(firstParsedPath);
    if (existsSync(firstParsedPath)) {
      try {
        const existing = JSON.parse(readFileSync(firstParsedPath, 'utf-8')) as {
          indicators: Array<{ year: number }>;
        };
        const maxYear = existing.indicators.reduce((m, i) => Math.max(m, i.year), 0);
        // Refetch only if cached data has a max year > Y AND Y < 2025 (i.e. we'd
        // be applying future data). For Y >= 2025 the fetcher naturally caps at
        // V-Dem v16's 2025 ceiling, so any cached max year <= 2025 is fine.
        if (maxYear > year && year < 2025) {
          console.log(`  ${year}: cached firstDate has year ${maxYear} > ${year}, refetching`);
          needFetch = true;
        } else {
          console.log(`  ${year}: reusing existing ${firstParsedPath} (max year ${maxYear})`);
        }
      } catch {
        needFetch = true;
      }
    }

    if (needFetch) {
      console.log(`  ${year}: fetchVdem(${firstDate})...`);
      const r = await fetchVdem(firstDate);
      if (!r.success) {
        console.warn(`  ${year}: fetchVdem failed: ${r.error} — continuing with cache fallback if available`);
      } else {
        console.log(`  ${year}: ${r.countriesFound} countries`);
      }
    }

    if (!existsSync(firstParsedPath)) {
      console.warn(`  ${year}: no vdem-parsed.json available, skipping intra-year copy`);
      continue;
    }
    for (let i = 1; i < yearDates.length; i++) {
      const date = yearDates[i];
      const dateRawDir = join(RAW_DIR, date);
      if (!existsSync(dateRawDir)) mkdirSync(dateRawDir, { recursive: true });
      const destPath = join(dateRawDir, 'vdem-parsed.json');
      copyFileSync(firstParsedPath, destPath);
    }
  }
  console.log('');

  // ----- Step C: rescore each snapshot with resume gate -----
  console.log('--- Step C: rescore each snapshot (resume gate active) ---');
  let rescored = 0;
  let skipped = 0;
  let failed = 0;
  const failures: Array<{ date: string; error: string }> = [];

  for (let idx = 0; idx < allDates.length; idx++) {
    const date = allDates[idx];

    // Resume gate: skip if already at target weightsVersion.
    const currentVersion = readWeightsVersion(date);
    if (currentVersion === TARGET_WEIGHTS_VERSION) {
      skipped++;
      continue;
    }

    try {
      const ok = rescoreSnapshot(date, weightsConfig);
      if (ok) rescored++;
      else {
        failed++;
        failures.push({ date, error: 'rescoreSnapshot returned false' });
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ date, error: msg });
      console.warn(`  FAIL: ${date} — ${msg}`);
    }

    if ((rescored + failed) > 0 && (rescored + failed) % 25 === 0) {
      const elapsedS = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  progress: ${idx + 1}/${allDates.length} (rescored=${rescored}, skipped=${skipped}, failed=${failed}) — ${elapsedS}s elapsed`);
    }
  }
  console.log('');

  // ----- Step D: regenerate history index -----
  console.log('--- Step D: regenerate history index ---');
  writeHistoryIndex();
  console.log('');

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('=== Backfill complete ===');
  console.log(`Rescored ${rescored}/${allDates.length} snapshots, skipped ${skipped} already-${TARGET_WEIGHTS_VERSION}, failed ${failed}, took ${totalSec}s`);

  if (failures.length > 0) {
    console.log('');
    console.log(`Failures (${failures.length}):`);
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.date}: ${f.error}`);
    }
    if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
  }
}

main().catch((err) => {
  console.error('Backfill script crashed:', err);
  process.exit(2);
});
