---
phase: 13-pillar-explanations
plan: 01
subsystem: ui
tags: [i18n, methodology, astro, html-details, accessibility]

# Dependency graph
requires: []
provides:
  - Expandable pillar explanation sections on methodology page (EN + IT)
  - Translation keys for all 5 pillar descriptions, sources, and score interpretations
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native HTML <details>/<summary> for expandable sections (no JS needed)"
    - "Dynamic pillar rendering via weightsConfig.pillars.map() with template literal i18n keys"

key-files:
  created: []
  modified:
    - src/i18n/ui.ts
    - src/pages/en/methodology/index.astro
    - src/pages/it/metodologia/index.astro

key-decisions:
  - "Used native HTML details/summary instead of JavaScript accordion for zero-JS expandable sections"
  - "Pillar labels (sources, low/high score) use separate i18n keys for proper localization"

patterns-established:
  - "Expandable content sections: use <details>/<summary> with Tailwind sand-* styling and dark mode variants"

requirements-completed: [EXPL-01]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 13 Plan 01: Pillar Explanations Summary

**Expandable pillar explanation sections on methodology page with description, data sources, and score interpretation for all 5 safety categories in EN and IT**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T10:30:30Z
- **Completed:** 2026-03-20T10:33:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added 30 translation keys per language (60 total) covering all 5 pillar explanations
- Both EN and IT methodology pages now have expandable sections after Category Weights table
- Each section shows: what the pillar measures, data sources, and what low/high scores mean for travelers
- Zero JavaScript -- uses native HTML `<details>/<summary>` elements

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pillar explanation i18n keys for EN and IT** - `9fe27c0` (feat)
2. **Task 2: Add expandable pillar sections to EN and IT methodology pages** - `2a2fb11` (feat)

## Files Created/Modified
- `src/i18n/ui.ts` - Added 60 translation keys (30 EN + 30 IT) for pillar titles, descriptions, sources, low/high score interpretations, section labels
- `src/pages/en/methodology/index.astro` - Added Understanding Each Category section with 5 expandable pillar blocks
- `src/pages/it/metodologia/index.astro` - Added identical section structure with Italian translations

## Decisions Made
- Used native HTML `<details>/<summary>` instead of JavaScript accordion -- no JS dependency, accessible by default
- Added separate i18n keys for UI labels (sources_label, low_label, high_label) rather than hardcoding English text

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Methodology page now fully documents all safety pillars with interactive expandable sections
- Content is factually accurate and references actual indicators from weights.json

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 13-pillar-explanations*
*Completed: 2026-03-20*
