# Phase 7: Pipeline Extensions - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Pipeline produces a global safety score (arithmetic mean of all country scores) and a consolidated history-index.json from daily snapshot files. Pure data infrastructure — no UI changes.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key guidance from research:
- Global score: simple arithmetic mean of all country `score` fields
- history-index.json: compact format with per-country arrays of {date, score} points
- Both outputs must integrate into existing `runPipeline()` flow in `src/pipeline/run.ts`
- Add `globalScore` field to `DailySnapshot` type in `src/pipeline/types.ts`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pipeline/run.ts` — main pipeline entry point (fetch → score → snapshot)
- `src/pipeline/scoring/snapshot.ts` — writes daily snapshots to `data/scores/`
- `src/pipeline/types.ts` — `DailySnapshot`, `ScoredCountry`, `PillarScore` types
- `src/lib/scores.ts` — `loadLatestScores()`, `loadHistoricalScores()`, `HistoryPoint` type
- `data/scores/latest.json` + `data/scores/YYYY-MM-DD.json` — existing snapshot format

### Established Patterns
- Pipeline runs as `tsx src/pipeline/run.ts [date]` with exit codes 0/1/2
- Snapshots written to `data/scores/` with `latest.json` symlink
- `loadHistoricalScores(days)` reads individual daily files — this is what history-index.json replaces
- All pipeline code is TypeScript with ESM imports

### Integration Points
- `writeSnapshot()` in `src/pipeline/scoring/snapshot.ts` — add global score computation after scoring
- `DailySnapshot` type — add `globalScore: number` field
- New `writeHistoryIndex()` function — consolidate daily snapshots after writing current snapshot
- GitHub Actions workflow — no changes needed (pipeline already auto-commits data files)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
