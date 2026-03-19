# Technology Stack: v1.1 Comparison & Historical Trends

**Project:** IsItSafeToTravel.com
**Researched:** 2026-03-19
**Scope:** Incremental additions for comparison pages, historical trend charts, global safety score, multi-country chart overlays

## Existing Stack (validated, DO NOT change)

| Technology | Version | Role |
|------------|---------|------|
| Astro | ^6.0.6 | SSG framework |
| Tailwind CSS | ^4.2.2 | Styling |
| D3.js | ^7.9.0 | Map rendering, build-time SVG charts |
| TypeScript | ^5.9.3 | Type safety |
| Fuse.js | ^7.1.0 | Client-side search |
| Cloudflare Pages | - | Hosting |
| GitHub Actions | - | Daily data pipeline |
| topojson-client | ^3.1.0 | Map topology |

## What Each New Feature Needs

### 1. Comparison Page (2+ countries side-by-side)

**New libraries needed: NONE**

This is a static page that reads existing score data at build time. The pipeline already produces `latest.json` with all country scores including pillar breakdowns. A comparison page simply:
- Accepts country selection (URL params or client-side state)
- Renders side-by-side score cards using existing data
- Uses existing D3 color utilities (`scoreToColor`, `pillarToColor`)

Country selection UI needs minimal client-side JS for the selector/search -- Fuse.js is already in the stack for this. A vanilla `<script>` tag in the Astro component handles the interactivity.

**Integration point:** `loadLatestScores()` from `src/lib/scores.ts` provides all country data at build time. Embed the full scores array as a JSON `<script>` tag for client-side filtering.

### 2. Historical Trend Charts (interactive, per-country)

**New libraries needed: NONE**

The existing `TrendSparkline.astro` already uses D3 `scaleLinear` and `line` to generate SVG at build time. The full trend chart expands this pattern but adds client-side interactivity for:
- Tooltips on hover (show date + score)
- Axis labels
- Zoom/pan on time axis (optional, can defer)

D3 v7.9 (already installed) handles all of this. The pattern: generate the static SVG at build time with D3 in the Astro frontmatter, then attach event listeners via a `<script>` tag for tooltips and hover effects.

**Why not a charting library (Chart.js, Recharts, etc.):** D3 is already installed and proven in this codebase. Adding Chart.js or similar would be redundant and add bundle size for no gain. D3 is more flexible for the exact visual style already established (the color scale, sparkline aesthetic).

**Integration point:** `loadHistoricalScores(days)` from `src/lib/scores.ts` already returns `Map<string, HistoryPoint[]>`. Serialize per-country history into inline JSON for client-side tooltip rendering.

### 3. Multi-Country Overlay on Trend Charts

**New libraries needed: NONE**

This is the most interactive feature -- users select multiple countries and see overlaid trend lines on one chart. This requires:
- Client-side D3 rendering (not build-time) because the combination of countries is user-chosen
- Country selector (reuse Fuse.js-powered search from comparison page)
- Dynamic SVG updates as countries are added/removed
- Color-coded lines with legend
- Crosshair tooltip showing all country values at a given date

D3 v7's `d3.line()`, `d3.scaleTime()`, `d3.axisBottom()`, `d3.bisector()` handle all of this natively. This is core D3 territory -- multi-line charts with interactive tooltips are one of D3's most documented patterns.

**Architecture decision: Vanilla `<script>` with D3, NOT a framework island.**

Rationale:
- The current codebase ships zero client-side framework JS (no `client:` directives anywhere)
- Adding `@astrojs/react` or `@astrojs/preact` for one interactive chart is disproportionate overhead
- D3's imperative DOM manipulation is actually a better fit than React for chart interactivity (no virtual DOM overhead for SVG updates)
- Astro `<script>` tags are bundled and tree-shaken by Vite -- D3 modules used client-side will be properly code-split

**The tradeoff:** If the site later needs many interactive UI components beyond charts, consider adding Preact. For now, vanilla D3 scripts are the right call.

**Integration point:** The historical scores JSON for all countries (or a subset of popular ones) needs to be available client-side. Two approaches:
- **Option A (recommended):** Generate a `data/history/summary.json` at build time containing `{iso3: [{date, score}...]}` for all countries. Fetch it client-side on the overlay page.
- **Option B:** Embed all history inline. Rejected -- too large for 200+ countries x 90+ days.

### 4. Global Safety Score (world benchmark)

**New libraries needed: NONE**

This is a pure pipeline computation. The global safety score is a weighted average of all country scores (weighted by population, or unweighted). Computed in the pipeline alongside per-country scores, added to the snapshot JSON.

**Pipeline change:** Add a `globalScore` field to the `DailySnapshot` type and compute it in `scoring/engine.ts` after all countries are scored.

**No new dependencies.** This is arithmetic on existing data.

### 5. Historical Data Collection & Storage

**New libraries needed: NONE**

Already implemented. The pipeline writes daily snapshots to `data/scores/YYYY-MM-DD.json`. The `loadHistoricalScores()` function reads them. The `listSnapshotDates()` function enumerates them.

**What IS needed:** A build-time aggregation step that compiles individual daily snapshots into a compact summary file for client-side use. This avoids the client fetching dozens of individual snapshot files.

**Pipeline addition:** A new script (pure Node.js/TypeScript, no new deps) that reads all `data/scores/*.json` files and writes `data/history/summary.json` with the shape:
```typescript
interface HistorySummary {
  dates: string[];           // sorted date array
  countries: {
    [iso3: string]: number[] // scores array, aligned with dates array
  };
  globalScores: number[];    // global score per date, aligned with dates
}
```
This columnar format is compact (no repeated date strings per country) and fast to parse client-side.

## Recommended Stack Additions

### New Dependencies: NONE

No new npm packages are needed for v1.1. Every feature builds on:
- **D3 v7.9** (already installed) -- charts, scales, axes, line generators, bisectors for tooltips
- **Fuse.js v7.1** (already installed) -- country search/selection in comparison and overlay UIs
- **Existing pipeline infrastructure** -- daily snapshots, score computation

### New Dev Dependencies: NONE

No new build tools, test utilities, or dev-time packages needed.

## What NOT to Add

| Temptation | Why Avoid |
|------------|-----------|
| Chart.js / Recharts / Nivo | D3 is already installed and more flexible. Adding a wrapper library adds bundle size and creates two charting paradigms in one codebase. |
| @astrojs/react or @astrojs/preact | Overkill for chart interactivity. Would add framework runtime to a currently zero-JS-framework site. Vanilla `<script>` + D3 is sufficient. |
| @astrojs/svelte | Same reasoning. Not worth the overhead for chart interactions. |
| Observable Plot | Built on D3, but adds abstraction. Since we already use D3 directly and need fine control over multi-line overlays, Plot's opinions would constrain more than help. |
| Lightweight charting (uPlot, Frappe Charts) | Smaller than D3, but D3 is already a dependency. Adding another charting lib fragments the approach. |
| SQLite / Turso / any database | Historical data fits in JSON files. 200 countries x 365 days x 8 bytes = ~570KB. Well within file-based storage limits. |
| Redis / caching layer | Data updates daily. Static generation handles caching. No runtime cache needed. |

## Architecture: Client-Side JS Strategy

The site currently ships zero client-side framework JavaScript. v1.1 introduces the first client-side JS for chart interactivity. Strategy:

```
Build-time (Astro frontmatter):
  - Load data from JSON files
  - Compute static SVG elements (axes, gridlines, static labels)
  - Serialize data needed client-side into <script type="application/json">

Client-side (<script> tags):
  - Import D3 modules (tree-shaken by Vite)
  - Attach event listeners for tooltips, hover effects
  - For overlay chart: full client-side D3 rendering
  - For comparison page: Fuse.js country selector + DOM updates
```

### D3 Client-Side Import Strategy

Astro `<script>` tags are processed by Vite. Import only what you need:

```typescript
// In an Astro <script> tag -- Vite will tree-shake
import { select, scaleLinear, scaleTime, line, axisBottom, axisLeft, bisector } from 'd3';
```

This avoids shipping the full D3 bundle (~200KB). Only the used modules ship (~30-40KB for line chart functionality).

## Data Shape Changes

### DailySnapshot (add globalScore)

```typescript
interface DailySnapshot {
  date: string;
  generatedAt: string;
  pipelineVersion: string;
  weightsVersion: string;
  globalScore: number;        // NEW: weighted average of all country scores
  globalScoreDisplay: number; // NEW: rounded integer
  countries: ScoredCountry[];
  fetchResults: FetchResult[];
}
```

### New file: data/history/summary.json

```typescript
interface HistorySummary {
  generatedAt: string;
  dates: string[];
  countries: Record<string, number[]>;  // iso3 -> scores aligned with dates
  globalScores: number[];
}
```

Estimated size for 1 year of daily data, 200 countries: ~400KB uncompressed, ~40KB gzipped. Acceptable for a single client-side fetch.

## Installation

```bash
# No new packages needed for v1.1
# Existing dependencies cover all requirements:
#   d3@^7.9.0      -- charts, scales, axes
#   fuse.js@^7.1.0 -- country search
#   astro@^6.0.6   -- SSG + script bundling
```

## Version Verification Status

| Technology | Current Version | Verified | Notes |
|------------|----------------|----------|-------|
| D3.js | ^7.9.0 (installed) | Via package.json | v7 is current stable. No v8 released. |
| Fuse.js | ^7.1.0 (installed) | Via package.json | v7 is current stable. |
| Astro | ^6.0.6 (installed) | Via package.json | Astro 6 stable. `<script>` tags processed by Vite. |
| Tailwind CSS | ^4.2.2 (installed) | Via package.json | v4 is current. |

## Cost Impact

**Zero additional cost.** No new services, APIs, or paid dependencies. Historical data storage uses existing git repo (daily JSON files already committed). Client-side JS served from existing Cloudflare Pages.

## Sources

- Project `package.json` -- current dependency versions
- `src/components/country/TrendSparkline.astro` -- existing D3 build-time SVG pattern
- `src/lib/scores.ts` -- existing historical data loading utilities
- `src/lib/colors.ts` -- existing D3 color scale utilities
- `src/pipeline/scoring/snapshot.ts` -- existing daily snapshot storage
- [Astro Islands Architecture](https://docs.astro.build/en/concepts/islands/) -- confirms `<script>` tags are bundled by Vite
- [D3 multi-line chart patterns](https://d3-graph-gallery.com/graph/interactivity_tooltip.html) -- established D3 patterns for tooltips and multi-series charts
