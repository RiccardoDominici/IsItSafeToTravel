# Phase 14: Category Filtering - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable users to view safety data through individual pillar lenses. Map recolors by selected pillar. Trend charts filter by pillar using per-pillar history data. Pipeline extended to store per-pillar history in history-index.json. Active filter clearly labeled.

</domain>

<decisions>
## Implementation Decisions

### Filter UI Design
- Pill-shaped toggle buttons placed above the map for pillar selection, with pillar color accents
- "Overall" is the default selected filter — shows composite score, individual pillars on click
- Chart filter uses the same pill style but placed above the trend chart independently (not synced with map)
- Active filter label shows weight percentage, e.g., "Conflict (25%)"

### Pipeline & Data Architecture
- Extend history-index.json with `pillarHistory` field per country: `{ conflict: [{date, score}], crime: [...], ... }`
- Retroactively extract per-pillar history from all existing YYYY-MM-DD.json daily snapshots
- Map consumes pillar data from existing scores.json — pillar data already present in `countries[].pillars[]`
- No new files needed — extend existing data structures

### Claude's Discretion
- Exact pill button styling (size, spacing, hover states)
- How to handle countries with missing pillar data when filter is active
- Transition animation when recoloring the map
- Whether to add pillar filter to comparison page charts too

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `public/scores.json` — already contains full `pillars[]` array per country with 0-1 normalized scores
- `src/lib/colors.ts` — `pillarToColor(normalizedScore)` converts 0-1 pillar score to color (already exists!)
- `src/lib/map-utils.ts` — `safetyColorScale(score)` for composite scores, needs pillar variant
- `src/components/SafetyMap.astro` — client-side D3 map, fetches `/scores.json`, currently extracts only composite score
- `src/pipeline/scoring/history.ts` — `writeHistoryIndex()` generates history-index.json, currently only composite scores
- `src/components/country/TrendChart.astro` — client-side D3 chart (Phase 12), receives data via `data-history` attribute

### Established Patterns
- Map fetches scores.json at runtime, builds scoreMap, applies colors via D3 selections
- History data passed as JSON in data-attributes
- Pipeline types: `PillarScore { name, score (0-1), weight, indicators, dataCompleteness }`
- `PillarName = 'conflict' | 'crime' | 'health' | 'governance' | 'environment'`
- Pillar weights: conflict 25%, crime 20%, health 20%, governance 20%, environment 15%

### Integration Points
- SafetyMap.astro lines 101-112 — where scores.json is parsed (needs pillar extraction)
- SafetyMap.astro line 266 — where colors are applied (needs pillar-aware coloring)
- history.ts line 36 — where history-index is built (needs pillar data extraction)
- TrendChart.astro — client-side chart receiving HistoryPoint[], needs extended for pillar history
- Country detail pages ([slug].astro) — where TrendChart data is passed, needs pillar history

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the success criteria — standard filter UI pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
