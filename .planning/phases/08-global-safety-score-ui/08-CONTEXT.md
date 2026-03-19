# Phase 8: Global Safety Score UI - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Homepage global safety score banner (clickable) and dedicated global safety page with trend chart and methodology explanation. Build-time SSG, no client-side JS needed.

</domain>

<decisions>
## Implementation Decisions

### Global Score Banner (Homepage)
- Banner positioned above the map, below hero title/tagline — prominent but not obstructing map
- Compact horizontal bar with score number, label, and right-arrow/chevron to indicate clickability — matches sand/terracotta palette
- Score displayed as large number (e.g., "6.6") with label "Global Safety Score" and 1-10 color coding
- Dark mode: same layout, inverted to dark palette (sand-100 text, dark background)

### Global Safety Page
- URL: `/{lang}/global-safety` (EN), `/{lang}/sicurezza-globale` (IT) — follows existing i18n routing
- Line chart with D3, build-time SVG — full-size with labeled axes (date on X, score 1-10 on Y), extends TrendSparkline pattern
- Methodology: brief explanation ("arithmetic mean of all 248 country scores") + link to existing methodology page
- Layout: single column — score hero at top, trend chart below, methodology at bottom (mirrors country detail structure)

### Navigation & SEO
- Banner on homepage only (no header/footer link) — keeps navigation minimal
- JSON-LD with WebPage schema + aggregateRating for global score
- i18n keys for: global score label, page title, methodology explanation, "world safety" — both EN and IT

### Claude's Discretion
- Exact Tailwind classes and spacing
- Chart dimensions and axis formatting
- Color for global score (use existing getScoreColor utility)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/country/ScoreHero.astro` — score display component (adapt for global)
- `src/components/country/TrendSparkline.astro` — D3 SVG chart (extend to full-size)
- `src/lib/scores.ts` — `loadLatestSnapshot()` (has globalScore), `loadGlobalHistory()`
- `src/lib/seo.ts` — `buildHomepageJsonLd()`, `buildCountryJsonLd()` patterns
- `src/i18n/ui.ts` — translation key structure

### Established Patterns
- Pages in `src/pages/{en,it}/` with `export const prerender = true`
- Layout wrapping with `<Base>` component
- Build-time D3 SVG generation (zero client JS)
- Translation via `useTranslations(lang)` + `t('key')` pattern

### Integration Points
- `src/pages/en/index.astro` — add banner between hero text and SafetyMap
- `src/pages/it/index.astro` — same banner, Italian translations
- New pages: `src/pages/en/global-safety.astro`, `src/pages/it/sicurezza-globale.astro`
- `src/i18n/ui.ts` — add translation keys

</code_context>

<specifics>
## Specific Ideas

- User wants: click banner → dedicated page (not expand in place)
- Keep extremely minimal design consistent with rest of site
- Chart should be build-time SVG like existing sparklines (no client JS)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
