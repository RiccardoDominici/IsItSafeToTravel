---
phase: 01-project-foundation
plan: 01
subsystem: ui
tags: [astro, tailwind-css-4, i18n, hreflang, dark-mode, oklch, fontsource]

# Dependency graph
requires: []
provides:
  - Astro 6 project scaffold with Tailwind CSS 4 design system
  - i18n routing for EN/IT with hreflang tags and x-default
  - Translation dictionaries and utility functions (getLangFromUrl, useTranslations, getLocalizedPath)
  - Base layout with dark mode, fonts, and SEO meta tags
  - Placeholder homepages for /en/ and /it/ routes
  - Language switcher and dark mode toggle components
  - Warm travel-magazine design tokens (sand, sage, terracotta palettes)
  - Colorblind-safe map gradient (blue/yellow/red in OKLCH)
affects: [02-data-pipeline, 03-map-visualization, 04-country-pages, 05-seo]

# Tech tracking
tech-stack:
  added: [astro@6, tailwindcss@4, "@tailwindcss/vite", "@astrojs/sitemap", "@fontsource-variable/inter", "@fontsource-variable/dm-sans"]
  patterns: [tailwind-css-4-vite-plugin, astro-i18n-prefix-routing, page-based-locale-routing, class-based-dark-mode]

key-files:
  created:
    - astro.config.mjs
    - src/styles/global.css
    - src/i18n/ui.ts
    - src/i18n/utils.ts
    - src/layouts/Base.astro
    - src/components/Header.astro
    - src/components/Footer.astro
    - src/components/LanguageSwitcher.astro
    - src/components/DarkModeToggle.astro
    - src/pages/index.astro
    - src/pages/en/index.astro
    - src/pages/it/index.astro
  modified:
    - package.json

key-decisions:
  - "Used Tailwind CSS 4 with @tailwindcss/vite plugin (not @astrojs/tailwind which is incompatible with Astro 6)"
  - "Used prefixDefaultLocale routing instead of manual routing to avoid middleware requirement"
  - "Root redirect uses client-side language detection (JS + meta refresh) since SSG cannot read Accept-Language headers"

patterns-established:
  - "i18n pattern: page-based routing with /en/ and /it/ prefixes, translations via ui.ts dictionaries"
  - "Component pattern: Astro components accept lang prop, use useTranslations(lang) for text"
  - "Dark mode: class-based toggle with localStorage persistence and system preference detection"
  - "Design tokens: OKLCH color space for all custom colors in @theme block"

requirements-completed: [TECH-03]

# Metrics
duration: 7min
completed: 2026-03-19
---

# Phase 1 Plan 1: Project Foundation Summary

**Astro 6 scaffold with Tailwind CSS 4 design system, EN/IT i18n routing with hreflang, warm travel-magazine design tokens (sand/sage/terracotta in OKLCH), and dark mode support**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-19T10:10:05Z
- **Completed:** 2026-03-19T10:17:23Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Astro 6 project with Tailwind CSS 4 design system using warm, inviting color palette
- Full i18n routing: /en/ and /it/ homepages with hreflang tags, x-default, canonical URLs, and translated route slugs
- Language switcher in header navigates between locale versions of the same page
- Dark mode toggle with system preference detection and localStorage persistence
- Root URL detects browser language and redirects to appropriate locale

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Astro project with Tailwind CSS design system** - `7adda87` (feat)
2. **Task 2: Implement i18n routing with placeholder pages, hreflang, and language switcher** - `f0c46f4` (feat)

## Files Created/Modified
- `package.json` - Project dependencies (Astro 6, Tailwind CSS 4, sitemap, fonts)
- `astro.config.mjs` - Astro config with Tailwind vite plugin, sitemap, i18n routing
- `tsconfig.json` - Strict TypeScript config extending Astro defaults
- `src/styles/global.css` - Tailwind directives, design tokens (sand, sage, terracotta, map gradient), dark mode
- `src/i18n/ui.ts` - Translation dictionaries for EN/IT, translated route slugs
- `src/i18n/utils.ts` - i18n helpers: getLangFromUrl, useTranslations, getLocalizedPath, getAlternateLinks
- `src/layouts/Base.astro` - HTML shell with hreflang, canonical, meta, fonts, dark mode script
- `src/components/Header.astro` - Responsive header with nav, language switcher, dark mode toggle, mobile menu
- `src/components/Footer.astro` - Footer with disclaimer, links, copyright
- `src/components/LanguageSwitcher.astro` - Locale navigation using getLocalizedPath
- `src/components/DarkModeToggle.astro` - Sun/moon toggle with localStorage persistence
- `src/pages/index.astro` - Root redirect with JS language detection and meta refresh fallback
- `src/pages/en/index.astro` - English placeholder homepage with hero and map placeholder
- `src/pages/it/index.astro` - Italian placeholder homepage with translated content

## Decisions Made
- **Tailwind CSS 4 via Vite plugin:** @astrojs/tailwind is incompatible with Astro 6. Used @tailwindcss/vite plugin directly, which is the recommended approach for Tailwind CSS 4.
- **Prefix routing over manual routing:** Astro's manual i18n routing requires custom middleware. Used prefixDefaultLocale: true instead, which generates /en/ and /it/ routes from the page file structure.
- **Client-side language detection for root redirect:** SSG mode cannot access Accept-Language headers at build time. Implemented JS-based navigator.language detection with meta refresh fallback to /en/ for non-JS browsers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched from @astrojs/tailwind to @tailwindcss/vite**
- **Found during:** Task 1 (dependency installation)
- **Issue:** @astrojs/tailwind has peer dependency conflicts with Astro 6. Tailwind CSS 4 uses a Vite plugin approach.
- **Fix:** Installed tailwindcss and @tailwindcss/vite, configured via astro.config.mjs vite.plugins
- **Files modified:** package.json, astro.config.mjs
- **Verification:** npm run build succeeds
- **Committed in:** 7adda87 (Task 1 commit)

**2. [Rule 3 - Blocking] Changed i18n routing from manual to prefixDefaultLocale**
- **Found during:** Task 1 (build verification)
- **Issue:** routing: 'manual' requires a middleware file, adding unnecessary complexity for page-based routing
- **Fix:** Switched to routing: { prefixDefaultLocale: true }
- **Files modified:** astro.config.mjs
- **Verification:** npm run build succeeds, /en/ and /it/ pages generated correctly
- **Committed in:** 7adda87 (Task 1 commit)

**3. [Rule 3 - Blocking] Replaced server-side redirect with client-side language detection**
- **Found during:** Task 2 (root redirect page)
- **Issue:** Astro.request.headers not available in static (SSG) mode, causing build warning
- **Fix:** Implemented client-side navigator.language detection with meta refresh fallback
- **Files modified:** src/pages/index.astro
- **Verification:** Build succeeds without warnings, redirect page contains language detection script
- **Committed in:** f0c46f4 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking issues)
**Impact on plan:** All fixes necessary to work with Astro 6 and SSG mode. Equivalent functionality achieved. No scope creep.

## Issues Encountered
- Astro scaffold command does not work in non-empty directories. Worked around by scaffolding in /tmp and copying files.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Site foundation complete with i18n routing, ready for data pipeline (Phase 2) and map visualization (Phase 3)
- Design tokens include map color gradient (safe/moderate/danger) ready for choropleth rendering
- Translation system supports adding new keys for country pages and safety scores
- All pages build successfully and generate correct hreflang tags

## Self-Check: PASSED

All 12 created files verified on disk. Both task commits (7adda87, f0c46f4) verified in git log.

---
*Phase: 01-project-foundation*
*Completed: 2026-03-19*
