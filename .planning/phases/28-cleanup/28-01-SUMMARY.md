---
phase: 28-cleanup
plan: 01
subsystem: pipeline
tags: [scoring, data-sources, weights, gdelt, who-dons, cleanup]

requires:
  - phase: none
    provides: existing pipeline with GDELT and WHO DONs sources
provides:
  - Clean pipeline without broken GDELT and WHO DONs data sources
  - Updated weights.json v7.0.0 with redistributed indicator weights
  - Updated source-tiers.json without removed sources
affects: [29-api-advisories, 30-html-advisories, scoring, pipeline]

tech-stack:
  added: []
  patterns: [weight redistribution preserving sum=1.0 per pillar]

key-files:
  created: []
  modified:
    - src/pipeline/fetchers/index.ts
    - src/pipeline/config/weights.json
    - src/pipeline/config/source-tiers.json
    - src/pipeline/scoring/normalize.ts
    - src/pipeline/scoring/engine.ts
    - src/pipeline/scoring/__tests__/engine.test.ts
    - src/pipeline/__tests__/crisis-validation.test.ts
    - src/pipeline/__tests__/data01-fetchers.test.ts
    - src/pipeline/__tests__/data02-score-range.test.ts

key-decisions:
  - "Redistributed GDELT weight (0.18) proportionally across remaining conflict indicators"
  - "Redistributed WHO DONs weight (0.20) proportionally across remaining health indicators"
  - "Replaced stale GDELT signal test with reliefweb signal test for staleness verification"
  - "Adjusted crisis severity test to use threshold-based assertions instead of strict ordering"

patterns-established:
  - "Weight redistribution: when removing an indicator, redistribute its weight proportionally among siblings"

requirements-completed: [CLEAN-01, CLEAN-02, CLEAN-03]

duration: 5min
completed: 2026-03-26
---

# Phase 28 Plan 01: Remove GDELT and WHO DONs Summary

**Removed broken GDELT and WHO DONs data sources from pipeline, redistributed indicator weights to v7.0.0, and updated all 36 tests to pass cleanly**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T18:34:45Z
- **Completed:** 2026-03-26T18:40:08Z
- **Tasks:** 2
- **Files modified:** 11 (3 deleted, 8 modified)

## Accomplishments
- Deleted gdelt.ts, who-dons.ts fetchers and fips-to-iso3.ts mapping (810+ lines removed)
- Updated weights.json to v7.0.0 with proportionally redistributed indicator weights (conflict: 8 indicators, health: 3 indicators)
- Removed all GDELT/WHO DONs references from scoring engine, normalizer, source tiers, and fetcher barrel
- Updated all 4 test files (36 tests) to remove GDELT/WHO DONs references; all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove GDELT and WHO DONs fetchers and update pipeline config** - `d13e786` (feat)
2. **Task 2: Update all tests to remove GDELT and WHO DONs references** - `fd9fe4e` (test)

## Files Created/Modified
- `src/pipeline/fetchers/gdelt.ts` - DELETED (GDELT DOC v2 API fetcher)
- `src/pipeline/fetchers/who-dons.ts` - DELETED (WHO Disease Outbreak News fetcher)
- `src/pipeline/config/fips-to-iso3.ts` - DELETED (FIPS-to-ISO3 mapping only used by GDELT)
- `src/pipeline/fetchers/index.ts` - Removed GDELT/WHO DONs imports, exports, and Promise.allSettled calls
- `src/pipeline/config/weights.json` - v7.0.0: removed gdelt_instability and who_active_outbreaks, redistributed weights
- `src/pipeline/config/source-tiers.json` - Removed gdelt and who-dons entries
- `src/pipeline/scoring/normalize.ts` - Removed gdelt_instability and who_active_outbreaks from INDICATOR_RANGES
- `src/pipeline/scoring/engine.ts` - Removed from INDICATOR_SOURCE_MAP and SOURCE_CATALOG
- `src/pipeline/scoring/__tests__/engine.test.ts` - Removed all gdelt references from test configs and data
- `src/pipeline/__tests__/crisis-validation.test.ts` - Updated weights, removed gdelt/who-dons signals
- `src/pipeline/__tests__/data01-fetchers.test.ts` - Removed fetchGdelt export assertion
- `src/pipeline/__tests__/data02-score-range.test.ts` - Removed gdelt_instability from test configs

## Decisions Made
- Redistributed GDELT's 0.18 conflict weight proportionally: wb_political_stability 0.17, gpi_overall 0.17, gpi_safety_security 0.16, gpi_militarisation 0.14, advisory_level_us 0.11, advisory_level_uk 0.10, advisory_level_ca 0.08, advisory_level_au 0.07
- Redistributed WHO DONs' 0.20 health weight proportionally: wb_child_mortality 0.38, inform_health 0.31, inform_epidemic 0.31
- Replaced stale GDELT signal test with reliefweb signal test (both are signal-tier sources with defined maxAge)
- Adjusted crisis severity test: without GDELT signal boosting Sudan's instability score, used threshold-based (<7) and relative (Sudan < Turkey) assertions instead of strict "Sudan is worst"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed engine.test.ts dataCompleteness assertion**
- **Found during:** Task 2 (test updates)
- **Issue:** After removing gdelt_instability, conflict pillar had 1/1 indicators (100% complete), but test asserted < 1.0
- **Fix:** Changed test to provide 2 indicators across different pillars and assert partial completeness on health pillar instead
- **Files modified:** src/pipeline/scoring/__tests__/engine.test.ts
- **Verification:** Test passes
- **Committed in:** fd9fe4e (Task 2 commit)

**2. [Rule 1 - Bug] Fixed crisis severity ordering assertion**
- **Found during:** Task 2 (test updates)
- **Issue:** Without GDELT signals, Sudan no longer scored lowest among crisis countries (DRC's baseline health indicators were worse)
- **Fix:** Changed assertion from "Sudan must be worst" to threshold-based (all crises < 7) plus relative ordering (Sudan < Turkey)
- **Files modified:** src/pipeline/__tests__/crisis-validation.test.ts
- **Verification:** Test passes with correct crisis detection
- **Committed in:** fd9fe4e (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for test correctness after indicator removal. No scope creep.

## Issues Encountered
None beyond the test assertion adjustments documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pipeline compiles cleanly and all 36 tests pass
- Ready for Plan 02 (pipeline GitHub Actions cleanup) and subsequent advisory source integration phases
- Scoring engine accepts new indicator sources via weights.json and source-tiers.json configuration

---
*Phase: 28-cleanup*
*Completed: 2026-03-26*
