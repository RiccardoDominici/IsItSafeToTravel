import { writeJson, getScoresDir } from '../utils/fs.js';
import { listSnapshotDates, loadSnapshot } from './snapshot.js';
import { join } from 'node:path';
import type { PillarName } from '../types.js';

export interface HistoryIndex {
  generatedAt: string;
  global: Array<{ date: string; score: number }>;
  countries: Record<string, Array<{ date: string; score: number; dc?: number }>>;
  pillarHistory: Record<string, Record<PillarName, Array<{ date: string; score: number }>>>;
}

/**
 * Build and write history-index.json from all available daily snapshots.
 *
 * Consolidates per-country score arrays and global score history into a
 * single file for efficient build-time loading.
 */
export function writeHistoryIndex(): HistoryIndex {
  const dates = listSnapshotDates();
  const global: Array<{ date: string; score: number }> = [];
  const countries: Record<string, Array<{ date: string; score: number; dc?: number }>> = {};
  const pillarHistory: Record<string, Record<string, Array<{ date: string; score: number }>>> = {};

  for (const date of dates) {
    const snapshot = loadSnapshot(date);
    if (!snapshot) continue;

    // Always recalculate from country scores for 2-decimal precision
    const globalScore = snapshot.countries.length > 0
      ? Math.round((snapshot.countries.reduce((s, c) => s + c.score, 0) / snapshot.countries.length) * 100) / 100
      : 0;
    global.push({ date, score: globalScore });

    // Per-country scores and per-pillar scores
    for (const country of snapshot.countries) {
      if (!countries[country.iso3]) countries[country.iso3] = [];
      // Include dataCompleteness only when below 0.5 (to save space in JSON)
      const point: { date: string; score: number; dc?: number } = { date, score: country.score };
      if (country.dataCompleteness < 0.5) point.dc = country.dataCompleteness;
      countries[country.iso3].push(point);

      // Extract per-pillar scores
      if (country.pillars) {
        if (!pillarHistory[country.iso3]) {
          pillarHistory[country.iso3] = {} as Record<string, Array<{ date: string; score: number }>>;
        }
        for (const pillar of country.pillars) {
          if (!pillarHistory[country.iso3][pillar.name]) {
            pillarHistory[country.iso3][pillar.name] = [];
          }
          pillarHistory[country.iso3][pillar.name].push({ date, score: pillar.score });
        }
      }
    }
  }

  const index: HistoryIndex = {
    generatedAt: new Date().toISOString(),
    global,
    countries,
    pillarHistory: pillarHistory as Record<string, Record<PillarName, Array<{ date: string; score: number }>>>,
  };

  const indexPath = join(getScoresDir(), 'history-index.json');
  writeJson(indexPath, index);
  console.log(`Wrote history-index.json with ${dates.length} snapshots, ${Object.keys(countries).length} countries`);

  return index;
}
