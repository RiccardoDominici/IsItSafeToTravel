# Architecture Patterns

**Domain:** Comparison pages, historical trend charts, and global safety score -- integration with existing Astro SSG + D3 + daily pipeline
**Researched:** 2026-03-19
**Scope:** v1.1 features ONLY -- not a full architecture document

## Existing Architecture (Reference)

```
Pipeline (daily cron) -> data/scores/latest.json + YYYY-MM-DD.json snapshots
     |
     v
Astro SSG build (on push to master)
     |
     +-- Homepage: SafetyMap.astro (client-side D3 choropleth, reads public/scores.json)
     +-- Country pages: [slug].astro (build-time D3 SVG via TrendSparkline.astro)
     |
     v
Cloudflare Pages (static deploy)
```

Key existing patterns:
- **Build-time D3:** `TrendSparkline.astro` uses D3's `scaleLinear` + `line` in Astro frontmatter to produce SVG paths at build time. Zero client JS.
- **Data loading:** `src/lib/scores.ts` provides `loadLatestScores()` and `loadHistoricalScores(days)` -- both read JSON files from `data/scores/` at build time via `node:fs`.
- **Client-side map:** `SafetyMap.astro` embeds a `<script>` that loads `public/scores.json` via fetch and renders D3 + TopoJSON.
- **i18n:** File-based routing with `routes` object in `src/i18n/ui.ts`. Pages duplicated in `src/pages/{en,it}/` with translated slugs.
- **Pipeline output:** `DailySnapshot` type with `date`, `countries: ScoredCountry[]`, `fetchResults`. Countries have `iso3`, `score`, `pillars[]`, `advisories`.

---

## Recommended Architecture for v1.1

### Design Principle: Keep SSG, Minimize Client JS

All three features integrate into the existing architecture without requiring SSR or API endpoints. The comparison page is the only feature that needs meaningful client-side JavaScript (because users pick countries interactively). Everything else remains build-time.

---

## New Data Artifacts

### 1. Global Score in DailySnapshot (pipeline change)

Add `globalScore` and `globalScoreDisplay` as top-level fields in `DailySnapshot`:

```typescript
// Modified: src/pipeline/types.ts
interface DailySnapshot {
  date: string;
  generatedAt: string;
  pipelineVersion: string;
  weightsVersion: string;
  countries: ScoredCountry[];
  fetchResults: FetchResult[];
  globalScore: number;        // NEW: 1-10 weighted average
  globalScoreDisplay: number; // NEW: integer for display
}
```

Computation: population-weighted average of all country scores, or simple arithmetic mean (simpler, avoids needing population data). Recommend simple mean -- it is transparent and doesn't require a new data source. Computed after `computeAllScores()` in the pipeline.

### 2. Consolidated History Index (pipeline change)

Currently `loadHistoricalScores()` reads every dated snapshot file. This works but scales linearly with accumulated days. After 365 days = 365 file reads per build.

Add a post-pipeline step that writes `data/scores/history-index.json`:

```typescript
interface HistoryIndex {
  generatedAt: string;
  dateRange: { from: string; to: string };
  // Keyed by ISO3, array of {date, score} sorted chronologically
  countries: Record<string, { date: string; score: number }[]>;
  // Global score trend
  global: { date: string; score: number }[];
}
```

Size estimate: 200 countries x 365 days x ~25 bytes per entry = ~1.8MB after a year. Manageable. Limit to last 365 days to keep it bounded.

### 3. Comparison Data Blob (build-time, for client embedding)

The comparison page needs all country scores + names client-side for the picker and chart. Prepare a compact JSON at build time:

```typescript
// ~10KB for 200 countries
interface ComparisonBlob {
  countries: { iso3: string; name: string; score: number; scoreDisplay: number }[];
  // History for chart overlay -- embedded only when history exists
  history: Record<string, { d: string; s: number }[]>; // compact keys
}
```

The history portion is large (~1.8MB at a year). Two options:
- **Embed inline** for sites with < 6 months of data (< 900KB). Acceptable.
- **Load from `public/history.json`** via fetch when data exceeds threshold. Add loading state.

Recommendation: Start with inline embedding. Switch to fetch-based loading when history exceeds 6 months (revisit at that point).

---

## Component Architecture

### New Components

| Component | File | Type | Purpose |
|-----------|------|------|---------|
| `GlobalScoreBanner` | `src/components/GlobalScoreBanner.astro` | Build-time | Displays current global score + mini sparkline on homepage |
| `HistoryChart` | `src/components/country/HistoryChart.astro` | Build-time SVG | Full-size trend chart replacing TrendSparkline, with date axis and score axis |
| `ComparisonShell` | `src/components/compare/ComparisonShell.astro` | Build-time layout | Page structure for comparison: picker area + chart area + table area |
| `CountryPicker` | `src/components/compare/CountryPicker.astro` | Client island | Interactive country search + select (reuses Fuse.js) |
| `ComparisonChart` | `src/components/compare/ComparisonChart.ts` | Client-side D3 | Multi-country overlay line chart |
| `ComparisonTable` | `src/components/compare/ComparisonTable.ts` | Client-side | Side-by-side pillar breakdown table |

### Modified Components

| Component | Change |
|-----------|--------|
| `src/pages/en/index.astro` | Add GlobalScoreBanner below hero tagline |
| `src/pages/it/index.astro` | Add GlobalScoreBanner below hero tagline |
| `src/pages/en/country/[slug].astro` | Replace TrendSparkline with HistoryChart, add "Compare with..." link |
| `src/pages/it/paese/[slug].astro` | Same changes as English country page |
| `src/components/Header.astro` | Add "Compare" nav link |
| `src/i18n/ui.ts` | Add routes (`compare`/`confronta`) and ~15 new translation keys |
| `src/pipeline/types.ts` | Add globalScore fields to DailySnapshot |
| `src/pipeline/run.ts` | Add global score computation + history index steps |
| `src/lib/scores.ts` | Add `loadHistoryIndex()`, `loadGlobalScore()` functions |
| `.github/workflows/deploy.yml` | Copy `history-index.json` to `public/history.json` |

### Unchanged

| Component | Why Unchanged |
|-----------|--------------|
| `SafetyMap.astro` | Map doesn't change for v1.1 |
| `Search.astro` | Search behavior unchanged |
| All pipeline fetchers | No new data sources |
| `src/pipeline/scoring/engine.ts` | Scoring logic unchanged |
| `.github/workflows/data-pipeline.yml` | `git add data/scores/` already covers new files |

---

## Page Architecture Details

### Comparison Page: `/en/compare/` and `/it/confronta/`

This is the architecturally complex feature. Comparison is user-driven (pick countries), but the site is SSG.

**Approach: Static shell + client-side D3 rendering**

```
URL: /en/compare/?c=ITA,FRA,DEU
     /en/compare/              (empty state with picker)
```

The page is one statically generated page per locale. Country data is embedded as inline JSON. Client-side JavaScript handles:
1. Country picker (Fuse.js search, add/remove pills)
2. Chart rendering (D3 multi-line overlay)
3. Table rendering (pillar comparison)
4. URL state sync (query params for shareability)

**Why not SSR?** Adding SSR means Cloudflare Workers runtime, edge function cold starts, caching complexity, cost. The dataset is small enough to embed.

**Why not pre-generate all combinations?** 200 countries = 19,900 pairs. Build time explosion with zero SEO value for most.

**Why not generate popular pairs only?** Complexity for marginal SEO benefit. A single well-optimized comparison page with good meta tags serves better.

**Page structure:**

```astro
---
// src/pages/en/compare/index.astro
export const prerender = true;
import { loadLatestScores, loadHistoryIndex } from '../../../lib/scores';

const countries = loadLatestScores();
const history = loadHistoryIndex();

// Prepare compact data for client
const comparisonData = {
  countries: countries.map(c => ({
    iso3: c.iso3,
    name: c.name.en,
    score: c.score,
    scoreDisplay: c.scoreDisplay,
    pillars: c.pillars.map(p => ({ name: p.name, score: p.score })),
  })),
  history: Object.fromEntries(
    Object.entries(history.countries).map(([iso3, points]) => [
      iso3,
      points.map(p => ({ d: p.date, s: p.score })),
    ])
  ),
};
---
<Base ...>
  <ComparisonShell>
    <!-- Country data embedded for client JS -->
    <script type="application/json" id="comparison-data">
      {JSON.stringify(comparisonData)}
    </script>

    <!-- Country picker: client island -->
    <div id="country-picker"></div>

    <!-- Chart area: D3 renders here -->
    <div id="comparison-chart"></div>

    <!-- Table area: renders here -->
    <div id="comparison-table"></div>
  </ComparisonShell>

  <script src="../../lib/comparison-client.ts"></script>
</Base>
```

**Client-side script (`comparison-client.ts`):**
- Reads embedded JSON from `#comparison-data`
- Parses `?c=ITA,FRA` from URL
- Initializes Fuse.js for country search
- Renders D3 chart with selected countries' history
- Renders comparison table with pillar breakdown
- Updates URL via `history.replaceState()` on selection change

### Historical Trend Chart (Enhanced)

Replace the 300x64px `TrendSparkline` with a full-width `HistoryChart`:

```
src/components/country/HistoryChart.astro
```

**Build-time features:**
- Full-width SVG (responsive viewBox)
- Y-axis with score labels (1-10)
- X-axis with date labels (monthly ticks)
- Color-coded line using scoreToColor gradient
- Area fill below line for visual weight
- Endpoint dot with current score label

**Differences from TrendSparkline:**
- Larger: full-width instead of 300x64
- Axes: labeled X and Y axes
- Accessible: `<title>` and `<desc>` in SVG, data table for screen readers
- Link: "Compare with other countries" link to comparison page with `?c=THIS_COUNTRY`

**The existing `TrendSparkline` can be kept** as a small preview on the country page, with HistoryChart as an expanded view. Or replace entirely -- design decision, not architectural.

### Global Safety Score

Simple build-time component:

```
src/components/GlobalScoreBanner.astro
```

Reads `globalScore` from the latest snapshot. Displays:
- Current global safety score (1-10)
- Score change indicator (up/down arrow if history available)
- Optional mini sparkline of global trend (reuse TrendSparkline pattern)

Placement: Homepage, below the hero tagline, above the map.

---

## Data Flow Diagram (v1.1)

```
Pipeline (daily cron, src/pipeline/run.ts)
  |
  Stage 1: Fetch sources          -- unchanged
  Stage 2: Load raw data          -- unchanged
  Stage 3: Score countries         -- unchanged
  Stage 4: Compute global score   -- NEW
  Stage 5: Write snapshot          -- modified (includes globalScore)
  Stage 6: Write history index     -- NEW (consolidates all snapshots)
  |
  Output:
    data/scores/latest.json        (+ globalScore, globalScoreDisplay)
    data/scores/YYYY-MM-DD.json    (+ globalScore, globalScoreDisplay)
    data/scores/history-index.json (NEW - consolidated history)
  |
  Git commit + push -> triggers deploy workflow
  |
  v
Deploy workflow (.github/workflows/deploy.yml)
  |
  Copy to public/:
    public/scores.json             -- existing (for map)
    public/history.json            -- NEW (for comparison page client)
  |
  Astro build:
    Homepage        reads latest.json     -> GlobalScoreBanner
    Country pages   reads history-index   -> HistoryChart (build-time SVG)
    Comparison page reads latest.json     -> embeds inline JSON for client
                    + history-index       -> embeds inline or refs public/history.json
  |
  v
Cloudflare Pages deploy (static)
```

---

## Patterns to Follow

### Pattern 1: Build-Time D3 SVG (existing, extend)

Use for: HistoryChart, GlobalScoreBanner sparkline.

D3 scales and line generators run in Astro frontmatter. Output is static SVG in HTML. Zero client JS. This is the proven pattern from TrendSparkline.

### Pattern 2: Embedded Data + Client D3 (new pattern)

Use for: Comparison page chart and table.

```astro
<!-- Build time: embed data -->
<script type="application/json" id="data">{JSON.stringify(data)}</script>

<!-- Client time: read and render -->
<script>
  const data = JSON.parse(document.getElementById('data').textContent);
  // D3 rendering here
</script>
```

This avoids runtime fetch calls while enabling interactive visualization.

### Pattern 3: URL-Driven State

Use for: Comparison page country selection.

```
/en/compare/?c=ITA,FRA,DEU
```

Client JS reads `URLSearchParams` on load, updates via `history.replaceState()` on change. URLs are shareable and bookmarkable. No framework state management needed.

### Pattern 4: Progressive Enhancement

Use for: Comparison page.

The page should show a meaningful empty state without JS (instructions to select countries, maybe a static "most compared" table). Client JS enhances with the interactive picker and chart. This maintains accessibility and gives crawlers content.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding SSR for the Comparison Page

**Why tempting:** Dynamic country selection feels like it needs server rendering.
**Why wrong:** Data is ~10KB for scores, embeddable inline. SSR adds Cloudflare Workers runtime, cold starts, caching complexity, breaks the pure SSG deploy model.
**Instead:** Static page + embedded data + client-side D3.

### Anti-Pattern 2: Pre-Generating All Country Pair Pages

**Why tempting:** SEO for "Italy vs France safety comparison" searches.
**Why wrong:** 19,900 pairs, millions of triples. Build time explosion.
**Instead:** One comparison page with good meta tags. Use structured data and dynamic title/description based on query params (client-side, for social sharing use a separate OG image strategy if needed).

### Anti-Pattern 3: Fetching History Data Client-Side on Country Pages

**Why tempting:** Keeps country page bundle small.
**Why wrong:** Adds loading states, error handling, CORS config. History for a single country is tiny (~3KB for a year). Build-time SVG eliminates all this.
**Instead:** Build-time D3 in HistoryChart.astro, same pattern as TrendSparkline.

### Anti-Pattern 4: Separate History Database

**Why tempting:** SQL queries for date ranges, aggregations.
**Why wrong:** Adds infrastructure, cost. JSON files work at this scale.
**Instead:** Consolidated history-index.json read at build time.

### Anti-Pattern 5: React/Vue Islands for Comparison

**Why tempting:** Framework components for interactive UI.
**Why wrong:** Adds framework runtime (~30-50KB), build complexity, hydration overhead. The comparison UI is a search box + a chart + a table -- vanilla JS + D3 handles this.
**Instead:** Vanilla TypeScript + D3 + Fuse.js (already a dependency).

---

## New Pipeline Modules

### `src/pipeline/scoring/global.ts`

```typescript
export function computeGlobalScore(countries: ScoredCountry[]): {
  globalScore: number;
  globalScoreDisplay: number;
} {
  // Simple arithmetic mean of all country scores
  const sum = countries.reduce((acc, c) => acc + c.score, 0);
  const avg = sum / countries.length;
  return {
    globalScore: Math.round(avg * 10) / 10,  // one decimal
    globalScoreDisplay: Math.round(avg),
  };
}
```

### `src/pipeline/scoring/history-index.ts`

```typescript
export function writeHistoryIndex(scoresDir: string, maxDays: number = 365): void {
  // Read all YYYY-MM-DD.json files
  // Build consolidated index
  // Write to data/scores/history-index.json
}
```

---

## i18n Integration

Add to `src/i18n/ui.ts` routes:

```typescript
export const routes = {
  en: {
    // ...existing
    compare: 'compare',
  },
  it: {
    // ...existing
    compare: 'confronta',
  },
};
```

New translation keys needed (~15):
- `compare.title`, `compare.description`, `compare.select_countries`, `compare.add_country`, `compare.remove`, `compare.no_selection`, `compare.chart_title`, `compare.table_title`, `compare.vs`
- `global.score_title`, `global.score_label`, `global.trend_label`
- `country.full_history`, `country.compare_with`

---

## Suggested Build Order

Order based on dependency analysis:

### Phase A: Pipeline Extensions (foundation -- no UI)

1. `computeGlobalScore()` in `src/pipeline/scoring/global.ts`
2. Add `globalScore` fields to `DailySnapshot` type
3. Wire global score into `run.ts` after `computeAllScores()`
4. `writeHistoryIndex()` in `src/pipeline/scoring/history-index.ts`
5. Wire history index into `run.ts` after `writeSnapshot()`
6. Add `loadHistoryIndex()` and `loadGlobalScore()` to `src/lib/scores.ts`

**Rationale:** All UI features depend on this data. Run pipeline a few times to accumulate test data.

### Phase B: Global Safety Score UI (simplest feature)

7. `GlobalScoreBanner.astro` component
8. Add to both homepage pages (en + it)
9. Add i18n keys for global score

**Rationale:** Simplest new feature. Validates pipeline -> build -> display flow end-to-end.

### Phase C: Enhanced History Chart (extends existing pattern)

10. `HistoryChart.astro` -- larger chart with axes
11. Integrate on country pages (replace or augment TrendSparkline)
12. Add "Compare with..." link to country pages
13. Add i18n keys for history chart

**Rationale:** Purely build-time, same pattern as existing TrendSparkline. No new architectural concepts.

### Phase D: Comparison Page (most complex -- new client-side pattern)

14. `comparison-data.ts` -- build-time data preparation
15. `ComparisonShell.astro` -- page layout
16. Comparison page files (en/compare + it/confronta)
17. `CountryPicker.astro` + client JS -- country selector with Fuse.js
18. `ComparisonChart.ts` -- client-side D3 multi-line chart
19. `ComparisonTable.ts` -- client-side pillar comparison
20. URL state management (query params)
21. Add "Compare" to navigation
22. Add all comparison i18n keys
23. Update deploy workflow to copy history.json to public/

**Rationale:** Introduces the only new architectural pattern (client-side D3 from embedded data). Benefits from Phase C chart utilities.

---

## Scalability Notes

| Concern | Now (day 1) | 90 days | 365 days | 3 years |
|---------|-------------|---------|----------|---------|
| history-index.json | ~2KB | ~180KB | ~1.8MB | ~5.4MB |
| Inline embedding | Fine | Fine | Borderline | Switch to fetch |
| Snapshot files in git | 1 | 90 (~18MB) | 365 (~73MB) | 1095 (~219MB) |
| Build time (history) | Instant | Instant (1 file read) | Fast (1 file) | Fast (1 file) |
| Comparison page JS | ~15KB | Same | Same | Same |

**Action needed at 6 months:** Evaluate whether inline history embedding is still acceptable. If history-index.json exceeds ~1MB, switch comparison page to fetch `public/history.json` instead.

**Action needed at 1+ years:** Consider pruning snapshot files older than 365 days from git (keep in history-index.json only). Or accept the git repo size growth.

## Sources

- Existing codebase analysis: `src/pipeline/run.ts`, `src/lib/scores.ts`, `src/components/country/TrendSparkline.astro`, `src/pages/en/country/[slug].astro` (HIGH confidence -- direct code inspection)
- Astro SSG static page generation with `getStaticPaths` (HIGH confidence -- proven in existing codebase)
- D3 v7 build-time SVG generation pattern (HIGH confidence -- proven in TrendSparkline)
- Embedded JSON + client-side D3 pattern (MEDIUM confidence -- standard web pattern, not yet used in this codebase)
- URL query param state management (HIGH confidence -- standard browser API)
