---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Data Sources & Scoring Overhaul
status: Ready to plan
stopped_at: Completed 25-02 (WHO DONs Pipeline Integration)
last_updated: "2026-03-23T01:07:45.005Z"
last_activity: 2026-03-23
progress:
  total_phases: 11
  completed_phases: 6
  total_plans: 12
  completed_plans: 16
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Any traveler can instantly see how safe a destination is, backed by transparent, automatically-updated data from trusted public sources.
**Current focus:** Phase 25 — WHO DONs Fetcher

## Current Position

Phase: 26
Plan: Not started

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
- [Phase 21]: Named tiered config source-tiers.json to avoid overwriting existing sources.json catalog
- [Phase 21]: Tiered scoring loads source-tiers.json (not sources.json) to avoid overwriting source catalog
- [Phase 21]: sourcesConfig optional 7th param on computeCountryScore for backward compatibility
- [Phase 21]: Minimal run.ts change -- engine handles tiered scoring internally, pipeline just logs summary
- [Phase 22]: Re-score all historical snapshots from raw data using weights v4.0.0 without re-fetching
- [Phase 23]: ReliefWeb v2 API requires POST with JSON body for filtering (GET returns 400)
- [Phase 23]: Engine uses simple averaging in pillars (no indicatorWeights), new disaster indicators get equal weight
- [Phase 24]: Used GDELT DOC v2 API (timelinetone mode) instead of deprecated v1 Stability Timeline endpoint
- [Phase 24]: Tone-to-instability linear mapping: instability = clamp((0-tone)/10+0.5, 0, 1)
- [Phase 24]: indicatorWeights distribute 85% across 6 existing indicators with baseline sources getting slightly more than signal sources
- [Phase 25]: Country extraction from DON titles uses dash-split then in-split fallback
- [Phase 25]: Health pillar indicatorWeights: baseline 30/25/25%, signal (WHO DONs) 20%
- [Phase 25]: who_active_outbreaks normalization range 0-5 (inverse)

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
| Phase 21 P01 | 4min | 2 tasks | 4 files |
| Phase 21 P02 | 4min | 2 tasks | 5 files |
| Phase 21 P03 | 2min | 2 tasks | 2 files |
| Phase 22 P01 | 2min | 2 tasks | 570 files |
| Phase 23 P01 | 3min | 2 tasks | 2 files |
| Phase 23 P02 | 2min | 2 tasks | 5 files |
| Phase 24 P01 | 10m | 1 tasks | 2 files |
| Phase 24 P02 | 2min | 2 tasks | 3 files |
| Phase 25 P01 | 193s | 1 tasks | 1 files |
| Phase 25 P02 | 193s | 2 tasks | 3 files |

## Session Continuity

Last activity: 2026-03-23
Last session: 2026-03-23T01:06:59.635Z
Stopped at: Completed 25-02 (WHO DONs Pipeline Integration)
Resume file: None
