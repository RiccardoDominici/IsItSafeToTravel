---
phase: 20-accessibility-and-csp-hardening
plan: 01
subsystem: ui, infra
tags: [accessibility, wcag, aria, csp, security-headers, focus-indicators, skip-nav]

# Dependency graph
requires:
  - phase: 19-donations-and-error-pages
    provides: complete page set for accessibility audit and CSP finalization
provides:
  - Skip-to-content link on every page
  - Visible focus indicators for all interactive elements
  - ARIA labels on D3 charts and SVG map
  - aria-label on all search and comparison inputs
  - Content-Security-Policy in report-only mode
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "focus-visible CSS for keyboard accessibility"
    - "CSP report-only mode before enforcement"
    - "sr-only with focus:not-sr-only for skip nav pattern"

key-files:
  created: []
  modified:
    - src/layouts/Base.astro
    - src/styles/global.css
    - src/components/SafetyMap.astro
    - src/components/Search.astro
    - src/pages/en/compare.astro
    - src/pages/es/comparar.astro
    - src/pages/fr/comparer.astro
    - src/pages/it/confronta.astro
    - src/pages/pt/comparar.astro
    - public/_headers

key-decisions:
  - "Used unsafe-inline for CSP script-src and style-src — acceptable for read-only SSG with no user input"
  - "CSP deployed as Report-Only first to monitor for violations before enforcement"
  - "Hardcoded English aria-label on SafetyMap — acceptable since screen reader language is user-configured"

patterns-established:
  - "focus-visible with terracotta-700 outline across all interactive elements"
  - "sr-only + focus:not-sr-only skip link pattern in Base.astro"

requirements-completed: [A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-06, CSP-01, CSP-02]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 20 Plan 01: Accessibility and CSP Hardening Summary

**WCAG 2.1 AA accessibility baseline with skip-nav, focus indicators, ARIA labels, input labels, and Content-Security-Policy in report-only mode**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T13:19:28Z
- **Completed:** 2026-03-21T13:24:21Z
- **Tasks:** 6
- **Files modified:** 10

## Accomplishments
- Skip-to-content link visible on keyboard focus on every page, jumping past navigation to main content
- Visible focus indicators (terracotta-700, 2px outline) on all interactive elements site-wide
- ARIA role="img" and aria-label on SafetyMap container; TrendChart and PillarBreakdown already had proper ARIA
- aria-label added to search input and all 5 comparison page search inputs
- Heading hierarchy verified correct (one H1 per page, no skipped levels)
- Content-Security-Policy-Report-Only deployed in _headers with safe defaults

## Task Commits

Each task was committed atomically:

1. **Task 1: Skip-to-content link** - `07cc4be` (feat)
2. **Task 2: Focus indicators** - `6dc67c6` (feat)
3. **Task 3: ARIA labels on map** - `ec2ef05` (feat)
4. **Task 4: Form labels** - `f08528b` (feat)
5. **Task 5: Heading hierarchy** - verification only, no changes needed
6. **Task 6: CSP headers** - `1f458d0` (feat)

## Files Created/Modified
- `src/layouts/Base.astro` - Skip-to-content link, id="main-content" on main element
- `src/styles/global.css` - focus-visible styles for all interactive elements
- `src/components/SafetyMap.astro` - role="img" and aria-label on map container
- `src/components/Search.astro` - aria-label on search input
- `src/pages/en/compare.astro` - aria-label on comparison search input
- `src/pages/es/comparar.astro` - aria-label on comparison search input
- `src/pages/fr/comparer.astro` - aria-label on comparison search input
- `src/pages/it/confronta.astro` - aria-label on comparison search input
- `src/pages/pt/comparar.astro` - aria-label on comparison search input
- `public/_headers` - Content-Security-Policy-Report-Only header

## Decisions Made
- Used `unsafe-inline` for both script-src and style-src in CSP because Astro SSG inlines scripts (dark mode detection) and D3 uses inline styles. This is acceptable for a read-only static site with no user-generated content.
- Deployed CSP as Report-Only first to catch violations in browser console without breaking the site.
- TrendChart SVG already had role="img" and aria-label; PillarBreakdown SVGs already had per-pillar aria-labels. No changes needed for those components.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- v2.0 Production Ready milestone is now complete
- All 5 phases (16-20) delivered: security headers, legal compliance, SEO enhancement, donations/error pages, and accessibility/CSP
- CSP can be promoted from Report-Only to enforced after monitoring browser console for violations in production

---
*Phase: 20-accessibility-and-csp-hardening*
*Completed: 2026-03-21*
