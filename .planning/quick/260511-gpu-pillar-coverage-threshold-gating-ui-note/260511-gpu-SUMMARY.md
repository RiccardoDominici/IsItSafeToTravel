---
phase: quick-260511-gpu
plan: 01
subsystem: scoring + country-ui + i18n
tags: [scoring, coverage, pillar, i18n, ui, accessibility]
dependency_graph:
  requires:
    - existing weighted-log-mean composite path in engine.ts
    - publishedLanguages set (en, it, es, fr, pt, zh, de)
  provides:
    - MIN_PILLAR_COVERAGE constant (0.30) exported from engine.ts
    - LOW_COVERAGE_FLAG_THRESHOLD constant (0.50) exported from engine.ts
    - country.pillar_low_coverage_note i18n key in all 7 locales
    - amber asterisk + native-title tooltip on low-coverage pillar score rows
  affects:
    - composite-score arithmetic (coverage-gated geometric mean)
    - critical-floor calculation (sub-30% pillars no longer drive the floor)
    - PillarBreakdown.astro and PillarDetailTable.astro render contract
tech_stack:
  added: []
  patterns:
    - native HTML title-attribute tooltip (no new dependency, matches SourcesList pattern)
    - exported constants imported by UI components (single source of truth)
key_files:
  created: []
  modified:
    - src/pipeline/scoring/engine.ts
    - src/pipeline/scoring/__tests__/engine.test.ts
    - src/components/country/PillarBreakdown.astro
    - src/components/country/PillarDetailTable.astro
    - src/i18n/ui.ts
decisions:
  - Hard-gate threshold locked at 0.30 (MIN_PILLAR_COVERAGE)
  - Soft-flag threshold locked at 0.50 (LOW_COVERAGE_FLAG_THRESHOLD)
  - Weight renormalization happens implicitly via eligible-weight sum in the weighted-log-mean denominator (no per-weight rescaling needed)
  - When zero pillars meet the gate, fall back to the all-pillars path with console.warn (avoids NaN on universally thin data)
  - Asterisk uses both `title` (mouse hover) and `aria-label` (screen reader) for accessibility
  - LOW_COVERAGE_FLAG_THRESHOLD is exported but unused by the engine — it lives in engine.ts so UI components import a single source of truth
metrics:
  duration_minutes: ~8
  completed_date: 2026-05-11
  task_count: 2
  file_count: 5
  commits:
    - 1298654
    - c24fe07
---

# Quick Task 260511-gpu: Pillar Coverage Threshold Gating + UI Note Summary

Coverage-gate sub-30% pillars from the composite geometric mean (and the critical floor), and surface a sub-50% UI heads-up (amber asterisk + native tooltip) across all 7 published locales — no new dependencies, single-source-of-truth constants exported from `engine.ts`.

## Files Modified

| File | Change |
|---|---|
| `src/pipeline/scoring/engine.ts` | Exported `MIN_PILLAR_COVERAGE = 0.30` and `LOW_COVERAGE_FLAG_THRESHOLD = 0.50`; filter `eligiblePillars` before the weighted-log-mean; apply the same gate to critical-floor `pillarsWithData`; fallback-to-all path with `console.warn` when no pillar meets the gate |
| `src/pipeline/scoring/__tests__/engine.test.ts` | Added 3 tests under `describe('pillar-coverage threshold gating')` covering exclusion, weight renormalization, and the all-below-gate fallback |
| `src/components/country/PillarBreakdown.astro` | Import `LOW_COVERAGE_FLAG_THRESHOLD`; compute `lowCoverage` per pillar; render an amber asterisk with `title` + `aria-label` after `{score}/10` when low |
| `src/components/country/PillarDetailTable.astro` | Same import + asterisk pattern; asterisk inserted BEFORE the ` · {riskLevel}` separator so it attaches to the score |
| `src/i18n/ui.ts` | Added `country.pillar_low_coverage_note` key in all 7 published locales (en, it, es, fr, pt, zh, de), inserted immediately after each locale's existing `country.pillar_coverage` key |

## Final Threshold Values (locked)

| Constant | Value | Effect |
|---|---|---|
| `MIN_PILLAR_COVERAGE` | `0.30` | Hard gate — pillar excluded from composite + critical floor |
| `LOW_COVERAGE_FLAG_THRESHOLD` | `0.50` | Soft flag — UI shows asterisk + localized tooltip |

## Sample Country Where the Asterisk Renders

Using the latest score snapshot (`data/scores/latest.json` — pre-gating, but `dataCompleteness` is preserved):

**SOM (Somalia)** — pillar coverage breakdown:
- conflict: 39% → asterisk (below 50%, above 30% gate → still contributes to composite)
- crime: 0% → asterisk (below 30% → EXCLUDED from composite)
- health: 100% → no asterisk
- governance: 33% → asterisk (below 50%, above 30% gate → still contributes)
- environment: 60% → no asterisk

Other concrete examples in the snapshot with at least one asterisk-rendering pillar (sub-50%): YEM, SYR, SDN, PRK, LBY, MCO, SMR, VAT, LIE — total of 248 countries in the snapshot have at least one pillar below 50% coverage.

After scores are regenerated (next pipeline run), SOM's composite will exclude the 0%-coverage crime pillar entirely and renormalize across conflict + health + governance + environment.

## i18n Confirmation

`grep -c "pillar_low_coverage_note" src/i18n/ui.ts` → **7** (one entry per locale: en, it, es, fr, pt, zh, de).

Locale strings used:

| Locale | String |
|---|---|
| en | "When a pillar has low data coverage, its contribution to the overall score is reduced or excluded." |
| it | "Quando un pilastro ha poca copertura dati, il suo contributo allo score complessivo è ridotto o escluso." |
| es | "Cuando un pilar tiene poca cobertura de datos, su contribución a la puntuación general se reduce o se excluye." |
| fr | "Lorsqu'un pilier a une faible couverture de données, sa contribution au score global est réduite ou exclue." |
| pt | "Quando um pilar tem pouca cobertura de dados, sua contribuição para a pontuação geral é reduzida ou excluída." |
| zh | "当某个支柱的数据覆盖率较低时,其对总体评分的贡献会被减少或排除." |
| de | "Wenn eine Säule eine geringe Datenabdeckung hat, wird ihr Beitrag zur Gesamtbewertung reduziert oder ausgeschlossen." |

`displayLanguages` / `publishedLanguages` from `src/i18n/ui.ts:18` was confirmed to be exactly 7 entries (`['en', 'it', 'es', 'fr', 'pt', 'zh', 'de']`) — matches the plan's assumption.

## Verification

- `npm run test:pipeline` — **24 tests passed, 0 failed** (3 new coverage-gating tests included)
- `npm run build` — **1892 pages built in 448s** across all 7 locale trees; SEO post-build validation: **2186/2186 checks passed**
- `grep -n "MIN_PILLAR_COVERAGE\|LOW_COVERAGE_FLAG_THRESHOLD" src/pipeline/scoring/engine.ts` — 2 declarations + 2 use sites + 3 comment references (7 total)
- `grep -c "pillar_low_coverage_note" src/i18n/ui.ts` — `7`
- `grep -c "LOW_COVERAGE_FLAG_THRESHOLD" src/components/country/PillarBreakdown.astro` — `2` (import + use)
- `grep -c "LOW_COVERAGE_FLAG_THRESHOLD" src/components/country/PillarDetailTable.astro` — `2` (import + use)

## Deviations from Plan

None — the plan executed exactly as written.

The plan's pre-noted line numbers in `src/i18n/ui.ts` (en=431, it=907, es=1381, fr=1855, pt=2329, zh=2799, de=3269) all matched the file on disk; insertion was anchored on the existing `'country.pillar_coverage'` key per the constraint, not on raw line numbers.

## Self-Check: PASSED

- File `src/pipeline/scoring/engine.ts` exists with `MIN_PILLAR_COVERAGE` and `LOW_COVERAGE_FLAG_THRESHOLD` exported: FOUND
- File `src/pipeline/scoring/__tests__/engine.test.ts` exists with new test suite: FOUND
- File `src/components/country/PillarBreakdown.astro` exists with import + asterisk: FOUND
- File `src/components/country/PillarDetailTable.astro` exists with import + asterisk: FOUND
- File `src/i18n/ui.ts` exists with `pillar_low_coverage_note` × 7: FOUND
- Commit `1298654` exists on `worktree-agent-a136f6cf301e99da6`: FOUND
- Commit `c24fe07` exists on `worktree-agent-a136f6cf301e99da6`: FOUND
