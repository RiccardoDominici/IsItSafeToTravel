---
phase: 05-search-and-transparency
plan: 02
subsystem: ui
tags: [astro, i18n, methodology, legal, static-pages, transparency]

# Dependency graph
requires:
  - phase: 05-search-and-transparency
    provides: search component, i18n route infrastructure
  - phase: 02-data-pipeline
    provides: weights.json scoring configuration
provides:
  - Methodology page explaining scoring formula, weights, data sources, and limitations (EN/IT)
  - Legal disclaimer page with 5 sections covering liability and official advisory links (EN/IT)
  - Legal route slug in i18n routes object
  - Fixed footer legal link pointing to legal page
affects: [06-polish-and-launch]

# Tech tracking
tech-stack:
  added: []
  patterns: [build-time JSON import for auto-generated content tables]

key-files:
  created:
    - src/pages/en/methodology/index.astro
    - src/pages/it/metodologia/index.astro
    - src/pages/en/legal/index.astro
    - src/pages/it/note-legali/index.astro
  modified:
    - src/i18n/ui.ts
    - src/components/Footer.astro

key-decisions:
  - "Methodology page imports weights.json at build time for auto-generated pillar weights table"
  - "Legal page links to US State Dept, UK FCDO, and EU Consilium advisory pages"

patterns-established:
  - "Static content pages follow thin wrapper pattern: only lang constant differs between EN/IT"
  - "Build-time JSON import for data-driven content tables (weights.json -> methodology page)"

requirements-completed: [TRNS-01, TRNS-02]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 05 Plan 02: Methodology & Legal Pages Summary

**Methodology page with auto-generated scoring weights from weights.json, legal disclaimer with 5 sections and advisory links, footer link fix**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T12:43:53Z
- **Completed:** 2026-03-19T12:47:08Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Methodology pages (EN/IT) render scoring formula, 5 pillar weights auto-generated from weights.json, 5 data sources with descriptions and links, all 12 indicators by category, and limitations section
- Legal pages (EN/IT) render full disclaimer with 5 sections: informational purpose, not travel advice, official advisories, data accuracy, limitation of liability
- Footer legal link now correctly navigates to /{locale}/legal/ or /{locale}/note-legali/
- Added 80+ i18n strings across EN and IT for both page types

## Task Commits

Each task was committed atomically:

1. **Task 1: Add legal route slug, i18n strings, create methodology and legal pages** - `1b5f885` (feat)
2. **Task 2: Fix Footer legal link to point to legal page** - `e461d77` (fix)

## Files Created/Modified
- `src/i18n/ui.ts` - Added legal route slug and 80+ i18n strings for methodology and legal pages (EN/IT)
- `src/pages/en/methodology/index.astro` - EN methodology page with scoring formula, weights table, data sources, limitations
- `src/pages/it/metodologia/index.astro` - IT methodology page (same structure, different lang constant)
- `src/pages/en/legal/index.astro` - EN legal disclaimer with 5 sections and advisory links
- `src/pages/it/note-legali/index.astro` - IT legal disclaimer (same structure, different lang constant)
- `src/components/Footer.astro` - Fixed legal link href from homepage to legal page route

## Decisions Made
- Methodology page imports weights.json at build time so pillar weights table is always in sync with scoring engine
- Legal page links to US State Dept, UK FCDO, and EU Consilium as official advisory resources
- All pages follow thin wrapper pattern where EN/IT pages differ only in lang constant

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 05 complete: search component (Plan 01) and transparency pages (Plan 02) both delivered
- All content pages are zero client JavaScript (static Astro pages)
- Ready for Phase 06 polish and launch

---
*Phase: 05-search-and-transparency*
*Completed: 2026-03-19*
