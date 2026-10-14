import type { ScoreStatus } from '../types.js';

/**
 * Formula v10 official grey rule (SPEC §4).
 *
 * A country with fewer than `minSources` distinct data sources (after the max-age filter,
 * counted exactly like the site's hasSufficientData: one entry of ScoredCountry.sources
 * per source key) gets no official score: scoreStatus 'insufficient_data'.
 *
 * DANGER GUARD (invariant, not a tunable): a country showing any sign of acute danger is
 * ALWAYS scored, however thin its data, so a dangerous place can never hide behind a grey
 * "partial data" label:
 *   - at least 3 governments publish their level 4 (raw published level, any issuer), or
 *   - the tier-weighted severe-advisory share is at least 0.5, or
 *   - UCDP recorded conflict deaths (> 0) in the latest year.
 */
export const DANGER_GUARD = Object.freeze({
  minLevel4Governments: 3,
  minSevereShare: 0.5,
  minUcdpDeaths: 0, // strictly greater than this
});

export interface DangerSignals {
  /** Governments whose published (raw, not rebased) level is 4. */
  level4Governments: number;
  /** Tier-weighted share of level-4 advisories (engine advisoryConsensus severeShare). */
  severeShare: number;
  /** UCDP conflict deaths in the latest year, or null when the country has no UCDP row. */
  ucdpDeaths: number | null;
}

/** Which guard conditions hold, as short human-readable reasons (empty = no danger signal). */
export function dangerGuardReasons(signals: DangerSignals): string[] {
  const reasons: string[] = [];
  if (signals.level4Governments >= DANGER_GUARD.minLevel4Governments) {
    reasons.push(`${signals.level4Governments} governments at level 4`);
  }
  if (signals.severeShare >= DANGER_GUARD.minSevereShare) {
    reasons.push(`severe advisory share ${signals.severeShare.toFixed(2)}`);
  }
  if (signals.ucdpDeaths !== null && signals.ucdpDeaths > DANGER_GUARD.minUcdpDeaths) {
    reasons.push(`${signals.ucdpDeaths} UCDP conflict deaths`);
  }
  return reasons;
}

export interface StatusDecision {
  status: ScoreStatus;
  /** Guard reasons (also filled for well-covered countries, for diagnostics). */
  guardReasons: string[];
  /** True when the guard is the ONLY reason the country is scored (data-poor but dangerous). */
  guardApplied: boolean;
}

/**
 * Decide the official status. With `minSources` undefined (pre-v10 / synthetic configs)
 * every country is scored, as before v10.
 */
export function decideScoreStatus(
  sourceCount: number,
  minSources: number | undefined,
  signals: DangerSignals,
): StatusDecision {
  const guardReasons = dangerGuardReasons(signals);
  if (minSources === undefined || sourceCount >= minSources) {
    return { status: 'scored', guardReasons, guardApplied: false };
  }
  if (guardReasons.length > 0) {
    return { status: 'scored', guardReasons, guardApplied: true };
  }
  return { status: 'insufficient_data', guardReasons, guardApplied: false };
}
