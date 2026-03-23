---
phase: 25-who-dons-fetcher
plan: 01
subsystem: pipeline
tags: [who, disease-outbreaks, fetcher, health]

requires:
  - phase: 24-gdelt-fetcher
    provides: Established fetcher pattern with cache fallback
provides:
  - WHO DONs fetcher module (fetchWhoDons)
  - who_active_outbreaks indicator per country
affects: [25-02, scoring, health-pillar]

tech-stack:
  added: []
  patterns: [title-parsing country extraction from WHO DON titles]

key-files:
  created: [src/pipeline/fetchers/who-dons.ts]
  modified: []

key-decisions:
  - "Country extraction uses dash-split then in-split fallback on DON titles"
  - "90-day window for active outbreaks counted from pipeline date parameter"

patterns-established:
  - "Title parsing: split on ' - ' for 'Disease - Country', fallback to ' in ' for 'Disease in Country'"

requirements-completed: []

duration: 2min
completed: 2026-03-23
---

# Phase 25 Plan 01: WHO DONs Fetcher Summary

**WHO Disease Outbreak News fetcher parsing DON titles to extract per-country active outbreak counts with 90-day window and cache fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T01:03:35Z
- **Completed:** 2026-03-23T01:05:35Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created WHO DONs fetcher module following established gdacs.ts pattern
- Title-based country extraction using "Disease - Country" and "Disease in Country" patterns
- 90-day active outbreak window with per-country counting
- Cache fallback via findLatestCached on API failure

## Task Commits

Each task was committed atomically:

1. **Task 1: Create WHO DONs fetcher module** - `7bddcd6` (feat)

## Files Created/Modified
- `src/pipeline/fetchers/who-dons.ts` - WHO DONs fetcher with title parsing, country resolution, and cache fallback

## Decisions Made
- Country extraction uses two-pass parsing: first split on " - " (most common DON title format), then fallback to " in " pattern
- Parenthetical sub-regions stripped from title segments before country lookup
- 90-day window calculated from the pipeline date parameter, not current date

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WHO DONs fetcher ready to be wired into pipeline (Plan 25-02)
- Needs registration in fetchers/index.ts, normalization range, and health pillar weight update

---
*Phase: 25-who-dons-fetcher*
*Completed: 2026-03-23*
