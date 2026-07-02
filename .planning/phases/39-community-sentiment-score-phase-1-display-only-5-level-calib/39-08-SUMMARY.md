---
phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib
plan: 08
subsystem: ui
tags: [astro, i18n, sentiment, country-pages, seo-gate]

# Dependency graph
requires:
  - phase: 39-05
    provides: "src/lib/sentiment.ts (loadSentimentForCountry, MIN_VOTE_FLOOR) + SentimentPillar.astro (display card with <slot/>)"
  - phase: 39-06
    provides: "SentimentVote.astro (5-level calibration widget, iso3/officialScore/countryName/lang props)"
provides:
  - "All 7 locale country page templates ([slug].astro for en/it/es/fr/pt/zh/de) render <SentimentPillar> with <SentimentVote> nested in its slot, immediately after <PillarBreakdown>"
  - "getStaticPaths in each of the 7 templates threads sentiment: loadSentimentForCountry(country.iso3) as a build-time prop"
  - "Phase 39 SEO acceptance gate: npx astro build (1906 pages) + npm run validate:seo (2213/2213) both green with the Sentiment feature live"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Country-page composition: <SentimentPillar sentiment official lang><SentimentVote iso3 officialScore countryName lang /></SentimentPillar> as a sibling section after PillarBreakdown, never merged into country.pillars (D-06)"

key-files:
  created: []
  modified:
    - src/pages/en/country/[slug].astro
    - src/pages/it/paese/[slug].astro
    - src/pages/es/pais/[slug].astro
    - src/pages/fr/pays/[slug].astro
    - src/pages/pt/pais/[slug].astro
    - src/pages/zh/country/[slug].astro
    - src/pages/de/land/[slug].astro

key-decisions:
  - "SentimentEntry type import added to the existing `import type { ScoredCountry } from '../../../pipeline/types'` line (extended to `{ ScoredCountry, SentimentEntry }`) rather than a separate import statement, keeping the type-only import block minimal"
  - "SentimentPillar/SentimentVote component imports placed directly after the PillarBreakdown import (before PillarDetailTable) in all 7 files, grouping the pillar-family components together for readability"
  - "loadSentimentForCountry import placed as its own line directly after the existing lib/scores import, mirroring how lib/seo and lib/lastmod imports are each on their own line"

patterns-established:
  - "The 6th-pillar composition pattern (SentimentPillar wrapping SentimentVote via slot, fed by a build-time loader prop) is now the canonical shape for any future per-country display-only widget"

requirements-completed: [D-04, D-06, D-17, D-21, D-22]

# Metrics
duration: ~25min
completed: 2026-07-02
---

# Phase 39 Plan 08: Wire SentimentPillar + SentimentVote into all 7 country pages + phase SEO gate Summary

**Display-only Community Sentiment pillar + 5-level vote widget now live on every one of the ~1906 built pages across all 7 locale country templates, with `npx astro build` (1906 pages) and `npm run validate:seo` (2213/2213) both green — zero regression to the country `@graph` (WebPage+Place+FAQPage+TouristDestination+Dataset).**

## Performance

- **Duration:** ~25 min (dominated by the ~467s `astro build` + ~15s `validate:seo` run)
- **Completed:** 2026-07-02T09:23:49Z
- **Tasks:** 2 completed
- **Files modified:** 7 (all `[slug].astro` country templates)

## Accomplishments
- All 7 locale country page templates (`en/country`, `it/paese`, `es/pais`, `fr/pays`, `pt/pais`, `zh/country`, `de/land`) now import `SentimentPillar`, `SentimentVote`, and `loadSentimentForCountry`.
- `getStaticPaths` in every template threads `sentiment: loadSentimentForCountry(country.iso3)` as a build-time prop, mirroring the existing `pillarTrend`/`scoreDelta` pattern.
- `<SentimentPillar sentiment={sentiment} official={country.score} lang={lang}>` renders immediately after `<PillarBreakdown pillars={country.pillars} lang={lang} />`, with `<SentimentVote iso3={country.iso3} officialScore={country.score} countryName={getLocalizedCountryName(country, lang)} lang={lang} />` nested inside its slot — visually "the 6th pillar," structurally independent (D-04/D-06/D-17).
- No other section touched: `country.pillars`, `buildCountryJsonLd`, `buildCountryMetaDescription`, `ScoreHero`, `AdvisorySection`, etc. are byte-identical to before this plan except for the single insertion point.
- Phase acceptance gate (Task 2): `npx astro build` succeeded, building the full 1906-page set (all 7 locales × 248 countries + hub/utility pages) in ~473s. `npm run validate:seo` then reported **2213/2213 checks passed** — the same all-pass count the repo has carried since the last known-good SEO baseline (quick task 260603-csf, 2026-06-03), confirming zero regression from the new Sentiment markup.
- Spot-checked `dist/client/en/country/fra/index.html`: the Sentiment vote form markup is present (`sentiment-vote-form` x2 — one server-rendered, one inside the `<script define:vars>` id reference) and the page's `application/ld+json` block contains no occurrence of "sentiment" — confirming the components emit no JSON-LD and don't perturb the `@graph` (D-21/D-22).

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread the sentiment prop + render the components in all 7 country templates** - `76c1c2b3` (feat)
2. **Task 2: Phase build + SEO gate (astro build all pages, validate:seo all-pass)** - no commit (verification-only task per plan: "This task adds no new files — it is the phase acceptance gate.")

**Plan metadata:** committed with this SUMMARY (see below)

## Files Created/Modified
- `src/pages/en/country/[slug].astro` - Template for the other 6; import + getStaticPaths + Props + insertion (canonical reference)
- `src/pages/it/paese/[slug].astro` - Same 4-part edit, `lang: 'it'`
- `src/pages/es/pais/[slug].astro` - Same 4-part edit, `lang: 'es'`
- `src/pages/fr/pays/[slug].astro` - Same 4-part edit, `lang: 'fr'`
- `src/pages/pt/pais/[slug].astro` - Same 4-part edit, `lang: 'pt'`
- `src/pages/zh/country/[slug].astro` - Same 4-part edit, `lang: 'zh'`
- `src/pages/de/land/[slug].astro` - Same 4-part edit, `lang: 'de'`

## Decisions Made
- Kept the type-only `SentimentEntry` import bundled onto the existing `ScoredCountry` import line rather than adding a new import statement — smaller diff, matches the file's existing style of grouping related pipeline types on one line.
- Grouped `SentimentPillar`/`SentimentVote` component imports immediately after `PillarBreakdown` (both are pillar-family display components) rather than at the end of the import block, for readability/discoverability.
- `loadSentimentForCountry` given its own import line (not merged into the `lib/scores` barrel import) since it lives in a separate module (`lib/sentiment.ts`), consistent with how `lib/seo` and `lib/lastmod` are each imported on their own line in these files.

## Deviations from Plan

None - plan executed exactly as written. Task 2 intentionally produced no file changes and no commit (as specified in the plan's action text: "This task adds no new files — it is the phase acceptance gate"); its outcome is the green build + validate:seo run documented above.

## Issues Encountered

- The worktree had no local `node_modules` (as flagged in the parallel-executor instructions). Created a temporary symlink to the main repo's `node_modules` before running `npx astro build` + `npm run validate:seo`, then removed the symlink (`rm node_modules`) before the final commit/summary step — `node_modules/` is gitignored so this left no trace in git status.
- The initial `grep -rl "SentimentPillar" $files` verification command (with the 7 bracketed `[slug].astro` paths in an unquoted shell variable) failed with "No such file or directory" under this environment's `grep`/`ugrep` alias — the bracket characters in the literal filenames were not the cause (paths exist and are readable), but passing them through unquoted variable expansion broke the multi-file grep invocation. Worked around by looping over the 7 paths individually with per-file `grep -q` calls, which correctly reported `pillar=7 load=7` / PASS. This is a shell/tooling quirk in verification tooling, not a defect in the templates themselves.

## User Setup Required

None - no external service configuration required. (Turnstile sitekey/secret and D1 provisioning remain deferred manual steps tracked since earlier plans in this phase; this plan's scope is purely template wiring + the build gate.)

## Next Phase Readiness

This is the final wave (wave 3) of Phase 39. The Community Sentiment feature (Phase 1, display-only) is now fully wired end-to-end on every country page in all 7 languages:
- Build is green (1906 pages) and `validate:seo` is all-pass (2213/2213) — no SEO/schema regression.
- `data/sentiment/latest.json` does not yet exist in this worktree (the 39-04 pipeline stage lands/runs separately); every country currently renders `SentimentPillar`'s below-floor "not enough votes yet" empty state (D-09) via `loadSentimentForCountry`'s graceful-null degradation — this is expected and does not block merge or deploy.
- No blockers for phase completion. Any future D1/Turnstile provisioning and the first live pipeline run are operational follow-ups tracked outside this plan's scope.

---
*Phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: src/pages/en/country/[slug].astro
- FOUND: src/pages/it/paese/[slug].astro
- FOUND: src/pages/es/pais/[slug].astro
- FOUND: src/pages/fr/pays/[slug].astro
- FOUND: src/pages/pt/pais/[slug].astro
- FOUND: src/pages/zh/country/[slug].astro
- FOUND: src/pages/de/land/[slug].astro
- FOUND: .planning/phases/39-community-sentiment-score-phase-1-display-only-5-level-calib/39-08-SUMMARY.md
- FOUND commit: 76c1c2b3 (Task 1)
- FOUND commit: c5c06147 (docs: summary)
