---
phase: 21-scoring-formula-redesign
plan: 01
subsystem: infra
tags: [scoring, types, config, fips, weights]

# Dependency graph
requires:
  - phase: 20-accessibility-and-csp-hardening
    provides: stable v2.0 codebase
provides:
  - SourceTier, SourceConfig, SourcesConfig types for tiered baseline+signal scoring
  - source-tiers.json config with 9 sources (3 baseline, 6 signal) and decay parameters
  - Per-indicator sub-weights in weights.json v5.0.0
  - FIPS-to-ISO3 mapping with 267 country codes for GDELT integration
  - Extended RawIndicator with optional fetchedAt/dataDate fields
affects: [21-02 freshness module, 21-03 engine rewrite, 24 GDELT fetcher]

# Tech tracking
tech-stack:
  added: []
  patterns: [tiered baseline+signal source architecture, exponential decay config, per-indicator sub-weights]

key-files:
  created:
    - src/pipeline/config/source-tiers.json
    - src/pipeline/config/fips-to-iso3.ts
  modified:
    - src/pipeline/types.ts
    - src/pipeline/config/weights.json

key-decisions:
  - "Named tiered config source-tiers.json instead of overwriting existing sources.json to preserve backward compatibility with fetcher catalog and tests"
  - "267 FIPS-to-ISO3 entries covering all GDELT country codes including legacy/historical codes"
  - "Per-indicator sub-weights sum to 1.0 within each pillar; baseline indicators get higher sub-weights"

patterns-established:
  - "Source tier config pattern: JSON file with tier/maxAgeDays/decayHalfLifeDays per source"
  - "Per-indicator sub-weights: optional indicatorWeights field on PillarWeight for gradual adoption"

requirements-completed: [FORM-03, FORM-05, SRC-05]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 21 Plan 01: Scoring Infrastructure Config Summary

**Tiered scoring config files and type definitions for baseline+signal architecture with per-indicator sub-weights and FIPS-to-ISO3 mapping**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T23:31:54Z
- **Completed:** 2026-03-22T23:35:32Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

### Task 1: Extended types.ts and created source-tiers.json
- Added `SourceTier` (baseline/signal), `SourceConfig`, and `SourcesConfig` types to pipeline type system
- Extended `RawIndicator` with optional `fetchedAt` and `dataDate` fields (backward compatible)
- Created `source-tiers.json` defining 9 sources: 3 baseline (worldbank, gpi, inform) and 6 signal (acled, advisories, gdelt, reliefweb, gdacs, who-dons) with decay half-life and max-age parameters
- `maxSignalInfluence: 0.30` caps signal tier contribution at 30%
- `maxDailyScoreChange: 0.3` prevents score noise

### Task 2: Updated weights.json and created FIPS-to-ISO3 mapping
- Updated weights.json from v4.0.0 to v5.0.0 with explicit `indicatorWeights` per pillar
- All 5 pillars have sub-weights summing to exactly 1.0
- Baseline indicators receive higher sub-weights than signal indicators within each pillar
- Created `fips-to-iso3.ts` with 267 FIPS-to-ISO3 country code entries
- Includes historical/legacy codes: BM (Myanmar/Burma), GZ/WE (Palestine), KV (Kosovo), OD (South Sudan)
- Exports both `FIPS_TO_ISO3` record and `fipsToIso3()` lookup function

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed source tier config to avoid overwriting existing sources.json**
- **Found during:** Task 1
- **Issue:** Plan specified `src/pipeline/config/sources.json` but that file already exists as a source catalog (name, url, dataUrl, description) used by fetcher tests. Overwriting it would break `data01-fetchers.test.ts` which checks for `url` and `dataUrl` fields.
- **Fix:** Created the tiered config as `src/pipeline/config/source-tiers.json` instead, preserving the original sources.json catalog file and all existing tests.
- **Files modified:** src/pipeline/config/source-tiers.json (new)
- **Commit:** d3f720b

## Pre-existing Issues

- `engine.test.ts` has a failing test (`8.3 !== 8.2` expected score) that predates this plan. The test uses its own `TEST_WEIGHTS` fixture (not the weights.json file) and was already failing before any changes. Not caused by or fixed by this plan.

## Known Stubs

None - all files contain complete, production-ready content.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | d3f720b | Extended types.ts with tiered scoring types and created source-tiers.json |
| 2 | 53a63d6 | Updated weights.json to v5.0.0 with per-indicator sub-weights and FIPS-to-ISO3 mapping |
