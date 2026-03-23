---
phase: 24-gdelt-stability-fetcher
verified: 2026-03-23T10:00:00Z
status: gaps_found
score: 6/8 must-haves verified
re_verification: false
gaps:
  - truth: "Fetcher completes all countries within ~3 minutes (under CI 5-minute budget)"
    status: failed
    reason: "5s rate-limit delay between sequential requests results in ~16 minutes for ~190 valid countries, far exceeding the 5-minute CI budget stated in the plan. SUMMARY acknowledges this explicitly."
    artifacts:
      - path: "src/pipeline/fetchers/gdelt.ts"
        issue: "Line 137: 5_000ms delay between each of ~190 sequential requests = ~16 min total"
    missing:
      - "Either: reduce scope to top N countries, run GDELT fetcher in a separate cron job, or add a configurable country limit parameter"
  - truth: "Media bias is explicitly contained through self-relative spike detection"
    status: failed
    reason: "The phase goal specifies 'self-relative spike detection' (comparing today's score to the country's own 30-day rolling baseline) as the media bias containment mechanism. Research docs (PITFALLS.md, SUMMARY.md) explicitly require this. The implementation instead uses a 15% weight cap, which contains aggregate influence but does NOT prevent a single-day media frenzy from producing an extreme raw instability value. No per-country historical baseline comparison was implemented."
    artifacts:
      - path: "src/pipeline/fetchers/gdelt.ts"
        issue: "toneToInstability() applies a fixed linear mapping with no per-country historical context. A country with normally neutral tone will spike to instability=1.0 on any day of negative media attention, regardless of its own baseline."
    missing:
      - "Per-country self-relative normalization: compare current tone to the country's own rolling 30-day or 7-day average, then express the score as a deviation from baseline rather than as an absolute value"
      - "Historical baseline could be approximated by fetching a longer TIMESPAN (e.g., TIMESPAN=30d) and computing stddev/percentile of the country's own tone rather than a fixed linear mapping"
human_verification:
  - test: "Run pipeline and check that GDELT produces non-empty gdelt-parsed.json"
    expected: "gdelt-parsed.json contains indicators for at least 50 countries with gdelt_instability values between 0 and 1"
    why_human: "Cannot run the full pipeline in verification (16-minute fetch). Cached data may exist but live API behavior cannot be confirmed programmatically."
  - test: "Observe a country with known recent media spike and check instability score"
    expected: "A country with sudden negative media coverage (e.g., active conflict) shows higher instability than its typical baseline, but not an extreme spike if the 15% cap is the only protection"
    why_human: "Requires real API data and comparison against expected values"
---

# Phase 24: GDELT Stability Fetcher Verification Report

**Phase Goal:** Pipeline ingests GDELT instability scores as a near-realtime conflict signal, with media bias explicitly contained through self-relative spike detection
**Verified:** 2026-03-23
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | GDELT fetcher produces gdelt-parsed.json with per-country instability scores | ✓ VERIFIED | `gdelt.ts` writes to `gdelt-parsed.json` (line 169) with `RawSourceData` format containing `gdelt_instability` indicators |
| 2  | Fetcher maps FIPS country codes to ISO3 using the Phase 21 mapping table | ✓ VERIFIED | Imports `FIPS_TO_ISO3` from `../config/fips-to-iso3.js` (line 4); iterates `Object.keys(FIPS_TO_ISO3)` filtered by `getCountryByIso3` |
| 3  | Fetcher falls back to cached data when GDELT API is unreachable | ✓ VERIFIED | `findLatestCached('gdelt-parsed.json')` in catch block (lines 182-196); matches gdacs.ts pattern |
| 4  | Fetcher completes all countries within ~3 minutes (under CI 5-minute budget) | ✗ FAILED | 5s delay × ~190 countries = ~16 minutes. SUMMARY explicitly acknowledges this: "full fetch takes ~16 minutes (exceeds the 5-minute CI budget)" |
| 5  | GDELT fetcher runs as part of the pipeline alongside all other sources | ✓ VERIFIED | `fetchGdelt(date)` added to `Promise.allSettled([...])` in `fetchers/index.ts` (line 46); 8 total sources confirmed |
| 6  | GDELT instability values are normalized to 0-1 range (inverse: higher instability = lower safety) | ✓ VERIFIED | `normalize.ts` line 67: `gdelt_instability: { min: 0, max: 1.0, inverse: true }` |
| 7  | GDELT contributes no more than 15% of the conflict pillar via indicatorWeights | ✓ VERIFIED | `weights.json` v5.2.0 line 15: `"gdelt_instability": 0.15`; all weights sum to exactly 1.0 (verified programmatically) |
| 8  | Media bias is explicitly contained through self-relative spike detection | ✗ FAILED | Implementation uses absolute tone-to-instability linear mapping only. No per-country historical baseline comparison exists. Research docs (PITFALLS.md L81-84, SUMMARY.md L123) explicitly require self-relative normalization. |

**Score:** 6/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pipeline/fetchers/gdelt.ts` | GDELT fetcher exporting `fetchGdelt` | ✓ VERIFIED | 207 lines (exceeds min 80); exports `fetchGdelt`; uses FIPS_TO_ISO3, toneToInstability, gdelt_instability indicator, fallback |
| `src/pipeline/config/fips-to-iso3.ts` | 267-entry FIPS-to-ISO3 mapping | ✓ VERIFIED | 333 lines; `FIPS_TO_ISO3` record with 267 entries and `fipsToIso3` function |
| `src/pipeline/fetchers/index.ts` | fetchGdelt registered in fetchAllSources | ✓ VERIFIED | 3 references (import line 9, export line 18, call in Promise.allSettled line 46); 8 sources total |
| `src/pipeline/scoring/normalize.ts` | gdelt_instability normalization range | ✓ VERIFIED | Line 67: `gdelt_instability: { min: 0, max: 1.0, inverse: true }` |
| `src/pipeline/config/weights.json` | GDELT in conflict pillar at 15% cap | ✓ VERIFIED | v5.2.0; `gdelt_instability: 0.15` in indicatorWeights; all weights sum to 1.0 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `gdelt.ts` | `fips-to-iso3.ts` | `import { FIPS_TO_ISO3 }` | ✓ WIRED | Line 4: `import { FIPS_TO_ISO3 } from '../config/fips-to-iso3.js'` — used in `Object.keys(FIPS_TO_ISO3)` and `FIPS_TO_ISO3[fips]` |
| `gdelt.ts` | GDELT DOC v2 API | `fetch(url)` with `api.gdeltproject.org` | ✓ WIRED (deviation) | Line 18: URL `https://api.gdeltproject.org/api/v2/doc/doc` — plan specified v1 endpoint (deprecated 404); implementation correctly switched to v2 |
| `fetchers/index.ts` | `gdelt.ts` | `import { fetchGdelt }` | ✓ WIRED | Line 9 import, line 18 export, line 46 call site in Promise.allSettled |
| `weights.json` | `engine.ts` | `indicatorWeights.gdelt_instability` | ✓ WIRED | engine.ts line 172 reads `pillarDef.indicatorWeights?.[ind.name]`; v5.2.0 has `gdelt_instability: 0.15` |

**Key link deviation note:** Plan 01 specified `SMOOTH=3` pattern for the URL but implementation uses `TIMELINESMOOTH=3` (the correct DOC v2 API parameter name). This is a valid deviation — the plan was written for the v1 endpoint; v2 uses different parameter names.

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `gdelt.ts` → `gdelt-parsed.json` | `indicators[]` keyed by ISO3 | GDELT DOC v2 API `timelinetone` endpoint | Fetches live per-country tone CSV, converts to instability via `toneToInstability()` | ✓ FLOWING (when API reachable) |
| `gdelt.ts` → `gdelt-parsed.json` | `indicators[]` (fallback) | `findLatestCached('gdelt-parsed.json')` | Reads from previous run's file | ✓ FLOWING (cached path) |
| `normalize.ts` | `normalizedValue` for `gdelt_instability` | `INDICATOR_RANGES['gdelt_instability']` with `inverse: true` | Fixed range 0-1 with inverse transform — the raw value IS already 0-1 so effective normalization is trivially `1 - value` | ✓ FLOWING |
| `weights.json` → `engine.ts` | `subWeight` for `gdelt_instability` | `indicatorWeights.gdelt_instability = 0.15` | Read by engine at scoring time via `pillarDef.indicatorWeights?.[ind.name]` | ✓ FLOWING |

**Note on media bias data flow:** The `toneToInstability()` function uses an absolute fixed mapping (tone=0 → 0.5 instability) with no per-country historical baseline. The 15% weight cap limits the maximum impact but does not prevent extreme raw values. A country with typical tone of +3 that drops to -5 on a single news cycle will jump from instability=0.2 to instability=1.0 — a 5x absolute swing — before the 15% cap is applied.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `gdelt.ts` exports `fetchGdelt` | `grep "export async function fetchGdelt" src/pipeline/fetchers/gdelt.ts` | 1 match (line 98) | ✓ PASS |
| `gdelt_instability` indicator name used | `grep -c "gdelt_instability" src/pipeline/fetchers/gdelt.ts` | 1 match (line 156) | ✓ PASS |
| FIPS_TO_ISO3 imported and used | `grep "FIPS_TO_ISO3" src/pipeline/fetchers/gdelt.ts` | 2 matches (import + usage) | ✓ PASS |
| Rate limiting delay present | `grep "setTimeout" src/pipeline/fetchers/gdelt.ts` | 1 match (5_000ms, line 137) | ✓ PASS (5s not 500ms) |
| fallback via findLatestCached | `grep "findLatestCached" src/pipeline/fetchers/gdelt.ts` | 1 match (line 182) | ✓ PASS |
| TypeScript compilation | `npx tsc --noEmit` | No output (clean) | ✓ PASS |
| indicatorWeights sum = 1.0 | `node -e "...reduce sum..."` | `1` | ✓ PASS |
| CI budget: fetch time | Sequential: 5s × ~190 countries | ~950s (~16 min) | ✗ FAIL |
| Self-relative spike detection | `grep -i "spike\|baseline\|rolling\|historical" gdelt.ts` | No matches | ✗ FAIL |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SRC-01 | 24-01, 24-02 | Pipeline fetches daily GDELT Stability scores per country (FIPS-to-ISO3 mapping, CSV parsing) | ✓ SATISFIED (partial) | Fetcher exists, uses FIPS-to-ISO3, parses CSV (tone data), writes gdelt-parsed.json. Deviation: uses DOC v2 tone API (not deprecated v1 Stability Timeline). Media bias containment via weight cap only (spike detection missing). |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `gdelt.ts` | 137 | `setTimeout(r, 5_000)` × ~190 countries | ⚠️ Warning | Total fetch time ~16 min exceeds CI 5-min budget. Acknowledged in SUMMARY but not resolved. |
| `gdelt.ts` | 24-28 | `toneToInstability()` uses fixed absolute linear mapping | ⚠️ Warning | Media bias not fully contained — absolute tone value with no per-country baseline means media-saturated events produce extreme raw values before the 15% cap applies. Phase goal explicitly required self-relative spike detection. |
| `source-tiers.json` | 3 | `maxDailyScoreChange: 0.3` defined | ℹ️ Info | Config value exists but `engine.ts` does not enforce it (no grep match). Defined but unused — future protection against daily score drift is incomplete. |

---

### Human Verification Required

#### 1. Pipeline Live Run

**Test:** Run `npx tsx src/pipeline/run.ts` with a recent date
**Expected:** Pipeline completes, GDELT produces gdelt-parsed.json with 50+ countries, all values in [0,1] range
**Why human:** Fetch takes ~16 minutes and requires live GDELT API access; cannot verify in automated check

#### 2. Media Bias Sanity Check

**Test:** Inspect gdelt-parsed.json instability values for multiple countries across a range of media profiles (UK, Somalia, Germany, South Sudan). Compare against advisory levels.
**Expected:** Rankings are roughly consistent with actual conflict levels, not dominated by media attention (e.g., UK should score lower instability than South Sudan regardless of news cycles)
**Why human:** Requires comparing live data against ground truth knowledge; statistical cross-validation of bias containment

---

### Gaps Summary

Two gaps block full goal achievement:

**Gap 1 — CI Budget Exceeded (~16 min fetch vs 5 min budget):** The 5s rate-limit delay was correctly imposed (GDELT's documented limit), but with ~190 valid countries, the total fetch time vastly exceeds the plan's stated CI constraint. The SUMMARY acknowledges this and suggests running GDELT "separately or asynchronously," but no action was taken. This makes GDELT effectively incompatible with standard GitHub Actions CI runs.

**Gap 2 — Self-Relative Spike Detection Missing (phase goal not met):** The phase goal explicitly requires "media bias explicitly contained through self-relative spike detection." The research documents (PITFALLS.md, SUMMARY.md) are unambiguous: GDELT's cross-country media bias requires per-country self-relative normalization, not just a weight cap. The current implementation converts absolute tone values to instability with a fixed linear formula. A country that suddenly dominates headlines will produce an extreme instability value (potentially 1.0) before the 15% cap reduces it — the weight cap contains influence but does not prevent the raw score from being extreme. The phase goal's stated mechanism (self-relative spike detection) was replaced by the weight cap alone.

The weight cap and indicator weights are correctly implemented and compile cleanly. The fallback, FIPS mapping, normalization range, and pipeline integration are all properly wired. The two gaps are architectural concerns about the bias containment strategy and operational feasibility within CI.

---

_Verified: 2026-03-23_
_Verifier: Claude (gsd-verifier)_
