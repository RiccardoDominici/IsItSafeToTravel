---
phase: 21-scoring-formula-redesign
verified: 2026-03-23T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
gaps: []
human_verification: []
---

# Phase 21: Scoring Formula Redesign — Verification Report

**Phase Goal:** Scoring engine uses a tiered baseline+signal architecture with freshness decay so that realtime sources can be integrated without destabilizing existing scores
**Verified:** 2026-03-23
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | sources.json config defines tier, decay half-life, and max-age for every data source | VERIFIED | `src/pipeline/config/source-tiers.json` defines 9 sources (3 baseline, 6 signal) with maxAgeDays + decayHalfLifeDays per source; note: implementation correctly named it `source-tiers.json` to avoid overwriting existing `sources.json` catalog |
| 2 | Per-indicator sub-weights exist within each pillar replacing equal averaging | VERIFIED | `weights.json` v5.0.0: all 5 pillars have `indicatorWeights` maps; each sums to exactly 1.000 (verified programmatically) |
| 3 | Static FIPS-to-ISO3 mapping file exists covering GDELT country codes | VERIFIED | `src/pipeline/config/fips-to-iso3.ts` exports `FIPS_TO_ISO3` (267 entries) and `fipsToIso3()`; includes legacy codes GZ/WE (Palestine), KV (Kosovo), OD (South Sudan), BM (Myanmar) |
| 4 | Type system includes SourceTier, SourceConfig, SourcesConfig and extended RawIndicator | VERIFIED | `src/pipeline/types.ts` lines 1–33: `SourceTier`, `SourceConfig`, `SourcesConfig` types present; `RawIndicator` extended with optional `fetchedAt?` and `dataDate?` |
| 5 | Scoring engine separates baseline/signal tiers, applies freshness decay, gracefully degrades to pure baseline with no signal data | VERIFIED | `engine.ts` `computeTieredPillarScore()` implements tiered blending; `effectiveSignalInfluence = maxSignalInfluence * signalCompleteness` — when signalCompleteness=0, blend is pure baseline; `freshnessWeight()` called per indicator |
| 6 | Pipeline logs tier contribution and scores all countries | VERIFIED | `run.ts` logs average score, country count, data completeness; `computeAllScores` logs baseline % vs signal % contributions |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pipeline/config/source-tiers.json` | Tier config with 9 sources and decay params | VERIFIED | Contains `maxSignalInfluence: 0.30`, `maxDailyScoreChange: 0.3`, 3 baseline + 6 signal sources with `maxAgeDays` and `decayHalfLifeDays` each |
| `src/pipeline/config/weights.json` | v5.0.0 with per-indicator sub-weights | VERIFIED | Version `5.0.0`, all 5 pillars have `indicatorWeights`, sums all 1.000 |
| `src/pipeline/config/fips-to-iso3.ts` | Static FIPS-to-ISO3 mapping for GDELT | VERIFIED | 267 entries, exports `FIPS_TO_ISO3` and `fipsToIso3()` function |
| `src/pipeline/types.ts` | Extended types for tiered scoring | VERIFIED | Exports `SourceTier`, `SourceConfig`, `SourcesConfig`; `RawIndicator` has optional `fetchedAt`/`dataDate`; `PillarWeight` has optional `indicatorWeights` |
| `src/pipeline/scoring/freshness.ts` | Exponential decay weight calculator | VERIFIED | 26 lines; exports `freshnessWeight(dataAgeMs, halfLifeDays, maxAgeDays)`; uses `Math.LN2` for decay lambda; clamps at maxAgeDays |
| `src/pipeline/scoring/engine.ts` | Tiered baseline+signal scoring engine | VERIFIED | 356 lines; exports `computeCountryScore` (with optional 7th `sourcesConfig` param) and `computeAllScores`; internal `computeTieredPillarScore` handles blending; loads `source-tiers.json` at runtime; SOURCE_CATALOG has all 9 sources |
| `src/pipeline/scoring/__tests__/freshness.test.ts` | Freshness decay tests | VERIFIED | 9 tests covering: fresh data=1.0, half-life=0.5, maxAge clamping=0, negative age=1.0, GDELT half-life, advisories half-life, monotonic decay |
| `src/pipeline/scoring/__tests__/engine.test.ts` | Engine tests with tiered scoring | VERIFIED | 21 tests total: 17 existing (backward-compatible) + 4 new tiered tests (tiered scoring, graceful degradation, sub-weights, stale data) |
| `src/pipeline/run.ts` | Pipeline wired to tiered engine with logging | VERIFIED | Calls `computeAllScores(rawDataMap, weightsConfig)` unchanged; logs average score, country count, average completeness after Stage 3 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pipeline/scoring/engine.ts` | `src/pipeline/config/source-tiers.json` | `readJson<SourcesConfig>` loading at runtime | WIRED | Line 295: `const sourceTiersPath = join(process.cwd(), 'src/pipeline/config/source-tiers.json')` |
| `src/pipeline/scoring/engine.ts` | `src/pipeline/scoring/freshness.ts` | `import { freshnessWeight }` | WIRED | Line 2: `import { freshnessWeight } from './freshness.js'` |
| `src/pipeline/scoring/engine.ts` | `src/pipeline/types.ts` | `import SourcesConfig` | WIRED | Line 17: `import type { ... SourcesConfig, ... }` |
| `src/pipeline/run.ts` | `src/pipeline/config/source-tiers.json` | Engine loads internally | WIRED | Engine called by run.ts handles source-tiers.json loading transparently; run.ts requires no direct import |
| `src/pipeline/run.ts` | `src/pipeline/scoring/engine.ts` | `computeAllScores(rawDataMap, weightsConfig)` | WIRED | Line 68: `const scoredCountries = computeAllScores(rawDataMap, weightsConfig)` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `engine.ts → computeTieredPillarScore` | `baselineScore`, `signalScore` | Per-indicator `fetchedAt`/`dataDate` timestamps → `freshnessWeight()` | Yes — computes decay from real timestamps; falls back to weight=1.0 when no timestamp | FLOWING |
| `engine.ts → computeAllScores` | `sourcesConfig` | `source-tiers.json` via `readJson` | Yes — file exists with 9 real sources; graceful fallback to legacy mode if file missing | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| freshnessWeight: 9 unit tests | `node --import tsx --test src/pipeline/scoring/__tests__/freshness.test.ts` | 9/9 pass, 0 fail | PASS |
| engine.ts: 21 unit+integration tests | `node --import tsx --test src/pipeline/scoring/__tests__/engine.test.ts` | 21/21 pass, 0 fail | PASS |
| Sub-weight sums per pillar | `node -e` JSON inspection | conflict=1.000, crime=1.000, health=1.000, governance=1.000, environment=1.000 | PASS |
| FIPS-to-ISO3 entry count | `grep -c "': '"` | 267 entries | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FORM-01 | Plans 21-02, 21-03 | Tiered baseline+signal architecture where annual indices ~70%, realtime max ~30% | SATISFIED | `maxSignalInfluence: 0.30` in source-tiers.json; `effectiveSignalInfluence = maxSignalInfluence * signalCompleteness` in engine.ts line 202 |
| FORM-02 | Plan 21-02 | Each source weighted by freshness using exponential decay (configurable half-life per source) | SATISFIED | `freshnessWeight()` with `decayHalfLifeDays` per source from source-tiers.json; called for every indicator in `computeTieredPillarScore` |
| FORM-03 | Plan 21-01 | Source tiers and decay params defined in config file alongside existing weights.json | SATISFIED | `src/pipeline/config/source-tiers.json` exists alongside `weights.json`; plan specified `sources.json` but executor correctly used `source-tiers.json` to avoid collision with existing source catalog |
| FORM-04 | Plans 21-02, 21-03 | Scoring engine handles missing realtime data gracefully, falling back to pure baseline | SATISFIED | `signalCompleteness = 0` when no signal data → `effectiveSignalInfluence = 0` → pillarScore equals baselineScore; test "graceful degradation — baseline only" passes |
| FORM-05 | Plan 21-01 | Per-indicator sub-weights exist within each pillar replacing equal averaging | SATISFIED | `weights.json` v5.0.0 has `indicatorWeights` on all 5 pillars; engine uses `pillarDef.indicatorWeights?.[ind.name]` with equal-weight fallback; test "per-indicator sub-weights" proves scores differ |
| SRC-05 | Plan 21-01 | Static FIPS-to-ISO3 mapping table exists for GDELT integration | SATISFIED | `src/pipeline/config/fips-to-iso3.ts` with 267 entries exports `FIPS_TO_ISO3` and `fipsToIso3()` |

**All 6 requirements assigned to Phase 21 are SATISFIED.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No placeholder comments, empty implementations, or disconnected stubs found in any Phase 21 files. The `sources.json` name deviation (PLAN said `sources.json`; executor used `source-tiers.json`) is a documented, correct architectural decision — the executor preserved the existing `sources.json` source catalog used by fetcher tests.

---

### Human Verification Required

None. All requirements are mechanically verifiable and all tests pass.

---

### Gaps Summary

No gaps. Phase 21 goal is fully achieved:

- The tiered baseline+signal architecture is operational: `source-tiers.json` defines 3 baseline (worldbank, gpi, inform) and 6 signal (acled, advisories, gdelt, reliefweb, gdacs, who-dons) sources with per-source decay parameters.
- Freshness decay is implemented with the correct exponential formula (`e^(-ln2/halfLife * ageDays)`) and is wired into the engine.
- Per-indicator sub-weights are in `weights.json` v5.0.0 with all sums at exactly 1.0, preventing score inflation when adding new indicators.
- The FIPS-to-ISO3 table (267 entries) is ready for Phase 24's GDELT fetcher.
- Pure baseline fallback works: when `signalCompleteness = 0`, `effectiveSignalInfluence = 0`, so existing country scores remain stable until realtime sources are added.
- 30 tests pass (21 engine + 9 freshness), including new tests for tiered blending, graceful degradation, sub-weight differentiation, and stale signal data discounting.

---

_Verified: 2026-03-23_
_Verifier: Claude (gsd-verifier)_
