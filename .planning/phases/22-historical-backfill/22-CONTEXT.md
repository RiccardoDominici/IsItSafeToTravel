# Phase 22: Historical Backfill - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Recalculate all historical scores from 2012 onward using the new tiered formula from Phase 21 so trend charts show smooth continuity. The data/raw/{YYYY-MM-DD}/ directories contain parsed data back to 2012 — a backfill script will read each snapshot, run computeAllScores with the v5.0.0 weights and source-tiers.json, and write corrected score files. The history-index.json must be rebuilt with consistent per-pillar breakdowns across all dates.

Note: backfill applies to formula changes only — new sources (GDELT, ReliefWeb) cannot be backfilled as their historical data does not exist in the archives. Historical data will show baseline-only scores (which is correct since no signal sources existed then).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Key constraints:
- Must use the new computeAllScores from Phase 21 engine.ts
- Must process all data/raw/{date}/ directories
- Must rebuild data/scores/{date}.json for each snapshot
- Must rebuild history-index.json with consistent pillar breakdowns
- Historical scores will be baseline-only (correct — no signal data existed historically)
- The build-history.ts script already exists and consolidates snapshots — may need modification to use new engine

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pipeline/scoring/engine.ts` — new tiered engine from Phase 21
- `src/pipeline/config/weights.json` — v5.0.0 with per-indicator sub-weights
- `src/pipeline/config/source-tiers.json` — tier config
- `src/pipeline/history.ts` — builds history-index.json from score snapshots
- `data/raw/` — parsed data directories from 2012 to present
- `data/scores/` — score snapshots by date

### Established Patterns
- Score snapshots: `data/scores/{YYYY-MM-DD}.json`
- History index: `data/scores/history-index.json`
- Raw data: `data/raw/{YYYY-MM-DD}/{source}-parsed.json`

### Integration Points
- `src/pipeline/run.ts` — pipeline orchestrator, calls computeAllScores and history builder
- `src/pipeline/history.ts` — consolidates daily snapshots into history-index.json

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
