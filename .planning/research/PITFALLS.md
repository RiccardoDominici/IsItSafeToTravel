# Domain Pitfalls

**Domain:** Adding interactive chart controls, per-category filtering, Spanish i18n, parameter explanations, and bug fixes to existing Astro SSG + D3 travel safety platform
**Researched:** 2026-03-20
**Confidence:** HIGH (based on direct codebase analysis of all affected files)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Spanish i18n Requires Type-Level Changes Across the Entire Data Pipeline

**What goes wrong:** Adding Spanish is not just "add another translation object to `ui.ts`." The `name` field in `CountryEntry`, `ScoredCountry`, and `DailySnapshot` types is typed as `{ en: string; it: string }` -- a fixed two-language object literal. Every country in `countries.ts` (248 entries) has only `en` and `it` name fields. The pipeline generates `scores.json` and `latest.json` with this same shape. The map reads `c.name?.[lang]` from `scores.json`. If `es` is not in the data, Spanish users see English fallback for country names only (while UI text is Spanish), creating a jarring mixed-language experience.

**Why it happens:** The initial i18n architecture hardcoded language support into the data layer (TypeScript interfaces, pipeline config) rather than keeping it purely in the presentation layer. This is a common pattern when starting with 2 languages -- it seems simpler to inline names than to maintain a separate translation file.

**Consequences:**
- `CountryEntry` type in `pipeline/types.ts` needs `es` added: currently `name: { en: string; it: string }` must become `{ en: string; it: string; es: string }` (or better, `Record<Lang, string>`)
- All 248 entries in `pipeline/config/countries.ts` need a Spanish name field added
- `ScoredCountry` inherits from `CountryEntry`, so pipeline output changes shape
- `scores.json` (loaded client-side by the map) grows with the third language
- Test fixtures in `snapshot.test.ts` and `history.test.ts` create mock countries with `name: { en: ..., it: ... }` and will fail
- If you forget to update the type but add `es` data, TypeScript rejects it
- If you update the type but forget the data, every `name.es` access returns `undefined`

**Prevention:**
- Phase the work: (1) update `CountryEntry` type to `Record<Lang, string>` instead of hardcoded keys, (2) add Spanish names to all 248 countries in `countries.ts`, (3) add `es` to `languages` and `ui` objects in `ui.ts`, (4) create `src/pages/es/` directory with all page files, (5) add Spanish routes to `routes` object
- Make the name type dynamic with `Record<Lang, string>` so future languages do not require type changes
- Generate Spanish country names programmatically from a reference (most are identical or have well-known translations from English/Italian) rather than manually typing 248 entries

**Detection:** TypeScript compilation errors after adding `'es'` to `Lang` type; runtime `undefined` for country names in Spanish locale; map tooltips showing ISO3 codes instead of names.

### Pitfall 2: Category Filtering on Map Requires Data the Client Does Not Currently Have

**What goes wrong:** The map currently fetches `/scores.json` which contains only `iso3`, `name`, and `score` (the composite score). To color the map by individual pillars (conflict, crime, health, governance, environment), the client needs per-pillar scores for every country. This data exists in `latest.json` (full snapshot with pillar breakdowns, advisories, indicators) but is NOT in the lightweight `scores.json`.

**Why it happens:** The map's data contract was intentionally minimal to keep the JSON small and fast. Adding category filtering means either: (a) the map loads the full `latest.json` (~656KB, containing advisory text, indicator breakdowns, source metadata for 248 countries that the map does not need), or (b) `scores.json` is extended to include pillar scores, or (c) a new endpoint is created.

**Consequences:**
- Loading full `latest.json` on the map page adds massive payload and kills mobile performance
- The `safetyColorScale` in `map-utils.ts` maps scores on a 1-10 scale, but pillar scores are 0-1 normalized. Using the wrong scale produces wrong colors (everything appears dark red)
- The map currently has no UI for selecting a category -- this is a new interactive element on an otherwise non-interactive static page
- The color scale semantics change: "safe/danger" for composite score vs per-pillar meaning (e.g., "governance: 0.9" means good governance)

**Prevention:**
- Extend `scores.json` to include pillar scores: `{ iso3, name, score, pillars: { conflict: 0.7, crime: 0.8, ... } }` -- adds ~2KB for 248 countries (5 floats each)
- Reuse `pillarToColor()` from `colors.ts` for pillar-mode coloring (already converts 0-1 to the color scale) instead of `safetyColorScale`
- Update legend text dynamically when a category filter is active (e.g., "Higher" / "Lower" instead of "Safer" / "Less safe")
- Update the `scores.json` generation in the pipeline's snapshot step, not at build time

**Detection:** Map shows uniform or incorrect colors when switching to a category filter; pillar scores render as very dark colors because 0-1 values are fed to a 1-10 scale.

### Pitfall 3: Adding Interactive Chart Controls to Server-Rendered SVG Charts

**What goes wrong:** The current `TrendChart.astro` generates SVG entirely at build time using D3 in the Astro frontmatter (server-side). The only client-side code is tooltip interactivity (mousemove to find nearest point). Adding zoom, date range selection, or scope controls (7d/30d/90d/all) means the chart must be re-rendered with different data ranges, but the SVG paths, axes, and ticks are baked into static HTML at build time. You cannot re-scale axes or change data ranges without rebuilding the entire SVG DOM.

**Why it happens:** The original SSG-first architecture correctly avoided client JS for static content. But interactive controls (zoom, pan, date range) require D3 to operate client-side, not just at build time. The `TrendChart.astro` component would need to shift from "server renders SVG, client adds tooltips" to "server provides data, client renders and re-renders SVG."

**Consequences:**
- If you try to add controls without refactoring, you end up with two rendering paths: server-rendered initial SVG and client-side re-rendered SVG, which causes flash/jank on first interaction
- The chart data is currently embedded as `data-history` JSON attribute -- but it only contains `{ date, score, cx, cy }` with pre-computed SVG coordinates. These coordinates are only valid for the current axis scales and cannot be reused after re-rendering
- The comparison page trend chart (`compare.astro` line ~381) already renders charts fully client-side, creating an inconsistent rendering pattern between pages
- Date range filtering requires access to ALL history points, not just the subset used for the initial render

**Prevention:**
- Pick one pattern. Recommended: move country trend charts to client-side rendering, matching the comparison page's approach. The comparison page already demonstrates the correct pattern (lines 405-549 of `compare.astro`)
- Extract chart rendering into a shared utility function used by both country trend charts and comparison trend charts to avoid duplicating D3 logic
- Embed the FULL history data in `data-history` and filter client-side when scope controls are used, rather than trying to re-fetch from the server
- For the date range controls, implement as simple buttons (7d/30d/90d/All) that filter the data array and call a `renderChart()` function

**Detection:** Chart controls appear but clicking them does nothing (because SVG is static); chart flashes/jumps when toggling between server-rendered and client-rendered states.

## Moderate Pitfalls

### Pitfall 4: Spanish Page Directory Requires 6+ New Files with Translated Route Slugs

**What goes wrong:** Astro's file-based routing means every page at `/en/` and `/it/` needs a corresponding file in `/es/`. Currently there are 6 page files per language: `index.astro`, `country/[slug].astro`, `compare.astro`, `global-safety.astro`, `methodology/index.astro`, `legal/index.astro`. Adding Spanish means creating 6 more files that differ only in the `lang` constant. Missing any one produces a 404 for that Spanish URL.

**Prevention:**
- Create `src/pages/es/` with Spanish-translated route slugs (e.g., `es/pais/[slug].astro`, `es/comparar.astro`, `es/seguridad-global.astro`, `es/metodologia/index.astro`, `es/legal/index.astro`)
- Add routes to the `routes` object in `ui.ts`: `es: { country: 'pais', methodology: 'metodologia', legal: 'legal', 'global-safety': 'seguridad-global', compare: 'comparar' }`
- Copy page files from `en/` and change only `const lang: Lang = 'es'`
- The `LanguageSwitcher.astro` component iterates `Object.keys(languages)`, so adding `es` to `languages` in `ui.ts` automatically shows the Spanish option
- The `getAlternateLinks()` function automatically includes all languages for `<link rel="alternate">` SEO tags

**Detection:** Missing pages return 404 for Spanish URLs; language switcher does not show Spanish option; SEO alternate links incomplete (verify with `getAlternateLinks()` returning 3 entries).

### Pitfall 5: Comparison Page Search Bug Likely Caused by setTimeout Blur Race Condition

**What goes wrong:** The milestone mentions a bug in the comparison page country search "on web." The current search implementation in `compare.astro` (line 255) uses a `blur` handler with `setTimeout(() => dropdown.classList.add('hidden'), 200)` to allow time for dropdown item clicks to register before hiding the dropdown. This 200ms race condition is a classic source of cross-browser bugs -- touch events on mobile fire differently than mouse events, and some browsers process `blur` before the `click` handler can fire.

**Why it happens:** The pattern of "delay hiding the dropdown so clicks can register" is fragile. On slower devices, 200ms may not be enough. On faster devices, the user sees the dropdown flash closed and open. The `blur` event fires when focus leaves the input, which on mobile can happen from touch events, virtual keyboard changes, or scroll.

**Consequences:** Users click/tap a dropdown result and nothing happens (selection does not register). Particularly likely on mobile browsers and when the device is under load.

**Prevention:**
- Replace the `setTimeout` blur hack with `mousedown` event prevention: on dropdown items, use `mousedown` with `e.preventDefault()` to prevent the input blur from firing, then handle selection on `click`
- Alternatively, use `pointerdown` for unified mouse/touch handling
- If adding a category filter dropdown (for map/charts), extract the dropdown pattern into a reusable utility or component rather than duplicating the fragile inline implementation
- Test on actual mobile devices, not just desktop browser dev tools

**Detection:** Dropdown closes before selection registers; search works on desktop but not mobile; intermittent "click does nothing" reports.

### Pitfall 6: Chart Date Formatting Inconsistency Across Three Locales

**What goes wrong:** The current chart code uses two different date formatting approaches: (1) D3's `timeFormat('%b %d')` for axis labels in `TrendChart.astro` (server-side, produces English-only month abbreviations like "Mar 20"), and (2) `toLocaleDateString()` for tooltips (client-side, locale-aware). Adding Spanish means axis labels show English month names ("Mar", "Apr") while tooltips show Spanish ("mar", "abr"). On the comparison page, the same inconsistency exists (line 444 uses `timeFormat` for axes, line 529 uses `toLocaleDateString` for tooltips).

**Why it happens:** D3's `timeFormat` uses a hardcoded English locale by default. The server-side Astro frontmatter runs in Node.js where the default locale is always English regardless of the page language. The client-side tooltip correctly uses the browser locale. Nobody notices the mismatch with English because both produce the same output.

**Prevention:**
- For client-side rendered charts: use `toLocaleDateString()` consistently for both axes and tooltips, passing the correct locale (`es-ES`, `it-IT`, `en-US`)
- For server-side rendered charts (if retained): use D3's `timeFormatLocale()` with locale definitions for Spanish and Italian
- Define a shared date formatting utility that accepts `Lang` and returns consistently formatted dates across all chart components
- Test charts in all 3 languages, specifically checking month name abbreviations on axes vs tooltips

**Detection:** Italian/Spanish chart axes show "Mar", "Apr" (English) while tooltips show localized month names; inconsistent date formats on the same chart.

### Pitfall 7: Parameter Explanations Content Volume Overwhelms ui.ts

**What goes wrong:** Adding "detailed explanations for each safety pillar" means writing substantive content (likely multiple paragraphs per pillar) explaining what each score measures, how it is calculated, what data sources feed it, and what high/low scores mean. This content must exist in all 3 languages. With 5 pillars and ~200-300 words per explanation, that is 1,500+ words of translated content per language to add to `ui.ts`, which is already ~325 lines and 167 translation keys.

**Why it happens:** The current `ui.ts` pattern works well for short UI strings (button labels, headings, one-sentence descriptions). But multi-paragraph explanatory content in a flat key-value file becomes hard to review, maintain, and spot translation errors in. The file would grow to 500+ lines with interleaved English, Italian, and Spanish blocks.

**Prevention:**
- For short descriptions (1-2 sentences per pillar), keep them in `ui.ts` with keys like `pillar.conflict.short_desc`
- For longer explanations, consider Astro content collections: a `src/content/pillars/` directory with `en/conflict.md`, `es/conflict.md`, `it/conflict.md` keeps long-form content manageable
- If staying with `ui.ts`, use a consistent key naming pattern: `pillar.conflict.description`, `pillar.conflict.sources`, `pillar.conflict.interpretation`
- Write English content first, validate with stakeholders, then translate -- do not attempt all 3 languages simultaneously

**Detection:** `ui.ts` exceeds 500 lines and becomes hard to maintain; translation keys have inconsistent naming; one language has explanations while another has placeholder text.

## Minor Pitfalls

### Pitfall 8: Color Scale Semantics Change with Category Filtering

**What goes wrong:** The current color scale (red-yellow-blue) communicates "danger to safety" for the composite score. When showing individual pillars, the same colors may be confusing. "Blue governance" reads as "safe governance" which actually means "stable, well-functioning institutions." "Red environment" means "high environmental risk" not "dangerous environment to be in." The visual metaphor shifts from "travel safety" to "indicator performance."

**Prevention:**
- Add a contextual label below the legend when a category filter is active explaining what the colors mean for that pillar
- Consider changing legend text per pillar: "Higher risk" / "Lower risk" for environment/health; "More stable" / "Less stable" for governance
- Test with a non-technical user: does "blue conflict" intuitively mean "low conflict" (correct) or "conflict is safe" (confusing)?

### Pitfall 9: Astro View Transitions and Client-Side Chart Re-initialization

**What goes wrong:** The map already handles `astro:after-swap` for view transitions (line 371 of `SafetyMap.astro`), but `TrendChart.astro`'s client-side tooltip script does NOT register for view transitions. If Astro View Transitions are enabled and a user navigates between country pages via client-side routing, the tooltip code runs once (as a module script) and does not re-bind to the new page's chart elements.

**Prevention:**
- Check if the Astro Client Router is enabled in `Base.astro` layout
- If yes, all chart initialization code needs the `document.addEventListener('astro:after-swap', initChart)` pattern
- New interactive controls (zoom, date range, category filter) must also re-bind event listeners after view transitions
- The comparison page's inline `<script>` may also need this treatment if users navigate to it via client-side routing

**Detection:** Charts work on first page load but appear blank or non-interactive after navigating via client-side routing.

### Pitfall 10: scores.json Size Growth with Category Data and Third Language

**What goes wrong:** `scores.json` currently contains `{ iso3, name: { en, it }, score }` for 248 countries. Adding `es` names and pillar scores increases payload. If done carelessly (e.g., including full `PillarScore` objects with `indicators[]`, `dataCompleteness`, and `weight`), the file balloons unnecessarily.

**Prevention:**
- Add only what the map needs: `pillars: { conflict: 0.7, crime: 0.8, health: 0.6, governance: 0.9, environment: 0.75 }` -- five numbers per country
- Keep the name object lean: just add `es` string alongside `en` and `it`
- Estimated growth: ~15KB current -> ~25KB with pillars + Spanish names (acceptable)
- Do NOT include `indicators[]`, `dataCompleteness`, or `advisories` in `scores.json`

**Detection:** Lighthouse performance score drops; map takes noticeably longer to render on mobile; `scores.json` exceeds 50KB.

### Pitfall 11: Historical Data Lacks Per-Pillar Trends (Out of Scope but Creates UX Gap)

**What goes wrong:** The `history-index.json` stores only `{ date, score }` per country per day -- no pillar breakdown over time. If category filtering is added to the map and pillar bars, users will naturally expect the trend chart to also respond to the category filter (e.g., "show conflict score over time"). But this data simply does not exist. The PROJECT.md explicitly lists "Per-pillar historical trends in comparison" as out of scope.

**Prevention:**
- Accept the limitation: category filtering applies to the map (current snapshot) and pillar bars, but NOT to historical trend charts
- Clearly communicate this in the UI: when a category filter is active, show the total score trend with a note like "Historical trends show overall safety score"
- Do NOT try to retroactively compute per-pillar history from daily snapshots -- the full snapshot files may have been cleaned up after `history-index.json` consolidation
- Consider adding per-pillar data to `history-index.json` in a future milestone for v1.3

**Detection:** Users toggle to "Conflict" view and expect the trend chart to show conflict history, but it still shows total score with no explanation.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Spanish i18n (types + data) | Type-level pipeline changes cascade through the system (Pitfall 1) | Update types to `Record<Lang, string>` and data BEFORE creating page files |
| Spanish i18n (country names) | 248 country names need Spanish translations (Pitfall 1) | Script or programmatic generation from reference data |
| Spanish i18n (pages + routes) | 6+ new page files, translated route slugs required (Pitfall 4) | Copy from `en/`, change only `lang` constant; add routes to `routes` object |
| Spanish i18n (content) | Parameter explanations triple the translation volume (Pitfall 7) | Write English first, then translate; consider content collections for long-form |
| Interactive charts | Server-rendered SVG cannot be re-rendered client-side (Pitfall 3) | Move to client-side rendering to match comparison page pattern |
| Interactive charts | Date formatting inconsistent across 3 locales (Pitfall 6) | Use `toLocaleDateString()` consistently with correct locale parameter |
| Interactive charts | View transitions break chart re-initialization (Pitfall 9) | Add `astro:after-swap` listener to all chart init code |
| Category filtering (map) | Pillar data not available in `scores.json` (Pitfall 2) | Extend `scores.json` with pillar scores; use `pillarToColor()` for correct colors |
| Category filtering (charts) | Historical pillar data does not exist (Pitfall 11) | Accept limitation; show total score trend with clear messaging |
| Category filtering (UX) | Color semantics change per pillar (Pitfall 8) | Dynamic legend text; per-pillar contextual labels |
| Comparison search bug fix | setTimeout blur race condition is the likely root cause (Pitfall 5) | Replace with mousedown preventDefault pattern |
| Parameter explanations | Long-form content overwhelms `ui.ts` (Pitfall 7) | Consider content collections or at minimum consistent key naming |

## Sources

- Direct analysis of `src/i18n/ui.ts` (325 lines, 167 keys per language, hardcoded `en`/`it` in `languages` object)
- Direct analysis of `src/i18n/utils.ts` (`useTranslations`, `getLocalizedPath`, `getAlternateLinks` all iterate `languages`)
- Direct analysis of `src/pipeline/types.ts` (`CountryEntry.name: { en: string; it: string }` hardcoded)
- Direct analysis of `src/pipeline/config/countries.ts` (248 entries, each with `{ en, it }` name)
- Direct analysis of `src/components/SafetyMap.astro` (fetches `/scores.json`, uses `c.name?.[lang]`, line 109)
- Direct analysis of `src/components/country/TrendChart.astro` (server-rendered SVG, client-side tooltip only)
- Direct analysis of `src/pages/en/compare.astro` (client-rendered charts, Fuse.js search, `setTimeout` blur handler at line 255)
- Direct analysis of `src/lib/colors.ts` (`pillarToColor()` converts 0-1 to color scale; `scoreToColor()` uses 1-10 scale)
- Direct analysis of `src/lib/scores.ts` (`HistoryPoint` contains only `{ date, score }`, no pillar data)
- PROJECT.md out-of-scope: "Per-pillar historical trends in comparison -- needs pipeline schema change"

---
*Pitfalls research for: v1.2 Improvements & Category Filtering additions to IsItSafeToTravel*
*Researched: 2026-03-20*
