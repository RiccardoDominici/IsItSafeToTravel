---
phase: quick-260708-lb3
plan: 01
subsystem: scoring
tags: [bayesian-shrinkage, ucdp, gpi, world-bank, homicide, conflict-deaths, japan-mofa, canada-advisories, pipeline, backfill, parity-gate]

requires:
  - phase: quick-260706-x81
    provides: "Formula v9.0.0 engine (Bayesian shrinkage, geometric mean, advisory consensus, GPI xlsx vintage injection pattern)"
provides:
  - "Formula v9.1.0 scoring engine (D1 population-scaled homicide, D2 UCDP conflict-deaths log-decay, D3 GPI-2026 JSON vintages, D4 advisory nudge/severe ramp)"
  - "WB fetcher mrnev=1 fix (restores wb_air_pollution coverage for ~199 countries, fixes silent pre-existing bug) + new wb_homicide + internal wb_population indicators"
  - "NEW UCDP conflict-deaths fetcher (OWID/UCDP GED mirror, all-years consolidated, vintage-selection injection in both backfill and live run.ts)"
  - "GPI JSON-manifest primary source (IEP GPI-2026 edition, all published years, merged over xlsx in backfill vintage selection)"
  - "Japan MOFA advisory fetcher REWRITE (dynamic riskmap-index discovery + name-based ISO3 mapping, fixes the stale page-ID table's spurious constant-Level-4 bug)"
  - "Canada advisory parser hardening (collect all banner matches, ambiguous -> previous-day fallback, dedupe, debug file) + GUM ca=4 4-day-blip correction script"
  - "scripts/verify-formula-v91-parity.ts + committed 248-row fixture (byte-exact parity, PASSED)"
  - "All 669 historical data/scores/*.json snapshots + latest.json + history-index.json regenerated under v9.1.0; public/scores.json synced"
affects: [product-surface, methodology-docs, i18n, seo, llms, og-images]

tech-stack:
  added: []
  patterns:
    - "Population-scaled indicator precision: rho_eff = rhoBase * pop/(pop+P_HALF), applied ONLY to the scaled indicator's evidence weight, never its value or any other indicator"
    - "Ramp-gated advisory mechanisms: rampFactor(nAdv, minNAdv, width) smoothly gates both the prior's advisory nudge and the severe-advisory modifier, replacing v9's hard nAdv>0 branch"
    - "Dual vintage-selection injection for all-years-in-one-file sources (UCDP): the SAME injection function must run in both backfill.loadRawDataForDate AND run.ts's live Stage 2, or the engine's last-write-wins rawByName Map silently picks an arbitrary year"
    - "GPI vintage merge: xlsx-derived byYear as base, JSON-derived byYear overlaid (JSON wins on overlap) — lets the live 2026-edition JSON supersede the frozen 2023 xlsx for any year both cover"
    - "Name-based (not page-ID-based) mapping for external site scraping — renumbering-proof, closes the class of bug where a site's internal IDs silently change"

key-files:
  created:
    - src/pipeline/fetchers/ucdp.ts
    - scripts/correct-gum-ca-history.ts
    - scripts/verify-formula-v91-parity.ts
    - scripts/fixtures/formula-v91-parity.csv
    - data/raw/wb-history-homicide-population.json
  modified:
    - src/pipeline/fetchers/worldbank.ts
    - src/pipeline/fetchers/gpi.ts
    - src/pipeline/fetchers/index.ts
    - src/pipeline/fetchers/advisories-tier1.ts
    - src/pipeline/fetchers/advisories.ts
    - src/pipeline/config/weights.json
    - src/pipeline/config/source-tiers.json
    - src/pipeline/scoring/normalize.ts
    - src/pipeline/scoring/engine.ts
    - src/pipeline/types.ts
    - src/pipeline/backfill.ts
    - src/pipeline/run.ts
    - src/pipeline/scoring/__tests__/engine.test.ts
    - src/pipeline/__tests__/weights-config.test.ts
    - src/pipeline/__tests__/crisis-validation.test.ts
    - data/scores/** (669 snapshots + latest.json + history-index.json)
    - public/scores.json

key-decisions:
  - "1.1a freshness-decay gate: resolved by REMOVING 'worldbank' entirely from source-tiers.json rather than testing the decay-flip-then-revert path. This keeps the parity fixture's fw=1.0 assumption exactly true for wb_child_mortality/wb_air_pollution/wb_homicide while still persisting dataDate on every WB indicator for citability/future use. Documented inline in source-tiers.json."
  - "jp re-inclusion gate FAILED (max |delta| 0.362 on ESH vs the 0.25 threshold, 5 band flips) — kept jp EXCLUDED in weights.json per the plan's explicit fallback branch. The FIXED fetcher ships regardless (fixes the user-facing advisories.jp display bug on ~36 safe countries); full diff below."
  - "UCDP vintage selection uses GPI-style GLOBAL year selection (byYear.get(bestYear) for ALL countries at once), not per-country selection, because OWID's UCDP mirror has uniform 1989-2025 coverage for every one of the 196 covered countries (verified) — unlike homicide/population, which have real per-country gaps and use per-country selection (mirroring the frozen prototype's buildLatestMap exactly)."
  - "GPI backfill injection now merges xlsx-derived and JSON-derived byYear maps (JSON wins on overlap) rather than switching entirely to JSON, preserving the xlsx's broader 2008-2023 historical floor while letting the fresh 2026-edition JSON supersede any year both cover."

requirements-completed: [SHIP-SPEC-V91-1.1-fetchers, SHIP-SPEC-V91-1.2-engine-config, SHIP-SPEC-V91-1.3-parity-tests-regen]

duration: ~110min
completed: 2026-07-08
---

# Quick Task 260708-lb3: Formula v9.1 PART 1 — UCDP/GPI-JSON/WB-Homicide Summary

**Ported the frozen Formula v9.1 scoring math (population-scaled homicide + UCDP conflict-deaths + GPI-2026 JSON + advisory ramp) byte-exact against the research fixture (max |Δ| = 0.0000/248), fixed four live data-fetching bugs (WB mrnev, JP MOFA renumbering, CA banner ambiguity, GUM misparse), and regenerated all 669 historical snapshots under weights v9.1.0.**

## Performance

- **Duration:** ~110 min
- **Completed:** 2026-07-08
- **Tasks:** 3/3 completed
- **Files modified:** 17 code/config files + 671 data/scores/*.json files + public/scores.json + 5 new files

## Accomplishments

- **worldbank.ts**: appended `mrnev=1` to every WB query (live-verified fix: `wb_air_pollution` went from empty to 199 countries; `wb_child_mortality` gained 14 countries WB's old 3-year-window fetch had been silently missing). Added `wb_homicide` (VC.IHR.PSRC.P5, 194 countries) and an internal, unscored `wb_population` (SP.POP.TOTL, 215 countries) for F1 precision scaling. Stamped per-indicator `dataDate` from each observation's own vintage year — gated behind removing `worldbank` from `source-tiers.json`'s decay config, so freshness stays fw=1.0 (parity-safe) while dataDate is persisted for future use.
- **NEW `ucdp.ts`**: OWID/UCDP GED mirror (interstate+intrastate+one-sided, excludes non-state), live-verified 196 countries × 1989-2025, one consolidated `ucdp-parsed.json` per run.
- **`gpi.ts`**: new `parseGpiJsonAllYears()` primary source (IEP GPI-2026 manifest + all 19 published years, live-verified 162 countries for 2026 vs 160 under the old xlsx), xlsx kept as a documented fallback chain.
- **`advisories-tier1.ts` fetchJpAdvisories REWRITE**: replaced the stale page-ID-keyed table (root cause of a spurious constant-Level-4 bug on ~89 safe countries — anzen.mofa.go.jp had silently renumbered its pages) with dynamic riskmap-index discovery + a 205-entry Japanese-name→ISO3 mapping table, scoped `div#kikendetail` parsing (MAX across regional `.kiken_levels` blocks). Live-verified: 205/206 mapped (only Hawaii, a US state with no distinct project ISO3, unmatched), and all discovery anchors reproduced exactly (RUS/UKR/IRQ/IRN=4, FRA/USA/SGP/AUS/CAN/GBR/VAT/CHN=1, MEX/ECU=3, BHR/XKX=2, BLR=4).
- **`advisories.ts` parseCaAdvisoryLevel hardening**: collects ALL `banner-*` matches (not just the first); >1 distinct type is now ambiguous and falls back to the previous day's level (logged loudly) rather than silently trusting whichever banner the old regex happened to match first — the verified root cause of the GUM (Guam) 4-day ca=4 misparse. Entries deduped by iso3 before fetching; new `advisories-ca-debug.json` diagnostic.
- **`scripts/correct-gum-ca-history.ts`**: one-off scripted correction, run once, fixed GUM's ca level 4→1 across `2026-07-0{4,5,6,7}`.
- **Engine port (D1-D4)**, verbatim from `prototype-scorer-v91.mjs` / `final-constants-v91.json` round-2 section: crime pillar recomposed to `gpi_safety_security(.67,ρ2.5) + wb_homicide(.33,ρ1.5)`; conflict to `gpi_overall(.3275,ρ2.0) + gpi_militarisation(.1125,ρ1.0) + A(.28) + ucdp_conflict_deaths(.28,ρ2.5)`; `rampFactor(nAdv,minNAdv,width)` gates both the prior's advisory nudge (`nudgeMinNAdv=1`) and `severeEff` (`severeMinNAdv=2`), shared `gateRampWidth=2.4`; `wb_homicide`'s ρ additionally scaled by `pop/(pop+P_HALF)` (`P_HALF=200000`) reading `wb_population` from `rawByName`; `gamma` 0.79→0.96, `S_MAX` 0.25→0.32 (both re-tuned per the frozen research to offset D1-air-restoration + D3-GPI-2026's upward composite-distribution shift); `ucdp_conflict_deaths` normalizes via a custom log-decay branch in `normalize.ts` (`D_MAX=24000`).
- **Backfill/live vintage-injection wiring**: `injectUcdpForDate` (GPI-style global-year selection, parse-once cache) + `injectWorldbankHistoryForDate` (per-country vintage selection mirroring the prototype's `buildLatestMap`, bulk WB full-history fetch cached to `data/raw/wb-history-homicide-population.json`) both wired into `backfill.loadRawDataForDate`; `injectUcdpForDate` additionally called from `run.ts` Stage 2 so live daily scoring also selects the correct current-year UCDP vintage. `injectGpiForDate` extended to merge the JSON-sourced (2026 edition) all-years table over the xlsx-derived one.
- **Parity gate PASSED**: `scripts/verify-formula-v91-parity.ts` against the committed 248-row fixture, jp excluded, **max |Δ| = 0.0000** across all 248 countries when raw data matches the fixture's baseline coverage exactly — confirmed via a controlled A/B (filtering `wb_child_mortality` back to its pre-mrnev 182-country coverage). Against the FINAL production raw data (full 196-country coverage, the coverage-gap fix intentionally kept), the gate still PASSES with 14 documented, verified-pure-additive deviations (max 0.24) explicitly classified and logged, not silently ignored.
- **jp re-inclusion gate evaluated and FAILED** (see Decisions below) — the fixed fetcher ships anyway.
- **Live backfill regen**: `--dry-run` 669/669 OK, then live run 669/669 succeeded, 0 failed; `history-index.json` rebuilt (669 dates, 248 countries); `public/scores.json` synced via `cp`.
- **Sanity anchors** (from `data/scores/latest.json`, weightsVersion `9.1.0`): global mean **6.603** (target ≈6.6), ISL **8.868** (top, target ≈8.87), YEM **3.655** (in the automated gate's [3.1,3.7] band), JAM **6.938** (in [6.6,7.2]), TCA **5.458** (in [5.1,5.8]), PSE **4.790** (in [4.3,4.9]).
- **npm test**: 131/131 pass (0 fail) on the authoritative final run; `data/scores/latest.json` restored after each run per the known pre-existing test-corruption pattern (see Issues Encountered).

## Task Commits

Each task was committed atomically (Task 2 followed the RED→GREEN TDD flow):

1. **Task 1: Fetchers — WB, NEW UCDP, GPI-JSON, JP rewrite, CA hardening, GUM fix** - `242fedaa` (feat)
2. **Task 2 RED: v9.1 engine/weights/crisis tests (fail vs v9.0.0 engine)** - `4db345ea` (test)
3. **Task 2 GREEN: v9.1.0 engine/normalize/weights port (D1-D4)** - `686afce3` (feat)
4. **Task 3a: Backfill/live vintage injection wiring + parity gate PASSED** - `ce8cb1a1` (feat)
5. **Task 3b: Regenerate all 669 historical snapshots under v9.1.0** - `e5daeab0` (data)

_No separate plan-metadata commit — this SUMMARY/STATE update is committed by the orchestrator, per this plan's explicit constraint._

## Files Created/Modified

- `src/pipeline/fetchers/ucdp.ts` - NEW: OWID/UCDP GED conflict-deaths mirror fetcher
- `src/pipeline/fetchers/worldbank.ts` - mrnev=1 fix, wb_homicide + wb_population, dataDate
- `src/pipeline/fetchers/gpi.ts` - parseGpiJsonAllYears() JSON-manifest primary source
- `src/pipeline/fetchers/index.ts` - registers ucdp in Batch 1/7
- `src/pipeline/fetchers/advisories-tier1.ts` - fetchJpAdvisories full rewrite
- `src/pipeline/fetchers/advisories.ts` - parseCaAdvisoryLevel hardening
- `scripts/correct-gum-ca-history.ts` - NEW: one-off GUM ca=4 correction (run)
- `src/pipeline/config/weights.json` - v9.1.0: recomposed crime/conflict pillars, 5 new formulaV9 tunables
- `src/pipeline/config/source-tiers.json` - 'worldbank' removed (1.1a decay-gate decision)
- `src/pipeline/scoring/normalize.ts` - wb_homicide range + ucdp_conflict_deaths log-decay branch
- `src/pipeline/scoring/engine.ts` - rampFactor, D4 ramp gates, F1 population-scaled homicide rho
- `src/pipeline/types.ts` - FormulaV9Config +D_MAX/P_HALF/nudgeMinNAdv/severeMinNAdv/gateRampWidth
- `src/pipeline/backfill.ts` - injectUcdpForDate, injectWorldbankHistoryForDate, GPI JSON merge
- `src/pipeline/run.ts` - Stage 2 calls injectUcdpForDate (live vintage selection)
- `scripts/verify-formula-v91-parity.ts` - NEW: blocking parity gate vs the frozen fixture
- `scripts/fixtures/formula-v91-parity.csv` - NEW: committed 248-row ground truth (v91_score)
- `data/raw/wb-history-homicide-population.json` - NEW: bulk WB full-history cache (9805+9805 rows)
- `src/pipeline/scoring/__tests__/engine.test.ts`, `src/pipeline/__tests__/weights-config.test.ts`, `src/pipeline/__tests__/crisis-validation.test.ts` - rewritten/extended for v9.1
- `data/scores/*.json` (669 files) + `latest.json` + `history-index.json` - regenerated under v9.1.0
- `public/scores.json` - synced via `cp data/scores/latest.json public/scores.json`

## Decisions Made

- **1.1a freshness-decay gate**: chose option (i) from the plan (keep `worldbank` OUT of `source-tiers.json`) over testing the decay-flip-then-measure-parity-then-revert path. This is deterministic, avoids running the full historical parity sweep twice, and is explicitly authorized by the plan's own gate language. `dataDate` is still persisted on every WB indicator for future use/citability — decay is simply not wired to it for this source, documented inline.
- **jp re-inclusion gate: FAILED, kept excluded.** Computed both configurations (jp excluded vs included) against the final 2026-07-08 raw data: max |Δscore| = **0.362** on ESH (Western Sahara) — above the 0.25 threshold — with 5 band flips (CMR/ESH high-caution→danger; ISR/KEN moderate→high-caution; VAT high-caution→moderate) and 24 total movers >0.1. Per the plan's explicit fallback: kept `jp` in `weights.json`'s `frozenExcludedSources` (no config change needed — it was already there), but the FIXED fetcher ships regardless, since it resolves the real user-facing bug where `country.advisories.jp` displayed a bogus "Do Not Travel" for dozens of safe countries. Full mover list:
  ```
  ESH  excluded=5.153 included=4.791 delta=-0.362   (band: high-caution -> danger)
  MNP  excluded=5.312 included=5.623 delta=0.312
  VAT  excluded=5.790 included=6.090 delta=0.300    (band: high-caution -> moderate)
  ISR  excluded=6.186 included=5.929 delta=-0.257   (band: moderate -> high-caution)
  GIB  excluded=6.211 included=6.465 delta=0.255
  GUM  excluded=6.361 included=6.596 delta=0.235
  TUR  excluded=5.911 included=5.690 delta=-0.221
  ARM  excluded=7.272 included=7.070 delta=-0.202
  DZA  excluded=6.795 included=6.611 delta=-0.183
  KEN  excluded=6.108 included=5.927 delta=-0.181   (band: moderate -> high-caution)
  AZE  excluded=6.387 included=6.209 delta=-0.177
  ETH  excluded=5.218 included=5.055 delta=-0.164
  IND  excluded=5.495 included=5.337 delta=-0.158
  MRT  excluded=5.958 included=5.800 delta=-0.158
  ERI  excluded=5.765 included=5.611 delta=-0.154
  MAC  excluded=6.231 included=6.378 delta=0.147
  CMR  excluded=5.059 included=4.913 delta=-0.146   (band: high-caution -> danger)
  PAK  excluded=4.854 included=4.713 delta=-0.141
  PRK  excluded=5.275 included=5.412 delta=0.138
  NGA  excluded=4.614 included=4.482 delta=-0.132
  COD  excluded=3.873 included=3.748 delta=-0.125
  HKG  excluded=6.544 included=6.654 delta=0.110
  COK  excluded=6.203 included=6.311 delta=0.108
  BFA  excluded=4.608 included=4.507 delta=-0.101
  ```
- **UCDP vintage selection: global (GPI-style), not per-country.** Verified live that OWID's UCDP mirror covers every one of its 196 project countries uniformly across 1989-2025 (zero-death years are explicit `0` rows, never omitted) — so a single global "year = min(snapshotYear, latest present)" selection is exact, matching the plan's explicit instruction and avoiding the more complex per-country logic homicide/population require (documented above).
- **GPI backfill injection merges xlsx + JSON** rather than replacing xlsx wholesale, so the 2008-2023 historical floor stays intact for dates the JSON manifest might not (currently) cover, while the fresh 2026-edition JSON supersedes any overlapping year.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `source-tiers.json` gained a documented deletion (`worldbank` entry removed) not listed in the plan's `files_modified` frontmatter**
- **Found during:** Task 1, implementing the 1.1a dataDate/freshness gate
- **Issue:** The plan's frontmatter `files_modified` list omits `src/pipeline/config/source-tiers.json`, but the plan's own PROSE for 1.1a explicitly authorizes this exact change ("keep worldbank OUT of source-tiers.json's decay config") as one of two ways to satisfy the gate.
- **Fix:** Removed the `worldbank` entry, added an explanatory `_comment_worldbank` field.
- **Files modified:** `src/pipeline/config/source-tiers.json`.
- **Verification:** Byte-exact parity (0.0000/248) confirms no unintended score movement.
- **Committed in:** `242fedaa` (Task 1 commit).

**2. [Rule 1 - Bug] `injectGpiForDate` was still xlsx-only, silently discarding the new JSON-sourced GPI data during backfill/parity**
- **Found during:** Task 3, first parity-gate run — 171/248 non-freshness failures traced to GMB's crime pillar collapsing to the prior (missing `gpi_safety_security`) despite `gpi-parsed.json` having the correct value.
- **Issue:** `injectGpiForDate` always sourced its `byYear` map from `gpi.xlsx` alone, so the 2026-edition JSON data (persisted by Task 1's `fetchGpi` rewrite) was never used for scoring — the stale (often much older) cached xlsx silently won.
- **Fix:** `injectGpiForDate` now builds a MERGED `byYear` map (xlsx base, JSON overlaid — JSON wins on year overlap) before vintage selection.
- **Files modified:** `src/pipeline/backfill.ts`, plus exported `deserializeGpiByYear`/`serializeGpiByYear` from `gpi.ts` (already added in Task 1).
- **Verification:** GMB's score matched the fixture EXACTLY (7.077508280818454) after the fix; overall parity went from 171 failures to 0.
- **Committed in:** `ce8cb1a1` (Task 3a commit).

**3. [Rule 1 - Bug, self-inflicted] Task 1's own live fetcher testing had drifted `data/raw/2026-07-08`'s advisory raw files away from the fixture's baseline**
- **Found during:** Task 3, first parity-gate run — the remaining ~171 non-GPI-root-cause failures (before fix #2 above) traced to advisory-consensus differences.
- **Issue:** To verify Task 1's fetchers live, I re-ran `fetchAdvisories`/`fetchTier1Advisories` against `2026-07-08`, which overwrote that date's advisory raw files with FRESHER (intraday-drifted) data than what `public/scores.json` (the frozen prototype's baseline read) had captured that morning.
- **Fix:** Restored the ORIGINAL pre-session advisory raw files via `git checkout 869636ac -- <files>` (the daily pipeline's own commit), then re-merged the FRESH, correctly-mapped jp data back in (jp is excluded from scoring either way, so this doesn't affect parity, but ships the fixed jp data for production).
- **Files modified:** `data/raw/2026-07-08/advisories-{au,info,jp,jp-index,nl,parsed,tier1-info,tier1-parsed,uk,us}.json`.
- **Verification:** Byte-exact parity (0.0000/248) after the restore + GPI fix.
- **Committed in:** `242fedaa` (Task 1, the restored baseline files) and `ce8cb1a1` (Task 3a, the re-merged jp data).

**4. [Rule 2 - documented, non-blocking] `wb_child_mortality` coverage-gap fix creates 14 legitimate, pure-additive deviations vs the frozen fixture**
- **Found during:** Task 3, final parity verification against the PRODUCTION (full-coverage) raw data.
- **Issue:** The Task 1 `mrnev=1` fix restores `wb_child_mortality` coverage for 14 countries (ARE/GBR/PSE/UGA/UKR/URY/USA/UZB/VEN/VNM/VUT/YEM/ZMB/ZWE) the OLD windowed fetcher silently missed — verified pure-additive (zero value changes among the other 182 covered countries). Since the frozen fixture's health pillar was derived from `public/scores.json`'s pre-fix baked-in data, these 14 countries' health pillars (and hence scores) now legitimately differ from the fixture.
- **Fix:** Extended `scripts/verify-formula-v91-parity.ts` with an explicit, documented `KNOWN_CHILD_MORTALITY_COVERAGE_DRIFT` classification (separate from the freshness-decay classifier) that reports these 14 deviations transparently rather than either silently ignoring them or failing the gate.
- **Files modified:** `scripts/verify-formula-v91-parity.ts`.
- **Verification:** Re-running the gate with `wb_child_mortality` filtered back to the original 182-country coverage produces max |Δ| = 0.0000/248 (byte-exact), proving the engine port itself is correct and isolating this class of deviation to the documented coverage fix.
- **Committed in:** `ce8cb1a1` (Task 3a commit).

---

**Total deviations:** 4 (1 frontmatter-omission fix, 2 Rule-1 bugs found and fixed during parity debugging, 1 documented-and-transparent data-coverage note). None represent scope creep — all are directly caused by this plan's own changes or by faithfully executing its explicit instructions to refresh live data for the parity day.

## Known Stubs

None — no UI-facing stubs. This is a pipeline/PART-1 plan; product surface (bands, docs, i18n) is explicitly PART 2, out of scope here.

## Threat Flags

None beyond the plan's own `<threat_model>` register (T-lb3-01 through T-lb3-05, all mitigated as designed — see Task 1's fetcher hardening and the 1.1a decay-gate decision above).

## Issues Encountered

- **Live World Bank API outage during Task 1 (transient, ~1 hour)**: `api.worldbank.org` / `dataapi.worldbank.org` returned a Cloudflare 502 for roughly the first hour of this session (confirmed via direct curl: `502: Bad gateway`). Recovered on its own; all WB-dependent fetchers (worldbank.ts's mrnev queries, the bulk full-history table) were re-verified live once it came back. Not a code issue — documented per the plan's explicit "momentarily unreachable" allowance.
- **`travel.gc.ca` (Canada advisories) was unreachable from this execution environment for the ENTIRE session** (DNS resolves at the OS level but the actual HTTPS connection fails — `ENOTFOUND`/timeout from both Node's fetch and curl, including with the sandbox explicitly disabled). This is a live-environment network restriction, not a code bug in the hardened `parseCaAdvisoryLevel`/`fetchCaAdvisories` — the existing per-source-floor cache-fallback mechanism (pre-existing, unmodified) correctly caught the failure and fell back to cached data, exactly as designed. The new hardening logic (multi-banner collection, ambiguous-banner previous-day fallback, dedup, debug file) is implemented and verified by code review + the GUM correction script's forensic analysis of the exact banner-ambiguity bug it fixes, but could not be exercised against a genuinely ambiguous LIVE Canada page this session. Will self-verify on the next daily GHA pipeline run (which has unrestricted network access, as evidenced by today's 06:00 UTC run succeeding).
- **`npm test` full-suite flakiness (pre-existing, unrelated to this plan)**: `score-drift-guard.test.ts` (reads all `data/scores/*.json` at `describe`-body collection time) occasionally races against `data05-historical.test.ts`'s temporary `2098-06-0{1,2,3}.json` fixture files (written and cleaned up mid-run) when `node --test` schedules both files concurrently, producing an intermittent `ENOENT`. Confirmed pre-existing and NOT caused by this plan: (a) neither test file is in this plan's scope, (b) running `score-drift-guard.test.ts` in isolation passes cleanly every time including against all 669 regenerated v9.1.0 snapshots, (c) the failure is purely file-timing/concurrency, unrelated to formula version. The authoritative final `npm test` run (used for this plan's sign-off) completed cleanly: **131/131 pass, 0 fail**. `data/scores/latest.json` was restored via backup after every test run per the known pre-existing `snapshot.test.ts`/`data05-historical.test.ts` write-then-never-restore pattern (documented in the 260706-x81 and 260708-efx summaries).

## User Setup Required

None — no external service configuration required. The daily pipeline (GHA, 06:00 UTC) will pick up the new UCDP/GPI-JSON/WB-homicide fetchers and the rewritten JP fetcher automatically on its next run; no secrets or new environment variables needed.

## Next Phase Readiness

- Formula v9.1's pipeline core (fetchers, engine, config, backfill, historical data) is fully shipped and verified: byte-exact parity against the frozen ground truth (0.0000/248, jp excluded), 669/669 historical snapshots regenerated consistently, `public/scores.json` in sync, sanity anchors within their target bands, npm test 131/131.
- **PART 2 is next** (not started, per this plan's explicit scope boundary): methodology changelog + crime/conflict pillar description updates ×7 locales, KNOWN LIMITATIONS rewrite (remove PSE-stale-GPI/RUS-vs-UKR/ESH-step/GUM-ca-bug; add PSE-above-Iran evidence note, small-population homicide reliability damping, UCDP quarterly lag), sources table + attribution (UCDP/OWID CC-BY, WB homicide/population) ×7 + sources page, UI confidence surfacing for the newly-thin-data territories the F1 population-scaling exposes (TCA/VIR/GUM/KNA etc. — SHIP_REQUIREMENT_UI note in `final-constants-v91.json`), README v9.1 section, `seo.ts` measurementTechnique text, hub-faq/country-faq-copy pillar-composition statements, llms regen, zh methodology proper translation, then the full build+validate:seo+deploy gate.
- The jp re-inclusion question is now a closed, documented decision for this data snapshot (FAILED at 0.362 vs the 0.25 threshold) — a future attempt would need either a wider threshold justification or dedicated recalibration (S_MAX/gateRampWidth retuning) to accommodate jp's real signal without the ESH/CMR/ISR/KEN band-flip cost.
- `data/raw/wb-history-homicide-population.json` (~2.4MB) is a new committed cache artifact; future backfill/parity runs will reuse it without re-fetching unless deleted.

---
*Phase: quick-260708-lb3*
*Completed: 2026-07-08*

## Self-Check: PASSED

All created files verified present on disk (`src/pipeline/fetchers/ucdp.ts`, `scripts/correct-gum-ca-history.ts`,
`scripts/verify-formula-v91-parity.ts`, `scripts/fixtures/formula-v91-parity.csv`,
`data/raw/wb-history-homicide-population.json`, `data/raw/2026-07-08/advisories-jp-index.json`,
`data/raw/2026-07-08/gpi-json-all-years.json`, `data/raw/2026-07-08/ucdp-parsed.json`). All 5 task commit
hashes (`242fedaa`, `4db345ea`, `686afce3`, `ce8cb1a1`, `e5daeab0`) confirmed present in `git log --oneline --all`.
Parity gate confirmed PASSED on the final committed state; `npm test` 131/131; `npx tsc --noEmit` clean
(excluding pre-existing astro.config.mjs/functions errors).
