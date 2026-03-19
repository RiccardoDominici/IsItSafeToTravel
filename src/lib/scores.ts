import fs from 'node:fs';
import path from 'node:path';
import type { DailySnapshot, ScoredCountry } from '../pipeline/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'scores');

export interface HistoryPoint {
  date: string;
  score: number;
}

/** Load the full latest snapshot (includes metadata + countries). */
export function loadLatestSnapshot(): DailySnapshot | null {
  const filePath = path.join(DATA_DIR, 'latest.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/** Load scored countries from the latest snapshot. Returns empty array if no data. */
export function loadLatestScores(): ScoredCountry[] {
  const snapshot = loadLatestSnapshot();
  return snapshot?.countries ?? [];
}

/**
 * Load historical score data from dated snapshot files.
 * Returns a Map keyed by ISO3 code, with arrays of {date, score} points.
 */
export function loadHistoricalScores(days: number = 90): Map<string, HistoryPoint[]> {
  const history = new Map<string, HistoryPoint[]>();

  if (!fs.existsSync(DATA_DIR)) return history;

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(-days);

  for (const file of files) {
    const snapshot: DailySnapshot = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
    );
    for (const country of snapshot.countries) {
      const points = history.get(country.iso3) ?? [];
      points.push({ date: snapshot.date, score: country.score });
      history.set(country.iso3, points);
    }
  }
  return history;
}
