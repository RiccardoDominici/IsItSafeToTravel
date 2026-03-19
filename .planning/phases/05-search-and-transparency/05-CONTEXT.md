# Phase 5: Search and Transparency - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Autocomplete country search, dedicated methodology page explaining the scoring system, and legal disclaimers on every page. Users can find any country instantly and understand exactly how scores are computed. Does NOT include city-level search (v2), regional drill-down (v2), or SEO optimizations (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Search behavior (SRCH-01, SRCH-02)
- Client-side fuzzy search over static country list — no API, zero cost, SSG-compatible
- Search data: 248 countries from COUNTRIES array with EN+IT localized names
- Compact search icon in header that expands to full input on click/focus — saves header space on mobile
- Search visible and accessible from every page via the header
- Country names only for v1 — city search deferred (data is country-level only)
- Fuzzy matching tolerant of typos and partial input (e.g., "Ital" matches "Italy")

### Search results display
- Dropdown below search input showing matching countries
- Each result shows: country name (localized) + safety score with color indicator
- Selecting a result navigates directly to `/{locale}/country/{slug}` (SRCH-02)
- Keyboard navigation: arrow keys to browse results, Enter to select, Escape to close
- Empty state: "No countries found" message when no matches
- Maximum ~10 results shown at a time to keep dropdown manageable

### Methodology page (TRNS-01)
- Dedicated page at `/{locale}/methodology/` (routes already configured in i18n/ui.ts)
- Static content page, no interactivity — zero client JS, SSG pattern
- Scoring weights and formula auto-generated from scoring config at build time — single source of truth
- Page sections: Overview, Data Sources table, Scoring Formula, Category Weights with rationale, Limitations/Caveats
- Each data source listed with: name, what it measures, update frequency, link to original
- Category weights displayed as table or visual breakdown showing relative importance
- Tone: transparent and educational — explain the "why" behind each weight choice
- Localized EN + IT using i18n system

### Legal disclaimer (TRNS-02)
- Short inline disclaimer in footer on every page — footer.disclaimer string already exists
- Dedicated legal page accessible from footer for full legal text
- Disclaimer covers: informational purpose only, not travel advice, consult official government advisories, data may be incomplete or delayed
- Legal page at `/{locale}/legal/` (new route slug needed in i18n config)
- Neutral, clear legal language — not intimidating, but thorough

### Claude's Discretion
- Fuzzy search library choice (e.g., Fuse.js, custom filter, or native string matching)
- Search component implementation pattern (client island hydration strategy)
- Methodology page layout and typography
- Legal page structure and exact wording
- Responsive behavior of search dropdown on mobile
- Transition/animation of search expand/collapse

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — Core value (transparency), constraints (near-zero budget, impartiality, WCAG 2.1 AA)
- `.planning/REQUIREMENTS.md` — SRCH-01 (autocomplete search), SRCH-02 (result links to detail page), TRNS-01 (methodology page), TRNS-02 (legal disclaimer every page)

### Prior phase context
- `.planning/phases/01-project-foundation/01-CONTEXT.md` — Visual identity: warm palette, dark mode, Inter + DM Sans fonts, Tailwind CSS 4, translated URL slugs
- `.planning/phases/03-interactive-map/03-CONTEXT.md` — Client island pattern for interactive components, country click URL pattern
- `.planning/phases/04-country-detail-pages/04-CONTEXT.md` — Country page URL pattern `/{locale}/country/{slug}`, build-time data loading, i18n strings pattern

### Scoring system (methodology page source of truth)
- `src/pipeline/scoring/engine.ts` — Scoring engine with weighted aggregation formula
- `src/pipeline/scoring/normalize.ts` — Normalization logic for raw indicator values
- `src/pipeline/types.ts` — ScoredCountry, PillarScore types defining the data model

### Search data source
- `src/pipeline/config/countries.ts` — COUNTRIES array with 248 entries, iso3/iso2/name(en,it) — search index source

### Existing i18n & routing
- `src/i18n/ui.ts` — Translation strings and route slugs (methodology route already defined)
- `src/i18n/utils.ts` — useTranslations(), getLocalizedPath() utilities
- `src/components/Header.astro` — Navigation with methodology link already present, search goes here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `COUNTRIES` array (248 entries with EN+IT names): Direct search index — no separate data file needed
- `Header.astro`: Search component integrates here; already has methodology nav link
- `Footer.astro`: Already has `footer.disclaimer` string rendered; legal link adds here
- `Base.astro` layout: New pages (methodology, legal) extend this for consistent chrome
- `useTranslations()` / `routes`: i18n infrastructure ready for new page strings
- `loadLatestScores()` from `src/lib/scores.ts`: Can provide score data for search result previews

### Established Patterns
- Client-side Astro islands for interactivity (search needs `client:load` or `client:visible`)
- Build-time data loading via `node:fs` for static content (methodology weights from scoring config)
- Tailwind CSS 4 with sand palette and custom theme tokens
- `getStaticPaths()` for localized page generation
- Zero client JS for content pages (methodology and legal should follow this)

### Integration Points
- Header: Search component mounts in header actions area
- Navigation: Methodology link already exists — just needs the page to exist
- Footer: Disclaimer already shown; add legal page link
- Country detail pages: Search results link to existing `/{locale}/country/{slug}` URLs
- Scoring config: Methodology page reads weights/formula from scoring engine source

</code_context>

<specifics>
## Specific Ideas

- Search should feel instant — client-side filtering over a small static dataset, no loading spinners
- Methodology page must be genuinely educational, not just a data dump — explain WHY each source was chosen and WHY weights are set as they are
- Footer disclaimer is already there from Phase 1 — this phase adds the dedicated legal page with expanded text
- Consistency: search score colors match the map and country page color language (blue-yellow-red)

</specifics>

<deferred>
## Deferred Ideas

- City-level search (FEAT-04) — requires city-level data, v2 scope
- Search by region — requires regional data, v2 scope
- Search filters (by score range, by continent) — potential future enhancement

</deferred>

---

*Phase: 05-search-and-transparency*
*Context gathered: 2026-03-19*
