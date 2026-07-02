---
phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib
plan: 02
subsystem: scoring
tags: [typescript, node-test, tdd, pure-math, sentiment, half-life-decay]

# Dependency graph
requires:
  - phase: 39-01
    provides: D1 votes schema + Turnstile-gated ingestion Function (not yet consumed by this plan)
provides:
  - "SentimentEntry / SentimentSnapshot / VoteRow types (sibling to, not part of, PillarScore/ScoredCountry)"
  - "aggregateVotes() pure function: recency-weighted mean of vote deltas -> clamped correction -> clamped perceived score"
  - "Tunable named constants: SENTIMENT_HALF_LIFE_DAYS, SENTIMENT_DELTA_SCALE, SENTIMENT_CORRECTION_CAP, SENTIMENT_MIN_VOTES"
  - "Automated score-invariance guard proving sentiment cannot perturb the 5-pillar geometric mean (D-06)"
affects: [39-04-pipeline-integration, 39-05-display-component]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recency-weighted half-life decay for user-vote aggregation (mirrors freshness.ts's exponential half-life shape but keyed on delta averaging rather than indicator freshness gating)"
    - "Structurally-independent sibling types alongside a closed union (Sentiment types never touch PillarName/ScoredCountry.pillars) as the mechanism for locking a display-only guarantee"

key-files:
  created:
    - src/pipeline/sentiment/aggregate.ts
    - src/pipeline/sentiment/__tests__/aggregate.test.ts
    - src/pipeline/sentiment/__tests__/score-invariance.test.ts
  modified:
    - src/pipeline/types.ts

key-decisions:
  - "Countries below SENTIMENT_MIN_VOTES (5) are OMITTED from SentimentSnapshot.countries entirely (not flagged) — absent means insufficient, matching D-09/D-14's graceful-default requirement and simplifying the display layer's lookup logic"
  - "Countries with votes but no matching entry in officialScores are also skipped — perceived cannot be computed without an official baseline, and this keeps aggregateVotes a total function with no thrown errors on partial input"
  - "Recency weight for a vote with a negative age (clock skew / future timestamp) is clamped to 1 (treated as fresh), following the same defensive pattern as freshnessWeight in freshness.ts"

requirements-completed: [D-01, D-02, D-03, D-06, D-07, D-08, D-09]

# Metrics
duration: 2min
completed: 2026-07-02
---

# Phase 39 Plan 02: Sentiment types + recency-weighted aggregation math (pure, TDD) + score-invariance guard Summary

**Pure `aggregateVotes()` function computing a half-life recency-weighted mean of signed vote deltas, hard-clamped to a ±1.0 score-point correction, plus an automated guard proving sentiment can never enter the 5-pillar scoring geometric mean.**

## Performance

- **Duration:** ~2 min (3 commits between 10:48:35 and 10:49:42 local)
- **Tasks:** 2
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments
- `SentimentEntry` / `SentimentSnapshot` / `VoteRow` added to `src/pipeline/types.ts` as a clearly-banner-commented, structurally-independent sibling block — never referencing `PillarName` and never appended to `ScoredCountry.pillars`
- `aggregateVotes(rows, officialScores, nowMs)` implemented in `src/pipeline/sentiment/aggregate.ts`: groups votes by iso3, applies exponential half-life recency weighting (mirroring `freshness.ts`'s decay shape), computes `avgDelta`, clamps `correction` to ±`SENTIMENT_CORRECTION_CAP` (1.0), and clamps `perceived = official + correction` to [1, 10]
- Four tunable named constants exported: `SENTIMENT_HALF_LIFE_DAYS=30`, `SENTIMENT_DELTA_SCALE=0.5`, `SENTIMENT_CORRECTION_CAP=1.0`, `SENTIMENT_MIN_VOTES=5`
- 14 unit tests in `aggregate.test.ts` cover the ±1.0 clamp, perceived floor/ceil, recency-weighted half-life math, the 5-vote display floor, missing-official-score skip, and multi-country grouping
- `score-invariance.test.ts` (4 tests) proves by construction that `weights.json` still declares exactly the 5 closed pillars and that `computeAllScores()` output never grows a 6th `PillarScore` or a `'sentiment'`-named pillar — this is the automated lock for D-06

## Task Commits

Each task followed the TDD RED -> GREEN cycle (Task 1) plus a single test-only commit (Task 2, itself a `tdd="true"` guard with no separate implementation file to add):

1. **Task 1: Add Sentiment types + implement aggregateVotes with tunable constants**
   - RED: `ebba25a6` `test(39-02): add failing test for aggregateVotes + Sentiment types` — added `types.ts` interfaces + `aggregate.test.ts` (14 cases); confirmed failing via `ERR_MODULE_NOT_FOUND` since `aggregate.ts` did not yet exist
   - GREEN: `fef525fe` `feat(39-02): implement aggregateVotes recency-weighted sentiment math` — implemented `aggregate.ts`; all 14 tests pass
   - No REFACTOR commit needed — implementation was already minimal/clean after GREEN
2. **Task 2: Score-invariance guard (D-06)**
   - `a6aa7c3f` `test(39-02): score-invariance guard locking the display-only guarantee (D-06)` — added `score-invariance.test.ts` (4 assertions against `weights.json` + `computeAllScores`); all pass immediately since `weights.json`/`engine.ts` were correctly left untouched

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `src/pipeline/types.ts` - Added `VoteRow`, `SentimentEntry`, `SentimentSnapshot` under a "Sentiment (display-only, NOT a scoring pillar)" comment banner; `PillarName`/`PillarScore`/`ScoredCountry` untouched
- `src/pipeline/sentiment/aggregate.ts` - `aggregateVotes()` pure function + 4 named constants + local `clamp()` helper
- `src/pipeline/sentiment/__tests__/aggregate.test.ts` - 14 test cases (clamp, perceived clamp, recency weighting, vote floor, missing-official skip, multi-country)
- `src/pipeline/sentiment/__tests__/score-invariance.test.ts` - 4 test cases proving D-06 by construction against `weights.json` and `computeAllScores()`

## Decisions Made
- Below-floor countries (< 5 votes) are omitted from the snapshot entirely rather than flagged — matches the plan's explicit choice for the D-09/D-14 graceful-default behavior and keeps the display layer's "insufficient data" check a simple key-absence lookup
- Countries with votes but no `officialScores` entry are silently skipped (not an error) — `aggregateVotes` remains a total function that never throws on partial/mismatched input, satisfying Pitfall 4's "sentiment failure must never break the pipeline" requirement ahead of schedule (that requirement formally belongs to 39-04, but the function's design already supports it)
- Recency weight formula follows `freshness.ts`'s exponential half-life exactly (`0.5 ** (ageDays/halfLife)`), reusing a proven, already-tested idiom rather than inventing new decay math

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria and the plan's overall `<verification>` block (aggregate.test.ts pass, score-invariance.test.ts pass, `test:pipeline` + `test:freshness` no regression) were satisfied without needing any Rule 1-4 deviation.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. This plan is pure TypeScript math with no runtime dependencies, network calls, or environment variables.

## Next Phase Readiness
`aggregateVotes()` and the `Sentiment*` types are ready to be consumed by:
- **39-04** (pipeline integration): will call `aggregateVotes()` with real D1 vote rows and the daily `officialScores` map, writing the result to `data/sentiment/latest.json`
- **39-05** (display component): will read `SentimentEntry.perceived`/`correction`/`count` to render the "6th pillar" UI, using `count === undefined` (key absent) as the "not enough votes" state

No blockers. The score-invariance guard (`score-invariance.test.ts`) should be kept in the CI-run test set going forward so any future PR that accidentally touches `weights.json` or `ScoredCountry.pillars` fails fast.

---
*Phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib*
*Completed: 2026-07-02*

## TDD Gate Compliance

- RED gate: `ebba25a6` (`test(39-02): add failing test for aggregateVotes + Sentiment types`) — verified failing before implementation existed.
- GREEN gate: `fef525fe` (`feat(39-02): implement aggregateVotes recency-weighted sentiment math`) — verified passing after implementation.
- Task 2 (`score-invariance.test.ts`) is itself the guard artifact; its single commit `a6aa7c3f` passed immediately by construction (no separate implementation file required — the guard exercises existing, untouched `weights.json`/`engine.ts`).

Gate sequence satisfied: test(...) precedes feat(...) in git log.

## Self-Check: PASSED

All created files and commit hashes verified present on disk / in git log:
- `src/pipeline/types.ts` — FOUND
- `src/pipeline/sentiment/aggregate.ts` — FOUND
- `src/pipeline/sentiment/__tests__/aggregate.test.ts` — FOUND
- `src/pipeline/sentiment/__tests__/score-invariance.test.ts` — FOUND
- `.planning/phases/39-community-sentiment-score-phase-1-display-only-5-level-calib/39-02-SUMMARY.md` — FOUND
- Commits `ebba25a6`, `fef525fe`, `a6aa7c3f` — FOUND in `git log --oneline --all`
