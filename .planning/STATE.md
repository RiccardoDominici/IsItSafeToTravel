---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Global Advisory Sources Expansion
status: executing
stopped_at: Completed Phase 38 (autonomous)
last_updated: "2026-05-06T20:00:00.000Z"
last_activity: "2026-05-06 - Completed Phase 38: i18n zh+de + Travelpayouts affiliate (autonomous run)"
progress:
  total_phases: 23
  completed_phases: 20
  total_plans: 44
  completed_plans: 48
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** Any traveler can instantly see how safe a destination is, backed by transparent, automatically-updated data from trusted public sources.
**Current focus:** Phase 38 complete — i18n zh+de + Travelpayouts affiliate

## Current Position

Phase: 38
Plan: All plans complete (38-01, 38-02, 38-03)
Status: Phase 38 complete and deployed
Last activity: 2026-05-06 - Phase 38 autonomous execution: 7 languages live (added zh, de), Ko-fi replaced with Travelpayouts CTA, 5 critical + 3 high review fixes applied, all pushed to origin/master

Progress: [██████████] 100%

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
- [Phase ?]: Plan 38-02: introduced getLocalizedCountryName helper with en fallback for snapshot data lacking new locales
- [Phase ?]: Plan 38-02: publishedLanguages flipped to 7 entries enabling hreflang for /zh/ and /de/ sitewide
- [Phase ?]: Plan 38-02: bulk-migrated 80+ files from country.name[lang] to getLocalizedCountryName helper

### Roadmap Evolution

- Phase 38 added: i18n zh+de support and Travelpayouts affiliate replacing Ko-fi (2026-05-03)

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
| 260330-h6z | Perplexity AI optimization: visible FAQ, answer-first paragraphs, timestamps, comparison tables, question H2s, Dataset schema | 2026-03-30 | da7c4aa | [260330-h6z-perplexity-ai-optimization-visible-faq-a](./quick/260330-h6z-perplexity-ai-optimization-visible-faq-a/) |
| 260403-o7a | SEO improvements: title freshness, neighbor comparison, 65 hub pages, embeddable badge | 2026-04-03 | 1b5fa07 | [260403-o7a-seo-improvements-title-freshness-neighbo](./quick/260403-o7a-seo-improvements-title-freshness-neighbo/) |
| 260415-qon | Fix INFORM governance mapping, WB partial fallback, regenerate scores | 2026-04-15 | b2ef9ad, 3bce773 | [260415-qon-fix-inform-governance-column-mapping-fix](./quick/260415-qon-fix-inform-governance-column-mapping-fix/) |
| Phase 38 P02 | 1850 | 3 tasks | 130 files |
| 260511-gpu | Pillar coverage threshold gating + UI note (exclude <30%, asterisk <50%) | 2026-05-11 | 1298654, c24fe07 | [260511-gpu-pillar-coverage-threshold-gating-ui-note](./quick/260511-gpu-pillar-coverage-threshold-gating-ui-note/) |
| 260511-k2m | Replace retired WB WGI with V-Dem Institute v16 (rule_of_law, gov_effectiveness, corruption_control), drop wb_political_stability, redistribute conflict weights, rename wb_* → vdem_*, backfill 611 historical snapshots, UI updates 7 locales with CC-BY-SA attribution. Verified 16/16 must_haves. | 2026-05-11 | 950910c, 7b4bc17, 82bdd88, b074a14 | [260511-k2m-replace-retired-wb-wgi-with-v-dem-instit](./quick/260511-k2m-replace-retired-wb-wgi-with-v-dem-instit/) |
| 260515-k5y | Guard kofiWidgetOverlay against blocked/failed CDN load (defensive typeof guard + load/error listeners on overlay-widget.js script tag in Base.astro) — complete | 2026-05-15 | 3d0f47a | [260515-k5y-fix-kofiwidgetoverlay-javascript-error-o](./quick/260515-k5y-fix-kofiwidgetoverlay-javascript-error-o/) |
| 260603-csf | Fix Dataset JSON-LD description field length (GSC alert WNC-10030322) — zh template was 30 chars (under Google's 50-char floor for short country names like 日本); extended to 53+ chars; added validate-seo guard (2199→2213 checks). | 2026-06-03 | TBD | [260603-csf-fix-dataset-json-ld-description-field-le](./quick/260603-csf-fix-dataset-json-ld-description-field-le/) |

## Session Continuity

Last activity: 2026-06-03 - Completed quick task 260603-csf: Dataset.description length fix + validate-seo guard
Last session: 2026-06-03T07:25:00Z
Stopped at: Completed quick task 260603-csf
Resume file: None
