# Formula v10 — specification (2026-10-14)

Source of truth for the agents implementing v10. Origin: an external critique (German travel
blogger, 2026-10-14) plus a code audit. Evaluation evidence lives in the session scratchpad
(`eval/REPORT.md`); the numbers quoted here come from it.

## 0. Why

Verified defects in v9.1:

- INFORM is hard-wired to the **Mid 2025** file (`fetchers/inform.ts:8-9`) although the 2026
  edition (v0.7.3, same 42 columns) is published. Its `year` is `new Date().getFullYear()`, so
  pages show "2026" on 2025 data. The same 2.2 MB file is downloaded every day (739 identical
  copies in `data/raw/*/inform.xlsx`).
- Wrong INFORM columns: `Human` (= conflict hazard) feeds `inform_health`; `River Flood` is
  labelled "climate risk" and double-counts `Natural`; `inform_governance` reads
  `Institutional` instead of `Governance` (first match wins, column 31 before 33).
- Indicators irrelevant to travellers: under-5 mortality, PM2.5, GPI militarisation
  (military spending, nuclear weapons, arms exports).
- Absurd vintages: V-Dem VAT = 1870, PSE = 1948; 59 World Bank homicide values are ≤ 2019.
- Zero-data territories get a prior-driven score (Åland 5.9 "high caution" with 0 sources).

## 1. Owner decisions (binding)

1. **Latest edition only.** If B is a newer edition of A, A weighs 0. No time-decay blending.
2. **Max age 5 years.** A non-advisory indicator whose data year < (run year − 5) is missing.
   Attribution (corrected 2026-10-14): this is the orchestrator's rule, accepted by the owner; the
   owner's own rule is decision 1, "a superseded edition weighs 0". Implementation: applied
   before pillars and before source counting; `wb_population` is exempt (never scored, it only
   damps homicide precision, and dropping it would raise that precision).
3. **Traveller relevance.** Every scored indicator must be defensible for a traveller's safety
   and must carry its real data year.
4. **Grey.** No official score without enough data (rule §4). Community part grey until enough
   votes (rule §5). Both show "partial data" copy with a call to vote.
5. **Community counts in the score**, bounded to **±1.0** points, home-origin votes capped at
   **50%** of a country's vote weight.
6. **No WHO road-death data** (WHO terms forbid modification without written permission and use
   next to commercial promotion; IHME forbids commercial use). Revisit only with WHO permission.
7. **No ambiguous GPI sub-indicators.** The GPI site manifest and the GPI report weights disagree
   on `crim`/`inst`/`poli`; only domain fields (`overall`, `conflict`, `safety`,
   `militarisation`) and unambiguous keys may be used. v10 uses domain fields only.

## 2. Indicators and pillars

Pillar weights unchanged. All other v9.1 mechanics unchanged (per-pillar precision-weighted
shrinkage K=1, weighted geometric mean, acute soft-min λ=0.25 on conflict+crime, count-damped
severe-advisory modifier, γ=0.96), with the per-pillar scale continuity of §3 applied to the
shrunk pillar values before aggregation.

| Pillar (key) | Weight | Indicators (sub-weight, precision) | Removed vs v9.1 |
|---|---|---|---|
| conflict | 0.30 | **Unchanged from v9.1:** `gpi_overall` (0.3275, 2.0); `gpi_militarisation` (0.1125, 1.0); advisory consensus `A` (0.28); `ucdp_conflict_deaths` (0.28, 2.5). `gpi_conflict` (GPI Ongoing Domestic & International Conflict domain, JSON field `conflict`, 1–5) is fetched and stored but **unscored** | — |
| crime | 0.25 | `gpi_safety_security` (0.67, 2.5); `wb_homicide` (0.33, pop-damped as v9.1) | — |
| health | 0.20 | `inform_health_access` = INFORM "Access to health care", 0–10 inverted (0.55, 1.0); `inform_epidemic` (0.45, 1.0) | `wb_child_mortality`, `inform_health` (= Human) |
| governance | 0.15 | `vdem_rule_of_law`, `vdem_gov_effectiveness`, `vdem_corruption_control`, `inform_governance` read from the **Governance** column (0.25 each, 1.0) | Institutional column |
| environment (UI label: "Natural hazards") | 0.10 | `inform_natural` (0.25, 1.0); `reliefweb_active_disasters` (0.10, 0); `gdacs_disaster_alerts` (0.10, 0) | `wb_air_pollution`, `inform_climate` (= River Flood) |

The pillar key stays `environment` to limit blast radius; only its visible label changes.

Conflict (revised 2026-10-14 after the face-validity review): the first v10 cut replaced
`gpi_overall` + `gpi_militarisation` with `gpi_conflict` (0.44, 2.0). That was the
orchestrator's judgment, not part of the external critique. The GPI overall score includes
militarisation, and dropping both moved North Korea and Pakistan out of the danger band and
Israel up to "moderate", so the conflict pillar stays exactly as in v9.1.

## 3. Scale continuity (per pillar)

Pillar weights only have meaning relative to pillar scales: swapping the indicators inside a
pillar changes its mean and spread and so silently changes its effective weight. Each pillar
whose indicator set changed (health, governance, environment) is mapped back onto its v9.1
scale; the map applies to the final pillar value after shrinkage, before aggregation:

`p′ = clamp(α_p + β_p · p, 0.001, 1)`, with β_p = SD_v91,p / SD_v10,p and α_p = mean_v91,p −
β_p · mean_v10,p, computed ONCE on raw date 2026-10-14 (frozen fixture
`scripts/fixtures/v10/raw-2026-10-14/`) over the 192 countries scored by both, against the
PUBLISHED v9.1 pillar values; frozen in `weights.json` `formulaV9.pillarCalibration`, reproduced
by `scripts/calibrate-v10.ts`, never refitted. Aggregation is then exactly v9.1's (geometric
mean, acute soft-min, severe modifier, γ). There is no global calibration of the score.

| Pillar | v9.1 mean / SD | v10 mean / SD | α | β |
|---|---|---|---|---|
| health | 0.6652 / 0.1421 | 0.5510 / 0.1555 | 0.161743 | 0.913643 |
| governance | 0.5173 / 0.1921 | 0.5125 / 0.1979 | 0.019734 | 0.970809 |
| environment | 0.6283 / 0.1092 | 0.5659 / 0.0833 | −0.113726 | 1.311236 |

Not mapped: conflict (identical to v9.1) and crime (same indicators; its mean shift 0.679 →
0.646 is the 5-year max-age rule turning 75 stale homicide rates into missing values, and
mapping it away would undo that rule).

Superseded (first v10 cut): a global affine map on the score, `S_data = clamp(α + β · S_raw,
1, 10)` (α 0.367609, β 0.989118 against the published v9.1). It lifted the whole low end by about
+0.3 and carried North Korea and Pakistan over 5.0 although their pillar values had not moved.

Evidence on 2026-10-14 (reference: published v9.1; bands on the one-decimal display value):
- 28 band changes (first cut with the global map: 29; per-pillar maps with crime mapped: 31).
- Danger band (< 5) 25 → 24: North Korea 4.89 and Nigeria 4.92 stay; Pakistan 5.12 leaves
  (only 2 of 24 governments put it at level 4: 11 at level 3, 11 at level 2); nobody enters.
- Community (2026-10-14 votes, evaluation definitions): weighted MAE to the implied community
  score 0.473 (v9.1 0.466); direction agreement 59.0% (60.5%); MAE on the 8 countries with ≥ 5
  votes 0.408 (0.353).
- Grey set (56) and danger guard (no hits) unchanged.

## 4. Official grey rule (`scoreStatus`)

- `insufficient_data` when the country has < 4 distinct data sources after the max-age filter
  (same semantics as today's `hasSufficientData`; one source = one issuing body/dataset key as
  counted today). Today this is the same 56 places that are already excluded from rankings.
- **Danger guard (invariant):** never `insufficient_data` if ≥ 3 governments are at level 4, or
  severeShare ≥ 0.5, or UCDP deaths > 0 in the latest year. Such a country is scored. Unit-test
  it; the evaluation found no such case today.
- `insufficient_data` ⇒ `score = null`, `scoreDisplay = null`; pillars may be kept internally
  for transparency but are never rendered as numbers.

## 5. Community component

Votes stay in D1 `votes` (`isitsafetotravel-sentiment`).

Per vote, a **perceived score**:
- relative vote (scored country): `S_shown + 0.5 · delta` (delta −2…+2). `S_shown` = the
  published score at vote time, stored server-side in `official_score` from now on (it is NULL
  in all 322 existing rows: the widget never sent it). Legacy rows: the published score of that
  country on the vote's UTC date from the score history.
- absolute vote (grey country, new): `rating` 1…5 → 2, 4, 6, 8, 10.

Per target country, over the existing 180-day window with recency weight `0.5^(age/30d)`:
- **Origin cap:** voter origin = `country_iso` (null = one "unknown" group). If ≥ 2 origins and
  one origin's weight share > 50%, scale it down to exactly 50% (iterate until stable).
- **Activation:** ≥ 30 votes in the window AND ≥ 3 distinct known origins → `active`, else
  `insufficient` (grey, with progress "N/30 votes, M/3 countries of origin").
- `P` = weighted mean perceived score; `n_eff = (Σw)² / Σw²`; `Z = n_eff / (n_eff + 30)`.
- `adjustment = clamp(Z · (P − S_data), −1.0, +1.0)`; final `score = clamp(S_data +
  adjustment, 1, 10)`.
- Grey official country with active community: show the community rating `P` separately and
  labelled as such; never as the official score; `scoreStatus` stays `insufficient_data`.

Data contract `data/sentiment/latest.json` per country: `{ iso3, votes, origins, topOriginShare,
nEff, perceived, status: 'active'|'insufficient' }`. The engine reads it; the UI shows
`S_data`, `adjustment`, `score`, votes and origins.

Anti-abuse: existing dedupe + daily caps remain. Votes now move scores, so Turnstile should be
enabled (owner action in the Cloudflare dashboard; code is already env-gated).

## 6. Data pipeline

- **INFORM:** every run checks the official Results-and-data page for the newest INFORM Risk
  `.xlsx` (highest `vNNN`); downloads only if the file name differs from the stored edition;
  stores it once (e.g. `data/raw/inform/<file>.xlsx` + `edition.json` with file, version, sheet
  name, edition year, first-seen date). Edition year parsed from the sheet name (`INFORM Risk
  (Mid )?YYYY`). Exact header mapping (§2); a missing expected header fails the source loudly.
  Per-date folders keep only `inform-parsed.json`. Remove the per-date `inform.xlsx` copies from
  git.
- **Max-age filter** applied in the engine (logged per indicator/country).
- **Staleness monitor:** after fetching, compare each slow source's newest data year with its
  expected cycle (INFORM edition ≥ run year − 1; GPI ≥ run year − 1; V-Dem ≥ run year − 2; World
  Bank per indicator ≥ run year − 3; UCDP ≥ run year − 2). Violations → pipeline summary warning
  + ntfy push. A newly detected INFORM edition → info push.
- **Release:** bump `DATA_REVISION` so the switch day emits no movement news; first production
  run with `skip_digest=true`. Past history snapshots stay v9.1; the trend chart marks the v10
  date. New parity fixture + `scripts/verify-formula-v10-parity.ts` on raw date 2026-10-14.
- **Run order (merge with `feat/community-v10`):** the sentiment stage must run BEFORE scoring
  in `run.ts`, so the engine reads the same day's community snapshot. Not done on
  `feat/formula-v10`: its v9.1 aggregator still needs the day's official scores, and the
  community branch rewrites that stage (its aggregator anchors votes to the stored or historical
  published score, so it can run first). Without the reorder the community adjustment lags a
  day, and the first adjustments land the day after the switch, outside the `DATA_REVISION`
  suppression, as score-jump news.

## 7. Site

- Grey everywhere a score appears: hero ("Partial data" + why + which sources exist + vote CTA),
  map, rankings (already excluded), comparisons, OG image, JSON-LD (no rating), `scores.json` /
  `scores.csv` / API (score null + `scoreStatus`), embeddable badge, news, llms.txt.
- Community block: active → data score, adjustment, final, votes, origins; insufficient → grey
  "not enough votes yet (N/30, M/3 countries) — vote"; grey official country → absolute rating
  widget.
- Indicator table: raw value with unit or source scale, real data year, "latest available
  edition" note (World Bank publishes with a 1–2 year lag); corrected labels.
- Top summary (`AnswerFirstParagraph`): name the concrete driver (indicator, value, year, source)
  and the advisory count by level; mention a strong area only if ≥ 7.0.
- Methodology ×7: v10, indicator list with editions and licences, max-age, grey and community
  rules, dated changelog entry. Replace "updated daily" with "score recalculated daily;
  government advisories and disaster alerts change daily, international indices once or twice a
  year".
