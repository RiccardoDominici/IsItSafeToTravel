# Phase 9: Enhanced History Charts - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the existing TrendSparkline on country detail pages with a full-size interactive trend chart with tooltips. First client-side JS on country pages (Astro `<script>` tag).

</domain>

<decisions>
## Implementation Decisions

### Chart Design
- Replace existing sparkline (TrendSparkline.astro) with full-size chart — no redundancy
- Full-width (max-w-2xl), height 240px — fits desktop and mobile
- X axis: date labels with monthly ticks, Y axis: score 1-10 with gridlines
- Smooth line with area gradient fill below (terracotta/sand palette)

### Tooltip Interaction
- Client-side JS with invisible overlay rects per data point, show tooltip on hover/tap
- This is the first interactive `<script>` on country pages — use Astro processed script
- Tooltip content: date + score (e.g., "Mar 19, 2026: 7.2")
- Tooltip style: small floating div above point, sand background, terracotta border, subtle shadow
- Mobile: tap to show, tap elsewhere to dismiss

### Data & Integration
- Build-time: pass history data via `data-history` attribute on container, client JS reads it (Astro SSG pattern)
- Add i18n keys for tooltip and chart labels to both EN and IT
- Keep "accumulating data" message when < 2 data points (existing logic)

### Claude's Discretion
- Exact D3 scale configurations and tick formatting
- Gradient fill opacity and exact colors
- Tooltip positioning logic (above/below point based on space)
- Overlay rect sizing for hit detection

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/country/TrendSparkline.astro` — current sparkline (to be replaced)
- `src/lib/scores.ts` — `loadHistoricalScores()` returns `Map<string, HistoryPoint[]>`
- `src/lib/colors.ts` — `scoreToColor()` utility
- `src/pages/en/global-safety.astro` — Phase 8 D3 chart pattern (build-time SVG with axes)
- `src/i18n/ui.ts` — translation keys structure

### Established Patterns
- Country detail page: `src/pages/en/country/[slug].astro` passes `trend` prop
- Build-time D3 SVG generation in Astro frontmatter
- Data passed to client via data-attributes on container div
- Dark mode with Tailwind `dark:` variants

### Integration Points
- `src/pages/en/country/[slug].astro` — replace TrendSparkline import with new component
- `src/pages/it/country/[slug].astro` — same replacement
- `src/i18n/ui.ts` — add chart/tooltip translation keys
- New component: `src/components/country/TrendChart.astro` (replaces TrendSparkline)

</code_context>

<specifics>
## Specific Ideas

- User wants interactive tooltips (hover on desktop, tap on mobile)
- Must maintain extremely minimal, clean design language
- This introduces first client-side JS on country detail pages via Astro `<script>`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
