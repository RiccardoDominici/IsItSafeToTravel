---
phase: 23-reliefweb-and-gdacs-fetchers
plan: 01
subsystem: pipeline
tags: [reliefweb, gdacs, fetcher, disaster-data, humanitarian]

requires:
  - phase: 21-tiered-scoring-engine
    provides: tiered scoring types and pipeline infrastructure
provides:
  - ReliefWeb fetcher (fetchReliefweb) for humanitarian disaster counts per country
  - GDACS fetcher (fetchGdacs) for natural disaster orange/red alert counts per country
affects: [23-02, 24-gdelt-fetcher, 26-pipeline-integration]

tech-stack:
  added: []
  patterns: [POST JSON body for ReliefWeb v2 API, GeoJSON feature parsing for GDACS]

key-files:
  created:
    - src/pipeline/fetchers/reliefweb.ts
    - src/pipeline/fetchers/gdacs.ts
  modified: []

key-decisions:
  - "ReliefWeb v2 API uses POST with JSON body (not GET with query params) for filtering"
  - "GDACS ISO3 resolution: try properties.iso3 first, fall back to getCountryByName"

patterns-established:
  - "Disaster fetcher pattern: fetch API, count events per country, write -parsed.json with RawSourceData"

requirements-completed: [SRC-02, SRC-03]

duration: 3min
completed: 2026-03-23
---

# Phase 23 Plan 01: ReliefWeb and GDACS Fetchers Summary

**ReliefWeb humanitarian disaster fetcher and GDACS natural disaster alert fetcher producing per-country indicator counts with cached fallback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T00:10:33Z
- **Completed:** 2026-03-23T00:13:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ReliefWeb fetcher queries v2 API for active disasters, counts per country ISO3, writes reliefweb-parsed.json
- GDACS fetcher queries event list API for orange/red alerts (EQ/TC/FL/VO), resolves country ISO3 via direct field or name lookup
- Both fetchers follow acled.ts pattern: FetchResult return, findLatestCached fallback, writeJson output, AbortSignal.timeout

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ReliefWeb fetcher** - `46c2bdc` (feat)
2. **Task 2: Create GDACS fetcher** - `6d32aa0` (feat)

## Files Created/Modified
- `src/pipeline/fetchers/reliefweb.ts` - Fetches active disasters from ReliefWeb v2 API, produces reliefweb_active_disasters indicator
- `src/pipeline/fetchers/gdacs.ts` - Fetches orange/red disaster alerts from GDACS API, produces gdacs_disaster_alerts indicator

## Decisions Made
- ReliefWeb v2 API requires POST with JSON body for filtering (GET params return 400). Appname passed as query parameter.
- GDACS fetcher validates ISO3 codes against country list and falls back to name-based lookup when iso3 field is missing.
- Content-type check added to GDACS fetcher to handle potential XML responses gracefully.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ReliefWeb API call method from GET to POST**
- **Found during:** Task 1 (ReliefWeb fetcher)
- **Issue:** Plan specified GET with query parameters, but ReliefWeb v2 API returns 400 for GET filter params
- **Fix:** Changed to POST with JSON body, appname as query parameter
- **Files modified:** src/pipeline/fetchers/reliefweb.ts
- **Verification:** API call returns proper response (403 due to unapproved appname, not 400 from bad format)
- **Committed in:** 46c2bdc

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for API compatibility. No scope creep.

## Issues Encountered
- ReliefWeb API requires an approved appname (returns 403 without one). The fetcher handles this gracefully by falling back to cached data. Users need to register an appname at https://apidoc.reliefweb.int/parameters#appname or set RELIEFWEB_APPNAME env var.
- GDACS API successfully returned 35 countries with active orange/red alerts on first run.

## User Setup Required

ReliefWeb API requires an approved appname for production use:
- Register at https://apidoc.reliefweb.int/parameters#appname
- Set `RELIEFWEB_APPNAME` environment variable (defaults to 'isitsafetotravel.com')
- Without an approved appname, the fetcher falls back to cached data

## Next Phase Readiness
- Both fetchers ready for pipeline integration (Phase 23-02)
- ReliefWeb appname registration needed for live data (falls back to cache until then)
- GDACS fetcher confirmed working with live data

---
*Phase: 23-reliefweb-and-gdacs-fetchers*
*Completed: 2026-03-23*
