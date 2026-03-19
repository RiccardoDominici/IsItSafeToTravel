# Research Summary: v1.1 Comparison & Historical Trends

**Domain:** Travel safety platform -- comparison pages, historical trend charts, global safety score
**Researched:** 2026-03-19
**Overall confidence:** HIGH

## Executive Summary

The v1.1 features (comparison page, historical trend charts, global safety score) integrate cleanly into the existing Astro SSG + D3 + daily pipeline architecture. No new dependencies are needed. Every feature builds on existing patterns and technologies: D3 v7 for charts, Fuse.js for search/selection, JSON file storage for historical data, and Astro's build-time rendering for static content.

The key architectural insight is that only the comparison page requires meaningful client-side JavaScript. The global safety score is a pure pipeline computation displayed as static HTML. The enhanced history chart extends the existing build-time D3 SVG pattern (TrendSparkline.astro) to a full-size chart with axes. The comparison page, however, introduces a new pattern: embedded JSON data + client-side D3 rendering, because users pick countries interactively and pre-generating all country combinations (19,900+ pairs) is not feasible.

The pipeline needs two additions: a global score computation step (simple arithmetic mean of all country scores) and a history consolidation step that compiles daily snapshot files into a single `history-index.json`. This consolidation prevents build time from scaling linearly with accumulated days -- instead of reading 365 individual snapshot files, the build reads one consolidated file.

The biggest risk is not technical but temporal: historical trend charts need accumulated data to be meaningful. The pipeline should start writing the consolidated history index immediately so data accumulates while UI work proceeds. All other risks are minor: the comparison page's inline data embedding will need to switch to a fetch-based approach once history data exceeds ~1MB (around 6 months of daily data for 200 countries), but this is a straightforward migration.

## Key Findings

**Stack:** No new dependencies. D3 v7, Fuse.js, Astro 6 -- everything needed is already installed.
**Architecture:** Three integration points: pipeline extension (global score + history index), build-time components (GlobalScoreBanner, HistoryChart), client-side rendering (comparison page with embedded data + D3).
**Critical pitfall:** Inline data embedding for the comparison page has a ~6-month scalability ceiling before needing to switch to fetch-based loading.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Pipeline Extensions** - Foundation for all UI features
   - Addresses: Global score computation, history data consolidation
   - Avoids: Building UI before data exists; build-time scaling issues with raw snapshot files
   - Dependencies: None (modifies existing pipeline)

2. **Global Safety Score UI** - Simplest new feature, validates pipeline->UI flow
   - Addresses: Global safety score display on homepage
   - Avoids: Over-engineering; this is a single build-time component
   - Dependencies: Pipeline extension (global score field)

3. **Enhanced History Chart** - Extends proven build-time D3 pattern
   - Addresses: Full-size trend chart per country, replacing/augmenting TrendSparkline
   - Avoids: Premature client-side interactivity; stays fully SSG
   - Dependencies: Pipeline extension (history index)

4. **Comparison Page** - Most complex, introduces new client-side pattern
   - Addresses: Country comparison, multi-country overlay chart
   - Avoids: SSR complexity; pre-generating all combinations
   - Dependencies: History index data, chart utilities from Phase 3

**Phase ordering rationale:**
- Pipeline first because all UI features depend on global score and history index data
- Global score second because it is the simplest feature and validates the pipeline->build->display flow end-to-end
- History chart third because it uses the proven build-time D3 pattern (zero new architectural concepts)
- Comparison page last because it is the only feature requiring a new architectural pattern (client-side D3 from embedded data) and benefits from chart utilities built in Phase 3

**Research flags for phases:**
- Phase 1 (Pipeline): Standard -- arithmetic mean, file I/O. No research needed.
- Phase 2 (Global Score UI): Standard -- build-time Astro component. No research needed.
- Phase 3 (History Chart): Standard -- extends TrendSparkline pattern. No research needed.
- Phase 4 (Comparison): Minor flag -- inline data embedding scalability needs monitoring at 6 months. Fuse.js client-side integration needs a lightweight implementation pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all tech is already installed and proven in codebase |
| Features | HIGH | Clear scope from PROJECT.md; feature set is well-defined |
| Architecture | HIGH | Integration points identified from direct code inspection; patterns proven in existing codebase |
| Pitfalls | MEDIUM | Scalability ceiling is estimated (~6 months); actual threshold depends on data growth rate |

## Gaps to Address

- **History data volume estimation needs validation:** The 1.8MB estimate for 365 days of history assumes 200 countries. If more territories are added, this grows. Monitor actual size.
- **Comparison page SEO:** A single comparison page with query params has limited SEO value for "Italy vs France safety" queries. If SEO for comparison queries becomes important, consider generating static pages for the top 50-100 most-searched country pairs.
- **Global score weighting:** Simple arithmetic mean vs population-weighted average is a product decision, not a technical one. The architecture supports either. Recommend starting with simple mean for transparency.

## Files Created/Updated

| File | Purpose |
|------|---------|
| .planning/research/SUMMARY.md | This file -- executive summary with roadmap implications |
| .planning/research/STACK.md | Technology recommendations (no changes -- already v1.1 scoped) |
| .planning/research/FEATURES.md | Feature landscape for v1.1 (retained from v1.0, still relevant) |
| .planning/research/ARCHITECTURE.md | Integration architecture for new features |
| .planning/research/PITFALLS.md | Domain pitfalls (retained from v1.0, still relevant) |

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
