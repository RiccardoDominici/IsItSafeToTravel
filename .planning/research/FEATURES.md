# Feature Landscape

**Domain:** Travel safety data visualization platform (v1.2 enhancement milestone)
**Researched:** 2026-03-20
**Focus:** v1.2 milestone -- interactive chart controls, category filtering, Spanish i18n, parameter explanations, bug fixes
**Confidence:** HIGH

## Existing Infrastructure (relevant to v1.2 features)

| Asset | Location | How v1.2 Uses It |
|-------|----------|-------------------|
| `TrendChart.astro` | `src/components/country/` | Build-time D3 SVG with client-side tooltip; needs zoom/scope controls added |
| `SafetyMap.astro` | `src/components/` | Client-side D3 map colored by composite score; needs pillar filter overlay |
| `compare.astro` (en/it) | `src/pages/en/`, `src/pages/it/` | Client-side Fuse.js search + D3 charts; search bug to fix |
| `PillarBreakdown.astro` | `src/components/country/` | Static bar chart of 5 pillars; needs expandable explanations |
| `i18n/ui.ts` | `src/i18n/` | EN + IT with ~170 keys each, `routes` for URL slugs; add ES language |
| `scores.json` | Built at deploy | Currently has `iso3`, `name`, `score` per country; needs pillar scores for map filter |
| `history-index.json` | `data/scores/` | Composite score per country per day; does NOT store per-pillar history |
| `ScoredCountry.pillars` | `src/pipeline/types.ts` | Full pillar data (name, score, weight, indicators, dataCompleteness) available at build time |
| `safetyColorScale()` | `src/lib/map-utils.ts` | Color mapping function; reusable for pillar-specific map coloring |

## Table Stakes

Features users expect given the existing v1.1 platform. Missing = feels unfinished or broken.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Comparison search fix on web** | Core comparison page functionality is broken; users cannot add countries | Low | `compare.astro` client-side Fuse.js selector | Bug fix, not a feature. Likely event handler or DOM query issue in the selector script. |
| **Date axis fix for trend charts** | Incorrect dates on chart axes undermine data trust; temporal accuracy is non-negotiable | Low | `TrendChart.astro` x-axis tick generation, D3 timeFormat | Likely build-time D3 date formatting or timezone handling issue |
| **Chart time-range controls** | Any multi-month trend chart needs date scoping; 60+ data points compress into an unreadable default view | Medium | TrendChart.astro (refactor to client-side rendering), comparison chart | Standard pattern: button bar with 7d/30d/90d/All presets |
| **Parameter/pillar explanations** | "Governance: 3.2/10" is meaningless without context; users need to know what each pillar measures and what a low score means for travelers | Medium | PillarBreakdown.astro, i18n strings (~15 new keys), client-side expand/collapse JS | Expandable rows preferred over tooltips (mobile-friendly, no hover dependency) |
| **Spanish language support** | Third most-spoken language globally; massive traveler demographic; i18n architecture already supports expansion cleanly | Medium-High | i18n/ui.ts, route pages under /es/, pipeline country names, scores.json name field | ~170 translation keys + page duplication + country name data |

## Differentiators

Features that elevate beyond the current safety dashboard. Not expected, but valued by engaged users.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Category filtering on map** | View the world colored by a single pillar (Health, Conflict, etc.) instead of total score; unique lens no competitor offers at this granularity | Medium-High | scores.json expansion (add pillar scores), SafetyMap.astro (add selector + recolor logic) | Requires ~5 extra numbers per country in scores.json (~1.2KB increase for 248 countries); UI is a segmented control or dropdown |
| **Chart time-range presets (7d/30d/90d/All)** | Quick-scope buttons are universal UX for time-series dashboards; reduces cognitive load | Low | Already-loaded chart data array, client-side date filter | Pure client-side filter; no data fetching needed |
| **Animated transitions between chart states** | Smooth D3 transitions when switching time range or category | Low | D3 transition API (already available) | Polish feature; 2-3 lines of code per transition |
| **Category filter on comparison pillar bars** | Highlight or isolate a single pillar across all compared countries; enhances the comparison page's analytical depth | Low | Existing comparison pillar bars component | Client-side CSS toggle; pillar data already present |

## Anti-Features

Features to explicitly NOT build in v1.2.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Per-pillar historical trends** | PROJECT.md explicitly marks this out of scope; `history-index.json` only stores composite scores; needs pipeline schema migration to store 5 pillar scores per country per day | Defer to v1.3+; document as pipeline prerequisite in PITFALLS.md |
| **Category filtering on historical trend charts** | Same blocker as above -- no per-pillar history data exists | Limit category filter to: (1) map coloring, (2) current-day pillar bars, (3) comparison view |
| **Heavy chart library (Recharts, Chart.js, Highcharts)** | Project uses D3 sub-packages with build-time SVG; adding a chart framework increases bundle by 50-250KB, creates two charting paradigms, and breaks SSG pattern | Continue with D3 sub-packages; add interactivity via client-side scripts on existing SVG |
| **Pinch-to-zoom on mobile charts** | SVG charts in viewBox already scale responsively; pinch-to-zoom on embedded SVG conflicts with page scroll and creates confusing UX | Use tap-to-scope and button controls instead |
| **Full CLDR locale system** | Over-engineering for 3 languages; `toLocaleDateString()` with locale codes already covers date/number formatting | Use browser Intl APIs as already done; manual translation for UI strings |
| **Pre-built SEO pages per category** | 248 countries x 5 pillars = 1,240 extra pages for marginal SEO value | Keep category views as client-side filter on existing pages |
| **User-adjustable pillar weights** | Creates spreadsheet experience instead of safety answer; users don't know how to weight conflict vs health | Show pillar breakdown for transparency; keep composite score opinionated |
| **Drag-to-zoom on chart** | High implementation complexity with D3 brush on SVG viewBox; button presets cover 95% of use cases | Use preset buttons (7d/30d/90d/All) with optional keyboard arrows for fine control |

## Feature Dependencies

```
Bug fixes (no dependencies, do first):
    Comparison search fix on web
    Chart date axis fix

Chart zoom/scope controls
    |
    +--> TrendChart.astro: refactor from build-time-only SVG to
    |    client-side re-renderable (pass full data via data attribute,
    |    JS regenerates SVG paths when time range changes)
    +--> Comparison trend chart: already client-side rendered,
    |    just add filter before lineGen()
    +--> Time range preset buttons (7d/30d/90d/All)

Category filtering on map
    |
    +--> scores.json: extend build step to include pillar scores per country
    |    (data exists in ScoredCountry.pillars, just not serialized to client)
    +--> SafetyMap.astro: add segmented control UI
    +--> SafetyMap.astro: recolor paths using selected pillar's 0-1 score
    +--> Tooltip + legend: update to show selected pillar name/score

Parameter/pillar explanations
    |
    +--> i18n: add explanation strings per pillar (~5 keys x 3 languages)
    +--> PillarBreakdown.astro: add expandable/tooltip UI with client-side toggle
    +--> Cross-link to methodology page for deeper detail

Spanish language support
    |
    +--> i18n/ui.ts: add 'es' to languages, ~170 translation keys, route slugs
    +--> Pipeline: add 'es' to CountryEntry.name type + country name data
    +--> Pages: duplicate en/ page tree as es/ (8-10 page files)
    +--> scores.json: include name.es for map tooltips
    +--> LanguageSwitcher.astro: automatically picks up new language (generic)
    +--> ScoredCountry type: extend name from {en, it} to {en, it, es}
```

## Detailed Feature Analysis

### 1. Chart Zoom/Scope Controls

**What users expect:** Time-series dashboards universally provide date range controls. The standard pattern is a button bar with presets (7d, 30d, 90d, All). Google Finance, Our World in Data, and similar platforms all use this. As the platform accumulates daily data (currently ~1 day since v1.0 launch), charts with 90+ points will become unreadable without scoping.

**Current state:** `TrendChart.astro` generates SVG at build time via D3 in the Astro frontmatter, then adds tooltip interactivity via a `<script>` tag. The chart data is already passed to the client via `data-history` as JSON.

**Implementation approach:**
- The data is already client-side accessible via `data-history` attribute
- Add a button bar above the chart: "7d | 30d | 90d | All"
- On button click, filter the `chartPoints` array by date, then regenerate the SVG paths (pathD, areaD), axis ticks, and endpoint
- This means the `<script>` section needs to take over full chart rendering (not just tooltips), reading data from the data attribute and building SVG elements
- The comparison page chart is already fully client-side, so scope controls there are a straightforward data filter before `lineGen()`
- Both charts should share the same time-range preset component

**Complexity:** Medium. The country detail TrendChart needs refactoring from build-time SVG to client-side rendered SVG. The comparison chart only needs a filter layer.

### 2. Category Filtering on Map

**What users expect:** The "lens" pattern -- switching a visualization's data dimension while keeping the same geographic layout. Used by INFORM Risk Index (switch between hazard, vulnerability, coping capacity), Numbeo (different indices on same map), and similar platforms.

**Current state:** `SafetyMap.astro` loads `scores.json` at runtime, builds a `scoreMap` (iso3 -> composite score), and colors countries via `safetyColorScale()`. The JSON currently contains only composite score per country.

**Implementation approach:**
1. Extend `scores.json` generation to include pillar scores: `{ iso3, name, score, pillars: { conflict: 0.72, crime: 0.45, ... } }`
2. Add a segmented control or dropdown above/below the map: "Total | Conflict | Crime | Health | Governance | Environment"
3. On selection change, update the `scoreMap` to use the selected pillar's score instead of composite
4. Re-color all paths: `g.selectAll('.country-path').attr('fill', d => safetyColorScale(newScoreMap.get(iso3)))`
5. Update tooltip to show selected pillar name and score
6. Update legend label

**Data size impact:** Adding 5 pillar floats per country = ~1.2KB extra (248 countries x 5 x ~1 byte compressed). Negligible.

**Note:** Pillar scores are 0-1 internally but displayed as x10 (0-10). The `safetyColorScale` expects 1-10 range, so map the pillar 0-1 score to 1-10 for consistent coloring.

**Complexity:** Medium-High. The UI is simple, but touches multiple systems: data serialization, map coloring, tooltip, legend, and i18n for pillar names.

### 3. Parameter/Pillar Explanations

**What users expect:** When a score breakdown shows "Governance: 3.2/10," users need to know what it actually measures. Standard patterns:
- **Expandable rows** (recommended): tap/click pillar bar to expand description. Mobile-friendly, no hover dependency.
- Info tooltips with (i) icon: hover/tap for popover. Problematic on mobile.
- Inline descriptions: always visible, clutters the view.

**Content per pillar (already documented in methodology page, reuse/condense):**
- **Conflict (25%):** Measures armed conflict activity, peacefulness, and political violence. Sources: ACLED events/fatalities, GPI peace scores. Low score = active conflict or high political violence risk.
- **Crime (20%):** Measures personal safety and security risk. Sources: GPI safety & security, US/UK government advisory levels. Low score = elevated crime or safety concerns.
- **Health (20%):** Measures health infrastructure and epidemic preparedness. Sources: INFORM health/epidemic risk, child mortality data. Low score = limited health systems or disease risk.
- **Governance (20%):** Measures institutional stability, rule of law, and corruption. Sources: World Bank governance indicators, INFORM governance index. Low score = weak institutions or high corruption.
- **Environment (15%):** Measures natural hazard and climate risk. Sources: INFORM natural/climate risk, air pollution (PM2.5). Low score = elevated disaster or environmental health risk.

**Implementation:** Add `country.pillar.explain.conflict` through `country.pillar.explain.environment` to i18n (5 keys x 3 languages = 15 keys). In PillarBreakdown.astro, wrap each bar row in a clickable container; add a hidden `<div>` with explanation text that toggles on click via a small client-side script (8-10 lines).

**Complexity:** Medium. Mostly content and i18n work. Small client-side toggle script.

### 4. Spanish Language Support

**What exists:** The i18n system is clean and generic. `languages` in ui.ts defines available languages, `ui` maps keys per language, `routes` defines URL slugs per language, and `useTranslations()` returns a lookup function. The `Lang` type is derived from `languages` keys -- adding `es` automatically types everything.

**Required changes:**
1. `i18n/ui.ts`: Add `es: 'Espanol'` to `languages`
2. `i18n/ui.ts`: Add `es: { ... }` block with ~170 translated keys
3. `i18n/ui.ts`: Add `es: { country: 'pais', methodology: 'metodologia', ... }` to `routes`
4. Page files: Create `src/pages/es/` directory with:
   - `index.astro` (home)
   - `pais/[slug].astro` (country detail)
   - `comparar.astro` (compare)
   - `seguridad-global.astro` (global safety)
   - `metodologia/index.astro` (methodology)
   - `aviso-legal/index.astro` (legal)
5. Pipeline: Extend `CountryEntry.name` from `{en: string; it: string}` to include `es`
6. Country names data: Add Spanish names for 248 countries (available from CLDR/Unicode common locale data)
7. `ScoredCountry.name` type: Add `es` field
8. `scores.json`: Include `name.es` for map tooltip rendering

**Key Spanish terminology:**
- Safety Score = "Puntaje de Seguridad"
- Is it safe to travel? = "Es seguro viajar?"
- Conflict/Crime/Health/Governance/Environment = "Conflicto/Crimen/Salud/Gobernanza/Medio Ambiente"

**Complexity:** Medium-High. Architecturally trivial (system designed for this), but labor-intensive: ~170 keys to translate accurately, 6-8 page files to create, and country name data to source.

### 5. Comparison Search Fix

**Current state:** The comparison page at `/en/compare` uses client-side Fuse.js search in a custom dropdown. The bug manifests as the search not working "on web" (presumably works in dev but not in production build).

**Likely causes (in probability order):**
1. Event listener not re-attached after Astro view transitions (`astro:after-swap` event)
2. DOM element query failing due to timing (script runs before DOM is ready)
3. Fuse.js import not bundling correctly in production build
4. `data-countries` JSON attribute too large or malformed in production

**Fix approach:** Check the comparison page's `<script>` tag for view transition handling (the map already has `document.addEventListener('astro:after-swap', initMap)` but compare.astro does not have an equivalent). Add similar re-initialization.

**Complexity:** Low. Bug diagnosis + small fix.

## Feature Dependencies (Build Order)

```
Phase 1: Bug Fixes (no dependencies, unblock everything)
    1. Comparison search fix
    2. Chart date axis fix

Phase 2: Chart Interactivity (medium effort, high user value)
    3. Chart zoom/scope controls (refactor TrendChart to client-side)
    4. Time range presets (7d/30d/90d/All)

Phase 3: Content Depth (medium effort, fills knowledge gaps)
    5. Parameter/pillar explanations (expandable rows)

Phase 4: Map Enhancement (medium-high effort, differentiator)
    6. Category filtering on map (requires scores.json expansion)

Phase 5: Language Expansion (highest effort, broadens audience)
    7. Spanish language support
```

**Rationale for ordering:**
- Bug fixes first: unblock existing features
- Chart controls second: immediate value for all users, no data schema changes
- Pillar explanations third: independent of other features, fills content gap
- Map filtering fourth: requires data pipeline change (scores.json), higher risk
- Spanish last: highest effort, does not block other features, can be parallelized

## MVP Recommendation for v1.2

**Must have:**
1. Comparison search fix -- Bug, blocking core functionality
2. Chart date axis fix -- Bug, data accuracy
3. Chart zoom/scope controls with time presets -- Core UX improvement
4. Parameter explanations -- Fills the "what does this mean?" gap
5. Category filtering on map -- Key differentiator

**Should have:**
6. Spanish language -- Broadens audience significantly

**Defer to v1.3:**
- Per-pillar historical trends (pipeline schema change required)
- Category filtering on historical charts (same data blocker)
- Animated chart transitions (polish, not essential)

## Complexity Estimates

| Feature | Effort | Key Risk |
|---------|--------|----------|
| Comparison search fix | Small (0.5 day) | Diagnosis time if issue is subtle |
| Chart date axis fix | Small (0.5 day) | May be timezone-related edge case |
| Chart zoom/scope controls | Medium (2-3 days) | TrendChart refactor from build-time to client-side SVG |
| Parameter explanations | Medium (1-2 days) | Content quality + translation for 3 languages |
| Category filtering on map | Medium-High (2-3 days) | scores.json schema change + map recolor logic |
| Spanish language | Medium-High (3-4 days) | ~170 keys translation + page duplication + country names |
| **Total estimate** | **~10-14 days** | |

## Sources

- Codebase analysis: TrendChart.astro (265 lines), SafetyMap.astro (373 lines), compare.astro (566 lines), i18n/ui.ts (346 lines), pipeline/types.ts (101 lines), lib/scores.ts (93 lines)
- PROJECT.md v1.2 scope and out-of-scope declarations
- D3.js scaleTime and zoom patterns (confirmed against existing codebase usage -- HIGH confidence)
- INFORM Risk Index category filter UI pattern (training data, MEDIUM confidence)
- Google Finance / Our World in Data time-range preset patterns (training data, HIGH confidence -- well-established UX pattern)

---
*Feature research for: IsItSafeToTravel.com v1.2 -- Interactive Charts, Category Filtering, Spanish i18n, Parameter Explanations*
*Researched: 2026-03-20*
