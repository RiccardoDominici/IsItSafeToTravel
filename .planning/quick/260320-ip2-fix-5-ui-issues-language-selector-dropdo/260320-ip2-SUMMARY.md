---
phase: quick
plan: 260320-ip2
subsystem: ui
tags: [language-switcher, global-chart, navigation, comparison, mobile]
dependency-graph:
  requires: []
  provides: [compact-language-dropdown, interactive-global-chart, mobile-search-input]
  affects: [LanguageSwitcher, global-safety-pages, country-pages, compare-pages]
tech-stack:
  added: []
  patterns: [details-summary-dropdown, data-attribute-chart-points, touch-action-manipulation]
key-files:
  created: []
  modified:
    - src/components/LanguageSwitcher.astro
    - src/pages/en/global-safety.astro
    - src/pages/it/sicurezza-globale.astro
    - src/pages/es/seguridad-global.astro
    - src/pages/en/country/[slug].astro
    - src/pages/it/paese/[slug].astro
    - src/pages/es/pais/[slug].astro
    - src/pages/en/compare.astro
    - src/pages/it/confronta.astro
    - src/pages/es/comparar.astro
decisions:
  - Used details/summary for language dropdown (zero JS, matches existing mobile nav pattern)
  - Used data-points attribute to pass chart coordinates to client script for tooltip
  - Used touch-action manipulation and inputMode search for mobile input compatibility
metrics:
  duration: ~8min
  completed: "2026-03-20T12:39:00Z"
---

# Quick Task 260320-ip2: Fix 5 UI Issues Summary

Compact language dropdown with details/summary pattern, 90-day filtered global chart with hover/touch tooltip, removed back-to-map nav and CountrySummary from country pages, mobile-friendly comparison search input.

## Completed Tasks

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Language dropdown + remove back nav + remove CountrySummary | e33cee1 | Rewrote LanguageSwitcher to details/summary dropdown, removed nav from 6 pages, removed CountrySummary from 3 country pages |
| 2 | Global safety chart + comparison search input | 05be4f5 | Filtered chart to 90 days, added tooltip interactivity, added mobile-friendly search input attributes |
| 3 | Checkpoint (auto-approved) | - | Visual verification auto-approved |

## Changes Made

### Issue 1: Compact Language Selector
- Rewrote `LanguageSwitcher.astro` from inline tabs to a `details/summary` dropdown
- Shows only active language code (e.g. "EN") with chevron icon
- Expands on click to show all 3 language options
- Active language highlighted in terracotta, others in sand with hover states
- Zero JavaScript, matches existing mobile nav pattern

### Issue 2: Global Safety Chart (90 days + tooltip)
- Filtered `globalHistory` to last 90 days via `recentHistory` for readable chart
- Added `data-points` attribute on chart wrapper with pre-computed `{date, score, x, y}` coordinates
- Added client-side `<script>` with mousemove/mouseleave/touchstart tooltip handlers
- Locale-aware date formatting using `data-lang` attribute
- All 3 language variants updated consistently

### Issue 3: Remove Back-to-Map Navigation
- Removed `<nav class="text-sm">` block from all 3 country page variants
- Removed `<nav class="text-sm">` block from all 3 global safety page variants
- Header already provides Home navigation

### Issue 4: Remove CountrySummary
- Removed `import CountrySummary` and `<CountrySummary>` usage from all 3 country page variants
- Component file `CountrySummary.astro` preserved for potential future use

### Issue 5: Comparison Search Input (mobile fix)
- Added `inputMode='search'`, `autocomplete='off'`, `autocapitalize='off'`
- Added `enterkeyhint='search'` for mobile keyboard hint
- Added `touchAction='manipulation'` to prevent touch event blocking
- Added click-to-focus fallback for browsers where tap-to-focus doesn't work
- Added desktop auto-focus (skipped on touch devices to avoid unwanted keyboard popup)

## Deviations from Plan

None - plan executed exactly as written.

## Known Issues

- Pre-existing: `src/components/Search.astro` has a TypeScript error (`'limit' does not exist in type 'IFuseOptions<SearchItem>'`). Not related to this task.

## Verification

- `npx astro check`: passes (1 pre-existing error in Search.astro, unrelated)
- `npx astro build`: completes successfully (760 pages, 170s)
- All 3 language variants are consistent

## Self-Check: PASSED

All 10 modified files exist. Both task commits (e33cee1, 05be4f5) verified in git log.
