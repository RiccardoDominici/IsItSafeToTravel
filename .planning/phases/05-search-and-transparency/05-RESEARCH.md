# Phase 5: Search and Transparency - Research

**Researched:** 2026-03-19
**Domain:** Client-side fuzzy search, static content pages, Astro islands
**Confidence:** HIGH

## Summary

This phase adds four capabilities: autocomplete country search (SRCH-01, SRCH-02), a methodology page (TRNS-01), and legal disclaimers (TRNS-02). The search is a client-side fuzzy filter over the existing 248-entry COUNTRIES array -- no backend needed. Fuse.js (7.1.0) is the standard library for this: zero dependencies, ~6KB gzipped, purpose-built for small-dataset fuzzy matching with typo tolerance. The methodology and legal pages are pure static content (zero client JS), following the exact same Astro SSG pattern already used for country detail pages.

The search component is the only interactive island in this phase. It should use Astro's `client:load` directive since it lives in the header and must be interactive immediately. The methodology page reads weights from `src/pipeline/config/weights.json` at build time -- single source of truth, no duplication. The legal page is a new route that needs a slug added to `src/i18n/ui.ts`.

**Primary recommendation:** Use Fuse.js for fuzzy search over the static COUNTRIES array, delivered as an Astro island with `client:load`. Methodology and legal pages are pure static Astro pages with zero client JS.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Client-side fuzzy search over static country list -- no API, zero cost, SSG-compatible
- Search data: 248 countries from COUNTRIES array with EN+IT localized names
- Compact search icon in header that expands to full input on click/focus
- Search visible and accessible from every page via the header
- Country names only for v1 -- city search deferred
- Fuzzy matching tolerant of typos and partial input
- Dropdown below search input showing matching countries
- Each result shows: country name (localized) + safety score with color indicator
- Selecting a result navigates to `/{locale}/country/{slug}`
- Keyboard navigation: arrow keys, Enter, Escape
- Empty state: "No countries found" message
- Maximum ~10 results shown at a time
- Methodology page at `/{locale}/methodology/` (routes already configured)
- Static content page, zero client JS, SSG pattern
- Scoring weights and formula auto-generated from scoring config at build time
- Sections: Overview, Data Sources, Scoring Formula, Category Weights, Limitations/Caveats
- Each data source listed with name, measure, update frequency, link
- Localized EN + IT
- Short inline disclaimer in footer (already exists)
- Dedicated legal page at `/{locale}/legal/` (new route slug needed)
- Legal page covers: informational purpose only, not travel advice, consult official advisories, data may be incomplete/delayed

### Claude's Discretion
- Fuzzy search library choice (Fuse.js recommended -- see Standard Stack)
- Search component implementation pattern (client island hydration strategy)
- Methodology page layout and typography
- Legal page structure and exact wording
- Responsive behavior of search dropdown on mobile
- Transition/animation of search expand/collapse

### Deferred Ideas (OUT OF SCOPE)
- City-level search (FEAT-04)
- Search by region
- Search filters (by score range, by continent)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRCH-01 | User can search for any country with autocomplete suggestions | Fuse.js fuzzy search over COUNTRIES array, Astro island with `client:load`, dropdown results component |
| SRCH-02 | Search results link directly to the destination detail page | Each result navigates to `/{locale}/country/{slug}` using existing route pattern from Phase 4 |
| TRNS-01 | Dedicated methodology page explains scoring formula, weights, and rationale | Static Astro page reading `weights.json` at build time, same SSG pattern as country pages |
| TRNS-02 | Legal disclaimer on every page clarifying informational nature | Footer already has disclaimer text; add dedicated legal page at new `/{locale}/legal/` route |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Fuse.js | 7.1.0 | Client-side fuzzy search | Zero dependencies, ~6KB gzipped, purpose-built for fuzzy matching on small datasets, typo-tolerant, widely adopted |

### Already Installed (reuse)
| Library | Version | Purpose | Use In This Phase |
|---------|---------|---------|-------------------|
| Astro | ^6.0.6 | SSG framework | Static pages (methodology, legal), island hydration for search |
| D3 | ^7.9.0 | Color scale | `scoreToColor()` for search result score indicators |
| Tailwind CSS | ^4.2.2 | Styling | All new components and pages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fuse.js | Native `String.includes()` / `startsWith()` | Simpler but no typo tolerance, no weighted field search, no fuzzy matching |
| Fuse.js | FlexSearch | Faster on large datasets but overkill for 248 items, heavier bundle |
| Fuse.js | Custom Levenshtein filter | Hand-rolling fuzzy logic is error-prone and slower to implement; Fuse.js handles this well |

**Recommendation: Use Fuse.js.** For 248 items, Fuse.js search is effectively instant (<1ms). The typo tolerance is important for non-English country name variants (e.g., "Bielorrusia" matching "Bielorussia").

**Installation:**
```bash
npm install fuse.js
```

## Architecture Patterns

### New Files Structure
```
src/
├── components/
│   └── Search.astro           # Astro wrapper that serializes search data
│   └── SearchIsland.tsx        # Client-side interactive search (Preact/vanilla JS)
├── pages/
│   ├── en/
│   │   ├── methodology/
│   │   │   └── index.astro     # EN methodology page
│   │   └── legal/
│   │       └── index.astro     # EN legal page
│   └── it/
│       ├── metodologia/
│       │   └── index.astro     # IT methodology page
│       └── note-legali/
│           └── index.astro     # IT legal page
├── lib/
│   └── search-data.ts          # Build-time function to prepare search index data
```

### Pattern 1: Search as Astro Island (SRCH-01, SRCH-02)

**What:** A client-side interactive search component hydrated via `client:load` in the header.

**When to use:** Any interactive component that needs immediate interactivity (above the fold, user-facing).

**Implementation approach:**

The search component should be a standalone `.astro` file or framework component (vanilla TS with custom element, or a lightweight framework island). Since the project has no UI framework installed (no React/Preact/Vue), the cleanest approach is a **vanilla TypeScript web component** or a **script-based Astro component** using `<script>` tags.

Given Astro 6's patterns and the project's zero-framework approach, the recommended path is:

```astro
<!-- Search.astro - rendered in Header -->
---
import type { Lang } from '../i18n/ui';
import { loadLatestScores } from '../lib/scores';
import { COUNTRIES } from '../pipeline/config/countries';

interface Props {
  lang: Lang;
}

const { lang } = Astro.props;
const scores = loadLatestScores();

// Build lightweight search dataset at build time
const searchData = COUNTRIES.map(c => {
  const scored = scores.find(s => s.iso3 === c.iso3);
  return {
    iso3: c.iso3,
    name: c.name[lang],
    score: scored?.scoreDisplay ?? null,
  };
});
---
<div class="search-container" data-search={JSON.stringify(searchData)} data-lang={lang}>
  <!-- Search icon button, input, dropdown markup -->
</div>

<script>
  // Client-side: import Fuse, initialize on the serialized data
  import Fuse from 'fuse.js';
  // ... interactive logic
</script>
```

**Key design points:**
- Data is serialized at build time via `data-*` attribute (same pattern as the map component)
- Fuse.js is imported in the `<script>` tag (tree-shaken, only loads on pages with search)
- No framework dependency needed -- vanilla DOM manipulation is fine for a search dropdown
- The `<script>` tag in Astro components is bundled and deduplicated automatically

### Pattern 2: Static Content Pages (TRNS-01, TRNS-02)

**What:** Pure SSG pages with no client JavaScript, extending the Base layout.

**When to use:** Content pages like methodology and legal.

**Example (follows existing country page pattern):**
```astro
---
// src/pages/en/methodology/index.astro
import Base from '../../../layouts/Base.astro';
import { useTranslations } from '../../../i18n/utils';
import type { Lang } from '../../../i18n/ui';
import weightsConfig from '../../../pipeline/config/weights.json';

const lang: Lang = 'en';
const t = useTranslations(lang);
---
<Base lang={lang} title="Methodology" description="How we calculate safety scores">
  <div class="max-w-4xl mx-auto px-4 py-8 prose dark:prose-invert">
    <!-- Static content using weightsConfig data -->
  </div>
</Base>
```

### Pattern 3: Build-Time Data from weights.json

**What:** Import `weights.json` directly in Astro frontmatter for methodology page content.

**Why:** Single source of truth -- the same weights.json used by the scoring pipeline generates the methodology page content. If weights change, the methodology page automatically reflects it on next build.

```typescript
// In Astro frontmatter:
import weightsConfig from '../../../pipeline/config/weights.json';
// weightsConfig.pillars -> [{name: "conflict", weight: 0.20, indicators: [...]}, ...]
```

The INDICATOR_RANGES from `normalize.ts` can also be imported for the data source descriptions.

### Pattern 4: Localized Route Slugs

**What:** New route slug for legal page added to `src/i18n/ui.ts`.

```typescript
export const routes = {
  en: {
    country: 'country',
    about: 'about',
    methodology: 'methodology',
    legal: 'legal',            // NEW
  },
  it: {
    country: 'paese',
    about: 'chi-siamo',
    methodology: 'metodologia',
    legal: 'note-legali',      // NEW
  },
} as const;
```

Pages go at `src/pages/en/legal/index.astro` and `src/pages/it/note-legali/index.astro`, matching the slug pattern.

### Anti-Patterns to Avoid
- **API-based search for 248 items:** Unnecessary complexity. Client-side is instant for this dataset size.
- **Loading search data on every keystroke:** Build the Fuse index once on component mount, not per search. Fuse construction on 248 items is <5ms.
- **Using a framework just for search:** No need to add React/Preact for a single interactive component. Vanilla DOM + Astro `<script>` is lighter and simpler.
- **Duplicating weights data:** Never hardcode weights on the methodology page. Always read from `weights.json`.
- **Heavy animations on search expand:** Keep transitions CSS-only (transform + opacity). No JS animation libraries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Custom Levenshtein/edit-distance | Fuse.js | Edge cases with Unicode, diacritics, partial matching, scoring/ranking |
| Score-to-color mapping | New color logic | Existing `scoreToColor()` from `src/lib/colors.ts` | Consistency with map and country pages |
| Country slug generation | Custom slug function | `iso3.toLowerCase()` pattern from Phase 4 | Country pages already use ISO3 lowercase as slug |
| i18n string access | Manual locale switching | Existing `useTranslations()` | Already handles fallback to default lang |
| Route generation | Hardcoded paths | Existing `routes` object from `src/i18n/ui.ts` | Localized slugs automatically handled |

**Key insight:** This phase has minimal novel complexity. Most building blocks exist -- the search is the only genuinely new interactive component, and even it follows the established "data via data-attributes, script for interactivity" island pattern from Phase 3.

## Common Pitfalls

### Pitfall 1: Search Not Working Across Locales
**What goes wrong:** Search component initialized with EN names doesn't work on IT pages (or vice versa).
**Why it happens:** Forgetting to pass the current `lang` to the search data builder, so all pages get EN names.
**How to avoid:** The search data must be locale-aware. Pass `lang` to the component, use `c.name[lang]` when building the search index. Each locale's pages get their own serialized search dataset.
**Warning signs:** Typing Italian country name on IT page returns no results.

### Pitfall 2: Fuse.js Threshold Too Loose or Too Strict
**What goes wrong:** Search returns irrelevant matches (threshold too loose) or misses valid typos (too strict).
**Why it happens:** Default Fuse.js threshold is 0.6 which can be too permissive for short strings.
**How to avoid:** Start with `threshold: 0.3` and `minMatchCharLength: 2`. Test with common typos: "Itlay" -> "Italy", "Frnace" -> "France", "Ital" -> "Italy".
**Warning signs:** Typing "It" returns 50+ results, or typing "Itlay" returns nothing.

### Pitfall 3: Search Dropdown Overflow on Mobile
**What goes wrong:** Dropdown extends beyond viewport, becomes unscrollable.
**Why it happens:** Absolute positioning without max-height or viewport awareness.
**How to avoid:** Use `max-h-[60vh] overflow-y-auto` on the dropdown. On mobile, consider a full-width dropdown below the header.
**Warning signs:** Cannot scroll to see all results on small screens.

### Pitfall 4: Keyboard Trap in Search
**What goes wrong:** Screen reader users or keyboard users can't escape the search.
**Why it happens:** Missing Escape handler, no focus management.
**How to avoid:** Implement full keyboard nav: Tab into search, arrow keys to browse, Enter to select, Escape to close and return focus to trigger button. Add `role="combobox"`, `aria-expanded`, `aria-activedescendant`.
**Warning signs:** WCAG 2.1 AA keyboard accessibility failures.

### Pitfall 5: Methodology Page Content Staleness
**What goes wrong:** Methodology page describes weights that don't match actual scoring.
**Why it happens:** Hardcoding weight values in the page content instead of reading from config.
**How to avoid:** Import `weights.json` in Astro frontmatter, render weights dynamically. The page content generation should iterate over `weightsConfig.pillars`.
**Warning signs:** weights.json shows 0.20 for all pillars but methodology page says different values.

### Pitfall 6: Missing Legal Route in i18n Config
**What goes wrong:** Footer "Legal" link goes to homepage instead of legal page.
**Why it happens:** Footer already renders `{t('footer.legal')}` as a link, but the link currently points to `/${lang}/` (see Footer.astro line 40). The route slug for "legal" doesn't exist in `routes` yet.
**How to avoid:** Add `legal` to the `routes` object in `ui.ts` before creating the page. Update the Footer link to use `/${lang}/${r.legal}/`.
**Warning signs:** Clicking "Legal" in footer navigates to homepage.

## Code Examples

### Fuse.js Configuration for Country Search
```typescript
// Recommended Fuse.js options for country name search
import Fuse from 'fuse.js';

interface SearchItem {
  iso3: string;
  name: string;
  score: number | null;
}

const fuse = new Fuse<SearchItem>(searchData, {
  keys: ['name'],
  threshold: 0.3,        // Moderate fuzziness -- catches typos without noise
  minMatchCharLength: 2, // Don't search on single characters
  includeScore: true,     // For optional relevance-based sorting
  limit: 10,             // Max results to return
});

// Usage
const results = fuse.search(query); // Returns FuseResult<SearchItem>[]
```

### Search Navigation to Country Page
```typescript
// Navigate to country detail page on result selection
function navigateToCountry(iso3: string, lang: string) {
  const slug = iso3.toLowerCase();
  const routeSegment = lang === 'it' ? 'paese' : 'country';
  window.location.href = `/${lang}/${routeSegment}/${slug}/`;
}
```

### ARIA Combobox Pattern for Accessible Search
```html
<!-- Accessible autocomplete pattern -->
<div class="relative">
  <button aria-label="Search countries" aria-expanded="false" id="search-toggle">
    <!-- Search icon SVG -->
  </button>
  <div role="combobox" aria-expanded="false" aria-haspopup="listbox">
    <input
      type="text"
      role="searchbox"
      aria-autocomplete="list"
      aria-controls="search-listbox"
      aria-activedescendant=""
      placeholder="Search countries..."
    />
    <ul id="search-listbox" role="listbox" aria-label="Country suggestions">
      <li role="option" id="result-0" aria-selected="false">
        <!-- Country name + score badge -->
      </li>
    </ul>
  </div>
</div>
```

### Methodology Page Weights Table (Build-Time)
```astro
---
import weightsConfig from '../../../pipeline/config/weights.json';
---
<table>
  <thead>
    <tr><th>Category</th><th>Weight</th><th>Indicators</th></tr>
  </thead>
  <tbody>
    {weightsConfig.pillars.map(pillar => (
      <tr>
        <td>{pillar.name}</td>
        <td>{(pillar.weight * 100).toFixed(0)}%</td>
        <td>{pillar.indicators.join(', ')}</td>
      </tr>
    ))}
  </tbody>
</table>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side search API | Client-side fuzzy search (for small datasets) | Standard practice | Zero infrastructure cost, instant response, SSG-compatible |
| Custom fuzzy matching | Fuse.js library | Fuse.js v7 (2024) | Reliable, tested, handles Unicode edge cases |
| Framework-specific search components | Vanilla JS + Astro `<script>` | Astro 3+ islands | No framework dependency for simple interactivity |

**Current state of weights.json:**
All 5 pillars (conflict, crime, health, governance, environment) are equally weighted at 0.20 (20% each). The methodology page should explain this equal weighting and the rationale.

**Current indicator mapping:**
- Conflict: gpi_overall, acled_fatalities, acled_events
- Crime: gpi_safety_security, advisory_level_us, advisory_level_uk
- Health: inform_health, inform_epidemic
- Governance: inform_governance, gpi_militarisation
- Environment: inform_natural, inform_climate

## Open Questions

1. **Search component implementation: `<script>` tag vs framework island**
   - What we know: Project has no UI framework installed. Astro `<script>` tags work well for simple interactivity. The map component used data-attributes + inline script.
   - What's unclear: Whether a vanilla `<script>` approach handles the expand/collapse + dropdown + keyboard nav cleanly, or if complexity warrants adding Preact (~3KB).
   - Recommendation: Start with vanilla `<script>` approach following the map pattern. If keyboard navigation + ARIA management gets unwieldy, a Preact island is an acceptable fallback. Planner should plan for vanilla first.

2. **Legal page wording**
   - What we know: Must cover informational-only, not advice, consult government advisories, data limitations.
   - What's unclear: Exact legal language for an international audience.
   - Recommendation: Use standard informational disclaimer patterns. The planner can include a task for writing the content. This is not a legal review -- it's a reasonable best-effort disclaimer.

## Sources

### Primary (HIGH confidence)
- Fuse.js official site (https://www.fusejs.io/) -- API options, configuration
- Astro Islands docs (https://docs.astro.build/en/concepts/islands/) -- client:load directive behavior
- Project codebase -- `src/pipeline/config/weights.json`, `src/pipeline/config/countries.ts`, `src/i18n/ui.ts`, `src/components/Header.astro`, `src/lib/colors.ts`

### Secondary (MEDIUM confidence)
- npm registry: Fuse.js 7.1.0 confirmed as latest version via `npm view`
- Astro 6 island patterns observed in existing codebase (map component using data-attributes)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Fuse.js is the de facto standard for client-side fuzzy search, verified via npm
- Architecture: HIGH - Patterns directly follow established project conventions (data-attributes, SSG pages, i18n system)
- Pitfalls: HIGH - Based on direct codebase analysis (e.g., Footer.astro already has broken legal link)

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no fast-moving dependencies)
