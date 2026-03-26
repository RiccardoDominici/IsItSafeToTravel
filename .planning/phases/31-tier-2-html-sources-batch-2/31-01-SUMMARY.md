---
phase: 31-tier-2-html-sources-batch-2
plan: 01
subsystem: pipeline
tags: [advisory, normalization, types, scoring, tier2b]

requires:
  - phase: 30-tier-2-html-sources-batch-1
    provides: Tier 2a type extensions and normalization pattern
provides:
  - ScoredCountry.advisories with 8 tier2b keys (be, dk, sg, ro, rs, ee, hr, ar)
  - AdvisoryInfoMap with tier2b keys
  - 8 normalization functions for tier2b advisory text/level systems
  - Engine indicator-to-source mapping for tier2b
  - sources.json advisories_tier2b entry
  - Tier2b advisory info loading in computeAllScores
affects: [31-02-PLAN, scoring, ci-pipeline]

tech-stack:
  added: []
  patterns: [text-pattern-matching-normalization, multi-language-advisory-parsing]

key-files:
  created: []
  modified:
    - src/pipeline/types.ts
    - src/pipeline/fetchers/advisories.ts
    - src/pipeline/normalize/advisory-levels.ts
    - src/pipeline/scoring/engine.ts
    - src/pipeline/config/sources.json

key-decisions:
  - "Extended advisory level aggregation array to include tier2b sources for hard-cap and blending calculations"
  - "Added tier2b advisory info loading in computeAllScores alongside existing tier1/tier2a loaders"

patterns-established:
  - "Tier 2b normalization: text-pattern matching for 6 languages (French, Danish, English, Romanian numeric, Estonian, Croatian, Spanish)"

requirements-completed: [HTML-09, HTML-10, HTML-11, HTML-12, HTML-13, HTML-14, HTML-15, HTML-16]

duration: 2min
completed: 2026-03-26
---

# Phase 31 Plan 01: Tier 2b Types, Normalization, Engine, and Config Summary

**Extended pipeline types, scoring engine, and normalization with 8 new Tier 2b advisory sources (Belgium, Denmark, Singapore, Romania, Serbia, Estonia, Croatia, Argentina)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T20:12:06Z
- **Completed:** 2026-03-26T20:14:07Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended ScoredCountry.advisories and AdvisoryInfoMap with 8 new tier2b keys
- Added 8 normalization functions covering French, Danish, English, Romanian (numeric), Estonian, Croatian, and Spanish advisory text patterns
- Extended engine indicator-to-source mapping and advisory level aggregation for tier2b sources
- Added advisories_tier2b source config entry and tier2b info loading in scoring pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types, AdvisoryInfoMap, engine, and sources.json** - `2ea0ba0` (feat)
2. **Task 2: Add normalization functions for 8 Tier 2b sources** - `ea94986` (feat)

## Files Created/Modified
- `src/pipeline/types.ts` - Added be, dk, sg, ro, rs, ee, hr, ar optional keys to ScoredCountry.advisories
- `src/pipeline/fetchers/advisories.ts` - Added same 8 keys to AdvisoryInfoMap type
- `src/pipeline/normalize/advisory-levels.ts` - Added 8 normalization functions (normalizeBeLevel, normalizeDkLevel, normalizeSgLevel, normalizeRoLevel, normalizeRsLevel, normalizeEeLevel, normalizeHrLevel, normalizeArAlert)
- `src/pipeline/scoring/engine.ts` - Extended indicator-to-source map, advisory aggregation, local type, SOURCE_CATALOG description, and tier2b info loading
- `src/pipeline/config/sources.json` - Added advisories_tier2b entry

## Decisions Made
- Extended advisory level aggregation array to include all tier2b sources so they participate in hard-cap and low-data blending calculations
- Added tier2b advisory info loading in computeAllScores alongside existing tier1/tier2a loaders for seamless integration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended engine advisory aggregation and info loading**
- **Found during:** Task 1
- **Issue:** Plan only specified adding indicator-to-source mappings in engine.ts, but the advisory level aggregation array, computeCountryScore signature, local AdvisoryInfoMap type, and computeAllScores info loading also needed tier2b keys for correct scoring behavior
- **Fix:** Extended all 5 locations in engine.ts: function signature, advisory levels array, local type alias, SOURCE_CATALOG description, and added tier2b info loading block
- **Files modified:** src/pipeline/scoring/engine.ts
- **Verification:** TypeScript compiles, all tier2b keys present in all required locations
- **Committed in:** 2ea0ba0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for tier2b sources to actually participate in scoring. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All type contracts, normalization functions, engine mappings, and config ready for Plan 02 (fetcher implementation)
- No blockers

---
*Phase: 31-tier-2-html-sources-batch-2*
*Completed: 2026-03-26*

## Self-Check: PASSED
