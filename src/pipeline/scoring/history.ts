import { writeJson, readJson, getScoresDir } from '../utils/fs.js';
import { listSnapshotDates, loadSnapshot } from './snapshot.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { PillarName } from '../types.js';

export interface HistoryIndex {
  generatedAt: string;
  global: Array<{ date: string; score: number }>;
  countries: Record<string, Array<{ date: string; score: number; dc?: number }>>;
  pillarHistory: Record<string, Record<PillarName, Array<{ date: string; score: number }>>>;
}

/** Remove trailing entries dated >= cutoff from a date-ascending point array (in place). */
function trimFromCutoff(points: Array<{ date: string }>, cutoff: string): void {
  while (points.length > 0 && points[points.length - 1].date >= cutoff) points.pop();
}

/**
 * Build and write history-index.json from the daily snapshots.
 *
 * DEFAULT (incremental): folds in only snapshots newer than what the existing
 * index already covers. Rebuilding from scratch used to re-parse every snapshot
 * on disk (~700 files / ~1.3 GB of JSON) on EVERY daily run; now the steady
 * state reads one JSON file plus the new day's snapshot. Points are appended in
 * date order; a same-day rerun replaces that day's entries instead of
 * duplicating them (trailing entries >= new cutoff are trimmed first).
 *
 * opts.full forces a complete rebuild from all available snapshots — required
 * after backfills that RESCORE history (scripts/backfill-*.ts), where cached
 * old points must be recomputed, not kept.
 *
 * Note: after scripts/prune-snapshots.ts deletes old snapshot files, a full
 * rebuild can only cover surviving dates — the index itself is the archive.
 */
export function writeHistoryIndex(opts: { full?: boolean } = {}): HistoryIndex {
  const indexPath = join(getScoresDir(), 'history-index.json');
  const dates = listSnapshotDates();
  const existing = opts.full ? null : readJson<HistoryIndex>(indexPath);

  // A MISSING index is fine (first run / intentional rebuild — it will be
  // reconstructed from the snapshots on disk). An EXISTING but UNPARSABLE one
  // is NOT: after scripts/prune-snapshots.ts the old daily files are gone and
  // this index is the only long-term archive. Silently rebuilding from the
  // pruned remainder would quietly truncate history to ~120 days + monthly
  // anchors, so fail loudly instead and let an operator git-restore the file.
  if (!opts.full && existing === null && existsSync(indexPath)) {
    throw new Error(
      `history-index.json exists but is corrupt/unreadable (${indexPath}). ` +
      `Refusing to overwrite the historical archive with a partial rebuild — ` +
      `restore it with: git checkout HEAD -- data/scores/history-index.json`,
    );
  }

  const global: Array<{ date: string; score: number }> = [];
  const countries: Record<string, Array<{ date: string; score: number; dc?: number }>> = {};
  const pillarHistory: Record<string, Record<string, Array<{ date: string; score: number }>>> = {};

  let pendingDates: string[];
  if (existing && existing.global.length > 0) {
    const lastCovered = existing.global[existing.global.length - 1].date;
    // ">=" so a same-day rerun (snapshot regenerated after a manual pipeline
    // run) is RE-FOLDED — the cutoff trim below replaces those points instead
    // of duplicating them.
    pendingDates = dates.filter((d) => d >= lastCovered);
    if (pendingDates.length === 0) {
      console.log(`history-index.json up to date (${dates.length} snapshots, last ${lastCovered})`);
      return existing;
    }
    // Same-day rerun guard: drop any existing entries for the dates we are
    // about to (re)append, so repeated runs never duplicate points.
    const cutoff = pendingDates[0];
    global.push(...existing.global);
    trimFromCutoff(global, cutoff);
    for (const [iso3, points] of Object.entries(existing.countries)) {
      trimFromCutoff(points, cutoff);
      if (points.length > 0) countries[iso3] = points;
    }
    for (const [iso3, pillars] of Object.entries(existing.pillarHistory)) {
      for (const [pillar, points] of Object.entries(pillars)) {
        trimFromCutoff(points, cutoff);
        if (points.length > 0) {
          (pillarHistory[iso3] ??= {})[pillar] = points;
        }
      }
    }
  } else {
    pendingDates = dates;
  }

  let folded = 0;
  for (const date of pendingDates) {
    const snapshot = loadSnapshot(date);
    if (!snapshot) continue;
    folded++;

    // Always recalculate from country scores for 2-decimal precision
    const globalScore = snapshot.countries.length > 0
      ? Math.round((snapshot.countries.reduce((s, c) => s + c.score, 0) / snapshot.countries.length) * 100) / 100
      : 0;
    global.push({ date, score: globalScore });

    // Per-country scores and per-pillar scores
    for (const country of snapshot.countries) {
      if (!countries[country.iso3]) countries[country.iso3] = [];
      // Include dataCompleteness when it's low enough to indicate insufficient data.
      // dc=0 means no real data (all pillars at neutral default 0.5).
      // We store dc when below 0.15 to flag truly data-sparse snapshots.
      const point: { date: string; score: number; dc?: number } = { date, score: country.score };
      if (country.dataCompleteness < 0.15) point.dc = country.dataCompleteness;
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

  writeJson(indexPath, index);
  console.log(
    `Wrote history-index.json: ${global.length} points total ` +
    `(${folded} new snapshot(s) folded in${opts.full ? ', full rebuild' : ', incremental'})`,
  );

  return index;
}
