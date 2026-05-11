# Quick Task 260511-k2m — Research

**Task:** Replace retired World Bank WGI indicators with V-Dem Institute data + historical backfill
**Researched:** 2026-05-11
**Confidence:** HIGH (verified V-Dem v16 release, OWID CSV endpoints tested live, pipeline code paths walked)

## Summary

The four retired WGI indicators (`PV.EST`, `RL.EST`, `GE.EST`, `CC.EST`) can be replaced cleanly with three V-Dem v16 indicators delivered via **Our World in Data's CSV grapher endpoints** (no auth, stable URLs, ~1 MB per indicator, CC-BY-SA). V-Dem v16 was released **2026-03-17**, covers data through **2025**, and the OWID mirror provides clean per-indicator CSV with Entity/Code/Year/Value columns and ISO3 codes already normalized. Political Stability (`PV.EST`) has no clean V-Dem 1:1 equivalent and is recommended to be **dropped** rather than poorly proxied — the Conflict pillar already has `gpi_overall`, `gpi_safety_security`, `gpi_militarisation`, and 37 advisory sources, so removing it leaves the pillar well-covered.

**Primary recommendation:** Add a new `vdem` fetcher that pulls three OWID CSVs into a single `data/raw/{date}/vdem-parsed.json`, with indicator names `vdem_rule_of_law`, `vdem_corruption_control` (inverted), `vdem_gov_effectiveness`. Update `weights.json` and `normalize.ts` to swap the four `wb_*` governance indicator names. Then re-run the pipeline against each existing `data/raw/{date}/` directory to regenerate scored snapshots. The existing `worldbank.ts` fetcher continues to handle `wb_child_mortality` and `wb_air_pollution` — those WB endpoints are still alive.

## 1. V-Dem Data Source

### Primary: Our World in Data per-indicator CSVs (RECOMMENDED)

OWID publishes V-Dem-derived indicators as standalone CSV endpoints with stable URLs, ISO3 codes, no auth, no form submission, and clean column structure. The CSVs are processed from "V-Dem's Democracy report v16" (refreshed automatically). This is dramatically simpler than parsing the V-Dem Full+Others ZIP.

| Property | Value |
|----------|-------|
| Format | CSV (Entity, Code, Year, IndicatorValue, World region) |
| Auth | None — public HTTPS GET |
| File size per indicator | ~1.1 MB (1789–2025, ~35k rows) |
| Latest year covered | **2025** (V-Dem v16, refreshed 2026-03-17) |
| Countries per year (2025) | ~183 countries (193 rows incl. regional aggregates) |
| ISO3 column | `Code` — pure ISO 3166-1 alpha-3; aggregates use `OWID_AFR` etc. (filter out) |
| License | **CC-BY-SA 4.0** — commercial use OK, attribution required, derivative weighted scores must remain CC-BY-SA |
| Update cadence | V-Dem releases annually in March; OWID refreshes within days |

**Verified URLs** (tested live 2026-05-11, HTTP 200, content-type text/csv):

```
https://ourworldindata.org/grapher/rule-of-law-index.csv?v=1&csvType=full&useColumnShortNames=false
https://ourworldindata.org/grapher/political-corruption-index.csv?v=1&csvType=full&useColumnShortNames=false
https://ourworldindata.org/grapher/rigorous-and-impartial-public-administration-score.csv?v=1&csvType=full&useColumnShortNames=false
```

Sample row (2025): `Australia,AUS,2025,3.324` (pub admin) — confirms ISO3 in column 2, year in column 3, value in column 4.

### Fallback: Direct V-Dem ZIP download

Only needed if OWID is unreachable for several days. Page: https://www.v-dem.net/data/the-v-dem-dataset/country-year-v-dem-fullothers-v16/ — requires email/consent form submission. ZIP contains CSV (~50 MB unzipped) with 531 indicators × 27,555 country-year rows. **Avoid unless OWID fails.**

### License verdict: GREEN for our use case

CC-BY-SA 4.0 explicitly permits commercial use. Our obligations:
1. **Attribution** — add V-Dem v16 to the SOURCE_CATALOG in `engine.ts` and the methodology page citing: *Coppedge et al., "V-Dem Country-Year Dataset v16", V-Dem Institute, DOI 10.23696/vdemds26.*
2. **ShareAlike** — our derivative work (the safety score) is already publicly viewable on a website; we don't redistribute the raw CSV. No additional ShareAlike obligation triggered for displaying derived scores. If we ever publish a redistributable dataset, the V-Dem-derived columns must remain CC-BY-SA. Note that the rest of the pipeline output is currently un-licensed — the V-Dem additions don't change that for the score display, but the planner should flag this for a future licensing review.

## 2. Indicator Mapping Table

| Current (WGI, retired) | V-Dem replacement | OWID URL slug | Transformation | Year logic | Notes |
|------------------------|-------------------|---------------|----------------|-----------|-------|
| `wb_rule_of_law` (RL.EST, -2.5..+2.5, ↑=better) | **`v2x_rule`** (Rule of Law Index, 0..1, ↑=better) | `rule-of-law-index` | None (already 0-1 = same direction as normalized output) | Pick max year ≤ `snapshotYear`; latest available is 2025 | Direction matches WGI exactly. Drop in as `vdem_rule_of_law` with `min:0, max:1, inverse:false`. |
| `wb_corruption_control` (CC.EST, -2.5..+2.5, ↑=better) | **`v2x_corr`** (Political Corruption Index, 0..1, ↑=**more corrupt**) | `political-corruption-index` | **INVERT**: store `1 - v2x_corr` so higher = less corruption (matches old direction) | Same as above | OWID page explicitly confirms "0-1, higher = greater corruption". Either invert in the fetcher (clean) or set `inverse: true` in `normalize.ts` (matches `inform_*` pattern). Recommend `inverse: true` in normalize for consistency with existing pattern. |
| `wb_gov_effectiveness` (GE.EST, -2.5..+2.5, ↑=better) | **`v2clrspct`** (Rigorous and Impartial Public Administration, observed range ~-3.2..+3.3 point-estimate, ↑=better) | `rigorous-and-impartial-public-administration-score` | None (already ↑=better; just renormalize the range) | Same as above | This is the cleanest WGI-GE proxy — measures "public officials abide by the law, treat like cases alike; not nepotism/cronyism/discrimination". Use `min: -3.5, max: 3.5, inverse: false`. The 0-4 ordinal interpretation reported by OWID's description is **not** the value in the CSV — the CSV exposes V-Dem's point estimate (Bayesian z-score-like measure) which spans ~-3 to +3. Verified empirically: AFG -3.195, AUS 3.324. |
| `wb_political_stability` (PV.EST, -2.5..+2.5, ↑=better) | **DROP** — no clean V-Dem 1:1 equivalent. Don't proxy. | — | Remove from weights.json `conflict.indicators` and from `normalize.ts` INDICATOR_RANGES | — | Alternatives considered and rejected: `v2x_polyarchy` (measures democracy, not stability), `v2x_libdem` (too broad), `v2regint` (regime interruption indicator — too sparse). Removing leaves Conflict pillar with GPI (3 sub-indicators, 0.47 weight) + 37 advisories — coverage remains strong. Redistribute the freed 0.17 weight proportionally: gpi_overall→0.225, gpi_safety_security→0.215, gpi_militarisation→0.19, advisories scaled up by ~1.41× each. The planner makes the exact redistribution call. |

### Indicator naming convention

Use `vdem_` prefix (mirrors `wb_`, `gpi_`, `inform_`):
- `vdem_rule_of_law` (replaces `wb_rule_of_law`)
- `vdem_corruption_control` (replaces `wb_corruption_control`) — inverted via `inverse: true` in normalize.ts
- `vdem_gov_effectiveness` (replaces `wb_gov_effectiveness`)

### Year selection logic

V-Dem data is country-year, latest year is 2025. For the fetcher, mirror `worldbank.ts:67-71` pattern — group by country, keep the most recent year ≤ snapshotYear, fall back to nearest earlier year if exact year missing. For 2026 snapshots we'll uniformly use 2025 V-Dem data (their latest). For 2024 snapshots we'd use V-Dem's 2023 data, etc. — pre-existing OWID rows cover 1789-2025 so historical pickup is automatic.

## 3. Pipeline Integration Points

Files to create / modify (line numbers verified against current HEAD):

| Action | File | Specific change |
|--------|------|-----------------|
| **CREATE** | `src/pipeline/fetchers/vdem.ts` | New fetcher modeled on `worldbank.ts:87-190`. Fetches 3 OWID CSV URLs in parallel, parses CSV (use lightweight regex split — no papaparse needed for 4-column comma data with no embedded commas; OWID values are pure numeric and entity names are unquoted). Filters: skip rows where `Code` is empty or starts with `OWID_` (regional aggregates). Pick latest year ≤ targetYear per country per indicator. Writes `data/raw/{date}/vdem-parsed.json` with same `RawSourceData` envelope. |
| **MODIFY** | `src/pipeline/fetchers/index.ts:2,15,84` | Import `fetchVdem`, re-export, add `{ name: 'vdem', fn: () => fetchVdem(date) }` to batch 1 alongside worldbank. |
| **MODIFY** | `src/pipeline/fetchers/worldbank.ts:15-22` | Remove the 4 WGI entries (`PV.EST`, `RL.EST`, `GE.EST`, `CC.EST`). Keep `SH.DYN.MORT` and `EN.ATM.PM25.MC.M3` — those WB endpoints are still live and feed `wb_child_mortality` + `wb_air_pollution`. |
| **MODIFY** | `src/pipeline/scoring/normalize.ts:30-33` | Remove `wb_political_stability`, `wb_rule_of_law`, `wb_gov_effectiveness`, `wb_corruption_control` entries. Add new entries: `vdem_rule_of_law: { min: 0, max: 1, inverse: false }`, `vdem_corruption_control: { min: 0, max: 1, inverse: true }` (V-Dem v2x_corr is "more = worse", so inverse=true flips to "more = safer"), `vdem_gov_effectiveness: { min: -3.5, max: 3.5, inverse: false }`. |
| **MODIFY** | `src/pipeline/config/weights.json` | (1) `conflict.indicators`: remove `wb_political_stability`; reweight `gpi_*` and advisories upward to absorb the 0.17 weight. (2) `crime.indicators`: replace `wb_rule_of_law` → `vdem_rule_of_law`. (3) `governance.indicators`: replace `wb_gov_effectiveness` → `vdem_gov_effectiveness`, `wb_corruption_control` → `vdem_corruption_control`. Bump weights.json `version` to `"8.1.0"`. |
| **MODIFY** | `src/pipeline/config/source-tiers.json:5` | Add `"vdem": { "tier": "baseline", "maxAgeDays": 730, "decayHalfLifeDays": 365 }` (same parameters as worldbank — annual indices, baseline tier). |
| **MODIFY** | `src/pipeline/scoring/engine.ts:229-236` | Update `INDICATOR_SOURCE_MAP`: remove the 4 wb_* governance entries, add three `vdem_*` → `'vdem'` entries. |
| **MODIFY** | `src/pipeline/scoring/engine.ts:382-407` | Add `vdem` to `SOURCE_CATALOG` with `url: 'https://www.v-dem.net/data/the-v-dem-dataset/'` and CC-BY-SA attribution in description. |
| **MODIFY** | UI methodology page(s) | Add V-Dem to the sources list in all 7 locales. Mention v16 + CC-BY-SA + DOI citation. (Find via: `grep -r "World Bank" src/pages src/components | grep -i source`.) Out of scope for this task if planner deems too broad — defer to a separate doc task. |

### What the fetcher must NOT do

- Don't depend on `papaparse` for parsing — OWID CSV is simple enough for manual parsing, and `papaparse` is already a devDependency (only used for xlsx-related work). Keep the fetcher dependency-free, matching `worldbank.ts`.
- Don't write the raw CSV to disk — only the parsed JSON. Three CSVs at ~1 MB each = ~3.3 MB of avoidable git pollution if accidentally committed.
- Don't fetch the V-Dem ZIP. Use OWID.

## 4. Historical Backfill Plan

There is **already a script** for this: `scripts/backfill-historical.ts`. It walks every snapshot in `data/scores/`, fetches WB data once per year, copies raw data within a year, and reruns the pipeline. We only need to invoke a **scoped variant** that re-scores from already-cached raw data without re-fetching.

### Snapshot count

`data/scores/*.json` matching `YYYY-MM-DD.json`: **612 snapshots**, ranging 2012-03-19 → 2026-05-11. All exist; this is a re-score operation, not a re-fetch.

### Backfill strategy

1. **Run the new pipeline ONCE for today (2026-05-11)** to fetch V-Dem CSVs into `data/raw/2026-05-11/vdem-parsed.json`. This validates the new fetcher end-to-end.
2. **For each historical snapshot date `D`:**
   - Copy `data/raw/2026-05-11/vdem-parsed.json` → `data/raw/D/vdem-parsed.json` (the V-Dem fetcher's parsed output is country-year, so the same file works for any snapshot; the year-selection logic inside the fetcher won't re-run during re-score because run.ts loads the parsed JSON directly).
   - **Important nuance:** The fetcher picked latest year ≤ 2026 = 2025 V-Dem data. For older snapshot dates we'd ideally want year-appropriate data. **Decision recommendation:** since V-Dem data changes very slowly and our existing WB backfill (`backfill-historical.ts:38`) already does the same "fetch once per year" approach, the simplest path is to write **one parsed JSON per year**: 2012-2025. The fetcher should accept a target year, and the backfill loops year-by-year. Mirror the year-by-year structure of the existing script.
   - Re-run `runPipeline(D)` which will skip the fetch (parsed JSON exists) and re-score using new weights.
3. **Backfill script:** Create `scripts/backfill-vdem-rescore.ts` that:
   - Groups all 612 snapshot dates by year.
   - For each year Y, fetches V-Dem data targeting year `min(Y, 2025)` once.
   - Writes vdem-parsed.json to every snapshot date in year Y.
   - Calls `runPipeline(D)` for each date — re-uses all other cached `*-parsed.json` files.
4. **Final step:** Run `writeHistoryIndex()` from `src/pipeline/scoring/history.js` to regenerate `data/scores/history-index.json` (the existing backfill script's final command at line 74 documents this).

### Commands the executor will run

```bash
# Step 1: validate fetcher
npx tsx src/pipeline/run.ts 2026-05-11

# Step 2: backfill all 612 snapshots
npx tsx scripts/backfill-vdem-rescore.ts

# Step 3: regenerate history index
npx tsx -e "import { writeHistoryIndex } from './src/pipeline/scoring/history.js'; writeHistoryIndex();"

# Step 4: spot-check a few snapshots
node -e "const s = require('./data/scores/2026-05-11.json'); console.log('countries:', s.countries.length); console.log('avg:', (s.countries.reduce((a,c)=>a+c.score,0)/s.countries.length).toFixed(2));"
```

### Expected runtime

- Fetch step: ~5 seconds per year × 14 years = ~70s
- Re-score step: ~3-5s per snapshot × 612 = **30-50 minutes**
- Don't run in parallel — pipeline writes are not concurrency-safe (writeJson in fs.ts is sync but the snapshot writer mutates shared state).

## 5. Pitfalls + Edge Cases

### A. ISO3 mismatch with our 248-country list

OWID's `Code` column is clean ISO3 for 99% of cases. Known exceptions to handle in the fetcher:
- **Kosovo:** OWID uses `OWID_KOS` (their internal code). Our `countries.ts` does not currently have a Kosovo entry, so this auto-skips via the `getCountryByIso3` filter in worldbank.ts:62. Verify whether our country list includes Kosovo and decide.
- **Palestine:** OWID uses `PSE` (matches ISO3). 
- **Taiwan:** OWID uses `TWN` (matches ISO3).
- **Regional aggregates:** Rows with `Code` starting with `OWID_` (e.g., `OWID_AFR`, `OWID_ASI`) and rows with empty `Code` (the population-weighted aggregates) must be filtered. Confirmed pattern from sample output: `Africa (population-weighted),,2025,-0.6097732` — empty Code field.

**Filter rule in fetcher:** Skip row if `Code` is empty, starts with `OWID_`, or fails `getCountryByIso3()` lookup. This matches existing worldbank.ts logic.

### B. Inversion math for v2x_corr — use `inverse: true`, not `1 - x`

V-Dem v2x_corr scale: 0 = no corruption, 1 = total corruption (verified on OWID page). To match our "higher normalized = safer" convention, set `inverse: true` in `INDICATOR_RANGES`. The existing `normalizeInverse` function in `normalize.ts:16-18` already does `1 - normalize(value, min, max)`, which for 0-1 input correctly maps 0 corruption → 1.0 safety, 1.0 corruption → 0.0 safety. **Don't compute `1 - v2x_corr` in the fetcher** — it would double-invert.

### C. Year coverage of V-Dem v16

- Latest year with data: **2025** (per OWID metadata, confirmed in row sampling).
- V-Dem v16 was published 2026-03-17.
- Annual release cadence — next refresh expected March 2027.
- For snapshots from late 2025 onward, V-Dem 2025 data is appropriate. For older snapshots, use the year-matched V-Dem data (e.g., 2020 snapshot → V-Dem 2020 row).

### D. .gitignore — only if writing raw CSVs

The current fetcher pattern only writes `*-parsed.json` (consolidated, ~200 KB). If the new fetcher follows this pattern (recommended), no .gitignore changes are needed. **If** the implementer chooses to cache raw CSV downloads (which would be ~3 MB per snapshot date × 612 = 1.8 GB of repo bloat), add `data/raw/**/*.csv` to .gitignore — but that path is discouraged: don't cache the raw CSVs at all.

### E. Country coverage < 248

V-Dem covers ~183 countries (UN-recognized + observers). Microstates and territories we currently list (Vatican VAT, Tokelau TKL, Norfolk Island NFK, etc.) won't be in V-Dem. **This is the correct outcome** — those countries already failed WGI coverage too, and the new pillar-coverage gating (the 260511-gpu quick task completed today) correctly excludes pillars below 30% coverage for sparse-data territories. No action needed; the existing gate handles it.

### F. CSV parsing safety

OWID CSVs contain country names with commas in rare cases (e.g., "Korea, Republic of"). However, inspection of the rule-of-law-index CSV shows OWID uses no quoted strings and no embedded commas in `Entity` for any current country (e.g., uses "South Korea" not "Korea, Republic of"). A naive `split(',')` works for these three files. **Still defensive:** parse as `const parts = line.split(',')` and use `parts[1]` (Code), `parts[2]` (Year), `parts[3]` (value) — this is robust because the first column may have a comma but we never use it. Validate with `Number.isFinite()` on the value.

### G. Source attribution in UI

The methodology page lists all data sources. After this task, "World Bank Worldwide Governance Indicators" should be removed from the sources list and replaced with "V-Dem Institute (v16, 2026) — Rule of Law, Political Corruption, and Public Administration indices, CC-BY-SA 4.0". This is a separate documentation task — flag for the planner whether to include in this quick task or split out.

### H. Source count claim on the homepage

PROJECT.md and SEO content mention "7 sources" (and previously "9 sources" — Phase 28 reduced). If we add V-Dem the count becomes 8, but if we treat V-Dem as a replacement for WGI within the existing "World Bank" source slot, the count stays 7. **Recommend:** add V-Dem as a separate listed source (count → 8) since it has independent attribution and methodology. Update relevant copy if so.

## 6. Open Questions for the Planner

1. **Political Stability handling.** The research recommends DROPPING `wb_political_stability` from the Conflict pillar and redistributing its 0.17 weight proportionally to GPI sub-indicators and advisories. The alternative — finding a V-Dem proxy — is judged a worse outcome (no V-Dem indicator cleanly maps to WGI-PV; all candidates are too narrow or too broad). Confirm with the user whether dropping is acceptable, or whether they prefer e.g. `v2x_polyarchy` as an imperfect proxy.

2. **UI / methodology page updates — in scope or separate task?** Replacing "World Bank WGI" with "V-Dem" on the methodology page touches 7 locale files and possibly the homepage source count. The planner should decide: (a) include in this quick task, or (b) defer to a follow-up doc task so this task stays focused on pipeline correctness.

3. **Source count messaging** — bump from 7 → 8, or keep at 7 by treating V-Dem as replacing the WGI portion of the World Bank slot? See pitfall H. Recommend confirming with user.

4. **Backfill scope** — re-score all 612 snapshots (2012-03-19 → 2026-05-11), or only the snapshots from when WGI broke (latest WB fetch in raw/2026-04-08 shows `year: 2023` WGI data, which means WGI was actually still working on that date — so the breakage is recent, post 2026-04-08). The user task says "33 days 2026-04-09 → 2026-05-11" but pillar history charts will show a discontinuity if older snapshots use old indicator names. Recommend backfilling **all** snapshots for visual continuity, but ask the planner to confirm.

5. **Should we keep the old `wb_*` indicator names in the cached JSON for older dates and add `vdem_*` going forward (dual-track)**, or rename entirely? Recommend full rename + full backfill — keeps the pipeline simpler. The planner should confirm this isn't disruptive to any external consumers.

## Sources

### Primary (HIGH confidence — verified live)
- V-Dem v16 dataset page: https://www.v-dem.net/data/the-v-dem-dataset/country-year-v-dem-fullothers-v16/
- V-Dem GitHub releases: https://github.com/vdeminstitute/vdemdata/releases
- OWID Rule of Law Index (CSV verified 200 OK, 2025 data confirmed): https://ourworldindata.org/grapher/rule-of-law-index
- OWID Political Corruption Index (CSV verified 200 OK, range and direction confirmed): https://ourworldindata.org/grapher/political-corruption-index
- OWID Rigorous and Impartial Public Administration Score (CSV verified 200 OK, value range -3.2..+3.3 confirmed empirically): https://ourworldindata.org/grapher/rigorous-and-impartial-public-administration-score
- V-Dem Codebook (variable definitions): https://www.v-dem.net/documents/55/codebook.pdf
- Neopatrimonial Rule Index reference: https://data360.worldbank.org/en/indicator/VDEM_CORE_V2X_NEOPAT

### Secondary (MEDIUM confidence)
- V-Dem licensing (CC-BY-SA): cross-confirmed via GitHub release notes + search; no contradiction found.

### Existing repo (HIGH — direct read)
- `src/pipeline/fetchers/worldbank.ts` (pattern template)
- `src/pipeline/scoring/normalize.ts` (INDICATOR_RANGES extension point)
- `src/pipeline/scoring/engine.ts` (INDICATOR_SOURCE_MAP + SOURCE_CATALOG)
- `src/pipeline/config/weights.json` (pillar indicator lists)
- `src/pipeline/config/source-tiers.json` (tier registration)
- `scripts/backfill-historical.ts` (backfill template)
- `src/pipeline/run.ts` (entry point — runPipeline accepts date arg)

## Metadata

**Confidence breakdown:**
- V-Dem availability + license: HIGH (verified CC-BY-SA via multiple sources, v16 release confirmed)
- OWID endpoints + format: HIGH (CSV bytes inspected directly, ranges confirmed empirically)
- Indicator mapping rationale: HIGH for rule_of_law / corruption_control (direct 1:1), HIGH for gov_effectiveness (v2clrspct measures civil service quality / impartiality — best WGI-GE match in V-Dem), MEDIUM-HIGH for dropping political_stability (judgement call but well-supported)
- Pipeline integration line numbers: HIGH (read live from current HEAD)
- Backfill strategy: HIGH (existing backfill script analyzed; new script is a small variant)
- License obligations for our use: MEDIUM (CC-BY-SA is permissive but we should add explicit attribution; not a blocker)

**Research date:** 2026-05-11
**Valid until:** 2027-03 (next V-Dem release will introduce v17; OWID URLs are stable)
