---
phase: 22-historical-backfill
plan: 01
subsystem: pipeline
tags: [scoring, backfill, weights, historical-data, pipeline]

# Dependency graph
requires:
  - phase: 02-data-pipeline-and-scoring-engine
    provides: scoring engine, weights config, snapshot writer
  - phase: 07-pipeline-extensions
    provides: history index builder, pillar history support
provides:
  - Backfill script for re-scoring all historical snapshots
  - All 566 snapshots recalculated with weights v4.0.0
  - Rebuilt history-index.json with consistent scoring
affects: [country-detail-pages, comparison, global-safety-score, trend-charts]

# Tech tracking
tech-stack:
  added: []
  patterns: [backfill-rescore-from-raw-data]

key-files:
  created:
    - src/pipeline/backfill.ts
  modified:
    - data/scores/*.json (566 snapshot files)
    - data/scores/history-index.json
    - data/scores/latest.json

key-decisions:
  - "Re-score from raw parsed data without re-fetching, preserving original data collection timestamps"
  - "Batch process all 566 dates sequentially to avoid memory pressure"

patterns-established:
  - "Backfill pattern: load raw data, apply current engine, overwrite snapshots"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 22 Plan 01: Historical Backfill Summary

**Re-scored all 566 historical snapshots (2012-2026) with weights v4.0.0 scoring engine, rebuilding history-index.json for consistent trend data**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T23:54:52Z
- **Completed:** 2026-03-22T23:57:16Z
- **Tasks:** 2
- **Files modified:** 570 (566 snapshots + latest.json + history-index.json + backfill.ts + 1 new file)

## Accomplishments
- Created reusable backfill script at src/pipeline/backfill.ts with --dry-run support
- Recalculated all 566 historical snapshots from raw parsed data using weights v4.0.0
- Rebuilt history-index.json with 566 dates and 248 countries including per-pillar history
- Zero failures across all 566 date directories

## Task Commits

Each task was committed atomically:

1. **Task 1: Create backfill script** - `0066f39` (feat)
2. **Task 2: Run backfill and recalculate all scores** - `e8e91e1` (feat)

## Files Created/Modified
- `src/pipeline/backfill.ts` - Historical backfill script that re-scores all snapshots from raw data
- `data/scores/*.json` - 566 recalculated daily snapshot files (weights v3.0.0 -> v4.0.0)
- `data/scores/latest.json` - Updated to latest date with v4.0.0 weights
- `data/scores/history-index.json` - Rebuilt with 566 dates, 248 countries, per-pillar history

## Decisions Made
- Re-scored from existing raw parsed JSON files rather than re-fetching from APIs, preserving the original data
- Sequential processing (not parallel) to avoid memory issues with 566 directories
- Updated latest.json to point to the most recent date after backfill

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed FetchResult type mismatch in backfill script**
- **Found during:** Task 1 (backfill script creation)
- **Issue:** Initial FetchResult construction used wrong field name `indicators` instead of `countriesFound`
- **Fix:** Updated to match the actual FetchResult interface with `countriesFound` and `fetchedAt` fields
- **Files modified:** src/pipeline/backfill.ts
- **Verification:** Script compiled and ran successfully
- **Committed in:** 0066f39 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type correction, no scope change.

## Issues Encountered
None - all 566 dates processed successfully with zero failures.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All historical scores use consistent weights v4.0.0
- Backfill script available for future weight changes
- History index fully rebuilt and ready for trend charts

---
*Phase: 22-historical-backfill*
*Completed: 2026-03-23*

## Self-Check: PASSED

All files verified present, all commits verified in git log.
