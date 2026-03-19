---
phase: 03-interactive-map
plan: 01
subsystem: ui
tags: [d3, topojson, choropleth, map, svg, zoom, tooltips, astro]

requires:
  - phase: 01-project-foundation
    provides: Astro project structure, Tailwind design tokens, i18n routing
  - phase: 02-data-pipeline
    provides: ScoredCountry type, pipeline types for score data
provides:
  - SafetyMap.astro D3 choropleth component with zoom/pan/tooltips
  - map-utils.ts color scale and ISO mapping utilities
  - world-topo.json static topojson asset
affects: [03-interactive-map, 04-country-pages]

tech-stack:
  added: [d3@^7, topojson-client@^3, @types/d3, @types/topojson-client]
  patterns: [client-side D3 rendering in Astro script tag, data-attributes for SSG-to-client data passing, MutationObserver for dark mode reactivity]

key-files:
  created:
    - src/components/SafetyMap.astro
    - src/lib/map-utils.ts
    - public/world-topo.json
  modified:
    - package.json
    - src/i18n/ui.ts

key-decisions:
  - "Natural Earth 1 projection for world choropleth (standard, minimal distortion)"
  - "Topojson served as static asset from public/ (SSG-compatible, no build-time import complexity)"
  - "Data passed to client via data-attributes on container div (Astro SSG pattern)"
  - "ISO numeric-to-alpha3 bridge map for world-atlas topojson IDs to ScoredCountry iso3 codes"

patterns-established:
  - "D3 components in Astro: render HTML shell in frontmatter, hydrate with <script> tag"
  - "Dark mode reactivity: MutationObserver on documentElement class attribute"
  - "Touch interaction: first tap = tooltip, second tap = navigate"

requirements-completed: [MAP-01, MAP-02]

duration: 3min
completed: 2026-03-19
---

# Phase 03 Plan 01: Interactive Map Summary

**D3 choropleth world map with safety color scale, zoom/pan, hover tooltips, touch navigation, and dark mode support**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T11:23:02Z
- **Completed:** 2026-03-19T11:26:06Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Installed D3 v7 and topojson-client v3 with full TypeScript type support
- Created map-utils.ts with safety color scale (red-yellow-blue gradient), ISO numeric-to-alpha3 mapping for 170+ countries, and unscored color constants
- Built SafetyMap.astro (367 lines) as a self-contained D3 choropleth with Natural Earth 1 projection
- Implemented zoom/pan (scroll, pinch, +/- buttons), hover tooltips with localized names/scores, click-to-navigate, touch support, dark mode observer, and responsive resize

## Task Commits

Each task was committed atomically:

1. **Task 1: Install D3/topojson dependencies and create map utilities** - `225d855` (feat)
2. **Task 2: Build SafetyMap.astro component with D3 choropleth, zoom/pan, and tooltips** - `a8b9a59` (feat)

## Files Created/Modified
- `src/lib/map-utils.ts` - Color scale function, ISO numeric-to-alpha3 mapping, getCountryColor helper
- `src/components/SafetyMap.astro` - D3 choropleth map component with all interactive features
- `public/world-topo.json` - World-atlas 110m topojson (countries keyed by ISO numeric)
- `package.json` - Added d3, topojson-client, and their type definitions
- `src/i18n/ui.ts` - Added map.tooltip, map.zoom, map.legend translation keys (en + it)

## Decisions Made
- Used Natural Earth 1 projection (standard for world choropleth, minimal distortion)
- Stored topojson in public/ as static asset fetched client-side (SSG-compatible)
- Passed score data via data-attributes on container div (Astro SSG to client-side D3 pattern)
- Built ISO numeric-to-alpha3 bridge map inline (world-atlas uses numeric IDs, our data uses alpha-3)
- Hex color anchors for d3.scaleLinear (OKLCH not natively supported by d3 interpolation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SafetyMap component ready to be embedded in homepage (needs scores data passed as prop)
- Country page routes (/{lang}/country/{iso3}) referenced in click handler, will be built in phase 04
- Legend, zoom controls, and tooltip fully styled for both light and dark themes

---
*Phase: 03-interactive-map*
*Completed: 2026-03-19*
