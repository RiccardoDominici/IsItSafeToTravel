# Architecture Patterns

**Domain:** v1.2 feature integration into existing Astro SSG + D3 travel safety platform
**Researched:** 2026-03-20
**Confidence:** HIGH (based on direct codebase analysis)

## Current Architecture Summary

The platform is a **static-first Astro 6 SSG** site with two rendering strategies:

1. **Build-time SVG** (country detail pages): D3 computes paths/scales in Astro frontmatter, outputs static SVG markup. A small `<script>` tag adds tooltip interactivity (mousemove nearest-point). No D3 imported at runtime on these pages.
2. **Client-side rendered** (map + comparison page): Full D3 loaded via `<script>` tags. Map fetches `scores.json` + `world-topo.json` at runtime. Comparison page serializes all data into `data-*` attributes at build time, renders everything client-side with D3 + Fuse.js.

**i18n system:** TypeScript string dictionary in `src/i18n/ui.ts` (~325 lines) with `languages` map (`en`, `it`), `useTranslations()` helper, and route slug translation. Pages duplicated per language under `src/pages/en/` and `src/pages/it/`.

**Data pipeline:** Daily JSON snapshots in `data/scores/`. Consolidated `history-index.json` stores `{global: [{date, score}], countries: {ISO3: [{date, score}]}}`. Only total composite score stored in history -- no per-pillar history exists.

**Key data structures:**
- `ScoredCountry.pillars[]`: each has `name` (PillarName), `score` (0-1), `weight`, `indicators[]`, `dataCompleteness`
- `ScoredCountry.name`: currently `{en: string, it: string}` -- needs `es` added
- `scores.json` (public, for map): contains countries with `iso3`, `name`, `score` but currently lacks pillar data

---

## Recommended Architecture for v1.2 Features

### Feature 1: Interactive Chart Zoom/Scope Controls

**What changes:** The existing `TrendChart.astro` renders SVG at build time via D3 in frontmatter, with a thin client-side tooltip `<script>`. Adding zoom (time-range brush) and scope toggles (1M/3M/6M/1Y/All) requires shifting from build-time SVG to **client-side rendering**, since the chart must re-render when the user changes scope.

**Integration approach:**

```
BEFORE (build-time):
  [slug].astro → TrendChart.astro (D3 in frontmatter → static SVG) → <script> tooltip only

AFTER (client-side):
  [slug].astro → TrendChart.astro (serializes data to data-* attrs, renders scope buttons) → <script> full D3 render
```

**Component boundary:**

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `TrendChart.astro` (modified) | Serialize trend data + i18n strings to `data-*` attributes, render container div + scope buttons as static HTML | `[slug].astro` (receives `data` and `lang` props) |
| `<script>` in TrendChart (rewritten) | D3 client-side: parse data, render SVG, handle scope button clicks, tooltip, optional brush zoom | DOM `data-*` attributes, scope button events |

**Key decisions:**
- Move all D3 rendering from frontmatter to the `<script>` block. Frontmatter only prepares data and i18n strings.
- Scope control buttons (1M/3M/6M/1Y/All) rendered in Astro markup (static HTML), wired to JS via event listeners. This keeps buttons static, accessible, and SEO-friendly.
- D3 brush for zoom: use `d3.brushX()` on the x-axis. On brush end, update x-scale domain and re-render. Reset button clears brush. This is optional -- scope buttons alone may be sufficient for v1.2.
- Data filtering by scope: simple date arithmetic in JS (`new Date() - months`), no data refetch needed since all history is serialized in the page.

**Data flow:**
```
history-index.json (build) → loadHistoricalScores() → HistoryPoint[] → JSON.stringify → data-history attr
User clicks "3M" → JS filters points by date range → D3 re-renders SVG with new x-domain
User brush-selects → JS reads brush extent → D3 re-renders with custom x-domain
```

**Impact on existing code:**
- **MODIFY** `src/components/country/TrendChart.astro` -- major rewrite: move D3 from frontmatter to `<script>`, add scope button markup, rewrite tooltip logic
- **MODIFY** `src/i18n/ui.ts` -- add keys: `chart.scope.1m`, `chart.scope.3m`, `chart.scope.6m`, `chart.scope.1y`, `chart.scope.all`, `chart.scope.label`
- **NO CHANGE** to `src/lib/scores.ts`, data pipeline, page routing, or other components

**Also applies to:**
- Global Safety page trend chart (same pattern)
- Comparison page trend overlay (already client-side; add scope buttons to its render function)

---

### Feature 2: Category Filtering for Map and Charts

**What changes:** Map currently colors by total score only. Category filtering lets users select a pillar (conflict/crime/health/governance/environment) and re-color the map by that pillar's score.

**Critical constraint:** The `history-index.json` only stores total composite scores per date -- no per-pillar history exists. Per PROJECT.md: "Per-pillar historical trends in comparison -- needs pipeline schema change" is explicitly OUT OF SCOPE. Therefore, category filtering for trend charts is not possible in v1.2.

**What IS feasible without pipeline changes:**
- Map coloring by pillar (pillar scores are in `latest.json` / can be added to `scores.json`)
- Comparison page bar chart highlighting to focus on one pillar
- Tooltip updates to show pillar name and score

**What is NOT feasible (out of scope):**
- Historical trend lines per pillar (no data in history-index.json)

**Integration approach for Map:**

1. **Extend `scores.json`** (the public file fetched by the map at runtime): add `pillars` array to each country entry.
2. **Add a pillar selector UI** above the map (segmented control / radio buttons).
3. **On selection change**, re-color all country paths using the selected pillar's score (mapped from 0-1 to 1-10 for the color scale).

**Component boundary:**

| Component | Responsibility | Change |
|-----------|---------------|--------|
| `SafetyMap.astro` | Render map container + new pillar filter bar | Add filter radio buttons in Astro markup |
| `<script>` in SafetyMap | Fetch scores, render D3 map, handle pillar filter | Add `pillarScoreMaps`, re-color on filter change |
| `src/lib/map-utils.ts` | Color scale helpers | Add `pillarScoreToMapScore(score01)` helper |

**Data flow for map:**
```
scores.json (with pillars) → parse → build scoreMap (total) + pillarScoreMaps (per pillar)
User selects "Health" → activePillar = 'health' → recolorMap() → transition fill colors
User selects "Total" → activePillar = 'total' → recolorMap() → back to default
```

**Implementation pattern:**
```typescript
// In SafetyMap <script>
type PillarFilter = 'total' | 'conflict' | 'crime' | 'health' | 'governance' | 'environment';
let activePillar: PillarFilter = 'total';

function getScoreForCountry(iso3: string): number | undefined {
  if (activePillar === 'total') return scoreMap.get(iso3);
  const country = fullCountryData.get(iso3);
  if (!country) return undefined;
  const p = country.pillars.find(p => p.name === activePillar);
  return p ? p.score * 9 + 1 : undefined; // normalize 0-1 → 1-10
}

function recolorMap() {
  g.selectAll<SVGPathElement, any>('.country-path')
    .transition().duration(300)
    .attr('fill', (d: any) => {
      const iso3 = ISO_NUMERIC_TO_ALPHA3[String(d.id)];
      if (!iso3) return isDark() ? UNSCORED_COLOR_DARK : UNSCORED_COLOR;
      const score = getScoreForCountry(iso3);
      return score !== undefined ? safetyColorScale(score) : isDark() ? UNSCORED_COLOR_DARK : UNSCORED_COLOR;
    });
}
```

**Tooltip update:** When a pillar filter is active, show pillar name + pillar score in tooltip instead of total score.

**Legend update:** Update legend label to show active pillar name (e.g., "Health - Safer / Less safe").

**Impact on existing code:**
- **MODIFY** `src/components/SafetyMap.astro` -- add filter UI markup + modify script for pillar-based coloring
- **MODIFY** the build step that copies latest.json to `public/scores.json` -- include pillar data per country
- **MODIFY** `src/i18n/ui.ts` -- add keys: `map.filter.total`, `map.filter.conflict`, `map.filter.crime`, `map.filter.health`, `map.filter.governance`, `map.filter.environment`, `map.filter.label`
- **MODIFY** `src/lib/map-utils.ts` -- add pillar score normalization helper
- **NO CHANGE** to data pipeline, page routing, or country detail pages

**scores.json size impact:** Currently ~50KB with just total scores. Adding 5 pillar scores per country adds ~30KB (248 countries x 5 pillars x ~25 bytes). New total ~80KB. Negligible.

---

### Feature 3: Spanish Language Support

**What changes:** Add `es` as a third language alongside `en` and `it`.

**Integration approach:**

The i18n system is well-structured for expansion. The `useTranslations()` function and `getLocalizedPath()` are fully generic -- they iterate `languages` and `routes` dynamically.

**Step-by-step:**

1. **`src/i18n/ui.ts`**: Add `es: 'Espanol'` to `languages`, add full `es: {...}` block to `ui` (~170 strings), add `es: {...}` route slugs to `routes`.
2. **`src/pages/es/`**: Create directory mirroring `en/` structure with Spanish route slugs:
   - `es/index.astro`
   - `es/pais/[slug].astro` (country slug: "pais")
   - `es/comparar.astro`
   - `es/metodologia/index.astro`
   - `es/aviso-legal/index.astro`
   - `es/seguridad-global.astro`
3. **`src/pipeline/types.ts`**: Extend `name` type from `{en: string; it: string}` to `{en: string; it: string; es: string}`.
4. **Country name data**: Add Spanish country names to the pipeline's country mapping.
5. **`astro.config.mjs`**: Add `'es'` to `locales` array and `sitemap.i18n.locales`.

**Component boundary:**

| Component | Responsibility | Change |
|-----------|---------------|--------|
| `src/i18n/ui.ts` | Language registry + all UI strings | Add `es` to `languages`, `ui`, `routes` |
| `src/i18n/utils.ts` | URL parsing, locale detection | NO CHANGE (fully generic) |
| `src/pages/es/` (new) | Spanish page routes | New directory, 8-10 files mirroring `en/` |
| `LanguageSwitcher.astro` | Language toggle UI | Auto-picks up new language from `languages` map |
| Pipeline country data | Country names | Add `es` field to name objects |
| `astro.config.mjs` | Astro i18n config | Add `'es'` to locales |

**Data flow:**
```
ui.ts languages → {en: 'English', it: 'Italiano', es: 'Espanol'}
                → LanguageSwitcher renders 3 options
ui.ts routes.es → getLocalizedPath() translates URL segments
pages/es/*.astro → Astro generates static /es/ pages at build
ScoredCountry.name.es → map tooltips, country page titles, comparison cards
```

**Key consideration:** The `ScoredCountry.name` type change propagates through:
- Pipeline country mapping data file
- `src/pipeline/types.ts` (TypeScript interface)
- `scores.json` generation (include `name.es`)
- Map tooltip code (already reads `name[lang]`, works automatically)
- Comparison page (already reads `country.name[lang]`)

**Impact:**
- **MODIFY** `src/i18n/ui.ts` (major: ~170 new string translations + route slugs)
- **MODIFY** `src/pipeline/types.ts` (add `es` to name type)
- **MODIFY** `astro.config.mjs` (add `'es'` to locales)
- **CREATE** `src/pages/es/` directory with all page files (8-10 files)
- **MODIFY** pipeline country mapping to include Spanish names
- **NO CHANGE** to `src/i18n/utils.ts`, any component logic, or `src/lib/` files

---

### Feature 4: Parameter/Pillar Explanations

**What changes:** Each safety pillar (conflict, crime, health, governance, environment) gets a detailed explanation: what it measures, which indicators feed into it, their sources, and why it matters for travelers.

**Integration approach -- two options:**

**Option A: Expandable sections in PillarBreakdown (RECOMMENDED)**
Add `<details>/<summary>` blocks below each pillar bar. Clicking reveals the explanation. Zero JS required. Content from i18n strings.

**Option B: Separate explanation pages**
New `/methodology/pillars/[name]` pages. More SEO-friendly but fragments the UX.

**Recommend Option A** because:
- Users viewing a country's pillar breakdown are exactly the audience who wants context
- Keeps users in flow (no navigation away)
- `<details>/<summary>` is accessible, semantic, and requires no JavaScript
- Explanation text is relatively short (~2-3 sentences per pillar + indicator list)

**Component boundary:**

| Component | Responsibility | Change |
|-----------|---------------|--------|
| `PillarBreakdown.astro` | Pillar bars + new expandable explanations | Add `<details>` below each pillar bar |
| `src/i18n/ui.ts` | Explanation text per pillar per language | Add ~25 new keys per language |

**Data available for explanations (already in `PillarScore`):**
- `PillarScore.name` -- pillar identifier
- `PillarScore.weight` -- e.g., 0.25 (25%)
- `PillarScore.indicators[]` -- each has `name`, `rawValue`, `normalizedValue`, `source`, `year`
- `PillarScore.dataCompleteness` -- coverage percentage

**Markup pattern:**
```astro
{sorted.map((pillar) => {
  const label = t(pillarKeys[pillar.name]);
  return (
    <div>
      {/* Existing bar visualization */}
      <div class="flex items-center gap-3">...</div>

      {/* NEW: Expandable explanation */}
      <details class="mt-1 ml-28">
        <summary class="text-xs text-terracotta-500 cursor-pointer">
          {t('pillar.explain.toggle')}
        </summary>
        <div class="mt-2 text-sm text-sand-600 dark:text-sand-400 space-y-2">
          <p>{t(`pillar.explain.${pillar.name}`)}</p>
          <p class="text-xs">{t('pillar.explain.weight')}: {(pillar.weight * 100).toFixed(0)}%</p>
          <ul class="text-xs space-y-1">
            {pillar.indicators.map(ind => (
              <li>{t(`methodology.indicator.${ind.name}` as any)}: {(ind.normalizedValue * 10).toFixed(1)}/10</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
})}
```

**Impact:**
- **MODIFY** `src/components/country/PillarBreakdown.astro` -- add `<details>` sections
- **MODIFY** `src/i18n/ui.ts` -- add ~25 keys per language (explanation text, toggle label, weight label)
- **NO CHANGE** to data pipeline, scoring, page routing, or any other component

---

## Patterns to Follow

### Pattern 1: Data Serialization via data-* Attributes
**What:** Astro components serialize build-time data as JSON in `data-*` attributes. Client-side `<script>` tags parse and use this data.
**When:** Any component that needs both SSG data and client-side interactivity.
**Why:** Already established pattern (TrendChart, Compare page). Avoids runtime API calls. Keeps bundle sizes small since data is page-specific.
**Example:**
```astro
<div id="chart" data-points={JSON.stringify(points)} data-translations={JSON.stringify(tStrings)}>
  <!-- container for D3 -->
</div>
<script>
  const el = document.getElementById('chart')!;
  const points = JSON.parse(el.dataset.points!);
  // D3 rendering here
</script>
```

### Pattern 2: Static HTML Controls + JS Event Wiring
**What:** Render interactive controls (buttons, radio inputs) in Astro markup (build-time), wire behavior in `<script>`.
**When:** Scope buttons, pillar filter radio buttons, toggle controls.
**Why:** Controls are accessible, visible to crawlers, styled with Tailwind, and functional even if JS loads slowly.
**Example:**
```astro
<!-- Astro markup (build-time) -->
<div class="flex gap-2" role="radiogroup" aria-label={t('map.filter.label')}>
  {['total', 'conflict', 'crime', 'health', 'governance', 'environment'].map(p => (
    <button class="scope-btn px-3 py-1 rounded text-sm" data-pillar={p}>
      {t(`map.filter.${p}`)}
    </button>
  ))}
</div>

<!-- Client script wires events -->
<script>
  document.querySelectorAll('.scope-btn').forEach(btn => {
    btn.addEventListener('click', () => { /* update chart/map */ });
  });
</script>
```

### Pattern 3: Native HTML for Zero-JS Interactivity
**What:** Use `<details>/<summary>` for expand/collapse instead of custom JS toggles.
**When:** Pillar explanations, FAQ-style content.
**Why:** Zero JS, accessible by default, works with SSG, animatable with CSS.

### Pattern 4: i18n Key Namespacing Convention
**What:** New features add keys under clear namespace prefixes.
**Existing convention:**
```
country.pillar.conflict     → pillar names
country.trend_title         → chart headings
compare.title               → comparison page
map.zoom.in                 → map controls
```
**New keys for v1.2:**
```
chart.scope.1m              → chart scope controls
chart.scope.all
map.filter.total            → map pillar filter
map.filter.conflict
pillar.explain.conflict     → pillar explanations
pillar.explain.toggle       → "What does this measure?"
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Importing Full D3 Bundle in Client Scripts
**What:** Using `import * as d3 from 'd3'` in client-side `<script>` tags.
**Why bad:** The full D3 bundle is ~250KB. The map already does this (`import * as d3 from 'd3'`), but new components should not follow this pattern.
**Instead:** Import only needed sub-modules: `import { scaleLinear, scaleTime, line, brushX, timeFormat } from 'd3';`. Vite tree-shakes effectively when using named imports.

### Anti-Pattern 2: Duplicating Filter State Across Components
**What:** Each visualization maintaining its own pillar filter state independently.
**Why bad:** If map shows "Health" but chart shows "Total", the UX is confusing. On the homepage, the map is the only visualization, so this is not an issue today. But if pillar filtering extends to other pages, coordinate state.
**Instead:** On the homepage, filter state lives in the map script (single owner). On country pages, pillar filtering does not apply to trend charts (no per-pillar history). Keep it simple.

### Anti-Pattern 3: Creating Separate Per-Language Translation Files
**What:** Splitting translations into `en.json`, `it.json`, `es.json`.
**Why bad:** The existing `ui.ts` co-locates all languages in one TypeScript file. This provides **compile-time key checking** -- TypeScript will error if a key exists in `en` but is missing in `it` or `es`. Splitting loses this type-safety.
**Instead:** Add `es` block to the existing `ui.ts`. File grows from ~325 to ~500 lines. Still manageable. Consider splitting only if exceeding ~1000 lines (at 5+ languages).

### Anti-Pattern 4: Dynamic API Endpoints for Chart Data
**What:** Creating Astro API routes to serve chart data dynamically.
**Why bad:** Breaks the SSG model. The site deploys to Cloudflare Pages as purely static files. Adding API routes requires switching to SSR mode with Cloudflare Workers, adding cold starts, caching complexity, and cost.
**Instead:** Continue serializing data into `data-*` attributes for country-specific data, or into `public/*.json` for shared data fetched at runtime.

### Anti-Pattern 5: Over-Engineering Cross-Component Communication
**What:** Adding a state management library (or custom event bus) for pillar filter coordination.
**Why bad:** v1.2 features do not require cross-component state. The map is on the homepage alone. The trend chart is on country pages alone. The comparison page is self-contained.
**Instead:** Each page's script manages its own state. If future features need cross-component coordination, revisit then.

---

## Component Dependency Graph

```
v1.2 Feature Dependencies:

1. Spanish i18n (FOUNDATION - no deps on other v1.2 features)
   └── Modifies: ui.ts, types.ts, astro.config
   └── Creates: pages/es/

2. Parameter Explanations (INDEPENDENT - no deps on other v1.2 features)
   └── Modifies: PillarBreakdown.astro, ui.ts
   └── Uses: existing PillarScore.indicators[] data

3. Chart Zoom/Scope (INDEPENDENT - no deps on other v1.2 features)
   └── Modifies: TrendChart.astro (major rewrite), ui.ts
   └── Also benefits: Global Safety page, Compare page

4. Category Filtering (DEPENDS ON scores.json having pillar data)
   └── Modifies: SafetyMap.astro, map-utils.ts, scores.json generation, ui.ts
   └── Optional extension to: Compare page pillar bars
   └── Cannot extend to: historical trend charts (no per-pillar history data)
```

---

## Suggested Build Order

```
Phase 1: Spanish i18n + Parameter Explanations (PARALLEL, no conflicts)
  Both touch ui.ts but in different key namespaces.
  Spanish i18n is foundational: all subsequent features need 3-language strings.
  Parameter explanations are self-contained and low-risk.

Phase 2: Chart Zoom/Scope Controls
  Requires TrendChart.astro rewrite (build-time → client-side D3).
  This is the most architecturally significant change.
  Should be done before category filtering to validate client-side D3 pattern.

Phase 3: Category Filtering (Map)
  Requires scores.json expansion + map script modifications.
  Map is the highest-traffic component; test thoroughly.
  Can optionally extend to comparison page pillar bars.

Phase 4: Bug Fixes (comparison page country search)
  Can slot in anywhere but best after main features stabilize.
  Likely a small fix in the Fuse.js search or dropdown positioning.
```

**Rationale for this order:**
- Phase 1 items have zero dependencies and can be done in parallel
- Phase 2 establishes the client-side D3 pattern needed for understanding Phase 3
- Phase 3 depends on Phase 1 (needs Spanish filter labels) and benefits from Phase 2 experience
- Phase 4 is a bug fix that benefits from feature stability

---

## Files Changed Summary

| File | Features Touching It | Type of Change |
|------|---------------------|----------------|
| `src/i18n/ui.ts` | ALL four features | Add: ~170 (es) + ~6 (scope) + ~7 (filter) + ~25 (explanations) strings |
| `src/components/country/TrendChart.astro` | Chart zoom/scope | Major rewrite: build-time → client-side D3, add scope buttons |
| `src/components/country/PillarBreakdown.astro` | Parameter explanations | Add `<details>/<summary>` expandable sections |
| `src/components/SafetyMap.astro` | Category filtering | Add filter UI bar + modify script for pillar coloring |
| `src/lib/map-utils.ts` | Category filtering | Add pillar score normalization helper |
| `src/pipeline/types.ts` | Spanish i18n | Extend `name` type: `{en, it}` → `{en, it, es}` |
| `astro.config.mjs` | Spanish i18n | Add `'es'` to `locales` array |
| `src/pages/es/` (new) | Spanish i18n | Create 8-10 page files mirroring `en/` |
| `public/scores.json` generation | Category filtering | Include pillar scores per country |
| Pipeline country mapping | Spanish i18n | Add Spanish country names |

---

## Scalability Considerations

| Concern | Current (2 langs) | At 3 langs (v1.2) | At 5+ langs (future) |
|---------|-------------------|--------------------|-----------------------|
| `ui.ts` file size | ~325 lines | ~500 lines | ~800+ lines; consider splitting with shared type |
| Page count (SSG) | ~500 pages | ~750 pages | ~1250 pages; build time grows linearly |
| `scores.json` size | ~50KB (total only) | ~80KB (with pillars) | Fine up to ~200KB; code-split if needed |
| History data in `data-*` | ~10-50KB/page | Same | If >100KB, lazy-load via fetch |
| Astro build time | ~30s | ~45s (+50% pages) | Acceptable up to ~120s |

## Sources

- Direct codebase analysis of all referenced files (HIGH confidence)
- Astro 6 i18n routing documentation (HIGH confidence)
- D3.js v7 brush module for zoom interaction pattern (HIGH confidence)
- HTML `<details>/<summary>` specification for accessible expand/collapse (HIGH confidence)
