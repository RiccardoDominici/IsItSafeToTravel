---
phase: 24-gdelt-stability-fetcher
plan: "01"
subsystem: pipeline/fetchers
tags: [gdelt, fetcher, instability, conflict, media-tone]
dependency_graph:
  requires: [fips-to-iso3, papaparse, countries-config]
  provides: [gdelt-fetcher, gdelt-instability-indicator]
  affects: [pipeline-fetchers, conflict-pillar]
tech_stack:
  added: [gdelt-doc-v2-api]
  patterns: [tone-to-instability-conversion, sequential-rate-limited-fetch]
key_files:
  created:
    - src/pipeline/fetchers/gdelt.ts
    - src/pipeline/config/fips-to-iso3.ts
  modified: []
decisions:
  - Used GDELT DOC v2 API (timelinetone mode) instead of deprecated v1 Stability Timeline endpoint
  - Convert media tone to instability via linear mapping: instability = clamp((0 - tone) / 10 + 0.5, 0, 1)
  - 5-second delay between requests to respect documented GDELT rate limit
  - Average last 24 hours of hourly tone data for each country
metrics:
  duration: "~10 minutes"
  completed: "2026-03-23"
---

# Phase 24 Plan 01: GDELT Stability Timeline API Fetcher Summary

GDELT DOC v2 API fetcher converting per-country media tone to instability scores (0-1) with FIPS-to-ISO3 mapping and cached fallback.

## What Was Done

### Task 1: Create GDELT Stability Timeline API fetcher
- **Commit:** 6bf7d3b
- Created `src/pipeline/fetchers/gdelt.ts` exporting `fetchGdelt(date: string): Promise<FetchResult>`
- Created `src/pipeline/config/fips-to-iso3.ts` with 267 FIPS-to-ISO3 country code mappings
- Fetcher queries GDELT DOC v2 API (`api.gdeltproject.org/api/v2/doc/doc`) with `sourcecountry:{FIPS}` and `mode=timelinetone`
- Converts average media tone (-10 to +10) into instability ratio (0-1) via `toneToInstability()` helper
- Iterates all FIPS codes filtered to valid ISO3 countries in our list
- Applies 5-second rate limiting between sequential requests
- Writes `gdelt-raw.json` and `gdelt-parsed.json` (RawSourceData format) with `gdelt_instability` indicator
- Falls back to cached `gdelt-parsed.json` when API is unreachable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GDELT v1 Stability Timeline API returns 404 (endpoint deprecated)**
- **Found during:** Task 1
- **Issue:** The planned endpoint `api.gdeltproject.org/api/v1/dash_stabilitytimeline/dash_stabilitytimeline` returns 404 for all requests. The GDELT v1 stability timeline API has been deprecated.
- **Fix:** Switched to GDELT DOC v2 API (`api/v2/doc/doc`) with `mode=timelinetone` and `sourcecountry:{FIPS}` filter. This returns hourly average media tone per country, which is converted to an instability score via linear mapping. The tone-to-instability conversion preserves the same 0-1 output range the plan specified.
- **Files modified:** src/pipeline/fetchers/gdelt.ts
- **Commit:** 6bf7d3b

**2. [Rule 3 - Blocking] FIPS-to-ISO3 mapping file missing from worktree**
- **Found during:** Task 1
- **Issue:** `src/pipeline/config/fips-to-iso3.ts` was created in Phase 21 (parallel worktree) but not yet merged to master, so it was absent from this worktree.
- **Fix:** Created the file in this worktree with the same 267-entry mapping table.
- **Files modified:** src/pipeline/config/fips-to-iso3.ts
- **Commit:** 6bf7d3b

**3. [Rule 1 - Bug] Rate limit increased from 500ms to 5000ms**
- **Found during:** Task 1 smoke testing
- **Issue:** GDELT DOC v2 API explicitly documents "one request every 5 seconds" rate limit and returns 429 when exceeded. The plan specified 500ms delay.
- **Fix:** Changed delay from 500ms to 5000ms to comply with documented rate limit.
- **Files modified:** src/pipeline/fetchers/gdelt.ts
- **Commit:** 6bf7d3b

## Decisions Made

1. **GDELT DOC v2 API over deprecated v1**: The v1 `dash_stabilitytimeline` endpoint returns 404. The DOC v2 API with `timelinetone` mode provides equivalent functionality (per-country media sentiment as instability proxy).
2. **Tone-to-instability linear mapping**: `instability = clamp((0 - tone) / 10 + 0.5, 0, 1)` maps tone=0 to 0.5 (neutral), tone=-5 to 1.0 (max instability), tone=+5 to 0.0 (stable). This produces meaningful 0-1 values for the normalizer.
3. **5-second rate limiting**: GDELT enforces strict 1-request-per-5-seconds. With ~190 valid countries, full fetch takes ~16 minutes (exceeds the 5-minute CI budget from plan). This should be noted for Plan 02 pipeline wiring -- GDELT should run separately or asynchronously.

## Known Stubs

None -- the fetcher is fully functional.

## Verification

- TypeScript compiles cleanly with `npx tsc --noEmit` (zero errors)
- All 8 acceptance criteria grep patterns pass
- Smoke test confirmed GDELT v2 API returns valid CSV data for US, AF, BR, FR, IN
- File exceeds minimum 80 lines (207 lines)

## Self-Check: PASSED
