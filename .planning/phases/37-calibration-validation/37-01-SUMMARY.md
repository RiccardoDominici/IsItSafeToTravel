---
phase: "37"
plan: "01"
subsystem: calibration
tags: [calibration, validation, scoring, analysis]
dependency_graph:
  requires: [36-02]
  provides: [calibration-report, reference-scores, deviation-analysis]
  affects: [scoring-engine, weights-config]
tech_stack:
  added: [tsx-calibration-script]
  patterns: [reference-score-benchmarking, regional-bias-detection, deviation-analysis]
key_files:
  created:
    - scripts/calibration/reference-scores.json
    - scripts/calibration/analyze.ts
    - scripts/calibration/calibration-report.md
  modified: []
decisions:
  - "68 reference countries across 16 regions provide comprehensive calibration baseline"
  - "MAD of 0.32 indicates good overall scoring accuracy (79% within 0.5 of reference)"
  - "3 weight adjustment proposals documented: advisory rebalancing, pillar floor, regional health defaults"
metrics:
  duration: "3min"
  completed: "2026-03-27"
---

# Phase 37 Plan 01: Reference Scores, Deviation Analysis, and Calibration Report Summary

Calibration analysis comparing site scores against 68 research-backed reference countries yields MAD 0.32 with 3 concrete weight adjustment proposals targeting advisory dilution, conflict-pillar double-penalization, and health data gaps.

## What Was Done

### Task 1: Reference Score Dataset (530b102)
Created `scripts/calibration/reference-scores.json` with 68 countries spanning 16 world regions and 6 risk categories (very-safe through very-dangerous). Each entry includes ISO3 code, reference score (1-10), region, risk category, and rationale citing GPI, INFORM, CPI, and advisory levels.

### Task 2: Calibration Analysis Script (4dd90ed)
Built `scripts/calibration/analyze.ts` that reads reference and site scores, computes per-country deviations, global MAD/RMSE, regional and risk-level bias patterns, pillar data quality assessment, and generates 3 weight adjustment proposals. Outputs comprehensive markdown report.

### Task 3: Calibration Report Generation (42c16db)
Executed analysis and produced `scripts/calibration/calibration-report.md` with:
- Per-country deviation table (68 entries sorted by absolute deviation)
- Global MAD: 0.32, RMSE: 0.41, 79% within 0.5 points
- Regional bias: Sub-Saharan Africa overscored (+0.47), Eastern Europe underscored (-0.48)
- Risk-level bias: moderate-risk countries slightly overscored (+0.31)
- 3 weight adjustment proposals with projected MAD improvements
- Prioritized recommendations

## Key Findings

| Metric | Value |
|--------|-------|
| Global MAD | 0.320 |
| RMSE | 0.414 |
| Systematic bias | +0.149 (slight overscoring) |
| Within 0.5 points | 54/68 (79%) |
| Within 1.0 points | 67/68 (99%) |
| Largest outlier | Israel (-1.52, conflict double-penalization) |

### Regional Biases Identified
- Sub-Saharan Africa: +0.47 overscored (10 countries)
- Eastern Europe: -0.48 underscored (Russia, Ukraine — active conflicts)
- Central America: +0.40 overscored (Mexico)

### Weight Adjustment Proposals
1. **Advisory rebalancing**: Increase advisory total from 36% to 45% of conflict pillar by reducing GPI militarisation weight
2. **Pillar floor mechanism**: Prevent health/governance collapse when conflict dominates (addresses Israel -1.52 outlier)
3. **Regional health defaults**: Replace global 0.5 fallback with regional averages for missing health data

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 | 530b102 | Reference score dataset (68 countries, 16 regions) |
| 2 | 4dd90ed | Calibration analysis script |
| 3 | 42c16db | Calibration report with findings |

## Self-Check: PASSED

All 3 files created and all 3 commits verified.
