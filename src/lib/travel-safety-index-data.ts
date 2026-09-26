import type { ScoredCountry } from '../pipeline/types';
import type { Region } from './regions';
import { loadLatestSnapshot, loadHistoricalScores, getScoreDelta } from './scores';
import { hasSufficientData } from './hub-data';
import { getRegion } from './regions';

export interface IndexRow {
  rank: number;
  country: ScoredCountry;
  region: Region | 'other';
  /** 7-day score delta, or null when there isn't enough history to compute one
   *  (same window/logic as getBiggestMovers in hub-data.ts). */
  delta: number | null;
}

export interface TravelSafetyIndexData {
  /** Snapshot date (YYYY-MM-DD) — the single source for "the year" everywhere
   *  on this page; never derive it from the build/system clock. */
  date: string;
  /** Total countries/territories in the current snapshot (248 as of 2026-08). */
  countryCount: number;
  /** Countries clearing the 4+ sources ranking floor (hasSufficientData) — these are the `rows`. */
  includedCount: number;
  /** countryCount - includedCount: excluded for insufficient data coverage, not omitted editorially. */
  excludedCount: number;
  /** Ranked rows, score descending, includedCount long. */
  rows: IndexRow[];
  safest: ScoredCountry;
  leastSafe: ScoredCountry;
}

/**
 * Build the full Travel Safety Index dataset: every country clearing the
 * hasSufficientData floor (src/lib/hub-data.ts), ranked by score, with region
 * and 7-day trend attached. Pure/deterministic over the current snapshot, so
 * it is computed once and cached (see getTravelSafetyIndexData below) — this
 * page is rendered once per locale (7 times) in the same build process, and
 * loadHistoricalScores() parses the large history-index.json file (see
 * CLAUDE.md "Known constraints"), which must not happen 7 times over.
 */
export function computeTravelSafetyIndexData(): TravelSafetyIndexData {
  const snapshot = loadLatestSnapshot();
  const countries = snapshot?.countries ?? [];
  const date = snapshot?.date ?? new Date().toISOString().slice(0, 10);

  const eligible = countries.filter(hasSufficientData).sort((a, b) => b.score - a.score);
  const history = loadHistoricalScores(30);

  const rows: IndexRow[] = eligible.map((country, i) => ({
    rank: i + 1,
    country,
    region: getRegion(country.iso3),
    delta: getScoreDelta(country.iso3, history)?.delta ?? null,
  }));

  return {
    date,
    countryCount: countries.length,
    includedCount: eligible.length,
    excludedCount: countries.length - eligible.length,
    rows,
    safest: eligible[0],
    leastSafe: eligible[eligible.length - 1],
  };
}

let cached: TravelSafetyIndexData | null = null;

/** Lazy singleton (pattern of getLastmodMap in lastmod.ts) — computed once per build. */
export function getTravelSafetyIndexData(): TravelSafetyIndexData {
  if (!cached) cached = computeTravelSafetyIndexData();
  return cached;
}
