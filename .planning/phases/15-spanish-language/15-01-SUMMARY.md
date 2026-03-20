---
phase: 15-spanish-language
plan: 01
subsystem: i18n
tags: [spanish, i18n, translations, seo, locale, country-names]

# Dependency graph
requires:
  - phase: none
    provides: existing en/it i18n infrastructure
provides:
  - Spanish locale in Astro i18n and sitemap config
  - 187 Spanish UI translation keys
  - Spanish route slugs for all pages
  - 248 Spanish country names in data pipeline
  - Spanish SEO meta descriptions and JSON-LD
  - 3-way locale handling replacing all 2-way ternaries
affects: [15-02-spanish-pages]

# Tech tracking
tech-stack:
  added: []
  patterns: [localeMap Record pattern for 3-way locale lookups]

key-files:
  created: []
  modified:
    - astro.config.mjs
    - src/i18n/ui.ts
    - src/pipeline/types.ts
    - src/pipeline/config/countries.ts
    - src/lib/seo.ts
    - src/layouts/Base.astro
    - src/components/country/TrendChart.astro
    - src/pages/en/compare.astro
    - src/pages/it/confronta.astro

key-decisions:
  - "Used Record<string, string> for localeMap in client-side scripts to avoid TS indexing errors"
  - "Used ASCII-only Spanish names matching IT pattern (no accented chars)"

patterns-established:
  - "localeMap pattern: Record<string, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES' } for all locale lookups"

requirements-completed: [LANG-01, LANG-02, LANG-03]

# Metrics
duration: 7min
completed: 2026-03-20
---

# Phase 15 Plan 01: Spanish i18n Infrastructure Summary

**Spanish locale with 187 translation keys, 248 country names, SEO layer, and 3-way locale handling across all files**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-20T11:09:51Z
- **Completed:** 2026-03-20T11:17:31Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Added complete Spanish i18n infrastructure: config, translations, routes
- Added all 248 Spanish country names to the data pipeline
- Replaced every 2-way locale ternary (it/en) with 3-way localeMap pattern
- Updated SEO layer with Spanish meta descriptions, pillar labels, and JSON-LD

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Spanish to i18n config, translations, and routes** - `cdf528f` (feat)
2. **Task 2: Add Spanish country names and update types and SEO** - `b3a2598` (feat)

## Files Created/Modified
- `astro.config.mjs` - Added 'es' to i18n locales and sitemap config
- `src/i18n/ui.ts` - Added 187 Spanish translation keys, routes, and language label
- `src/pipeline/types.ts` - Added es: string to CountryEntry and ScoredCountry name types
- `src/pipeline/config/countries.ts` - Added Spanish names for all 248 countries
- `src/lib/seo.ts` - Added Spanish pillar labels, meta descriptions, JSON-LD, localeMap pattern
- `src/layouts/Base.astro` - Updated og:locale for 3-way lookup including es_ES
- `src/components/country/TrendChart.astro` - Replaced 2-way ternary with localeMap
- `src/pages/en/compare.astro` - Replaced 2-way ternary with localeMap
- `src/pages/it/confronta.astro` - Replaced 2-way ternary with localeMap
- `src/pipeline/__tests__/data02-score-range.test.ts` - Added es field to test fixture
- `src/pipeline/__tests__/data05-historical.test.ts` - Added es field to test fixture
- `src/pipeline/scoring/__tests__/engine.test.ts` - Added es field to test fixture
- `src/pipeline/scoring/__tests__/history.test.ts` - Added es field to test fixture
- `src/pipeline/scoring/__tests__/snapshot.test.ts` - Added es field to test fixture

## Decisions Made
- Used Record<string, string> type for localeMap in client-side scripts to avoid TS7053 index errors
- Matched existing ASCII-only pattern (no accented characters) for Spanish translations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors in test fixtures**
- **Found during:** Task 2 (type changes)
- **Issue:** 5 test files had country name objects missing the new required `es` field after CountryEntry type change
- **Fix:** Added `es` field to all test fixture country name objects
- **Files modified:** 5 test files in src/pipeline/__tests__/ and src/pipeline/scoring/__tests__/
- **Verification:** npx astro check passes (only pre-existing Search.astro error remains)
- **Committed in:** b3a2598 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed TypeScript indexing errors on localeMap**
- **Found during:** Task 2 (locale ternary replacement)
- **Issue:** Inline localeMap objects caused TS7053 when indexed by `lang` (string type in client scripts)
- **Fix:** Used `Record<string, string>` type annotation for all client-side localeMap objects
- **Files modified:** TrendChart.astro, compare.astro, confronta.astro
- **Verification:** npx astro check passes for these files
- **Committed in:** b3a2598 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for type correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Spanish i18n infrastructure complete, ready for Plan 02 (Spanish page files)
- Language switcher will auto-include Spanish (languages object has `es`)
- All locale-dependent logic handles 3 languages

---
*Phase: 15-spanish-language*
*Completed: 2026-03-20*
