---
phase: 36-documentation
plan: 01
subsystem: i18n, frontend, methodology
tags: [i18n, advisory-sources, documentation, methodology, ui-components]
dependency_graph:
  requires: []
  provides: [i18n-advisory-keys, advisory-section-dynamic, methodology-advisory-table]
  affects: [country-detail-pages, methodology-pages, sources-page]
tech_stack:
  added: []
  patterns: [dynamic-advisory-iteration, expand-collapse-pattern]
key_files:
  created: []
  modified:
    - src/i18n/ui.ts
    - src/components/country/AdvisorySection.astro
    - src/components/country/AdvisoryCard.astro
    - src/pages/en/methodology/index.astro
    - src/pages/it/metodologia/index.astro
    - src/pages/es/metodologia/index.astro
    - src/pages/fr/methodologie/index.astro
    - src/pages/pt/metodologia/index.astro
decisions:
  - Used dynamic ADVISORY_KEYS array instead of hardcoded boolean checks for scalability
  - Added dedicated advisory sources table to methodology page instead of bloating main data sources table
  - Five Eyes advisories shown by default, rest behind expand/collapse toggle
metrics:
  duration: 1050s
  completed: "2026-03-27"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 8
---

# Phase 36 Plan 01: Methodology & Advisory Documentation Summary

490+ new i18n keys across 5 languages for 37 government advisory sources, with dynamic advisory components and methodology page advisory source tables.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Add i18n keys and update methodology text for all 37 advisory sources | 90c2185 | 490 new i18n keys: 33 country.advisory.*, 33 methodology.indicator.advisory_level_*, sources.* page keys, show_more/show_less, updated overview/tiered/conflict text in all 5 languages |
| 2 | Refactor advisory components and update methodology pages | d633d3b | AdvisoryCard accepts string sourceKey, AdvisorySection uses ADVISORY_KEYS array with expand/collapse, all 5 methodology pages have 37-row advisory sources table |

## Key Changes

### i18n Updates (src/i18n/ui.ts)
- Added 33 `country.advisory.*` display name keys per language (165 total new keys)
- Added 33 `methodology.indicator.advisory_level_*` keys per language (165 total)
- Updated `methodology.overview_text` from "7 sources" to "40+ sources" in all 5 languages
- Updated `methodology.tiered_text` to mention "37 government travel advisories from countries spanning all continents"
- Updated `methodology.pillar.conflict.sources` and `.description` to reference 37 advisory sources
- Added `country.advisory.show_more` / `show_less` keys for expandable section
- Added `sources.*` page keys (title, description, heading, intro, table headers, tier labels)
- Added `nav.sources` and route slugs (`sources`, `fonti`, `fuentes`, `sources`, `fontes`)

### Advisory Components
- **AdvisoryCard.astro**: `sourceKey` prop type changed from `'us' | 'uk' | 'ca' | 'au'` to `string`; simplified color logic (UK text-based, all others numeric 1-4)
- **AdvisorySection.astro**: Replaced hardcoded `hasUs/hasUk/hasCa/hasAu` checks with dynamic `ADVISORY_KEYS` array of all 37 sources; Five Eyes shown by default, additional advisories behind expand/collapse button

### Methodology Pages (all 5 languages)
- Added `advisorySources` array with 37 entries (key, tier, weight)
- Added "Government Travel Advisories" section with responsive table showing source name, tier, and weight
- Table renders between existing Data Sources table and Scoring Formula section

## Decisions Made

1. **Dynamic ADVISORY_KEYS array over hardcoded checks** -- 37-element const array makes adding future sources trivial (just add to array and i18n keys)
2. **Separate advisory sources table on methodology page** -- Avoids bloating the main 9-row data sources table with 37 additional rows; cleaner UX with dedicated section
3. **Five Eyes shown by default** -- Primary US/UK/CA/AU advisories always visible; additional 33 sources behind toggle to avoid overwhelming users

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all data sources are wired to existing i18n keys and will display correctly when advisory data is available.

## Verification

- `npx astro build` completed successfully (1277 pages, 264s)
- `grep -c "country.advisory.de" src/i18n/ui.ts` returns 5
- `grep -c "ADVISORY_KEYS" src/components/country/AdvisorySection.astro` returns 2
- `grep "sourceKey.*string" src/components/country/AdvisoryCard.astro` matches
- All 5 methodology pages contain advisorySources array with 37 entries

## Self-Check: PASSED
