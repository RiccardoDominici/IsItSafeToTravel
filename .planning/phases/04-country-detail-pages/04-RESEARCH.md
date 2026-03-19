# Phase 4: Country Detail Pages - Research

**Researched:** 2026-03-19
**Domain:** Astro SSG dynamic routes, data visualization (charts/bars), i18n page generation
**Confidence:** HIGH

## Summary

Phase 4 builds dedicated country detail pages using Astro's `getStaticPaths()` for static generation. Each country gets a page per locale (EN + IT) displaying the composite safety score, category breakdowns as horizontal bars, a sparkline trend chart, government advisory cards, auto-generated summary text, and a sources section. All data comes from `data/scores/latest.json` (current) and `data/scores/YYYY-MM-DD.json` (historical snapshots) loaded at build time via `node:fs`.

D3 is already installed (`d3@^7.9.0`) and is the correct choice for both the horizontal bar chart and sparkline. Since Astro renders at build time, we can generate SVG charts server-side as pure Astro components -- zero client-side JavaScript needed for the bars and sparkline. This aligns with the project's "zero JS on content pages" principle from Phase 1.

**Primary recommendation:** Use Astro `getStaticPaths()` with `[...slug].astro` rest parameters to generate `/en/country/{iso3}` and `/it/paese/{iso3}` pages. Render all charts as build-time SVG using D3's path generators (no client island needed). Add country detail i18n strings to the existing `ui.ts` system.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Large hero number with color badge at top of page -- blue-yellow-red color language matching the map
- Page section order: Score hero -> Category breakdown -> Advisory cards -> Trend chart -> Sources footer
- Medium information density -- spacious but not sparse, travel magazine feel
- Horizontal bars with color fill for each of 5 pillars (conflict, crime, health, governance, environment)
- Color fill follows the same blue-yellow-red gradient as the map
- Line chart/sparkline for composite score over last 90 days from daily snapshot files
- If fewer than 7 days of data: show available points with note "Trend data accumulating"
- Colored badge cards for each advisory (US State Dept, UK FCDO) -- only show if advisory exists
- Advisory level color coding matches the source's own scheme
- Template-driven summary paragraph per country -- deterministic, no AI generation
- Template strings in i18n system with variable interpolation
- Tone: informative and neutral, factual only, no recommendations
- Sources at bottom with name, description, link, fetch date from `ScoredCountry.sources`
- URL pattern: `/{locale}/country/{slug}` with localized route segment
- Dynamic routes using Astro `getStaticPaths()` -- one page per scored country per locale
- hreflang tags linking EN and IT versions

### Claude's Discretion
- Exact sparkline/chart library choice (lightweight, SSG-compatible)
- Bar chart component implementation details
- Spacing, typography scale within established design system
- Responsive breakpoints for mobile layout of score cards and charts
- How to handle countries with very low data completeness (visual treatment)
- Exact template wording for auto-generated summaries
- Bar ordering (by weight or score severity)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CTRY-01 | Each country has a dedicated page showing its safety score (1-10) | `getStaticPaths()` generates pages from `latest.json`; score hero component displays composite score |
| CTRY-02 | Detail page shows sub-score breakdown by category with visual indicators | Horizontal bar SVG components using D3 scale functions; pillar data from `ScoredCountry.pillars` |
| CTRY-03 | Detail page shows historical trend (score evolution over time as sparkline) | Build-time SVG sparkline from daily snapshot files in `data/scores/`; D3 line generator |
| CTRY-04 | Detail page shows government advisory levels (US, UK) alongside composite score | Advisory card components rendering `ScoredCountry.advisories.{us,uk}` with color-coded badges |
| CTRY-05 | Detail page lists all data sources used with links to originals | Sources footer rendering `ScoredCountry.sources: SourceMeta[]` |
| CTRY-06 | Each page has unique auto-generated content explaining the safety assessment | Template-driven i18n strings with variable interpolation for country-specific text |
| TRNS-03 | Sources section at bottom of detail pages with linked citations | Same as CTRY-05, rendered as linked list with fetch dates |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| astro | ^6.0.6 | SSG framework, `getStaticPaths()` for dynamic routes | Already installed, project foundation |
| d3 | ^7.9.0 | SVG path generation for sparklines and bar charts | Already installed for the map; reuse avoids new dependency |
| tailwindcss | ^4.2.2 | Styling with existing theme tokens | Already installed with custom sand/sage/safe/danger palette |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs | built-in | Build-time data loading from JSON files | Reading `latest.json` and historical snapshots |
| node:path | built-in | Path resolution for data files | Constructing file paths to `data/scores/` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| D3 for sparkline | @fnando/sparkline or hand-rolled SVG path | D3 already installed; adding another dep is wasteful |
| D3 for bars | Pure CSS width bars | CSS bars are simpler but lack the color interpolation needed for the gradient; D3 `scaleLinear` + `interpolate` gives exact blue-yellow-red mapping |
| Chart.js / Recharts | N/A | Would add 50-200KB for simple charts; massive overkill for SSG sparklines |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  pages/
    en/
      country/
        [slug].astro          # EN country detail pages
    it/
      paese/
        [slug].astro          # IT country detail pages
  components/
    country/
      ScoreHero.astro         # Large score number + color badge
      PillarBreakdown.astro   # Horizontal bar chart for 5 pillars
      AdvisoryCard.astro      # Single advisory badge card
      AdvisorySection.astro   # Container for advisory cards
      TrendSparkline.astro    # SVG sparkline for score history
      CountrySummary.astro    # Auto-generated text block
      SourcesList.astro       # Sources footer with linked citations
  lib/
    scores.ts                 # Build-time data loading utilities
    colors.ts                 # Shared color scale (blue-yellow-red) for reuse
```

### Pattern 1: Astro getStaticPaths with Build-Time Data
**What:** Load all scored countries at build time and generate a static page per country per locale.
**When to use:** For all country detail pages.
**Example:**
```typescript
// src/pages/en/country/[slug].astro
---
import type { GetStaticPaths } from 'astro';
import type { DailySnapshot, ScoredCountry } from '../../../pipeline/types';
import Base from '../../../layouts/Base.astro';
import { loadLatestScores, loadHistoricalScores } from '../../../lib/scores';

export const getStaticPaths: GetStaticPaths = async () => {
  const countries = await loadLatestScores();
  return countries.map((country) => ({
    params: { slug: country.iso3.toLowerCase() },
    props: { country },
  }));
};

const { country } = Astro.props as { country: ScoredCountry };
const lang = 'en';
const history = await loadHistoricalScores(country.iso3, 90);
---
<Base lang={lang} title={country.name.en}>
  <!-- page content -->
</Base>
```

### Pattern 2: Build-Time SVG Generation (Zero Client JS)
**What:** Use D3's path generators in Astro frontmatter to create SVG strings at build time.
**When to use:** For sparklines and bar fill colors -- no client-side interactivity needed.
**Example:**
```typescript
// In .astro frontmatter (runs at build time)
import { scaleLinear, line } from 'd3';

const x = scaleLinear().domain([0, data.length - 1]).range([0, width]);
const y = scaleLinear().domain([1, 10]).range([height, 0]);
const sparklinePath = line<number>()
  .x((_, i) => x(i))
  .y((d) => y(d))(data);
```
```html
<!-- In template (pure SVG, no JS) -->
<svg viewBox={`0 0 ${width} ${height}`} class="w-full h-12">
  <path d={sparklinePath} fill="none" stroke="currentColor" stroke-width="1.5" />
</svg>
```

### Pattern 3: Shared Color Scale
**What:** A reusable function that maps score values (1-10) to the blue-yellow-red gradient.
**When to use:** Score hero badge, pillar bars, sparkline endpoint dot.
**Example:**
```typescript
// src/lib/colors.ts
import { scaleLinear, interpolateRgb } from 'd3';

// Matches the CSS custom properties: --color-safe, --color-moderate, --color-danger
// Using actual color values since D3 needs concrete values, not CSS vars
const safeColor = '#3b82f6';    // Blue
const moderateColor = '#eab308'; // Yellow
const dangerColor = '#b91c1c';   // Red

export function scoreToColor(score: number): string {
  // Score 1-10: 10 = safest (blue), 1 = most dangerous (red)
  const t = (score - 1) / 9; // 0 to 1
  if (t >= 0.5) {
    return interpolateRgb(moderateColor, safeColor)((t - 0.5) * 2);
  }
  return interpolateRgb(dangerColor, moderateColor)(t * 2);
}

export function pillarToColor(normalizedScore: number): string {
  // Pillar score 0-1: reuse same gradient
  return scoreToColor(normalizedScore * 9 + 1);
}
```

### Pattern 4: Duplicate Page Files for Locale Routing
**What:** Astro SSG with `prefixDefaultLocale` requires separate page files per locale directory.
**When to use:** For country pages in both `/en/country/` and `/it/paese/`.
**Critical note:** The two page files share logic but differ in `lang` constant and import paths. Extract shared logic into components and `lib/scores.ts` to minimize duplication.

### Anti-Patterns to Avoid
- **Client islands for static charts:** Do NOT use `client:load` or `client:visible` for the sparkline or bars. These are build-time SVGs -- no interactivity needed.
- **Loading data in each component:** Load data ONCE in `getStaticPaths` and pass via props. Do not call `node:fs` inside components.
- **Hardcoded color values in templates:** Use the shared `scoreToColor()` function for consistency.
- **Country name as URL slug:** The map already navigates to `/{lang}/{countryRoute}/{iso3.toLowerCase()}`. Country pages MUST use ISO3 lowercase as the slug (e.g., `usa`, `ita`, `fra`), NOT localized country names.

## CRITICAL: URL Slug Implementation

**The CONTEXT.md states** slugs are "derived from country name (kebab-case, localized)" -- e.g., `/en/country/italy` vs `/it/paese/italia`.

**The ACTUAL implementation** in `SafetyMap.astro` (line 239) navigates to `/{lang}/{countryRoute}/{iso3.toLowerCase()}` -- e.g., `/en/country/ita`.

**Resolution:** The page slug MUST use ISO3 lowercase to match the existing map navigation. Using country names would break all map click links. The route segment (`country` vs `paese`) is already handled by `getLocalizedPath()` and the `routes` config in `ui.ts`.

Final URL examples:
- `/en/country/usa` (English, United States)
- `/it/paese/usa` (Italian, United States)
- `/en/country/ita` (English, Italy)
- `/it/paese/ita` (Italian, Italy)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color interpolation | Manual RGB math | D3 `interpolateRgb` + `scaleLinear` | Edge cases with color spaces, perceptual uniformity |
| SVG sparkline paths | Manual `d` attribute string building | D3 `line()` generator | Handles missing points, coordinate scaling |
| Score normalization for display | Custom math | D3 `scaleLinear` for mapping score ranges | Tested, handles edge cases |
| Date formatting | String manipulation | `Intl.DateTimeFormat` with locale | Locale-aware, handles all edge cases |
| Slug generation | Custom slugify function | `iso3.toLowerCase()` | Already the established pattern from Phase 3 |

**Key insight:** D3 is already in the bundle for the map. Using its utility functions (scales, line generators, color interpolation) at build time adds zero runtime cost and avoids reimplementing well-tested math.

## Common Pitfalls

### Pitfall 1: Client-Side JS Where None Is Needed
**What goes wrong:** Adding `client:load` directives for charts, shipping D3 to the browser.
**Why it happens:** Developers default to client-side rendering for "interactive" components.
**How to avoid:** ALL chart SVGs are generated in Astro frontmatter at build time. The sparkline and bars are static visual representations -- no hover, zoom, or pan needed.
**Warning signs:** Seeing `client:` directives, D3 appearing in browser bundle.

### Pitfall 2: Slug Mismatch Between Map and Country Pages
**What goes wrong:** Country pages use name-based slugs while map links use ISO3.
**Why it happens:** CONTEXT.md suggests localized name slugs, but the map was implemented with ISO3.
**How to avoid:** Use `country.iso3.toLowerCase()` as the slug in `getStaticPaths`. Verify by checking that map click URLs resolve to generated pages.
**Warning signs:** 404s when clicking countries on the map.

### Pitfall 3: Missing Historical Data Handling
**What goes wrong:** Sparkline breaks or shows empty when fewer than 7 days of snapshots exist.
**Why it happens:** Pipeline may have just started; currently only `latest.json` exists with no date-stamped snapshots.
**How to avoid:** Always handle the case of 0-6 data points gracefully. Show "Trend data accumulating" message per CONTEXT.md decision. Render available points even if only 1-2 exist.
**Warning signs:** Empty chart area, errors during build.

### Pitfall 4: Empty Advisories Object
**What goes wrong:** Rendering advisory cards for undefined advisories, or showing empty card placeholders.
**Why it happens:** Many countries have `advisories: {}` with neither `us` nor `uk` present.
**How to avoid:** Only render advisory cards when `advisories.us` or `advisories.uk` exists. If neither exists, show a brief note or omit the section entirely.
**Warning signs:** Empty cards, "undefined" text in advisory section.

### Pitfall 5: Duplicate Page Files Diverging
**What goes wrong:** EN and IT page files get out of sync as changes are made.
**Why it happens:** Two `[slug].astro` files in different directories.
**How to avoid:** Extract ALL logic into shared components and `lib/scores.ts`. The page files should be thin wrappers: set `lang`, call `getStaticPaths`, render shared layout.
**Warning signs:** Bug fixed in one locale but not the other.

### Pitfall 6: Color Values Not Matching Map
**What goes wrong:** Score badge and pillar bars use different colors than the map.
**Why it happens:** Colors defined in multiple places (CSS vars, D3 scales, inline values).
**How to avoid:** Create a single `src/lib/colors.ts` module with the authoritative color scale. Both map and country pages import from here.
**Warning signs:** Visual inconsistency between map and detail page.

### Pitfall 7: Data Loading Performance at Build Time
**What goes wrong:** Build time becomes very long reading 90 daily snapshot files per country.
**Why it happens:** Each country page reads up to 90 JSON files for historical trend data.
**How to avoid:** Load ALL historical snapshots once in a shared utility, build a lookup map keyed by ISO3, then pass the relevant slice to each page. The `getStaticPaths` call can precompute all history.
**Warning signs:** Build times over 60 seconds for ~200 country pages.

## Code Examples

### Data Loading Utility
```typescript
// src/lib/scores.ts
import fs from 'node:fs';
import path from 'node:path';
import type { DailySnapshot, ScoredCountry } from '../pipeline/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'scores');

export function loadLatestSnapshot(): DailySnapshot | null {
  const filePath = path.join(DATA_DIR, 'latest.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function loadLatestScores(): ScoredCountry[] {
  const snapshot = loadLatestSnapshot();
  return snapshot?.countries ?? [];
}

export interface HistoryPoint {
  date: string;
  score: number;
}

export function loadHistoricalScores(days: number = 90): Map<string, HistoryPoint[]> {
  const history = new Map<string, HistoryPoint[]>();
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(-days);

  for (const file of files) {
    const snapshot: DailySnapshot = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
    );
    for (const country of snapshot.countries) {
      const points = history.get(country.iso3) ?? [];
      points.push({ date: snapshot.date, score: country.score });
      history.set(country.iso3, points);
    }
  }
  return history;
}
```

### getStaticPaths with Pre-computed History
```typescript
// In [slug].astro frontmatter
export const getStaticPaths: GetStaticPaths = async () => {
  const countries = loadLatestScores();
  const history = loadHistoricalScores(90);

  return countries.map((country) => ({
    params: { slug: country.iso3.toLowerCase() },
    props: {
      country,
      trend: history.get(country.iso3) ?? [],
    },
  }));
};
```

### Build-Time SVG Sparkline
```typescript
// In TrendSparkline.astro frontmatter
import { scaleLinear, line as d3Line } from 'd3';
import type { HistoryPoint } from '../lib/scores';

interface Props {
  data: HistoryPoint[];
  width?: number;
  height?: number;
}

const { data, width = 200, height = 48 } = Astro.props;
const hasEnoughData = data.length >= 7;
const padding = 4;

let pathD = '';
let endDot = { cx: 0, cy: 0 };

if (data.length >= 2) {
  const x = scaleLinear()
    .domain([0, data.length - 1])
    .range([padding, width - padding]);
  const y = scaleLinear()
    .domain([1, 10])
    .range([height - padding, padding]);

  const lineGen = d3Line<HistoryPoint>()
    .x((_, i) => x(i))
    .y((d) => y(d.score));

  pathD = lineGen(data) ?? '';
  endDot = { cx: x(data.length - 1), cy: y(data[data.length - 1].score) };
}
```

### Horizontal Pillar Bar
```typescript
// In PillarBreakdown.astro frontmatter
import type { PillarScore } from '../pipeline/types';
import { pillarToColor } from '../lib/colors';

interface Props {
  pillars: PillarScore[];
  lang: 'en' | 'it';
}

const { pillars, lang } = Astro.props;

const pillarLabels = {
  en: { conflict: 'Conflict', crime: 'Crime', health: 'Health', governance: 'Governance', environment: 'Environment' },
  it: { conflict: 'Conflitto', crime: 'Criminalita', health: 'Salute', governance: 'Governance', environment: 'Ambiente' },
};
```

### Auto-Generated Summary Template
```typescript
// i18n approach: add template strings to ui.ts
// Example EN template:
'country.summary': '{name} has an overall safety score of {score} out of 10. {strongestText}{weakestText}{advisoryText}Data was last updated on {lastUpdated}.',
'country.strongest': 'The strongest category is {pillar} ({pillarScore}/10). ',
'country.weakest': 'The area of most concern is {pillar} ({pillarScore}/10). ',
'country.advisory.warning': 'The {source} advises level {level} caution. ',
'country.trend.accumulating': 'Trend data accumulating',
```

### hreflang for Country Pages
```typescript
// The existing Base.astro already handles hreflang via getAlternateLinks()
// The getLocalizedPath() function in utils.ts translates 'country' -> 'paese'
// and preserves the ISO3 slug unchanged.
// So /en/country/ita -> /it/paese/ita automatically.
// No additional hreflang work needed beyond passing the correct currentPath.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side chart rendering | Build-time SVG generation | Astro SSG pattern | Zero JS shipped for charts |
| Separate chart library (Chart.js) | D3 utility functions at build time | Project already uses D3 | No new dependency, smaller build |
| CSS-only bars with `width: %` | D3 color interpolation + CSS width | N/A | Enables consistent gradient coloring |
| REST API for score data | Build-time JSON file reads | Astro SSG pattern | No runtime API, instant page loads |

**Deprecated/outdated:**
- Chart.js in SSG context: overkill, ships large runtime bundle
- `Astro.glob()` for data loading: use `node:fs` directly for non-Astro files (JSON data)

## Open Questions

1. **Color value synchronization between CSS and D3**
   - What we know: CSS uses oklch values (`--color-safe`, `--color-moderate`, `--color-danger`); D3 needs concrete hex/rgb values
   - What's unclear: Exact hex equivalents of the oklch theme colors
   - Recommendation: Extract oklch to hex conversions once, define canonical hex values in `src/lib/colors.ts`, use consistently. Or use D3's oklch support if available.

2. **Advisory level color schemes**
   - What we know: US State Dept uses 4 levels (1-4), UK FCDO uses different categories
   - What's unclear: Whether advisory data currently includes the level as a numeric or string
   - Recommendation: The `AdvisoryInfo.level` type is `number | string` -- handle both. Map known values to colors.

3. **Build performance with 200+ countries x 2 locales x 90 history files**
   - What we know: Could be ~400 pages, each needing historical data
   - What's unclear: Actual build time impact
   - Recommendation: Pre-compute ALL history once in `getStaticPaths`, not per-page. This reduces file reads from 400x90 to just 90.

## Sources

### Primary (HIGH confidence)
- Project source code: `src/pipeline/types.ts`, `src/i18n/ui.ts`, `src/i18n/utils.ts`, `src/components/SafetyMap.astro`, `src/pages/en/index.astro`
- Astro routing docs: https://docs.astro.build/en/guides/routing/ - getStaticPaths pattern
- D3 v7 (already installed in project)

### Secondary (MEDIUM confidence)
- Astro dynamic routes: https://docs.astro.build/en/reference/routing-reference/ - rest parameters
- fnando/sparkline approach (not recommended, but validates SVG sparkline pattern): https://github.com/fnando/sparkline
- Inline SVG sparkline approach: https://alexplescan.com/posts/2023/07/08/easy-svg-sparklines/

### Tertiary (LOW confidence)
- None -- all findings verified against installed packages and source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and verified in package.json
- Architecture: HIGH - patterns derived from existing codebase (data loading, i18n, routing)
- Pitfalls: HIGH - identified from direct code inspection (slug mismatch, empty data handling)

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- Astro 6 and D3 v7 are mature)
