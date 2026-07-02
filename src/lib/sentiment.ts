import fs from 'node:fs';
import path from 'node:path';
import type { SentimentEntry } from '../pipeline/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'sentiment');

/**
 * Minimum vote count before a country's community sentiment is considered
 * display-worthy. Mirrors SENTIMENT_MIN_VOTES used by the aggregation pipeline
 * (39-04) — the same floor gates the below-floor empty state in SentimentPillar (D-09).
 */
export const MIN_VOTE_FLOOR = 5;

interface SentimentLatestFile {
  generatedAt: string;
  countries: Record<string, SentimentEntry>;
}

/**
 * Load the per-country community sentiment entry baked at build time by the daily
 * aggregation pipeline (39-04). Mirrors src/lib/scores.ts's graceful-degradation
 * pattern: a missing file (first build / degraded pipeline), a missing country, or
 * malformed JSON all resolve to null rather than throwing (D-14), so a build never
 * fails on absent or partial sentiment data.
 */
export function loadSentimentForCountry(iso3: string): SentimentEntry | null {
  const filePath = path.join(DATA_DIR, 'latest.json');
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed: SentimentLatestFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return parsed.countries?.[iso3] ?? null;
  } catch {
    return null;
  }
}
