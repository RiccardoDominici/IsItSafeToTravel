import fs from 'node:fs';
import path from 'node:path';
import type { ScoredCountry, SentimentEntry } from '../pipeline/types';
import { SENTIMENT_MIN_ORIGINS, SENTIMENT_MIN_VOTES } from '../pipeline/sentiment/constants';
import { hasSufficientData } from './hub-data';

const DATA_DIR = path.join(process.cwd(), 'data', 'sentiment');

/**
 * Votes needed before a country's community reading is active (formula v10, SPEC §5). Same
 * constant the pipeline's activation rule uses. Below it the community block shows progress, not
 * a number.
 */
export const MIN_VOTE_FLOOR = SENTIMENT_MIN_VOTES;

/** Distinct known countries of origin needed before a community reading is active (SPEC §5). */
export const MIN_ORIGIN_FLOOR = SENTIMENT_MIN_ORIGINS;

interface SentimentLatestFile {
  generatedAt: string;
  countries: Record<string, SentimentEntry>;
}

/**
 * True for an entry in the formula-v10 shape. Files written before v10 (v9.1 `count` /
 * `correction`) are ignored, so the page shows "not enough votes yet" until the next pipeline run
 * rewrites latest.json, instead of rendering half-populated numbers.
 */
function isCommunityEntry(x: unknown): x is SentimentEntry {
  const e = x as Partial<SentimentEntry> | null | undefined;
  return (
    !!e &&
    typeof e.iso3 === 'string' &&
    typeof e.votes === 'number' &&
    typeof e.perceived === 'number' &&
    (e.status === 'active' || e.status === 'insufficient')
  );
}

/**
 * Load the per-country community entry baked at build time by the daily aggregation pipeline.
 * Mirrors src/lib/scores.ts's graceful-degradation pattern: a missing file (first build / degraded
 * pipeline), a missing country, or malformed JSON all resolve to null rather than throwing (D-14),
 * so a build never fails on absent or partial sentiment data.
 */
export function loadSentimentForCountry(iso3: string): SentimentEntry | null {
  const filePath = path.join(DATA_DIR, 'latest.json');
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed: SentimentLatestFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const entry: unknown = parsed.countries?.[iso3];
    return isCommunityEntry(entry) ? entry : null;
  } catch {
    return null;
  }
}

/**
 * Load every community entry, active or not (callers decide what to show: the community-vs-data
 * ranking keeps only status 'active'). Same graceful-degradation contract as
 * loadSentimentForCountry: a missing file or malformed JSON resolves to [].
 */
export function loadAllSentiment(): SentimentEntry[] {
  const filePath = path.join(DATA_DIR, 'latest.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed: SentimentLatestFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Object.values(parsed.countries ?? {}).filter(isCommunityEntry);
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
