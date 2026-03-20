# Technology Stack: v1.2 Improvements & Category Filtering

**Project:** IsItSafeToTravel.com
**Researched:** 2026-03-20
**Scope:** Incremental additions for interactive chart zoom/scope controls, per-category map/chart filtering, Spanish i18n, parameter explanation pages, bug fixes

## TL;DR

No new dependencies needed. All v1.2 features can be built with the existing stack. D3 ^7.9.0 already includes `d3-brush` for chart zoom/scope. The custom i18n system in `src/i18n/ui.ts` supports adding Spanish mechanically. Category filtering re-uses existing pillar data and D3 selections. Parameter explanation pages are static Astro content pages.

## Existing Stack (validated, DO NOT change)

| Technology | Version | Role |
|------------|---------|------|
| Astro | ^6.0.6 | SSG framework, i18n routing |
| D3.js | ^7.9.0 | Charts, map, scales, zoom (full bundle) |
| Tailwind CSS | ^4.2.2 | Styling |
| Fuse.js | ^7.1.0 | Client-side fuzzy search |
| topojson-client | ^3.1.0 | Map topology |
| TypeScript | ^5.9.3 | Type safety |
| Cloudflare Pages | - | Hosting/deployment |

## Feature-by-Feature Stack Analysis

### 1. Interactive Chart Zoom/Scope Controls

**New libraries needed: NONE**

**What's needed:** Time-range scope buttons (e.g., 7d / 30d / 90d / All) and optional brush-to-zoom on the x-axis of trend charts.

**Why existing D3 is sufficient:**
- `d3-brush` (included in `d3` ^7.9.0) provides `brushX()` for click-drag date range selection. This is the standard D3 pattern for time-series chart zoom.
- `d3-scale` (already used in TrendChart and compare page) provides `scaleTime().domain()` for re-scoping the x-axis to a selected date range.
- `d3-transition` (included) provides smooth animated transitions when changing scope.

**Implementation approach:**
- The `TrendChart.astro` currently generates SVG at build time (Astro frontmatter) with a thin client-side script for tooltips. For interactive zoom/scope, the chart rendering needs to move fully client-side, following the same pattern already established in `compare.astro`.
- Add scope button bar above chart (HTML buttons styled with Tailwind). On click, filter the `data` array by date and re-render with updated `scaleTime` domain.
- Optionally add `d3.brushX()` on the chart area for drag-to-zoom. Double-click resets to full range.
- Data is already passed via the `data-history` JSON attribute -- no data pipeline changes required.

**Key D3 sub-packages used (all included in d3 ^7.9.0):**

| Sub-Package | Purpose | Already Used in Codebase? |
|-------------|---------|--------------------------|
| d3-brush | `brushX()` for drag-to-zoom on time axis | No -- new usage |
| d3-scale | `scaleTime()`, `scaleLinear()` for re-scoping axes | Yes (TrendChart, compare) |
| d3-shape | `line()`, `area()` generators | Yes (TrendChart, compare) |
| d3-time-format | `timeFormat()` for axis labels | Yes (TrendChart, compare) |
| d3-transition | Smooth animated axis/line transitions on scope change | Available, not yet used explicitly |
| d3-selection | DOM manipulation for re-rendering | Yes (SafetyMap, compare) |

**What NOT to add:**
- Do NOT add Chart.js, Recharts, Plotly, or any charting wrapper library. D3 is already used throughout; a second charting library creates inconsistency and adds bundle weight.
- Do NOT use `d3-zoom` for chart zoom. `d3-zoom` is for pan/zoom on a 2D canvas (already used on the map). For time-series, `d3-brush` on the x-axis is the correct UX pattern.

### 2. Category Filtering for Map and Charts

**New libraries needed: NONE**

**What's needed:** UI controls to select a specific pillar (conflict, crime, health, governance, environment) and re-render the map coloring and chart bars to show that pillar's score instead of the composite score.

**Why existing stack is sufficient:**
- `/scores.json` (fetched client-side by SafetyMap) already contains pillar data per country. Each country entry has a `pillars` array with `{name, score}` objects.
- `pillarToColor()` in `src/lib/colors.ts` already maps 0-1 pillar scores to the color scale.
- The SafetyMap's D3 selections (`g.selectAll('.country-path')`) support `.attr('fill', ...)` updates -- re-coloring on filter change is a D3 transition, not a re-render.

**Implementation approach:**
- Add a filter bar component (row of toggle buttons or segmented control) above the map and chart sections.
- On filter change for the map: iterate existing D3 path selections and re-color using `pillars[selectedPillar].score` instead of `country.score`. Use `d3.transition()` for a smooth color change.
- On filter change for comparison pillar bars: highlight/isolate the selected pillar.
- Filter state persisted in URL query params (e.g., `?pillar=health`) for shareability.

**Critical data limitation:** `history-index.json` stores only composite scores (`{date, score}`), not per-pillar history. Per-pillar historical trends are explicitly out of scope for v1.2 (PROJECT.md: "Per-pillar historical trends in comparison -- needs pipeline schema change"). Category filtering on trend charts is limited to current-snapshot displays (bar charts, map coloring), NOT historical trend lines by pillar.

### 3. Spanish Language Support

**New libraries needed: NONE**

**Why the custom i18n system is sufficient:**
- The i18n system (`src/i18n/ui.ts`) is a flat key-value map per locale with type-safe keys. Adding Spanish = adding an `es` entry to three objects: `languages`, `ui`, and `routes`.
- `useTranslations()` already falls back to `defaultLang` (English) for missing keys, enabling incremental rollout.
- Astro's built-in i18n routing (`astro.config.mjs`) already supports a `locales` array -- append `'es'`.

**Changes required:**

1. **`src/i18n/ui.ts`:**
   - Add `es: 'Espanol'` to `languages` object.
   - Add full `es` translation block to `ui` object (~165 keys, modeled on existing `it` block).
   - Add `es` route slugs to `routes` object: `{ country: 'pais', about: 'acerca-de', methodology: 'metodologia', legal: 'aviso-legal', 'global-safety': 'seguridad-global', compare: 'comparar' }`.

2. **`astro.config.mjs`:**
   - Add `'es'` to `i18n.locales` array.
   - Add `es: 'es'` to `sitemap.i18n.locales` object.

3. **Page files:**
   - Create `src/pages/es/` directory mirroring `src/pages/it/` structure.
   - Each page is a copy with `lang` constant changed to `'es'`.
   - Spanish route slugs for directories (e.g., `src/pages/es/pais/[slug].astro`).

4. **Client-side locale detection:**
   - The tooltip date formatting in TrendChart and compare uses `document.documentElement.lang`. Current code has a ternary (`lang === 'it' ? 'it-IT' : 'en-US'`). This needs updating to a locale map: `{ en: 'en-US', it: 'it-IT', es: 'es-ES' }`.
   - Native `Date.toLocaleDateString('es-ES', ...)` handles Spanish date formatting -- no library needed.

**What NOT to add:**
- Do NOT add `i18next`, `astro-i18n-aut`, `@paraglide/astro`, or any i18n library. The custom system is simple, fully type-safe, and works well for ~165 keys across 3 locales. An external library would add complexity and runtime overhead for no benefit at this scale.
- Do NOT add machine translation. Translations for a travel safety site must be human-reviewed for accuracy and tone.

### 4. Parameter Explanation Pages

**New libraries needed: NONE**

**What's needed:** Static content pages explaining each safety pillar in depth -- what indicators feed into it, how they're weighted, what they mean for travelers.

**Why pure Astro pages are sufficient:**
- These are informational content pages, identical in nature to the existing methodology page (`src/pages/en/methodology/index.astro`).
- No dynamic data beyond what's already in the scoring engine configuration.
- No client-side interactivity needed.

**Implementation approach:**
- Create either `src/pages/en/methodology/[pillar].astro` (dynamic route) or individual pages per pillar (5 pages).
- Add new i18n keys for pillar explanation content (titles, descriptions, indicator explanations).
- Link from the country detail page's pillar breakdown section and from the methodology overview page.
- Add route slugs for each pillar in all 3 locales.

### 5. Fix Comparison Page Country Search on Web

**New libraries needed: NONE**

This is a bug fix in the existing Fuse.js-powered search in `compare.astro`. The search selector, dropdown, and event handling are all vanilla JS in the page's `<script>` block. The fix is code-level, not stack-level.

## Recommended Stack Additions

### New Dependencies: NONE

### New Dev Dependencies: NONE

No new npm packages are needed for v1.2. Every feature builds on existing installed packages.

## What NOT to Add (Anti-Dependencies)

| Temptation | Why Avoid |
|------------|-----------|
| Chart.js / Recharts / Nivo / Plotly | D3 is already installed and handles all charting. Adding a wrapper creates two paradigms and adds bundle size. |
| @astrojs/react or @astrojs/preact | Overkill for filter UI. Would add framework runtime to a currently zero-JS-framework site. |
| i18next / astro-i18n-aut / paraglide | Overkill for 3 locales with ~165 keys. Custom system is type-safe and zero-overhead. |
| date-fns / moment / luxon | D3's `timeFormat` + native `Intl.DateTimeFormat` + `Date.toLocaleDateString()` cover all date formatting. |
| Zustand / Nanostores / any state management | Vanilla JS + data attributes + URL params handle filter/scope state. No SPA patterns needed. |
| Observable Plot | Built on D3 but adds abstraction that constrains more than helps for this codebase's established patterns. |

## Configuration Changes Required

### astro.config.mjs

```javascript
i18n: {
  defaultLocale: 'en',
  locales: ['en', 'it', 'es'],  // ADD 'es'
  routing: {
    prefixDefaultLocale: true,
  },
},

// Sitemap integration update:
sitemap({
  i18n: {
    defaultLocale: 'en',
    locales: {
      en: 'en',
      it: 'it',
      es: 'es',  // ADD
    },
  },
}),
```

### src/i18n/ui.ts (type-level changes)

```typescript
export const languages = {
  en: 'English',
  it: 'Italiano',
  es: 'Espanol',  // ADD
} as const;
```

No structural changes to the `useTranslations()` function or `getLangFromUrl()` -- they already handle any key in the `languages` object.

## Bundle Size Impact

| Feature | Client JS Impact |
|---------|-----------------|
| Chart zoom/scope | ~0 KB additional (d3-brush already in d3 bundle, already shipped on interactive pages) |
| Category filtering | ~0.5 KB (filter UI event handlers + state management) |
| Spanish i18n | ~0 KB client-side (translations are in build-time Astro templates; only tooltip locale string changes) |
| Parameter explanation pages | 0 KB (static HTML pages, no client JS) |

Total additional client-side JavaScript: negligible. The D3 bundle is already the largest client-side asset and does not grow.

## Confidence Assessment

| Decision | Confidence | Basis |
|----------|------------|-------|
| No new charting library needed | HIGH | Verified d3 ^7.9.0 includes d3-brush; codebase already uses D3 client-side |
| d3-brush for chart scope/zoom | HIGH | Standard D3 time-series pattern; d3-brush is part of d3 monorepo |
| Category filter = re-color existing map selections | HIGH | Examined SafetyMap.astro; pillar data in scores.json confirmed |
| No i18n library needed | HIGH | Examined ui.ts; adding locale is mechanical key-value addition |
| history-index lacks per-pillar data | HIGH | Examined HistoryIndex type in scores.ts; only composite score stored |
| TrendChart must move to client-side for zoom | HIGH | Current build-time SVG cannot respond to user interactions; compare.astro proves the client-side D3 pattern works |
| Spanish page structure is mechanical | HIGH | Examined it/ directory; identical copy pattern with lang constant change |

## Sources

- Codebase analysis: `package.json`, `astro.config.mjs`, `src/i18n/ui.ts`, `src/i18n/utils.ts`
- Chart components: `src/components/country/TrendChart.astro`, `src/pages/en/compare.astro`
- Map component: `src/components/SafetyMap.astro`
- Data utilities: `src/lib/scores.ts`, `src/lib/colors.ts`
- D3 v7 brush module: included in `d3` ^7.9.0 full bundle (no separate install needed)
- Astro i18n routing: built-in configuration in `astro.config.mjs`, verified in codebase
