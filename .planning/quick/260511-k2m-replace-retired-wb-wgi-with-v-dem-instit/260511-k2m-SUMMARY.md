---
phase: quick-260511-k2m
plan: 01
subsystem: pipeline+ui+data
tags: [vdem, governance, migration, owid, backfill, i18n]
dependency_graph:
  requires:
    - "src/pipeline/fetchers/worldbank.ts (pattern template)"
    - "scripts/backfill-historical.ts (year-grouped backfill template)"
    - "OWID grapher CSV endpoints (rule-of-law-index, political-corruption-index, rigorous-and-impartial-public-administration-score)"
  provides:
    - "src/pipeline/fetchers/vdem.ts (fetchVdem + parseVdemCsv)"
    - "scripts/backfill-vdem-rescore.ts (idempotent rescore with weightsVersion=8.1.0 resume gate)"
    - "weights.json v8.1.0 (conflict pillar redistributed, vdem_* indicator names)"
    - "611 rescored snapshots referencing year-appropriate V-Dem data"
  affects:
    - "src/pipeline/scoring/engine.ts INDICATOR_SOURCE_MAP + SOURCE_CATALOG"
    - "src/pipeline/scoring/normalize.ts INDICATOR_RANGES"
    - "src/pipeline/config/source-tiers.json (added vdem baseline entry)"
    - "src/pipeline/fetchers/index.ts (registered vdem in Batch 1)"
    - "src/pipeline/fetchers/worldbank.ts (removed PV.EST/RL.EST/GE.EST/CC.EST)"
    - "data/scores/*.json (611 snapshots rescored under v8.1.0)"
    - "data/scores/history-index.json (regenerated)"
    - "public/scores.json (synced from data/scores/latest.json)"
    - "src/i18n/ui.ts (V-Dem strings + 7-source enumeration in 7 locales)"
    - "src/pages/{en,it,pt,es,fr,zh,de}/{sources|fonti|fontes|fuentes|quellen}/index.astro"
tech_stack:
  added: [V-Dem v16 indicators via OWID CSV mirrors]
  patterns:
    - "RawSourceData envelope (preserved across fetcher modules)"
    - "Partial-failure cache fallback via findLatestCached"
    - "Year-grouped backfill (one fetch per year, intra-year copy)"
    - "weightsVersion resume gate for idempotent retry"
key_files:
  created:
    - "src/pipeline/fetchers/vdem.ts"
    - "src/pipeline/scoring/__tests__/vdem.test.ts"
    - "scripts/backfill-vdem-rescore.ts"
    - "data/raw/{2012..2026}-*/vdem-parsed.json (611 files)"
  modified:
    - "src/pipeline/fetchers/index.ts"
    - "src/pipeline/fetchers/worldbank.ts"
    - "src/pipeline/scoring/normalize.ts"
    - "src/pipeline/scoring/engine.ts"
    - "src/pipeline/scoring/__tests__/engine.test.ts"
    - "src/pipeline/config/weights.json"
    - "src/pipeline/config/source-tiers.json"
    - "src/i18n/ui.ts"
    - "src/pages/en/sources/index.astro"
    - "src/pages/it/fonti/index.astro"
    - "src/pages/pt/fontes/index.astro"
    - "src/pages/es/fuentes/index.astro"
    - "src/pages/fr/sources/index.astro"
    - "src/pages/de/quellen/index.astro"
    - "src/pages/zh/sources/index.astro"
    - ".gitignore"
    - "data/scores/*.json (611 files)"
    - "data/scores/history-index.json"
    - "data/scores/latest.json"
    - "public/scores.json"
    - "public/llms-full.txt"
decisions:
  - "Drop wb_political_stability rather than proxy it with a poor V-Dem fit; redistribute its 0.17 conflict-pillar weight to GPI (+0.12) and 37 advisories (+0.05, scaled 1.1389x)"
  - "Use V-Dem v16 via OWID CSV mirrors (auth-free, stable URLs, CC-BY-SA) instead of the V-Dem ZIP download"
  - "v2x_corr (V-Dem Political Corruption) inverted via INDICATOR_RANGES.inverse=true rather than 1-x in the fetcher (single-inversion, mirrors inform_* pattern)"
  - "Backfill bypasses runPipeline() and calls computeAllScores+writeSnapshot directly — preserves year-appropriate cached parsed JSON for every non-vdem source and avoids 30-55min of redundant refetches"
  - "Resume gate keyed on weightsVersion=8.1.0 (already in snapshot envelope) — makes the backfill safely retryable"
  - "Source count locked at exactly 7 (WB + V-Dem + INFORM + GPI + ReliefWeb + GDACS + advisories) enumerated by name across all locales — supersedes pre-revision draft's 7→8 bump"
metrics:
  duration_seconds: 1080
  duration_human: "~18 min wall-clock (target was 45-90 min; actual much shorter because backfill bypassed redundant refetches)"
  completed: "2026-05-11"
  snapshots_rescored: 611
  snapshots_skipped_on_rerun: 611
  initial_backfill_seconds: 23.7
  rerun_backfill_seconds: 4.8
  build_seconds: 404
  build_pages: 1892
  seo_checks: "2186/2186 passed"
  unit_tests: "33+19 = 52 tests, all green"
---

# Quick Task 260511-k2m: V-Dem Migration + Historical Backfill Summary

Replaced four retired World Bank Worldwide Governance Indicators (`PV.EST`, `RL.EST`, `GE.EST`, `CC.EST`) with three V-Dem v16 indicators served via Our World in Data CSV mirrors. Dropped political-stability entirely (no clean V-Dem 1:1), redistributed its weight to GPI + advisories. Renamed `wb_rule_of_law` / `wb_gov_effectiveness` / `wb_corruption_control` to `vdem_*` across pipeline code, weights, tests, all 611 historical scored snapshots, and methodology / sources UI in en / it / pt / es / fr / de / zh.

## Commits (4 task commits, parent: `6df757a`)

| Task | Commit | Description |
| ---- | ------ | ----------- |
| 1 | `950910c` | V-Dem fetcher + normalize.ts vdem_* ranges + source-tiers.json baseline entry + .gitignore CSV rule + 19-test vdem.test.ts |
| 2 | `7b4bc17` | weights.json v8.1.0 (conflict pillar redistributed, sum = 1.0) + engine.ts vdem source map + SOURCE_CATALOG vdem entry + 9 new engine.test.ts assertions |
| 3 | `82bdd88` | scripts/backfill-vdem-rescore.ts (idempotent with weightsVersion resume gate) + 611 rescored snapshots + history-index.json + public/scores.json sync |
| 4 | `b074a14` | UI: i18n strings + 7-source enumeration across 7 locales + V-Dem rows in 7 source pages + CC-BY-SA / Coppedge / DOI citation visible in en/sources + ui.ts |

## Final conflict-pillar indicatorWeights (sums to exactly 1.0)

| Indicator                        | Old (8.0.0) | New (8.1.0) | Δ        |
| -------------------------------- | ----------- | ----------- | -------- |
| `wb_political_stability`         | 0.17        | **REMOVED** | -0.17    |
| `gpi_overall`                    | 0.17        | 0.22        | +0.05    |
| `gpi_safety_security`            | 0.16        | 0.20        | +0.04    |
| `gpi_militarisation`             | 0.14        | 0.17        | +0.03    |
| `advisory_level_us`              | 0.026       | 0.0293      | +0.0033  |
| `advisory_level_{uk,ca,au}` ×3   | 0.025       | 0.0285      | +0.0035 ea |
| `advisory_level_{de,nl,jp,sk}` ×4 | 0.018      | 0.0205      | +0.0025 ea |
| `advisory_level_*` (tier 2a) ×8  | 0.010       | 0.0114      | +0.0014 ea |
| `advisory_level_*` (tier 2b) ×8  | 0.007       | 0.0080      | +0.0010 ea |
| `advisory_level_*` (tier 3a) ×6  | 0.005       | 0.0057      | +0.0007 ea |
| `advisory_level_*` (tier 3b) ×7  | 0.003       | 0.0034      | +0.0004 ea |

GPI total: 0.47 → 0.59 (+0.12). Advisory total: 0.36 → 0.41 (+0.05). Sum check: 0.59 + 0.41 = 1.00.

`advisory_level_us` final weight of `0.0293` (rather than the naive `0.0296`) absorbs the +0.0003 cumulative rounding residue so the JSON-parsed dictionary sums to exactly 1.0 (verified by `[.pillars[]|select(.name=="conflict").indicatorWeights|values[]]|add | (.*1e9|round)/1e9 == 1.0` returning `true`).

## V-Dem indicator mapping

| Old WGI (retired)        | V-Dem replacement                          | OWID slug                                                | Range / direction                                  |
| ------------------------ | ------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------- |
| `wb_political_stability` | — (dropped, weight redistributed)          | —                                                        | —                                                  |
| `wb_rule_of_law`         | `vdem_rule_of_law`                         | `rule-of-law-index`                                      | 0..1, higher = safer (inverse=false)               |
| `wb_gov_effectiveness`   | `vdem_gov_effectiveness`                   | `rigorous-and-impartial-public-administration-score`     | -3.5..3.5 (V-Dem point estimate), higher = safer    |
| `wb_corruption_control`  | `vdem_corruption_control` (inverted)       | `political-corruption-index`                             | 0..1 (raw = MORE corrupt), normalized via inverse=true |

The V-Dem fetcher emits raw `v2x_corr` values 0..1 (where 1 = maximally corrupt), and `INDICATOR_RANGES.vdem_corruption_control.inverse=true` does a single 1−x flip so that 0 (clean) → 1.0 (safe) and 1.0 (corrupt) → 0.0 (unsafe). Verified by the single-inversion proof in `vdem.test.ts`.

## Backfill metrics

| Phase           | Initial run | Rerun (idempotency proof) |
| --------------- | ----------- | ------------------------- |
| Step A (fetch today) | ~5s    | ~5s (refetched live)      |
| Step B (per-year fetch + intra-year copy) | ~3s | <1s (cached)        |
| Step C (rescore loop) | ~15s | <1s (all 611 skipped via weightsVersion=8.1.0 resume gate) |
| Step D (history index) | <1s | <1s                  |
| **Total**       | **23.7s**  | **4.8s**                 |

Re-run produced zero data changes (only the `generatedAt` timestamp in `history-index.json` updated, which was reverted before commit). Confirms byte-level idempotency outside of metadata.

## Locales touched

Methodology + sources copy harmonized across all 7 published locales:

| Locale | Indicator keys renamed | Pillar source strings updated | About count rewritten |
| ------ | --------------------- | ---------------------------- | --------------------- |
| en     | 3 (`vdem_rule_of_law`, `vdem_gov_effectiveness`, `vdem_corruption_control`) | crime + governance + conflict | "7 trusted public sources: World Bank, V-Dem Institute (v16), INFORM Risk Index, Global Peace Index, ReliefWeb, GDACS, advisories" |
| it     | 3 | crime + governance + conflict | "7 fonti pubbliche affidabili: Banca Mondiale, V-Dem Institute (v16), INFORM, Global Peace Index, ReliefWeb, GDACS, avvisi USA/UK/CA/AU" |
| es     | 3 | crime + governance + conflict | "7 fuentes publicas confiables: Banco Mundial, V-Dem Institute (v16), INFORM, ..." |
| fr     | 3 | crime + governance + conflict | "7 sources publiques fiables: Banque Mondiale, V-Dem Institute (v16), INFORM, ..." |
| pt     | 3 | crime + governance + conflict | "7 fontes publicas confiaveis: Banco Mundial, V-Dem Institute (v16), INFORM, ..." |
| zh     | 3 | crime + governance + conflict | "7 个可信公开来源：世界银行、V-Dem Institute (v16)、INFORM、全球和平指数、ReliefWeb、GDACS、政府旅行建议" |
| de     | 3 | crime + governance + conflict | "7 vertrauenswürdigen öffentlichen Quellen: Weltbank, V-Dem Institute (v16), INFORM, Globaler Friedensindex, ReliefWeb, GDACS, staatliche Reisehinweise" |
| **Total** | **21 vdem_* keys** | **3 × 7 = 21 pillar strings** | **7 about.project_text + 7 about.sources_text rewrites** |

## Single source-count rule applied

Locked at **"7 sources"** enumerated by name everywhere user-visible:

1. `methodology.tiered_text` — baseline parenthetical now reads `(World Bank, V-Dem, INFORM, GPI)` (exactly 4 baseline + 3 signal in the rest of the sentence = 7 total).
2. `about.project_text` — replaced every loose-count phrase (`7+`, `9+`, `mas de 7`, `mais de 7`, `oltre 7`, `plus de 7`, `7+ 个`, `9+ täglich`) with `7` and an explicit enumeration of all 7 source names.
3. `about.sources_text` — `9+` / `7+` → exactly `7`.

Pre-revision the page claimed `7+` / `9+` while the SOURCE_CATALOG contained 6 distinct entries. Post-revision the page enumerates 7 by name matching the 7-entry SOURCE_CATALOG after V-Dem registration. The `8 sources` framing that appeared in early plan drafts was reverted per the single-rule decision.

## CC-BY-SA attribution

V-Dem v16 is distributed under [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), which requires attribution and ShareAlike on derivatives. The plan adds the canonical citation:

> Coppedge et al. — V-Dem Country-Year Dataset v16, V-Dem Institute, DOI [10.23696/vdemds26](https://www.v-dem.net/), CC-BY-SA 4.0

This citation now appears in:

1. **`src/pages/en/sources/index.astro`** — as a visible footer paragraph under the baseline-sources table (with a clickable link to the CC-BY-SA 4.0 license).
2. **`src/pages/{en,it,pt,es,fr,zh,de}/{sources|fonti|fontes|fuentes|quellen}/index.astro`** — as a `citation` field on the V-Dem source row (rendered in small text under the source name).
3. **`src/i18n/ui.ts` methodology.source.vdem / vdem_desc** — full citation in every locale.
4. **`src/pipeline/scoring/engine.ts` SOURCE_CATALOG.vdem.description** — `'V-Dem Institute Country-Year Dataset v16 (CC-BY-SA 4.0) -- Rule of Law, Political Corruption, and Public Administration indices (Coppedge et al., DOI 10.23696/vdemds26)'`.
5. **`src/i18n/ui.ts` methodology.pillar.crime.sources** (all 7 locales) — leading-clause citation: `V-Dem Rule of Law Index (Coppedge et al., V-Dem Institute v16, CC-BY-SA 4.0)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] public/scores.json not auto-synced from data/scores/latest.json**

- **Found during:** Task 3 verification — sanity check on Algeria showed crime pillar dataCompleteness=0 in public/scores.json even though data/scores/2026-05-11.json had it at 1.0.
- **Issue:** `public/scores.json` is normally synced from `data/scores/latest.json` by CI (`.github/workflows/deploy.yml:31`, `data-pipeline.yml:109`). The backfill script writes `data/scores/latest.json` correctly but does not touch `public/scores.json` — so locally the public file lagged the data file.
- **Fix:** `cp data/scores/latest.json public/scores.json` inside Task 3 commit. CI continues to do this automatically, so the change is harmless in production.
- **Files modified:** `public/scores.json`
- **Commit:** `82bdd88`

**2. [Rule 3 — Blocking issue] runPipeline() re-fetches all sources, would take hours for 611 snapshots**

- **Found during:** Task 3 backfill design phase.
- **Issue:** The naive approach of calling `runPipeline(date)` per snapshot (as `scripts/backfill-historical.ts` does) re-runs all 13 fetchers per date — that's ~3-5s × 13 × 611 ≈ 6.5 hours. Worse, it would *overwrite* the year-appropriate cached `*-parsed.json` files in `data/raw/{date}/` with present-day data, breaking the historical year alignment.
- **Fix:** New `scripts/backfill-vdem-rescore.ts` bypasses `runPipeline()` and calls `computeAllScores()` + `writeSnapshot()` directly using the existing cached `*-parsed.json` files. The rescore loop completed in 15s end-to-end (vs ~6.5 hours), and historical snapshots preserve their year-appropriate WB / GPI / INFORM / advisory data.
- **Files modified:** `scripts/backfill-vdem-rescore.ts` (script never called `runPipeline`)
- **Commit:** `82bdd88`

**3. [Rule 1 — Bug] worldbank.ts still attempted to fetch the four retired WGI endpoints**

- **Found during:** Task 1 implementation.
- **Issue:** Original `src/pipeline/fetchers/worldbank.ts` `INDICATORS` array still listed `PV.EST` / `RL.EST` / `GE.EST` / `CC.EST`. With the new vdem.ts handling governance, leaving those WB codes active would: (a) waste 4 API calls per pipeline run hitting endpoints that return stale 2023 data, (b) inject `wb_*` raw indicators into the pipeline that are now silently dropped by `normalizeIndicators()` (no INDICATOR_RANGES entry), (c) confuse the "successful fetch" count in fetch summaries.
- **Fix:** Removed the 4 WGI entries from `INDICATORS`; kept `SH.DYN.MORT` and `EN.ATM.PM25.MC.M3` (still-live WB endpoints feeding `wb_child_mortality` + `wb_air_pollution`).
- **Files modified:** `src/pipeline/fetchers/worldbank.ts`
- **Commit:** `950910c`

### Deferred Items (out of scope)

**`src/pipeline/__tests__/crisis-validation.test.ts` still references retired wb_* WGI names**

- **Status:** Tests still PASS (5/5 green). Synthesized `wb_political_stability` / `wb_rule_of_law` / `wb_gov_effectiveness` / `wb_corruption_control` raw indicators are silently dropped by `normalizeIndicators()` (no INDICATOR_RANGES entry). The pillar scoring degrades to whatever non-WB indicators each fixture provides (gpi_*, inform_*, advisory_*) — the engine logic the test is checking still works, but the test signal is weaker.
- **Why not fixed in this task:** Out of scope per executor SCOPE BOUNDARY rule — fixing requires rebalancing fixture values (not a mechanical rename) to preserve the crisis-vs-baseline discrimination the test is asserting.
- **Tracked at:** `.planning/quick/260511-k2m-replace-retired-wb-wgi-with-v-dem-instit/deferred-items.md`

## Authentication Gates

None — V-Dem v16 via OWID CSV is fully public (no auth, no API key, no form submission).

## Verification Results (Task 5 — all 8 checks)

1. ✅ `npm run test:pipeline` — 33/33 green (includes 9 new engine.test.ts vdem migration assertions).
2. ✅ V-Dem unit tests — 19/19 green (7 parser cases including (g) year-boundary at 2026→2025, INDICATOR_RANGES contract, single-inversion proof).
3. ✅ `npm run build` — 1892 pages in 404s + SEO validation 2186/2186 checks passed.
4. ✅ Idempotency — rerun produced 611 SKIP / 0 rescored / 0 failed in 4.8s, zero diff in `data/scores/*.json` (only metadata timestamp in history-index.json, reverted before commit).
5. ✅ Spot-check countries — DZA, USA, JPN, NOR, BRA, IND all have non-null crime + governance pillars with dataCompleteness ≥ 0.30 in public/scores.json. DZA crime score: 0.25 (matches v2x_rule=0.25 — Algeria is correctly flagged for weak rule of law). DZA governance dataCompleteness: 1.0 (all 3 indicators present).
6. ✅ UI sanity in built dist/ — V-Dem appears in all 7 rendered about pages; CC-BY-SA visible 2× in en/sources; zh/de about pages render "7 个可信公开来源" / "7 vertrauenswürdig" correctly.
7. ✅ Grep gate — zero retired WGI names in production code (src/pipeline/, src/pages, src/components, src/i18n) and zero in scored data (data/scores/*.json, public/scores.json). Only `src/pipeline/__tests__/crisis-validation.test.ts` retains the names — deferred as documented above.
8. ✅ Source-count consistency — zero loose-count phrasings (`7+`, `9+`, `oltre 7`, `mas de 7`, `mais de 7`, `plus de 7`, `8 sources`, etc.) survive in `src/i18n/ui.ts`.

## Threat Flags

None — V-Dem replaces a retired upstream data source with an equivalent CC-BY-SA mirror; no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries are introduced. The fetcher uses the same `RawSourceData` envelope and the same `Promise.allSettled` + cache-fallback resilience pattern as `worldbank.ts`.

## Self-Check: PASSED

- `[ -f src/pipeline/fetchers/vdem.ts ]` → FOUND
- `[ -f src/pipeline/scoring/__tests__/vdem.test.ts ]` → FOUND
- `[ -f scripts/backfill-vdem-rescore.ts ]` → FOUND
- `[ -f data/raw/2026-05-11/vdem-parsed.json ]` → FOUND
- `[ -f data/scores/history-index.json ]` → FOUND (regenerated)
- 611 snapshots in data/scores/ → FOUND
- Commit `950910c` (Task 1) → FOUND in `git log`
- Commit `7b4bc17` (Task 2) → FOUND in `git log`
- Commit `82bdd88` (Task 3) → FOUND in `git log`
- Commit `b074a14` (Task 4) → FOUND in `git log`
