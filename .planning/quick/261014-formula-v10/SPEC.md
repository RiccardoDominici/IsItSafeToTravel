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
severe-advisory modifier, γ=0.96), then the calibration of §3.

| Pillar (key) | Weight | Indicators (sub-weight, precision) | Removed vs v9.1 |
|---|---|---|---|
| conflict | 0.30 | `gpi_conflict` = GPI Ongoing Domestic & International Conflict domain, JSON field `conflict`, 1–5 inverted (0.44, 2.0); advisory consensus `A` (0.28); `ucdp_conflict_deaths` (0.28, 2.5) | `gpi_overall`, `gpi_militarisation` |
| crime | 0.25 | `gpi_safety_security` (0.67, 2.5); `wb_homicide` (0.33, pop-damped as v9.1) | — |
| health | 0.20 | `inform_health_access` = INFORM "Access to health care", 0–10 inverted (0.55, 1.0); `inform_epidemic` (0.45, 1.0) | `wb_child_mortality`, `inform_health` (= Human) |
| governance | 0.15 | `vdem_rule_of_law`, `vdem_gov_effectiveness`, `vdem_corruption_control`, `inform_governance` read from the **Governance** column (0.25 each, 1.0) | Institutional column |
| environment (UI label: "Natural hazards") | 0.10 | `inform_natural` (0.25, 1.0); `reliefweb_active_disasters` (0.10, 0); `gdacs_disaster_alerts` (0.10, 0) | `wb_air_pollution`, `inform_climate` (= River Flood) |

The pillar key stays `environment` to limit blast radius; only its visible label changes.

## 3. Scale-continuity calibration

Changing indicators shifted the whole distribution down (mean 6.763 → 6.542 on 2026-10-14) for
no real-world reason, which would move ~30 countries' bands. v10 applies a frozen affine map to
the data score so its mean and SD match v9.1 on the switch date:

`S_data = clamp(α + β · S_raw, 1, 10)`, with β = SD_v91 / SD_v10raw and α = mean_v91 − β ·
mean_v10raw, computed ONCE on raw date 2026-10-14 over countries scored by both, then frozen in
`weights.json` with a comment. Not refitted later. (Prototype: α ≈ 0.24, β ≈ 1.00.)
Evidence: with calibration the v10 prototype's distance from community votes is within noise of
v9.1 (weighted MAE 0.477 vs 0.463; ≥5-vote countries 0.374 vs 0.353).

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
