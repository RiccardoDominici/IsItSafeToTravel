---
phase: 26-validation-documentation-and-ux
plan: "02"
subsystem: documentation
tags: [methodology, i18n, readme, documentation, v3.0]
dependency_graph:
  requires: [weights.json, source-tiers.json]
  provides: [updated-methodology-pages, updated-readme]
  affects: [methodology-pages, translations, readme]
tech_stack:
  added: []
  patterns: [tiered-formula-docs, freshness-decay-docs]
key_files:
  created: []
  modified:
    - src/i18n/ui.ts
    - src/pages/en/methodology/index.astro
    - src/pages/it/metodologia/index.astro
    - src/pages/es/metodologia/index.astro
    - src/pages/fr/methodologie/index.astro
    - src/pages/pt/metodologia/index.astro
    - README.md
decisions:
  - Updated GPI section from "pending" to "integrated" since GPI fetcher now active
  - Added GPI to data sources table (was missing despite being a configured source)
metrics:
  duration: 715s
  completed: "2026-03-23"
---

# Phase 26 Plan 02: Methodology & README Documentation Summary

Updated methodology pages in all 5 languages to document the v3.0 baseline+signal tiered scoring formula, all 9 data sources, freshness decay, and updated pillar weights; updated README with complete v3.0 data architecture and "Adding a New Source" guide.

## Task Results

### Task 1: Update methodology page content and translations in all 5 languages
- **Commit:** e1e938a
- **Files:** src/i18n/ui.ts, 5 methodology page templates
- **What changed:**
  - Added ~30 new translation keys per language (150 total) for 4 new sources, tiered architecture, decay, new indicators, and daily frequency
  - Updated pillar weights from old values to v5.3.0: Conflict 30%, Crime 25%, Health 20%, Governance 15%, Environment 10%
  - Updated pillar descriptions: Conflict now mentions GDELT instability, Health mentions WHO DONs, Environment mentions ReliefWeb/GDACS
  - Data sources table expanded from 5 to 10 sources (added GPI, ReliefWeb, GDACS, GDELT, WHO DONs)
  - Added "Baseline + Signal Architecture" and "Data Freshness Decay" sections between formula and weights table
  - Updated formula display to show tiered formula: `Score = (Baseline x 0.70 + Signal x 0.30) where each = ...`
  - Updated GPI section from "Pending" to "Integrated" status

### Task 2: Update README and pipeline documentation
- **Commit:** e9f50c0
- **Files:** README.md
- **What changed:**
  - Data Sources table expanded from 6 to 10 rows with Tier and Update Frequency columns
  - Scoring Methodology rewritten with current v5.3.0 weights
  - Added "Baseline + Signal Tiering" subsection explaining the dual-tier architecture
  - Added "Freshness Decay" subsection with half-life and max-age table per source
  - Added "Per-Indicator Sub-Weights" subsection referencing indicatorWeights in weights.json
  - Added "Adding a New Data Source" section with 7-step guide
  - Updated multilingual from "English and Italian" to all 5 languages
  - Updated Features list with tiered scoring, category filtering, drag-to-zoom
  - Updated Project Structure to show 9 fetchers and tiered scoring engine

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] GPI missing from data sources table**
- **Found during:** Task 1
- **Issue:** GPI was configured and active in weights.json but was not listed in the methodology page's dataSources array
- **Fix:** Added GPI as a data source entry with annual frequency in all 5 methodology pages
- **Files modified:** All 5 methodology pages, ui.ts (GPI source keys already existed)

## Known Stubs

None - all content is fully wired with real data from weights.json and source-tiers.json.

## Self-Check: PASSED
