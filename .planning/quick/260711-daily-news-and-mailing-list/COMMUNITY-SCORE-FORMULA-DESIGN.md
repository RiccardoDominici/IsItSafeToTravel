---
doc: COMMUNITY-SCORE-FORMULA-DESIGN
type: design / think-only
date: 2026-07-11
status: PROPOSAL — no code, no deploy impact
targets: Formula v10 (community-sentiment integration), engine.ts + weights.json (FUTURE)
---

# Community Sentiment Score → Scoring Formula Integration (Design)

> **THINK-ONLY DELIVERABLE.** This document changes **no source code**, touches **no
> pipeline output**, and has **zero deploy impact**. It is a math + rollout design for a
> *future* Formula v10 revision. Nothing here is wired into `engine.ts`, `weights.json`,
> `run.ts`, or any Pages Function. Implementation is a separate, gated phase (see §5).
> Until that phase ships, community sentiment remains exactly what it is today: a
> **display-only** companion (`src/pipeline/sentiment/aggregate.ts`,
> `src/lib/sentiment.ts`), never fed into `computeAllScores`.

## 0. Where we are today (verified from repo)

- **Scoring — Formula v9.1** (`src/pipeline/scoring/engine.ts`, `weights.json`): per-pillar
  Bayesian shrinkage `p̂ᵢ = (nᵢ·pᵢ + K·μ)/(nᵢ+K)`, K=1; composite = weighted **geometric**
  mean of 5 pillars blended with a down-only acute soft-min (λ=0.25) times a severe-advisory
  modifier `severeFactor = clamp(1 − S_MAX·severeEff, 0, 1)`, S_MAX=0.32; then
  `score = 1 + 9·composite^γ`, γ=0.96. Per-country `confidence = Σ wᵢ·nᵢ/(nᵢ+K)`. Frozen
  constants; parity gate `scripts/verify-formula-v91-parity.ts` (max |Δ| < 0.02).
- **Sentiment — display-only today** (`aggregate.ts`): recency-weighted mean delta,
  `correction = clamp(avgDelta·0.5, −1.0, +1.0)`, `perceived = clamp(official+correction,1,10)`,
  min 5 votes. **Structurally independent** of the engine by explicit decision D-06 — never
  enters the geometric mean. This is our option (c) baseline; it already exists.
- **Votes** (`db/sentiment-schema.sql`, `functions/api/vote.ts`): append-only D1 rows
  `{iso3, delta ∈ {−2..+2}, official_score, voter_hash, day_hash, created_at}`. Dedupe = 1
  vote / IP / country / week (salted SHA-256, UNIQUE index); daily cap 30 / visitor. **NEW
  field being added now:** `voter_country` (ISO from `CF-IPCountry`), country-level only, no
  IP stored. **Volumes are still small** — this is the dominant design constraint.

Notation below matches `engine.ts` (μ = prior, `n` = precision/evidence mass, K = shrinkage
pseudo-count, hats = shrunk quantities).

---

## 1. Options analysis

### Option (a) — 6th pillar inside the geometric mean, reweight 5→6

Add `sentiment` as a pillar with weight `w_s`, renormalize the other five, shrink like any
pillar, include it in `geometricAggregate`.

- **Fatal problem — global regression.** Renormalizing 5→6 weights changes the composite of
  **all 248 countries**, including the ~240 with zero votes. The parity fixture breaks
  everywhere; every ranking, band, and OG image shifts. This is a full re-tune, not an
  add-on.
- **Geometric-mean leverage is wrong for a perception signal.** In log-space a low sentiment
  pillar can *tank* a score hard (that is exactly why conflict/crime sit there). Perception is
  not a measured safety hazard; giving it structural multiplicative power over the composite
  inverts the data hierarchy.
- **Cross-country weight inconsistency.** A country with votes and one without would carry
  different *effective* measured-pillar weights, making scores non-comparable.
- Shrinkage-to-μ does satisfy "missing collapses to prior," but the renormalization side
  effect and the leverage make this the worst fit for v9.1 philosophy. **Reject.**

### Option (b) — post-composite bounded modifier (like the severe-advisory modifier) ✅

Leave the measured composite and the `1 + 9·composite^γ` calibration **untouched**. Apply a
small, hard-capped correction `Δ_s` to the final 1–10 score, computed from votes with its own
Bayesian shrinkage toward a *no-correction* prior and gated so it collapses to **exactly 0**
when votes are absent, sparse, or single-origin.

- **Isolation / parity-safe.** With no votes, `Δ_s = 0` → every no-vote country's score is
  **bit-identical** to v9.1. The parity fixture stays green; regression surface = only the
  countries that actually earned an activated correction.
- **Architecturally native.** v9.1 already ends with a bounded post-composite multiplier
  (`severeFactor`). Adding a bounded additive corrector at the same stage is idiomatic, not a
  philosophy break.
- **Respects "never inflate without evidence."** Prior = 0 correction; shrinkage pulls sparse
  signals to 0; a hard cap bounds worst-case influence.
- **Keeps the measured score legible.** The safety number remains a measurement; sentiment is
  a transparent, separable adjustment we can expose (`sentimentDelta`, `sentimentApplied`).
- **Recommended.**

### Option (c) — display-only companion / blended display score (status quo)

Keep official score pure; show the community "perceived" number beside it (already shipped).

- **Lowest risk, zero scoring impact** — but it is *not integration*. The task is to fold
  sentiment into the score. (c) is the safe fallback and the **shadow-mode substrate** for
  (b): we keep the companion display and *additionally* fold a tightly-capped slice into the
  official score.

### Recommendation

**Option (b), post-composite bounded additive modifier**, retaining the (c) companion display
for transparency. Rationale: only (b) integrates sentiment into the score while preserving
every v9.1 invariant — sparse/absent data collapses to a no-op, no hard gates on the measured
composite, no global re-tune, and the correction is transparent and hard-bounded. The existing
display-only pipeline (`aggregate.ts`) becomes the **shadow computation** for (b) with tighter
caps and the new geo logic layered on.

---

## 2. Full math spec (recommended option b)

Applied **after** `composeScore` produces `score = 1 + 9·composite^γ`, per country per pipeline
run. All quantities recomputed daily from the D1 vote window; nothing persisted into the
composite.

### 2.1 Vote window & recency decay

Consider votes with `created_at` within a **90-day** window `W`. Each vote `i` has delta
`dᵢ ∈ {−2,−1,0,+1,+2}`, age `aᵢ` (days), origin country `cᵢ` (new `voter_country`).

$$ r_i = 0.5^{\,a_i / H}, \qquad H = 30\ \text{days (half-life, reused from } \texttt{SENTIMENT\_HALF\_LIFE\_DAYS}) $$

90 days ≈ 3 half-lives, so the oldest in-window vote contributes < 12.5% — a natural,
continuous tail (no hard age cliff).

### 2.2 Two-level aggregation (per-origin, anti-brigade)

**Level 1 — within each origin `o`** (`cᵢ = o`):

$$ m_o = \sum_{i \in o} r_i \qquad \text{(recency mass of origin } o) $$
$$ \bar d_o = \frac{\sum_{i\in o} r_i\, d_i}{m_o} \qquad \text{(recency-weighted mean delta from } o) $$

**Per-origin mass cap** (bounds any single country's flood): with `M = Σₒ mₒ` and cap fraction
`τ = 0.5`,

$$ m_o' = \min(m_o,\ \tau M), \qquad M' = \sum_o m_o' $$

**Level 2 — aggregate across origins** on capped masses:

$$ \bar d = \frac{\sum_o m_o'\, \bar d_o}{M'}, \qquad n_s = M' \quad (\text{effective evidence mass}) $$

### 2.3 Origin diversity gate (effective number of origins)

Shares on capped masses `πₒ = mₒ'/M'`, Herfindahl `HHI = Σₒ πₒ²`, effective origins
`N_O = 1/HHI`:

$$ G = \operatorname{clamp}\!\left(\frac{N_O - 1}{O_{\text{full}} - 1},\ 0,\ 1\right), \qquad O_{\text{full}} = 3 $$

- Single origin (any volume) → `N_O ≈ 1` → **G = 0** → correction is annihilated. This is the
  primary brigade defense: brigades are almost always mono-origin.
- 2 balanced origins → `N_O ≈ 2` → G = 0.5. ≥ 3 balanced origins → G = 1.
- Using **effective** origins (inverse HHI on **capped** masses), not a raw distinct-country
  count, means a brigade padded with a handful of token foreign votes still reads `N_O ≈ 1`.

### 2.4 Bayesian shrinkage toward "no correction"

Prior `μ_s = 0` (the measured score is authoritative until the crowd earns influence — mirrors
"never inflate without evidence"). Shrinkage pseudo-count `K_s = 8`:

$$ \hat s = \frac{n_s\,\bar d + K_s\,\mu_s}{n_s + K_s} = \frac{n_s\,\bar d}{n_s + K_s} $$

Same functional form as v9.1's `p̂ = (n·p + K·μ)/(n+K)`. `n_s = 0` → `ŝ = 0`. `n_s = K_s = 8`
→ half trust. Precision **scales with (capped, recency-weighted) vote count** exactly as pillar
precision scales with `nᵢ`.

### 2.5 Correction, asymmetric hard cap, activation

Score-points per unit shrunk delta `κ = 0.20`. **Asymmetric cap** (see §7 Q1) — downward
correction is allowed to be larger than upward, because for a safety product a false "safe" is
more harmful than a false "unsafe," and upward manipulation (nationalism, tourism boards) is
the main threat:

$$ \Delta_{\text{raw}} = \kappa\,\hat s\,G, \qquad \Delta_s = \operatorname{clamp}(\Delta_{\text{raw}},\ -C_{\downarrow},\ +C_{\uparrow}), \quad C_{\downarrow}=0.30,\ C_{\uparrow}=0.15 $$

**Activation (minimum-n, else shadow):** publish a nonzero `Δ_s` only if **all** hold —
raw in-window vote count `≥ 12`, effective origins `N_O ≥ 3` (i.e. `G` at full or near-full),
and `n_s ≥ 6`. Otherwise `Δ_s := 0` and the country stays in **shadow** (computed + logged to
`data/sentiment/`, official score unchanged). This floor is deliberately stricter than today's
display floor of 5, because now it moves the **official** number.

$$ \text{score}_{\text{final}} = \operatorname{clamp}(\text{score} + \Delta_s,\ 1,\ 10) $$

### 2.6 Constants summary

| Symbol | Value | Meaning |
|---|---|---|
| `H` | 30 d | recency half-life |
| `W` | 90 d | vote window |
| `τ` | 0.50 | per-origin mass cap fraction |
| `O_full` | 3 | effective origins for full diversity credit |
| `K_s` | 8 | shrinkage pseudo-count (effective votes to half-trust) |
| `κ` | 0.20 | score-points per unit shrunk delta |
| `C↓ / C↑` | 0.30 / 0.15 | asymmetric final-score cap (down / up) |
| activation | raw ≥ 12, `N_O ≥ 3`, `n_s ≥ 6` | else shadow (Δ_s = 0) |

All would live in a new `weights.json` `community` block (single source of truth), read by the
engine like `formulaV9`. **Not added by this doc.**

---

## 3. Geo-aware weighting & anti-abuse (uses new `voter_country`)

What is detectable with **country-level origin only** (no IP, no cookies):

1. **Mono-origin brigading** — the dominant attack. Neutralized twice: per-origin mass cap
   `τ` (no origin exceeds 50% of mass) **and** the diversity gate `G` (single effective origin
   → G = 0). A 200-vote single-country flood yields `Δ_s ≈ 0` (worked example §6.3).
2. **Diversity requirement** — `N_O ≥ 3` effective origins to activate; ramp otherwise. Real,
   organic interest in a destination is multi-origin; brigades rarely are.
3. **Resident vs visitor.** `cᵢ == iso3` = "home/local" origin (resident or in-country
   traveler); `cᵢ ≠ iso3` = external observer. **Default: home-origin is just another origin
   bucket, fully subject to `τ` and `G`** — so nationals cannot dominate their own country's
   score (the classic "my country is great" upvote). Optional resident weight bonus
   `β ≤ 1.25×` *within* the home bucket is deferred (open Q3) because `τ`+`G` already bound it
   and a bonus widens the manipulation surface.
4. **Interplay with existing caps.** Ingestion already enforces 1 vote / IP / country / week and
   30 / visitor / day (`vote.ts`). Those bound per-IP volume; the new `τ`/`G` bound
   per-*country* concentration — orthogonal and complementary. A brigade using many IPs from one
   country beats the per-IP cap but is still crushed by `G`.
5. **Outlier trimming.** Because deltas are only 5 levels and already recency+geo-weighted and
   shrunk toward 0, per-vote outlier trimming is low-value; the shrinkage and cap dominate. If
   desired later, trim per-origin `d̄_o` that deviate > 2σ from the cross-origin mean *before*
   Level-2 aggregation. Deferred; not in the core spec.

**Not** detectable with country-level data: VPN-masked origin spoofing (a determined attacker
can fake `N_O ≥ 3` from VPN exit nodes). Residual defense = weekly per-IP dedupe + `K_s`
shrinkage + hard cap, so even a "successful" spoof moves the score at most `C↑ = 0.15` up. This
residual bound is the reason the cap exists.

---

## 4. Interaction with `confidence` and the "limited data" flag

- **`confidence` stays measurement-only.** It is `Σ wᵢ·nᵢ/(nᵢ+K)` over the **5 measured
  pillars**. Sentiment is perception, not measurement, so it **must not raise `confidence`**
  and must not clear the `< 0.4` "limited data" UI flag. Keeping them orthogonal preserves the
  meaning of both fields and avoids a country looking "well-sourced" on the back of votes.
- **Output transparency.** Add (future) score-adjacent fields `sentimentDelta` (the applied
  `Δ_s`) and `sentimentApplied: boolean`, so UI/LLM can say "official 5.7, community-adjusted
  −0.1." The `confidence` number is untouched.
- **Low-confidence countries: same cap, not a wider one.** Tempting to let community "fill the
  gap" for thin-data countries with a larger cap — but those are exactly the countries with few
  organic voters and the highest manipulation-to-signal ratio. **Recommend keeping `C↓/C↑`
  fixed regardless of confidence** (open Q — likely No to widening).
- The activation floor means most low-confidence micro-territories (few votes) simply never
  activate and stay in shadow — a clean, automatic outcome, no special-casing needed.

---

## 5. Rollout plan

**Phase A — Shadow (≥ 4 weeks, no score impact).**
Compute `Δ_s` every pipeline run and write it to `data/sentiment/latest.json`
(`sentimentDeltaShadow`, `nS`, `N_O`, `activated`), but **do not** add it to `score`. Publish
nothing new to users beyond the existing companion. Watch: vote accrual, `N_O` distributions,
any country whose *shadow* `Δ_s` approaches the cap, any mono-origin surges (should show `G ≈ 0`).

**Phase B — Activation criteria (all must hold before flipping the switch):**
1. ≥ N countries (owner-chosen, e.g. ≥ 20) cross the activation floor organically.
2. Manual review of the top-10 |shadow Δ_s|: each is multi-origin and plausible.
3. No activated movement is single-origin-driven (guaranteed by `G`, but verified in logs).
4. Parity fixtures green (below).

**Phase C — Flip on** behind the `weights.json` `community` block; monitor daily movers diff for
one week.

**Parity / regression fixtures (extend the v9.1 pattern):**
- **Zero-vote invariant (critical):** new `scripts/verify-community-v10-parity.ts` asserts that
  with an **empty** vote set, every country's `score_final` equals the v9.1 `score` **exactly**
  (Δ = 0). Also assert it inside `verify-formula-v91-parity.ts` (community block present but no
  votes ⇒ zero drift). This proves the modifier is a genuine no-op absent data.
- **Synthetic-vote fixtures:** a CSV of hand-built vote sets (few / diverse / brigaded / near-cap)
  with expected `Δ_s` within tol 0.005 — the §6 worked examples become the fixture rows.

**A/B sanity-check (top-movers before/after):** recompute `getSafestCountries`,
`getMostDangerousCountries`, and the 1-day/7-day movers (`hub-data.ts`) **with and without**
`Δ_s`. Gate: no country crosses a safety band boundary (5/6/7/8) **purely** from sentiment unless
`|Δ_s|` is near the cap **and** `n_s` is large and multi-origin; emit a diff report of every
country whose band changed, for manual sign-off.

---

## 6. Worked examples

Constants: H=30, K_s=8, κ=0.20, τ=0.5, O_full=3, C↓=0.30, C↑=0.15; activation raw≥12, `N_O`≥3, `n_s`≥6.

### 6.1 Few votes — country X, official 6.4
4 recent votes (`r≈1`), deltas [+1,+1,+2,0], from 2 origins (2 each).
`d̄ = 1.0`, `M' = 4` (neither origin exceeds τ·4=2), `HHI = 0.5` → `N_O = 2` → `G = 0.5`.
`ŝ = 4·1.0/(4+8) = 0.333`, `Δ_raw = 0.20·0.333·0.5 = 0.033`.
**Raw count 4 < 12 → NOT activated → `Δ_s = 0`.** Official stays **6.4**; shadow logs `Δ≈+0.03`.
*Take-away: sparse enthusiasm cannot move the score.*

### 6.2 Many diverse votes — country Y, official 5.8
60 votes / 90 d, 12 balanced origins, recency-weighted mass `M' ≈ 40`, `d̄ = −0.8` (crowd feels
less safe), no origin near τ, `HHI ≈ 0.09` → `N_O ≈ 11` → `G = 1`.
`ŝ = 40·(−0.8)/(40+8) = −0.667`, `Δ_raw = 0.20·(−0.667)·1 = −0.133`, within `C↓` → `Δ_s = −0.133`.
Activated (60≥12, `N_O`≥3, `n_s`≥6). **`score_final = 5.8 − 0.133 = 5.67`** (same band).
*Take-away: a broad, moderately strong negative crowd moves it ~0.13 — real but conservative.*

### 6.3 Brigaded burst — country Z, official 4.2
200 votes in 2 days: 195 from its own nationals (`c=iso3`, all +2), 5 from 3 other origins (mixed).
`M ≈ 200`; home mass 195 capped to `τ·M = 100` → `M' ≈ 105`, home share ≈ 0.95.
`HHI ≈ 0.91` → `N_O ≈ 1.10` → `G = clamp((1.10−1)/2,0,1) ≈ 0.05`.
`d̄ ≈ +1.9`, `ŝ = 105·1.9/(105+8) = 1.77`, `Δ_raw = 0.20·1.77·0.05 ≈ +0.018`.
Even before the cap, `G` has already killed it. **`Δ_s ≈ +0.02`** (and `≤ C↑=0.15`). Official
stays ~**4.2**. *Take-away: a 200-vote mono-origin flood moves the score by rounding error.*

### 6.4 Legit strong diverse signal (reaches the cap) — country W, official 7.1
150 votes / 90 d, 25 balanced origins, `M' ≈ 100`, `d̄ = −1.6` (broad perceived deterioration),
`HHI ≈ 0.05` → `N_O ≈ 20` → `G = 1`.
`ŝ = 100·(−1.6)/(100+8) = −1.48`, `Δ_raw = 0.20·(−1.48) = −0.296`, `|Δ| < C↓=0.30` → `Δ_s = −0.296`.
**`score_final = 7.1 − 0.296 ≈ 6.80`** — crosses the 7→6 band. This is the intended *maximum*
effect: only a broad, strong, sustained, multi-origin consensus can move ~0.3 and shift one band.
*(If the same signal were positive, `C↑=0.15` would cap it at +0.15 → 7.25.)*

---

## 7. Open questions for the owner (yes/no or pick-one)

1. **Cap shape.** Adopt the **asymmetric** cap `C↓=0.30 / C↑=0.15` (down-weighted, harder to
   inflate)? Or **symmetric ±0.30**? Or fully **down-only** (`C↑=0`, sentiment can only flag
   danger, never add safety — most aligned with the down-only acute/advisory terms)?
2. **Band crossing.** May an activated `Δ_s` move a country across a safety band boundary
   (5/6/7/8), as in example 6.4? **Yes** (bounded, intended) or **No** (clamp `Δ_s` so the band
   never changes from sentiment alone)?
3. **Resident/home-origin votes.** Treat `c==iso3` as an ordinary origin under `τ`+`G`
   (recommended) — **yes**? Or give residents a within-bucket weight bonus? Or **exclude**
   home-origin votes from scoring entirely?
4. **Activation floor.** Raw ≥ 12 & `N_O` ≥ 3 & `n_s` ≥ 6 — accept, or set higher (e.g. raw ≥ 25)
   given current low volumes?
5. **Prior.** Shrink toward `μ_s = 0` (measured score authoritative) — confirm? Or toward an
   advisory-informed value?
6. **Confidence.** Keep the cap **fixed** regardless of `confidence` (recommended), or **widen**
   the cap for `< 0.4` "limited data" countries so community fills the gap?
7. **Half-life / window.** Keep H = 30 d / W = 90 d (reusing the display constant), or a shorter
   half-life (e.g. 14 d) so the official score reacts faster to shifting sentiment?
