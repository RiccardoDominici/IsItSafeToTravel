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
import { readJson, getRawDir, getScoresDir } from './utils/fs.js';
import type { WeightsConfig, RawSourceData, FetchResult } from './types.js';
import { readdirSync, existsSync } from 'node:fs';
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
function loadRawDataForDate(date: string): Map<string, RawSourceData> | null {
  const rawDir = getRawDir(date);
  if (!existsSync(rawDir)) return null;

  const rawDataMap = new Map<string, RawSourceData>();
  const parsedFiles = readdirSync(rawDir).filter((f) => f.endsWith('-parsed.json'));

  for (const file of parsedFiles) {
    const filePath = join(rawDir, file);
    const data = readJson<RawSourceData>(filePath);
    if (data) {
      rawDataMap.set(data.source, data);
    }
  }

  return rawDataMap.size > 0 ? rawDataMap : null;
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
