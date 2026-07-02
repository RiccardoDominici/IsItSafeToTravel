---
phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib
plan: 05
subsystem: ui
tags: [astro, i18n, sentiment, pillar-card, display-only]

# Dependency graph
requires:
  - phase: 39-02
    provides: SentimentEntry/SentimentSnapshot types in src/pipeline/types.ts
  - phase: 39-03
    provides: sentiment.* i18n keys (7 locales) in src/i18n/ui.ts
provides:
  - "src/lib/sentiment.ts: build-time loader (loadSentimentForCountry) + MIN_VOTE_FLOOR constant"
  - "src/components/country/SentimentPillar.astro: display-only 6th-pillar card with a <slot/> for the vote widget"
affects: [39-06, 39-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sentiment.ts mirrors scores.ts's fs.existsSync + try/catch graceful-null loader pattern"
    - "SentimentPillar.astro mirrors PillarBreakdown.astro's row anatomy (w-28 label / viewBox 200x24 SVG bar / w-14 value) to read as the same visual weight as the other 5 pillars"

key-files:
  created:
    - src/lib/sentiment.ts
    - src/lib/__tests__/sentiment.test.ts
    - src/components/country/SentimentPillar.astro
  modified: []

key-decisions:
  - "loadSentimentForCountry(iso3) has no injectable path param (matches the plan's exact interface); the test exercises all four D-14 branches (missing file, entry present, missing country, malformed JSON) by writing/restoring a temp fixture at the real data/sentiment/latest.json path with before/after cleanup"
  - "SVG bar aria-label built from existing i18n keys (label + value + sentiment.badge parenthetical) instead of inventing a new dedicated aria-label key, to stay within this plan's 3-file scope (src/i18n/ui.ts is owned by 39-03/Wave 1)"
  - "Community badge placed in the card header (next to the H2) rather than in the correction/count sub-line -- matches the UI-SPEC's 'attached to this row / its containing card' framing and mirrors the existing 'updated daily' badge placement pattern"

patterns-established:
  - "Display-only 6th-pillar components read SentimentEntry via src/lib/sentiment.ts and render independently of ScoredCountry.pillars -- never import PillarScore, never emit JSON-LD"

requirements-completed: [D-04, D-06, D-07, D-09, D-14]

# Metrics
duration: 6min
completed: 2026-07-02
---

# Phase 39 Plan 05: Build-time sentiment loader + SentimentPillar display card Summary

**Graceful build-time `data/sentiment/latest.json` reader plus a display-only "6th pillar" Astro card (bar/badge/correction/count/disclaimer, below-floor empty state, and a `<slot/>` for the 39-06 vote widget) that never touches `country.pillars` or JSON-LD.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-02T10:55:14+02:00 (wave-1 merge base)
- **Completed:** 2026-07-02T11:00:54+02:00
- **Tasks:** 2 completed
- **Files modified:** 3 (all new)

## Accomplishments
- `src/lib/sentiment.ts` exports `loadSentimentForCountry(iso3)` and `MIN_VOTE_FLOOR = 5`, mirroring `src/lib/scores.ts`'s `existsSync` + try/catch graceful-null pattern so a missing/absent/malformed `data/sentiment/latest.json` never crashes the build (D-14).
- `src/lib/__tests__/sentiment.test.ts` covers all four degradation branches (missing file, entry found, missing country, malformed JSON) via a self-cleaning temp fixture written to the real `data/sentiment/latest.json` path.
- `src/components/country/SentimentPillar.astro` renders the community-perceived value as a bar row visually identical to `PillarBreakdown` (same label/SVG-bar/value anatomy, `pillarToColor` at `perceived/10`), with a neutral "Community" badge, signed correction (`+0.4 vs official score`), vote count, and a persistent (non-tooltip-only) disclaimer.
- Below-floor gate (`count < MIN_VOTE_FLOOR`) swaps the bar+value for the localized "not enough votes yet" empty state while keeping the disclaimer and the `<slot/>` for the vote widget always present.
- No JSON-LD emitted, no `PillarScore` import, not appended to `country.pillars` -- verified by grep gate (D-06/D-21/D-22).

## Task Commits

Each task was committed atomically:

1. **Task 1: src/lib/sentiment.ts -- build-time loader + MIN_VOTE_FLOOR (+ graceful test)** - `4680989a` (feat)
2. **Task 2: SentimentPillar.astro -- 6th-pillar card, correction/count/disclaimer, below-floor state, widget slot** - `6e2334e8` (feat)

**Plan metadata:** committed with this SUMMARY (see below)

## Files Created/Modified
- `src/lib/sentiment.ts` - Build-time loader (`loadSentimentForCountry`) + `MIN_VOTE_FLOOR` constant, mirrors `scores.ts`
- `src/lib/__tests__/sentiment.test.ts` - node:test coverage of all graceful-degradation branches
- `src/components/country/SentimentPillar.astro` - Display-only 6th-pillar card; props `sentiment: SentimentEntry | null`, `official: number`, `lang: Lang`; exposes `<slot/>` for the 39-06 vote widget

## Decisions Made
- Kept `loadSentimentForCountry`'s signature exactly as specified (single `iso3` param, no injectable path) and tested the real filesystem path with fixture write/restore in `before`/`after`, rather than adding a path-injection parameter not called for by the interface contract.
- Built the SVG bar's localized `aria-label` from the existing `country.pillar.sentiment` and `sentiment.badge` keys (no new i18n key added) to respect this plan's 3-file scope -- `src/i18n/ui.ts` is Wave 1 / 39-03's file.
- Placed the "Community" badge in the card header next to the H2 (mirrors the existing "updated daily" badge geometry) rather than inline with the correction/count sub-line; both are valid per the UI-SPEC's "attached to this row / its containing card" framing.

## Deviations from Plan

None - plan executed exactly as written. The two implementation choices above (aria-label construction, badge placement) were left at "Claude's discretion" by the plan/UI-SPEC and are documented as decisions, not deviations.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`src/lib/sentiment.ts` and `SentimentPillar.astro` are ready for 39-06 (vote widget, injected via `<slot/>`) and 39-08 (country-page wiring: `<SentimentPillar sentiment={loadSentimentForCountry(country.iso3)} official={country.score} lang={lang}>` placed immediately after `#pillars`, per D-17). No blockers. `data/sentiment/latest.json` does not exist yet in this worktree (39-04's pipeline lands separately) -- `loadSentimentForCountry` already degrades to `null` for that case, which `SentimentPillar` renders as the below-floor empty state, so wiring can proceed independently of pipeline landing order.

---
*Phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib*
*Completed: 2026-07-02*
