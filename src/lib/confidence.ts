/**
 * Shared low-confidence threshold for country-page copy.
 *
 * WHY a standalone constant: ScoreHero's "⚠️ Limited data" badge and the FAQ /
 * answer-first prose need to branch on the *same* cutoff, or a country can show
 * the caution badge while the surrounding text still reads as a fully-confident
 * verdict (2026-09-25 audit, C7: "solo il badge segnala la differenza"). Keeping
 * it here — instead of re-inlining `0.4` in every consumer — means the badge and
 * the prose can never drift apart again.
 *
 * `ScoredCountry.confidence` (src/pipeline/types.ts) is the engine's own
 * evidence-weight fraction (0 = pure Bayesian prior, no real data; approaches 1
 * as precision grows) — this is display policy on top of that number, not a
 * scoring constant, so it deliberately lives in src/lib, not src/pipeline.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.4;
