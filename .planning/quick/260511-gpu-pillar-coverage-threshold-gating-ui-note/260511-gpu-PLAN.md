---
phase: quick-260511-gpu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pipeline/scoring/engine.ts
  - src/pipeline/scoring/__tests__/engine.test.ts
  - src/components/country/PillarBreakdown.astro
  - src/components/country/PillarDetailTable.astro
  - src/i18n/ui.ts
autonomous: true
requirements:
  - QT-260511-GPU-01  # Hard-gate pillars with coverage < 30% (exclude + renormalize)
  - QT-260511-GPU-02  # Soft-flag pillars with coverage < 50% with asterisk + tooltip
  - QT-260511-GPU-03  # i18n tooltip text in all 7 active locales

must_haves:
  truths:
    - "When a pillar has dataCompleteness < 0.30, it is excluded from the composite geometric mean and the remaining pillar weights are renormalized to sum to the original total"
    - "When a pillar has dataCompleteness < 0.30, no critical-floor or hard-cap logic is driven by that pillar's score"
    - "On the country page, any pillar with dataCompleteness < 0.50 renders a literal '*' immediately after its '{score}/10' value"
    - "Hovering the asterisk shows a native tooltip whose text is sourced from the active locale's 'country.pillar_low_coverage_note' key"
    - "All 7 published locales (en, it, es, fr, pt, zh, de) have the new tooltip translation key populated"
  artifacts:
    - path: "src/pipeline/scoring/engine.ts"
      provides: "MIN_PILLAR_COVERAGE constant + coverage-gated geometric mean + gated critical floor"
      contains: "MIN_PILLAR_COVERAGE"
    - path: "src/pipeline/scoring/__tests__/engine.test.ts"
      provides: "Test cases for low-coverage pillar exclusion and weight renormalization"
      contains: "MIN_PILLAR_COVERAGE"
    - path: "src/components/country/PillarBreakdown.astro"
      provides: "Asterisk + native-title tooltip on low-coverage pillar score display"
      contains: "pillar_low_coverage_note"
    - path: "src/components/country/PillarDetailTable.astro"
      provides: "Asterisk + native-title tooltip on low-coverage pillar score display"
      contains: "pillar_low_coverage_note"
    - path: "src/i18n/ui.ts"
      provides: "country.pillar_low_coverage_note key for en, it, es, fr, pt, zh, de"
      contains: "pillar_low_coverage_note"
  key_links:
    - from: "src/pipeline/scoring/engine.ts (geometric mean loop)"
      to: "MIN_PILLAR_COVERAGE constant"
      via: "pillars.filter(p => p.dataCompleteness >= MIN_PILLAR_COVERAGE)"
      pattern: "MIN_PILLAR_COVERAGE"
    - from: "src/components/country/PillarBreakdown.astro"
      to: "i18n key country.pillar_low_coverage_note"
      via: "t('country.pillar_low_coverage_note')"
      pattern: "pillar_low_coverage_note"
---

<objective>
Implement pillar-coverage threshold gating in the scoring formula and surface a UI heads-up on low-coverage pillars across all 7 site locales.

Purpose: A pillar with very little data should not silently distort a country's safety score. Treat it as "unavailable" (exclude + renormalize) below 30% coverage, and visibly flag it (asterisk + tooltip) below 50% so users know the displayed pillar number is based on thin data.

Output:
- `MIN_PILLAR_COVERAGE = 0.30` and `LOW_COVERAGE_FLAG_THRESHOLD = 0.50` constants exported from `engine.ts`
- Updated composite-score path that excludes sub-30% pillars from the weighted geometric mean and from the critical-floor calculation
- Asterisk + native HTML title tooltip on pillar score rows in both `PillarBreakdown.astro` and `PillarDetailTable.astro`
- New i18n key `country.pillar_low_coverage_note` in all 7 published locales (en, it, es, fr, pt, zh, de)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src/pipeline/scoring/engine.ts
@src/pipeline/types.ts
@src/components/country/PillarBreakdown.astro
@src/components/country/PillarDetailTable.astro

<interfaces>
<!-- Key types and existing constants the executor needs. Already extracted — no exploration needed. -->

From src/pipeline/types.ts:
```typescript
export interface PillarScore {
  name: PillarName;           // 'conflict' | 'crime' | 'health' | 'governance' | 'environment'
  score: number;              // 0-1
  weight: number;             // from weights.json
  indicators: IndicatorScore[];
  dataCompleteness: number;   // 0-1 — THIS is the "coverage" the task refers to
}
```

From src/pipeline/scoring/engine.ts (existing constants at top of file, lines 36-42):
```typescript
const CRITICAL_PILLAR_THRESHOLD = 0.25;
const CRITICAL_FLOOR_MULTIPLIER = 1.5;
const ADVISORY_HARD_CAP_LEVEL = 4;
const ADVISORY_HARD_CAP_MAJORITY = true;
const ADVISORY_HARD_CAP_BASE = 2;
const GEOMETRIC_MEAN_FLOOR = 0.01;
const LOW_DATA_THRESHOLD = 0.3;             // unrelated: overall completeness, not per-pillar
```

From src/components/country/PillarBreakdown.astro (existing render contract, lines 33-52):
```astro
{sorted.map((pillar) => {
  const label = t(pillarKeys[pillar.name] as any);
  const displayScore = (pillar.score * 10).toFixed(1);
  // ... renders a flex row with label | bar | "{displayScore}/10"
  // pillar.dataCompleteness IS available on the PillarScore object
})}
```

From src/components/country/PillarDetailTable.astro (existing render contract, lines 31-44):
```astro
{sorted.map((pillar) => {
  const displayScore = (pillar.score * 10).toFixed(1);
  const coveragePercent = Math.round(pillar.dataCompleteness * 100);
  // ... renders "{displayScore}/10 · {riskLevel} · Coverage: {coveragePercent}%"
})}
```

From src/i18n/ui.ts (locale block structure):
```typescript
export const publishedLanguages = ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de'] as const;

// Each locale block is a top-level key in `ui`. The 'country.pillar_coverage'
// key already exists in each at lines: en=431, it=907, es=1381, fr=1855,
// pt=2329, zh=2799, de=3269. Insert the new key adjacent to these.
```

Native tooltip pattern in use (no library — confirmed via src/components/country/SourcesList.astro:75):
```astro
<span title={t('country.pillar_low_coverage_note')}>*</span>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement coverage-gated scoring formula in engine.ts</name>
  <files>src/pipeline/scoring/engine.ts, src/pipeline/scoring/__tests__/engine.test.ts</files>
  <action>
At the top constants block of `src/pipeline/scoring/engine.ts` (just below the existing `LOW_DATA_THRESHOLD = 0.3` line), add two EXPORTED constants so the UI layer and tests can import them by name:

  - `export const MIN_PILLAR_COVERAGE = 0.30;` — hard gate: pillars with `dataCompleteness < MIN_PILLAR_COVERAGE` are excluded from the composite score.
  - `export const LOW_COVERAGE_FLAG_THRESHOLD = 0.50;` — soft flag: pillars with `dataCompleteness < LOW_COVERAGE_FLAG_THRESHOLD` get a UI asterisk. The engine does NOT use this constant directly; it is exported so the UI components import a single source of truth.

In `computeCountryScore` (around lines 132-161 of `engine.ts`), modify the composite-score path:

  1. Build `eligiblePillars = pillars.filter(p => p.dataCompleteness >= MIN_PILLAR_COVERAGE)` BEFORE the existing `totalWeight` / `weightedLogSum` reductions.
  2. If `eligiblePillars.length === 0`, fall back to the existing all-pillars path (so a country with universally thin data still gets a number rather than NaN). Add a `console.warn` noting the fallback for the iso3.
  3. Otherwise compute `totalWeight` and `weightedLogSum` over `eligiblePillars` only. The geometric mean denominator becomes the sum of eligible weights, which is the renormalization (no need to scale individual weights — the weighted log-mean already normalizes by `totalWeight`).
  4. Update the critical-floor calculation (lines 154-161): change `pillarsWithData = pillars.filter(p => p.dataCompleteness > 0)` to `pillarsWithData = pillars.filter(p => p.dataCompleteness >= MIN_PILLAR_COVERAGE)`. Sub-30%-coverage pillars must not drive the floor.
  5. Do NOT modify the advisory-hard-cap logic (lines 167-178) — it's driven by advisory levels, not pillar coverage.
  6. Do NOT modify the per-pillar tiered scoring inside `computeTieredPillarScore` — that function still runs for every pillar; only the COMPOSITE step excludes them.
  7. Do NOT modify the `dataCompleteness` field on each `PillarScore` — UI needs the real value to decide whether to show the asterisk.

In `src/pipeline/scoring/__tests__/engine.test.ts`, add three new test cases at the end of the existing test file (follow the existing `node:test` + `node:assert` style already used in the file):

  - "excludes pillars below MIN_PILLAR_COVERAGE from composite score" — build a synthetic `weightsConfig` and `allIndicators` such that one pillar has coverage 0.20 and a deliberately bad score, another pillar has coverage 1.0 and a good score; assert that the composite is dominated by the high-coverage pillar (e.g. composite ≥ 7/10), proving the bad-low-coverage pillar was excluded.
  - "renormalizes remaining pillar weights when one is gated" — build two configs: (A) two pillars each at weight 0.5, both with full data and identical scores 0.7; (B) same plus a third pillar at weight 0.5 with coverage 0.10 and score 0.1; assert the composite scores of (A) and (B) are equal to within 0.05/10, proving the low-coverage third pillar was effectively dropped and the remaining weights renormalize.
  - "falls back to all pillars when none meet MIN_PILLAR_COVERAGE" — every pillar at coverage 0.10; assert the call does not throw and returns a finite numeric score.

Import the new constants into the test file via `import { MIN_PILLAR_COVERAGE } from '../engine';` to anchor the threshold value.
  </action>
  <verify>
    <automated>npm run test:pipeline</automated>
  </verify>
  <done>
- `MIN_PILLAR_COVERAGE` and `LOW_COVERAGE_FLAG_THRESHOLD` are exported from `engine.ts`
- The three new test cases pass; existing tests still pass
- `grep -n "MIN_PILLAR_COVERAGE" src/pipeline/scoring/engine.ts` shows the constant referenced in both the composite-score filter and the critical-floor filter (i.e. at least 3 occurrences: declaration + 2 use sites)
  </done>
</task>

<task type="auto">
  <name>Task 2: Add asterisk + tooltip to pillar UI components and i18n key in all 7 locales</name>
  <files>src/components/country/PillarBreakdown.astro, src/components/country/PillarDetailTable.astro, src/i18n/ui.ts</files>
  <action>
Step A — Add the i18n key in all 7 published locales of `src/i18n/ui.ts`. Insert the new key on the line immediately AFTER each locale's existing `'country.pillar_coverage'` entry (current line numbers: en=431, it=907, es=1381, fr=1855, pt=2329, zh=2799, de=3269) so the new key sits adjacent to the existing coverage-related key for that locale. Use the EXACT strings below (these are the per-locale translations of the Italian source provided in the task brief: "Quando c'è poca copertura di un pilastro, il suo contributo allo score complessivo è ridotto o escluso."):

  - en: `'country.pillar_low_coverage_note': 'When a pillar has low data coverage, its contribution to the overall score is reduced or excluded.',`
  - it: `'country.pillar_low_coverage_note': 'Quando un pilastro ha poca copertura dati, il suo contributo allo score complessivo è ridotto o escluso.',`
  - es: `'country.pillar_low_coverage_note': 'Cuando un pilar tiene poca cobertura de datos, su contribución a la puntuación general se reduce o se excluye.',`
  - fr: `'country.pillar_low_coverage_note': 'Lorsqu\'un pilier a une faible couverture de données, sa contribution au score global est réduite ou exclue.',`
  - pt: `'country.pillar_low_coverage_note': 'Quando um pilar tem pouca cobertura de dados, sua contribuição para a pontuação geral é reduzida ou excluída.',`
  - zh: `'country.pillar_low_coverage_note': '当某个支柱的数据覆盖率较低时,其对总体评分的贡献会被减少或排除.',`
  - de: `'country.pillar_low_coverage_note': 'Wenn eine Säule eine geringe Datenabdeckung hat, wird ihr Beitrag zur Gesamtbewertung reduziert oder ausgeschlossen.',`

Step B — In `src/components/country/PillarBreakdown.astro`:
  - At the top of the frontmatter (after the existing imports on lines 2-5), add: `import { LOW_COVERAGE_FLAG_THRESHOLD } from '../../pipeline/scoring/engine';`
  - Inside the `sorted.map((pillar) => { ... })` block (around line 33), compute `const lowCoverage = pillar.dataCompleteness < LOW_COVERAGE_FLAG_THRESHOLD;` alongside the existing `displayScore` line.
  - Modify the score-display span on lines 48-50 so that when `lowCoverage` is true, an asterisk follows the "{displayScore}/10" text inside that same span. Use a native HTML `title` attribute on the asterisk (NOT on the outer span — keeps the score itself screen-reader-clean). Pattern: render the existing "{displayScore}/10" then conditionally render `<span class="text-amber-600 dark:text-amber-400" title={t('country.pillar_low_coverage_note')} aria-label={t('country.pillar_low_coverage_note')}>*</span>`. Do not introduce any new dependency; this matches the native-`title` tooltip pattern already used in `SourcesList.astro` line 75.

Step C — In `src/components/country/PillarDetailTable.astro`:
  - Same import as Step B: `import { LOW_COVERAGE_FLAG_THRESHOLD } from '../../pipeline/scoring/engine';`
  - Inside the `sorted.map((pillar) => { ... })` block (around line 31), compute `const lowCoverage = pillar.dataCompleteness < LOW_COVERAGE_FLAG_THRESHOLD;`.
  - Modify the score+risk+coverage line (lines 41-43) so that the "{displayScore}/10" text is followed by a conditional asterisk span with the same `title` + `aria-label` pattern as Step B when `lowCoverage` is true. Place it BEFORE the " · {riskLevel}" separator so the asterisk attaches to the score, not the risk label.

Do NOT change the `pillarKeys` mapping, the sort order, the bar SVG, or the table indicators rendering. Do NOT introduce a Tooltip component, Radix, shadcn, or any new dependency — the codebase uses the native HTML `title` attribute for hover tooltips and that pattern must be preserved.

Do NOT add the new i18n key to the `zh` or `de` locale blocks if those blocks structurally lack other `'country.pillar_*'` keys — but they do have them (lines 2799, 3269 confirmed), so add the key in all 7 locales.
  </action>
  <verify>
    <automated>grep -c "pillar_low_coverage_note" src/i18n/ui.ts | xargs -I {} test {} -eq 7 && npm run build 2>&1 | tail -20</automated>
  </verify>
  <done>
- `grep -c "pillar_low_coverage_note" src/i18n/ui.ts` returns exactly `7` (one occurrence per locale)
- `grep -c "LOW_COVERAGE_FLAG_THRESHOLD" src/components/country/PillarBreakdown.astro` returns at least 2 (import + use)
- `grep -c "LOW_COVERAGE_FLAG_THRESHOLD" src/components/country/PillarDetailTable.astro` returns at least 2 (import + use)
- `npm run build` completes without TypeScript or Astro errors
- Manually loading any country page (e.g. `/en/country/somalia`) in dev shows an asterisk on pillars with <50% coverage; hovering it shows the localized tooltip text
  </done>
</task>

</tasks>

<verification>
End-to-end verification (run after both tasks):

1. `npm run test:pipeline` — scoring engine tests pass, including the three new low-coverage cases.
2. `npm run build` — Astro build succeeds for all 7 locale trees (en, it, es, fr, pt, zh, de).
3. `grep -n "MIN_PILLAR_COVERAGE\\|LOW_COVERAGE_FLAG_THRESHOLD" src/pipeline/scoring/engine.ts` — both constants declared and exported.
4. `grep -c "pillar_low_coverage_note" src/i18n/ui.ts` — returns `7`.
5. Spot check: open the built site, find a country whose pillar coverage is below 50% for at least one pillar (Somalia, Yemen, North Korea, or any sparsely-covered small state), confirm asterisk renders and hover tooltip appears in the localized text.
</verification>

<success_criteria>
- Pillars with `dataCompleteness < 0.30` are EXCLUDED from the composite geometric mean and from the critical-floor calculation; remaining pillar weights renormalize naturally via the weighted-log-mean denominator.
- Pillars with `dataCompleteness < 0.50` render a visible asterisk next to their "{score}/10" value in BOTH `PillarBreakdown.astro` and `PillarDetailTable.astro`.
- Hovering the asterisk shows a native HTML title tooltip with locale-specific text in all 7 published locales.
- No new runtime dependency added; tooltip uses the existing native `title` pattern.
- The constants `MIN_PILLAR_COVERAGE` and `LOW_COVERAGE_FLAG_THRESHOLD` are exported from `engine.ts` as a single source of truth.
- All existing pipeline tests continue to pass.
</success_criteria>

<output>
After completion, create `.planning/quick/260511-gpu-pillar-coverage-threshold-gating-ui-note/260511-gpu-SUMMARY.md` documenting:
- Files modified
- Final values of the two thresholds (locked: 0.30 and 0.50)
- Sample country (iso3) where the asterisk renders, with which pillars
- Confirmation that the i18n key landed in all 7 locales
- Any deviations from the plan (expected: none)
</output>
