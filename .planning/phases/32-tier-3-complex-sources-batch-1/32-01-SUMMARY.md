---
phase: 32-tier-3-complex-sources-batch-1
plan: 01
subsystem: pipeline
tags: [advisory, normalization, typescript, tier3a, italy, spain, korea, taiwan, china, india]

requires:
  - phase: 31-tier-2b-structured-html-batch-2
    provides: AdvisoryInfoMap with tier2b keys, tier2b normalization functions
provides:
  - AdvisoryInfoMap and ScoredCountry.advisories extended with it/es/kr/tw/cn/in keys
  - 6 normalization functions for tier 3a advisory sources
  - advisories_tier3a entry in sources.json
affects: [32-02-PLAN, scoring-engine, ci-workflow]

tech-stack:
  added: []
  patterns: [text-based normalization with toLowerCase, numeric clamping for direct 1-4 mapping, Chinese character matching without toLowerCase]

key-files:
  created: []
  modified:
    - src/pipeline/fetchers/advisories.ts
    - src/pipeline/types.ts
    - src/pipeline/normalize/advisory-levels.ts
    - src/pipeline/config/sources.json

key-decisions:
  - "Chinese normalization (normalizeCnLevel) matches Chinese characters directly without toLowerCase since Chinese has no case"
  - "Korean level system maps 1:1 to unified scale, reusing same pattern as normalizeJpLevel"

patterns-established:
  - "Tier 3a normalization: text-based matching for Italian, Spanish, Indian; numeric for Korean; color+Chinese for Taiwanese; Chinese characters for China"

requirements-completed: [CPLX-01, CPLX-02, CPLX-03, CPLX-04, CPLX-05, CPLX-06]

duration: 1min
completed: 2026-03-26
---

# Phase 32 Plan 01: Tier 3a Types, Normalization, and Config Summary

**Extended AdvisoryInfoMap/ScoredCountry with 6 tier 3a source keys and added normalization functions for Italian, Spanish, Korean, Taiwanese, Chinese, and Indian advisory text**

## Performance

- **Duration:** 82s
- **Started:** 2026-03-26T20:35:52Z
- **Completed:** 2026-03-26T20:37:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended AdvisoryInfoMap and ScoredCountry.advisories types with it/es/kr/tw/cn/in optional keys
- Added 6 normalization functions covering diverse level systems (Italian text, Spanish text, Korean numeric, Taiwanese color/Chinese, Chinese characters, Indian English)
- Added advisories_tier3a entry to sources.json config

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend type definitions and sources config** - `aef1e6f` (feat)
2. **Task 2: Add 6 normalization functions for tier3a sources** - `0c22459` (feat)

## Files Created/Modified
- `src/pipeline/fetchers/advisories.ts` - Added it/es/kr/tw/cn/in keys to AdvisoryInfoMap type and updated JSDoc
- `src/pipeline/types.ts` - Added it/es/kr/tw/cn/in keys to ScoredCountry.advisories
- `src/pipeline/normalize/advisory-levels.ts` - Added normalizeItLevel, normalizeEsLevel, normalizeKrLevel, normalizeTwLevel, normalizeCnLevel, normalizeInLevel
- `src/pipeline/config/sources.json` - Added advisories_tier3a source entry

## Decisions Made
- Chinese normalization (normalizeCnLevel) matches Chinese characters directly without toLowerCase since Chinese has no case
- Korean level system maps 1:1 to unified scale, reusing same clamping pattern as normalizeJpLevel

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Type contracts and normalization logic ready for Plan 02 (fetcher implementation)
- All 6 normalization functions exported and available for import
- sources.json has tier3a entry for source metadata

---
*Phase: 32-tier-3-complex-sources-batch-1*
*Completed: 2026-03-26*
