---
phase: quick-260706-pcc
plan: 01
subsystem: country-page-seo
tags: [seo, faq, json-ld, i18n, advisories, ai-answer-engines]
requires:
  - src/pipeline/scoring/engine.ts (MIN_PILLAR_COVERAGE, majority-Level-4 cap logic)
  - public/scores.json (pillars, indicators, advisories)
provides:
  - getCountryFaqData v2 (verdict+meaning Q1, indicator-driven Q2, advisory Q3)
  - selectEligiblePillars helper (single-source pillar-eligibility gate)
  - indicatorLabels / advisoryLevelWords / listConnector copy exports (7 langs)
affects:
  - src/components/country/FaqSection.astro (visible FAQ — consumer, unchanged)
  - buildCountryFaqJsonLd / FAQPage @graph node (JSON-LD — consumer, unchanged)
  - country meta descriptions + answer-first paragraph (40+ framing, eligible pillars)
tech-stack:
  added: []
  patterns:
    - "Intl.DisplayNames(locale,{type:'region'}) for localized government names (uk->GB override)"
    - "Eligible-pillar gate imported from engine.ts as the one MIN_PILLAR_COVERAGE source"
    - "Count-invariant advisory-count phrasing (singular/plural noun baked per lang) to avoid verb agreement"
key-files:
  created: []
  modified:
    - src/lib/country-faq-copy.ts
    - src/lib/seo.ts
    - src/components/country/AnswerFirstParagraph.astro
decisions:
  - "FIX-B: fixed source count 40 (literal) in meta + answer-first paragraph, matching site-wide 40+ framing"
  - "Q3 {governments} = 1-2 governments at the highest present advisory level, priority-ordered; consensus band = modal level (ties resolve upward)"
  - "advisory_level_* indicators collapse to one advisory_group label (lowest normalizedValue), counted once"
metrics:
  duration: ~19m (build+validate ~11m of it)
  tasks: 3
  files: 3
  completed: 2026-07-06
---

# Quick Task 260706-pcc: FAQ v2 — Si/No verdict, inline pillar meaning, indicator-driven risk, advisory Q3 Summary

Reworked the country-page FAQ generator so Q1 gives an explicit verdict then explains *why* in place (drag pillars + what the weakest one means), Q2 names the real lowest-scoring indicators behind the weakest eligible pillar, and Q3 drops the un-answerable insurance question for a government-advisory summary drawn from our own advisory data — plus the two deferred fixes (Monaco zero-data pillar bug, unified 40+ source framing).

## What shipped

### Task 1 — Deferred fixes A + B (commit `1e59c789`)
- Added `selectEligiblePillars(pillars)` in `seo.ts`, importing `MIN_PILLAR_COVERAGE` from `engine.ts` as the single threshold source (mirrors the engine's own composite-score fallback: filter to `dc >= 0.30`, else all pillars).
- `buildCountryMetaDescription` and `getCountryFaqData` now select weakest/strongest from eligible pillars only, so **Monaco no longer names its zero-data crime/governance/environment pillars**. The `second`-pillar slot falls back to `weakest` when only one pillar is eligible, so single-eligible countries never render `undefined`.
- `AnswerFirstParagraph.astro` mirrors the same eligible-filter logic (inline, same imported constant).
- **FIX-B**: unified to the site-wide fixed `40` source count (was `country.sources.length || 7`) in the meta description and the answer-first paragraph, so both read `40+`.

### Task 2 — FAQ copy + assembly rework (commit `8f86dc5d`)
- **Q1 (verdict + why):** `a1Drivers.normal` now appends `{meaning}` (reusing the existing `pillarMeaning` library) so the answer explains what the weakest pillar concretely means for the traveler. `allStrong` unchanged (top scorers get no "watch out").
- **Q2 (indicator-driven):** new `indicatorLabels` export (15 keys × 7 langs). A `{drivers}` clause names the 1-2 lowest-scoring signals inside the weakest **eligible** pillar. All `advisory_level_*` collapse to one `advisory_group` label (represented once by its lowest `normalizedValue`). Graceful single-label degrade (AFG crime = only rule-of-law); no drivers/alarmism when the weakest is ≥7/10 (Iceland reads "no significant risk").
- **Q3 (advisory):** insurance question + `a3Opening`/`a3Health`/`a3Advisory` removed. New question "What do government travel advisories say about {name}?" answered entirely from `country.advisories`: localized count phrase, modal-level consensus band, 1-2 named governments via `Intl.DisplayNames` (`uk`→`GB`, fallback to advisory `.source`), majority-Level-4 score-cap explained in place (`level4Count >= ceil(N/2 + 0.1)`, mirrors `engine.ts`), and a distinct zero-advisory sentence for micro-territories.
- Added `advisoryLevelWords` (tier labels ×4 ×7 langs) and `listConnector` (×7 langs) exports; updated the file-header docblock.

### Task 3 — Build, SEO gate, parity spot-check (no code change)
- `npx astro build` → 1913 pages built (engine.ts import externalizes cleanly at build time).
- `npm run validate:seo` → **2213/2213 passed** (FAQPage @graph node intact).
- Built HTML spot-check across en ISL/MCO/AFG/MEX + zh AFG + de MEX: no unfilled `{placeholder}`, no leaked `undefined`, no insurance copy.
- FAQ ↔ FAQPage JSON-LD parity confirmed byte-identical (every `acceptedAnswer.text` present verbatim in visible HTML) in en + zh; Q3 is the advisory question, not insurance.

## Edge-country behaviour (verified via getCountryFaqData spot-check, all 7 langs)
- **ISL** (9.41): weakest = governance 8.7 → Q2 strong band, non-alarmist; Q3 normal/reassuring.
- **MCO** (9.62): only health eligible → weakest=strongest=health, no `undefined`; Q3 normal, no zero-data pillar named anywhere.
- **AFG** (1.97): Q1 names crime + governance + crime meaning; Q2 single-indicator "rule of law (V-Dem)"; Q3 avoid band, "United States and United Kingdom" (uk→GB), majority-L4 cap sentence fires.
- **MEX** (5.13): Q1/Q2 environment (climate + natural-hazard INFORM signals); Q3 caution band, strongest warning "do not travel — comes from Japan", no cap.
- **ALA** (+14 territories): Q3 zero-advisory sentence.

## Deviations from Plan

None — plan executed exactly as written. No architectural changes, no auth gates, no package installs.

## Threat surface

No new surface. FAQ answers stay plain text through the single generator (`buildFaqPageJsonLd` JSON.stringifies, `FaqSection.astro` auto-escapes) — T-pcc-01 parity mitigation holds. Single-eligible-pillar guard (T-pcc-02) validated (no `undefined` in any output). Government names derive from trusted hard-coded advisory keys (T-pcc-03). No install step (T-pcc-SC).

## Known Stubs

None. All three answers render live per-country data across 248 countries × 7 languages.

## Commits
- `1e59c789` fix(quick-260706-pcc): eligible-pillar selection + 40+ source framing
- `8f86dc5d` feat(quick-260706-pcc): FAQ v2 — verdict+meaning Q1, indicator-driven Q2, advisory Q3

## Self-Check: PASSED
- Files exist: src/lib/country-faq-copy.ts, src/lib/seo.ts, src/components/country/AnswerFirstParagraph.astro — all FOUND.
- Commits exist: 1e59c789, 8f86dc5d — both FOUND in git log.
- Gates: npx astro build OK; npm run validate:seo 2213/2213; FAQ/JSON-LD parity byte-identical.
