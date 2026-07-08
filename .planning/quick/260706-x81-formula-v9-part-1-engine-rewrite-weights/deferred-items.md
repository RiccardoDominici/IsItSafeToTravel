# Deferred items — quick-260706-x81 (Formula v9 PART 1)

> **RESOLUTION UPDATE (2026-07-08, quick task 260708-efx):** items 2, 3 and the
> operational note below are FIXED — snapshot.test.ts globalScore assertions aligned
> to the 2-decimal implementation (5.97); history.test.ts expectations now include
> `dc: 0`; latest.json backup/restore added to BOTH snapshot.test.ts (listSnapshotDates)
> and data05-historical.test.ts (the second, previously-undocumented corruptor).
> Item 1 resolved itself with the Task-3 live backfill as predicted (drift guard green).
> npm test: 120/120, `git status data/scores/` clean after runs.


Pre-existing, out-of-scope issues discovered while running `npm test`. None are
caused by the Formula v9 engine/weights/backfill/gpi/test changes in this plan
(verified against the Task 1 commit / pre-v9 baseline, where all three already
reproduced identically). Per the executor's scope-boundary rule, these are
logged here and NOT fixed as part of this plan.

## 1. `score-drift-guard.test.ts` fails against the CURRENT (pre-regen) data/scores/*.json

`no country score drifts more than 1.5 per day between consecutive snapshots`
reports 94 violations across the existing v8.x historical snapshot history
(e.g. BFA oscillating ~2.5-2.7pts every other day, UKR/JPN/LIE/GUM cliff jumps,
many micro-territory jumps around 2026-03-23/24 and 2026-04-14/15). These are
artifacts of the OLD v8.x formula's hard-cap/critical-floor mechanisms and
historical backfill GPI/vdem vintage bugs — exactly what SHIP-SPEC's threat
register T-x81-04 names as the reason the Task 3 live backfill must rewrite
ALL 667/668 snapshots consistently under Formula v9. **Expected to go GREEN
after Task 3's live backfill** (re-verified there); not fixable from Task 2
alone since it depends on `data/scores/**` content, not engine/backfill code.

## 2. `snapshot.test.ts` "globalScore computation" — rounding mismatch (pre-existing, unrelated to v9)

Three assertions expect `writeSnapshot()`'s `globalScore` to round to **1**
decimal place (`(7.5+2.3+8.1)/3 = 5.9666... -> 6.0`), but the actual
implementation in `src/pipeline/scoring/snapshot.ts` (untouched by this plan)
rounds to **2** decimals (`Math.round(mean * 100) / 100` -> `5.97`). This is a
stale test/implementation mismatch predating Formula v9 — `snapshot.ts` is not
in this plan's `files_modified`. Reproduced identically at the Task 1 commit
baseline (before any Task 2 test rewrites).

## 3. `history.test.ts` "builds per-country arrays from multiple snapshots" — extra `dc` field (pre-existing, unrelated to v9)

The test's own `makeScoredCountry` fixture sets `dataCompleteness: 0` (present
since commit `c981538d`, "fix: lower insufficient data threshold from 0.5 to
0.15" — long before Formula v9). `history.ts`'s `writeHistoryIndex()` (also
untouched by this plan) includes a `dc` field in each per-country trend point
whenever `dataCompleteness < 0.15`, so the actual output legitimately contains
`dc: 0` on every point — the test's hardcoded `expected` array just never
updated to include it. Unrelated to the `confidence` field added in Task 1
(only `confidence` was added to this fixture; `dataCompleteness: 0` was
already there).

## Operational note: `snapshot.test.ts`'s third describe block corrupts real data/scores/latest.json

`describe('snapshot: listSnapshotDates', ...)` calls `writeSnapshot('2099-01-0X', ...)`
directly (which unconditionally overwrites `data/scores/latest.json`) but,
unlike the file's other two describe blocks, has **no** `beforeEach`/`afterEach`
save-and-restore pair for `latest.json` — only its date-stamped test files get
cleaned up. Every `npm test` run therefore leaves the real
`data/scores/latest.json` overwritten with a 1-country 2099 test fixture.
Pre-existing (reproduced at the Task 1 baseline before any Task 2 changes);
`snapshot.test.ts` is not in this plan's `files_modified`, so not fixed here.
**Executor mitigation used in this session:** run `git checkout --
data/scores/latest.json` after every `npm test` invocation, before reading or
committing anything under `data/scores/`. Task 3's live backfill fully
regenerates `data/scores/latest.json` from scratch regardless, so this has no
effect on the final committed data.
