# Phase 37: Calibration & Validation - Research

**Researched:** 2026-03-27
**Domain:** Scoring calibration, statistical analysis, bias detection
**Confidence:** HIGH

## Summary

This phase is an analysis/data phase, not a feature-building phase. The goal is to create a reference dataset of expected safety scores, compare the site's actual scores against it, find systematic biases, and propose weight adjustments. The scoring engine (engine.ts) computes a 1-10 score per country via weighted geometric mean of 5 pillars (conflict 30%, crime 25%, health 20%, governance 15%, environment 10%), with tiered baseline+signal blending and advisory hard caps. The current dataset covers 248 countries with a mean score of 6.40 and median of 6.63.

The project already has GPI data (160 countries), INFORM data (191 countries), and World Bank indicators in-repo. The reference dataset should be built by combining GPI scores (1-5 scale, inverted), INFORM Risk Index scores (0-10), and World Bank governance indicators into a composite "expected safety" score on the same 1-10 scale. This avoids external fetches -- the raw data is already available. Numbeo Safety Index data would supplement but is not strictly needed given the in-repo sources.

**Primary recommendation:** Build the reference dataset as a static JSON file using in-repo GPI + INFORM + WB data, compute deviations as a Node.js/TypeScript script that reads latest.json, and output deviation-report.json + bias-analysis.md + weight-proposals.md.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion.

### Claude's Discretion
- Reference score dataset with research-backed expected safety scores (1-10) for at least 50 representative countries
- Deviation report showing per-country delta between site scores and reference scores
- Global mean absolute deviation computed
- Systematic bias patterns identified and documented (by region, risk level, geopolitical bloc)
- At least 2 concrete weight adjustment proposals with projected impact

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAL-01 | Research-based reference score (1-10) established for each country via global safety perception analysis | Use GPI overall score (inverted, rescaled 1-10) as primary reference; cross-validate with INFORM Risk Index and WB Political Stability |
| CAL-02 | Compare site scores vs reference scores, compute per-country delta and global mean deviation | Script reads data/scores/latest.json, joins with reference dataset by iso3, computes delta and MAD |
| CAL-03 | Identify systematic bias patterns (by region, risk level, geopolitical bloc) | Group countries by UN region, score tier, and geopolitical bloc; compute mean deviation per group |
| CAL-04 | Propose weight balancing options based on deviation analysis | Adjust pillar weights and/or indicator sub-weights in weights.json; re-run scoring to project impact |
</phase_requirements>

## Architecture Patterns

### Recommended Project Structure
```
src/pipeline/calibration/
  reference-scores.json        # Static reference dataset (50+ countries)
  calibrate.ts                 # Main calibration script
  build-reference.ts           # Build reference scores from raw data
data/calibration/
  deviation-report.json        # Per-country delta output
  bias-analysis.md             # Systematic bias documentation
  weight-proposals.md          # Weight adjustment proposals with projections
```

### Pattern 1: Reference Score Construction
**What:** Combine multiple authoritative indices into a single expected safety score (1-10)
**When to use:** CAL-01

The reference score should be a weighted composite of:
1. **GPI Overall** (weight 0.50): The most directly comparable safety index. Scale: 1-5 (lower = more peaceful). Invert and rescale: `reference = (5 - gpi) / 4 * 9 + 1`. Available for 160 countries.
2. **INFORM Risk Index** (weight 0.30): Comprehensive risk metric. Scale: 0-10 (lower = safer). Rescale: `reference = (10 - inform) / 10 * 9 + 1`. Use the average of inform_natural, inform_health, inform_epidemic, inform_governance, inform_climate. Available for 191 countries.
3. **WB Political Stability** (weight 0.20): Governance quality proxy. Scale: -2.5 to 2.5 (higher = better). Rescale: `reference = (wb + 2.5) / 5 * 9 + 1`. Available for ~190 countries.

For countries missing one source, re-weight among available sources. Countries with zero sources are excluded from the reference dataset.

**Example:**
```typescript
// Reference score for Iceland:
// GPI overall: 1.124 -> (5 - 1.124) / 4 * 9 + 1 = 9.72
// INFORM avg: ~1.5 -> (10 - 1.5) / 10 * 9 + 1 = 8.65
// WB pol stab: 1.58 -> (1.58 + 2.5) / 5 * 9 + 1 = 8.34
// Composite: 0.50 * 9.72 + 0.30 * 8.65 + 0.20 * 8.34 = 9.12
```

### Pattern 2: Deviation Analysis
**What:** Compute per-country delta between site score and reference score
**When to use:** CAL-02

```typescript
interface DeviationEntry {
  iso3: string;
  name: string;
  siteScore: number;       // from latest.json
  referenceScore: number;  // from reference-scores.json
  delta: number;           // siteScore - referenceScore (positive = site rates safer)
  absDelta: number;        // |delta|
  region: string;          // UN region
  tier: string;            // 'safe' (7-10), 'moderate' (4-6), 'dangerous' (1-3)
  bloc: string;            // geopolitical grouping
}
```

Key statistics to compute:
- **MAD (Mean Absolute Deviation):** average of |delta| across all countries
- **Mean Signed Deviation:** average of delta (reveals systematic over/under-rating)
- **Std Dev:** spread of deviations
- **Correlation:** Pearson r between site scores and reference scores

### Pattern 3: Bias Detection by Grouping
**What:** Group countries and compute per-group deviation statistics
**When to use:** CAL-03

Groups to analyze:
1. **By UN Region:** Africa, Americas, Asia, Europe, Oceania
2. **By Risk Tier:** Safe (ref 7-10), Moderate (ref 4-6), Dangerous (ref 1-3)
3. **By Geopolitical Bloc:** NATO, EU, BRICS, Non-aligned, Conflict zones

Bias pattern = a group whose mean signed deviation is significantly different from 0. Threshold: |mean_signed_delta| > 0.5 AND |mean_signed_delta| > 1 std dev of the global delta distribution.

### Pattern 4: Weight Adjustment Proposals
**What:** Propose concrete changes to weights.json and project their impact
**When to use:** CAL-04

Each proposal should include:
1. What changes (which weights, by how much)
2. Why (addresses which bias pattern)
3. Projected impact: re-compute scores with modified weights, show new MAD and per-group deviations
4. Countries most affected (top 5 by delta change)

**Two proposals to consider:**
- **Proposal A: Pillar rebalancing** -- adjust the 5 pillar weights (e.g., reduce conflict from 0.30 if it causes over-penalization of politically unstable but otherwise safe countries)
- **Proposal B: Advisory sub-weight rebalancing** -- adjust advisory indicator weights within the conflict pillar (currently US 0.026, UK 0.025, etc.) if Western-government advisory bias is detected

### Anti-Patterns to Avoid
- **Overfitting to reference data:** The reference dataset is itself imperfect. Don't chase MAD=0. A MAD of 0.5-1.0 is acceptable and expected.
- **Circular calibration:** Don't use the site's own data sources (GPI, INFORM) as the ONLY reference. The reference uses them differently (composite vs. per-pillar) so overlap is limited, but acknowledge it.
- **Weight changes without projected impact:** Never propose a weight change without showing what scores change and by how much.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Statistical calculations | Custom stats functions | Simple arithmetic (MAD, mean, stddev are trivial) | No library needed for basic stats |
| Country region mapping | Manual region assignment | Static JSON mapping (ISO3 -> UN region) | One-time data entry, no API needed |
| Score re-computation | Duplicating engine.ts logic | Import and call computeAllScores directly | Ensures projected scores match real engine |

## Common Pitfalls

### Pitfall 1: Circular Reference Bias
**What goes wrong:** The reference dataset uses the same data sources as the scoring engine (GPI, INFORM, WB), so high correlation is partially tautological.
**Why it happens:** Limited number of authoritative global safety indices.
**How to avoid:** Acknowledge this limitation explicitly. Focus on relative ordering and outlier detection rather than absolute score matching. The value is in finding countries where the site's multi-pillar composite diverges from simpler reference indices.
**Warning signs:** Pearson r > 0.95 suggests too much overlap; r < 0.70 suggests the scoring engine has issues.

### Pitfall 2: Small-Country Score Inflation
**What goes wrong:** Tiny territories (Pitcairn, Vatican, Faroe Islands) get perfect 10.0 scores due to missing data defaulting to 0.5 neutral.
**Why it happens:** No World Bank, GPI, or INFORM data exists for these territories. The engine defaults missing pillars to 0.5 which maps to ~5.5, but with only advisory data available, the tiered blending gives them high signal scores.
**How to avoid:** Exclude countries with dataCompleteness < 0.5 from the calibration analysis, or flag them separately.
**Warning signs:** 9 countries currently score 10.0, which is suspicious.

### Pitfall 3: Advisory Dominance in Conflict Pillar
**What goes wrong:** With 37 advisory sources vs. 4 baseline indicators in the conflict pillar, advisory consensus can overwhelm the baseline.
**Why it happens:** The tiered system caps signal influence at 30%, but within the conflict pillar, advisory sub-weights sum to 0.36 (baseline indicators sum to 0.64). However, with signal completeness scaling, the effective contribution varies.
**How to avoid:** This is a known design choice. The calibration should verify whether this causes systematic bias (e.g., all Western-advisory-covered countries converging to similar scores).
**Warning signs:** Low variance in the conflict pillar scores across diverse countries.

### Pitfall 4: Stale Weights Version
**What goes wrong:** The latest.json shows weightsVersion "7.0.0" but weights.json shows version "8.0.0".
**Why it happens:** The pipeline may not have been re-run after the latest weights update.
**How to avoid:** Re-run the pipeline before calibrating, or calibrate against the most recent snapshot. Document which weights version was calibrated.
**Warning signs:** Mismatch between weights.json version and snapshot weightsVersion.

## Code Examples

### Reading Current Scores
```typescript
// Source: src/pipeline/scoring/snapshot.ts
import { loadLatestSnapshot } from '../scoring/snapshot.js';

const snapshot = loadLatestSnapshot();
if (!snapshot) throw new Error('No snapshot available');
console.log(`Calibrating against ${snapshot.date}, ${snapshot.countries.length} countries`);
```

### Building Reference Score from In-Repo Data
```typescript
// Source: project data files (gpi-parsed.json, inform-parsed.json, worldbank-parsed.json)
import { readJson } from '../utils/fs.js';

interface RefSource { iso3: string; score: number; } // normalized to 1-10

function buildGpiReference(gpiData: any): Map<string, number> {
  const map = new Map<string, number>();
  for (const ind of gpiData.indicators) {
    if (ind.indicatorName === 'gpi_overall') {
      // GPI: 1-5, lower = more peaceful
      const score = ((5 - ind.value) / 4) * 9 + 1;
      map.set(ind.countryIso3, Math.max(1, Math.min(10, score)));
    }
  }
  return map;
}
```

### Computing Deviation Statistics
```typescript
function computeStats(deltas: number[]) {
  const n = deltas.length;
  const mean = deltas.reduce((a, b) => a + b, 0) / n;
  const mad = deltas.reduce((a, b) => a + Math.abs(b), 0) / n;
  const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);
  return { mean, mad, stddev, n };
}
```

### Country Region Mapping
```typescript
// Static mapping for bias analysis - UN geographic regions
const REGION_MAP: Record<string, string> = {
  // Africa
  'DZA': 'Africa', 'AGO': 'Africa', 'BEN': 'Africa', 'BWA': 'Africa', 'BFA': 'Africa',
  'BDI': 'Africa', 'CMR': 'Africa', 'CPV': 'Africa', 'CAF': 'Africa', 'TCD': 'Africa',
  // ... (50+ entries)
  // Europe
  'ALB': 'Europe', 'AUT': 'Europe', 'BEL': 'Europe', 'BGR': 'Europe',
  // ... etc
};

const BLOC_MAP: Record<string, string> = {
  // NATO members
  'USA': 'NATO', 'GBR': 'NATO', 'FRA': 'NATO', 'DEU': 'NATO',
  // BRICS
  'BRA': 'BRICS', 'RUS': 'BRICS', 'IND': 'BRICS', 'CHN': 'BRICS', 'ZAF': 'BRICS',
  // EU (overlap with NATO is fine -- analyze both)
  'AUT': 'EU', 'BEL': 'EU', 'BGR': 'EU',
  // ...
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Equal-weight averaging | Tiered baseline+signal with geometric mean | v7.0 (Phase 28) | Penalizes low outliers, prevents signal spikes |
| 4 advisory sources | 37 advisory sources | v8.0 (Phases 29-34) | Massive increase in conflict pillar signal data |
| WHO DONs + GDELT | Removed, weights redistributed | v7.0 (Phase 28) | Simpler, more reliable health/environment pillars |

**Current scoring engine version:** weights.json v8.0.0, pipeline version 0.0.1

## Key Data Points for Calibration

### Current Score Distribution (248 countries)
| Display Score | Count | Percentage |
|---------------|-------|------------|
| 2 | 23 | 9.3% |
| 3 | 3 | 1.2% |
| 4 | 15 | 6.0% |
| 5 | 20 | 8.1% |
| 6 | 51 | 20.6% |
| 7 | 56 | 22.6% |
| 8 | 47 | 19.0% |
| 9 | 24 | 9.7% |
| 10 | 9 | 3.6% |

Mean: 6.40, Median: 6.63. No countries score display=1. Score=3 bin is suspiciously thin (3 countries).

### Sample Spot-Check (site score vs expected perception)
| Country | Site Score | Expected Range | Notes |
|---------|-----------|----------------|-------|
| Iceland | 9.04 | 9-10 | Correct |
| Norway | 8.72 | 9-10 | Slightly low |
| Switzerland | 8.83 | 9-10 | Correct |
| Japan | 8.19 | 8-9 | Correct |
| USA | 7.16 | 6-7 | Possibly high |
| Brazil | 5.22 | 4-5 | Reasonable |
| Mexico | 4.90 | 4-5 | Reasonable |
| Russia | 2.22 | 2-3 | Correct (advisory hard cap likely) |
| China | 6.36 | 5-6 | Possibly high |
| India | 4.12 | 4-5 | Reasonable |
| South Africa | 6.46 | 4-5 | Possibly high (crime underweighted?) |
| Afghanistan | 2.05 | 1-2 | Correct |

### Reference Data Available In-Repo
| Source | Countries | Indicators | Scale | In-repo Path |
|--------|-----------|------------|-------|--------------|
| GPI | 160 | gpi_overall, gpi_safety_security, gpi_militarisation | 1-5 (lower=safer) | data/raw/YYYY-MM-DD/gpi-parsed.json |
| INFORM | 191 | inform_natural, inform_health, inform_epidemic, inform_governance, inform_climate | 0-10 (lower=safer) | data/raw/YYYY-MM-DD/inform-parsed.json |
| World Bank | ~190 | wb_political_stability, wb_rule_of_law, wb_gov_effectiveness, wb_corruption_control | -2.5 to 2.5 (higher=better) | data/raw/YYYY-MM-DD/worldbank-parsed.json |

## Open Questions

1. **Should the reference dataset include Numbeo Safety Index?**
   - What we know: Numbeo provides crowd-sourced safety perception data for ~130 countries. It would add a non-governmental, perception-based dimension.
   - What's unclear: Numbeo data is not in-repo and would need a one-time fetch or manual entry.
   - Recommendation: Skip for v1 calibration. The in-repo data (GPI + INFORM + WB) covers 160+ countries and provides sufficient reference. Numbeo can be added later if needed.

2. **Which snapshot to calibrate against?**
   - What we know: latest.json shows weightsVersion "7.0.0" but weights.json is version "8.0.0". The pipeline may need re-running.
   - What's unclear: Whether the latest snapshot includes all tier 3b advisory sources.
   - Recommendation: Re-run the pipeline before calibrating to ensure scores reflect the latest weights and all advisory sources. If not feasible, calibrate against the latest available snapshot and note the version.

3. **How to handle the 88 countries with no GPI data?**
   - What we know: GPI covers 160 of 248 countries. Small territories and some nations are excluded.
   - What's unclear: Whether INFORM+WB alone is sufficient for a meaningful reference score.
   - Recommendation: Build reference for all countries with at least 2 of 3 sources. This should yield 150+ countries (well above the 50-country minimum).

## Sources

### Primary (HIGH confidence)
- `src/pipeline/scoring/engine.ts` -- full scoring engine source code
- `src/pipeline/scoring/normalize.ts` -- normalization ranges and logic
- `src/pipeline/config/weights.json` -- current weight configuration v8.0.0
- `src/pipeline/config/source-tiers.json` -- tier classification for all sources
- `data/scores/latest.json` -- current score output for 248 countries
- `data/raw/2026-03-26/gpi-parsed.json` -- GPI data, 160 countries
- `data/raw/2026-03-26/inform-parsed.json` -- INFORM data, 191 countries

### Secondary (MEDIUM confidence)
- Spot-check of expected safety perceptions based on established indices (GPI rankings, INFORM rankings)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - this is a data analysis phase using existing project infrastructure (TypeScript, Node.js, existing pipeline utilities)
- Architecture: HIGH - straightforward statistical analysis pattern, no novel design needed
- Pitfalls: HIGH - identified through direct analysis of current score distribution and engine logic

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- analysis methodology doesn't change)
