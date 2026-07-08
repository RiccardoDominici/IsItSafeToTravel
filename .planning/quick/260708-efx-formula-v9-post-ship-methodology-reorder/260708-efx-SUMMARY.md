---
status: complete
---

# Summary — 260708-efx: Formula v9 post-ship fixes

## What shipped

**Commits:** `c7108052` (methodology reorder ×7), `f6e17337` (band-rounding fix wave 1:
ScoreHero/NeighborComparison/RelatedCountries/badge SVG/seo.ts ×3), plus 59af6cf5
(remaining band sites + test fixes).

1. **Methodology pages (×7 locales)**: section order now Overview → Category Weights →
   Understanding Each Category → Sources → Advisory → Formula → Bands → … Pillar meaning
   is presented before the formula, per user request. Pure reorder (385+/385− across 7 files).

2. **FAQ/answers v9 audit** (Opus, source + rendered dist): all user-facing answers confirmed
   v9-clean — country FAQ (7 locales), hub FAQ (all page types), methodology FAQPage JSON-LD,
   Dataset measurementTechnique, llms.txt/llms-full.txt. No "capped at 2/10", no critical
   floor, crime correctly described as GPI Safety & Security everywhere. Verified rendered
   pages: Nicaragua/Jamaica/Italy/China/Afghanistan EN + Nicaragua IT.

3. **Band-rounding bug (audit finding, medium)**: bands computed on raw score vs displayed
   1-decimal value disagreed at boundaries (Nicaragua "6.0 out of 10" + "Only for experienced
   travelers" + FAQ "moderately safe" on one page). Fixed at ALL 12 sites: ScoreHero,
   NeighborComparison, RelatedCountries, badge SVG, seo.ts (meta description, JSON-LD band,
   FAQ verdict), ComparisonTable, hub/CountryRankRow, hub/RegionsIndex, PillarBreakdown
   (pillar-level 0–1 variant), AnswerFirstParagraph, AuthorityLinks. Pattern:
   `const score = Number(rawScore.toFixed(1))` before the threshold chain.

4. **Test-suite real-data corruption (critical)**: `snapshot.test.ts` (listSnapshotDates) and
   `src/pipeline/__tests__/data05-historical.test.ts` overwrote the real
   `data/scores/latest.json` with a fixture (2098-06-01, 1 country) on EVERY `npm test` run.
   Both now back up latest.json in beforeEach and restore in afterEach. Also fixed two stale
   assertions: globalScore rounding (test expected 1 decimal, implementation correctly does 2
   → expect 5.97) and history.test.ts missing `dc: 0` on expected trend points.
   `npm test`: **120/120 pass**, `git status data/scores/` clean after runs (verified twice).

5. Full `npx astro build` + `npm run validate:seo` all-pass before push.

## Verification evidence
- Nicaragua rendered hero: "6.0 out of 10" + "Moderate risk" (was "Only for experienced travelers").
- Methodology EN rendered order: Category Weights → Understanding Each Category → … → Score Bands.
- npm test tally: tests 120 / pass 120 / fail 0; latest.json 2026-07-07 / 248 countries intact post-run.

## Deferred / follow-ups (carried in x81 + 23u deferred-items)
- wb_homicide crime indicator fast-follow; jp advisory parser; Guam ca=4 pipeline data bug;
  active-conflict signal for PSE/RUS-type cases; README broader pre-v9 staleness (WGI mentions,
  locale list) — cosmetic, not formula-related.
