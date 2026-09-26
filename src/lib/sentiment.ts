import fs from 'node:fs';
import path from 'node:path';
import type { ScoredCountry, SentimentEntry } from '../pipeline/types';
import { hasSufficientData } from './hub-data';

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

/**
 * Load every published SentimentEntry (community-vs-data ranking page, 39-11).
 * Same graceful-degradation contract as loadSentimentForCountry: a missing
 * file or malformed JSON resolves to [] rather than throwing, so a build never
 * fails on absent or partial sentiment data. Entries are already floor-gated
 * at aggregation time (aggregateVotes skips anything below SENTIMENT_MIN_VOTES),
 * so every entry returned here is display-worthy as-is.
 */
export function loadAllSentiment(): SentimentEntry[] {
  const filePath = path.join(DATA_DIR, 'latest.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed: SentimentLatestFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Object.values(parsed.countries ?? {});
  } catch {
    return [];
  }
}

/**
 * Large international tourist destinations (UN Tourism, international
 * arrivals, 2023-2024 top destinations) -- used only to pick which
 * not-yet-ranked countries to invite votes for on the /community-vs-data/
 * page (pickVoteNextSuggestions below); no ranking or numbers from this list
 * are shown on the page (team-lead correction, 2026-09-26: the previous
 * "most advisory sources" rule surfaced high-scrutiny countries like
 * Afghanistan/Iran/Pakistan rather than places most voters have actually
 * been to).
 */
export const POPULAR_TOURIST_DESTINATIONS: readonly string[] = [
  'FRA', 'ESP', 'ITA', 'TUR', 'MEX', 'GBR', 'DEU', 'GRC', 'THA', 'JPN',
  'PRT', 'AUT', 'NLD', 'ARE', 'HRV', 'EGY', 'MAR', 'IDN', 'VNM', 'BRA',
];

/**
 * First 8 entries of POPULAR_TOURIST_DESTINATIONS not already in
 * `excludeIso3` (the countries already ranked on the page) that also pass
 * hasSufficientData -- the community-vs-data "vote next" CTA. Order-
 * preserving: which 8 show up shifts only when a currently-suggested
 * country crosses into the ranked list, or a country the pipeline can't
 * yet score adequately drops out.
 */
export function pickVoteNextSuggestions(
  countries: ScoredCountry[],
  excludeIso3: ReadonlySet<string>,
): ScoredCountry[] {
  const byIso3 = new Map(countries.map((c) => [c.iso3, c]));
  const suggestions: ScoredCountry[] = [];
  for (const iso3 of POPULAR_TOURIST_DESTINATIONS) {
    if (suggestions.length >= 8) break;
    if (excludeIso3.has(iso3)) continue;
    const country = byIso3.get(iso3);
    if (!country || !hasSufficientData(country)) continue;
    suggestions.push(country);
  }
  return suggestions;
}
