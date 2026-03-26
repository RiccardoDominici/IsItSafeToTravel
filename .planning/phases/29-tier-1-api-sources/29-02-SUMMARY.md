---
phase: 29-tier-1-api-sources
plan: 02
subsystem: api
tags: [advisory, fetcher, germany, netherlands, japan, slovakia, pipeline]

requires:
  - phase: 29-tier-1-api-sources/plan-01
    provides: advisory-levels.ts normalization module with normalizeDeLevel, normalizeNlColor, normalizeJpLevel, normalizeSkLevel
provides:
  - advisories-tier1.ts with 4 sub-fetchers (DE, NL, JP, SK) producing RawIndicator[] and AdvisoryInfoMap
  - Pipeline registration of fetchTier1Advisories in fetchAllSources
affects: [scoring-engine-weights, ci-pipeline, methodology-docs]

tech-stack:
  added: []
  patterns: [tier1-fetcher-orchestrator, static-mofa-id-mapping, xml-color-extraction]

key-files:
  created:
    - src/pipeline/fetchers/advisories-tier1.ts
  modified:
    - src/pipeline/fetchers/advisories.ts
    - src/pipeline/fetchers/index.ts

key-decisions:
  - "Extended AdvisoryInfoMap type with de/nl/jp/sk keys in advisories.ts"
  - "Used static MOFA page ID to ISO3 mapping (120+ countries) instead of dynamic JS parsing"
  - "Netherlands: iterate all COUNTRIES with concurrency 10, extract colors via regex"
  - "Slovakia: only produce indicators for records with non-empty risk text"

patterns-established:
  - "Tier fetcher pattern: independent sub-fetchers with try/catch, merged results, cache fallback"
  - "Static country ID mapping for non-standard APIs (Japan MOFA)"

requirements-completed: [API-01, API-02, API-03, API-04]

duration: 4min
completed: 2026-03-26
---

# Phase 29 Plan 02: Tier-1 Advisory Fetchers Summary

**4 government advisory fetchers (DE, NL, JP, SK) with independent error handling, cache fallback, and pipeline registration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T19:25:04Z
- **Completed:** 2026-03-26T19:29:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created advisories-tier1.ts with 4 sub-fetchers following exact pattern of existing advisories.ts
- Germany fetcher uses REST JSON API with ISO3 codes and boolean warning flags (normalizeDeLevel)
- Netherlands fetcher iterates all COUNTRIES list with XML color extraction and multi-region handling
- Japan fetcher uses static MOFA page ID to ISO3 mapping (120+ countries) with HTML level scraping
- Slovakia fetcher handles sparse CKAN data, only producing indicators for records with risk text
- Registered fetchTier1Advisories in pipeline for parallel execution via Promise.allSettled

## Task Commits

Each task was committed atomically:

1. **Task 1: Create advisories-tier1.ts with 4 sub-fetchers** - `298aebb` (feat)
2. **Task 2: Register tier1 fetcher in pipeline** - `66d4ad8` (feat)

## Files Created/Modified
- `src/pipeline/fetchers/advisories-tier1.ts` - 4 sub-fetchers (DE, NL, JP, SK) plus orchestrator with cache fallback
- `src/pipeline/fetchers/advisories.ts` - Extended AdvisoryInfoMap type with de/nl/jp/sk keys
- `src/pipeline/fetchers/index.ts` - Import, export, and call fetchTier1Advisories in fetchAllSources

## Decisions Made
- Extended AdvisoryInfoMap in advisories.ts rather than creating a separate type (keeps one canonical type)
- Used static MOFA page ID to ISO3 mapping (120+ entries) instead of dynamic JS file parsing for reliability
- Netherlands uses concurrency 10 (lower than UK's 20) since it's a smaller government API
- Japan uses concurrency 5 to be polite to MOFA servers
- Slovakia logs sparse data warning but still produces indicators for records that have risk levels

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended AdvisoryInfoMap type with new source keys**
- **Found during:** Task 1 (creating advisories-tier1.ts)
- **Issue:** AdvisoryInfoMap in advisories.ts only had us/uk/ca/au keys; tier1 fetcher needed de/nl/jp/sk
- **Fix:** Added de?, nl?, jp?, sk? optional keys to AdvisoryInfoMap type definition
- **Files modified:** src/pipeline/fetchers/advisories.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 298aebb (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type extension was necessary for tier1 fetchers to compile. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. All 4 APIs are free and require no authentication.

## Next Phase Readiness
- All 4 tier-1 advisory fetchers are implemented and registered in the pipeline
- Ready for scoring engine weight updates (future phase) to incorporate new advisory indicators
- Ready for CI pipeline integration to run tier-1 fetchers on daily schedule

## Self-Check: PASSED

- All created files exist on disk
- All commit hashes verified in git log

---
*Phase: 29-tier-1-api-sources*
*Completed: 2026-03-26*
