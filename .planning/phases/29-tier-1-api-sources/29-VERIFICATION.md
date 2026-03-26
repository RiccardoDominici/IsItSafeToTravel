---
phase: 29-tier-1-api-sources
verified: 2026-03-26T20:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 29: Tier-1 API Sources Verification Report

**Phase Goal:** Pipeline fetches advisory data from 4 countries with clean REST/JSON/XML APIs and establishes the normalization foundation that all subsequent sources will use
**Verified:** 2026-03-26T20:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | A normalizeDeLevel function maps Germany boolean flags to unified 1-4 scale | VERIFIED | `src/pipeline/normalize/advisory-levels.ts` line 17: `export function normalizeDeLevel(flags: { warning, partialWarning, situationWarning, situationPartWarning }): UnifiedLevel` — correct priority chain |
| 2  | A normalizeNlColor function maps Dutch color codes to unified 1-4 scale | VERIFIED | `advisory-levels.ts` line 33: rood=4, oranje=3, geel=2, groen=1, case-insensitive |
| 3  | A normalizeJpLevel function clamps Japan 1-4 levels | VERIFIED | `advisory-levels.ts` line 46: `Math.min(4, Math.max(1, Math.round(level))) as UnifiedLevel` |
| 4  | A normalizeSkLevel function parses Slovakia stupen text to unified 1-4 scale | VERIFIED | `advisory-levels.ts` line 54: regex `/(\d)\.\s*stupen/i`, clamps to 1-4 |
| 5  | A generic normalizeToUnified function maps any N-level system to 1-4 | VERIFIED | `advisory-levels.ts` line 69: `(value - sourceMin) / (sourceMax - sourceMin)` formula, clamped |
| 6  | ScoredCountry.advisories type accepts de, nl, jp, sk keys | VERIFIED | `src/pipeline/types.ts` lines 92-95: `de?: AdvisoryInfo; nl?: AdvisoryInfo; jp?: AdvisoryInfo; sk?: AdvisoryInfo` |
| 7  | Normalization ranges exist for advisory_level_de, _nl, _jp, _sk | VERIFIED | `src/pipeline/scoring/normalize.ts` lines 62-65: all 4 entries with `{ min: 1, max: 4, inverse: true }` |
| 8  | Pipeline fetches Germany advisory levels from Auswaertiges Amt (API-01) | VERIFIED | `fetchDeAdvisories` in `advisories-tier1.ts`: fetches `https://www.auswaertiges-amt.de/opendata/travelwarning`, uses `iso3CountryCode` + `normalizeDeLevel`, produces `indicatorName: 'advisory_level_de'` |
| 9  | Pipeline fetches Netherlands advisory levels from nederlandwereldwijd.nl (API-02) | VERIFIED | `fetchNlAdvisories`: iterates all COUNTRIES, fetches XML per country, extracts color with regex, produces `indicatorName: 'advisory_level_nl'` |
| 10 | Pipeline fetches Japan advisory levels from MOFA (API-03) | VERIFIED | `fetchJpAdvisories`: uses static `JP_MOFA_ID_TO_ISO3` map (120+ entries), parses HTML for レベル digits, produces `indicatorName: 'advisory_level_jp'` |
| 11 | Pipeline fetches Slovakia advisory data from MZV open data (API-04) | VERIFIED | `fetchSkAdvisories`: fetches CKAN endpoint, only produces indicators for records with non-empty risk text, produces `indicatorName: 'advisory_level_sk'` |
| 12 | When any individual API unreachable, pipeline completes and that source is skipped | VERIFIED | Independent `try/catch` blocks per sub-fetcher in `fetchTier1Advisories`; all errors collected in `errors[]`, pipeline continues; cache fallback only if ALL fail |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pipeline/normalize/advisory-levels.ts` | Shared normalization module for all advisory level systems | VERIFIED | 79 lines; exports UnifiedLevel type + 5 functions; no stubs |
| `src/pipeline/types.ts` | Extended ScoredCountry.advisories type with de/nl/jp/sk keys | VERIFIED | Lines 92-95 confirm all 4 optional keys present |
| `src/pipeline/scoring/normalize.ts` | Normalization ranges for new advisory indicators | VERIFIED | Lines 62-65: advisory_level_de/nl/jp/sk all present |
| `src/pipeline/fetchers/advisories-tier1.ts` | 4 sub-fetchers for DE/NL/JP/SK plus orchestrator | VERIFIED | 699 lines (well above min_lines: 200); exports fetchTier1Advisories; all 4 sub-fetchers present |
| `src/pipeline/fetchers/index.ts` | Updated fetcher registry including tier1 advisories | VERIFIED | Imports, exports, and calls fetchTier1Advisories in Promise.allSettled |
| `src/pipeline/config/source-tiers.json` | Signal tier entries for advisories_de/nl/jp/sk | VERIFIED | Lines 14-17: all 4 entries with tier=signal, maxAgeDays=30, decayHalfLifeDays=7 |
| `src/pipeline/config/sources.json` | Metadata for advisories_tier1 group | VERIFIED | Line 24: advisories_tier1 entry present |
| `src/pipeline/scoring/engine.ts` | Engine reads all 8 advisory sources including de/nl/jp/sk | VERIFIED | Line 102-103: advisories.de/nl/jp/sk?.level in advisoryLevels array; lines 204-207: all 4 INDICATOR_TO_SOURCE mappings |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `advisory-levels.ts` | `types.ts` | UnifiedLevel type aligns with advisory 1-4 scale | VERIFIED | `export type UnifiedLevel = 1 \| 2 \| 3 \| 4` — direct match |
| `scoring/normalize.ts` | `scoring/engine.ts` | INDICATOR_RANGES consumed by normalizeIndicators | VERIFIED | engine.ts line 1 imports `normalizeIndicators` from normalize.js; engine.ts line 57 calls it; `advisory_level_de` present in both |
| `advisories-tier1.ts` | `normalize/advisory-levels.ts` | imports normalization functions | VERIFIED | Lines 5-10: `import { normalizeDeLevel, normalizeNlColor, normalizeJpLevel, normalizeSkLevel } from '../normalize/advisory-levels.js'` |
| `advisories-tier1.ts` | `config/countries.ts` | imports getCountryByIso3, getCountryByName, COUNTRIES | VERIFIED | Line 4: `import { getCountryByName, getCountryByIso3, COUNTRIES } from '../config/countries.js'` |
| `fetchers/index.ts` | `advisories-tier1.ts` | imports and calls fetchTier1Advisories in fetchAllSources | VERIFIED | Lines 9, 14, 42: import + export + call inside Promise.allSettled; sourceNames includes 'advisories_tier1' |

### Data-Flow Trace (Level 4)

The artifacts in this phase are pipeline data-fetchers and normalization utilities — not UI components that render dynamic data. Data-flow verification applies to the fetcher output path rather than rendering.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `advisories-tier1.ts` | `allIndicators` | 4 live API calls (DE/NL/JP/SK) + cache fallback | Yes — real HTTP fetches with error handling and actual JSON/XML parsing | FLOWING |
| `scoring/normalize.ts` | `INDICATOR_RANGES` | Consumed by `normalizeIndicators` in engine | Yes — ranges are non-empty and engine calls normalizeIndicators with real indicator data | FLOWING |
| `scoring/engine.ts` | `advisoryLevels` array | `advisories.de?.level` etc from pipeline output | Yes — sourced from actual fetcher results passed through pipeline | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| advisory-levels.ts exports all 6 symbols | grep `export.*UnifiedLevel\|export function normalize` in file | All 6 found | PASS |
| advisories-tier1.ts has all 4 indicatorName values | grep `indicatorName:` | advisory_level_de, _nl, _jp, _sk all present | PASS |
| advisories-tier1.ts writes advisories-tier1-parsed.json | grep `advisories-tier1-parsed.json` | 3 occurrences: findLatestCached check + 2 writeJson calls | PASS |
| pipeline registers fetchTier1Advisories in parallel | grep `fetchTier1Advisories` in index.ts | 3 occurrences: import, export, Promise.allSettled call | PASS |
| Git commits from summaries exist in repo | `git log --oneline` | 88d6da8, e28447e, 298aebb, 66d4ad8 all verified | PASS |
| Pipeline TypeScript (src/pipeline/) compiles clean | `npx tsc --noEmit 2>&1 \| grep src/pipeline` | Zero pipeline errors (only pre-existing functions/ CF error) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NORM-01 | 29-01-PLAN | All new sources normalize to unified 1-4 advisory level scale | SATISFIED | `UnifiedLevel = 1 \| 2 \| 3 \| 4` type; all 5 normalization functions; all 4 INDICATOR_RANGES entries use min=1,max=4 |
| API-01 | 29-02-PLAN | Pipeline fetches Germany advisory levels from Auswaertiges Amt REST API daily | SATISFIED | `fetchDeAdvisories` fetches `https://www.auswaertiges-amt.de/opendata/travelwarning`; registered in fetchAllSources |
| API-02 | 29-02-PLAN | Pipeline fetches Netherlands advisory levels from nederlandwereldwijd.nl JSON API daily | SATISFIED | `fetchNlAdvisories` iterates COUNTRIES list, fetches XML per-country; registered in fetchAllSources |
| API-03 | 29-02-PLAN | Pipeline fetches Japan advisory levels from MOFA XML open data daily | SATISFIED | `fetchJpAdvisories` uses static MOFA ID map (120+ entries), parses HTML; registered in fetchAllSources |
| API-04 | 29-02-PLAN | Pipeline fetches Slovakia advisory data from MZV open data portal daily | SATISFIED | `fetchSkAdvisories` fetches CKAN endpoint, filters empty risk records; registered in fetchAllSources |

All 5 requirement IDs declared across plan frontmatter (`requirements: [NORM-01]` in 29-01, `requirements: [API-01, API-02, API-03, API-04]` in 29-02) are satisfied. No orphaned requirements found — REQUIREMENTS.md maps exactly these 5 IDs to Phase 29.

### Anti-Patterns Found

No anti-patterns detected across any phase-modified files:

- No TODO/FIXME/PLACEHOLDER comments
- No empty implementations (`return null`, `return {}`, `return []`)
- No stub handlers or hardcoded empty data flowing to outputs
- All fetch functions perform real HTTP calls with parsed responses

### Human Verification Required

#### 1. Live API connectivity (DE)

**Test:** Run `npx tsx src/pipeline/fetchers/advisories-tier1.ts` or trigger a pipeline run; check that `data/raw/{date}/advisories-de.json` is written with real country data.
**Expected:** `contentList` array with 150-200 country IDs; `advisories-tier1-parsed.json` contains `advisory_level_de` indicators for ~190+ countries.
**Why human:** Requires live internet access to `auswaertiges-amt.de`; cannot test without running the full pipeline.

#### 2. Netherlands XML color extraction

**Test:** Trigger pipeline run; inspect `data/raw/{date}/advisories-nl.json` `countriesWithData` count.
**Expected:** 50-180 countries with non-zero color match (many countries may have no NL advisory page).
**Why human:** XML response format depends on live endpoint; multi-region regex correctness needs live data to validate.

#### 3. Japan MOFA HTML level parsing

**Test:** Trigger pipeline run; inspect `data/raw/{date}/advisories-jp.json` `countriesWithData` count.
**Expected:** 80-120 countries with extracted level (レベル pattern present in most pages).
**Why human:** HTML structure of MOFA pages may have changed; fullwidth digit parsing needs live HTML to confirm.

### Gaps Summary

No gaps found. All 12 observable truths verified, all 5 requirements satisfied, all key links wired, all commits confirmed in git history, TypeScript pipeline compiles clean.

---

_Verified: 2026-03-26T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
