---
phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib
plan: 07
subsystem: docs
tags: [i18n, astro, seo, methodology, privacy]

# Dependency graph
requires:
  - phase: 39-03
    provides: "methodology.sentiment_* and legal.privacy_votes_* i18n key families across all 7 locale blocks in src/i18n/ui.ts"
provides:
  - "Methodology page Sentiment documentation (5 calibration levels, ±1.0 cap, Phase-1 does-NOT-affect-total statement) live on all 7 locales"
  - "Legal/privacy page community-votes disclosure (salted-hash dedupe, no raw IP, Turnstile-when-enabled, localStorage note) live on all 7 locales"
affects: [39-community-sentiment-score-phase-1-display-only-5-level-calib]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Text-only <section> additions reusing existing prose classes (H2 text-xl md:text-2xl font-heading font-bold for methodology; H3 text-xl font-heading font-semibold for legal privacy sub-block), matching the site's mature 7-locale duplication-not-abstraction convention for pages"

key-files:
  created: []
  modified:
    - src/pages/en/methodology/index.astro
    - src/pages/it/metodologia/index.astro
    - src/pages/es/metodologia/index.astro
    - src/pages/fr/methodologie/index.astro
    - src/pages/pt/metodologia/index.astro
    - src/pages/zh/methodology/index.astro
    - src/pages/de/methodik/index.astro
    - src/pages/en/legal/index.astro
    - src/pages/it/note-legali/index.astro
    - src/pages/es/terminos-legales/index.astro
    - src/pages/fr/mentions-legales/index.astro
    - src/pages/pt/termos-legais/index.astro
    - src/pages/zh/legal/index.astro
    - src/pages/de/impressum/index.astro

key-decisions:
  - "Sentiment methodology section placed after 'Understanding Each Category' and before 'Limitations' (all 7 locale files have byte-identical markup at this seam, verified via diff, so a single old_string/new_string Edit applied cleanly to every locale)"
  - "Privacy votes section placed as a new <section class=\"mb-8\"> immediately after the existing privacy_rights section and before the second <hr> that separates the Privacy sub-block from the Imprint block — keeps it inside the privacy sub-block as required by D-20"

patterns-established:
  - "For future ×7-locale text-only doc additions, diff the anchor region across all 7 files first — this codebase's locale pages are line-for-line identical markup (only i18n key VALUES differ), so a single Edit old_string works across every locale without per-file variation"

requirements-completed: [D-19, D-20]

duration: ~25min
completed: 2026-07-02
---

# Phase 39 Plan 07: Methodology + privacy documentation for Sentiment across all 7 locales Summary

**Added a Sentiment methodology section and a community-votes privacy paragraph to all 14 locale-specific methodology/legal pages, entirely via the 39-03 i18n keys — no new components, no JSON-LD changes, `validate:seo` stays 2213/2213 pass.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-02T09:00:00Z (approx, worktree spawn)
- **Completed:** 2026-07-02T09:08:36Z
- **Tasks:** 2 completed
- **Files modified:** 14

## Accomplishments
- All 7 methodology pages (`en/it/es/fr/pt/zh/de`) now document the Community Sentiment pillar: the 5-level calibration vote, the ±1.0-point correction cap, and an explicit statement that in Phase 1 it does NOT affect the total safety score (D-19)
- All 7 legal/privacy pages now honestly disclose vote processing: salted-hash IP dedupe (no raw IP retention), Turnstile anti-bot check when enabled, and the localStorage soft-dedupe flag — kept consistent with the site's zero-cookie claim (D-20)
- Verified via full `npx astro build` (1906 pages, 492.77s) + `npm run validate:seo` (2213/2213 checks pass) that the FAQ/JSON-LD blocks and country-page `@graph` invariant are completely untouched (D-21/D-22)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the Sentiment methodology section to all 7 methodology pages** - `beed6e5b` (docs)
2. **Task 2: Add the community-votes privacy paragraph to all 7 legal pages** - `1e4c6226` (docs)

**Plan metadata:** (this commit, made after this summary is written)

## Files Created/Modified
- `src/pages/en/methodology/index.astro` - new "Community Sentiment" `<section>` after "Understanding Each Category", before "Limitations"
- `src/pages/it/metodologia/index.astro` - same section, Italian locale
- `src/pages/es/metodologia/index.astro` - same section, Spanish locale
- `src/pages/fr/methodologie/index.astro` - same section, French locale
- `src/pages/pt/metodologia/index.astro` - same section, Portuguese locale
- `src/pages/zh/methodology/index.astro` - same section, Chinese locale
- `src/pages/de/methodik/index.astro` - same section, German locale
- `src/pages/en/legal/index.astro` - new "Community votes" `<section>` inside the privacy sub-block, after `privacy_rights`, before the second `<hr>`
- `src/pages/it/note-legali/index.astro` - same section, Italian locale
- `src/pages/es/terminos-legales/index.astro` - same section, Spanish locale
- `src/pages/fr/mentions-legales/index.astro` - same section, French locale
- `src/pages/pt/termos-legais/index.astro` - same section, Portuguese locale
- `src/pages/zh/legal/index.astro` - same section, Chinese locale
- `src/pages/de/impressum/index.astro` - same section, German locale

## Decisions Made
- Confirmed via `diff` that the insertion-point markup (the last ~7 lines before `<!-- Limitations -->` in methodology pages, and the `privacy_rights` section + second `<hr>` in legal pages) is byte-identical across all 7 locale files — enabling one Edit `old_string`/`new_string` pair to be applied mechanically per file instead of hand-tailoring each locale's surrounding markup.
- Used `t('methodology.sentiment_title')` / `t('methodology.sentiment_text')` and `t('legal.privacy_votes_title')` / `t('legal.privacy_votes_text')` exclusively — all 7 locale values for these keys were already authored in 39-03 (verified present in `src/i18n/ui.ts` before starting), so no hardcoded English prose was introduced.

## Deviations from Plan

None - plan executed exactly as written. Both acceptance-criteria grep gates (`methodology.sentiment_title` × 7, `legal.privacy_votes_title` × 7) passed on first attempt with no fix-up required.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- D-19 and D-20 are fully satisfied across all 7 locales; the Sentiment feature's documentation surface is complete for Phase 1.
- `npm run validate:seo` remains at 2213/2213 pass, confirming no regression to the country-page `@graph` invariant (WebPage + Place + FAQPage + TouristDestination + Dataset) or hreflang.
- No blockers for merging this wave; this plan touched only documentation pages and has no code dependencies on the other Phase 39 plans (vote endpoint, D1 aggregation, country-page widget) beyond the already-merged Wave 1 i18n keys.

---
*Phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib*
*Completed: 2026-07-02*

## Self-Check: PASSED

All 14 modified page files and the SUMMARY.md itself confirmed present on disk. Both task commits (`beed6e5b`, `1e4c6226`) confirmed present in git log. No missing items.
