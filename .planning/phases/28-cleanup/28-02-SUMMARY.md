---
phase: 28-cleanup
plan: 02
subsystem: docs, i18n, pipeline
tags: [gdelt, who-dons, i18n, methodology, llms-txt, pipeline-verification]

# Dependency graph
requires:
  - phase: 28-01
    provides: "Pipeline code with GDELT/WHO DONs fetchers removed and weights redistributed in v7.0.0"
provides:
  - "All user-facing content (i18n, methodology pages, llms.txt, README) cleaned of GDELT/WHO DONs references"
  - "Pipeline verified with stable scores (max deviation 0.259, within 0.3 threshold)"
  - "Build passing with 1354/1354 SEO checks"
affects: [docs, seo, methodology]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/i18n/ui.ts
    - src/pages/en/methodology/index.astro
    - src/pages/it/metodologia/index.astro
    - src/pages/es/metodologia/index.astro
    - src/pages/fr/methodologie/index.astro
    - src/pages/pt/metodologia/index.astro
    - public/llms.txt
    - public/llms-full.txt
    - scripts/generate-llms-full.ts
    - README.md
    - src/pipeline/backfill.ts
    - src/pipeline/scoring/__tests__/freshness.test.ts

key-decisions:
  - "Updated source count from 9 to 7 across all languages and documentation"
  - "Kept historical note in README about GDELT/WHO DONs removal for transparency"

patterns-established: []

requirements-completed: [CLEAN-01, CLEAN-02, CLEAN-03]

# Metrics
duration: 15min
completed: 2026-03-26
---

# Phase 28 Plan 02: Documentation & Content Cleanup Summary

**Removed GDELT and WHO DONs references from all 5 language blocks in i18n, methodology pages, LLM-facing content, and README; verified pipeline stability with max 0.259 score deviation across 248 countries**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-26T18:41:58Z
- **Completed:** 2026-03-26T18:57:02Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Removed all GDELT and WHO DONs references from i18n strings across 5 languages (EN, IT, ES, FR, PT): source entries, indicator keys, tiered_text, conflict.description, conflict.sources, health.description, health.sources, about.project_text
- Updated all 5 methodology page dataSources arrays to remove gdelt and who_dons entries
- Updated llms.txt, llms-full.txt, generate-llms-full.ts, and README.md to reflect current 7 data sources
- Pipeline verified: 248 countries scored, 6/6 sources succeeded, max score deviation 0.259 (well within 0.3 threshold)
- Build passes with 1354/1354 SEO checks
- Final grep sweep confirms zero GDELT/WHO DONs/fips references remaining in src/

## Task Commits

Each task was committed atomically:

1. **Task 1: Update i18n strings and methodology pages** - `4447be4` (feat)
2. **Task 2: Run pipeline and verify score stability** - `64177c4` (feat)

## Files Created/Modified
- `src/i18n/ui.ts` - Removed GDELT/WHO DONs source, indicator, and description keys from all 5 language blocks; updated source counts and tiered_text
- `src/pages/en/methodology/index.astro` - Removed gdelt and who_dons from dataSources array
- `src/pages/it/metodologia/index.astro` - Removed gdelt and who_dons from dataSources array
- `src/pages/es/metodologia/index.astro` - Removed gdelt and who_dons from dataSources array
- `src/pages/fr/methodologie/index.astro` - Removed gdelt and who_dons from dataSources array
- `src/pages/pt/metodologia/index.astro` - Removed gdelt and who_dons from dataSources array
- `public/llms.txt` - Updated sources line to list ReliefWeb/GDACS instead of GDELT
- `public/llms-full.txt` - Updated source description header
- `scripts/generate-llms-full.ts` - Updated source template strings
- `README.md` - Removed GDELT/WHO DONs from data sources table, freshness decay, weights, source counts
- `src/pipeline/backfill.ts` - Removed GDELT from comment
- `src/pipeline/scoring/__tests__/freshness.test.ts` - Renamed GDELT-specific test descriptions to generic

## Decisions Made
- Updated source count from "9+" to "7+" across all languages and documentation to accurately reflect remaining active sources (World Bank WGI, GPI, INFORM, ReliefWeb, GDACS, US/UK/CA/AU advisories)
- Kept a brief historical note in README explaining GDELT/WHO DONs were removed due to reliability issues, for transparency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated source counts in overview_text and about.sources_text**
- **Found during:** Task 1
- **Issue:** Plan mentioned updating about.project_text but overview_text and about.sources_text in all 5 languages also referenced "9" sources
- **Fix:** Updated all occurrences from "9" to "7" across all language blocks
- **Files modified:** src/i18n/ui.ts
- **Committed in:** 4447be4

**2. [Rule 1 - Bug] Cleaned GDELT references from pipeline code comments and test names**
- **Found during:** Task 2 (final grep sweep)
- **Issue:** backfill.ts had a GDELT reference in a comment, freshness test had GDELT in test names
- **Fix:** Updated comment and test descriptions to be generic
- **Files modified:** src/pipeline/backfill.ts, src/pipeline/scoring/__tests__/freshness.test.ts
- **Committed in:** 64177c4

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both auto-fixes necessary for completeness of GDELT/WHO DONs removal. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 28 cleanup complete: GDELT and WHO DONs fully removed from pipeline code (plan 01) and documentation (plan 02)
- Ready to proceed with v4.0 new advisory source integrations
- Pipeline stable with 7 active data sources

## Self-Check: PASSED

- All 12 modified files verified present on disk
- Both task commits (4447be4, 64177c4) verified in git log

---
*Phase: 28-cleanup*
*Completed: 2026-03-26*
