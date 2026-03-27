# Bias Analysis Report

Generated: 2026-03-27T11:49:17.429Z
Based on: deviation-report.json (68 countries)

## Summary Statistics

- Global MAD: 0.320
- Global Mean Signed Deviation: +0.149
- Pearson r: 0.987
- Standard Deviation: 0.387

## Regional Bias

| Region | Countries | Mean Signed Deviation | MAD | Bias? |
|--------|-----------|----------------------|-----|-------|
| Asia | 21 | +0.042 | 0.414 | No |
| Europe | 22 | +0.071 | 0.195 | No |
| Oceania | 2 | +0.090 | 0.090 | No |
| Americas | 10 | +0.193 | 0.305 | No |
| Africa | 13 | +0.428 | 0.428 | No |


### Biased Regions Detail

No regional groups show systematic bias (threshold: |MSD| > 0.5 with n >= 5).


## Risk Tier Bias

| Tier | Countries | Mean Signed Deviation | MAD | Bias? |
|------|-----------|----------------------|-----|-------|
| dangerous | 19 | +0.116 | 0.416 | No |
| safe | 28 | +0.126 | 0.171 | No |
| moderate | 21 | +0.209 | 0.432 | No |


### Biased Tiers Detail

No risk tier groups show systematic bias (threshold: |MSD| > 0.5 with n >= 5).


## Geopolitical Bloc Bias

| Bloc | Countries | Mean Signed Deviation | MAD | Bias? |
|------|-----------|----------------------|-----|-------|
| BRICS | 10 | +0.059 | 0.477 | No |
| NATO | 15 | +0.091 | 0.205 | No |
| G7 | 7 | +0.106 | 0.137 | No |
| EU | 1 | +0.140 | 0.140 | No |
| Non-aligned | 35 | +0.208 | 0.367 | No |


### Biased Blocs Detail

No geopolitical bloc groups show systematic bias (threshold: |MSD| > 0.5 with n >= 5).


## Key Findings

- No groups exceed the systematic bias threshold (|MSD| > 0.5 with n >= 5). The scoring model shows relatively balanced performance across all grouping dimensions.
- Global MAD of 0.320 indicates good calibration overall.
- Pearson r of 0.987 shows strong correlation between site scores and reference data.
- Groups approaching bias threshold (MSD > 0.3): Africa (+0.428)


## Limitations

- Reference dataset partially overlaps with scoring engine sources (GPI, INFORM, WB) -- this creates circular validation risk
- Pearson r interpretation: r > 0.95 suggests tautological overlap; r < 0.70 suggests scoring issues
- Small territories excluded (no reference data available)
- Reference scores are subjective estimates, not ground truth -- they represent expert consensus, not measured safety
- Geopolitical bloc assignments are simplified (countries may belong to multiple blocs; only primary assigned)
- Bias threshold of |MSD| > 0.5 with n >= 5 is arbitrary; lower thresholds would reveal more patterns
