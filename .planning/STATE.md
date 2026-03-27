---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Global Advisory Sources Expansion
status: executing
stopped_at: Completed 34-01-PLAN.md
last_updated: "2026-03-27T09:29:21.422Z"
last_activity: 2026-03-27
progress:
  total_phases: 22
  completed_phases: 14
  total_plans: 30
  completed_plans: 34
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** Any traveler can instantly see how safe a destination is, backed by transparent, automatically-updated data from trusted public sources.
**Current focus:** Phase 34 — scoring-integration

## Current Position

Phase: 34
Plan: 1 of 2
Status: Executing Phase 34
Last activity: 2026-03-27

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (from v1.0 through v3.0):**

- Total plans completed: 27
- Average attempts per plan: ~2.2

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v3.0]: Baseline+signal tiered architecture — annual indices at 70%, realtime signals capped at 30%
- [v3.0]: Advisory sources are signal tier with 7-day half-life, 30-day max age
- [v3.0]: Advisory sub-weights in Conflict pillar: US 9%, UK 8%, CA 7%, AU 6%
- [v4.0]: New advisory sources must normalize to unified 1-4 level scale
- [v4.0]: Integration order: cleanup first, then API, HTML, complex, scoring, CI, docs, calibration
- [Phase 28]: Redistributed GDELT/WHO DONs weights proportionally among remaining indicators in v7.0.0
- [Phase 28]: Updated source count from 9 to 7 in all user-facing content after GDELT/WHO DONs removal
- [Phase 29]: UnifiedLevel 1-4 scale as standard for all advisory normalization
- [Phase 29]: Extended AdvisoryInfoMap type with de/nl/jp/sk keys for tier-1 sources
- [Phase 29]: Used static MOFA page ID to ISO3 mapping (120+ entries) for Japan advisory fetcher
- [Phase 30]: Extended dataDate extraction to work from any advisory source (base/tier1/tier2a)
- [Phase 30]: Used cheerio HTML/XML parsing for all Tier 2a sources; Austria BMEIA JS object is most reliable source
- [Phase 31]: Extended advisory level aggregation and info loading for tier2b sources in engine.ts
- [Phase 31]: Followed tier2a pattern exactly for tier2b fetcher module structure
- [Phase 32]: Chinese normalization matches characters directly without toLowerCase; Korean maps 1:1 to unified scale
- [Phase 32]: Used HTML scraping for South Korea instead of API (avoids API key registration)
- [Phase 32]: Created local Korean/Chinese country name mapping tables in fetcher file (not in shared countries.ts)
- [Phase 34]: Advisory sub-weights use diminishing tiers: original (0.025-0.026) > tier1 (0.018) > tier2a (0.010) > tier2b (0.007) > tier3a (0.005) > tier3b (0.003)
- [Phase 34]: Total advisory weight 0.36 in conflict pillar, baseline 0.64 unchanged from v7.0.0

### Pending Todos

None yet.

### Blockers/Concerns

- [Carry-over] Inline data embedding for comparison page needs monitoring (~1MB threshold at ~6 months of daily data)
- [v4.0] Rate limiting across 30+ advisory sources in CI — need staggered fetching
- [v4.0] Text-based advisories (Italy, Spain, China) may need LLM/NLP for level extraction
- [v4.0] Diverse level systems (3/4/5/6-level, color-coded) need normalization mapping

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260320-ip2 | Fix 5 UI issues: language selector dropdown, health chart, back button, category summary, comparison search | 2026-03-20 | 6a94a4d | [260320-ip2-fix-5-ui-issues-language-selector-dropdo](./quick/260320-ip2-fix-5-ui-issues-language-selector-dropdo/) |
| 260323-mcr | Add CA/AU government advisories, populate AdvisoryInfo, 4-card frontend | 2026-03-23 | 8d37e41, d2a026b | [260323-mcr-add-government-advisories-section-with-c](./quick/260323-mcr-add-government-advisories-section-with-c/) |
| Phase 28 P01 | 5min | 2 tasks | 11 files |
| Phase 28 P02 | 15min | 2 tasks | 12 files |
| Phase 29-01 P01 | 2min | 2 tasks | 6 files |
| Phase 29 P02 | 245s | 2 tasks | 3 files |
| Phase 30 P01 | 156s | 2 tasks | 5 files |
| Phase 30 P02 | 211s | 2 tasks | 3 files |
| Phase 31 P01 | 121s | 2 tasks | 5 files |
| Phase 31 P02 | 237s | 2 tasks | 2 files |
| Phase 32 P01 | 82s | 2 tasks | 4 files |
| Phase 32 P02 | 354s | 2 tasks | 3 files |
| Phase 34 P01 | 122s | 2 tasks | 3 files |

## Session Continuity

Last activity: 2026-03-26
Last session: 2026-03-26T20:45:15.151Z
Stopped at: Completed 34-01-PLAN.md
Resume file: None
