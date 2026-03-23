---
phase: 22-historical-backfill
verified: 2026-03-23T12:00:00Z
status: human_needed
score: 3/3 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 1/3
  gaps_closed:
    - "Every data/scores/{date}.json uses weightsVersion 5.0.0 — all 566 snapshots confirmed"
    - "No abrupt score discontinuity — all history and live pipeline now on same v5.0.0 formula"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open a country detail page (e.g., USA or Germany) and inspect the trend chart spanning 2012–present"
    expected: "Smooth score progression with no visible jump at any formula boundary — no v3 cliff"
    why_human: "Score cliff detection requires visual inspection; automated checks confirm version uniformity but not the magnitude of visual continuity for a real user"
---

# Phase 22: Historical Backfill Verification Report

**Phase Goal:** All historical scores from 2012 onward are recalculated with the new formula so trend charts show smooth continuity instead of a v3 cliff
**Verified:** 2026-03-23
**Status:** human_needed (all automated checks pass; one visual confirmation item remains)
**Re-verification:** Yes — after gap closure (backfill re-run with v5.0.0 weights)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every data/scores/{date}.json uses weightsVersion 5.0.0 and tiered scoring | VERIFIED | Node scan: 566/566 files = "5.0.0", zero files on any other version |
| 2 | history-index.json contains per-pillar breakdowns for all 566 snapshot dates | VERIFIED | global.length=566, pillarHistory present for 248 countries with 5 named pillars each |
| 3 | No abrupt score discontinuity at the v3 formula change boundary | VERIFIED (automated) | All 566 snapshots use v5.0.0; sample across 2012–2026 confirms uniform version; visual continuity needs human check |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/backfill-scores.ts` | Backfill script at PLAN-declared path (min 40 lines) | MISSING | File does not exist at this path — non-blocking path discrepancy; script lives at `src/pipeline/backfill.ts` (174 lines) |
| `src/pipeline/backfill.ts` | Substantive backfill script (actual location) | VERIFIED | 174 lines; imports computeAllScores, writeSnapshot, writeHistoryIndex; full --dry-run support |
| `data/scores/history-index.json` | Rebuilt index with pillarHistory across all dates | VERIFIED | 566 dates, 248 countries, 5 pillars (conflict/crime/health/governance/environment) per country |
| `data/scores/*.json` (566 files) | weightsVersion "5.0.0" in all snapshot files | VERIFIED | All 566 files confirmed weightsVersion "5.0.0" — zero files on 4.0.0 or other versions |

Note: `scripts/backfill-scores.ts` (PLAN-declared path) does not exist. The executor created the script at `src/pipeline/backfill.ts` instead. This is a documentation-only discrepancy — the actual file is substantive, correctly wired, and functional. The gap was previously noted as non-blocking and remains so.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pipeline/backfill.ts` | `src/pipeline/scoring/engine.ts` | `import computeAllScores` | WIRED | Line 11: `import { computeAllScores } from './scoring/engine.js'`; called at line 102 |
| `src/pipeline/backfill.ts` | `src/pipeline/scoring/history.ts` | `import writeHistoryIndex` | WIRED | Line 13: `import { writeHistoryIndex } from './scoring/history.js'`; called at line 135 |
| `src/pipeline/backfill.ts` | `src/pipeline/scoring/snapshot.ts` | `import writeSnapshot` | WIRED | Line 12: `import { writeSnapshot } from './scoring/snapshot.js'`; called at line 113 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `data/scores/history-index.json` | global[], pillarHistory | All 566 score snapshots | Yes — 566 real date entries, 248 countries, named pillars | FLOWING |
| `data/scores/*.json` (formula version) | weightsVersion field | `src/pipeline/config/weights.json` | Yes — all 566 files carry "5.0.0", matching weights.json on HEAD | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| history-index.json has 566 dates | node scan global.length | 566 | PASS |
| history-index.json has pillarHistory | node check !!h.pillarHistory | true | PASS |
| Oldest snapshot (2012-03-19) uses v5.0.0 | check weightsVersion | "5.0.0" | PASS |
| Latest snapshot (2026-03-22) uses v5.0.0 | check weightsVersion | "5.0.0" | PASS |
| All 566 snapshots use v5.0.0 | full scan by version | 5.0.0: 566, others: 0 | PASS |
| USA score uniform across history (6 samples) | spot-check 2012/2016/2020/2023/2025/2026 | All "5.0.0"; scores 6.2–7.1 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HIST-01 | 22-01-PLAN.md | All historical scores back to 2012 are recalculated with the new formula to avoid the "v3 cliff" | SATISFIED | 566/566 snapshots confirmed at weightsVersion "5.0.0"; same formula as live pipeline |
| HIST-02 | 22-01-PLAN.md | history-index.json reflects consistent scoring across all dates after backfill | SATISFIED | global.length=566, pillarHistory for 248 countries with 5 named pillars; formula version uniform across all dates |

Note: REQUIREMENTS.md also lists HIST-01 and HIST-02 as Phase 9 "Complete" — those refer to the earlier trend chart UI features. The Phase 22 entries (lines 193–194) are the historical data backfill entries; both are now satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `data/scores/2012-03-19.json` | — | INFORM indicators carry `year: 2026` in a 2012 snapshot | Info | Expected — INFORM does not publish historical editions; latest available values are used as acknowledged in CONTEXT.md. Does not affect score consistency. |

No blocker anti-patterns remain. The v4.0.0 blocker from the initial verification is resolved.

### Human Verification Required

#### 1. Trend Chart Continuity Visual Check

**Test:** Open a country detail page (e.g., USA or Germany) and inspect the trend chart spanning 2012–present.
**Expected:** Smooth score progression with no visible jump at any formula boundary — no v3 cliff visible anywhere in the chart.
**Why human:** Score cliff detection requires visual inspection. Automated checks confirm all 566 snapshots are on the same v5.0.0 formula, but only a human can confirm that the resulting chart actually looks smooth to a user rather than showing a subtle discontinuity.

---

## Re-verification Summary

The two blocking gaps from the initial verification are closed:

1. **Version mismatch (was blocker, now closed):** All 566 historical snapshots have been re-scored with v5.0.0. Node scan confirms zero files on v4.0.0 or any other version.

2. **Cliff reintroduced (was blocker, now closed):** Historical data and the live pipeline are now on the same formula. The next pipeline run for a new date will produce v5.0.0 scores that are continuous with all historical v5.0.0 snapshots.

One pre-existing non-blocking deviation remains unchanged: the backfill script lives at `src/pipeline/backfill.ts` instead of the PLAN-declared `scripts/backfill-scores.ts`. This is a documentation issue only and does not affect the phase goal.

All automated must-haves are satisfied. One visual check (trend chart appearance) requires human confirmation.

---

_Verified: 2026-03-23_
_Verifier: Claude (gsd-verifier)_
