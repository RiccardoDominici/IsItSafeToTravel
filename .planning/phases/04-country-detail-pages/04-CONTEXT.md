# Phase 4: Country Detail Pages - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Every country has a dedicated page that explains its safety score with full transparency and sourcing. Each page shows the composite score (1-10), category sub-score breakdown with visual indicators, historical trend sparkline, government advisory levels (US, UK), all data sources with links, and auto-generated descriptive content. Pages are statically generated at build time, localized for EN + IT, and linked from the interactive map. Does NOT include search (Phase 5), methodology page (Phase 5), SEO optimizations (Phase 6), or regional drill-down (v2).

</domain>

<decisions>
## Implementation Decisions

### Score presentation & page layout
- Large hero number with color badge at top of page — immediate visual impact using the same blue-yellow-red color language as the map
- Page section order: Score hero → Category breakdown → Advisory cards → Trend chart → Sources footer
- Medium information density — spacious but not sparse, matching the travel magazine feel (Phase 1 decision)
- Score hero shows: country name (localized), composite score as large number, color-coded badge, data freshness timestamp

### Category sub-score breakdown (CTRY-02)
- Horizontal bars with color fill for each of 5 pillars (conflict, crime, health, governance, environment)
- Each bar shows: pillar name (localized), normalized score (0-1 mapped to visual width), data completeness indicator
- Color fill follows the same blue-yellow-red gradient as the map — consistent visual language throughout
- Bars ordered by weight or score severity (Claude's discretion on exact ordering)

### Trend visualization (CTRY-03)
- Line chart/sparkline showing composite score evolution over last 90 days
- Historical data loaded at build time by reading daily snapshot files from `data/scores/`
- Only composite score in the sparkline — per-pillar detail stays in the breakdown section
- If fewer than 7 days of data: show available points with note "Trend data accumulating"

### Advisory display (CTRY-04)
- Colored badge cards for each available advisory (US State Dept, UK FCDO)
- Each card shows: advisory level, summary text, source link, last updated date
- Positioned below category breakdown, above trend chart
- Only show advisories that exist for the country — no empty placeholders for missing ones
- Advisory level color coding matches the source's own scheme (familiar to travelers)

### Auto-generated content (CTRY-06)
- Template-driven summary paragraph per country — deterministic, no AI generation
- Content includes: overall safety assessment, strongest/weakest categories, notable advisory warnings, data freshness
- Template strings live in the i18n system with variable interpolation — fully translatable EN + IT
- Tone: informative and neutral — factual observations only, no travel recommendations (impartiality constraint)

### Sources section (CTRY-05, TRNS-03)
- Sources listed at bottom of each page with linked citations
- Each source shows: name, description, link to original, fetch date
- Data already available in `ScoredCountry.sources: SourceMeta[]` — render directly

### URL structure & routing
- URL pattern: `/{locale}/country/{slug}` (confirmed in Phase 3 map click navigation)
- Slug derived from country name (kebab-case, localized) — `/en/country/italy` vs `/it/paese/italia`
- Dynamic routes using Astro `getStaticPaths()` — one page generated per scored country per locale
- hreflang tags linking EN ↔ IT versions of each country page

### Claude's Discretion
- Exact sparkline/chart library choice (lightweight, SSG-compatible)
- Bar chart component implementation details
- Spacing, typography scale within the established design system
- Responsive breakpoints for mobile layout of score cards and charts
- How to handle countries with very low data completeness (visual treatment)
- Exact template wording for auto-generated summaries

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — Core value, constraints (near-zero budget, impartiality, WCAG 2.1 AA, free APIs only)
- `.planning/REQUIREMENTS.md` — CTRY-01 through CTRY-06, TRNS-03 define all country detail page requirements

### Prior phase context
- `.planning/phases/01-project-foundation/01-CONTEXT.md` — Visual identity: warm palette, blue-yellow-red gradient, dark mode, Inter + DM Sans, Tailwind CSS 4, translated URL slugs
- `.planning/phases/02-data-pipeline-and-scoring-engine/02-CONTEXT.md` — Data format: ScoredCountry with pillars, advisories, sources; JSON in data/scores/; daily snapshots
- `.planning/phases/03-interactive-map/03-CONTEXT.md` — Map click URL pattern `/{locale}/country/{slug}`, build-time data loading via node:fs, client island pattern

### Pipeline types (critical)
- `src/pipeline/types.ts` — ScoredCountry, PillarScore, AdvisoryInfo, SourceMeta, DailySnapshot interfaces — country pages render these types directly

### Existing layouts & components
- `src/layouts/Base.astro` — Base layout with i18n, hreflang, font loading — country pages extend this
- `src/components/Header.astro` — Header with navigation, language switcher, dark mode toggle
- `src/components/Footer.astro` — Footer component
- `src/i18n/ui.ts` — Translation strings, Lang type — country page strings added here
- `src/i18n/utils.ts` — useTranslations(), getLocalizedPath() utilities

### Data files
- `data/scores/latest.json` — Current scored countries (DailySnapshot format)
- `data/scores/YYYY-MM-DD.json` — Historical daily snapshots for trend calculation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Base.astro` layout — Country pages extend this directly (i18n, meta tags, fonts, dark mode)
- `Header.astro` / `Footer.astro` — Consistent site chrome, already working
- `useTranslations()` from `src/i18n/utils.ts` — For localized country names and UI strings
- `ScoredCountry` type from `src/pipeline/types.ts` — Complete data contract with pillars, advisories, sources
- Build-time data loading pattern from `src/pages/en/index.astro` — node:fs + JSON parse, same approach for country pages

### Established Patterns
- Astro 6 with client-side islands for interactivity (charts will need `client:load` or `client:visible`)
- Tailwind CSS 4 with custom theme tokens (sand palette, blue-yellow-red gradient colors)
- ESM TypeScript throughout, Node.js >=22.12
- `getStaticPaths()` for dynamic route generation in Astro SSG

### Integration Points
- Map click (Phase 3) navigates to `/{locale}/country/{slug}` — URL must match exactly
- `data/scores/latest.json` provides current scores; daily snapshots provide trend data
- Country ISO3 codes link map data to page data (consistent key across pipeline)
- i18n country names in `ScoredCountry.name.{en,it}` — no separate lookup needed
- Dark mode toggle already works globally — country pages inherit behavior

</code_context>

<specifics>
## Specific Ideas

- Travel magazine feel from Phase 1 — country pages should feel warm and informative, not like a government report
- Colorblind-safe gradient carries through to all visual indicators (bars, score badge) — not just the map
- Full Italian translation includes auto-generated summary text — template interpolation, not separate copywriting
- Transparency is core: every score must be traceable to its sources (PROJECT.md principle)
- Zero-budget: chart library must be lightweight and free — no paid visualization tools

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-country-detail-pages*
*Context gathered: 2026-03-19*
