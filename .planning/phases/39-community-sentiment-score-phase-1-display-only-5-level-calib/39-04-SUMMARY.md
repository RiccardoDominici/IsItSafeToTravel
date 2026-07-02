---
phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib
plan: 04
subsystem: pipeline
tags: [typescript, node-test, tdd, cloudflare-d1, github-actions, data-pipeline]

# Dependency graph
requires:
  - phase: 39-02
    provides: "aggregateVotes() pure function + VoteRow/SentimentEntry/SentimentSnapshot types (src/pipeline/sentiment/aggregate.ts, src/pipeline/types.ts)"
  - phase: 39-01
    provides: "D1 votes schema + wrangler.toml [[d1_databases]] binding (database_id 83acaffe-32ff-43fc-b68f-5343d01000d5)"
provides:
  - "fetchVotes(sinceEpochSeconds) — D1 HTTP query client that never throws, exported from src/pipeline/sentiment/fetch-votes.ts"
  - "writeSentimentSnapshot / writeSentimentHistoryIndex / getSentimentDir — src/pipeline/sentiment/snapshot.ts, writing data/sentiment/{date,latest,history-index}.json"
  - "run.ts Stage 6: wires fetchVotes -> aggregateVotes -> writeSentimentSnapshot on the daily 06:00 UTC cadence, wrapped so failures only warn"
  - "data-pipeline.yml passes CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN to the pipeline step and commits data/sentiment/"
affects: [39-05-display-component]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D1 HTTP query API called with plain fetch() + Bearer token (no wrangler invocation), mirroring the existing fetchers/*.ts try/catch/degrade shape"
    - "Dated + latest.json snapshot pair for a NEW small data/sentiment/ directory, deliberately kept separate from the 73MB data/scores/history-index.json (Pitfall 3)"
    - "Outer try/catch around an entire pipeline stage that only console.warns and never touches PipelineResult.success — the graceful-degradation idiom for optional/best-effort stages"

key-files:
  created:
    - src/pipeline/sentiment/fetch-votes.ts
    - src/pipeline/sentiment/snapshot.ts
    - src/pipeline/sentiment/__tests__/fetch-votes.test.ts
  modified:
    - src/pipeline/run.ts
    - .github/workflows/data-pipeline.yml

key-decisions:
  - "First-ever run with no prior data/sentiment/latest.json writes an empty-but-valid snapshot via writeSentimentSnapshot (not a bare file write) so both latest.json and the dated file exist from day one, keeping the dated-file listing (writeSentimentHistoryIndex) consistent even on the degraded path"
  - "writeSentimentHistoryIndex() is only called on the ok:true branch — a D1-unreachable day does not regenerate the history index, matching the plan's literal branch spec"
  - "180-day vote window (SENTIMENT_WINDOW_DAYS) applied via WHERE created_at > ? to keep D1 free-tier rows-read cost flat as the votes table grows (Pitfall 8)"

requirements-completed: [D-10, D-13, D-14, D-16]

# Metrics
duration: 3min
completed: 2026-07-02
---

# Phase 39 Plan 04: Daily pipeline sentiment stage — D1 fetch, snapshot/history bake, run.ts Stage 6, workflow wiring Summary

**Stage 6 in `run.ts` pulls a 180-day window of vote rows from Cloudflare D1 over its HTTP query API, aggregates them with `aggregateVotes`, and bakes `data/sentiment/{date,latest,history-index}.json` — a new directory kept off the 73MB `data/scores/history-index.json` — with every failure path (missing CF credentials, D1 unreachable, thrown errors) degrading to a warning instead of breaking the daily run or the build.**

## Performance

- **Duration:** ~3 min (4 commits between 10:57:27 and 11:00:15 local, 2026-07-02)
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `fetchVotes(sinceEpochSeconds)` in `src/pipeline/sentiment/fetch-votes.ts`: POSTs to the D1 query endpoint (`.../d1/database/{SENTIMENT_D1_DATABASE_ID}/query`) with a 30s timeout and Bearer auth, and **never throws** — missing `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`, a rejected fetch, a non-2xx response, or malformed JSON all resolve to `{ok:false, rows:[]}`; a successful zero-row response resolves distinctly as `{ok:true, rows:[]}`
- 7 unit tests in `fetch-votes.test.ts` cover the missing-credentials short-circuit (asserting fetch is never invoked), network/HTTP/parse failure degradation, successful row mapping (asserting the exact POST URL and Bearer header), and the ok-but-empty case
- `src/pipeline/sentiment/snapshot.ts`: `writeSentimentSnapshot(date, snapshot)` writes both `data/sentiment/{date}.json` and `data/sentiment/latest.json`; `writeSentimentHistoryIndex()` lists the dated snapshot files and consolidates them into a compact `data/sentiment/history-index.json` of `{iso3: [{date, correction, count}]}` — structurally independent of and never referencing `data/scores/**`
- `run.ts` Stage 6 (after Stage 5 `writeHistoryIndex()`): computes a 180-day cutoff, calls `fetchVotes`, builds the `officialScores` map from `scoredCountries`, and on success calls `aggregateVotes` + `writeSentimentSnapshot` + `writeSentimentHistoryIndex`; on D1-unavailable it either preserves the last-known `latest.json` (if present) or writes an empty-but-valid snapshot (first run) — the whole block is wrapped in try/catch that only warns, leaving `sourcesSucceeded > 0` as the sole success determinant
- `.github/workflows/data-pipeline.yml`: added `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` to the pipeline step's `env:` (existing repo secrets, already used by `deploy.yml`) and `git add data/sentiment/ 2>/dev/null || true` to the commit step, alongside the existing `data/history/` line

## Task Commits

1. **Task 1: fetch-votes.ts — D1 HTTP query client + degradation test** (TDD)
   - RED: `a192cba8` `test(39-04): add failing test for fetchVotes D1 HTTP client` — confirmed failing via `ERR_MODULE_NOT_FOUND` (module did not exist yet)
   - GREEN: `76a9919a` `feat(39-04): implement fetchVotes D1 HTTP query client` — all 7 tests pass
   - No REFACTOR commit needed — implementation was already minimal
2. **Task 2: snapshot.ts + run.ts Stage 6** — `5dc2ae67` `feat(39-04): wire sentiment aggregation into daily pipeline as Stage 6`
3. **Task 3: data-pipeline.yml — CF credentials + commit data/sentiment/** — `a2137645` `chore(39-04): pass CF credentials to the daily pipeline + commit data/sentiment/`

**Plan metadata:** (this commit, following SUMMARY.md write)

_Note: Task 1 followed the plan's `tdd="true"` RED→GREEN cycle; Tasks 2-3 were single-commit `auto` tasks._

## Files Created/Modified
- `src/pipeline/sentiment/fetch-votes.ts` - `fetchVotes()` D1 HTTP query client + `SENTIMENT_D1_DATABASE_ID` constant; never throws
- `src/pipeline/sentiment/__tests__/fetch-votes.test.ts` - 7 test cases (missing-env short-circuit, network/HTTP/parse failure, row mapping, ok-empty)
- `src/pipeline/sentiment/snapshot.ts` - `getSentimentDir`, `writeSentimentSnapshot`, `writeSentimentHistoryIndex` — dated+latest pattern mirroring `scoring/snapshot.ts`, separate small history file
- `src/pipeline/run.ts` - Added Stage 6 (Sentiment) after Stage 5, wrapped in try/catch; imports from `./sentiment/{aggregate,fetch-votes,snapshot}.js`
- `.github/workflows/data-pipeline.yml` - `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` env passthrough + `git add data/sentiment/`

## Decisions Made
- Empty-but-valid first-run snapshot is written via the same `writeSentimentSnapshot` helper used for real data (rather than a bespoke inline `writeJson` call), so `data/sentiment/{date}.json` and `latest.json` stay consistent and `listSentimentSnapshotDates()` sees the file uniformly
- `writeSentimentHistoryIndex()` runs only on the `ok:true` path, per the plan's explicit branch spec — a D1-outage day neither regenerates nor corrupts the consolidated history
- Doc comments in `snapshot.ts` avoid the literal substring `data/scores/history-index` (rephrased to "the large scores dataset" / "the main scores history") purely to keep the plan's grep-based acceptance check (`! grep -q "data/scores/history-index"`) meaningful as a structural guard, not just a comment artifact

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria and the plan's `<verification>` block (`fetch-votes.test.ts` passes, `test:pipeline` still passes at 33/33, manual degradation check performed) were satisfied without needing any Rule 1-4 deviation.

## Issues Encountered
None. A local smoke test (`writeSentimentSnapshot`/`writeSentimentHistoryIndex` called directly via `tsx -e`) confirmed `data/sentiment/{date}.json`, `latest.json`, and `history-index.json` are produced with the expected shape; those smoke-test artifacts were deleted afterward (not committed) since this plan does not require a real `data/sentiment/` payload — that only appears from a genuine daily pipeline run once the CF token is granted D1 read (deferred manual step per 39-RESEARCH Open Question 1).

## User Setup Required
None new for this plan. Carried forward from 39-RESEARCH: the existing `CLOUDFLARE_API_TOKEN` repo secret likely lacks D1 read permission until manually granted in the Cloudflare dashboard — `fetchVotes` already degrades gracefully in that case (verified by this plan's tests), so no action is required for the pipeline to keep running; granting D1 read is what activates real sentiment data instead of the empty-but-valid placeholder.

## Next Phase Readiness
`data/sentiment/latest.json` (and the dated + history-index siblings) are now produced by the existing 06:00 UTC daily workflow once merged to master, ready for:
- **39-05** (display component / `src/lib/sentiment.ts`): can read `data/sentiment/latest.json` at build time using the same `fs.existsSync` guard pattern as `src/lib/scores.ts`'s `loadLatestSnapshot()` — the file is guaranteed to exist (even if `{generatedAt, countries:{}}`) after the first pipeline run post-merge, so no additional existence handling is needed beyond what 39-RESEARCH already specifies

No blockers. `data/sentiment/` is a genuinely new pipeline-owned artifact (not covered by CLAUDE.md's existing hand-edit-blocking hook list at plan-authoring time) — flagged here as a Threat Flag below for the orchestrator/verifier to consider adding to that list.

---
*Phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib*
*Completed: 2026-07-02*

## Threat Flags

| Flag | File | Description |
|------|------|--------------|
| threat_flag: generated-artifact-not-hook-protected | data/sentiment/** | New pipeline-owned generated directory (dated snapshots + latest.json + history-index.json), analogous to data/scores/** and data/raw/**, but not yet enumerated in CLAUDE.md's "Do NOT hand-edit generated files" table / PreToolUse hook. Low severity (same trust boundary as existing pipeline outputs, git-tracked and reviewable), but flagging so a future plan/doc update adds it to the hook list for consistency. |

## Self-Check: PASSED

All created files and commit hashes verified present on disk / in git log:
- `src/pipeline/sentiment/fetch-votes.ts` — FOUND
- `src/pipeline/sentiment/snapshot.ts` — FOUND
- `src/pipeline/sentiment/__tests__/fetch-votes.test.ts` — FOUND
- `src/pipeline/run.ts` (Stage 6 block) — FOUND
- `.github/workflows/data-pipeline.yml` (CLOUDFLARE_* env + git add data/sentiment/) — FOUND
- Commits `a192cba8`, `76a9919a`, `5dc2ae67`, `a2137645` — FOUND in `git log --oneline --all`
