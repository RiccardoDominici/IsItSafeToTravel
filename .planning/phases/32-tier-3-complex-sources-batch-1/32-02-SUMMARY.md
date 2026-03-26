---
phase: 32-tier-3-complex-sources-batch-1
plan: 02
subsystem: pipeline
tags: [cheerio, scraping, advisories, korean, chinese, italian, spanish, taiwan, india]

requires:
  - phase: 32-tier-3-complex-sources-batch-1 plan 01
    provides: normalization functions (normalizeItLevel, normalizeEsLevel, normalizeKrLevel, normalizeTwLevel, normalizeCnLevel, normalizeInLevel) and AdvisoryInfoMap type extensions
provides:
  - advisories-tier3a.ts with 6 complex sub-fetchers (IT, ES, KR, TW, CN, IN)
  - Pipeline registration in index.ts for tier3a
  - Scoring engine integration for tier3a advisory info loading
affects: [scoring-calibration, ci-pipeline, methodology-docs]

tech-stack:
  added: []
  patterns: [tier3a sub-fetcher pattern matching tier2a/tier2b, Korean/Chinese country name mapping tables]

key-files:
  created:
    - src/pipeline/fetchers/advisories-tier3a.ts
  modified:
    - src/pipeline/fetchers/index.ts
    - src/pipeline/scoring/engine.ts

key-decisions:
  - "Used HTML scraping for South Korea instead of API (avoids API key registration)"
  - "Created local Korean (~55 entries) and Chinese (~80 entries) country name mapping tables in fetcher file"
  - "Added tier3a keys (it/es/kr/tw/cn/in) to engine.ts local AdvisoryInfoMap type"

patterns-established:
  - "Tier 3a fetcher follows exact same orchestration pattern as tier2a/tier2b"
  - "Non-Latin country name maps kept local to fetcher file (not in shared countries.ts)"

requirements-completed: [CPLX-01, CPLX-02, CPLX-03, CPLX-04, CPLX-05, CPLX-06]

duration: 4min
completed: 2026-03-26
---

# Phase 32 Plan 02: Tier 3a Fetchers Summary

**6 complex advisory sub-fetchers (Italy, Spain, South Korea, Taiwan, China, India) with Korean/Chinese country name mapping and pipeline integration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T20:39:17Z
- **Completed:** 2026-03-26T20:43:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created advisories-tier3a.ts with 6 independent sub-fetchers following established tier2a/tier2b pattern
- Built Korean (~55 countries) and Chinese (~80 countries) country name mapping tables for non-Latin script sources
- Wired tier3a into pipeline index (import, export, Promise.allSettled) and scoring engine (info loading, source detection)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create advisories-tier3a.ts with 6 sub-fetchers** - `c03ad15` (feat)
2. **Task 2: Wire tier3a into pipeline index and scoring engine** - `e2155c9` (feat)

## Files Created/Modified
- `src/pipeline/fetchers/advisories-tier3a.ts` - 6 sub-fetchers for IT, ES, KR, TW, CN, IN advisory sources with batch fetching, cache fallback, and fragility documentation
- `src/pipeline/fetchers/index.ts` - Import, export, and call fetchTier3aAdvisories; added to sourceNames array
- `src/pipeline/scoring/engine.ts` - Load tier3a advisory info, add tier3aSource to anyAdvisorySource detection, extend local AdvisoryInfoMap type

## Decisions Made
- Used HTML scraping for South Korea instead of data.go.kr API to avoid API key registration requirement
- Created local Korean and Chinese country name mapping tables in the fetcher file rather than extending shared countries.ts configuration
- Extended engine.ts local AdvisoryInfoMap type with it/es/kr/tw/cn/in keys to match the shared type in advisories.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added tier3a keys to engine.ts local AdvisoryInfoMap type**
- **Found during:** Task 2 (Wire tier3a into pipeline)
- **Issue:** The engine.ts has a local AdvisoryInfoMap type definition that did not include the tier3a keys (it, es, kr, tw, cn, in), which would cause type errors when loading tier3a info
- **Fix:** Added it/es/kr/tw/cn/in keys to the engine.ts local AdvisoryInfoMap type
- **Files modified:** src/pipeline/scoring/engine.ts
- **Verification:** npx tsc --noEmit passes with no new errors
- **Committed in:** e2155c9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for type safety when loading tier3a advisory info. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 tier3a advisory sources are implemented and wired into the pipeline
- Ready for scoring calibration, CI pipeline integration, and methodology documentation updates
- Sources with HIGH fragility (Italy, Spain, China, India) may produce sparse results in practice

---
*Phase: 32-tier-3-complex-sources-batch-1*
*Completed: 2026-03-26*
