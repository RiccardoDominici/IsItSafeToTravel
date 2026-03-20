---
phase: 11-bug-fixes
plan: 01
subsystem: ui
tags: [d3, utcFormat, timezone, dropdown, mousedown, blur]

# Dependency graph
requires:
  - phase: 10-comparison
    provides: "Comparison page with client-side D3 charts and search dropdown"
provides:
  - "UTC-safe date parsing across all chart components"
  - "Reliable dropdown selection via mousedown+relatedTarget pattern"
affects: [12-chart-migration, 13-category-filtering]

# Tech tracking
tech-stack:
  added: []
  patterns: ["UTC date parsing with T00:00:00Z suffix", "utcFormat for d3 axis labels", "mousedown+preventDefault for dropdown selection", "relatedTarget blur check instead of setTimeout"]

key-files:
  created: []
  modified:
    - src/components/country/TrendChart.astro
    - src/pages/en/global-safety.astro
    - src/pages/it/sicurezza-globale.astro
    - src/pages/en/compare.astro
    - src/pages/it/confronta.astro

key-decisions:
  - "Use T00:00:00Z suffix on date strings rather than changing to UTC-only d3 methods throughout"
  - "Use mousedown+preventDefault instead of pointerdown for broader compatibility with existing blur flow"

patterns-established:
  - "UTC date parsing: Always append T00:00:00Z when constructing Date from YYYY-MM-DD strings"
  - "Dropdown interaction: Use mousedown with preventDefault on items, relatedTarget check in blur handler"

requirements-completed: [BUG-01, BUG-02]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 11 Plan 01: Bug Fixes Summary

**UTC date parsing across 5 chart files to prevent timezone day-shift, plus mousedown-based dropdown fix for reliable country selection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T09:43:17Z
- **Completed:** 2026-03-20T09:47:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Fixed date axis labels showing wrong day in timezones behind UTC by appending T00:00:00Z to all date string parsing and using utcFormat for axis tick formatting
- Fixed comparison page search dropdown race condition where blur event's setTimeout would hide dropdown before click registered
- Both fixes applied consistently across English and Italian locale pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix trend chart date axis timezone shift** - `ada3f35` (fix)
2. **Task 2: Fix comparison search dropdown race condition** - `16c2bd3` (fix)

## Files Created/Modified
- `src/components/country/TrendChart.astro` - UTC date parsing (6 occurrences) and utcFormat for axis labels
- `src/pages/en/global-safety.astro` - UTC date parsing (3 occurrences) and utcFormat
- `src/pages/it/sicurezza-globale.astro` - UTC date parsing (3 occurrences) and utcFormat
- `src/pages/en/compare.astro` - UTC date parsing (3 occurrences), utcFormat, mousedown handler, relatedTarget blur
- `src/pages/it/confronta.astro` - UTC date parsing (3 occurrences), utcFormat, mousedown handler, relatedTarget blur

## Decisions Made
None - followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Clean baseline established for chart migration and new features
- All chart files now use consistent UTC date handling pattern
- Dropdown interaction pattern ready for any future search components

---
*Phase: 11-bug-fixes*
*Completed: 2026-03-20*
