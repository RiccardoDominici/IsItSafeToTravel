import fs from 'node:fs';
import path from 'node:path';
import type { DailySnapshot, PillarName, ScoredCountry } from '../pipeline/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'scores');
const HISTORY_INDEX_PATH = path.join(DATA_DIR, 'history-index.json');

export interface HistoryPoint {
  date: string;
  score: number;
}

export type PillarHistoryData = Record<PillarName, HistoryPoint[]>;

interface HistoryIndex {
  generatedAt: string;
  global: Array<{ date: string; score: number }>;
  countries: Record<string, Array<{ date: string; score: number }>>;
  pillarHistory?: Record<string, Record<PillarName, Array<{ date: string; score: number }>>>;
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
 * Load historical score data.
 * Prefers history-index.json (consolidated) when available.
 * Falls back to reading individual dated snapshot files.
 * Returns a Map keyed by ISO3 code, with arrays of {date, score} points.
 */
export function loadHistoricalScores(days?: number): Map<string, HistoryPoint[]> {
  // Try consolidated history-index.json first
  if (fs.existsSync(HISTORY_INDEX_PATH)) {
    return loadFromHistoryIndex(days);
  }

  // Fallback: read individual snapshot files
  return loadFromIndividualSnapshots(days);
}

/**
 * Load global score history from history-index.json.
 * Returns array of {date, score} points, or empty array if file missing.
 */
export function loadGlobalHistory(): Array<{ date: string; score: number }> {
  if (!fs.existsSync(HISTORY_INDEX_PATH)) return [];
  const index: HistoryIndex = JSON.parse(fs.readFileSync(HISTORY_INDEX_PATH, 'utf-8'));
  return index.global ?? [];
}

/**
 * Load per-pillar historical scores for a specific country.
 * Returns pillar-keyed object with date/score arrays, or null if not available.
 */
export function loadPillarHistory(iso3: string): PillarHistoryData | null {
  if (!fs.existsSync(HISTORY_INDEX_PATH)) return null;
  const index: HistoryIndex = JSON.parse(fs.readFileSync(HISTORY_INDEX_PATH, 'utf-8'));
  if (!index.pillarHistory || !index.pillarHistory[iso3]) return null;
  return index.pillarHistory[iso3];
}

function loadFromHistoryIndex(days?: number): Map<string, HistoryPoint[]> {
  const history = new Map<string, HistoryPoint[]>();
  const index: HistoryIndex = JSON.parse(fs.readFileSync(HISTORY_INDEX_PATH, 'utf-8'));

  for (const [iso3, points] of Object.entries(index.countries)) {
    const filtered = days ? points.slice(-days) : points;
    if (filtered.length > 0) {
      history.set(iso3, filtered);
    }
  }

  return history;
}

function loadFromIndividualSnapshots(days?: number): Map<string, HistoryPoint[]> {
  const history = new Map<string, HistoryPoint[]>();

  if (!fs.existsSync(DATA_DIR)) return history;

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(days ? -days : undefined);

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
