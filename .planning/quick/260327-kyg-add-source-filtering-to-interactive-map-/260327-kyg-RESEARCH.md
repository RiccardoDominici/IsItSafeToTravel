# Quick Task: Add Source Filtering to Map & Chart - Research

**Researched:** 2026-03-27
**Domain:** Frontend filter UI, advisory data structure
**Confidence:** HIGH

## Summary

The map (SafetyMap.astro) and trend chart (TrendChart.astro) both have an existing pillar filter panel -- a dropdown toggle button in the top-left (map) or inline (chart) that shows radio-style pill buttons for Overall/Conflict/Crime/Health/Governance/Environment. The task is to add a second filter section within these same dropdowns for advisory sources, grouped by providing country.

The `scores.json` already ships advisory data per country at `countries[].advisories` with keys like `us`, `uk`, `de`, etc. The conflict pillar's indicators include `advisory_level_XX` entries with `source: "advisories_XX"`. There are currently 26 active advisory source keys with varying coverage (nl: 223, ca: 210, ... down to no: 1).

**Primary recommendation:** Add a collapsible "Sources" section below the existing pillar pills in both filter dropdowns. Group sources by providing-country with checkbox-style toggles. Show source count per country. Filter the map/chart to only consider selected advisory sources when computing displayed scores.

## Existing Filter Architecture

### Map Filter (SafetyMap.astro)

- **Toggle button:** `#pillar-filter-toggle` -- floating top-left overlay with backdrop blur
- **Dropdown:** `#pillar-filter-dropdown` -- hidden by default, opens on click, closes on outside click
- **Pills:** `.pillar-pill` buttons with `data-pillar` attribute -- radio-style (one active at a time)
- **Active style:** `bg-terracotta-500 text-white border-terracotta-500`
- **Inactive style:** `bg-transparent text-sand-600 dark:text-sand-300 border-transparent`
- **Behavior:** Clicking a pill calls `recolorMap(pillarName)` which re-colors all country paths via D3 transition
- **Data source:** Fetches `/scores.json` at init, builds `scoreMap`, `pillarScoreMap`, `nameMap`

### Chart Filter (TrendChart.astro)

- **Toggle button:** `#trend-filter-toggle` -- inline button above chart
- **Dropdown:** `#trend-filter-dropdown` -- same pattern as map
- **Pills:** `.trend-pillar-pill` buttons -- same radio pattern
- **Behavior:** Switches chart data between overall and pillar-specific historical data
- **Data source:** Gets `data-history` and `data-pillar-history` from Astro props

### Design System Patterns (from existing code)

| Element | Classes |
|---------|---------|
| Dropdown container | `bg-sand-50/95 dark:bg-sand-800/95 backdrop-blur-sm border border-sand-300 dark:border-sand-600 rounded-lg shadow-lg` |
| Section text | `text-xs font-medium text-sand-500 dark:text-sand-400` |
| Active pill | `bg-terracotta-500 text-white border-terracotta-500` |
| Inactive pill | `bg-transparent text-sand-600 dark:text-sand-300 border-transparent hover:bg-sand-200 dark:hover:bg-sand-700` |
| Transition | `transition-colors` on all interactive elements |

## Advisory Source Data Structure

### In scores.json (already available to frontend)

Each country in `scores.json` has:
```typescript
advisories: {
  us?: AdvisoryInfo;  // { level, text, source, url, updatedAt }
  uk?: AdvisoryInfo;
  // ... up to 37 possible keys
}
```

### Advisory Key to Country Mapping

The i18n system already has full translations for all source names via `country.advisory.XX` keys. The two-letter keys map directly to ISO2 country codes of the providing government:

| Key | Country | Coverage (countries) |
|-----|---------|---------------------|
| nl | Netherlands | 223 |
| ca | Canada | 210 |
| de | Germany | 199 |
| us | United States | 198 |
| uk | United Kingdom | 193 |
| ie | Ireland | 188 |
| rs | Serbia | 183 |
| be | Belgium | 174 |
| au | Australia | 168 |
| tw | Taiwan | 167 |
| at | Austria | 136 |
| pl | Poland | 95 |
| jp | Japan | 89 |
| ee | Estonia | 69 |
| pt | Portugal | 65 |
| it | Italy | 50 |
| dk | Denmark | 41 |
| nz | New Zealand | 28 |
| ch | Switzerland | 15 |
| hk | Hong Kong | 13 |
| fr | France | 9 |
| cn | China | 7 |
| ar | Argentina | 3 |
| es | Spain | 3 |
| in | India | 2 |
| no | Norway | 1 |

### Conflict Pillar Indicator Names

Advisory scores appear as indicators in the conflict pillar: `advisory_level_us`, `advisory_level_uk`, etc. with source `advisories_us`, `advisories_uk`, etc.

## Recommended Implementation Approach

### UX Pattern: Grouped Checkboxes with Country Headers

Since there are 26 active sources, a flat list would be overwhelming. Group by region or simply show as a scrollable checklist with source counts. Given the existing minimalist pill-button style, use checkboxes (multi-select) rather than radio buttons (single-select) since users may want to see scores from multiple sources.

**Recommended layout inside the existing dropdown:**

```
[Pillar filter pills - existing]
------- divider -------
Sources (26)
[x] All sources
  [x] US State Dept (198)
  [x] UK FCDO (193)
  [x] Canada (210)
  ...
```

### Key Design Decisions

1. **Checkbox, not radio:** Users want to compare multiple source perspectives, not just one
2. **"All sources" toggle:** Quick way to select/deselect all
3. **Show count:** Number of countries each source covers -- helps users understand coverage
4. **Scrollable:** Max-height with overflow-y-auto to keep panel manageable (max-h-[300px])
5. **Separator:** Simple `border-t border-sand-200 dark:border-sand-700 my-2` between pillar pills and source checkboxes
6. **Sorted by coverage:** Most useful sources (highest coverage) first
7. **Source names:** Use existing `t('country.advisory.XX')` translations -- but consider shorter labels for the filter (just country name, not full ministry name)

### How Source Filtering Affects the Map

When sources are filtered, the map should re-color based on the conflict pillar score computed only from selected advisory sources. Two approaches:

**Option A (Simpler -- recommended):** Filter at the advisory level. When a source is deselected, treat that advisory as if it doesn't exist for that country. The existing conflict pillar score already aggregates all advisories. Instead of recomputing, show a visual indicator (e.g., opacity change) for countries that lose coverage when sources are deselected.

**Option B (More accurate):** Recompute a partial conflict score client-side using only selected advisory indicators. This is complex because the scoring engine normalizes and weights indicators.

**Recommendation:** Option A for v1. Simply filter which advisory sources are shown in tooltips and country detail pages. For the map coloring, keep the composite score but add an overlay showing "X of Y selected sources rate this country." This is more useful than trying to recompute scores.

**Simplest viable approach:** Source filtering affects ONLY which advisory information is displayed in tooltips and the advisory section -- it does NOT recompute the safety score. The map colors remain based on the full composite. This is honest (the score uses all data) and useful (users can focus on advisories from their government).

### How Source Filtering Affects the Chart

The trend chart shows historical composite or pillar scores. Source filtering does not easily apply here since historical data is pre-aggregated. **Recommendation:** Source filter only visible on the map, not on the trend chart. Or: show it on both but clearly indicate "advisory sources filter affects map view only."

## Common Pitfalls

### Pitfall 1: Trying to Recompute Scores Client-Side
**What goes wrong:** Attempting to recalculate the safety score with filtered sources requires the full scoring engine logic client-side.
**How to avoid:** Keep source filtering as a view filter (what advisory info is shown), not a score recalculation.

### Pitfall 2: Overwhelming UI with 26+ Checkboxes
**What goes wrong:** The filter panel becomes taller than the viewport.
**How to avoid:** Use max-height with scroll, or group by region with collapsible sections. Sort by coverage so most useful are visible first.

### Pitfall 3: Inconsistent Filter State Between Map and Chart
**What goes wrong:** User selects sources on map, navigates to chart, filter state is lost.
**How to avoid:** If implementing on both, share state via a common store or URL params. If map-only, make this clear in the UI.

## Code Examples

### Adding a Source Filter Section to Map Dropdown

```html
<!-- Inside #pillar-filter-dropdown, after pillar-filter-bar -->
<div class="border-t border-sand-200 dark:border-sand-700 my-2"></div>
<div class="text-[10px] font-medium text-sand-500 dark:text-sand-400 px-1 mb-1">
  Sources
</div>
<div class="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto" id="source-filter-list">
  <!-- Generated from scores.json advisory keys -->
</div>
```

### Checkbox Style (matching existing design)

```html
<label class="flex items-center gap-2 px-2 py-1 text-xs rounded-md hover:bg-sand-200 dark:hover:bg-sand-700 cursor-pointer">
  <input type="checkbox" checked class="accent-terracotta-500 w-3 h-3" data-source="us" />
  <span class="text-sand-600 dark:text-sand-300">US State Dept</span>
  <span class="ml-auto text-[10px] text-sand-400">(198)</span>
</label>
```

### Building Source List from scores.json Data

```typescript
// Count advisory sources across all countries
const sourceCounts = new Map<string, number>();
for (const c of snapshot.countries) {
  for (const key of Object.keys(c.advisories || {})) {
    sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
  }
}
// Sort by count descending
const sortedSources = [...sourceCounts.entries()]
  .sort((a, b) => b[1] - a[1]);
```

## i18n Considerations

Existing translation keys `country.advisory.XX` contain full ministry names which are too long for a filter checkbox. Two options:

1. **Use country names from the countries mapping** (shorter: "United States", "United Kingdom")
2. **Add new short i18n keys** like `filter.source.us`: "US", `filter.source.uk`: "UK"

**Recommendation:** Use short country names. The advisory key (us, uk, de, etc.) maps to well-known country codes. A simple static mapping in the component is sufficient:

```typescript
const SOURCE_LABELS: Record<string, string> = {
  us: 'United States', uk: 'United Kingdom', ca: 'Canada',
  au: 'Australia', de: 'Germany', nl: 'Netherlands', // ...
};
```

Or better: derive from existing country name data already in scores.json, mapping ISO2 to the country name object.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of SafetyMap.astro (597 lines) -- full filter implementation
- Direct code analysis of TrendChart.astro (684 lines) -- filter pattern
- Direct code analysis of AdvisorySection.astro -- advisory key list
- scores.json analysis -- 26 active advisory sources with coverage counts
- pipeline/types.ts -- AdvisoryInfo and ScoredCountry type definitions
- i18n/ui.ts -- all advisory source translation keys

## Metadata

**Confidence breakdown:**
- Existing filter architecture: HIGH -- direct code reading
- Advisory data structure: HIGH -- analyzed actual production data
- UX recommendation: MEDIUM -- based on common patterns, no user testing
- Implementation approach: HIGH -- builds on verified existing patterns

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain)
