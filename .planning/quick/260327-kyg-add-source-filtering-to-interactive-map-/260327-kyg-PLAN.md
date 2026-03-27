---
phase: quick
plan: 260327-kyg
type: execute
wave: 1
depends_on: []
files_modified:
  - src/i18n/ui.ts
  - src/components/SafetyMap.astro
  - src/components/country/TrendChart.astro
autonomous: false
requirements: [source-filter-map, source-filter-chart]
must_haves:
  truths:
    - "Map filter panel shows a Sources section with checkboxes grouped by country, sorted by coverage count"
    - "Unchecking a source hides its advisory info from the map tooltip"
    - "TrendChart filter panel shows the same Sources section controlling AdvisorySection card visibility"
    - "All sources are checked by default"
    - "Source filter labels and section header work in all 5 languages (en, it, es, fr, pt)"
  artifacts:
    - path: "src/i18n/ui.ts"
      provides: "filter.sources and filter.all_sources i18n keys in 5 languages"
      contains: "filter.sources"
    - path: "src/components/SafetyMap.astro"
      provides: "Source filter UI in map dropdown + advisory-enhanced tooltip + checkbox filtering logic"
      contains: "source-filter-list"
    - path: "src/components/country/TrendChart.astro"
      provides: "Source filter UI in chart dropdown + JS to show/hide AdvisoryCards"
      contains: "trend-source-filter-list"
  key_links:
    - from: "src/components/SafetyMap.astro"
      to: "/scores.json advisories field"
      via: "fetch + parse advisories per country into advisoryMap"
      pattern: "advisoryMap"
    - from: "src/components/country/TrendChart.astro"
      to: "AdvisoryCard elements on page"
      via: "querySelectorAll('[data-advisory-source]') visibility toggle"
      pattern: "data-advisory-source"
---

<objective>
Add advisory source filtering to the SafetyMap and TrendChart filter panels. Sources displayed as checkboxes grouped by providing country, sorted by coverage count (descending), all checked by default. This is a VIEW FILTER -- it controls which advisory sources appear in tooltips (map) and advisory cards (country page), NOT a score recomputation.

Purpose: Let users focus on advisories from specific governments they trust, e.g. their own country's foreign ministry.
Output: Updated SafetyMap.astro, TrendChart.astro, and ui.ts with source filter UI and logic.
</objective>

<execution_context>
@.planning/quick/260327-kyg-add-source-filtering-to-interactive-map-/260327-kyg-RESEARCH.md
</execution_context>

<context>
@src/i18n/ui.ts
@src/components/SafetyMap.astro
@src/components/country/TrendChart.astro
@src/components/country/AdvisorySection.astro
@src/components/country/AdvisoryCard.astro

<interfaces>
<!-- SafetyMap filter dropdown structure (line 97-109) -->
```html
<div id="pillar-filter-dropdown" class="hidden absolute top-full left-0 mt-1 p-2 bg-sand-50/95 dark:bg-sand-800/95 backdrop-blur-sm border border-sand-300 dark:border-sand-600 rounded-lg shadow-lg min-w-[200px]">
  <div class="flex flex-col gap-0.5" id="pillar-filter-bar">
    <!-- pillar pills here -->
  </div>
  <!-- SOURCE FILTER GOES HERE, after pillar-filter-bar -->
</div>
```

<!-- TrendChart filter dropdown structure (line 59-71) -->
```html
<div id="trend-filter-dropdown" class="hidden absolute top-full left-0 mt-1 p-1.5 bg-sand-50/95 dark:bg-sand-800/95 backdrop-blur-sm border border-sand-300 dark:border-sand-600 rounded-lg shadow-lg min-w-[160px] z-20">
  <div class="flex flex-col gap-0.5" id="trend-pillar-filter">
    <!-- pillar pills here -->
  </div>
  <!-- SOURCE FILTER GOES HERE, after trend-pillar-filter -->
</div>
```

<!-- scores.json advisory data per country -->
```typescript
// Each country has: advisories: { [key: string]: { level, text, source, url, updatedAt } }
// Keys: us, uk, ca, au, de, nl, jp, sk, fr, nz, ie, fi, hk, br, at, ph, be, dk, sg, ro, rs, ee, hr, ar, it, es, kr, tw, cn, in, ch, se, no, pl, cz, hu, pt
```

<!-- Design system classes -->
Active pill: bg-terracotta-500 text-white border-terracotta-500
Inactive pill: bg-transparent text-sand-600 dark:text-sand-300 border-transparent hover:bg-sand-200 dark:hover:bg-sand-700
Dropdown: bg-sand-50/95 dark:bg-sand-800/95 backdrop-blur-sm border border-sand-300 dark:border-sand-600 rounded-lg shadow-lg
Section label: text-[10px] font-medium text-sand-500 dark:text-sand-400

<!-- i18n: 5 language blocks starting at lines 13 (en), 413 (it), 813 (es), 1213 (fr), 1613 (pt) -->
<!-- Existing keys: filter.overall, country.advisory.XX (for each source) -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add i18n keys and source filter UI + logic to SafetyMap</name>
  <files>src/i18n/ui.ts, src/components/SafetyMap.astro</files>
  <action>
**Step 1: Add i18n keys to ui.ts**

Add these keys to ALL 5 language blocks (en ~line 133, it ~line 533, es ~line 933, fr ~line 1333, pt ~line 1733), near the existing `filter.overall` key:

```
en: 'filter.sources': 'Sources', 'filter.all_sources': 'All sources'
it: 'filter.sources': 'Fonti', 'filter.all_sources': 'Tutte le fonti'
es: 'filter.sources': 'Fuentes', 'filter.all_sources': 'Todas las fuentes'
fr: 'filter.sources': 'Sources', 'filter.all_sources': 'Toutes les sources'
pt: 'filter.sources': 'Fontes', 'filter.all_sources': 'Todas as fontes'
```

**Step 2: Pass translations to client-side JS in SafetyMap.astro**

In the frontmatter (around line 12-19), add to the `translations` object:
```typescript
sourcesLabel: t('filter.sources'),
allSourcesLabel: t('filter.all_sources'),
```

Also pass the advisory source translations as a map for short labels. Create a `sourceLabels` object:
```typescript
const sourceLabels: Record<string, string> = {};
const ADVISORY_KEYS = ['us','uk','ca','au','de','nl','jp','sk','fr','nz','ie','fi','hk','br','at','ph','be','dk','sg','ro','rs','ee','hr','ar','it','es','kr','tw','cn','in','ch','se','no','pl','cz','hu','pt'];
for (const key of ADVISORY_KEYS) {
  sourceLabels[key] = t(`country.advisory.${key}` as any);
}
```
Add `data-source-labels={JSON.stringify(sourceLabels)}` to the `#safety-map-container` div.

**Step 3: Add static HTML for source filter section in the dropdown**

Inside `#pillar-filter-dropdown` (line 97), AFTER the closing `</div>` of `#pillar-filter-bar` (line 108), add:

```html
<div class="border-t border-sand-200 dark:border-sand-700 my-2"></div>
<div class="text-[10px] font-medium text-sand-500 dark:text-sand-400 px-1 mb-1" id="source-filter-header">
  {t('filter.sources')}
</div>
<div class="flex flex-col gap-0 max-h-[200px] overflow-y-auto" id="source-filter-list">
  <!-- Populated dynamically from scores.json -->
</div>
```

**Step 4: Add client-side JS to build source checkboxes and filter tooltips**

In the `<script>` section, after scores are loaded from `/scores.json` (~line 175), add logic to:

1. **Count advisory sources across all countries:**
```typescript
const sourceCounts = new Map<string, number>();
const advisoryMap = new Map<string, Record<string, any>>();
for (const c of snapshot.countries || []) {
  if (c.advisories) {
    advisoryMap.set(c.iso3, c.advisories);
    for (const key of Object.keys(c.advisories)) {
      sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
    }
  }
}
const sortedSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
```

2. **Build checkbox HTML dynamically** into `#source-filter-list`:
```typescript
const sourceLabelsData = JSON.parse(container!.dataset.sourceLabels || '{}');
const translationsData = JSON.parse(container!.dataset.translations || '{}');
const sourceFilterList = document.getElementById('source-filter-list');
const enabledSources = new Set<string>(sortedSources.map(s => s[0]));

// "All sources" toggle at top
const allLabel = document.createElement('label');
allLabel.className = 'flex items-center gap-2 px-2 py-1 text-xs rounded-md hover:bg-sand-200 dark:hover:bg-sand-700 cursor-pointer font-medium';
allLabel.innerHTML = `<input type="checkbox" checked class="accent-terracotta-500 w-3 h-3" id="source-all-toggle" /><span class="text-sand-600 dark:text-sand-300">${translationsData.allSourcesLabel || 'All sources'}</span>`;
sourceFilterList?.appendChild(allLabel);

// Individual source checkboxes
for (const [key, count] of sortedSources) {
  const label = document.createElement('label');
  label.className = 'flex items-center gap-2 px-2 py-0.5 text-xs rounded-md hover:bg-sand-200 dark:hover:bg-sand-700 cursor-pointer';
  label.innerHTML = `<input type="checkbox" checked class="accent-terracotta-500 w-3 h-3 source-checkbox" data-source="${key}" /><span class="text-sand-600 dark:text-sand-300 truncate">${sourceLabelsData[key] || key.toUpperCase()}</span><span class="ml-auto text-[10px] text-sand-400 shrink-0">(${count})</span>`;
  sourceFilterList?.appendChild(label);
}
```

3. **Wire checkbox event handlers:**
- Individual checkboxes: toggle source in `enabledSources` Set. Update "All" checkbox state (checked if all checked, indeterminate if some, unchecked if none).
- "All sources" checkbox: check/uncheck all individual checkboxes, update `enabledSources`.
- IMPORTANT: Do NOT close the dropdown when clicking checkboxes (unlike pillar pills). Add `e.stopPropagation()` on the source filter list container to prevent dropdown close.

4. **Enhance the tooltip to show advisory info:**
In the `showTooltip` function (around line 350), after the existing score text, append advisory source lines from `advisoryMap` filtered by `enabledSources`:
```typescript
const advisories = advisoryMap.get(iso3);
if (advisories) {
  const visibleAdvisories = Object.entries(advisories)
    .filter(([key]) => enabledSources.has(key))
    .sort((a, b) => (a[1] as any).level - (b[1] as any).level);
  if (visibleAdvisories.length > 0) {
    // Show up to 4 advisory lines in tooltip
    const lines = visibleAdvisories.slice(0, 4).map(([key, adv]: [string, any]) => {
      const name = sourceLabelsData[key] || key.toUpperCase();
      return `${name}: Level ${adv.level}`;
    });
    if (visibleAdvisories.length > 4) {
      lines.push(`+${visibleAdvisories.length - 4} more`);
    }
    scoreText += '\n' + lines.join('\n');
  }
}
```
Change `tooltip.textContent` to use `tooltip.innerText` so newlines render, OR build with innerHTML using `<br>` tags (prefer innerHTML with `<div>` elements for styling control):
```typescript
tooltip.innerHTML = `<div class="font-medium">${displayName}</div>` +
  (displayScore ? `<div>${displayScore.label ? displayScore.label + ': ' : ''}${displayScore.value.toFixed(1)}/10</div>` : `<div>${translations.nodata}</div>`) +
  advisoryHtml; // where advisoryHtml is built from filtered advisories
```
Style advisory lines as `text-[10px] text-sand-500 dark:text-sand-400 mt-1 border-t border-sand-200 dark:border-sand-700 pt-1`.

5. **Update the source filter header** with count: `Sources (N)` where N is `sortedSources.length`.
  </action>
  <verify>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && npx astro check 2>&1 | tail -20</automated>
  </verify>
  <done>Map filter dropdown shows pillar pills + separator + "Sources (N)" header + "All sources" toggle + individual source checkboxes sorted by coverage count descending. Tooltip shows advisory info filtered by enabled sources. Checkbox clicks do not close dropdown. All/none toggle works. Works in all 5 languages.</done>
</task>

<task type="auto">
  <name>Task 2: Add source filter to TrendChart dropdown with AdvisoryCard visibility control</name>
  <files>src/components/country/TrendChart.astro, src/components/country/AdvisorySection.astro</files>
  <action>
**Step 1: Add data-advisory-source attributes to AdvisoryCards**

In `AdvisorySection.astro`, add a `data-advisory-source={key}` attribute to each AdvisoryCard wrapper. The cards are rendered in two groups -- `primaryAdvisories` and `additionalAdvisories`. For both the grid items (line 45-52) and additional items (inside the toggle section), wrap each `<AdvisoryCard>` in a `<div data-advisory-source={key}>` so the source filter can target them.

**Step 2: Add source filter HTML to TrendChart dropdown**

In `TrendChart.astro`, inside `#trend-filter-dropdown` (line 59), AFTER the closing `</div>` of `#trend-pillar-filter` (line 70), add the same pattern as the map:

```html
<div class="border-t border-sand-200 dark:border-sand-700 my-2"></div>
<div class="text-[10px] font-medium text-sand-500 dark:text-sand-400 px-1 mb-1" id="trend-source-filter-header">
  {t('filter.sources')}
</div>
<div class="flex flex-col gap-0 max-h-[200px] overflow-y-auto" id="trend-source-filter-list">
  <!-- Populated dynamically -->
</div>
```

**Step 3: Pass advisory source data to TrendChart**

The TrendChart is on a country-specific page and doesn't fetch scores.json. It needs to know which advisory sources exist FOR THIS COUNTRY. Look at the page that renders TrendChart to find where advisories are available.

In the TrendChart frontmatter, accept an optional new prop:
```typescript
interface Props {
  data: HistoryPoint[];
  pillarData?: Record<string, HistoryPoint[]> | null;
  lang: Lang;
  advisorySources?: { key: string; name: string }[];  // NEW
}
```
Pass the available advisory keys + translated names from the parent page.

Also find the country page template that renders TrendChart (likely `src/pages/[lang]/country/[iso3].astro` or similar) and pass the `advisorySources` prop from the country's advisory data.

On the `#trend-filter-wrapper` div or a nearby data attribute, add:
```
data-advisory-sources={JSON.stringify(advisorySources || [])}
```

**Step 4: Build checkboxes dynamically in TrendChart script**

In the TrendChart `<script>` section (after line 467), add JS similar to SafetyMap but simpler since it only needs to show/hide AdvisoryCard elements on the same page:

1. Parse `data-advisory-sources` to get available sources.
2. Build checkboxes (same style as map: "All sources" toggle + individual checkboxes).
3. On checkbox change, query all `[data-advisory-source]` elements on the page and toggle `hidden` class based on whether that source is enabled.
4. Same stopPropagation logic to prevent dropdown close on checkbox click.
5. If no advisory sources available (empty array), hide the entire source filter section (separator + header + list).

**Step 5: Prevent dropdown close on checkbox clicks**

For both map and chart: the existing close-on-outside-click handlers listen for document clicks. The checkbox container already IS inside the dropdown wrapper, so clicks on checkboxes should NOT trigger close. However, the pillar pills explicitly close the dropdown (`filterDropdown?.classList.add('hidden')`). Make sure checkbox click handlers do NOT call this close. Only pillar pill clicks should close the dropdown.

**Step 6: Update min-width of trend dropdown**

Change `min-w-[160px]` on `#trend-filter-dropdown` to `min-w-[200px]` to accommodate the source filter labels (matching the map dropdown width).
  </action>
  <verify>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && npx astro check 2>&1 | tail -20</automated>
  </verify>
  <done>TrendChart filter dropdown shows source checkboxes for the country's available advisory sources. Unchecking a source hides its AdvisoryCard on the country page. "All sources" toggle works. Dropdown stays open during checkbox interaction. Works in all 5 languages.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Advisory source filtering in map and chart filter panels. Map tooltip now shows advisory source info filtered by selected sources. Country page TrendChart filter hides/shows advisory cards.</what-built>
  <how-to-verify>
    1. Visit the homepage map at http://localhost:4321/en
    2. Click the filter button (top-left of map) -- verify you see pillar pills PLUS a separator and "Sources (N)" section with checkboxes
    3. Verify all sources are checked by default, sorted by coverage count
    4. Hover over a country on the map -- verify tooltip shows country name, score, AND advisory source lines
    5. Uncheck "US State Department" in the source filter
    6. Hover the same country again -- verify US advisory line is gone from tooltip
    7. Click "All sources" checkbox to uncheck all, then re-check it -- verify all individual checkboxes toggle
    8. Verify clicking checkboxes does NOT close the dropdown
    9. Navigate to a country page (e.g., /en/country/fra)
    10. Click the trend chart filter button -- verify source filter section appears
    11. Uncheck a source -- verify its advisory card hides on the page
    12. Check Italian language (/it) to verify translations work
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `npx astro check` passes with no errors
- `npx astro build` completes successfully
- Map filter panel shows Sources section with checkboxes
- TrendChart filter panel shows Sources section with checkboxes
- Tooltip shows advisory info filtered by enabled sources
- AdvisoryCards hide/show based on chart source filter
- All 5 languages display correct translations
</verification>

<success_criteria>
- Source filter checkboxes appear in both map and chart filter dropdowns, only when panel is opened
- Sources sorted by coverage count descending with count shown in parentheses
- All checked by default, "All sources" master toggle works
- Map tooltip displays advisory source info for enabled sources only
- Country page advisory cards hide/show based on chart source filter selections
- No score recomputation -- purely a view filter
- Consistent styling with existing filter UI (terracotta accent, same dropdown pattern)
- Works in en, it, es, fr, pt
</success_criteria>

<output>
After completion, create `.planning/quick/260327-kyg-add-source-filtering-to-interactive-map-/260327-kyg-SUMMARY.md`
</output>
