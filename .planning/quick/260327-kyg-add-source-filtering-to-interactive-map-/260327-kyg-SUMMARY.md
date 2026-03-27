---
phase: quick
plan: 260327-kyg
subsystem: frontend/filters
tags: [source-filter, advisory, map, trend-chart, i18n]
dependency_graph:
  requires: [scores.json advisory data, i18n ui.ts]
  provides: [source-filter-map, source-filter-chart]
  affects: [SafetyMap.astro, TrendChart.astro, AdvisorySection.astro, country pages]
tech_stack:
  added: []
  patterns: [dynamic-checkbox-filter, data-attribute-driven-visibility]
key_files:
  created: []
  modified:
    - src/i18n/ui.ts
    - src/components/SafetyMap.astro
    - src/components/country/TrendChart.astro
    - src/components/country/AdvisorySection.astro
    - src/pages/en/country/[slug].astro
    - src/pages/it/paese/[slug].astro
    - src/pages/es/pais/[slug].astro
    - src/pages/fr/pays/[slug].astro
    - src/pages/pt/pais/[slug].astro
decisions:
  - View filter only (no score recomputation) -- sources filter controls tooltip display and card visibility
  - Dynamic checkbox generation from scores.json data rather than static HTML
  - Used data-advisory-source attribute on card wrappers for CSS-class-based visibility toggle
metrics:
  duration: 664s
  completed: 2026-03-27
---

# Quick Task 260327-kyg: Add Source Filtering to Interactive Map Summary

Advisory source checkboxes in both SafetyMap and TrendChart filter dropdowns, sorted by coverage count, with All toggle, filtered tooltip advisory lines, and AdvisoryCard visibility control across all 5 languages.

## Completed Tasks

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Add i18n keys and source filter UI + logic to SafetyMap | 3da1ccb | filter.sources/filter.all_sources i18n keys in 5 languages; dynamic source checkboxes from scores.json; advisory info in tooltip filtered by enabled sources |
| 2 | Add source filter to TrendChart with AdvisoryCard visibility control | 82af3a3 | data-advisory-source on card wrappers; source filter in TrendChart dropdown; advisorySources prop from all 5 country pages; card show/hide on filter change |

## What Was Built

### SafetyMap Source Filter
- Source filter section added below pillar pills in the map filter dropdown, separated by a visual divider
- Sources are counted across all countries from scores.json advisory data and sorted by coverage count descending
- Each checkbox shows the translated source name and country count in parentheses
- "All sources" master toggle at top with checked/indeterminate/unchecked states
- Checkbox clicks do not close the dropdown (stopPropagation on the filter list container)
- Map tooltip now shows advisory info (source name + level) for up to 4 enabled sources, with "+N more" overflow
- Tooltip upgraded from textContent to innerHTML with styled dividers between score and advisory lines

### TrendChart Source Filter
- Source filter section added to TrendChart filter dropdown (only shown when country has advisory data)
- Advisory sources passed as prop from country page templates (all 5 languages)
- Checkboxes toggle visibility of AdvisoryCard elements on the same page via data-advisory-source attribute
- Same All toggle and stopPropagation behavior as map filter
- Dropdown min-width increased from 160px to 200px to accommodate source labels

### AdvisorySection Enhancement
- Each AdvisoryCard wrapped in a div with data-advisory-source={key} attribute for both primary and additional advisory groups
- Enables the TrendChart source filter to target and hide/show individual cards

### i18n
- Added filter.sources and filter.all_sources keys in all 5 languages (en, it, es, fr, pt)
- Source names come from existing country.advisory.XX translation keys

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all data sources are wired to live scores.json advisory data.

## Self-Check: PASSED
