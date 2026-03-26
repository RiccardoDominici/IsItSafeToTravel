---
phase: 30-tier-2-html-sources-batch-1
plan: 02
subsystem: pipeline
tags: [cheerio, advisory, html-scraping, fetcher, tier2a, typescript]

requires:
  - phase: 30-tier-2-html-sources-batch-1
    plan: 01
    provides: "cheerio dependency, normalization functions (normalizeFrColor, normalizeHkAlert, normalizeIeRating, normalizeFiLevel), extended AdvisoryInfoMap/ScoredCountry types with tier2a keys"
provides:
  - "8 sub-fetchers for Tier 2a HTML advisory sources (AT, FR, HK, NZ, IE, FI, BR, PH)"
  - "fetchTier2aAdvisories orchestrator registered in pipeline"
  - "advisories_tier2a source metadata in sources.json"
affects: [tier-2b-sources, scoring-calibration, ci-workflow]

tech-stack:
  added: []
  patterns: [html-scraping-with-cheerio, rss-feed-parsing, js-object-extraction-from-html, dual-url-fallback, blanket-alert-detection]

key-files:
  created:
    - src/pipeline/fetchers/advisories-tier2a.ts
  modified:
    - src/pipeline/fetchers/index.ts
    - src/pipeline/config/sources.json

key-decisions:
  - "Used cheerio for all HTML/XML parsing instead of regex, following research recommendation for complex HTML structures"
  - "Austria fetcher extracts bmeiaCountrySecurityInfos JS object via regex then JSON.parse -- most reliable source in batch"
  - "France fetcher uses RSS feed for country listing then batch-crawls per-country pages at concurrency 5"
  - "Brazil stub returns sparse data from crisis alerts only, as Brazil has no structured level system"
  - "NZ/IE/FI/PH fetchers implement graceful degradation with empty result on 403 or JS-rendered pages"

patterns-established:
  - "Dual-URL fallback pattern: try primary URL, fall through to alternative on failure (IE, FI, PH)"
  - "Blanket alert detection: check for global alert text before per-country parsing (HK)"
  - "French name map: build lowercase fr name -> CountryEntry map from COUNTRIES for non-English source matching"
  - "Stub fetcher pattern: for sources without structured level systems, scan for crisis keywords and return sparse data (BR)"

requirements-completed: [HTML-01, HTML-02, HTML-03, HTML-04, HTML-05, HTML-06, HTML-07, HTML-08]

duration: 4min
completed: 2026-03-26
---

# Phase 30 Plan 02: Tier 2a HTML Advisory Fetchers Summary

**8 sub-fetchers (AT/FR/HK/NZ/IE/FI/BR/PH) using cheerio HTML parsing with resilient error handling, registered in pipeline as advisories_tier2a source**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T19:50:27Z
- **Completed:** 2026-03-26T19:54:18Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created advisories-tier2a.ts (1121 lines) with 8 sub-fetchers following the tier-1 pattern exactly
- Austria fetcher extracts structured JS object from BMEIA page -- highest confidence source
- France fetcher parses RSS feed then batch-crawls per-country pages for color-coded advisory levels
- Hong Kong fetcher detects blanket alerts and falls back to per-country CSS class parsing
- Low-confidence sources (NZ, IE, FI, PH) implement graceful degradation returning empty on 403
- Brazil stub fetcher scans for crisis keywords, returns sparse data as documented
- All 8 sub-fetchers registered in pipeline via fetchAllSources with proper source naming

## Task Commits

Each task was committed atomically:

1. **Task 1: Create advisories-tier2a.ts with 8 sub-fetchers** - `e6dac55` (feat)
2. **Task 2: Register Tier 2a fetcher in pipeline and sources config** - `e0ff3ad` (feat)

## Files Created/Modified
- `src/pipeline/fetchers/advisories-tier2a.ts` - 8 sub-fetchers + main orchestrator for Tier 2a HTML advisory sources
- `src/pipeline/fetchers/index.ts` - Import, export, and registration of fetchTier2aAdvisories in fetchAllSources
- `src/pipeline/config/sources.json` - advisories_tier2a metadata entry

## Decisions Made
- Used cheerio for all HTML/XML parsing (RSS, HTML pages, JS extraction) rather than regex-only approach
- Austria BMEIA is the most reliable source: structured JS object with ISO2 keys and 1-4 security levels
- France uses RSS-first approach to discover country URLs, avoiding need for slug guessing
- Brazil implemented as stub per research recommendation -- no structured level system exists
- All per-country page crawls use concurrency 3-5 for politeness to government servers
- NZ SafeTravel fallback samples only first 50 countries to avoid excessive requests on JS-rendered site

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tier 2a fetcher is fully wired into pipeline and will run alongside all other sources
- Scoring engine already configured (in Plan 01) to read advisories-tier2a-info.json
- Runtime behavior depends on source availability -- AT expected to work reliably, others may return empty results
- Ready for Tier 2b sources or scoring calibration phases

---
*Phase: 30-tier-2-html-sources-batch-1*
*Completed: 2026-03-26*
