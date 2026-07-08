# Score Validation Report — 2026-03-25

## Methodology
Compared our composite scores (1-10) against advisory consensus from US, UK, Canada, and Australia.
Cross-validated with Global Peace Index 2025, HelloSafe 2026, BHTP 2026, Riskline 2026, and International SOS 2026.

## Accuracy Metrics (v6.0.0 after fixes)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Mean Absolute Error | 1.821 | 1.591 | -12.6% |
| Mean Bias | -1.734 | -1.355 | -21.9% |
| Gulf states error (QAT/ARE/KWT/BHR) | avg 2.00 | avg 7.01 | Fixed |
| Territory error (PYF/COK/AIA/GLP) | avg 5.7 | avg 9.07 | Fixed |
| Level 4 countries granularity | all 2.00 | 1.63-2.33 | Fixed |

## Score Distribution by US Advisory Level

| Level | Count | Avg Score | Range |
|-------|-------|-----------|-------|
| 1 (Normal) | 71 | 7.69 | 3.74 - 9.36 |
| 2 (Increased Caution) | 80 | 6.35 | 2.99 - 8.97 |
| 3 (Reconsider Travel) | 29 | 5.50 | 1.94 - 7.57 |
| 4 (Do Not Travel) | 18 | 2.09 | 1.63 - 2.33 |

## Fixes Applied

### Fix 1: Advisory hard cap requires majority consensus
Previously: any single Level 4 advisory triggered cap at 2.00.
Now: requires majority (3/4 or 2/3) of advisory sources at Level 4.
**Impact:** Qatar 2.00 → 7.40, UAE 2.00 → 7.18, Kuwait 2.00 → 6.75, Bahrain 2.00 → 6.71.

### Fix 2: Advisory-only scoring for data-sparse countries
When dataCompleteness < 0.3, blend composite score toward advisory-derived score.
**Impact:** French Polynesia 5.8 → 8.76, Cook Islands 5.7 → 8.79, Anguilla 5.7 → 9.36.

### Fix 3: Critical floor only applies to pillars with real data
Previously: neutral 0.5 pillars (no data) could trigger the critical floor.
Now: only pillars with dataCompleteness > 0 affect the critical floor.

### Fix 4: Variable hard cap based on worst pillar
Instead of flat 2.00 for all Level 4 countries, the cap varies by min pillar score.
**Impact:** South Sudan 1.63 vs Afghanistan 2.05 vs Ukraine 2.33 (now distinguishable).

## Cross-Validation with External Sources

| Source | Top 10 Safest Match | Bottom 15 Match |
|--------|---------------------|-----------------|
| Global Peace Index 2025 | 100% | 100% |
| HelloSafe 2026 | 100% | 100% (Gulf states now fixed) |
| BHTP 2026 | 100% (UAE now correct) | N/A |
| International SOS 2026 | 100% | 100% |

## Remaining Known Issues

| Country | Score | Expected | Issue |
|---------|-------|----------|-------|
| Turkmenistan | 3.74 | ~7-8 | Low governance data from INFORM, despite Level 1 US advisory |
| Comoros | 4.10 | ~7 | Limited data + low governance |
| Eq. Guinea | 4.10 | ~7 | Limited data + poor governance scores |
| Puerto Rico | 6.30 | ~8 | US territory, lacks own WB data |

These are structural data quality issues (INFORM scores don't align with advisory assessments) rather than algorithm bugs.

---

# Score Validation Report — Formula v9 (2026-07-08)

## What Changed in v9

Formula v9 (`weights.json` v9.0.0) replaced the v8.x scoring mechanisms end-to-end:

- **Pillar recomposition:** `gpi_safety_security` moved from Conflict into Crime (Crime now measures homicide /
  violent crime / perceived criminality, not rule of law); `vdem_rule_of_law` moved from Crime into Governance,
  where it belongs. Conflict gains a new synthetic indicator `A` — a calibrated, importance-weighted consensus
  of 37 government travel advisories (sub-weight 40%).
- **Bayesian shrinkage replaces hard gating:** every pillar's raw value is shrunk toward a conservative,
  region-anchored prior `mu` in proportion to its precision (`p_hat = (n*p + K*mu)/(n+K)`, K=1.0). This
  REMOVES all v8.x eligibility gates, neutral-0.5 defaults, the low-data advisory blend, the critical floor
  (any pillar < 0.25 caps the score), and the majority-Level-4 hard cap (score held at/below 2/10).
- **Smooth acute-risk term:** a down-only power-mean over Conflict + Crime (capped at the geometric mean, so
  it can only drag a score down, never inflate it) gives extra weight to severe conflict/crime without a hard
  threshold.
- **Count-damped severe-advisory modifier:** `severeEff = severeShare * nAdv/(nAdv+6)`; `composite *= (1 -
  0.25*severeEff)`. Thin or single-source Level-4 records (e.g. a lone advisory) are damped toward zero
  influence, while broad multi-government war-zone consensus is barely discounted — this is the direct fix for
  the two worst v8.x continuity cliffs (GUM's data-bug spike, ESH's single-advisory-step cliff).
- **New score range:** the compressed, uncertainty-aware output moved from [1.11, 9.93] (v8.x) to
  approximately **[3.72 YEM, 8.89 ISL]**, global mean **6.754** (was 6.395 under the old harness baseline).
  New band legend: `<5.0` danger, `5.0–6.0` high caution, `6.0–7.0` moderate, `7.0–8.0` good, `>=8.0` excellent.
- **New `confidence` field:** `confidence = sum(w_i * n_i/(n_i+K))`, a precision-weighted 0–1 measure of how
  much fresh, present data backs a country's score across all five pillars.

## Acceptance Suite (Round 2)

20/25 harness checks pass. Full 248-country, both-direction, 7560-perturbation continuity sweep: max single-step
delta 0.418 (down from round-1's 0.782 on the same sweep). 5 residuals, all documented as best-tradeoff or
data-driven (not tunable further without breaking another gate):

| Residual | Value | Status |
|----------|-------|--------|
| A9-continuity / T-ESH-step | Western Sahara (ESH) sole `uk` advisory L3→L4 step = -0.418 | Irreducible: ESH has near-zero other data, so its advisory-informed prior *is* its profile; capping the severe modifier further to close this would reopen the GUM cliff and collapse the war-zone/Nicaragua margin (A2). |
| T-PSE | Palestine (PSE) = 5.63 (target <=4.7; does not rank below Iran/Iraq) | Arithmetically unreachable under the frozen formula: PSE's advisory severeShare (0.409) is *lower* than Iran's (0.781) and Iraq's (0.567), so strengthening the severe modifier sinks Iran/Iraq more, never PSE. Needs a new active-conflict-vs-moderate-consensus signal (design backlog). |
| T-GUM | Guam (GUM) = 5.70 (target >=5.9) | Arithmetically unreachable without breaking A4 (Vietnam <=7.0 gate) under a single gamma exponent. The count-damped severe modifier still recovered GUM from round-1's 5.527 and roughly halved its continuity cliff (+0.499 -> +0.331). |
| A12 (Russia vs Ukraine) | Russia 4.820 sits 0.061 below Ukraine 4.881 (max war zone) | Accepted, data-driven: Russia's GPI conflict pillar is rated worse (active belligerent) than Ukraine's; a flip needs a new active-kinetic-conflict-vs-political-repression signal, not a tunable change. |
| Zero-data prior-band territories | Score 5.36–8.58 range at confidence <0.06 | Intended R3/frozen-prior behavior — documented for the methodology page, not a bug. |

## Known Limitations (v9)

- **PSE (Palestine) — stale-GPI / moderate-consensus:** the annual Global Peace Index lags fast-moving active
  conflicts by months; combined with a moderate (not majority-severe) advisory consensus, PSE's score (5.63)
  sits above Iran/Iraq despite being an active-conflict territory. Flagged as a design backlog item, not fixed
  in v9.
- **GUM (Guam) — pipeline data bug:** one advisory source (`ca`, Government of Canada) currently rates Guam at
  Level 4, which is inconsistent with its status as a US Pacific territory. This is a known pipeline data
  ingestion bug (not a formula bug) that depresses GUM's score; fixing the source data alone would lift GUM to
  ~6.0+.
- **ESH (Western Sahara) — single-source advisory step:** ESH has only one included advisory source (`uk`), so
  its score is almost entirely determined by the region-anchored prior nudged by that single record. A full
  level change (L3→L4) produces the largest single-step delta in the full 7560-perturbation sweep (-0.418) —
  smooth and monotone, but larger than typical for well-measured countries.
- **RUS vs UKR ordering:** Russia and Ukraine currently share near-identical severe-advisory shares, so their
  relative order (Russia scoring marginally below Ukraine) is driven by GPI's conflict-intensity rating rather
  than the severe-advisory modifier. This should not be read as a definitive claim about relative danger.

Reproduce with `node eval-harness.mjs` (or `--K 1.0 --lambda 0.25 --q 3 --gamma 0.79 --S_MAX 0.25 --N_SEV 6`).
Source: `final-constants.json` (quick-260706-x81 / quick-260708-23u).
