# Pitfalls Research

**Domain:** Adding comparison, historical trends, and global safety score to existing Astro SSG travel safety site
**Researched:** 2026-03-19
**Confidence:** HIGH (based on direct codebase analysis of existing system + known Astro/D3/SSG constraints)

## Critical Pitfalls

### Pitfall 1: Build-Time Memory Explosion from Historical Data Loading

**What goes wrong:**
`loadHistoricalScores(90)` in `src/lib/scores.ts` reads every dated JSON file sequentially, parsing 248 countries per file. Each daily snapshot is 656KB. At 90 days that is ~59MB of JSON parsed at build time. This function is already called in `getStaticPaths` for country pages (248 pages x 2 languages). Adding a comparison page, a global score page, or trend chart pages that also call `loadHistoricalScores` -- potentially with longer windows (180 or 365 days for meaningful trends) -- will multiply memory usage. The build process will hit Node's heap limit or Cloudflare Pages' 20-minute build timeout.

**Why it happens:**
The current `loadHistoricalScores` does a full filesystem scan and JSON parse for every call site. Astro's `getStaticPaths` runs per page collection, and each invocation re-reads all files from disk. No caching layer exists between calls. Developers adding new page types that need history will naturally call the same function, compounding the problem.

**How to avoid:**
1. Pre-aggregate historical data during the daily pipeline run, not at build time. Have `src/pipeline/run.ts` maintain a single `history.json` that appends each day's scores in a compact format (`{date, iso3, score}` only -- no pillar data, no advisories). This reduces 90 snapshots (59MB) to one file (~500KB).
2. Load the pre-aggregated file once using a module-level cache (top-level variable in `scores.ts`) so it is shared across all `getStaticPaths` calls.
3. For comparison and trend pages, accept the history Map as a prop rather than re-loading.

**Warning signs:**
- Build time exceeding 5 minutes locally
- `JavaScript heap out of memory` errors during `astro build`
- Cloudflare Pages builds timing out at 20 minutes

**Phase to address:**
Phase 1 (Historical Data Pipeline) -- must be solved before any trend or comparison features consume historical data.

---

### Pitfall 2: Comparison Page Route Explosion (N-Choose-K Problem)

**What goes wrong:**
Generating static pages for every possible country comparison creates a combinatorial explosion. Even pairs only: C(248, 2) = 30,628 pages per language = 61,256 total static pages. The existing `[slug].astro` pattern (which generates 248 pages per locale) tempts developers into `[a]-vs-[b].astro` or `[...countries].astro`. Build times balloon, and Cloudflare Pages free tier hits the 20,000 file limit.

**Why it happens:**
Developers pattern-match from the existing country pages and assume comparison pages follow the same SSG approach. They try to pre-generate all combinations because "this is a static site."

**How to avoid:**
Do NOT pre-render comparison combinations. Instead:
1. Build a single static comparison page per locale (`/en/compare/` and `/it/confronta/`) as a shell with client-side interactivity.
2. Use URL query parameters (`?countries=USA,ITA,FRA`) rather than path segments for country selection.
3. Ship a pre-built compact JSON manifest to `public/` containing all country names, ISO3 codes, and current scores (~15KB). Load historical data lazily only when the comparison chart is requested.
4. Total new static pages: 2 (one per locale).

**Warning signs:**
- Route files named `[...countries].astro` or `[a]-vs-[b].astro`
- `getStaticPaths` returning more than 500 entries for comparison pages
- Build output exceeding 5,000 files total

**Phase to address:**
Phase 2 (Comparison Page) -- this architecture decision must be locked before any comparison route code is written.

---

### Pitfall 3: Bundling Full D3 Library for Client-Side Charts

**What goes wrong:**
The project already uses D3 server-side (TrendSparkline.astro runs D3 at build time to generate static SVG paths -- zero client JS). But the comparison page and multi-country overlay charts need client-side interactivity (hover tooltips, country selection, axis rendering). Importing `d3` or even `import { scaleLinear, line } from 'd3'` in a client-side `<script>` ships ~250KB of JS to the browser because D3 v7's top-level package re-exports everything. This kills the Lighthouse 90+ target.

**Why it happens:**
D3 is already in `package.json` and used in `.astro` frontmatter. Developers assume importing it client-side is equally cheap. D3 v7's package structure means even named imports from `d3` pull in the full bundle when processed by Vite/Rollup.

**How to avoid:**
1. Import from D3 sub-packages directly: `import { scaleLinear } from 'd3-scale'`, `import { line } from 'd3-shape'`, `import { select } from 'd3-selection'` -- never from `d3`.
2. Add sub-packages to `package.json` explicitly: `d3-scale`, `d3-shape`, `d3-selection`, `d3-axis`, `d3-transition`. Remove the monolithic `d3` dependency once all imports are migrated.
3. Keep the current server-side D3 pattern for non-interactive charts. Only ship D3 modules client-side for features that genuinely need interactivity.
4. Use Astro's `client:visible` directive so chart scripts only load when scrolled into view.

**Warning signs:**
- Client JS bundle exceeding 100KB total
- `d3` (not `d3-scale` etc.) appearing in client bundle analysis
- Lighthouse performance score dropping below 85

**Phase to address:**
Phase 3 (Interactive Trend Charts) -- when moving from static sparklines to interactive multi-country overlays.

---

### Pitfall 4: Global Safety Score Without Clear Methodology = Credibility Loss

**What goes wrong:**
A "global safety score" (single number for world safety) is presented without explaining what it means. An unweighted average treats Liechtenstein equal to India. A population-weighted average makes China and India dominate. Neither is obviously correct, and the choice is editorial. Users see a number that changes slightly each day without understanding why, making it feel arbitrary.

**Why it happens:**
It seems simple: "average all 248 country scores." But the aggregation method is inherently an editorial choice. The existing site has a methodology page at `/en/methodology/` for individual country scores, but global aggregation introduces a different set of assumptions that need their own explanation.

**How to avoid:**
1. Show the distribution, not just the mean. A histogram or box-whisker of all 248 scores tells a richer story.
2. Display both the simple average and the median. The median is more robust to outliers.
3. Show "movers" context: "12 countries improved, 5 worsened since last month" explains changes better than a single number shifting by 0.1.
4. Link to the methodology page with a new section explaining the global aggregation.
5. Handle missing data explicitly: when a country has incomplete scores for a day, document whether it is excluded or carries forward the previous score.

**Warning signs:**
- Global score presented as a lone number without distribution context
- Score changes by more than 0.3 points between days (almost certainly a data issue, not a real-world safety change)
- No methodology link adjacent to the global score display

**Phase to address:**
Phase 1 (Global Safety Score computation) -- methodology must be defined before the UI is built.

---

### Pitfall 5: Historical Data Storage Growing Unbounded in Git

**What goes wrong:**
Each daily snapshot is 656KB. After one year: 365 files totaling ~234MB in `data/scores/`. After two years: ~468MB. These are JSON files committed to the git repo (the build pipeline reads from `data/scores/`). The repository bloats, clone times increase, and Cloudflare Pages builds slow down since they do a full clone. Eventually the repo exceeds GitHub's recommended 1GB limit.

**Why it happens:**
The current pipeline writes a full `YYYY-MM-DD.json` snapshot every day. This was fine when the site launched (1 day of history), but linear growth was never addressed because v1.0 did not depend heavily on historical data.

**How to avoid:**
1. Have the pipeline maintain an append-only `history.json` (compact: date + iso3 + score only, ~5KB per day, ~1.8MB per year).
2. Delete daily snapshot JSON files older than 7 days from the repo after they have been aggregated into `history.json`.
3. Keep only `latest.json` + `history.json` in git for the build.
4. Optionally archive full snapshots to Cloudflare R2 (free tier: 10GB, 1M reads/month) for audit purposes.

**Warning signs:**
- `data/scores/` directory exceeding 20MB
- Git clone taking more than 30 seconds
- Cloudflare build times increasing month over month

**Phase to address:**
Phase 1 (Historical Data Pipeline) -- design the storage format correctly from the start of v1.1.

---

### Pitfall 6: Multi-Country Overlay Charts Becoming Unreadable

**What goes wrong:**
Users select 6+ countries for trend comparison. The chart becomes a tangle of overlapping lines with indistinguishable colors. Countries with similar scores (e.g., several Western European countries clustered at 7-8) produce overlapping lines that are impossible to differentiate. Colorblind users (8% of males) cannot distinguish lines at all. The feature ships looking good with 2 test countries and fails in real use.

**Why it happens:**
Developers test with 2-3 visually distinct countries (e.g., Norway vs Afghanistan) and never test the realistic case: 5 similar-scoring countries overlaid on a 1-10 scale where the interesting range is often just 5-8.

**How to avoid:**
1. Cap maximum countries at 5. Display a clear message when the limit is reached.
2. Use a colorblind-safe palette (D3's `schemeTableau10` or the Okabe-Ito palette).
3. Add interactive highlighting: hovering/focusing a country name in the legend bolds that line and dims all others.
4. Provide a data table below the chart as an accessible alternative.
5. Handle missing data explicitly: show gaps in lines, do not interpolate across missing days.
6. Consider auto-scaling the Y-axis to the range of selected countries (e.g., 5-9 instead of always 1-10) to spread overlapping lines.

**Warning signs:**
- No maximum country limit in the comparison UI
- Colors assigned from a non-accessible palette
- No hover/focus interaction on the chart legend
- No accessible alternative (table or ARIA descriptions)

**Phase to address:**
Phase 3 (Multi-Country Overlay Charts) -- must be designed into the chart component from the start, not added later.

---

### Pitfall 7: Client-Side Hydration Breaking Astro's SSG Performance Model

**What goes wrong:**
The comparison page and interactive trend charts require client-side JavaScript. Developers reach for Astro's `client:load` directive on large components or wrap the entire page in a React/Svelte island. This ships a framework runtime + component code to every visitor, even before they interact with anything. The page becomes a client-rendered SPA inside an SSG shell, negating Astro's core performance advantage.

**Why it happens:**
Astro's island architecture is designed for small interactive widgets. But a full interactive comparison page (country selector, chart rendering, URL sync) feels like "one big interactive thing," tempting developers to make the entire page a single island.

**How to avoid:**
1. Use multiple small islands: the country search/selector is one island (`client:visible`), the chart is another island (`client:visible`), the data table is static HTML.
2. Pre-render as much as possible at build time. The page layout, headings, empty chart container, and static text are all plain Astro/HTML.
3. Use `client:visible` (not `client:load`) for below-fold interactive components so they only hydrate when scrolled into view.
4. Avoid framework islands entirely if possible: vanilla JS `<script>` tags with D3 sub-packages are lighter than React + D3. The existing codebase has zero framework dependencies (no React, no Svelte) -- keep it that way.
5. Use `<script>` tags in `.astro` files for client interactivity. Astro bundles and deduplicates them automatically.

**Warning signs:**
- Adding React, Svelte, or Vue to `package.json` for the comparison page
- A single `client:load` island containing the entire page content
- Total Interaction to Next Paint (INP) exceeding 200ms

**Phase to address:**
Phase 2 (Comparison Page architecture) -- the island strategy must be decided before building interactive components.

---

### Pitfall 8: URL State Not Synced with Comparison Selection

**What goes wrong:**
Users select 4 countries to compare, find interesting results, copy the URL to share or bookmark it -- and the URL is just `/en/compare/` with no state. On reload, the comparison is lost. Users cannot share specific comparisons on social media or link to them from other sites. This is a major usability failure for a feature whose entire purpose is showing specific country combinations.

**Why it happens:**
Client-side state management (which countries are selected) is implemented with JavaScript variables or component state but never synced to the URL. The comparison page is a single static route and developers forget that URL = state in a web app.

**How to avoid:**
1. Sync selected countries to URL query parameters on every selection change: `?c=USA,ITA,FRA`.
2. On page load, parse query parameters and restore the selection.
3. Use `history.replaceState` (not `pushState`) to avoid polluting browser history with every country toggle.
4. Include the country names in the page `<title>` and `<meta>` description dynamically (client-side `document.title` update) so shared links show meaningful previews.
5. Validate query params against known ISO3 codes; ignore invalid values silently.

**Warning signs:**
- Refreshing the comparison page resets the selection
- Sharing the URL results in an empty comparison page for the recipient
- No URL change when countries are added/removed

**Phase to address:**
Phase 2 (Comparison Page) -- URL sync must be built alongside the country selector, not retrofitted.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline all 248 country scores in comparison page HTML | No extra network request | ~100KB+ HTML payload; uncacheable (changes daily); bad for repeat visits | Never; use a separate cached JSON file |
| Skip i18n for comparison page | Ship faster | Retrofitting i18n into client-side interactive components is painful; URL structure (`/compare/` vs `/confronta/`) is hard to change | Never; the existing site already has full i18n infrastructure |
| Keep full daily snapshots in git indefinitely | No pipeline changes | Git bloat: 234MB/year; slower clones and builds (see Pitfall 5) | First 30 days only; then must add aggregation |
| Use `<script is:inline>` for chart JS | Quick to get working | No tree-shaking, no TypeScript, scripts duplicated across pages | Never; use Astro's standard `<script>` bundling |
| Hardcode country list in comparison search | No data loading logic | Falls out of sync when pipeline adds/removes countries | Never; derive from scores data |
| Use monolithic `d3` import client-side | Fewer import statements | ~250KB client bundle (see Pitfall 3) | Never; always use sub-packages |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cloudflare Pages build | Assuming unlimited build time and memory; 20-min timeout, 512MB memory on free tier | Pre-aggregate data in pipeline; keep build-time data loading minimal |
| Cloudflare Pages file limit | Generating too many static pages (comparison route explosion) | Use client-side rendering for comparison; total static pages should stay under 2,000 |
| D3 in Astro SSG | Importing `d3` in client `<script>` the same as in frontmatter | Frontmatter D3 = build time (free); client D3 = shipped to browser (expensive). Use sub-packages client-side |
| Astro `getStaticPaths` | Calling `loadHistoricalScores()` independently in every page collection | Cache at module level; pre-aggregate in pipeline; load once, share everywhere |
| URL query params in SSG | Using `Astro.url.searchParams` in frontmatter (undefined at build time in SSG) | Query params are client-side only; parse them in `<script>` tags after page load |
| Astro client islands | Wrapping the whole comparison page in a single React/Svelte island | Keep islands small and specific; use vanilla `<script>` + D3 sub-packages; avoid adding a framework dependency |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all 248 countries x 90 days of history client-side | 2-5 sec delay; 500KB+ JSON fetch | Pre-build compact scores JSON (~50KB); lazy-load only on comparison page | Immediately on 3G mobile |
| Re-rendering entire D3 chart on every country toggle | Chart flickers, janky transitions | Use D3 enter/update/exit pattern; debounce rapid selections (300ms) | When users rapidly add/remove countries |
| SVG DOM explosion with long time series | Browser stutters; scroll lag | Downsample to weekly for >90 days; use `<canvas>` for >200 data points per line | Past ~500 total SVG path points on mobile |
| Building trend SVGs for 248 countries at build time when data grows | Build time scales linearly with history length | Pre-compute sparkline SVG paths during pipeline, cache as strings; build just inserts them | When history exceeds 90 days and build time doubles |
| Loading D3 on every page via shared layout | Unused JS shipped to non-chart pages | Only import D3 in chart components; use `client:visible` to defer loading | Immediately noticeable in bundle analysis |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rendering user-provided country codes from URL params directly into SVG/HTML | XSS via malicious query params (e.g., `?c=<script>alert(1)</script>`) | Validate all query params against a Set of known ISO3 codes; reject anything not in the set |
| Exposing raw data source URLs in client-facing JSON | Reveals pipeline internals; could enable scraping of upstream APIs | Strip source URLs from any JSON shipped to the browser; keep them in build-time-only data |
| No input sanitization on comparison country search | DOM injection through search input rendered as HTML | Use `textContent` (not `innerHTML`) when displaying search results; sanitize all user input |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Empty comparison page with no pre-selected countries | User sees blank chart, confused about what to do | Pre-select 2-3 popular countries or detect user's region; show clear "add country" call-to-action |
| Trend chart with <7 data points showing "trends" | Misleading: 3 points cannot show a trend; noise looks like signal | Show "accumulating data" message (already exists in TrendSparkline); require minimum 14 days for trend display |
| Global safety score as a lone number | "6.2 out of 10" is meaningless without context | Show alongside distribution histogram; include change arrow and "movers" context |
| Country search returning 30+ results for single letter | Overwhelming dropdown, especially on mobile | Show max 8 results; sort by relevance/popularity; show flag icons for quick visual scanning |
| No way to share a specific comparison | Users cannot bookmark or share via social media | Sync state to URL query params; ensure shared URL reproduces exact comparison |
| Comparison table without sorting | Users cannot easily find which country ranks best on a specific pillar | Allow clicking column headers to sort; highlight the "best" and "worst" values |
| Charts not responsive on mobile | Horizontal scroll or tiny unreadable labels on 375px screens | Design charts mobile-first; use responsive SVG viewBox; reduce axis label density on small screens |

## "Looks Done But Isn't" Checklist

- [ ] **Comparison URL sync:** Refreshing the page preserves country selection via query params
- [ ] **Trend chart dates:** Date labels handle timezone correctly (pipeline writes UTC; display should match user locale or be date-only)
- [ ] **Global score partial data:** Score handles days when not all 248 countries are scored (data source outage)
- [ ] **Overlay chart keyboard nav:** Users can toggle countries via keyboard Tab + Enter, not just mouse click
- [ ] **Historical data gaps:** Charts show gaps (not interpolated lines) when a country has no score for a given day
- [ ] **i18n on comparison page:** Country search works with both English and Italian names; all UI strings translated
- [ ] **Mobile comparison chart:** Usable on 375px screen width; touch targets at least 44x44px
- [ ] **Comparison SEO:** Page has proper meta tags and generates a meaningful `<title>` reflecting selected countries
- [ ] **Loading states:** Comparison page shows skeleton/spinner while fetching historical JSON, not a blank space
- [ ] **Error states:** Graceful handling when history JSON fails to load (network error); show message, not broken chart

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Build memory explosion | LOW | Add pre-aggregation step to pipeline; create `history.json`; update `loadHistoricalScores` to read it; achievable in a day |
| Route explosion | MEDIUM | Rewrite comparison as single client-rendered page; change URL structure from paths to query params; redirect any bookmarked old URLs |
| D3 bundle bloat | LOW | Switch imports to sub-packages; add `d3-scale`, `d3-shape`, etc. to package.json; update import statements; Vite handles the rest |
| Git repo bloat from snapshots | MEDIUM | Run BFG Repo-Cleaner to remove old large files from history; add pipeline step to prune old snapshots; update .gitignore |
| Unreadable overlay charts | LOW | Add country limit cap; switch to accessible color palette; add hover highlighting; design refinement, not architecture change |
| Global score without methodology | LOW | Content and copy work; add methodology section and distribution visualization; no backend changes needed |
| URL state not synced | LOW | Add query param sync in comparison page's `<script>`; parse on load, update on change; straightforward DOM scripting |
| Client hydration bloat | MEDIUM | Refactor from framework island to vanilla `<script>` + D3 sub-packages; more work than getting it right initially |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Build-time memory explosion | Phase 1: Historical Data Pipeline | Build completes under 5 minutes; peak memory under 512MB |
| Comparison route explosion | Phase 2: Comparison Page | Total static pages under 2,000; single comparison route per locale |
| D3 bundle bloat | Phase 3: Interactive Charts | Client JS bundle under 80KB total; Lighthouse performance 90+ |
| Global score methodology | Phase 1: Global Safety Score | Methodology page updated; score shows distribution context |
| Historical data storage growth | Phase 1: Historical Data Pipeline | `data/scores/` under 5MB in git; old snapshots pruned after aggregation |
| Unreadable overlay charts | Phase 3: Multi-Country Overlay | Tested with 5 countries; passes WCAG color contrast; keyboard navigable |
| Client hydration bloat | Phase 2: Comparison Page | No framework dependencies added; islands use vanilla `<script>` + D3 sub-packages |
| URL state not synced | Phase 2: Comparison Page | Refreshing page preserves selection; shared URL reproduces comparison |

## Sources

- Direct analysis of existing codebase: `src/lib/scores.ts`, `src/components/country/TrendSparkline.astro`, `src/pages/en/country/[slug].astro`, `package.json`
- Data measurement: `latest.json` = 656KB (248 countries with full pillar data); one day = one snapshot file
- Astro SSG behavior: `getStaticPaths` evaluated at build time per page collection; `export const prerender = true` confirms SSG mode
- Cloudflare Pages free tier: 20,000 files max, 20-minute build timeout, 512MB build memory
- D3 v7 bundle analysis: monolithic `d3` package re-exports all sub-packages; sub-package imports enable tree-shaking
- Existing architecture: zero framework dependencies (no React/Svelte/Vue); D3 used server-side only; Tailwind CSS v4; Astro 6
- WCAG 2.1 color contrast requirements for data visualization accessibility

---
*Pitfalls research for: v1.1 Comparison, Historical Trends, and Global Safety Score additions to IsItSafeToTravel*
*Researched: 2026-03-19*
