---
phase: 08-global-safety-score-ui
plan: 01
subsystem: ui
tags: [astro, i18n, component, homepage, global-score]

requires:
  - phase: 07-pipeline-extensions
    provides: globalScore in DailySnapshot, history-index.json with global history
provides:
  - GlobalScoreBanner.astro component for homepage display
  - All i18n keys for Phase 8 global safety features (EN + IT)
  - Route slugs for global-safety page in both languages
affects: [08-02-global-safety-page]

tech-stack:
  added: []
  patterns: [conditional-render banner based on data availability]

key-files:
  created:
    - src/components/GlobalScoreBanner.astro
  modified:
    - src/i18n/ui.ts
    - src/pages/en/index.astro
    - src/pages/it/index.astro

key-decisions:
  - "Banner renders conditionally only when snapshot exists and globalScore > 0"
  - "Compact horizontal bar design with score badge, label, and chevron arrow"

patterns-established:
  - "Global score banner pattern: load snapshot at build time, render colored badge with scoreToColor"

requirements-completed: [GLOB-01, GLOB-02]

duration: 2min
completed: 2026-03-19
---

# Phase 8 Plan 01: Global Score Banner & i18n Summary

**GlobalScoreBanner component on both homepages with color-coded score badge, linking to global safety page, plus all Phase 8 i18n keys**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T19:58:14Z
- **Completed:** 2026-03-19T19:59:54Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added 11 translation keys for global safety features in both EN and IT
- Added global-safety route slugs (global-safety / sicurezza-globale)
- Created GlobalScoreBanner.astro with score badge colored via scoreToColor
- Integrated banner on both EN and IT homepages between tagline and map

## Task Commits

Each task was committed atomically:

1. **Task 1: Add i18n keys and route slug** - `1e753a8` (feat)
2. **Task 2: Create GlobalScoreBanner and add to homepages** - `ba8539d` (feat)

## Files Created/Modified
- `src/i18n/ui.ts` - Added 22 translation keys (11 EN + 11 IT) and 2 route slugs
- `src/components/GlobalScoreBanner.astro` - Compact clickable banner with score badge
- `src/pages/en/index.astro` - Import and render GlobalScoreBanner
- `src/pages/it/index.astro` - Import and render GlobalScoreBanner

## Decisions Made
- Banner renders conditionally (only when snapshot exists and globalScore > 0) to avoid empty state
- Used compact horizontal bar design to minimize vertical space above the map

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All i18n keys for the global safety page (Plan 02) are in place
- Route slugs ready for /en/global-safety and /it/sicurezza-globale pages
- GlobalScoreBanner links to the global safety page which Plan 02 will create

---
*Phase: 08-global-safety-score-ui*
*Completed: 2026-03-19*
