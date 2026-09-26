/**
 * generate-data-release.ts
 *
 * Build-time script for the monthly data-release GitHub Action
 * (.github/workflows/data-release.yml). Produces two dated snapshot files —
 * scores-YYYY-MM-DD.csv and scores-YYYY-MM-DD.json — from the current
 * data/scores/latest.json, for attaching to a GitHub Release. The YYYY-MM-DD
 * is the snapshot's own `date` field (the actual data date), not "today":
 * the workflow runs on a monthly cron, so the two rarely differ by more than
 * a day, but the data date is the honest one to put in a data-release filename.
 *
 * The CSV uses the exact same column-building logic as the live
 * /scores.csv endpoint (src/lib/dataset-csv.ts) — one shared function, so the
 * two artifacts can never drift into two different schemas. The JSON output
 * is a byte-for-byte copy of data/scores/latest.json under the dated name
 * (not a re-serialize through JSON.parse/stringify, which risks subtly
 * reformatting numbers) — this IS the full dataset, same as public/scores.json.
 *
 * Run:  npx tsx scripts/generate-data-release.ts [--out <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import type { DailySnapshot } from '../src/pipeline/types.js';
import { buildScoresCsv } from '../src/lib/dataset-csv.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const LATEST_JSON_PATH = path.join(ROOT, 'data/scores/latest.json');

function parseOutDir(argv: string[]): string {
  const idx = argv.indexOf('--out');
  const rel = idx !== -1 && argv[idx + 1] ? argv[idx + 1] : 'release-assets';
  return path.resolve(ROOT, rel);
}

function main() {
  if (!fs.existsSync(LATEST_JSON_PATH)) {
    console.error(`ERROR: ${LATEST_JSON_PATH} not found — has the data pipeline ever run?`);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(LATEST_JSON_PATH, 'utf-8');
  const snapshot: DailySnapshot = JSON.parse(rawJson);
  const date = snapshot.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`ERROR: unexpected snapshot date format: ${JSON.stringify(date)}`);
    process.exit(1);
  }

  const outDir = parseOutDir(process.argv.slice(2));
  fs.mkdirSync(outDir, { recursive: true });

  const csvPath = path.join(outDir, `scores-${date}.csv`);
  const jsonPath = path.join(outDir, `scores-${date}.json`);

  fs.writeFileSync(csvPath, buildScoresCsv(snapshot), 'utf-8');
  fs.writeFileSync(jsonPath, rawJson, 'utf-8');

  console.log(`Wrote ${snapshot.countries.length} countries (data revision ${snapshot.dataRevision ?? 1}) dated ${date}:`);
  console.log(`  ${path.relative(ROOT, csvPath)}`);
  console.log(`  ${path.relative(ROOT, jsonPath)}`);

  // GITHUB_OUTPUT plumbing so the workflow can name the release/tag after the
  // real data date without re-parsing this script's stdout.
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `date=${date}\ncsv_path=${csvPath}\njson_path=${jsonPath}\ncountry_count=${snapshot.countries.length}\n`);
  }
}

main();
