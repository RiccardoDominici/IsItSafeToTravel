import type { ScoredCountry } from '../pipeline/types';
import type { HistoryPoint } from './scores';
import { loadLatestScores, loadHistoricalScores, getScoreDelta, sevenDayDelta } from './scores';
import { getCountriesByRegion } from './regions';
import type { Region } from './regions';
import { isScored, type Scored } from './score-status';
import { meetsCoverageFloor } from '../pipeline/scoring/coverage';

// Data-coverage floor: micro-territories with only 1-3 reporting sources receive
// sparse, optimistic default scores that pollute rankings (e.g. uninhabited
// Pitcairn / Falklands ranking as "safest"). Require enough independent sources
// before a country is eligible for a score-based ranking. The floor and the way
// sources are counted (disaster-alert feeds excluded) live in
// src/pipeline/scoring/coverage.ts, shared with the engine, llms.txt and the news.

/**
 * Ranking eligibility: an official score (formula v10: not a grey `insufficient_data` place, see
 * score-status.ts) AND the coverage rule. The two coincide except for the v10 danger guard (a
 * data-poor place scored only because of acute danger signals keeps its score on its own page but
 * is not ranked). A type guard, so `.filter(hasSufficientData)` yields countries whose `.score` is
 * a number. With pre-v10 snapshots every country is scored and this is the plain coverage rule
 * (four sources and, since 2026-10-19, a measured crime value: coverage.ts meetsCoverageFloor).
 */
export function hasSufficientData(c: ScoredCountry): c is Scored<ScoredCountry> {
  return isScored(c) && meetsCoverageFloor(c);
}

/** Returns top N countries (with sufficient data) sorted by score descending */
export function getSafestCountries(countries: ScoredCountry[], n: number): Scored<ScoredCountry>[] {
  return countries.filter(hasSufficientData).sort((a, b) => b.score - a.score).slice(0, n);
}

/** Returns bottom N countries (with sufficient data) sorted by score ascending */
export function getMostDangerousCountries(countries: ScoredCountry[], n: number): Scored<ScoredCountry>[] {
  return countries.filter(hasSufficientData).sort((a, b) => a.score - b.score).slice(0, n);
}

// Biggest 7-day score movers, for the "biggest movers" block on the two
// head-term ranking hubs. Always computed over the FULL country list (not the
// caller's ranked subset — movers are a site-wide concept) and cached at
// module level: HubPageLayout renders 14 enriched hub pages per build and
// loadHistoricalScores parses the large history index, so compute once.
let moversCache: { country: ScoredCountry; delta: number }[] | null = null;

/** Top N countries by absolute 7-day score change (data-coverage floor applied). */
export function getBiggestMovers(n: number): { country: ScoredCountry; delta: number }[] {
  if (!moversCache) {
    const history = loadHistoricalScores(30);
    moversCache = loadLatestScores()
      .filter(hasSufficientData)
      .map((c) => ({ country: c, delta: getScoreDelta(c.iso3, history)?.delta ?? 0 }))
      .filter((m) => m.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }
  return moversCache.slice(0, n);
}

/** For solo travelers: weighted by crime (40%) + governance (40%) + overall (20%) */
export function getSafestForSoloTravelers(countries: ScoredCountry[], n: number): Scored<ScoredCountry>[] {
  return countries
    .filter(hasSufficientData)
    .map(c => {
      const crime = c.pillars.find(p => p.name === 'crime')?.score ?? 0;
      const governance = c.pillars.find(p => p.name === 'governance')?.score ?? 0;
      const overall = c.score / 10; // normalize to 0-1 (hasSufficientData: always a number here)
      const weighted = crime * 0.4 + governance * 0.4 + overall * 0.2;
      return { ...c, _soloScore: weighted };
    })
    .sort((a, b) => b._soloScore - a._soloScore)
    .slice(0, n);
}

/** For families: weighted by health (35%) + governance (35%) + crime (20%) + overall (10%) */
export function getSafestForFamilies(countries: ScoredCountry[], n: number): Scored<ScoredCountry>[] {
  return countries
    .filter(hasSufficientData)
    .map(c => {
      const health = c.pillars.find(p => p.name === 'health')?.score ?? 0;
      const governance = c.pillars.find(p => p.name === 'governance')?.score ?? 0;
      const crime = c.pillars.find(p => p.name === 'crime')?.score ?? 0;
      const overall = c.score / 10;
      const weighted = health * 0.35 + governance * 0.35 + crime * 0.2 + overall * 0.1;
      return { ...c, _familyScore: weighted };
    })
    .sort((a, b) => b._familyScore - a._familyScore)
    .slice(0, n);
}

/**
 * Countries where majority of advisories are level 4 (Do Not Travel). Only scored countries:
 * the list is ordered by score and shows it. A grey place cannot hit this rule anyway, since a
 * level-4 majority trips the v10 danger guard and keeps it scored (pipeline/scoring/status.ts).
 */
export function getCountriesToAvoid(countries: ScoredCountry[]): Scored<ScoredCountry>[] {
  return countries
    .filter((c): c is Scored<ScoredCountry> => isScored(c))
    .filter(c => {
      const advisories = Object.values(c.advisories || {});
      if (advisories.length === 0) return false;
      const level4Count = advisories.filter(a => a && a.level === 4).length;
      return level4Count >= Math.ceil(advisories.length / 2);
    })
    .sort((a, b) => a.score - b.score);
}

/**
 * Countries with a 7-day score change in the given direction, largest first. Only countries with
 * an official score (a grey place has no score to move); unlike the other hubs these two never
 * applied the 4-source floor, and that is kept. The delta comes from sevenDayDelta (scores.ts),
 * which never compares scores across a formula change: the day formula v10 replaced v9.1, every
 * country "moved" without anything happening on the ground.
 */
function trendingCountries(
  countries: ScoredCountry[],
  history: Map<string, HistoryPoint[]>,
  n: number,
  direction: 'up' | 'down',
): Array<Scored<ScoredCountry> & { delta: number }> {
  return countries
    .filter((c): c is Scored<ScoredCountry> => isScored(c))
    .map((c) => {
      const delta = sevenDayDelta(history.get(c.iso3));
      if (delta === null) return null;
      return (direction === 'up' ? delta > 0 : delta < 0) ? { ...c, delta } : null;
    })
    .filter((c): c is Scored<ScoredCountry> & { delta: number } => c !== null)
    .sort((a, b) => (direction === 'up' ? b.delta - a.delta : a.delta - b.delta))
    .slice(0, n);
}

/** Countries with biggest positive delta in last 7 days */
export function getImprovingSafety(
  countries: ScoredCountry[],
  history: Map<string, HistoryPoint[]>,
  n: number
): Array<Scored<ScoredCountry> & { delta: number }> {
  return trendingCountries(countries, history, n, 'up');
}

/** Countries with biggest negative delta in last 7 days */
export function getDecliningCountries(
  countries: ScoredCountry[],
  history: Map<string, HistoryPoint[]>,
  n: number
): Array<Scored<ScoredCountry> & { delta: number }> {
  return trendingCountries(countries, history, n, 'down');
}

/** Re-export for convenience */
export { getCountriesByRegion } from './regions';
export type { Region } from './regions';
