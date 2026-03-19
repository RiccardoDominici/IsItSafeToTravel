---
phase: 02-data-pipeline-and-scoring-engine
plan: 01
subsystem: data-pipeline
tags: [typescript, pipeline, fetchers, inform, gpi, acled, advisories, scoring-config]

# Dependency graph
requires:
  - phase: 01-project-foundation
    provides: Astro 6 project with ESM, TypeScript, Node.js >=22.12
provides:
  - Pipeline TypeScript type contracts (RawSourceData, ScoredCountry, DailySnapshot, WeightsConfig)
  - Externalized scoring weights config (5 equal-weight pillars)
  - 248-country ISO 3166-1 mapping with en/it names
  - 4 independent data fetchers (INFORM, GPI, ACLED, advisories)
  - Filesystem utilities for raw data storage
affects: [02-02-scoring-engine, 02-03-orchestrator, 03-map-and-homepage, 04-country-pages]

# Tech tracking
tech-stack:
  added: [tsx, papaparse, xlsx]
  patterns: [fetcher-with-cached-fallback, raw-data-per-date-directory, promise-allSettled-fault-isolation]

key-files:
  created:
    - src/pipeline/types.ts
    - src/pipeline/config/weights.json
    - src/pipeline/config/sources.json
    - src/pipeline/config/countries.ts
    - src/pipeline/fetchers/inform.ts
    - src/pipeline/fetchers/gpi.ts
    - src/pipeline/fetchers/acled.ts
    - src/pipeline/fetchers/advisories.ts
    - src/pipeline/fetchers/index.ts
    - src/pipeline/utils/fs.ts
    - tsconfig.pipeline.json
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "248 countries in mapping (full ISO 3166-1), exceeding minimum 163 from GPI coverage"
  - "Each fetcher uses cached fallback on failure - pipeline never blocks on one source"
  - "ACLED fetcher gates on env vars (ACLED_API_KEY, ACLED_EMAIL) rather than failing silently"
  - "GPI country name aliasing handles mismatches between GPI names and ISO standard names"

patterns-established:
  - "Fetcher pattern: async function returning FetchResult, writes raw + parsed JSON to data/raw/YYYY-MM-DD/"
  - "Cached fallback: on fetch failure, find most recent data/raw/*/source-parsed.json"
  - "Fault isolation: Promise.allSettled in fetchAllSources so one failure does not block others"

requirements-completed: [DATA-01]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 02 Plan 01: Pipeline Types, Config, and Data Fetchers Summary

**TypeScript type contracts for full pipeline data flow, externalized scoring weights with 5 equal pillars, 248-country ISO mapping, and 4 independent data source fetchers (INFORM, GPI, ACLED, advisories) with cached fallback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T10:55:17Z
- **Completed:** 2026-03-19T10:58:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Complete TypeScript type system covering raw ingestion, scoring config, scored output, and daily snapshots
- Externalized weights.json with 5 equal-weight pillars (conflict, crime, health, governance, environment) summing to 1.0
- 248-country mapping with ISO 3166-1 alpha-3/alpha-2 codes and English/Italian names
- 4 independent fetchers (INFORM Risk Index, Global Peace Index, ACLED conflict data, government travel advisories) each with cached fallback on failure
- fetchAllSources orchestrator using Promise.allSettled for fault isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pipeline type contracts and configuration files** - `c413e2d` (feat)
2. **Task 2: Build data source fetchers** - `a4abb26` (feat)

## Files Created/Modified
- `src/pipeline/types.ts` - All TypeScript interfaces for pipeline data flow (FetchResult, RawSourceData, ScoredCountry, DailySnapshot, WeightsConfig, etc.)
- `src/pipeline/config/weights.json` - Externalized scoring weights with 5 equal-weight pillars
- `src/pipeline/config/sources.json` - Data source metadata (INFORM, GPI, ACLED, advisories) with URLs and descriptions
- `src/pipeline/config/countries.ts` - 248-country ISO 3166-1 mapping with alpha-3, alpha-2, English and Italian names
- `src/pipeline/fetchers/inform.ts` - INFORM Risk Index fetcher with indicator mapping (health, epidemic, governance, natural, climate)
- `src/pipeline/fetchers/gpi.ts` - Global Peace Index fetcher with Excel parsing via xlsx and country name aliasing
- `src/pipeline/fetchers/acled.ts` - ACLED conflict data fetcher with credential gating and event aggregation
- `src/pipeline/fetchers/advisories.ts` - US State Dept and UK FCDO travel advisory fetcher with level normalization
- `src/pipeline/fetchers/index.ts` - fetchAllSources orchestrator using Promise.allSettled
- `src/pipeline/utils/fs.ts` - Filesystem helpers (writeJson, readJson, getRawDir, findLatestCached)
- `tsconfig.pipeline.json` - Pipeline-specific TypeScript config extending tsconfig.json with NodeNext module resolution
- `package.json` - Added tsx, papaparse, @types/papaparse, xlsx dev dependencies

## Decisions Made
- Used 248 countries (full ISO 3166-1) rather than minimum 163, ensuring comprehensive coverage
- Each fetcher writes both raw API response and parsed indicators to separate files for auditability
- ACLED fetcher explicitly checks for env vars and returns descriptive error rather than failing silently
- GPI fetcher includes country name aliases to handle mismatches between GPI naming and ISO standard
- Advisory fetcher normalizes US levels (1-4) and UK levels to 0-1 scale for uniform scoring

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. ACLED API credentials (ACLED_API_KEY, ACLED_EMAIL) will be needed at pipeline runtime but are not required for build/development.

## Next Phase Readiness
- Type contracts ready for scoring engine (Plan 02) to consume
- Fetchers ready for orchestrator (Plan 03) to invoke
- weights.json externalized and ready for scoring algorithm
- Country mapping available for all downstream ISO code lookups

## Self-Check: PASSED

All 11 created files verified present. Both task commits (c413e2d, a4abb26) verified in git log.

---
*Phase: 02-data-pipeline-and-scoring-engine*
*Completed: 2026-03-19*
