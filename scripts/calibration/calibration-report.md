# Calibration Report

**Generated:** 2026-03-27
**Scores date:** 2026-03-27
**Weights version:** 8.0.0
**Reference countries:** 68

## Executive Summary

This report compares site-computed safety scores against research-backed reference scores for 68 countries spanning all world regions and risk levels. The analysis identifies systematic biases and proposes concrete weight adjustments.

**Key findings:**
- Global Mean Absolute Deviation (MAD): **0.32**
- Root Mean Square Error (RMSE): **0.41**
- Mean systematic bias: **+0.15** (site scores slightly higher on average)
- Countries within 0.5 points: **54/68** (79%)
- Countries within 1.0 points: **67/68** (99%)
- Maximum deviation: **1.52** points

## 1. Per-Country Deviation Table

Sorted by absolute deviation (largest first):

| Rank | Country | ISO3 | Site Score | Reference | Delta | Abs Delta | Region | Risk |
|------|---------|------|-----------|-----------|-------|-----------|--------|------|
| 1 | Israel | ISR | 2.48 | 4.0 | -1.52 | 1.52 | Middle East | elevated |
| 2 | South Africa | ZAF | 6.46 | 5.5 | +0.96 | 0.96 | Sub-Saharan Africa | moderate |
| 3 | Iran | IRN | 2.18 | 3.0 | -0.82 | 0.82 | Middle East | dangerous |
| 4 | North Korea | PRK | 3.31 | 2.5 | +0.81 | 0.81 | East Asia | very-dangerous |
| 5 | Russia | RUS | 2.22 | 3.0 | -0.78 | 0.78 | Eastern Europe | dangerous |
| 6 | Ethiopia | ETH | 4.44 | 3.8 | +0.64 | 0.64 | Sub-Saharan Africa | dangerous |
| 7 | Tanzania | TZA | 6.08 | 5.5 | +0.58 | 0.58 | Sub-Saharan Africa | moderate |
| 8 | Kenya | KEN | 5.38 | 4.8 | +0.58 | 0.58 | Sub-Saharan Africa | elevated |
| 9 | Pakistan | PAK | 4.08 | 3.5 | +0.58 | 0.58 | South Asia | dangerous |
| 10 | Venezuela | VEN | 1.94 | 2.5 | -0.56 | 0.56 | South America | very-dangerous |
| 11 | Afghanistan | AFG | 2.05 | 1.5 | +0.55 | 0.55 | South Asia | very-dangerous |
| 12 | Malaysia | MYS | 7.52 | 7.0 | +0.52 | 0.52 | Southeast Asia | safe |
| 13 | Ghana | GHA | 6.32 | 5.8 | +0.52 | 0.52 | Sub-Saharan Africa | moderate |
| 14 | Peru | PER | 6.02 | 5.5 | +0.52 | 0.52 | South America | moderate |
| 15 | Syria | SYR | 1.99 | 1.5 | +0.49 | 0.49 | Middle East | very-dangerous |
| 16 | Somalia | SOM | 1.78 | 1.3 | +0.48 | 0.48 | Sub-Saharan Africa | very-dangerous |
| 17 | Turkey | TUR | 5.06 | 5.5 | -0.44 | 0.44 | Middle East | moderate |
| 18 | Yemen | YEM | 1.94 | 1.5 | +0.44 | 0.44 | Middle East | very-dangerous |
| 19 | Egypt | EGY | 5.93 | 5.5 | +0.43 | 0.43 | North Africa | moderate |
| 20 | South Sudan | SSD | 1.63 | 1.2 | +0.43 | 0.43 | Sub-Saharan Africa | very-dangerous |
| 21 | Mexico | MEX | 4.90 | 4.5 | +0.40 | 0.40 | Central America | elevated |
| 22 | Chile | CHL | 7.39 | 7.0 | +0.39 | 0.39 | South America | safe |
| 23 | Iraq | IRQ | 2.11 | 2.5 | -0.39 | 0.39 | Middle East | very-dangerous |
| 24 | India | IND | 4.12 | 4.5 | -0.38 | 0.38 | South Asia | elevated |
| 25 | Philippines | PHL | 5.17 | 4.8 | +0.37 | 0.37 | Southeast Asia | elevated |
| 26 | Hungary | HUN | 7.56 | 7.2 | +0.36 | 0.36 | Central Europe | safe |
| 27 | Romania | ROU | 7.46 | 7.1 | +0.36 | 0.36 | Central Europe | safe |
| 28 | Bulgaria | BGR | 7.24 | 6.9 | +0.34 | 0.34 | Central Europe | moderate |
| 29 | Colombia | COL | 5.13 | 4.8 | +0.33 | 0.33 | South America | elevated |
| 30 | Argentina | ARG | 6.62 | 6.3 | +0.32 | 0.32 | South America | moderate |
| 31 | Vietnam | VNM | 6.61 | 6.3 | +0.31 | 0.31 | Southeast Asia | moderate |
| 32 | Morocco | MAR | 6.51 | 6.2 | +0.31 | 0.31 | North Africa | moderate |
| 33 | Nigeria | NGA | 3.80 | 3.5 | +0.30 | 0.30 | Sub-Saharan Africa | dangerous |
| 34 | Czech Republic | CZE | 8.29 | 8.0 | +0.29 | 0.29 | Central Europe | safe |
| 35 | Greece | GRC | 7.29 | 7.0 | +0.29 | 0.29 | Southern Europe | safe |
| 36 | Croatia | HRV | 7.58 | 7.3 | +0.28 | 0.28 | Southern Europe | safe |
| 37 | Saudi Arabia | SAU | 6.47 | 6.2 | +0.27 | 0.27 | Middle East | moderate |
| 38 | Brazil | BRA | 5.22 | 5.0 | +0.22 | 0.22 | South America | moderate |
| 39 | Sudan | SDN | 2.00 | 1.8 | +0.20 | 0.20 | Sub-Saharan Africa | very-dangerous |
| 40 | Norway | NOR | 8.72 | 8.9 | -0.18 | 0.18 | Northern Europe | very-safe |
| 41 | Singapore | SGP | 8.98 | 8.8 | +0.18 | 0.18 | Southeast Asia | very-safe |
| 42 | Australia | AUS | 8.38 | 8.2 | +0.18 | 0.18 | Oceania | very-safe |
| 43 | United Kingdom | GBR | 7.98 | 7.8 | +0.18 | 0.18 | Northern Europe | safe |
| 44 | Ukraine | UKR | 2.33 | 2.5 | -0.17 | 0.17 | Eastern Europe | very-dangerous |
| 45 | Iceland | ISL | 9.04 | 9.2 | -0.16 | 0.16 | Northern Europe | very-safe |
| 46 | United States | USA | 7.16 | 7.0 | +0.16 | 0.16 | North America | safe |
| 47 | China | CHN | 6.36 | 6.2 | +0.16 | 0.16 | East Asia | moderate |
| 48 | Canada | CAN | 8.35 | 8.2 | +0.15 | 0.15 | North America | very-safe |
| 49 | Poland | POL | 7.65 | 7.5 | +0.15 | 0.15 | Central Europe | safe |
| 50 | Austria | AUT | 8.64 | 8.5 | +0.14 | 0.14 | Western Europe | very-safe |
| 51 | Myanmar | MMR | 2.07 | 2.2 | -0.13 | 0.13 | Southeast Asia | very-dangerous |
| 52 | Germany | DEU | 8.22 | 8.1 | +0.12 | 0.12 | Western Europe | safe |
| 53 | France | FRA | 7.62 | 7.5 | +0.12 | 0.12 | Western Europe | safe |
| 54 | Italy | ITA | 7.42 | 7.3 | +0.12 | 0.12 | Southern Europe | safe |
| 55 | Japan | JPN | 8.19 | 8.3 | -0.11 | 0.11 | East Asia | very-safe |
| 56 | United Arab Emirates | ARE | 7.09 | 7.2 | -0.11 | 0.11 | Middle East | safe |
| 57 | Spain | ESP | 7.70 | 7.6 | +0.10 | 0.10 | Southern Europe | safe |
| 58 | Libya | LBY | 2.09 | 2.0 | +0.09 | 0.09 | North Africa | very-dangerous |
| 59 | Thailand | THA | 6.07 | 6.0 | +0.07 | 0.07 | Southeast Asia | moderate |
| 60 | Finland | FIN | 8.86 | 8.9 | -0.04 | 0.04 | Northern Europe | very-safe |
| 61 | Sweden | SWE | 8.44 | 8.4 | +0.04 | 0.04 | Northern Europe | very-safe |
| 62 | Indonesia | IDN | 5.54 | 5.5 | +0.04 | 0.04 | Southeast Asia | moderate |
| 63 | Democratic Republic of the Congo | COD | 2.04 | 2.0 | +0.04 | 0.04 | Sub-Saharan Africa | very-dangerous |
| 64 | Denmark | DNK | 8.97 | 9.0 | -0.03 | 0.03 | Northern Europe | very-safe |
| 65 | Switzerland | CHE | 8.83 | 8.8 | +0.03 | 0.03 | Western Europe | very-safe |
| 66 | Portugal | PRT | 8.31 | 8.3 | +0.01 | 0.01 | Southern Europe | very-safe |
| 67 | New Zealand | NZL | 8.70 | 8.7 | 0.00 | 0.00 | Oceania | very-safe |
| 68 | Haiti | HTI | 2.00 | 2.0 | 0.00 | 0.00 | Caribbean | very-dangerous |

## 2. Global Deviation Metrics

| Metric | Value |
|--------|-------|
| Mean Absolute Deviation (MAD) | 0.320 |
| Root Mean Square Error (RMSE) | 0.414 |
| Mean Bias (systematic) | +0.149 |
| Max Absolute Deviation | 1.52 |
| Within 0.5 points | 54/68 (79%) |
| Within 1.0 points | 67/68 (99%) |
| Over 1.5 points | 1/68 (1%) |

## 3. Regional Bias Analysis

Mean delta > 0 means site scores higher than reference (overscored). Mean delta < 0 means site scores lower than reference (underscored).

| Region | Countries | Mean Delta | Mean Abs Delta | Direction |
|--------|-----------|-----------|----------------|-----------|
| Eastern Europe | 2 | -0.48 | 0.48 | UNDERSCORED |
| Middle East | 8 | -0.26 | 0.56 | balanced |
| Northern Europe | 6 | -0.03 | 0.10 | balanced |
| Caribbean | 1 | 0.00 | 0.00 | balanced |
| Oceania | 2 | +0.09 | 0.09 | balanced |
| Western Europe | 4 | +0.10 | 0.10 | balanced |
| North America | 2 | +0.15 | 0.15 | balanced |
| Southern Europe | 5 | +0.16 | 0.16 | balanced |
| Southeast Asia | 7 | +0.19 | 0.23 | balanced |
| South America | 6 | +0.20 | 0.39 | balanced |
| South Asia | 3 | +0.25 | 0.50 | balanced |
| North Africa | 3 | +0.28 | 0.28 | balanced |
| East Asia | 3 | +0.29 | 0.36 | balanced |
| Central Europe | 5 | +0.30 | 0.30 | balanced |
| Central America | 1 | +0.40 | 0.40 | OVERSCORED |
| Sub-Saharan Africa | 10 | +0.47 | 0.47 | OVERSCORED |

### Regional patterns:

- **Eastern Europe** (2 countries): Mean delta -0.48 - UNDERSCORED. Countries: Russia, Ukraine
- **Central America** (1 countries): Mean delta +0.40 - OVERSCORED. Countries: Mexico
- **Sub-Saharan Africa** (10 countries): Mean delta +0.47 - OVERSCORED. Countries: South Africa, Ghana, Tanzania, Kenya, Nigeria, Ethiopia, Sudan, Somalia, South Sudan, Democratic Republic of the Congo

## 4. Risk-Level Bias Analysis

| Risk Category | Countries | Mean Delta | Mean Abs Delta | Direction |
|---------------|-----------|-----------|----------------|-----------|
| very-safe | 13 | +0.02 | 0.10 | balanced |
| safe | 15 | +0.22 | 0.24 | balanced |
| moderate | 15 | +0.31 | 0.37 | OVERSCORED |
| elevated | 6 | -0.04 | 0.60 | balanced |
| dangerous | 5 | -0.02 | 0.62 | balanced |
| very-dangerous | 14 | +0.16 | 0.34 | balanced |

### Risk-level patterns:

- **moderate** countries: Mean delta +0.31 - site overestimates safety

## 5. Pillar Data Quality

| Pillar | Avg Score (0-1) | Avg Completeness | Low Data (<50%) Countries |
|--------|----------------|-----------------|--------------------------|
| conflict | 0.605 | 96% | 0 |
| crime | 0.504 | 100% | 0 |
| health | 0.697 | 100% | 0 |
| governance | 0.541 | 100% | 0 |
| environment | 0.591 | 75% | 0 |

## 6. Notable Outliers

### Most Overscored (site > reference by > 0.5)

- **South Africa** (ZAF): site 6.46 vs ref 5.5 (delta +0.96)
- **North Korea** (PRK): site 3.31 vs ref 2.5 (delta +0.81)
- **Ethiopia** (ETH): site 4.44 vs ref 3.8 (delta +0.64)
- **Tanzania** (TZA): site 6.08 vs ref 5.5 (delta +0.58)
- **Kenya** (KEN): site 5.38 vs ref 4.8 (delta +0.58)
- **Pakistan** (PAK): site 4.08 vs ref 3.5 (delta +0.58)
- **Afghanistan** (AFG): site 2.05 vs ref 1.5 (delta +0.55)
- **Malaysia** (MYS): site 7.52 vs ref 7.0 (delta +0.52)
- **Ghana** (GHA): site 6.32 vs ref 5.8 (delta +0.52)
- **Peru** (PER): site 6.02 vs ref 5.5 (delta +0.52)

### Most Underscored (site < reference by > 0.5)

- **Israel** (ISR): site 2.48 vs ref 4.0 (delta -1.52)
- **Iran** (IRN): site 2.18 vs ref 3.0 (delta -0.82)
- **Russia** (RUS): site 2.22 vs ref 3.0 (delta -0.78)
- **Venezuela** (VEN): site 1.94 vs ref 2.5 (delta -0.56)

### Low-Data Outliers (avg completeness < 50% and abs delta > 1.0)

- None

## 7. Weight Adjustment Proposals

### Proposal 1: Reduce advisory dilution in conflict pillar

**Description:** With 37 advisory sources in the conflict pillar, each individual advisory has very low weight (0.003-0.026). The 4 baseline indicators (WB political stability, GPI overall, GPI safety, GPI militarisation) hold 64% of the conflict pillar weight while 37 advisory sources share 36%. Countries that most advisory sources agree are dangerous still get diluted by the baseline weighting.

**Current state:** Baseline indicators: 64% of conflict pillar. Advisory total: 36.0% of conflict pillar.

**Proposed change:** Increase total advisory weight from 36% to 45% of conflict pillar by reducing GPI militarisation from 0.14 to 0.08 and redistributing 0.06 proportionally across advisory sources. Militarisation correlates less with travel safety than peace/stability indicators.

**Projected impact:** Countries with strong advisory consensus (Level 3-4 from most sources) would see 0.2-0.4 point score decrease. Countries with clean advisories (Level 1) would see 0.1-0.2 point increase. Estimated MAD improvement: -0.05 to -0.10.

**Affected countries:** Iran, Russia, Syria, Yemen, Afghanistan (stronger danger signal). Iceland, Denmark, Singapore (slightly higher safe score).

### Proposal 2: Apply floor adjustment for countries with extreme advisory consensus

**Description:** Some countries with near-universal Level 3-4 advisories score below their reference (Venezuela: 1.94 vs 2.5 ref). This happens because low World Bank governance scores compound with advisory penalties, creating a double-counting effect. Conversely, countries like Israel (2.48 vs 4.0 ref) with good infrastructure but active conflict score lower than expected due to advisory penalties overwhelming their strong governance/health pillars.

**Current state:** Venezuela site=1.94, ref=2.5, delta=-0.56. Israel site=2.48, ref=4, delta=-1.52.

**Proposed change:** Introduce a pillar floor mechanism: when a country has strong data in health/governance/infrastructure (normalized > 0.6), apply a minimum pillar contribution of 0.3 * pillar_weight, preventing total collapse when conflict pillar dominates. This prevents double-penalization where advisory danger + weak governance compound below reasonable levels.

**Projected impact:** Would raise scores for countries like Israel (+0.5-1.0), Iran (+0.3-0.5), and North Korea (+0.3) where infrastructure/health are better than total score suggests. Would not affect already-well-scored countries. Estimated MAD improvement: -0.15 to -0.25.

**Affected countries:** Israel, Iran, North Korea, Libya, Venezuela — countries where non-conflict pillars are artificially suppressed.

### Proposal 3: Increase health pillar default for countries with no health data

**Description:** Countries with no health indicators default to 0.5 (mid-range), which may overestimate health safety for poor countries and underestimate for rich ones. Small territories get health=0.5 regardless of their actual healthcare quality.

**Current state:** 0 of 68 reference countries have <50% health data completeness.

**Proposed change:** Use regional health averages as fallback instead of global 0.5 default. For Northern Europe fallback=0.85, for Sub-Saharan Africa fallback=0.35, etc. This requires computing regional averages from available data during scoring.

**Projected impact:** Would improve accuracy for small territories and countries with missing health data. Estimated improvement of 0.1-0.3 points for affected countries. Moderate implementation complexity.

**Affected countries:** Small territories (Aruba, Curacao, etc.), some developing countries with sparse data.


## 8. Recommendations

1. **Prioritize Proposal 2** (pillar floor mechanism) as it addresses the largest outliers (Israel, Iran, North Korea) where strong non-conflict data is being suppressed by conflict penalties.

2. **Proposal 1** (advisory rebalancing) is low-risk and would strengthen the signal from the 37 advisory sources that were the focus of the v4.0 expansion.

3. **Proposal 3** (regional health defaults) requires more implementation work but would improve accuracy for small territories that currently get a blanket 0.5 health score.

4. **Monitor data completeness** — the health and environment pillars have notable data gaps that affect scoring accuracy. Expanding data sources for these pillars should be a future priority.

5. **Re-run calibration** after any weight changes to verify MAD improvement. Target: MAD < 0.26 (20% improvement).

---

*Report generated by scripts/calibration/analyze.ts*
*Reference data: scripts/calibration/reference-scores.json (v1.0.0)*
