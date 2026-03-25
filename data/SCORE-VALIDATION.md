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
