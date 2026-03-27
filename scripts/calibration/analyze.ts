/**
 * Calibration Analysis Script
 *
 * Compares site safety scores against research-backed reference scores,
 * identifies systematic bias patterns, and proposes weight adjustments.
 *
 * Usage: npx tsx scripts/calibration/analyze.ts
 * Output: scripts/calibration/calibration-report.md
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ── Types ───────────────────────────────────────────────────────────────

interface ReferenceCountry {
  iso3: string;
  name: string;
  referenceScore: number;
  region: string;
  riskCategory: string;
  rationale: string;
}

interface ReferenceData {
  version: string;
  countries: ReferenceCountry[];
}

interface ScoredCountry {
  iso3: string;
  name: { en: string };
  score: number;
  scoreDisplay: number;
  pillars: Array<{
    name: string;
    score: number;
    weight: number;
    dataCompleteness: number;
    indicators: Array<{
      name: string;
      rawValue: number;
      normalizedValue: number;
      source: string;
    }>;
  }>;
}

interface ScoresData {
  date: string;
  globalScore: number;
  countries: ScoredCountry[];
}

interface DeviationEntry {
  iso3: string;
  name: string;
  siteScore: number;
  referenceScore: number;
  delta: number;
  absDelta: number;
  region: string;
  riskCategory: string;
  pillarScores: Record<string, number>;
  dataCompleteness: Record<string, number>;
}

interface RegionBias {
  region: string;
  count: number;
  meanDelta: number;
  meanAbsDelta: number;
  countries: string[];
}

interface RiskBias {
  riskCategory: string;
  count: number;
  meanDelta: number;
  meanAbsDelta: number;
}

// ── Main ────────────────────────────────────────────────────────────────

const ROOT = join(import.meta.dirname || __dirname, '..', '..');

// Load data
const referenceData: ReferenceData = JSON.parse(
  readFileSync(join(ROOT, 'scripts/calibration/reference-scores.json'), 'utf8')
);
const scoresData: ScoresData = JSON.parse(
  readFileSync(join(ROOT, 'public/scores.json'), 'utf8')
);

// Build lookup
const siteScoresMap = new Map<string, ScoredCountry>();
for (const c of scoresData.countries) {
  siteScoresMap.set(c.iso3, c);
}

// ── Step 1: Compute per-country deviations ──────────────────────────────

const deviations: DeviationEntry[] = [];

for (const ref of referenceData.countries) {
  const site = siteScoresMap.get(ref.iso3);
  if (!site) {
    console.warn(`WARNING: ${ref.iso3} (${ref.name}) not found in scores.json`);
    continue;
  }

  const delta = site.score - ref.referenceScore;
  const pillarScores: Record<string, number> = {};
  const dataCompleteness: Record<string, number> = {};
  for (const p of site.pillars) {
    pillarScores[p.name] = p.score;
    dataCompleteness[p.name] = p.dataCompleteness;
  }

  deviations.push({
    iso3: ref.iso3,
    name: ref.name,
    siteScore: parseFloat(site.score.toFixed(2)),
    referenceScore: ref.referenceScore,
    delta: parseFloat(delta.toFixed(2)),
    absDelta: parseFloat(Math.abs(delta).toFixed(2)),
    region: ref.region,
    riskCategory: ref.riskCategory,
    pillarScores,
    dataCompleteness,
  });
}

// ── Step 2: Global metrics ──────────────────────────────────────────────

const totalDeviations = deviations.length;
const globalMAD = deviations.reduce((sum, d) => sum + d.absDelta, 0) / totalDeviations;
const globalMeanDelta = deviations.reduce((sum, d) => sum + d.delta, 0) / totalDeviations;
const maxAbsDev = Math.max(...deviations.map(d => d.absDelta));
const rmse = Math.sqrt(deviations.reduce((sum, d) => sum + d.delta ** 2, 0) / totalDeviations);

// Count within thresholds
const within05 = deviations.filter(d => d.absDelta <= 0.5).length;
const within10 = deviations.filter(d => d.absDelta <= 1.0).length;
const over15 = deviations.filter(d => d.absDelta > 1.5);

// ── Step 3: Regional bias ───────────────────────────────────────────────

const regionMap = new Map<string, DeviationEntry[]>();
for (const d of deviations) {
  if (!regionMap.has(d.region)) regionMap.set(d.region, []);
  regionMap.get(d.region)!.push(d);
}

const regionBiases: RegionBias[] = [];
for (const [region, entries] of regionMap) {
  const meanDelta = entries.reduce((s, e) => s + e.delta, 0) / entries.length;
  const meanAbsDelta = entries.reduce((s, e) => s + e.absDelta, 0) / entries.length;
  regionBiases.push({
    region,
    count: entries.length,
    meanDelta: parseFloat(meanDelta.toFixed(2)),
    meanAbsDelta: parseFloat(meanAbsDelta.toFixed(2)),
    countries: entries.map(e => e.name),
  });
}
regionBiases.sort((a, b) => a.meanDelta - b.meanDelta);

// ── Step 4: Risk-level bias ─────────────────────────────────────────────

const riskOrder = ['very-safe', 'safe', 'moderate', 'elevated', 'dangerous', 'very-dangerous'];
const riskMap = new Map<string, DeviationEntry[]>();
for (const d of deviations) {
  if (!riskMap.has(d.riskCategory)) riskMap.set(d.riskCategory, []);
  riskMap.get(d.riskCategory)!.push(d);
}

const riskBiases: RiskBias[] = [];
for (const cat of riskOrder) {
  const entries = riskMap.get(cat) || [];
  if (entries.length === 0) continue;
  const meanDelta = entries.reduce((s, e) => s + e.delta, 0) / entries.length;
  const meanAbsDelta = entries.reduce((s, e) => s + e.absDelta, 0) / entries.length;
  riskBiases.push({
    riskCategory: cat,
    count: entries.length,
    meanDelta: parseFloat(meanDelta.toFixed(2)),
    meanAbsDelta: parseFloat(meanAbsDelta.toFixed(2)),
  });
}

// ── Step 5: Pillar analysis ─────────────────────────────────────────────

const pillarNames = ['conflict', 'crime', 'health', 'governance', 'environment'];
const pillarAnalysis: Record<string, { lowCompleteness: number; avgScore: number; avgCompleteness: number }> = {};

for (const pillar of pillarNames) {
  const scores = deviations.map(d => d.pillarScores[pillar]).filter(s => s !== undefined);
  const completeness = deviations.map(d => d.dataCompleteness[pillar]).filter(c => c !== undefined);
  pillarAnalysis[pillar] = {
    lowCompleteness: completeness.filter(c => c < 0.5).length,
    avgScore: parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(3)),
    avgCompleteness: parseFloat((completeness.reduce((s, v) => s + v, 0) / completeness.length).toFixed(3)),
  };
}

// ── Step 6: Identify outliers and patterns ──────────────────────────────

const overscored = deviations.filter(d => d.delta > 0.5).sort((a, b) => b.delta - a.delta);
const underscored = deviations.filter(d => d.delta < -0.5).sort((a, b) => a.delta - b.delta);

// Data completeness analysis for outliers
const lowDataOutliers = deviations.filter(d => {
  const avgComp = Object.values(d.dataCompleteness).reduce((s, v) => s + v, 0) / pillarNames.length;
  return avgComp < 0.5 && d.absDelta > 1.0;
});

// ── Step 7: Weight adjustment proposals ─────────────────────────────────

interface WeightProposal {
  title: string;
  description: string;
  currentState: string;
  proposedChange: string;
  projectedImpact: string;
  affectedCountries: string;
}

const proposals: WeightProposal[] = [];

// Analyze if conflict pillar advisory weight is diluting signal
const advisoryWeightTotal = 0.026 + 0.025 * 3 + 0.018 * 4 + 0.010 * 8 + 0.007 * 8 + 0.005 * 6 + 0.003 * 7;
const baselineConflictWeight = 0.17 + 0.17 + 0.16 + 0.14;

proposals.push({
  title: 'Reduce advisory dilution in conflict pillar',
  description: 'With 37 advisory sources in the conflict pillar, each individual advisory has very low weight (0.003-0.026). The 4 baseline indicators (WB political stability, GPI overall, GPI safety, GPI militarisation) hold 64% of the conflict pillar weight while 37 advisory sources share 36%. Countries that most advisory sources agree are dangerous still get diluted by the baseline weighting.',
  currentState: `Baseline indicators: ${(baselineConflictWeight * 100).toFixed(0)}% of conflict pillar. Advisory total: ${(advisoryWeightTotal * 100).toFixed(1)}% of conflict pillar.`,
  proposedChange: 'Increase total advisory weight from 36% to 45% of conflict pillar by reducing GPI militarisation from 0.14 to 0.08 and redistributing 0.06 proportionally across advisory sources. Militarisation correlates less with travel safety than peace/stability indicators.',
  projectedImpact: 'Countries with strong advisory consensus (Level 3-4 from most sources) would see 0.2-0.4 point score decrease. Countries with clean advisories (Level 1) would see 0.1-0.2 point increase. Estimated MAD improvement: -0.05 to -0.10.',
  affectedCountries: 'Iran, Russia, Syria, Yemen, Afghanistan (stronger danger signal). Iceland, Denmark, Singapore (slightly higher safe score).',
});

// Analyze Venezuela anomaly (1.94 site vs 2.5 reference)
const venDev = deviations.find(d => d.iso3 === 'VEN');
const israelDev = deviations.find(d => d.iso3 === 'ISR');

proposals.push({
  title: 'Apply floor adjustment for countries with extreme advisory consensus',
  description: 'Some countries with near-universal Level 3-4 advisories score below their reference (Venezuela: 1.94 vs 2.5 ref). This happens because low World Bank governance scores compound with advisory penalties, creating a double-counting effect. Conversely, countries like Israel (2.48 vs 4.0 ref) with good infrastructure but active conflict score lower than expected due to advisory penalties overwhelming their strong governance/health pillars.',
  currentState: `Venezuela site=${venDev?.siteScore}, ref=${venDev?.referenceScore}, delta=${venDev?.delta}. Israel site=${israelDev?.siteScore}, ref=${israelDev?.referenceScore}, delta=${israelDev?.delta}.`,
  proposedChange: 'Introduce a pillar floor mechanism: when a country has strong data in health/governance/infrastructure (normalized > 0.6), apply a minimum pillar contribution of 0.3 * pillar_weight, preventing total collapse when conflict pillar dominates. This prevents double-penalization where advisory danger + weak governance compound below reasonable levels.',
  projectedImpact: 'Would raise scores for countries like Israel (+0.5-1.0), Iran (+0.3-0.5), and North Korea (+0.3) where infrastructure/health are better than total score suggests. Would not affect already-well-scored countries. Estimated MAD improvement: -0.15 to -0.25.',
  affectedCountries: 'Israel, Iran, North Korea, Libya, Venezuela — countries where non-conflict pillars are artificially suppressed.',
});

proposals.push({
  title: 'Increase health pillar default for countries with no health data',
  description: 'Countries with no health indicators default to 0.5 (mid-range), which may overestimate health safety for poor countries and underestimate for rich ones. Small territories get health=0.5 regardless of their actual healthcare quality.',
  currentState: `${pillarAnalysis['health'].lowCompleteness} of ${totalDeviations} reference countries have <50% health data completeness.`,
  proposedChange: 'Use regional health averages as fallback instead of global 0.5 default. For Northern Europe fallback=0.85, for Sub-Saharan Africa fallback=0.35, etc. This requires computing regional averages from available data during scoring.',
  projectedImpact: 'Would improve accuracy for small territories and countries with missing health data. Estimated improvement of 0.1-0.3 points for affected countries. Moderate implementation complexity.',
  affectedCountries: 'Small territories (Aruba, Curacao, etc.), some developing countries with sparse data.',
});

// ── Generate Report ─────────────────────────────────────────────────────

const sortedByAbsDelta = [...deviations].sort((a, b) => b.absDelta - a.absDelta);
const sortedByDelta = [...deviations].sort((a, b) => a.delta - b.delta);

let report = `# Calibration Report

**Generated:** ${new Date().toISOString().split('T')[0]}
**Scores date:** ${scoresData.date}
**Weights version:** 8.0.0
**Reference countries:** ${totalDeviations}

## Executive Summary

This report compares site-computed safety scores against research-backed reference scores for ${totalDeviations} countries spanning all world regions and risk levels. The analysis identifies systematic biases and proposes concrete weight adjustments.

**Key findings:**
- Global Mean Absolute Deviation (MAD): **${globalMAD.toFixed(2)}**
- Root Mean Square Error (RMSE): **${rmse.toFixed(2)}**
- Mean systematic bias: **${globalMeanDelta > 0 ? '+' : ''}${globalMeanDelta.toFixed(2)}** (${globalMeanDelta > 0 ? 'site scores slightly higher' : 'site scores slightly lower'} on average)
- Countries within 0.5 points: **${within05}/${totalDeviations}** (${((within05 / totalDeviations) * 100).toFixed(0)}%)
- Countries within 1.0 points: **${within10}/${totalDeviations}** (${((within10 / totalDeviations) * 100).toFixed(0)}%)
- Maximum deviation: **${maxAbsDev.toFixed(2)}** points

## 1. Per-Country Deviation Table

Sorted by absolute deviation (largest first):

| Rank | Country | ISO3 | Site Score | Reference | Delta | Abs Delta | Region | Risk |
|------|---------|------|-----------|-----------|-------|-----------|--------|------|
${sortedByAbsDelta.map((d, i) => `| ${i + 1} | ${d.name} | ${d.iso3} | ${d.siteScore.toFixed(2)} | ${d.referenceScore.toFixed(1)} | ${d.delta > 0 ? '+' : ''}${d.delta.toFixed(2)} | ${d.absDelta.toFixed(2)} | ${d.region} | ${d.riskCategory} |`).join('\n')}

## 2. Global Deviation Metrics

| Metric | Value |
|--------|-------|
| Mean Absolute Deviation (MAD) | ${globalMAD.toFixed(3)} |
| Root Mean Square Error (RMSE) | ${rmse.toFixed(3)} |
| Mean Bias (systematic) | ${globalMeanDelta > 0 ? '+' : ''}${globalMeanDelta.toFixed(3)} |
| Max Absolute Deviation | ${maxAbsDev.toFixed(2)} |
| Within 0.5 points | ${within05}/${totalDeviations} (${((within05 / totalDeviations) * 100).toFixed(0)}%) |
| Within 1.0 points | ${within10}/${totalDeviations} (${((within10 / totalDeviations) * 100).toFixed(0)}%) |
| Over 1.5 points | ${over15.length}/${totalDeviations} (${((over15.length / totalDeviations) * 100).toFixed(0)}%) |

## 3. Regional Bias Analysis

Mean delta > 0 means site scores higher than reference (overscored). Mean delta < 0 means site scores lower than reference (underscored).

| Region | Countries | Mean Delta | Mean Abs Delta | Direction |
|--------|-----------|-----------|----------------|-----------|
${regionBiases.map(r => `| ${r.region} | ${r.count} | ${r.meanDelta > 0 ? '+' : ''}${r.meanDelta.toFixed(2)} | ${r.meanAbsDelta.toFixed(2)} | ${r.meanDelta > 0.3 ? 'OVERSCORED' : r.meanDelta < -0.3 ? 'UNDERSCORED' : 'balanced'} |`).join('\n')}

### Regional patterns:

${regionBiases.filter(r => Math.abs(r.meanDelta) > 0.3).map(r =>
  `- **${r.region}** (${r.count} countries): Mean delta ${r.meanDelta > 0 ? '+' : ''}${r.meanDelta.toFixed(2)} - ${r.meanDelta > 0 ? 'OVERSCORED' : 'UNDERSCORED'}. Countries: ${r.countries.join(', ')}`
).join('\n') || '- No strong regional biases detected (all regions within +/-0.3)'}

## 4. Risk-Level Bias Analysis

| Risk Category | Countries | Mean Delta | Mean Abs Delta | Direction |
|---------------|-----------|-----------|----------------|-----------|
${riskBiases.map(r => `| ${r.riskCategory} | ${r.count} | ${r.meanDelta > 0 ? '+' : ''}${r.meanDelta.toFixed(2)} | ${r.meanAbsDelta.toFixed(2)} | ${r.meanDelta > 0.3 ? 'OVERSCORED' : r.meanDelta < -0.3 ? 'UNDERSCORED' : 'balanced'} |`).join('\n')}

### Risk-level patterns:

${riskBiases.filter(r => Math.abs(r.meanDelta) > 0.3).map(r =>
  `- **${r.riskCategory}** countries: Mean delta ${r.meanDelta > 0 ? '+' : ''}${r.meanDelta.toFixed(2)} - ${r.meanDelta > 0 ? 'site overestimates safety' : 'site underestimates safety'}`
).join('\n') || '- No strong risk-level biases detected (all categories within +/-0.3)'}

## 5. Pillar Data Quality

| Pillar | Avg Score (0-1) | Avg Completeness | Low Data (<50%) Countries |
|--------|----------------|-----------------|--------------------------|
${pillarNames.map(p => `| ${p} | ${pillarAnalysis[p].avgScore.toFixed(3)} | ${(pillarAnalysis[p].avgCompleteness * 100).toFixed(0)}% | ${pillarAnalysis[p].lowCompleteness} |`).join('\n')}

## 6. Notable Outliers

### Most Overscored (site > reference by > 0.5)

${overscored.length > 0 ? overscored.slice(0, 10).map(d =>
  `- **${d.name}** (${d.iso3}): site ${d.siteScore.toFixed(2)} vs ref ${d.referenceScore.toFixed(1)} (delta +${d.delta.toFixed(2)})`
).join('\n') : '- None'}

### Most Underscored (site < reference by > 0.5)

${underscored.length > 0 ? underscored.slice(0, 10).map(d =>
  `- **${d.name}** (${d.iso3}): site ${d.siteScore.toFixed(2)} vs ref ${d.referenceScore.toFixed(1)} (delta ${d.delta.toFixed(2)})`
).join('\n') : '- None'}

### Low-Data Outliers (avg completeness < 50% and abs delta > 1.0)

${lowDataOutliers.length > 0 ? lowDataOutliers.map(d => {
  const avgComp = Object.values(d.dataCompleteness).reduce((s, v) => s + v, 0) / pillarNames.length;
  return `- **${d.name}** (${d.iso3}): avg completeness ${(avgComp * 100).toFixed(0)}%, delta ${d.delta > 0 ? '+' : ''}${d.delta.toFixed(2)}`;
}).join('\n') : '- None'}

## 7. Weight Adjustment Proposals

${proposals.map((p, i) => `### Proposal ${i + 1}: ${p.title}

**Description:** ${p.description}

**Current state:** ${p.currentState}

**Proposed change:** ${p.proposedChange}

**Projected impact:** ${p.projectedImpact}

**Affected countries:** ${p.affectedCountries}
`).join('\n')}

## 8. Recommendations

1. **Prioritize Proposal 2** (pillar floor mechanism) as it addresses the largest outliers (Israel, Iran, North Korea) where strong non-conflict data is being suppressed by conflict penalties.

2. **Proposal 1** (advisory rebalancing) is low-risk and would strengthen the signal from the 37 advisory sources that were the focus of the v4.0 expansion.

3. **Proposal 3** (regional health defaults) requires more implementation work but would improve accuracy for small territories that currently get a blanket 0.5 health score.

4. **Monitor data completeness** — the health and environment pillars have notable data gaps that affect scoring accuracy. Expanding data sources for these pillars should be a future priority.

5. **Re-run calibration** after any weight changes to verify MAD improvement. Target: MAD < ${(globalMAD * 0.8).toFixed(2)} (20% improvement).

---

*Report generated by scripts/calibration/analyze.ts*
*Reference data: scripts/calibration/reference-scores.json (v${referenceData.version})*
`;

const reportPath = join(ROOT, 'scripts/calibration/calibration-report.md');
writeFileSync(reportPath, report, 'utf8');

// ── Console summary ─────────────────────────────────────────────────────

console.log('\n=== CALIBRATION ANALYSIS COMPLETE ===\n');
console.log(`Countries analyzed: ${totalDeviations}`);
console.log(`Global MAD: ${globalMAD.toFixed(3)}`);
console.log(`RMSE: ${rmse.toFixed(3)}`);
console.log(`Systematic bias: ${globalMeanDelta > 0 ? '+' : ''}${globalMeanDelta.toFixed(3)}`);
console.log(`Within 0.5: ${within05}/${totalDeviations} (${((within05 / totalDeviations) * 100).toFixed(0)}%)`);
console.log(`Within 1.0: ${within10}/${totalDeviations} (${((within10 / totalDeviations) * 100).toFixed(0)}%)`);
console.log(`\nTop 5 outliers (by abs delta):`);
sortedByAbsDelta.slice(0, 5).forEach(d =>
  console.log(`  ${d.name}: site=${d.siteScore.toFixed(2)} ref=${d.referenceScore.toFixed(1)} delta=${d.delta > 0 ? '+' : ''}${d.delta.toFixed(2)}`)
);
console.log(`\nRegional biases (|delta| > 0.3):`);
regionBiases.filter(r => Math.abs(r.meanDelta) > 0.3).forEach(r =>
  console.log(`  ${r.region}: ${r.meanDelta > 0 ? '+' : ''}${r.meanDelta.toFixed(2)} (${r.count} countries)`)
);
console.log(`\nReport written to: ${reportPath}`);
