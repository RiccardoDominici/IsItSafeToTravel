---
phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib
plan: 03
subsystem: i18n
tags: [i18n, astro, translations, sentiment, methodology, privacy]

# Dependency graph
requires: []
provides:
  - "sentiment.* i18n key cluster (badge, disclaimer, correction_label, vote_count, question, 5 calibration level labels, submit, empty/thanks/error states) in all 7 ui.ts locale blocks"
  - "country.pillar.sentiment label key in all 7 locale blocks"
  - "methodology.sentiment_title / methodology.sentiment_text keys in all 7 locale blocks"
  - "legal.privacy_votes_title / legal.privacy_votes_text keys in all 7 locale blocks"
affects: [39-04, 39-05, 39-06, 39-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New flat-key i18n cluster mirrored identically across all 7 ui.xx locale blocks (en/it/es/fr/pt/zh/de), matching the existing country.pillar.* / methodology.* / legal.privacy_* repetition pattern"
    - "it/es/fr/pt translations follow the file's established ASCII-only (no accented characters) convention; zh/de use full Unicode as elsewhere in the file"

key-files:
  created: []
  modified:
    - src/i18n/ui.ts

key-decisions:
  - "Italian calibration level labels use the exact wording locked by the user in CONTEXT.md D-02 (molto alto / alto / giusto / basso / molto basso) rather than a fresh translation"
  - "it/es/fr/pt sentiment.*/methodology.sentiment_*/legal.privacy_votes_* translations were written accent-free to match the pre-existing convention in those three locale blocks (verified via grep: near-zero accented characters across ~470 lines per block already in the file)"
  - "New keys inserted immediately after 'country.pillar.environment' (sentiment.* cluster) and immediately before 'methodology.limitations_title' / immediately after 'legal.privacy_rights_text' (methodology/legal clusters), per plan's instruction to mirror existing adjacent-cluster placement"

patterns-established:
  - "Any future i18n key addition to ui.ts should be added to all 7 locale blocks in the same relative position, matching this plan's insertion points"

requirements-completed: [D-02, D-05, D-07, D-09, D-17, D-19, D-20]

# Metrics
duration: 12min
completed: 2026-07-02
---

# Phase 39 Plan 03: i18n — sentiment.* + country.pillar.sentiment + methodology/privacy keys Summary

**Added the full Community Sentiment i18n vocabulary (21 keys × 7 locales = 147 new key/value pairs) to `src/i18n/ui.ts` — the single source of truth downstream plans 39-05/39-06/39-07 will consume via `useTranslations(lang)`.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-02T09:03:00Z (approx, worktree agent start)
- **Completed:** 2026-07-02
- **Tasks:** 2/2 completed
- **Files modified:** 1 (`src/i18n/ui.ts`)

## Accomplishments
- Added `country.pillar.sentiment` label + 16 `sentiment.*` widget/pillar strings (badge, disclaimer, correction readout, vote count, calibration question, all 5 calibration level labels mapped to D-02's signed deltas, submit CTA, empty/thanks/error states) to all 7 `ui.xx` locale blocks
- Added `methodology.sentiment_title` / `methodology.sentiment_text` (explicit "does not affect the total score" statement per D-19) to all 7 locale blocks
- Added `legal.privacy_votes_title` / `legal.privacy_votes_text` (salted-hash IP dedupe, no raw IP retention, env-gated Turnstile, localStorage soft-dedupe note per D-20) to all 7 locale blocks
- Verified zero key-count drift: every one of the 21 new keys appears exactly 7 times in the file
- Verified `{country}`, `{delta}`, `{count}` interpolation tokens are present in every locale's `sentiment.question` / `sentiment.correction_label` / `sentiment.vote_count`
- Verified `npx astro check` reports zero errors/warnings against `src/i18n/ui.ts` (all 239 pre-existing project errors are in unrelated `src/pipeline/**` files, out of scope for this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the sentiment.* + country.pillar.sentiment key cluster to all 7 locale blocks** - `cdd9c21a` (feat)
2. **Task 2: Add methodology.sentiment_* and legal.privacy_votes_* keys to all 7 locale blocks** - `5456f846` (feat)

**Plan metadata:** SUMMARY.md commit (this file)

## Files Created/Modified
- `src/i18n/ui.ts` - Added 21 new i18n keys (`country.pillar.sentiment`, 16 `sentiment.*` keys, `methodology.sentiment_title`/`_text`, `legal.privacy_votes_title`/`_text`) to each of the 7 locale blocks (en, it, es, fr, pt, zh, de) — 147 total new key/value lines

## Decisions Made
- Italian calibration level labels ("Molto alto" / "Alto" / "Giusto" / "Basso" / "Molto basso") use the exact wording the user locked in CONTEXT.md D-02, rather than a fresh translation of the English canonical copy — this is authoritative source material, not an invented phrase.
- it/es/fr/pt translations for all new keys are accent-free (ASCII-only), matching the pre-existing style already used across ~470 lines in each of those three locale blocks (confirmed via grep before writing — e.g. "usabilita" not "usabilità", "e" not "è" throughout `legal.privacy_*` and other clusters). zh and de use full Unicode (including German umlauts), also matching existing convention in those blocks.
- Insertion points: `sentiment.*` cluster placed immediately after `'country.pillar.environment'` (so the pillar label sits with the other five pillar labels, and the widget copy follows as an adjacent cluster, per plan instructions). `methodology.sentiment_*` placed immediately before `'methodology.limitations_title'` (end of the methodology content clusters). `legal.privacy_votes_*` placed immediately after `'legal.privacy_rights_text'` (end of the existing privacy sub-block, before the `<hr>`-separated legal-terms half of the page per 39-PATTERNS.md).

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria (grep-based key-count parity gates, interpolation token presence, `astro check` type safety) passed without requiring any auto-fixes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan only touches static i18n data.

## Next Phase Readiness

- `src/i18n/ui.ts` now exposes the full `sentiment.*` namespace, `country.pillar.sentiment`, `methodology.sentiment_*`, and `legal.privacy_votes_*` keys in all 7 published locales, ready for `useTranslations(lang)` lookup.
- Downstream plans can now consume these keys directly:
  - 39-05 (SentimentPillar component) reads `country.pillar.sentiment`, `sentiment.badge`, `sentiment.disclaimer`, `sentiment.correction_label`, `sentiment.vote_count`, `sentiment.empty_title`, `sentiment.empty_body`
  - 39-06 (SentimentVote widget) reads `sentiment.question`, the 5 `sentiment.level_*` labels, `sentiment.submit`, `sentiment.thanks_title`, `sentiment.thanks_body`, `sentiment.error`
  - 39-07 (methodology/privacy docs) reads `methodology.sentiment_title`/`_text` and `legal.privacy_votes_title`/`_text`
- No blockers. `src/i18n/ui.ts` is per-plan-scope owned exclusively by this plan (per its frontmatter `files_modified`), so no merge-conflict risk with sibling wave-1 plans that read but do not write this file.

---
*Phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib*
*Completed: 2026-07-02*
