---
phase: 27-seo-ai-search-optimization
plan: 03
subsystem: seo
tags: [og-images, resvg, sitemap, lastmod, social-sharing, meta-tags]

# Dependency graph
requires:
  - phase: 27-01
    provides: Base.astro ogImage prop support, SEO infrastructure
provides:
  - Build-time OG image generation for 248 countries + default
  - ogImage prop wired to all 30 page templates across 5 languages
  - Sitemap with lastmod dates on all URLs
affects: [deployment, social-sharing, seo]

# Tech tracking
tech-stack:
  added: ["@resvg/resvg-js"]
  patterns: ["Build-time SVG-to-PNG rendering via resvg", "generate:og pre-build step in npm scripts"]

key-files:
  created:
    - scripts/generate-og-images.ts
  modified:
    - package.json
    - .gitignore
    - astro.config.mjs
    - src/pages/en/country/[slug].astro
    - src/pages/it/paese/[slug].astro
    - src/pages/es/pais/[slug].astro
    - src/pages/fr/pays/[slug].astro
    - src/pages/pt/pais/[slug].astro
    - src/pages/en/index.astro
    - src/pages/it/index.astro
    - src/pages/es/index.astro
    - src/pages/fr/index.astro
    - src/pages/pt/index.astro
    - src/pages/en/compare.astro
    - src/pages/en/global-safety.astro
    - src/pages/en/methodology/index.astro
    - src/pages/en/legal/index.astro
    - src/pages/it/confronta.astro
    - src/pages/it/sicurezza-globale.astro
    - src/pages/it/metodologia/index.astro
    - src/pages/it/note-legali/index.astro
    - src/pages/es/comparar.astro
    - src/pages/es/seguridad-global.astro
    - src/pages/es/metodologia/index.astro
    - src/pages/es/terminos-legales/index.astro
    - src/pages/fr/comparer.astro
    - src/pages/fr/securite-mondiale.astro
    - src/pages/fr/methodologie/index.astro
    - src/pages/fr/mentions-legales/index.astro
    - src/pages/pt/comparar.astro
    - src/pages/pt/seguranca-global.astro
    - src/pages/pt/metodologia/index.astro
    - src/pages/pt/termos-legais/index.astro

key-decisions:
  - "OG images use English country names for universal readability across all language variants"
  - "Generated OG images excluded from git via .gitignore, built at deploy time"
  - "Sitemap lastmod set to build date (correct since scores update daily and pages rebuild)"

patterns-established:
  - "Pre-build generation: npm run generate:og runs before astro build"
  - "SVG template rendering: resvg converts inline SVG strings to PNG at build time"

requirements-completed: [SEO27-12, SEO27-13, SEO27-14]

# Metrics
duration: 30min
completed: 2026-03-25
---

# Phase 27 Plan 03: OG Images & Sitemap Summary

**Build-time OG image generation with resvg for 248 countries plus branded default, wired to all 30 page templates with sitemap lastmod dates**

## Performance

- **Duration:** 30 min
- **Started:** 2026-03-25T11:58:49Z
- **Completed:** 2026-03-25T12:28:58Z
- **Tasks:** 2
- **Files modified:** 32

## Accomplishments
- Created build-time OG image generator producing 249 PNGs (248 countries + 1 default) at 1200x630
- Country OG images show country name, color-coded score badge (green/amber/red), and "Updated Daily" tagline
- Wired ogImage prop to all 30 page templates across 5 languages (EN, IT, ES, FR, PT)
- Configured sitemap serialize function with lastmod dates matching build date
- Full build pipeline verified: 1267 pages built successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Build-time OG image generation script** - `d723c8b` (feat)
2. **Task 2: Wire OG images to pages and configure sitemap** - `56f65b3` (feat)

## Files Created/Modified
- `scripts/generate-og-images.ts` - SVG-to-PNG OG image generator using @resvg/resvg-js
- `package.json` - Added generate:og script, updated build to include OG generation
- `.gitignore` - Added public/og/ exclusion for generated images
- `astro.config.mjs` - Added sitemap serialize function with lastmod
- `src/pages/*/country/[slug].astro` (5 files) - Country-specific ogImage prop
- `src/pages/*/index.astro` (5 files) - Default ogImage prop for homepages
- `src/pages/*/compare*.astro` (5 files) - Default ogImage prop
- `src/pages/*/global-safety*.astro` (5 files) - Default ogImage prop
- `src/pages/*/methodology/index.astro` (5 files) - Default ogImage prop
- `src/pages/*/legal/index.astro` (5 files) - Default ogImage prop

## Decisions Made
- Used English country names in OG images for universal readability (social shares work across languages)
- Generated images at build time, not committed to git (public/og/ in .gitignore)
- Sitemap lastmod uses build date, which is accurate since daily pipeline rebuilds scores

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial astro build failed due to stale prerender cache in dist/ directory; resolved by cleaning dist/ before rebuild

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All pages now have og:image meta tags for social sharing previews
- Sitemap includes lastmod for Google freshness signals
- Build pipeline includes OG generation step automatically

---
*Phase: 27-seo-ai-search-optimization*
*Completed: 2026-03-25*
