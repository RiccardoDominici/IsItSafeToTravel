# Weight Adjustment Proposals

Generated: 2026-03-27T11:50:16.625Z
Based on: bias-analysis.md findings

## Current Configuration

| Pillar | Weight | Indicators |
|--------|--------|------------|
| conflict | 0.30 | 41 indicators |
| crime | 0.25 | 1 indicators |
| health | 0.20 | 3 indicators |
| governance | 0.15 | 3 indicators |
| environment | 0.10 | 5 indicators |


Current MAD: 0.320
Current Pearson r: 0.987

## Proposal A: Pillar Rebalancing

### Rationale

Bias analysis shows relatively balanced performance across risk tiers (safe MSD: 0.126, dangerous MSD: 0.116). Minor rebalancing to slightly increase conflict weight would strengthen the advisory signal from the 37 advisory sources integrated in v4.0, giving more weight to the diverse government perspectives.

### Proposed Weights

| Pillar | Current | Proposed | Change |
|--------|---------|----------|--------|
| conflict | 0.30 | 0.32 | +0.02 |
| crime | 0.25 | 0.24 | -0.01 |
| health | 0.20 | 0.19 | -0.01 |
| governance | 0.15 | 0.15 | 0.00 |
| environment | 0.10 | 0.10 | 0.00 |


### Projected Impact

- Estimated MAD change: +0.020 (0.340 from 0.320)
- Most affected countries:

| Country | Current Score | Estimated New Score | Change |
|---------|--------------|--------------------|---------|
| Nigeria | 3.80 | 3.86 | +0.06 |
| Ethiopia | 4.44 | 4.50 | +0.06 |
| Pakistan | 4.08 | 4.14 | +0.06 |
| North Korea | 3.31 | 3.37 | +0.06 |
| Iran | 2.18 | 2.24 | +0.06 |


## Proposal B: Advisory Sub-Weight Rebalancing

### Rationale

Current advisory sub-weights assign highest weight to Five Eyes nations (US 0.026, UK/CA/AU 0.025 each) creating structural Western bias. While bias analysis does not show extreme geopolitical bloc differences (NATO MSD: 0.091, BRICS MSD: 0.059), equalizing by geographic group (Western, Asian, Other) would better represent the global diversity of advisory perspectives achieved in v4.0 and reduce potential anglophone bias.

### Proposed Sub-Weights

| Group | Sources | Current Total Weight | Proposed Total Weight | Per-Source |
|-------|---------|---------------------|----------------------|-----------|
| Western (19) | us, uk, ca, au, de, nl, fr, nz, ie, fi, at, be, dk, se, no, ch, pt, es, it | 0.2230 | 0.1200 | 0.0063 |
| Asian (9) | jp, sk, sg, hk, kr, tw, cn, in, ph | 0.0830 | 0.1200 | 0.0133 |
| Other (9) | br, ro, rs, ee, hr, ar, pl, cz, hu | 0.0540 | 0.1200 | 0.0133 |


### Projected Impact

- Estimated MAD change: +0.034 (0.354 from 0.320)
- Most affected countries:

| Country | Current Score | Estimated New Score | Change |
|---------|--------------|--------------------|---------|
| Switzerland | 8.83 | 8.93 | +0.10 |
| Singapore | 8.98 | 9.08 | +0.10 |
| New Zealand | 8.70 | 8.80 | +0.10 |
| Australia | 8.38 | 8.48 | +0.10 |
| Chile | 7.39 | 7.49 | +0.10 |


## Recommendation

The current calibration is already strong (MAD 0.320, Pearson r 0.987). Both proposals offer modest improvements:

- Proposal A (pillar rebalancing) would shift MAD by approximately +0.020
- Proposal B (advisory sub-weight rebalancing) would shift MAD by approximately +0.034

**Recommendation:** Apply Proposal B first as a fairness improvement -- it reduces anglophone bias without significantly affecting overall accuracy. Proposal A should be tested separately with a full pipeline re-run before deploying, as pillar weight changes have broader effects. Both changes should be validated incrementally rather than combined.

## Caveats

- Projections are approximate (simplified model, not full engine re-run)
- Reference dataset has partial overlap with scoring sources
- MAD of 0.5-1.0 is acceptable; chasing MAD=0 would be overfitting
- Any weight changes should be validated with a full pipeline re-run before deploying
- Advisory sub-weight changes affect only the conflict pillar (30% of total score)
- Geographic grouping of advisory sources is simplified; some sources span categories
