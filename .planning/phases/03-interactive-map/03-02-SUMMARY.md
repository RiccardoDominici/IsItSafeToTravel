---
phase: 03-interactive-map
plan: 02
subsystem: ui
tags: [astro, d3, choropleth, i18n, safety-map]

# Dependency graph
requires:
  - phase: 03-01
    provides: SafetyMap.astro component with D3 choropleth, map-utils, topojson
  - phase: 02-data-pipeline
    provides: DailySnapshot type, latest.json score data
provides:
  - Homepage hero with live interactive safety map on both /en/ and /it/ locales
  - Build-time score data loading with graceful degradation
affects: [04-country-pages, 05-about-methodology]

# Tech tracking
tech-stack:
  added: []
  patterns: [build-time JSON loading via node:fs, viewport-filling map layout]

key-files:
  created: []
  modified:
    - src/pages/en/index.astro
    - src/pages/it/index.astro

key-decisions:
  - "Viewport-filling map with calc(100vh - 4rem) minus header height"
  - "Build-time score loading via node:fs with empty-array fallback"
  - "Compact tagline replaces hero.subtitle on homepage"

patterns-established:
  - "Score data loading: build-time fs.readFileSync with try/catch for missing data"

requirements-completed: [MAP-01, MAP-03]

# Metrics
duration: 1min
completed: 2026-03-19
---

# Phase 03 Plan 02: Homepage Map Integration Summary

**SafetyMap wired into both locale homepages replacing placeholder, with build-time score loading and viewport-filling layout**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-19T11:28:02Z
- **Completed:** 2026-03-19T11:28:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced placeholder content on both /en/ and /it/ homepages with live SafetyMap component
- Build-time score data loading from data/scores/latest.json with graceful empty-array fallback
- Map fills viewport below header with compact localized tagline

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace homepage placeholder with SafetyMap component** - `316d8da` (feat)
2. **Task 2: Verify interactive map on homepage** - auto-approved checkpoint (no commit)

## Files Created/Modified
- `src/pages/en/index.astro` - English homepage with SafetyMap, build-time score loading, viewport layout
- `src/pages/it/index.astro` - Italian homepage with identical structure, lang='it'

## Decisions Made
- Used `calc(100vh - 4rem)` for map section height to fill viewport minus header
- Replaced `hero.subtitle` with shorter `map.tagline` on homepage for more map space
- Node.js fs module for build-time data loading (Astro SSG runs in Node)
- Empty array fallback when pipeline data not yet available

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Interactive map fully integrated as homepage hero on both locales
- Ready for Phase 04 (country detail pages) - click navigation URLs already wired
- Pipeline data (latest.json) will populate map colors once Phase 02 pipeline runs

## Self-Check: PASSED

- FOUND: src/pages/en/index.astro
- FOUND: src/pages/it/index.astro
- FOUND: commit 316d8da

---
*Phase: 03-interactive-map*
*Completed: 2026-03-19*
