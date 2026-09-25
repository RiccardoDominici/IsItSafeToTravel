/**
 * Shared strongest/weakest-pillar picker for AnswerFirstParagraph and
 * buildCountryMetaDescription (src/lib/seo.ts).
 *
 * WHY: both generators used to pick strongest/weakest with an ad-hoc max/min
 * loop (`if (p.score > strongest.score) strongest = p`). Under a tie — every
 * pillar collapsed to the same Bayesian prior, e.g. Bouvet Island, whose 5
 * pillars all read 4.5/10 with zero real data — neither `>` nor `<` ever fires
 * past the first element, so `strongest === weakest` (literally the same pillar
 * object) and the generated sentence contradicts itself: "The biggest concern
 * is conflict (4.5/10), while the strongest area is conflict (4.5/10)"
 * (2026-09-25 audit, C2). `getCountryFaqData`'s own picker (seo.ts) already
 * avoids this by sorting instead of comparing, so `sorted[0]` and
 * `sorted[length-1]` are always two distinct array elements even under a tie —
 * this module ports that pattern so every consumer gets it for free, plus an
 * explicit `isNearTie` flag so a caller can drop the clause entirely instead of
 * naming two arbitrarily-ordered pillars that happen to hold equal scores.
 *
 * Deliberately duplicates seo.ts's `selectEligiblePillars` 2-line filter rather
 * than importing it: `buildCountryMetaDescription` lives inside seo.ts, and a
 * concurrent workstream is editing that file's other (schema-builder)
 * functions in this same audit round — importing this module back into seo.ts
 * is fine (one-directional), but importing FROM seo.ts here would reintroduce
 * exactly the kind of cross-file coupling this fix round is trying to reduce.
 */
import type { PillarScore } from '../pipeline/types';
import { MIN_PILLAR_COVERAGE } from '../pipeline/scoring/engine';

/**
 * Max-minus-min spread (0-1 scale) at or below which pillars are treated as
 * "effectively tied" rather than naming an arbitrary strongest/weakest. 0.05
 * on the 0-1 pillar scale is 0.5 of a displayed /10 point — tight enough that
 * it only fires for genuinely flat profiles (all-prior zero-data territories),
 * not for countries with real, if modest, spread between pillars.
 */
const NEAR_TIE_SPREAD = 0.05;

export interface PillarExtremes {
  weakest: PillarScore;
  strongest: PillarScore;
  /** True when strongest/weakest are within NEAR_TIE_SPREAD of each other —
   *  callers should prefer a neutral sentence over naming a "strongest" and
   *  "weakest" that aren't meaningfully different. */
  isNearTie: boolean;
}

export function selectPillarExtremes(pillars: PillarScore[]): PillarExtremes {
  const eligible = pillars.filter((p) => p.dataCompleteness >= MIN_PILLAR_COVERAGE);
  const pool = eligible.length > 0 ? eligible : pillars;
  const sorted = [...pool].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  return { weakest, strongest, isNearTie: strongest.score - weakest.score <= NEAR_TIE_SPREAD };
}
