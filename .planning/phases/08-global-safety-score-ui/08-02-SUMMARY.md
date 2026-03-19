---
phase: 08-global-safety-score-ui
plan: 02
subsystem: ui
tags: [astro, d3, seo, json-ld, svg, i18n]

# Dependency graph
requires:
  - phase: 08-01
    provides: i18n keys, GlobalScoreBanner component, scores.ts loadGlobalHistory
  - phase: 07-01
    provides: history-index.json with global score history
provides:
  - Dedicated global safety page at /en/global-safety and /it/sicurezza-globale
  - buildGlobalSafetyJsonLd SEO function
  - Full-size D3 trend chart with labeled axes (build-time SVG)
affects: [09-comparison-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [full-size build-time D3 SVG chart with scaleTime axis, AggregateRating JSON-LD]

key-files:
  created:
    - src/pages/en/global-safety.astro
    - src/pages/it/sicurezza-globale.astro
  modified:
    - src/lib/seo.ts

key-decisions:
  - "Used scaleTime for X axis (date labels) instead of index-based scale for better temporal accuracy"
  - "AggregateRating JSON-LD with ratingCount 248 for global coverage"

patterns-established:
  - "Full-size D3 trend chart: scaleTime X axis + scaleLinear Y axis with gridlines and labeled ticks"
  - "Global safety JSON-LD: WebPage + AggregateRating @graph pattern"

requirements-completed: [GLOB-02, GLOB-03, GLOB-04]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 08 Plan 02: Global Safety Page Summary

**Dedicated global safety pages (EN/IT) with color-coded score hero, build-time D3 trend chart with labeled axes, methodology section, and AggregateRating JSON-LD**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T20:01:46Z
- **Completed:** 2026-03-19T20:03:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added buildGlobalSafetyJsonLd to seo.ts with WebPage + AggregateRating structured data
- Created EN and IT global safety pages with score hero, full-size D3 SVG trend chart, and methodology
- Build succeeds with both /en/global-safety/ and /it/sicurezza-globale/ routes generated

## Task Commits

Each task was committed atomically:

1. **Task 1: Add buildGlobalSafetyJsonLd to seo.ts** - `2f6b9b9` (feat)
2. **Task 2: Create global safety pages (EN + IT) with trend chart** - `2d09b7d` (feat)

## Files Created/Modified
- `src/lib/seo.ts` - Added buildGlobalSafetyJsonLd function with WebPage + AggregateRating JSON-LD
- `src/pages/en/global-safety.astro` - English global safety page with score hero, D3 chart, methodology
- `src/pages/it/sicurezza-globale.astro` - Italian global safety page (identical structure, lang='it')

## Decisions Made
- Used scaleTime for X axis labels (date-based) rather than index-based scale, giving better temporal distribution
- AggregateRating JSON-LD uses ratingCount of 248 representing all countries in the database

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Global safety pages complete, ready for comparison page (Phase 09)
- D3 full-size chart pattern established and can be reused for comparison charts

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 08-global-safety-score-ui*
*Completed: 2026-03-19*
