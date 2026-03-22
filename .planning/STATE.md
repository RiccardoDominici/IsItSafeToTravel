---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Data Sources & Scoring Overhaul
status: ready_to_plan
stopped_at: Roadmap created, ready to plan Phase 21
last_updated: "2026-03-23"
last_activity: 2026-03-23
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Any traveler can instantly see how safe a destination is, backed by transparent, automatically-updated data from trusted public sources.
**Current focus:** Phase 21 — Scoring Formula Redesign

## Current Position

Phase: 21 of 26 (Scoring Formula Redesign)
Plan: 0 of 0 in current phase
Status: Ready to plan
Last activity: 2026-03-23 — v3.0 roadmap created (Phases 21-26)

Progress: [####################..........] 67% (20/26 phases complete across all milestones)

## Performance Metrics

**Velocity (from v1.0 + v1.1 + v1.2 + v2.0):**

- Total plans completed: 27
- Average attempts per plan: ~2.2

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v3.0 research]: Baseline+signal tiered architecture — annual indices at 70%, realtime signals capped at 30%
- [v3.0 research]: GDELT for within-country spike detection only (not cross-country) to contain media bias
- [v3.0 research]: Fetcher order by API confidence: ReliefWeb+GDACS, then GDELT, then WHO DONs
- [v3.0 research]: Historical backfill mandatory before new sources go live to prevent "v3 cliff"

### Pending Todos

None yet.

### Blockers/Concerns

- [Carry-over] Inline data embedding for comparison page needs monitoring (~1MB threshold at ~6 months of daily data)
- [v3.0] GDELT rate limits undocumented — Phase 24 may need scope reduction if timing exceeds CI budget
- [v3.0] WHO DONs country filtering poorly documented — Phase 25 may need title-parsing fallback
- [v3.0] Decay parameter calibration requires 2-4 weeks of parallel formula runs

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260320-ip2 | Fix 5 UI issues: language selector dropdown, health chart, back button, category summary, comparison search | 2026-03-20 | 6a94a4d | [260320-ip2-fix-5-ui-issues-language-selector-dropdo](./quick/260320-ip2-fix-5-ui-issues-language-selector-dropdo/) |

## Session Continuity

Last activity: 2026-03-23
Last session: 2026-03-23
Stopped at: v3.0 roadmap created, ready to plan Phase 21
Resume file: None
