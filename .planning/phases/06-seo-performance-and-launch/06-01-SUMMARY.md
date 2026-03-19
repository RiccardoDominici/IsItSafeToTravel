---
phase: 06-seo-performance-and-launch
plan: 01
subsystem: seo
tags: [json-ld, open-graph, twitter-card, sitemap, robots-txt, structured-data, meta-tags]

# Dependency graph
requires:
  - phase: 04-country-detail-pages
    provides: Country page templates with ScoredCountry data
  - phase: 05-search-and-content-pages
    provides: Methodology and legal page templates
provides:
  - JSON-LD structured data on all pages (WebSite, WebPage, Place schemas)
  - Open Graph and Twitter Card meta tags on all pages
  - Unique country meta descriptions derived from score data
  - Sitemap with hreflang i18n annotations
  - robots.txt with sitemap reference
affects: [06-02-performance-and-launch]

# Tech tracking
tech-stack:
  added: []
  patterns: [json-ld-via-props, og-meta-in-layout, seo-helper-library]

key-files:
  created:
    - src/lib/seo.ts
    - public/robots.txt
  modified:
    - src/layouts/Base.astro
    - astro.config.mjs
    - src/pages/en/index.astro
    - src/pages/it/index.astro
    - src/pages/en/country/[slug].astro
    - src/pages/it/paese/[slug].astro
    - src/pages/en/methodology/index.astro
    - src/pages/it/metodologia/index.astro
    - src/pages/en/legal/index.astro
    - src/pages/it/note-legali/index.astro

key-decisions:
  - "JSON-LD passed as prop from pages to Base.astro layout for centralized rendering"
  - "Country meta descriptions generated from score data with strongest/weakest pillar differentiation"
  - "Pillar scores displayed as 0-10 scale (score * 10) in meta descriptions for consistency"

patterns-established:
  - "SEO prop pattern: pages build jsonLd object via seo.ts helpers, pass to Base.astro as prop"
  - "Unique meta description pattern: template-driven descriptions using country score data"

requirements-completed: [TECH-02]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 06 Plan 01: SEO Structured Data and Meta Tags Summary

**JSON-LD structured data (WebSite, WebPage, Place), OG/Twitter meta tags, unique country descriptions, sitemap i18n, and robots.txt across all 8 page templates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T13:11:13Z
- **Completed:** 2026-03-19T13:13:58Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Created SEO helper library with 4 exported functions for JSON-LD generation and meta descriptions
- Extended Base.astro layout with OG, Twitter Card, and JSON-LD structured data support
- Wired all 8 page templates (2 homepage, 2 country, 2 methodology, 2 legal) with structured data
- Configured sitemap with i18n hreflang annotations for EN/IT locales
- Created robots.txt allowing all crawlers with sitemap reference

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SEO helper library, update Base.astro, configure sitemap and robots.txt** - `2ac29d5` (feat)
2. **Task 2: Wire all page templates to pass SEO props to Base.astro** - `3efe3cb` (feat)

## Files Created/Modified
- `src/lib/seo.ts` - SEO helper library with buildCountryJsonLd, buildHomepageJsonLd, buildWebPageJsonLd, buildCountryMetaDescription
- `src/layouts/Base.astro` - Extended with jsonLd, ogImage, ogType props; OG, Twitter Card, JSON-LD meta tags in head
- `astro.config.mjs` - Sitemap integration configured with i18n defaultLocale and locale mapping
- `public/robots.txt` - Crawler instructions with sitemap URL
- `src/pages/en/index.astro` - Homepage with WebSite JSON-LD and SearchAction
- `src/pages/it/index.astro` - Homepage IT with WebSite JSON-LD and SearchAction
- `src/pages/en/country/[slug].astro` - Country pages with WebPage+Place JSON-LD and unique meta descriptions
- `src/pages/it/paese/[slug].astro` - Country pages IT with WebPage+Place JSON-LD and unique meta descriptions
- `src/pages/en/methodology/index.astro` - Methodology with WebPage JSON-LD
- `src/pages/it/metodologia/index.astro` - Methodology IT with WebPage JSON-LD
- `src/pages/en/legal/index.astro` - Legal with WebPage JSON-LD
- `src/pages/it/note-legali/index.astro` - Legal IT with WebPage JSON-LD

## Decisions Made
- JSON-LD passed as prop from pages to Base.astro layout for centralized rendering in head
- Country meta descriptions generated from score data with strongest/weakest pillar differentiation for SEO uniqueness
- Pillar scores displayed as 0-10 scale (score * 10) in meta descriptions for consistency with displayed scores

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All pages have complete SEO structured data, ready for search engine indexing
- Performance optimization and launch preparation (06-02) can proceed
- OG images referenced (/og-default.png, /og-homepage.png, /og-country.png) should be created in 06-02 or as a design task

---
*Phase: 06-seo-performance-and-launch*
*Completed: 2026-03-19*
