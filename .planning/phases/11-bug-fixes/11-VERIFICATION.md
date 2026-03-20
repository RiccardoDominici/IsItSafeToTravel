---
phase: 11-bug-fixes
verified: 2026-03-20T10:15:00Z
status: passed
score: 3/3 must-haves verified
re_verification: false
---

# Phase 11: Bug Fixes Verification Report

**Phase Goal:** Existing features work correctly -- users can compare countries and trust chart dates
**Verified:** 2026-03-20T10:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                     | Status     | Evidence                                                                                     |
| --- | ----------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| 1   | Trend chart x-axis labels show the correct date (not shifted by one day due to timezone)  | VERIFIED   | All date constructions use `T00:00:00Z` suffix; `utcFormat` used for axis tick rendering     |
| 2   | User can click a country in the comparison search dropdown and it gets selected           | VERIFIED   | `mousedown` + `e.preventDefault()` on items; `relatedTarget` blur check; no setTimeout race  |
| 3   | Date fix applies to all chart instances: TrendChart, global safety pages, comparison pages | VERIFIED  | 6 occurrences in TrendChart.astro, 3 each in global-safety + sicurezza-globale + compare + confronta |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact                                    | Expected                                       | Status     | Details                                                                                      |
| ------------------------------------------- | ---------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| `src/components/country/TrendChart.astro`   | Build-time trend chart with UTC date parsing   | VERIFIED   | 6x `T00:00:00Z`, `utcFormat` imported and used at line 70                                   |
| `src/pages/en/global-safety.astro`          | Global safety chart with UTC date parsing      | VERIFIED   | 3x `T00:00:00Z` (lines 41, 51, 57), `utcFormat` imported and used at line 62               |
| `src/pages/it/sicurezza-globale.astro`      | Italian global safety chart with UTC dates     | VERIFIED   | 3x `T00:00:00Z`, `utcFormat` imported and used (mirrors global-safety.astro)                |
| `src/pages/en/compare.astro`                | Comparison page with UTC dates and mousedown   | VERIFIED   | 3x `T00:00:00Z`, `utcFormat`, `mousedown` at line 195, `relatedTarget` at line 257         |
| `src/pages/it/confronta.astro`              | Italian comparison page with UTC dates and mousedown | VERIFIED | 3x `T00:00:00Z`, `utcFormat`, `mousedown` at line 195, `relatedTarget` at line 257   |

### Key Link Verification

| From                                      | To                    | Via                                              | Status   | Details                                                                                           |
| ----------------------------------------- | --------------------- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| `src/components/country/TrendChart.astro` | d3 utcFormat          | UTC date parsing ensures correct axis labels     | WIRED    | `new Date(d.date + 'T00:00:00Z')` pattern confirmed 5+ times; `utcFormat('%b %d')` at line 70   |
| `src/pages/en/compare.astro`              | dropdown click handler | mousedown event fires before blur hides dropdown | WIRED    | `addEventListener('mousedown', (e) => { e.preventDefault()` at line 195; `relatedTarget` check at lines 257-259 removes the setTimeout race |

### Requirements Coverage

| Requirement | Source Plan | Description                                                | Status    | Evidence                                                                                           |
| ----------- | ----------- | ---------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| BUG-01      | 11-01-PLAN  | User sees correct dates on historical trend chart axes     | SATISFIED | `T00:00:00Z` + `utcFormat` across all 5 chart files eliminates timezone day-shift                 |
| BUG-02      | 11-01-PLAN  | User can search and select countries correctly on comparison page | SATISFIED | `mousedown` + `preventDefault` on dropdown items; `relatedTarget` blur check removes race condition |

No orphaned requirements. REQUIREMENTS.md maps only BUG-01 and BUG-02 to Phase 11. Both are accounted for by 11-01-PLAN.

### Anti-Patterns Found

No anti-patterns detected. Spot-checked all five modified files for:
- TODO/FIXME/placeholder comments — none found
- Empty implementations (`return null`, `return {}`) — none found
- Bare `new Date(*.date)` without UTC suffix — none found in any of the five files
- `setTimeout` race condition pattern removed — confirmed absent in both compare.astro and confronta.astro

### Human Verification Required

#### 1. Visual date correctness on deployed site

**Test:** Visit a country detail page (e.g., `/en/country/italy`) in a browser with the system timezone set to UTC-5 or further west, check the x-axis date labels on the trend chart.
**Expected:** The last data point label matches today's (or the most recent) date in the dataset, not the previous day.
**Why human:** Date rendering is visual and timezone-dependent; cannot be verified by static code inspection alone.

#### 2. Comparison dropdown — selecting a country

**Test:** Visit `/en/compare`, type a country name (e.g., "France"), wait for dropdown, then click one of the results.
**Expected:** The country is added to the comparison, the dropdown closes, and the chart updates.
**Why human:** The mousedown/relatedTarget interaction depends on browser focus handling and cannot be fully verified by reading code.

### Gaps Summary

None. All must-haves verified.

---

_Verified: 2026-03-20T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
