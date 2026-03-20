# Phase 12: Interactive Charts - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert TrendChart from build-time SVG to client-side D3 rendering and add drag-to-zoom (brush) interaction on both country detail pages and comparison page. Users can select a date range by dragging and reset to full view.

</domain>

<decisions>
## Implementation Decisions

### Chart Zoom Interaction
- Reset button appears as small "Reset" text button above the chart, matching existing minimal UI style
- Brush selection shows a semi-transparent highlight overlay on the selected range (standard D3 brush pattern)
- Zoom transitions use 300ms ease animation — smooth but not slow
- Zoomed chart clips data outside the selected range using SVG clipPath for a clean view

### Chart Architecture
- TrendChart converts fully to client-side D3 rendering (required for brush zoom, matches compare page pattern)
- Comparison page overlay chart also gets drag-to-zoom (success criteria requires both pages)
- d3-brush is already included in d3 ^7.9.0 — no new dependency needed (use `import { brush, brushX } from 'd3'`)
- TrendChart and compare page keep separate rendering logic — different use cases (single vs multi-country), avoid premature abstraction

### Claude's Discretion
- Exact brush styling (color, opacity of selection rectangle)
- SVG structure details for the client-side rendered chart
- How to preserve existing tooltip behavior during/after zoom
- Exact positioning of reset button relative to chart

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/country/TrendChart.astro` — current build-time SVG chart, needs full client-side conversion
- `src/pages/en/compare.astro` lines 383-552 — reference for client-side D3 rendering pattern (innerHTML SVG string building)
- `src/lib/scores.ts` — `HistoryPoint { date: string; score: number }` interface
- `scoreToColor()` — existing color utility for score-based coloring
- Data passed via `data-history` attribute as JSON (proven pattern)

### Established Patterns
- Client-side D3: `d3Line<HistoryPoint>()` with `.x()` and `.y()` accessors
- UTC date parsing: `new Date(d.date + 'T00:00:00Z')` (fixed in Phase 11)
- SVG margin convention: `{ top, right, bottom, left }` with computed `innerWidth/innerHeight`
- Color palette for multi-line: `['#c47a5a', '#4a9e8f', '#d4a03c', '#5b6abf', '#7a9e6a']`
- Dash patterns for accessibility: `['', '8 4', '4 4', '12 4 4 4', '16 4']`

### Integration Points
- TrendChart.astro used on all country detail pages (`/en/country/[slug]`, `/it/paese/[slug]`)
- Also used on global safety pages (`/en/global-safety`, `/it/sicurezza-globale`)
- Compare pages (`/en/compare`, `/it/confronta`) have their own chart rendering
- Existing tooltip script (lines 189-264 in TrendChart) needs adaptation for client-side rendering

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the success criteria — open to standard D3 brush patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
