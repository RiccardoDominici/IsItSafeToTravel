# Phase 10: Country Comparison - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Comparison page where users select 2-5 countries and see side-by-side score cards, grouped horizontal bar charts for pillars, and an overlay trend chart. Fully client-side rendered (Astro `<script>` + D3). Shareable via URL query params.

</domain>

<decisions>
## Implementation Decisions

### Page Layout
- URL: `/{lang}/compare` with query params `?c=ITA,FRA,DEU` (ISO3 codes)
- Linear flow: country selector → score cards row → pillar bars → overlay chart
- Max 5 countries (OECD/Google Trends: 5+ creates visual noise)
- Empty state: "Select countries to compare" prompt with 2 suggested popular pairs

### Country Selector
- Searchable dropdown using Fuse.js — type to filter, click to add (reuses existing search pattern)
- All 248 countries with scores embedded as JSON in data-attribute (build-time, ~10KB)
- X button on each selected country chip to remove
- Navigation: "Compare" link in header nav + "Compare with..." button on country detail pages

### Charts & Visualization
- Pillar comparison: grouped horizontal bars (NN/g research: bars beat radar for comparison)
- Overlay trend: multi-line with distinct colors per country + legend — client-side D3
- Color palette: 5 distinct colors (terracotta, teal, amber, indigo, sage) assigned in selection order
- Colorblind accessibility: color + dash pattern for lines (solid, dashed, dotted, dash-dot, long-dash)

### Shareable URLs & SEO
- URL format: `/{lang}/compare?c=ITA,FRA,DEU` using ISO3 codes
- Update URL on every country add/remove via pushState — always shareable
- Basic meta tags for the /compare page, no structured data (dynamic content)

### Claude's Discretion
- Exact chip/card styling and spacing
- Bar chart dimensions and label positioning
- Trend chart dimensions (should be similar to Phase 9 TrendChart)
- Fuse.js threshold and search configuration
- Suggested popular comparison pairs

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/Search.astro` — existing Fuse.js search pattern (adapt for country selector)
- `src/components/country/TrendChart.astro` — Phase 9 D3 trend chart (extend for multi-line overlay)
- `src/components/country/PillarBreakdown.astro` — pillar display (reference for bar chart data)
- `src/components/country/ScoreHero.astro` — score card pattern (adapt for side-by-side cards)
- `src/lib/scores.ts` — `loadLatestScores()`, `loadHistoricalScores()`, `loadGlobalHistory()`
- `src/lib/colors.ts` — `scoreToColor()` utility
- `src/components/Header.astro` — add Compare nav link

### Established Patterns
- Data-attribute pattern: embed JSON as data-* on container, client JS reads it
- Astro `<script>` with Vite processing for client-side interactivity
- D3 sub-package imports (d3-scale, d3-shape) to avoid monolithic bundle
- i18n: `useTranslations(lang)` + route slugs in ui.ts

### Integration Points
- New pages: `src/pages/en/compare.astro`, `src/pages/it/confronta.astro`
- `src/components/Header.astro` — add Compare navigation link
- `src/pages/en/country/[slug].astro` — add "Compare with..." button
- `src/pages/it/paese/[slug].astro` — add "Compare with..." button
- `src/i18n/ui.ts` — add comparison-related translation keys + route slug

</code_context>

<specifics>
## Specific Ideas

- This is the ONLY page requiring full client-side rendering (not SSG content)
- Use Astro `<script>` tags (processed by Vite, tree-shaken) — NO framework islands
- History data for overlay chart: read from data-attribute (build-time embedded from history-index.json)
- Research warns about ~6 month scalability ceiling for inline data — acceptable for now

</specifics>

<deferred>
## Deferred Ideas

- Pre-built SEO comparison pages for top 50-100 country pairs (v2 scope if SEO matters)
- Per-pillar historical trend breakdown in comparison (needs pipeline schema change)

</deferred>
