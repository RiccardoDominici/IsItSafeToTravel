/**
 * Official score status of a country, for every page, endpoint and script that renders a score
 * (formula v10, SPEC §4 "grey" rule).
 *
 * WHY one module: from formula v10 a country with fewer than 4 independent sources has no
 * official score (`score: null`, `scoreDisplay: null`, `scoreStatus: 'insufficient_data'`), and
 * such a "grey" place must show no number anywhere: no score, no band colour, no rank. Sprinkling
 * `score !== null` checks over ~60 consumers would let one of them drift (a band colour computed
 * from a null, a rank that counts grey places). Every consumer asks this module instead.
 *
 * Both data shapes are supported on purpose. Snapshots written before v10 (v9.1) carry a number in
 * `score` and no `scoreStatus`; they are treated as scored, so the site renders exactly as before
 * until the first v10 pipeline run rewrites data/scores/latest.json.
 *
 * Pure module: no Node imports, safe for pages, endpoints, scripts and tests.
 */
import type { ScoredCountry, ScoreStatus } from '../pipeline/types';
import { isGreyScore } from './published-scores';

/** The fields that decide whether a country has an official score. */
export interface ScoreBearing {
  score: number | null;
  scoreStatus?: ScoreStatus;
}

/** A country (or any score-bearing record) that has an official score. */
export type Scored<T extends ScoreBearing = ScoredCountry> = T & { score: number; scoreDisplay: number };

/**
 * True when the country has an official score: not `insufficient_data`, and a finite number in
 * `score`. Agrees with isGreyScore (published-scores.ts), the predicate the vote widget and the
 * vote API use, so a page never renders a scored state the API would treat as grey.
 */
export function isScored<T extends ScoreBearing>(country: T): country is Scored<T> {
  return country.scoreStatus !== 'insufficient_data' && !isGreyScore(country.score);
}

/** True for a grey place (formula v10 `insufficient_data`): no official score, no band, no rank. */
export function isGrey(country: ScoreBearing): boolean {
  return !isScored(country);
}

/** The official score, or null for a grey place. */
export function officialScore(country: ScoreBearing): number | null {
  return isScored(country) ? country.score : null;
}

/** Only the countries with an official score, typed so `.score` is a number. */
export function scoredOnly<T extends ScoreBearing>(countries: readonly T[]): Array<Scored<T>> {
  return countries.filter((c): c is Scored<T> => isScored(c));
}

/**
 * Global rank (1 = safest) of every scored country, by official score descending with an iso3
 * tie-break. Grey places get no rank: they are absent from the map, and `total` counts only the
 * scored countries, so "ranked 78th of 192" never counts places without a score.
 */
export function buildRankMap(countries: readonly ScoredCountry[]): { ranks: Map<string, number>; total: number } {
  const ranked = scoredOnly(countries).sort((a, b) => b.score - a.score || (a.iso3 < b.iso3 ? -1 : a.iso3 > b.iso3 ? 1 : 0));
  return { ranks: new Map(ranked.map((c, i) => [c.iso3, i + 1])), total: ranked.length };
}
