---
phase: 37-calibration-validation
plan: "02"
subsystem: calibration
tags: [calibration, bias-analysis, weight-proposals]
dependency_graph:
  requires: [37-01]
  provides: [bias-analysis, weight-proposals]
  affects: [scoring-engine, weights-config]
tech_stack:
  added: []
  patterns: [CLI-flag-extension, grouped-statistics, simplified-projection-model]
key_files:
  created:
    - src/pipeline/calibration/calibrate.ts
    - src/pipeline/calibration/reference-scores.json
    - data/calibration/bias-analysis.md
    - data/calibration/weight-proposals.md
    - data/calibration/deviation-report.json
  modified: []
decisions:
  - "Bias threshold set at |MSD| > 0.5 with minimum 5 countries per group"
  - "Geopolitical blocs: G7, NATO, EU, BRICS, Non-aligned (primary assignment only)"
  - "Proposal A addresses pillar weights, Proposal B addresses advisory sub-weights"
  - "Scoring model is well-calibrated: MAD 0.32, Pearson r 0.987, no systematic bias found"
metrics:
  duration: 276s
  completed: 2026-03-27
---

# Phase 37 Plan 02: Bias Analysis and Weight Proposals Summary

Systematic bias analysis of scoring model across 3 dimensions (region, tier, bloc) found no groups exceeding bias threshold; two weight adjustment proposals documented with projected impact.

## What Was Done

### Task 1: Bias Detection Analysis (b477953)

Extended `src/pipeline/calibration/calibrate.ts` with `--bias` CLI flag that:
- Computes deviations between site scores and 68-country reference dataset
- Groups countries by UN Region (Africa, Americas, Asia, Europe, Oceania), Risk Tier (safe/moderate/dangerous), and Geopolitical Bloc (G7, NATO, EU, BRICS, Non-aligned)
- Computes per-group mean signed deviation, MAD, std dev
- Applies bias threshold (|MSD| > 0.5 with n >= 5) to flag systematic issues
- Lists top 3 outlier countries per biased group
- Generates `data/calibration/bias-analysis.md` with tables for all 3 dimensions

Key findings: No groups exceed systematic bias threshold. Africa approaches threshold at MSD +0.428. Global MAD 0.320 indicates good calibration. Pearson r 0.987 shows very strong correlation.

### Task 2: Weight Adjustment Proposals (308b4a8)

Extended `calibrate.ts` with `--proposals` CLI flag that generates two concrete proposals:

**Proposal A: Pillar Rebalancing** - Increase conflict from 0.30 to 0.32 to strengthen advisory signal from 37 sources. Estimated MAD change: +0.020 (minor). Most affected: Nigeria, Ethiopia, Pakistan, North Korea, Iran.

**Proposal B: Advisory Sub-Weight Rebalancing** - Equalize advisory weights by geographic group (Western/Asian/Other) instead of Five Eyes dominance. Currently Western sources hold 0.223 of advisory weight vs Asian 0.083 and Other 0.054. Proposal equalizes to 0.120 each. Estimated MAD change: +0.034. Most affected: Non-aligned countries gain ~0.10 points.

Recommendation: Apply Proposal B first for fairness improvement, then test Proposal A separately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created calibrate.ts from scratch (37-01 dependency not committed)**
- **Found during:** Task 1
- **Issue:** Plan depends on 37-01 which was supposed to create `src/pipeline/calibration/calibrate.ts` and `data/calibration/deviation-report.json`, but those files were not in the git tree. An equivalent `scripts/calibration/analyze.ts` existed only in the main working directory (untracked).
- **Fix:** Created `calibrate.ts` at the expected path with full deviation computation, reference-scores.json copy, and deviation-report.json generation built in, then added `--bias` and `--proposals` flags as specified.
- **Files created:** src/pipeline/calibration/calibrate.ts, src/pipeline/calibration/reference-scores.json, data/calibration/deviation-report.json

## Known Stubs

None -- all outputs are data-driven from actual scores.json and reference dataset.

## Self-Check: PASSED
