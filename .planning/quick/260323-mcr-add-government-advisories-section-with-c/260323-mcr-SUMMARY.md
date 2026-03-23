---
phase: quick-260323-mcr
plan: 01
subsystem: pipeline, ui
tags: [advisories, fetchers, scoring, astro, i18n]

requires:
  - phase: 21-tiered-scoring
    provides: source-tiers.json tiered scoring infrastructure
provides:
  - CA and AU government advisory fetchers
  - AdvisoryInfo side-channel file (advisories-info.json)
  - Advisory info population in scoring pipeline (no more empty {} advisories)
  - 4-card advisory display on country pages
affects: [pipeline, country-page, scoring]

tech-stack:
  added: []
  patterns:
    - "Advisory fetcher returns FetcherResult { indicators, advisoryInfo } for both numeric and structured data"
    - "Side-channel JSON file (advisories-info.json) carries rich advisory metadata through pipeline"

key-files:
  created: []
  modified:
    - src/pipeline/types.ts
    - src/pipeline/fetchers/advisories.ts
    - src/pipeline/scoring/normalize.ts
    - src/pipeline/scoring/engine.ts
    - src/pipeline/config/weights.json
    - src/pipeline/config/source-tiers.json
    - src/components/country/AdvisorySection.astro
    - src/components/country/AdvisoryCard.astro
    - src/i18n/ui.ts

key-decisions:
  - "Side-channel advisories-info.json preferred over reconstructing AdvisoryInfo from numeric levels (richer data)"
  - "CA/AU use same 1-4 numeric color scheme as US (green/yellow/orange/red)"
  - "Crime pillar keeps equal averaging (no indicatorWeights) with 5 indicators now"
  - "Per-source tier entries (advisories_us/uk/ca/au) added to source-tiers.json for accurate freshness decay"

patterns-established:
  - "FetcherResult pattern: fetchers return both indicators and structured metadata"

requirements-completed: [GOV-ADV-CA-AU, ADV-INFO-POPULATE, ADV-FRONTEND]

duration: 5min
completed: 2026-03-23
---

# Quick Task 260323-mcr: Government Advisories Summary

**Canada and Australia advisory fetchers with AdvisoryInfo population and 4-card frontend display**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T15:11:22Z
- **Completed:** 2026-03-23T15:16:35Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Added Canada (travel.gc.ca) and Australia (smartraveller.gov.au) advisory fetchers with HTML/JSON parsing and fallback strategies
- AdvisoryInfo objects now populated through the full pipeline (was passing empty {} before)
- Country pages display up to 4 advisory cards (US, UK, CA, AU) in a 2x2 grid
- All 5 languages have i18n keys for the new advisory sources

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CA/AU fetchers, produce AdvisoryInfo alongside indicators, wire through pipeline** - `8d37e41` (feat)
2. **Task 2: Update frontend components and i18n for 4 advisory sources** - `d2a026b` (feat)

## Files Created/Modified
- `src/pipeline/types.ts` - Extended ScoredCountry.advisories with ca/au fields
- `src/pipeline/fetchers/advisories.ts` - Added fetchCaAdvisories, fetchAuAdvisories, AdvisoryInfo side-channel
- `src/pipeline/scoring/normalize.ts` - Added advisory_level_ca/au ranges
- `src/pipeline/scoring/engine.ts` - Loads advisories-info.json and passes to computeCountryScore
- `src/pipeline/config/weights.json` - Crime pillar now includes 5 indicators, version 5.4.0
- `src/pipeline/config/source-tiers.json` - Per-source tier entries for all 4 advisory sources
- `src/components/country/AdvisorySection.astro` - Renders 4 advisory cards
- `src/components/country/AdvisoryCard.astro` - Added sourceKey prop, CA/AU use numeric color scheme
- `src/i18n/ui.ts` - Added country.advisory.ca and country.advisory.au in en/it/es/fr/pt

## Decisions Made
- Used side-channel advisories-info.json file to carry rich advisory metadata (text, URLs, dates) rather than reconstructing from numeric levels
- CA and AU advisory cards use the same green/yellow/orange/red color scheme as US (all numeric 1-4)
- Crime pillar keeps equal averaging with 5 indicators (no indicatorWeights added)
- Added per-source tier entries (advisories_us, advisories_uk, advisories_ca, advisories_au) to source-tiers.json for accurate freshness decay per source

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript compilation error from using `await import('node:fs')` inside non-async `computeAllScores` -- resolved by using existing `findLatestCached` utility instead (pre-existing errors in ScoreHero.astro and Search.astro are unrelated)

## Known Stubs

None. All data paths are wired end-to-end. CA/AU fetcher parsing patterns may need tuning after first live API run if page HTML structure differs from expected patterns, but fallback parsers and graceful degradation are in place.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Advisory sources ready for next pipeline run
- CA/AU HTML parsing may need tuning based on actual page structure
- Frontend will display advisory cards as soon as scores.json includes advisory data

---
*Plan: quick-260323-mcr*
*Completed: 2026-03-23*
