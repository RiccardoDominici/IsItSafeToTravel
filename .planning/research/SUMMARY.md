# Project Research Summary

**Project:** IsItSafeToTravel.com v1.2
**Domain:** Travel safety data visualization platform — incremental enhancement milestone
**Researched:** 2026-03-20
**Confidence:** HIGH

## Executive Summary

IsItSafeToTravel.com v1.2 is an incremental enhancement milestone on top of a well-structured Astro 6 SSG + D3.js platform already deployed to Cloudflare Pages. The research confirms that every planned feature — interactive chart zoom/scope controls, per-category map filtering, Spanish i18n, parameter explanations, and bug fixes — can be delivered without adding any new npm dependencies. The existing stack (D3 ^7.9.0 including d3-brush, Astro's built-in i18n routing, native Intl APIs, and Fuse.js) is fully sufficient. The key recommendation is to treat this as careful incremental engineering rather than greenfield work: all five features extend existing components and patterns rather than introducing new architectural paradigms.

The central architectural decision in v1.2 is moving `TrendChart.astro` from build-time SVG rendering to client-side D3 rendering. This is required to support interactive scope controls and is the most significant refactor in the milestone. The comparison page already demonstrates the correct client-side D3 pattern, so this is a matter of migrating to a proven approach, not pioneering new ground. The second significant change is extending `scores.json` to include per-pillar scores — a lightweight addition (~30KB) that unlocks category filtering on the map without touching the broader data pipeline.

The primary risk is the Spanish i18n feature, which is architecturally trivial at the presentation layer but cascades through the data layer: `CountryEntry.name` is currently typed as `{ en: string; it: string }`, and adding `es` requires updating `pipeline/types.ts`, all 248 entries in `countries.ts`, test fixtures, and `scores.json` generation. The mitigation is to execute this in strict type-first order (update the type to `Record<Lang, string>` before touching any data), and to generate Spanish country names programmatically from reference data rather than entering 248 entries manually.

## Key Findings

### Recommended Stack

The existing stack is locked and no additions are needed. D3 ^7.9.0 already includes `d3-brush` for drag-to-zoom and `d3-transition` for animated state changes. Astro's built-in i18n routing already supports adding `'es'` to the locales array. The custom TypeScript dictionary in `src/i18n/ui.ts` scales cleanly to a third language without any external i18n library.

**Core technologies:**
- **Astro 6 (SSG):** Framework and i18n routing — already handles multi-language static generation; adding `es` is a config-level change
- **D3 ^7.9.0:** All charting and map rendering — full bundle already installed; `d3-brush` available for zoom at zero additional cost
- **Tailwind CSS ^4.2.2:** Styling — filter/scope control UI uses standard Tailwind classes
- **Fuse.js ^7.1.0:** Client-side fuzzy search on comparison page — bug fix target, no upgrade needed
- **TypeScript ^5.9.3:** Type safety — i18n key checking across all languages enforced at compile time
- **Cloudflare Pages:** Hosting — purely static deployment; no SSR mode needed for any v1.2 feature

**Do not add:** Chart.js/Recharts/Plotly, React/Preact, i18next/paraglide, date-fns/moment, Zustand/Nanostores, or Observable Plot. Each would add bundle weight, runtime overhead, or architectural inconsistency for zero benefit.

### Expected Features

**Must have (table stakes):**
- **Comparison page search fix** — core functionality is currently broken on web; blocks user ability to compare countries
- **Chart date axis fix** — incorrect axis dates undermine data trust; non-negotiable for a data accuracy platform
- **Chart time-range controls (7d/30d/90d/All)** — 60+ data points compress into an unreadable default view; universal expectation for time-series dashboards
- **Parameter/pillar explanations** — "Governance: 3.2/10" is meaningless without context; users cannot act on scores they do not understand
- **Spanish language support** — third most-spoken language globally; massive traveler demographic; i18n architecture already supports it

**Should have (differentiators):**
- **Category filtering on map** — view world colored by single pillar (Health, Conflict, etc.); unique analytical lens not offered by competitors at this granularity
- **Animated D3 transitions** — smooth color/axis transitions when switching scope or category; polish that signals quality

**Defer to v1.3:**
- Per-pillar historical trends — `history-index.json` stores only composite scores; requires pipeline schema migration to store 5 pillar scores per country per day
- Category filtering on historical trend charts — blocked by same data limitation as above
- User-adjustable pillar weights — creates spreadsheet experience; undermines the platform's opinionated safety answer

### Architecture Approach

The platform uses two established rendering strategies: build-time SVG with thin client-side tooltip scripts (country detail pages), and full client-side D3 rendering using data serialized into `data-*` attributes (map, comparison page). The v1.2 migration aligns the country trend chart with the second strategy, and introduces two new interaction patterns: static HTML controls wired to JS event listeners (scope buttons, category filter buttons), and native `<details>/<summary>` for zero-JS expand/collapse (pillar explanations). All state is managed in page-scoped vanilla JS using URL query params for shareability; no state management library is needed.

**Major components changed in v1.2:**
1. **`TrendChart.astro`** — major rewrite: D3 rendering moves from Astro frontmatter to client-side `<script>`; scope buttons added as static HTML
2. **`SafetyMap.astro`** — add pillar filter bar and recolor logic; tooltip and legend updated dynamically
3. **`PillarBreakdown.astro`** — add `<details>/<summary>` expandable explanations per pillar
4. **`src/i18n/ui.ts`** — add ~208 new strings total: ~170 for Spanish + ~38 for new feature keys (chart scope, map filter, pillar explanations)
5. **`public/scores.json` generation** — extend with pillar scores and Spanish country names
6. **`src/pipeline/types.ts`** — extend `name` type from `{ en, it }` to `Record<Lang, string>`
7. **`src/pages/es/`** — create 8-10 page files mirroring `en/` directory structure

### Critical Pitfalls

1. **Spanish i18n cascades through the data pipeline** — `CountryEntry.name` is typed as `{ en: string; it: string }` not `Record<Lang, string>`. Every one of the 248 country entries in `countries.ts` has only `en` and `it` fields. Test fixtures will also fail. Prevention: update the type first, generate 248 Spanish country names programmatically from CLDR data, then add data, then create page files.

2. **Category filter requires pillar data the map client does not have** — `scores.json` currently has only composite score; loading full `latest.json` (~656KB) would destroy mobile performance. Prevention: extend `scores.json` generation to include 5 pillar floats per country (~30KB addition). Use `pillarToColor()` from `colors.ts` (0-1 scale) not `safetyColorScale()` (1-10 scale) for pillar mode — the wrong scale produces uniform dark red for all countries.

3. **TrendChart.astro cannot support interactive controls in its current form** — SVG is generated at build time; adding scope controls while leaving server-rendered SVG creates dual rendering paths causing flash/jank. Prevention: move all D3 rendering to the `<script>` block following the established pattern in `compare.astro`. Embed full history data in `data-history` attribute and filter client-side.

4. **View transitions break chart re-initialization** — map already handles `astro:after-swap`; `TrendChart.astro` tooltip script does not. After the client-side refactor, all chart init code must register `document.addEventListener('astro:after-swap', initChart)`.

5. **Comparison page search bug is a setTimeout blur race condition** — `compare.astro` uses `setTimeout(() => dropdown.classList.add('hidden'), 200)` to allow click registration before hiding; fragile on mobile and slow devices. Prevention: replace with `mousedown` + `e.preventDefault()` to prevent input blur before selection registers.

## Implications for Roadmap

Based on combined research, the features fall into a natural dependency order. Bug fixes have no dependencies. Pillar explanations and Spanish i18n are independent of each other and of the interactivity features. Chart zoom requires the TrendChart refactor. Category filtering depends on `scores.json` expansion but not on chart zoom. Spanish i18n is the highest-effort feature and is independent of all others, making it a candidate for parallel work.

### Phase 1: Bug Fixes
**Rationale:** No dependencies; these are regressions that block existing functionality. Fix first to establish a clean baseline before adding new complexity.
**Delivers:** Functional comparison page search on web; correct date axis labels on trend charts
**Addresses:** Comparison search fix (table stakes), chart date axis fix (table stakes)
**Avoids:** Pitfall 5 (blur race condition) — use `mousedown` preventDefault pattern; Pitfall 6 (locale date inconsistency) — standardize on `toLocaleDateString()` with explicit locale parameter

### Phase 2: Chart Interactivity
**Rationale:** The TrendChart refactor from build-time to client-side rendering is the most architecturally significant change in v1.2 and should be completed before touching the map, which has higher traffic and more interdependencies. The comparison page chart is already client-side and only needs a date filter layer added.
**Delivers:** Interactive time-range scope controls (7d/30d/90d/All) on country trend charts and comparison charts; smooth D3 transitions between states
**Addresses:** Chart zoom/scope controls (table stakes + differentiator)
**Avoids:** Pitfall 3 (server-rendered SVG cannot re-render client-side); Pitfall 9 (view transitions — add `astro:after-swap` listeners to all init code)
**Research flag:** Standard D3 pattern; no deeper research needed. `compare.astro` lines 405-549 provide the reference implementation.

### Phase 3: Parameter Explanations
**Rationale:** Independent of all other features; uses existing `PillarScore.indicators[]` data already available in the page at build time; low risk; fills the critical user comprehension gap that limits the value of every other feature on the platform.
**Delivers:** Expandable `<details>/<summary>` sections on each pillar bar explaining what it measures, which indicators feed into it, and what a low/high score means for travelers
**Addresses:** Parameter/pillar explanations (table stakes)
**Avoids:** Pitfall 7 (content volume overwhelming `ui.ts`) — limit to 1-2 sentences per pillar; write English first, then translate; consider Astro content collections only if content grows beyond manageable i18n key size

### Phase 4: Category Filtering on Map
**Rationale:** Requires a `scores.json` schema change that touches the build pipeline. Doing this after chart work reduces concurrent complexity and benefits from validated client-side interaction patterns. The map is the highest-traffic component and warrants focused, isolated testing.
**Delivers:** Segmented control above the map to view world colored by a single pillar; tooltip and legend update dynamically; URL query param persistence for shareability
**Addresses:** Category filtering on map (differentiator)
**Avoids:** Pitfall 2 (wrong data source — extend `scores.json`, not load `latest.json`); Pitfall 2 (wrong color scale — use `pillarToColor()` not `safetyColorScale()`); Pitfall 8 (color semantics shift per pillar — add dynamic legend text); Pitfall 11 (per-pillar trend charts are not feasible — accept limitation and show clear UI messaging)

### Phase 5: Spanish Language Support
**Rationale:** Highest-effort feature; completely independent of all other v1.2 features. Can be parallelized against Phases 2-4 if team capacity allows, or sequenced last. The type-first execution order is critical: updating `CountryEntry.name` to `Record<Lang, string>` must happen before any data additions or page file creation.
**Delivers:** Full Spanish locale at `/es/` with translated UI strings (~170 keys), Spanish country names for all 248 countries, Spanish URL slugs (`/es/pais/`, `/es/comparar/`, etc.), and Spanish map tooltips
**Addresses:** Spanish language support (table stakes)
**Avoids:** Pitfall 1 (type cascade — update `pipeline/types.ts` type first, generate names programmatically from CLDR); Pitfall 4 (page directory completeness — create all 8-10 page files under `src/pages/es/`, verify language switcher shows ES option, verify `getAlternateLinks()` returns 3 entries)

### Phase Ordering Rationale

- Bug fixes come first because they unblock existing functionality and establish a clean baseline
- Chart interactivity comes second because the TrendChart refactor is the highest architectural risk and should be isolated from other changes
- Pillar explanations come third because they are independent, low-risk, and improve comprehension of data the platform already shows
- Category filtering comes fourth because it requires a pipeline data change and benefits from experience with the client-side patterns established in Phase 2
- Spanish comes last in sequence (or in parallel) because it is the highest effort, is independent of all other features, and its execution order within itself is the only real risk

### Research Flags

All phases use standard, well-documented patterns. No phase requires a `/gsd:research-phase` deep dive.

Phases with well-established patterns (skip research-phase):
- **Phase 1 (Bug Fixes):** Root cause identified in source code; `mousedown` preventDefault is a known pattern
- **Phase 2 (Chart Interactivity):** `compare.astro` provides the reference implementation; D3 brushX is standard time-series zoom
- **Phase 3 (Parameter Explanations):** Native HTML `<details>/<summary>`; content authoring work, not engineering research
- **Phase 4 (Category Filtering):** D3 `.selectAll().attr()` recolor with transition is textbook D3; data schema change is additive
- **Phase 5 (Spanish i18n):** Architecture was designed for this; execution is mechanical given type-first order

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All decisions based on direct `package.json` and source file analysis; no inference or speculation |
| Features | HIGH | Scoped against PROJECT.md; all features examined in actual component source files |
| Architecture | HIGH | All patterns derived from direct codebase analysis with line numbers cited in ARCHITECTURE.md |
| Pitfalls | HIGH | Root causes identified in actual source files (line-level); not speculative |

**Overall confidence:** HIGH

### Gaps to Address

- **Spanish country name sourcing:** Research confirms CLDR as the correct source for 248 Spanish country names, but the actual generation approach is not yet decided. During Phase 5 planning, determine whether to write a one-off conversion script or use a small reference package like `i18n-iso-countries` for the initial import.
- **`scores.json` generation location:** Research identifies that pillar scores should be added at the pipeline snapshot step, but the exact script and function that currently generates `scores.json` needs confirmation during Phase 4 planning before making changes.
- **Astro View Transitions status:** Research flags that TrendChart needs `astro:after-swap` handling, but whether the Astro Client Router is currently enabled in `Base.astro` was not confirmed in the research files. Verify at the start of Phase 2.

## Sources

### Primary (HIGH confidence — direct source file analysis)
- `src/components/country/TrendChart.astro` — chart rendering pattern, data-history attribute, tooltip script structure
- `src/components/SafetyMap.astro` — map fetch pattern, D3 selection recolor pattern, `astro:after-swap` handling
- `src/pages/en/compare.astro` — client-side chart reference implementation (lines 405-549), Fuse.js search, blur handler at line 255
- `src/i18n/ui.ts` — 325-line translation dictionary; `languages` map with `en`/`it`; key structure and `useTranslations()` pattern
- `src/i18n/utils.ts` — `getLocalizedPath()`, `getAlternateLinks()`, `getLangFromUrl()` confirmed fully generic
- `src/pipeline/types.ts` — `CountryEntry.name: { en: string; it: string }` hardcoded type confirmed
- `src/pipeline/config/countries.ts` — 248 country entries, each with `{ en, it }` name shape confirmed
- `src/lib/scores.ts` — `HistoryPoint` type confirming absence of per-pillar history
- `src/lib/colors.ts` — `pillarToColor()` (0-1 input) vs `safetyColorScale()` (1-10 input) distinction confirmed
- `package.json` — d3 ^7.9.0 confirmed (includes d3-brush); no second charting library present
- `astro.config.mjs` — i18n locales config confirmed; sitemap integration structure confirmed

### Secondary (HIGH confidence — well-established patterns)
- D3 v7 `d3-brush` module: standard time-series brush-to-zoom pattern; confirmed in d3 monorepo as part of full `d3` bundle
- Astro 6 i18n routing: built-in locales config; adding `'es'` is additive and non-breaking per Astro documentation
- HTML `<details>/<summary>`: W3C specification; zero-JS accessible expand/collapse
- Time-range preset patterns (7d/30d/90d/All): established UX convention on Google Finance, Our World in Data, and similar platforms

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
