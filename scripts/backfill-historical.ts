/**
 * Backfill historical data with year-appropriate World Bank data.
 *
 * Strategy: fetch WB data once per year, then reuse for all snapshots in that year.
 * INFORM data is the same (2025 edition) for all dates since it's the only edition we have.
 * Advisories are always "current" so we fetch once and reuse.
 */

import { readdirSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runPipeline } from '../src/pipeline/run.js';

const SCORES_DIR = join(process.cwd(), 'data', 'scores');
const RAW_DIR = join(process.cwd(), 'data', 'raw');

// Get all snapshot dates
const dates = readdirSync(SCORES_DIR)
  .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map(f => f.replace('.json', ''))
  .sort();

console.log(`Found ${dates.length} snapshots to regenerate`);

// Group by year
const byYear = new Map<number, string[]>();
for (const date of dates) {
  const year = parseInt(date.slice(0, 4));
  if (!byYear.has(year)) byYear.set(year, []);
  byYear.get(year)!.push(date);
}

console.log(`Years: ${[...byYear.keys()].join(', ')}`);

// Process year by year
for (const [year, yearDates] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`\n=== Year ${year}: ${yearDates.length} snapshots ===`);

  // Run pipeline for the FIRST date in this year (this fetches WB data for this year)
  const firstDate = yearDates[0];
  console.log(`Fetching fresh data for ${firstDate}...`);

  try {
    const result = await runPipeline(firstDate);
    console.log(`  ${firstDate}: ${result.countriesScored} countries, ${result.sourcesSucceeded}/${result.sourcesTotal} sources`);

    // Now reuse the raw data for all other dates in this year
    const firstRawDir = join(RAW_DIR, firstDate);

    for (let i = 1; i < yearDates.length; i++) {
      const date = yearDates[i];
      const rawDir = join(RAW_DIR, date);

      // Copy raw data from first date to this date's directory
      if (!existsSync(rawDir)) mkdirSync(rawDir, { recursive: true });

      for (const file of readdirSync(firstRawDir)) {
        if (file.endsWith('-parsed.json') || file.endsWith('.xlsx')) {
          copyFileSync(join(firstRawDir, file), join(rawDir, file));
        }
      }

      // Run pipeline (will use the copied raw data, skip fetch since files exist)
      const r = await runPipeline(date);
      process.stdout.write(`  ${date}: ${r.countriesScored} scored\r`);
    }

    console.log(`  Year ${year}: all ${yearDates.length} snapshots regenerated`);
  } catch (err) {
    console.error(`  FAILED for year ${year}:`, err);
  }
}

console.log('\n=== Backfill complete ===');
console.log('Run: npx tsx -e "import { writeHistoryIndex } from \'./src/pipeline/scoring/history.js\'; writeHistoryIndex();"');
