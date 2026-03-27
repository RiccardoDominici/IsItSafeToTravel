---
phase: 37-calibration-validation
verified: 2026-03-27T11:54:37Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 37: Calibration Validation Verification Report

**Phase Goal:** Scores are validated against real-world safety perceptions, systematic biases are identified, and weight adjustments are proposed based on data
**Verified:** 2026-03-27T11:54:37Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Research-backed reference scores exist for 50+ countries covering all regions and risk levels | VERIFIED | `scripts/calibration/reference-scores.json` — 68 countries, 16 regions, 6 risk categories (very-safe through very-dangerous) |
| 2 | Per-country deviation computed and global MAD documented | VERIFIED | `scripts/calibration/calibration-report.md` — 68-country deviation table, MAD 0.320, RMSE 0.414, Pearson r 0.987 |
| 3 | Systematic bias patterns identified by region, risk tier, and geopolitical bloc | VERIFIED | `data/calibration/bias-analysis.md` — tables for all 3 grouping dimensions with MSD and MAD per group; Africa approaches threshold at +0.428 |
| 4 | At least 2 concrete weight adjustment proposals with projected impact | VERIFIED | `data/calibration/weight-proposals.md` — Proposal A (pillar rebalancing) and Proposal B (advisory sub-weight rebalancing), each with projected MAD change and top-5 affected countries |
| 5 | Each proposal shows specific countries affected and projected MAD change | VERIFIED | Proposal A: +0.020 MAD change, 5 affected countries listed. Proposal B: +0.034 MAD change, 5 affected countries listed |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/calibration/reference-scores.json` | 50+ countries, all regions/risk levels | VERIFIED | 68 countries, 16 regions, 6 risk categories, 551 lines |
| `scripts/calibration/analyze.ts` | Analysis script (Plan 01 primary) | VERIFIED | 416 lines, substantive implementation |
| `scripts/calibration/calibration-report.md` | Full calibration report with deviation table, bias, proposals | VERIFIED | 241 lines, 8 sections including per-country table, regional/risk analysis, 3 proposals |
| `src/pipeline/calibration/calibrate.ts` | Main calibration script with --bias and --proposals flags | VERIFIED | 691 lines, both CLI flags wired at lines 685 and 689 |
| `src/pipeline/calibration/reference-scores.json` | Reference scores at pipeline-expected path | VERIFIED | 68 countries (copy used by calibrate.ts) |
| `data/calibration/deviation-report.json` | JSON deviation data produced by calibrate.ts | VERIFIED | 758 lines, 68 countries with delta/absDelta/region/tier/bloc fields |
| `data/calibration/bias-analysis.md` | Bias analysis by region, tier, bloc | VERIFIED | 74 lines, all 3 grouping dimensions with MSD and Bias columns |
| `data/calibration/weight-proposals.md` | 2 proposals with projected impact tables | VERIFIED | 96 lines, Proposal A and B with current vs proposed tables and projected impact |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pipeline/calibration/calibrate.ts` | `public/scores.json` | reads at line 170 (`SCORES_PATH`) | WIRED | 248 real countries loaded |
| `src/pipeline/calibration/calibrate.ts` | `src/pipeline/calibration/reference-scores.json` | reads at line 93 (`REFERENCE_PATH`) | WIRED | 68 reference countries |
| `src/pipeline/calibration/calibrate.ts` | `data/calibration/deviation-report.json` | writes and reads at `DEVIATION_REPORT_PATH` | WIRED | Written when no flags; read implicitly (report passed to generateBiasAnalysis/generateWeightProposals) |
| `src/pipeline/calibration/calibrate.ts --bias` | `data/calibration/bias-analysis.md` | `generateBiasAnalysis(report)` call | WIRED | bias-analysis.md exists with generated content (timestamp 2026-03-27) |
| `src/pipeline/calibration/calibrate.ts --proposals` | `data/calibration/weight-proposals.md` | `generateWeightProposals(report)` call | WIRED | weight-proposals.md exists with generated content (timestamp 2026-03-27) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `data/calibration/deviation-report.json` | countries[] with delta values | `public/scores.json` (248 real scored countries) cross-referenced with 68 reference scores | Yes — site scores from live scoring engine, reference scores research-backed | FLOWING |
| `data/calibration/bias-analysis.md` | MSD/MAD per region/tier/bloc | deviation-report.json (68 matched countries) | Yes — computed statistics, Africa MSD +0.428 near threshold | FLOWING |
| `data/calibration/weight-proposals.md` | Current weights + proposed changes | `src/pipeline/config/weights.json` (v8.0.0) + deviation-report | Yes — references real pillar weights (conflict 0.30, crime 0.25, etc.) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| calibrate.ts --bias flag exists | `grep -c "\-\-bias" calibrate.ts` | 4 matches (comment, constant reference, conditional) | PASS |
| calibrate.ts --proposals flag exists | `grep -c "\-\-proposals" calibrate.ts` | 3 matches | PASS |
| bias-analysis.md generated with real data | file exists, 74 lines, timestamp 2026-03-27 | All 3 dimension tables present | PASS |
| weight-proposals.md has 2 proposals with impact tables | file exists, 96 lines, contains "Proposal A" and "Proposal B" | Both proposals with projected impact | PASS |
| deviation-report.json has 68 countries with real scores | JSON parsed, totalCountries=68, pearsonR=0.987 | Substantive data | PASS |
| All 5 commits exist in git history | `git log --oneline` | 530b102, 4dd90ed, 42c16db, b477953, 308b4a8 all present | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CAL-01 | 37-01 | Research-based reference score (1-10) established for each country via global safety perception analysis | SATISFIED | `scripts/calibration/reference-scores.json` — 68 countries with GPI, INFORM, CPI, advisory-backed reference scores; REQUIREMENTS.md marks [x] |
| CAL-02 | 37-01 | Compare site scores vs reference scores, compute per-country delta and global mean deviation | SATISFIED | `scripts/calibration/calibration-report.md` section 1 (per-country deviation table) and section 2 (global metrics: MAD 0.320, RMSE 0.414); `data/calibration/deviation-report.json` |
| CAL-03 | 37-01, 37-02 | Identify systematic bias patterns (by region, risk level, geopolitical bloc) | SATISFIED | `scripts/calibration/calibration-report.md` sections 3-4 (regional + risk-level bias); `data/calibration/bias-analysis.md` all 3 grouping dimensions |
| CAL-04 | 37-01, 37-02 | Propose weight balancing options based on deviation analysis | SATISFIED | `scripts/calibration/calibration-report.md` section 7 (3 proposals); `data/calibration/weight-proposals.md` (Proposal A + B with projected impact) |

All 4 requirements satisfied. REQUIREMENTS.md status table confirms all 4 marked Complete for Phase 37.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TODOs, FIXMEs, placeholders, or empty returns detected in calibration scripts | — | — |

Scan ran against `src/pipeline/calibration/calibrate.ts` and `scripts/calibration/analyze.ts`.

---

### Human Verification Required

None — all deliverables are static analysis outputs (markdown reports, JSON data files) that can be fully verified programmatically. No UI, no real-time behavior, no external service integration.

---

### Notable: Plan 01 vs Plan 02 Path Divergence

Plan 01 was specified to create files at `scripts/calibration/` (analyze.ts, reference-scores.json, calibration-report.md). Plan 02 was specified to create files at `src/pipeline/calibration/` (calibrate.ts, reference-scores.json) and `data/calibration/` (bias-analysis.md, weight-proposals.md, deviation-report.json).

The 37-02 SUMMARY documents that `calibrate.ts` was created from scratch because the 37-01 dependency had placed its main script at `scripts/calibration/analyze.ts` (untracked at time of Plan 02 execution) rather than `src/pipeline/calibration/calibrate.ts`. Both script paths now exist and both produce their respective outputs. This is an implementation path divergence, not a gap — all goal outputs are present and substantive.

---

### Gaps Summary

No gaps. All phase goal components are achieved:
- Reference dataset: 68 countries across 16 regions and 6 risk categories (exceeds 50-country requirement)
- Deviation analysis: per-country table, MAD 0.320, Pearson r 0.987 documented
- Bias detection: all 3 required dimensions (region, risk tier, geopolitical bloc) with threshold-based flagging
- Weight proposals: 2 concrete proposals (Proposal A: pillar rebalancing, Proposal B: advisory sub-weight equalization) each with projected MAD impact and top-5 affected countries
- All 4 requirement IDs (CAL-01 through CAL-04) satisfied across both plans
- All 5 documented commits verified in git history

---

_Verified: 2026-03-27T11:54:37Z_
_Verifier: Claude (gsd-verifier)_
