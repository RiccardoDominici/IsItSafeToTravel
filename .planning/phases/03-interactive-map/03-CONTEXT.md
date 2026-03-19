# Phase 3: Interactive Map - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Color-coded interactive world map as the homepage hero. Users see every scored country colored by safety score (green-to-red), can zoom/pan, hover for quick info, and click to navigate to country detail pages. Does NOT include country detail pages (Phase 4), search (Phase 5), or regional drill-down (v2).

</domain>

<decisions>
## Implementation Decisions

### Map library & rendering
- SVG-based choropleth using D3 + topojson — no tile server, zero cost, SSG-compatible
- World topojson for country boundaries, projected client-side
- Countries colored using the blue→yellow→red colorblind-safe gradient (decided in Phase 1)
- Client-side Astro island — map hydrates on load for interactivity, rest of page is static
- Dark mode: map adapts background and country stroke colors to dark theme

### Hover/click interactions
- Hover: tooltip showing country name (localized) + safety score (e.g., "Italy — 8.2")
- Click: navigates to country detail page URL (/{locale}/country/{slug})
- Unscored countries: rendered in neutral gray, non-clickable, hover shows "No data available"
- Touch devices: tap replaces hover (tap once for tooltip, tap again or tap tooltip link to navigate)

### Mobile map experience
- Pinch-to-zoom and pan with touch gestures (MAP-02 requirement)
- Map fills available viewport on mobile — no horizontal scroll
- No list fallback — map is the primary interface (search comes in Phase 5)
- Zoom controls (+/- buttons) visible on both desktop and mobile

### Homepage layout
- Map as hero element, nearly full-viewport height (minus header)
- Brief tagline above map: site name + one-line value prop (localized)
- Minimal header with logo, language switcher, dark mode toggle (existing components)
- No content below the map — clean, focused landing page
- Footer remains at page bottom (existing Footer component)

### Claude's Discretion
- D3 projection choice (Natural Earth, Mercator, or other — pick what looks best for a choropleth)
- Topojson source and resolution (balance detail vs file size)
- Tooltip styling and positioning logic
- Zoom level limits (min/max)
- SVG vs Canvas rendering decision within D3
- Animation/transition on initial load
- Map color scale interpolation details within the blue→yellow→red range

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — Core value, constraints (near-zero budget, Cloudflare hosting, WCAG 2.1 AA)
- `.planning/REQUIREMENTS.md` — MAP-01 (color-coded map), MAP-02 (zoom/pan desktop+mobile), MAP-03 (click-to-navigate)

### Prior phase context
- `.planning/phases/01-project-foundation/01-CONTEXT.md` — Visual identity: blue→yellow→red gradient, warm palette, dark mode, Tailwind CSS 4, Astro 6
- `.planning/phases/02-data-pipeline-and-scoring-engine/02-CONTEXT.md` — Data format: ScoredCountry with iso3, score (1-10), scoreDisplay (integer), pillars, advisories

### Pipeline types
- `src/pipeline/types.ts` — ScoredCountry interface, PillarScore, AdvisoryInfo — map reads `data/scores/latest.json` matching these types

### Existing code
- `src/layouts/Base.astro` — Base layout with i18n, hreflang, Inter + DM Sans fonts
- `src/components/Header.astro` — Header with navigation
- `src/components/Footer.astro` — Footer component
- `src/components/DarkModeToggle.astro` — Dark mode toggle
- `src/i18n/utils.ts` — i18n utilities, locale routing helpers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Header.astro` — Already includes logo, language switcher, dark mode toggle — homepage uses this directly
- `Footer.astro` — Standard footer for bottom of page
- `Base.astro` — Layout with i18n support, meta tags, font loading — map page extends this
- `src/i18n/utils.ts` — `useTranslations()`, `getLocalizedPath()` for localized country names and URL generation

### Established Patterns
- Astro 6 with client-side islands for interactive components (map will be a `client:load` island)
- Tailwind CSS 4 with `@tailwindcss/vite` plugin — custom theme tokens for colors
- ESM TypeScript throughout (`"type": "module"`)
- Inter Variable + DM Sans Variable fonts loaded via `@fontsource-variable`

### Integration Points
- `data/scores/latest.json` — Map reads this at build time (Astro static import) for country scores
- `src/pipeline/types.ts` — ScoredCountry.iso3 must match topojson country IDs (ISO 3166-1 alpha-3)
- Country detail page URLs (Phase 4) — map click navigates to `/{locale}/country/{slug}`, URL pattern must be agreed before implementation
- Dark mode CSS classes — map must respect the existing dark mode toggle mechanism

</code_context>

<specifics>
## Specific Ideas

- Travel magazine feel (Phase 1 decision) — map should feel inviting, not clinical
- Colorblind-safe gradient is non-negotiable — blue→yellow→red range specifically chosen for deuteranopia accessibility
- Zero-budget constraint means no Mapbox/Google Maps tiles — D3+topojson is the right fit
- Country names in tooltips must be localized (Italian names for /it/ locale)
- Data pipeline uses ISO 3166-1 alpha-3 codes — topojson must use matching codes for join

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-interactive-map*
*Context gathered: 2026-03-19*
