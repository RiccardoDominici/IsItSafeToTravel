---
phase: 34-scoring-integration
plan: 01
subsystem: scoring
tags: [weights, normalization, advisory, conflict-pillar, source-tiers]

requires:
  - phase: 33-tier-3-complex-sources-batch-2
    provides: All 37 advisory fetchers producing data
provides:
  - "weights.json v8.0.0 with 41 conflict indicators (4 baseline + 37 advisory)"
  - "source-tiers.json with all 37 advisory sources as signal tier"
  - "normalize.ts INDICATOR_RANGES for all 37 advisory indicators"
affects: [34-02, 35-cicd-automation, 37-calibration-validation]

tech-stack:
  added: []
  patterns: ["Diminishing weight tiers: original > tier1 > tier2a > tier2b > tier3a > tier3b"]

key-files:
  created: []
  modified:
    - src/pipeline/config/weights.json
    - src/pipeline/config/source-tiers.json
    - src/pipeline/scoring/normalize.ts

key-decisions:
  - "Advisory sub-weights use diminishing tiers: original 4 (0.025-0.026), tier1 (0.018), tier2a (0.010), tier2b (0.007), tier3a (0.005), tier3b (0.003)"
  - "Total advisory weight remains 0.36 (36% of conflict pillar), baseline unchanged at 0.64"

patterns-established:
  - "Diminishing weight pattern: higher-trust sources (established APIs) get more weight than complex scraped sources"

requirements-completed: [NORM-02, NORM-03]

duration: 2min
completed: 2026-03-27
---

# Phase 34 Plan 01: Scoring Config Summary

**weights.json v8.0.0 with 41 conflict indicators, source-tiers.json for 37 advisory sources, and normalize.ts ranges for all advisory indicators**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-27T09:45:57Z
- **Completed:** 2026-03-27T09:47:59Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Updated weights.json to v8.0.0 with 41 conflict pillar indicators (4 baseline + 37 advisory) with diminishing sub-weights summing to 1.0
- Added 29 new advisory sources to source-tiers.json as signal tier with 7-day decay and 30-day max-age
- Added 29 advisory indicator normalization ranges to normalize.ts so advisory data flows through scoring instead of being silently dropped

## Task Commits

Each task was committed atomically:

1. **Task 1: Update weights.json and source-tiers.json** - `3616a63` (feat)
2. **Task 2: Add 29 advisory indicators to normalize.ts** - `aec30a4` (feat)

## Files Created/Modified
- `src/pipeline/config/weights.json` - v8.0.0 with 41 conflict indicators and diminishing advisory sub-weights
- `src/pipeline/config/source-tiers.json` - 37 advisory sources (8 existing + 29 new) as signal tier
- `src/pipeline/scoring/normalize.ts` - 37 advisory_level_XX entries in INDICATOR_RANGES (8 existing + 29 new)

## Decisions Made
- Advisory sub-weights follow diminishing tiers based on source reliability: original Five Eyes sources (0.025-0.026) get highest advisory weight, followed by Tier 1 API (0.018), Tier 2a HTML (0.010), Tier 2b HTML (0.007), Tier 3a complex (0.005), Tier 3b complex (0.003)
- Total advisory weight is exactly 0.36, preserving the 64/36 baseline/signal split in the conflict pillar

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 37 advisory sources are now registered in config and normalization
- Ready for 34-02 (pipeline verification with expanded advisory set)
- Advisory data from all tiers will now flow through normalization and weighted scoring

---
*Phase: 34-scoring-integration*
*Completed: 2026-03-27*
