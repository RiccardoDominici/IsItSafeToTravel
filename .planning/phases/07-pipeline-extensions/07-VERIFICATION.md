---
phase: 07-pipeline-extensions
verified: 2026-03-19T21:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Running the pipeline produces a globalScore field in the daily snapshot JSON"
  gaps_remaining: []
  regressions: []
---

# Phase 7: Pipeline Extensions Verification Report

**Phase Goal:** The data pipeline produces a global safety score and a consolidated history index that all v1.1 UI features depend on
**Verified:** 2026-03-19T21:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (pipeline re-run regenerated real data files)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running the pipeline produces a globalScore field in the daily snapshot JSON | VERIFIED | latest.json: date=2026-03-19, globalScore=6.6, countries=248. Arithmetic mean confirmed (computed mean matches stored value). 2026-03-19.json also has globalScore=6.6. Neither is a test artifact. |
| 2 | Running the pipeline produces a data/scores/history-index.json file | VERIFIED | File exists: generatedAt=2026-03-19T19:35:11.927Z, 1 global entry (score=6.6), 248 countries. |
| 3 | history-index.json contains per-country arrays of {date, score} points from all daily snapshots | VERIFIED | Structure correct: { generatedAt, global: [{date,score}], countries: { [iso3]: [{date,score}] } }. 248 countries, 1 date entry each (2026-03-19). |
| 4 | globalScore is the arithmetic mean of all country score fields, rounded to one decimal | VERIFIED | Programmatic check: countries.reduce mean=6.6 matches d.globalScore=6.6. snapshot.ts line 32-34 computes Math.round(mean*10)/10. 10/10 snapshot tests pass. |
| 5 | Both outputs update automatically on every pipeline run without manual intervention | VERIFIED | run.ts line 77: writeHistoryIndex() called unconditionally in Stage 5 after writeSnapshot (Stage 4). No manual step required. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pipeline/types.ts` | DailySnapshot type with globalScore field | VERIFIED | Line 98: `globalScore: number; // arithmetic mean of all countries[].score, rounded to 1 decimal` |
| `src/pipeline/scoring/snapshot.ts` | Global score computation in writeSnapshot | VERIFIED | Lines 32-34 compute globalScore via reduce; field present in snapshot object literal |
| `src/pipeline/scoring/history.ts` | History index consolidation function | VERIFIED | Exports writeHistoryIndex and HistoryIndex interface; calls listSnapshotDates() and loadSnapshot() |
| `data/scores/history-index.json` | Consolidated history data for all countries | VERIFIED | Exists with correct structure; generatedAt=2026-03-19T19:35:11.927Z, 1 global entry, 248 countries |
| `src/lib/scores.ts` | Updated loadHistoricalScores using history-index.json | VERIFIED | Line 6: HISTORY_INDEX_PATH defined; loadHistoricalScores() prefers consolidated file; loadGlobalHistory() exported |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pipeline/scoring/snapshot.ts` | `src/pipeline/types.ts` | DailySnapshot.globalScore field | VERIFIED | snapshot.ts imports DailySnapshot from ../types.js; globalScore written into snapshot object literal (line 41) |
| `src/pipeline/run.ts` | `src/pipeline/scoring/history.ts` | writeHistoryIndex call after writeSnapshot | VERIFIED | run.ts line 4: imports writeHistoryIndex; line 77: called in Stage 5 after Stage 4 (writeSnapshot) |
| `src/lib/scores.ts` | `data/scores/history-index.json` | loadHistoricalScores reads consolidated file | VERIFIED | Line 6 defines HISTORY_INDEX_PATH; loadHistoricalScores() checks fs.existsSync(HISTORY_INDEX_PATH) before falling back to individual files |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PIPE-01 | 07-01-PLAN.md | Pipeline computes a global safety score (arithmetic mean of all country scores) daily | SATISFIED | globalScore field in DailySnapshot type; arithmetic mean computed in writeSnapshot; latest.json and 2026-03-19.json both have globalScore=6.6; 4 snapshot tests verifying computation |
| PIPE-02 | 07-01-PLAN.md | Pipeline consolidates daily snapshots into a single history-index.json for efficient build-time loading | SATISFIED | writeHistoryIndex() creates history-index.json on every run; scores.ts reads from it preferentially; Stage 5 in run.ts ensures it runs unconditionally |

No orphaned requirements — REQUIREMENTS.md Traceability table maps only PIPE-01 and PIPE-02 to Phase 7, both claimed by 07-01-PLAN.md and both satisfied.

### Anti-Patterns Found

None. The previously flagged test-artifact in latest.json (date: 2099-01-01, countries: 1) has been replaced by the real pipeline output (date: 2026-03-19, countries: 248, globalScore: 6.6). The previously flagged missing globalScore in 2026-03-19.json is resolved — the field is now present.

### Human Verification Required

None — all automated checks are conclusive.

### Re-verification Summary

The single gap from initial verification was a data state issue: committed data files did not reflect a real pipeline run with PIPE-01 active. The pipeline was re-run, which:

1. Regenerated `data/scores/2026-03-19.json` with `globalScore: 6.6` and 248 countries — conforming to the updated DailySnapshot interface.
2. Updated `data/scores/latest.json` to the same real snapshot (date: 2026-03-19, not the test artifact 2099-01-01).
3. Regenerated `data/scores/history-index.json` with the correctly-typed entry (date: 2026-03-19, score: 6.6).

All 14 tests (10 snapshot + 4 history) pass with no regressions. All 5 must-have truths are now verified. Phase goal is achieved.

---

_Verified: 2026-03-19T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
