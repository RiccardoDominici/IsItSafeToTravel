import { writeJson, readJson, getScoresDir } from '../utils/fs.js';
import { join } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import type { DailySnapshot, ScoredCountry, FetchResult } from '../types.js';

/**
 * Read the pipeline version from package.json.
 */
function getPipelineVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Write a daily snapshot to data/scores/{date}.json and data/scores/latest.json.
 *
 * Historical snapshots are preserved -- each day gets its own file.
 * latest.json is always overwritten with the most recent snapshot.
 */
export function writeSnapshot(
  date: string,
  countries: ScoredCountry[],
  fetchResults: FetchResult[],
  weightsVersion: string,
): DailySnapshot {
  const snapshot: DailySnapshot = {
    date,
    generatedAt: new Date().toISOString(),
    pipelineVersion: getPipelineVersion(),
    weightsVersion,
    countries,
    fetchResults,
  };

  const scoresDir = getScoresDir();
  const datePath = join(scoresDir, `${date}.json`);
  const latestPath = join(scoresDir, 'latest.json');

  writeJson(datePath, snapshot);
  writeJson(latestPath, snapshot);

  console.log(`Wrote snapshot for ${date} with ${countries.length} countries to data/scores/${date}.json`);

  return snapshot;
}

/**
 * Load the latest snapshot from data/scores/latest.json.
 * Returns null if the file does not exist.
 */
export function loadLatestSnapshot(): DailySnapshot | null {
  const latestPath = join(getScoresDir(), 'latest.json');
  return readJson<DailySnapshot>(latestPath);
}

/**
 * List all available snapshot dates (from data/scores/YYYY-MM-DD.json files).
 * Returns sorted array of date strings in ascending order.
 */
export function listSnapshotDates(): string[] {
  const scoresDir = getScoresDir();
  if (!existsSync(scoresDir)) return [];

  const datePattern = /^\d{4}-\d{2}-\d{2}\.json$/;

  return readdirSync(scoresDir)
    .filter((f) => datePattern.test(f))
    .map((f) => f.replace('.json', ''))
    .sort();
}

/**
 * Load a snapshot for a specific date.
 * Returns null if the file does not exist.
 */
export function loadSnapshot(date: string): DailySnapshot | null {
  const filePath = join(getScoresDir(), `${date}.json`);
  return readJson<DailySnapshot>(filePath);
}
