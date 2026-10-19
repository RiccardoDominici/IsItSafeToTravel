import type { ScoreStatus } from '../types.js';

/**
 * Formula v10 official grey rule (SPEC §4).
 *
 * A country with fewer than `minSources` coverage sources (after the max-age filter, counted
 * by coverage.ts coverageSourceCount exactly like the site's hasSufficientData: one entry of
 * ScoredCountry.sources per source key, the disaster-alert feeds GDACS/ReliefWeb excluded; since
 * 2026-10-15 the list holds only sources that supply a value the score uses, I29)
 * gets no official score: scoreStatus 'insufficient_data'. Since 2026-10-19 the same holds for a
 * place with enough sources but no measured value in a required pillar (formulaV9.requiredPillars:
 * crime, i.e. neither GPI nor a World Bank homicide rate; coverage.ts REQUIRED_PILLARS says why).
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
 * every country is scored, as before v10. `missingPillars`: the required pillars
 * (formulaV9.requiredPillars, since 2026-10-19 crime) with no measured value; any of them
 * greys the place like a short source count, and the danger guard overrides both.
 */
export function decideScoreStatus(
  sourceCount: number,
  minSources: number | undefined,
  signals: DangerSignals,
  missingPillars: readonly string[] = [],
): StatusDecision {
  const guardReasons = dangerGuardReasons(signals);
  // No floor configured (pre-v10 / synthetic configs): every country is scored, pillars or not.
  if (minSources === undefined || (sourceCount >= minSources && missingPillars.length === 0)) {
    return { status: 'scored', guardReasons, guardApplied: false };
  }
  if (guardReasons.length > 0) {
    return { status: 'scored', guardReasons, guardApplied: true };
  }
  return { status: 'insufficient_data', guardReasons, guardApplied: false };
}
