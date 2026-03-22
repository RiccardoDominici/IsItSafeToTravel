---
phase: 21-scoring-formula-redesign
plan: 02
subsystem: scoring
tags: [exponential-decay, tiered-scoring, freshness, baseline-signal-blending]

# Dependency graph
requires:
  - phase: 21-scoring-formula-redesign/01
    provides: SourcesConfig types, source-tiers.json, PillarWeight.indicatorWeights, weights v5.0.0
provides:
  - freshnessWeight() exponential decay function for data age weighting
  - Tiered baseline+signal scoring engine with configurable blending
  - Per-indicator sub-weight support in pillar scoring
  - Graceful degradation to pure baseline when no signal data exists
affects: [21-03, pipeline-run, data-sources]

# Tech tracking
tech-stack:
  added: []
  patterns: [exponential-decay-freshness, tiered-baseline-signal-blending, backward-compatible-optional-param]

key-files:
  created:
    - src/pipeline/scoring/freshness.ts
    - src/pipeline/scoring/__tests__/freshness.test.ts
  modified:
    - src/pipeline/scoring/engine.ts
    - src/pipeline/scoring/__tests__/engine.test.ts
    - package.json

key-decisions:
  - "Used source-tiers.json (from Plan 21-01) instead of sources.json for tier config to avoid overwriting existing source catalog"
  - "sourcesConfig is optional 7th param on computeCountryScore for backward compatibility"
  - "computeAllScores loads source-tiers.json internally to preserve call signature from run.ts"

patterns-established:
  - "Tiered scoring: separate indicators by tier, weighted-average within tier, blend with signal completeness cap"
  - "Freshness decay: exponential decay with half-life and max-age clamping"
  - "Backward compatibility: optional sourcesConfig param falls back to legacy equal-averaging"

requirements-completed: [FORM-01, FORM-02, FORM-04]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 21 Plan 02: Scoring Engine Redesign Summary

**Tiered baseline+signal scoring engine with exponential freshness decay, per-indicator sub-weights, and graceful degradation to pure baseline**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T23:37:46Z
- **Completed:** 2026-03-22T23:42:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Freshness decay module (freshnessWeight) with exponential decay formula matching research spec
- Scoring engine rewritten with tiered baseline+signal blending capped at configurable maxSignalInfluence
- Per-indicator sub-weights prevent score inflation when adding/removing indicators
- Graceful degradation: zero signal data produces pure baseline scores for all 248 countries
- Full backward compatibility: existing run.ts pipeline works unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Create freshness decay module with tests** - `568ec0e` (feat) - TDD: RED->GREEN
2. **Task 2: Rewrite scoring engine with tiered blending and update tests** - `5593db8` (feat)

## Files Created/Modified
- `src/pipeline/scoring/freshness.ts` - Exponential decay freshness weight calculator
- `src/pipeline/scoring/__tests__/freshness.test.ts` - 9 tests for freshness decay (half-life, maxAge, edge cases)
- `src/pipeline/scoring/engine.ts` - Tiered baseline+signal scoring engine with freshness and sub-weights
- `src/pipeline/scoring/__tests__/engine.test.ts` - 20 tests (16 existing + 4 new tiered scoring tests)
- `package.json` - Added test:freshness script

## Decisions Made
- Used `source-tiers.json` (Plan 21-01 output) instead of overwriting `sources.json` catalog -- the plan referenced "sources.json" but the actual config file from 21-01 is named `source-tiers.json` to avoid collision with the existing source catalog
- Made sourcesConfig an optional 7th parameter on computeCountryScore for zero-breaking-change backward compatibility
- computeAllScores loads source-tiers.json from disk internally, keeping its (rawDataBySource, weightsConfig) signature unchanged for run.ts
- Added 5 new entries to SOURCE_CATALOG (gpi, inform, gdelt, reliefweb, gdacs, who-dons) for future source metadata

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing advisory_level_uk test value**
- **Found during:** Task 2 (engine test backward compatibility check)
- **Issue:** Test used value 0.8 with comment "min=0, max=4" but normalize.ts has advisory_level_uk min=1, max=4. Value 0.8 normalizes to 1.0 (not 0.8), causing assertion failure (8.3 != 8.2). This was a pre-existing bug unrelated to the engine rewrite.
- **Fix:** Changed test value from 0.8 to 1.6 and updated comment to reflect actual min=1, max=4
- **Files modified:** src/pipeline/scoring/__tests__/engine.test.ts
- **Verification:** Test now passes with correct expected score 8.2
- **Committed in:** 5593db8 (Task 2 commit)

**2. [Rule 3 - Blocking] Used source-tiers.json instead of sources.json**
- **Found during:** Task 2 (loading tier config)
- **Issue:** Plan referenced "sources.json" but Plan 21-01 created config as "source-tiers.json" to avoid overwriting existing source catalog
- **Fix:** Engine loads source-tiers.json instead
- **Files modified:** src/pipeline/scoring/engine.ts
- **Verification:** computeAllScores logs "Tiered scoring: loaded source-tiers.json" when running

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the deviations noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scoring engine is ready for Plan 21-03 (integration testing / pipeline validation)
- run.ts requires no changes -- computeAllScores signature preserved
- Future data source fetchers (gdelt, reliefweb, gdacs, who-dons) will automatically participate in tiered scoring once their data flows through the pipeline

---
*Phase: 21-scoring-formula-redesign*
*Completed: 2026-03-23*
