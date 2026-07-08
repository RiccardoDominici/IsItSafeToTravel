# Quick Task 260708-efx: Formula v9 post-ship — methodology reorder, FAQ audit, band-rounding + test-corruption fixes

**Status:** executed (retroactive record — work orchestrated directly in-session with parallel agents)

## Scope

1. **Methodology page reorder ×7 locales** (user request): pillar sections (Category Weights
   table + Understanding Each Category) moved before the formula explanation. Pure block
   relocation, no content changes.
2. **FAQ/answers audit vs v9** (user request): adversarial audit of country FAQ, hub FAQ,
   JSON-LD, llms files — source AND rendered dist HTML — hunting stale v8 content.
3. **Band-rounding bug fix** (audit finding): verdict/color bands were computed on the raw
   score while the adjacent UI displays the 1-decimal rounded value → contradictions at band
   boundaries (Nicaragua 5.9975 showed "6.0" + "Only for experienced travelers" while its own
   FAQ said "moderately safe"). Fix: band on `Number(score.toFixed(1))` at every site that
   displays the rounded value.
4. **Test-suite data corruption fix**: `snapshot.test.ts` (listSnapshotDates) and
   `data05-historical.test.ts` overwrote the real `data/scores/latest.json` with fixtures on
   every `npm test` run (no backup/restore). Plus two stale assertions (globalScore 1-decimal
   vs actual 2-decimal; missing `dc: 0` field in history expectations).

## Tasks

- [x] T1 Reorder methodology sections ×7 (en/it/es/fr/pt/zh/de)
- [x] T2 Audit answers vs v9 (verdict: content clean; 1 medium bug found → T3, 1 stale comment)
- [x] T3 Band-on-displayed-value fix: ScoreHero, NeighborComparison, RelatedCountries,
      badge SVG, seo.ts ×3 (meta/JSON-LD/FAQ verdict), ComparisonTable, CountryRankRow,
      RegionsIndex, PillarBreakdown (pillar-level), AnswerFirstParagraph, AuthorityLinks
- [x] T4 Test fixes: latest.json backup/restore in snapshot.test.ts + data05-historical.test.ts;
      globalScore assertion → 5.97; history dc:0 expectations. npm test 120/120, data/scores
      clean after runs.
- [x] T5 Full rebuild + validate:seo all-pass + push
