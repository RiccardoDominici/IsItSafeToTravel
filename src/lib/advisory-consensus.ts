/**
 * The government-advisory picture of one place, as numbers every country-page sentence can share
 * (2026-10-15 consistency audit, issues I03 I06 I14 I15 I18).
 *
 * WHY: the FAQ verdict ("Yes, generally safe") was picked from the score band alone while the
 * advisory answer below it said "the prevailing guidance is to reconsider travel"; the advisory
 * answer said "most governments" for a single advisory and "none above a low level" next to
 * level-3 and level-4 advisories. Every advisory claim on the page now derives from these counts,
 * computed from the same `country.advisories` the summary's breakdown sentence counts.
 *
 * Pure: no I/O.
 */
import type { ScoredCountry } from '../pipeline/types';

/** Advisory levels 1..4 present on a place, with the shares the copy needs. */
export interface AdvisoryConsensus {
  /** Valid levels (1..4), one per government. */
  levels: number[];
  /** Number of governments with a valid level. */
  n: number;
  /** counts[level] for level 1..4 (index 0 unused). */
  counts: [number, number, number, number, number];
  /** Most common level; a tie resolves to the higher (more cautious) level. 0 when n = 0. */
  modal: number;
  /** Highest level present. 0 when n = 0. */
  max: number;
  /** Governments at level 3 ("reconsider travel") or 4 ("do not travel"). */
  reconsiderOrWorse: number;
  /** A strict majority advises reconsidering travel or against all travel. */
  majorityReconsiderOrWorse: boolean;
  /** A strict majority advises against all travel. */
  majorityAvoid: boolean;
}

/** Advisory issuers keyed by code ("us", "uk", ...) with their valid level. */
export function advisoryEntries(country: Pick<ScoredCountry, 'advisories'>): Array<{ key: string; level: number }> {
  return Object.entries(country.advisories ?? {})
    .map(([key, info]) => ({ key, level: Number((info as { level?: unknown } | undefined)?.level) }))
    .filter((a) => Number.isInteger(a.level) && a.level >= 1 && a.level <= 4);
}

export function getAdvisoryConsensus(country: Pick<ScoredCountry, 'advisories'>): AdvisoryConsensus {
  const levels = advisoryEntries(country).map((a) => a.level);
  const n = levels.length;
  const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const level of levels) counts[level]++;
  let modal = 0;
  for (let level = 1; level <= 4; level++) if (counts[level] > 0 && counts[level] >= (counts[modal] ?? 0)) modal = level;
  const max = n > 0 ? Math.max(...levels) : 0;
  const reconsiderOrWorse = counts[3] + counts[4];
  return {
    levels,
    n,
    counts,
    modal,
    max,
    reconsiderOrWorse,
    majorityReconsiderOrWorse: n > 0 && reconsiderOrWorse * 2 > n,
    majorityAvoid: n > 0 && counts[4] * 2 > n,
  };
}
