import { writeJson, readJson } from '../utils/fs.js';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import type { SentimentSnapshot } from '../types.js';

/**
 * Bake sentiment snapshots to `data/sentiment/*.json` — a directory kept
 * intentionally separate from the large scores dataset under `data/scores`
 * (D-10, Pitfall 3). This module never writes to or reads from that
 * directory's consolidated history file.
 */

export interface SentimentHistoryIndex {
  generatedAt: string;
  countries: Record<string, Array<{ date: string; correction: number; count: number }>>;
}

export function getSentimentDir(): string {
  return join(process.cwd(), 'data', 'sentiment');
}

/**
 * Write a daily sentiment snapshot to data/sentiment/{date}.json and
 * data/sentiment/latest.json (mirrors scoring/snapshot.ts's dated+latest pattern).
 */
export function writeSentimentSnapshot(date: string, snapshot: SentimentSnapshot): void {
  const dir = getSentimentDir();
  const datePath = join(dir, `${date}.json`);
  const latestPath = join(dir, 'latest.json');

  writeJson(datePath, snapshot);
  writeJson(latestPath, snapshot);

  console.log(
    `[Sentiment] Wrote snapshot for ${date} with ${Object.keys(snapshot.countries).length} countries to data/sentiment/${date}.json`,
  );
}

/**
 * List all available sentiment snapshot dates (from data/sentiment/YYYY-MM-DD.json files).
 */
function listSentimentSnapshotDates(): string[] {
  const dir = getSentimentDir();
  if (!existsSync(dir)) return [];

  const datePattern = /^\d{4}-\d{2}-\d{2}\.json$/;
  return readdirSync(dir)
    .filter((f) => datePattern.test(f))
    .map((f) => f.replace('.json', ''))
    .sort();
}

/**
 * Build and write data/sentiment/history-index.json from all available dated
 * sentiment snapshots — a small, SEPARATE file from the main scores history
 * (D-10, Pitfall 3: never let sentiment history bloat the 73MB scores index).
 */
export function writeSentimentHistoryIndex(): SentimentHistoryIndex {
  const dates = listSentimentSnapshotDates();
  const countries: Record<string, Array<{ date: string; correction: number; count: number }>> = {};

  for (const date of dates) {
    const snapshotPath = join(getSentimentDir(), `${date}.json`);
    const snapshot = readJson<SentimentSnapshot>(snapshotPath);
    if (!snapshot) continue;

    for (const [iso3, entry] of Object.entries(snapshot.countries)) {
      if (!countries[iso3]) countries[iso3] = [];
      countries[iso3].push({ date, correction: entry.correction, count: entry.count });
    }
  }

  const index: SentimentHistoryIndex = {
    generatedAt: new Date().toISOString(),
    countries,
  };

  const indexPath = join(getSentimentDir(), 'history-index.json');
  writeJson(indexPath, index);
  console.log(
    `[Sentiment] Wrote history-index.json with ${dates.length} snapshot(s), ${Object.keys(countries).length} countries`,
  );

  return index;
}
