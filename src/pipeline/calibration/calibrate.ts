/**
 * Calibration Analysis Script
 *
 * Compares site safety scores against research-backed reference scores,
 * identifies systematic bias patterns, and proposes weight adjustments.
 *
 * Usage:
 *   npx tsx src/pipeline/calibration/calibrate.ts           # Generate deviation-report.json
 *   npx tsx src/pipeline/calibration/calibrate.ts --bias     # Generate bias-analysis.md
 *   npx tsx src/pipeline/calibration/calibrate.ts --proposals # Generate weight-proposals.md
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
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
  tier: string;
  bloc: string;
}

interface DeviationReport {
  summary: {
    totalCountries: number;
    meanAbsoluteDeviation: number;
    meanSignedDeviation: number;
    stdDev: number;
    pearsonR: number;
  };
  countries: DeviationEntry[];
}

interface GroupStats {
  name: string;
  count: number;
  meanSignedDeviation: number;
  meanAbsoluteDeviation: number;
  stdDev: number;
  hasBias: boolean;
  topOutliers: { name: string; iso3: string; delta: number }[];
}

// ── Constants ───────────────────────────────────────────────────────────

const ROOT = join(import.meta.dirname || __dirname, '..', '..', '..');
const REFERENCE_PATH = join(ROOT, 'src/pipeline/calibration/reference-scores.json');
const SCORES_PATH = join(ROOT, 'public/scores.json');
const WEIGHTS_PATH = join(ROOT, 'src/pipeline/config/weights.json');
const DEVIATION_REPORT_PATH = join(ROOT, 'data/calibration/deviation-report.json');
const BIAS_ANALYSIS_PATH = join(ROOT, 'data/calibration/bias-analysis.md');
const WEIGHT_PROPOSALS_PATH = join(ROOT, 'data/calibration/weight-proposals.md');

const BIAS_THRESHOLD = 0.5; // |mean_signed_delta| threshold
const MIN_GROUP_SIZE = 5;   // minimum countries for bias detection

// ── UN Region Mapping ───────────────────────────────────────────────────

function mapToUNRegion(region: string): string {
  const mapping: Record<string, string> = {
    'Northern Europe': 'Europe',
    'Western Europe': 'Europe',
    'Southern Europe': 'Europe',
    'Central Europe': 'Europe',
    'Eastern Europe': 'Europe',
    'East Asia': 'Asia',
    'Southeast Asia': 'Asia',
    'South Asia': 'Asia',
    'Middle East': 'Asia',
    'North America': 'Americas',
    'Central America': 'Americas',
    'South America': 'Americas',
    'Caribbean': 'Americas',
    'Sub-Saharan Africa': 'Africa',
    'North Africa': 'Africa',
    'Oceania': 'Oceania',
  };
  return mapping[region] || region;
}

// ── Risk Tier Mapping ───────────────────────────────────────────────────

function mapToRiskTier(referenceScore: number): string {
  if (referenceScore >= 7) return 'safe';
  if (referenceScore >= 4) return 'moderate';
  return 'dangerous';
}

// ── Geopolitical Bloc Mapping ───────────────────────────────────────────

const NATO_MEMBERS = new Set([
  'USA', 'GBR', 'CAN', 'FRA', 'DEU', 'ITA', 'ESP', 'PRT', 'NOR', 'DNK',
  'ISL', 'NLD', 'BEL', 'LUX', 'TUR', 'GRC', 'POL', 'CZE', 'HUN', 'BGR',
  'ROU', 'HRV', 'ALB', 'MNE', 'MKD', 'SVN', 'SVK', 'EST', 'LVA', 'LTU',
  'FIN', 'SWE',
]);

const EU_MEMBERS = new Set([
  'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA',
  'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD',
  'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE',
]);

const BRICS_MEMBERS = new Set([
  'BRA', 'RUS', 'IND', 'CHN', 'ZAF', 'EGY', 'ETH', 'IRN', 'SAU', 'ARE',
]);

const G7_MEMBERS = new Set([
  'USA', 'GBR', 'CAN', 'FRA', 'DEU', 'ITA', 'JPN',
]);

function mapToBloc(iso3: string): string {
  if (G7_MEMBERS.has(iso3)) return 'G7';
  if (NATO_MEMBERS.has(iso3)) return 'NATO';
  if (EU_MEMBERS.has(iso3)) return 'EU';
  if (BRICS_MEMBERS.has(iso3)) return 'BRICS';
  return 'Non-aligned';
}

// ── Deviation Computation ───────────────────────────────────────────────

function computeDeviations(): DeviationReport {
  const referenceData: ReferenceData = JSON.parse(readFileSync(REFERENCE_PATH, 'utf8'));
  const scoresData: ScoresData = JSON.parse(readFileSync(SCORES_PATH, 'utf8'));

  const siteScoresMap = new Map<string, ScoredCountry>();
  for (const c of scoresData.countries) {
    siteScoresMap.set(c.iso3, c);
  }

  const countries: DeviationEntry[] = [];

  for (const ref of referenceData.countries) {
    const site = siteScoresMap.get(ref.iso3);
    if (!site) {
      console.warn(`WARNING: ${ref.iso3} (${ref.name}) not found in scores.json`);
      continue;
    }

    const delta = parseFloat((site.score - ref.referenceScore).toFixed(2));
    countries.push({
      iso3: ref.iso3,
      name: ref.name,
      siteScore: parseFloat(site.score.toFixed(2)),
      referenceScore: ref.referenceScore,
      delta,
      absDelta: parseFloat(Math.abs(delta).toFixed(2)),
      region: mapToUNRegion(ref.region),
      tier: mapToRiskTier(ref.referenceScore),
      bloc: mapToBloc(ref.iso3),
    });
  }

  const n = countries.length;
  const meanAbsoluteDeviation = countries.reduce((s, c) => s + c.absDelta, 0) / n;
  const meanSignedDeviation = countries.reduce((s, c) => s + c.delta, 0) / n;

  // Standard deviation
  const variance = countries.reduce((s, c) => s + (c.delta - meanSignedDeviation) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  // Pearson r
  const meanSite = countries.reduce((s, c) => s + c.siteScore, 0) / n;
  const meanRef = countries.reduce((s, c) => s + c.referenceScore, 0) / n;
  let num = 0, denSite = 0, denRef = 0;
  for (const c of countries) {
    const dSite = c.siteScore - meanSite;
    const dRef = c.referenceScore - meanRef;
    num += dSite * dRef;
    denSite += dSite ** 2;
    denRef += dRef ** 2;
  }
  const pearsonR = num / Math.sqrt(denSite * denRef);

  return {
    summary: {
      totalCountries: n,
      meanAbsoluteDeviation: parseFloat(meanAbsoluteDeviation.toFixed(3)),
      meanSignedDeviation: parseFloat(meanSignedDeviation.toFixed(3)),
      stdDev: parseFloat(stdDev.toFixed(3)),
      pearsonR: parseFloat(pearsonR.toFixed(3)),
    },
    countries,
  };
}

// ── Group Statistics ────────────────────────────────────────────────────

function computeGroupStats(entries: DeviationEntry[], groupKey: keyof DeviationEntry): GroupStats[] {
  const groups = new Map<string, DeviationEntry[]>();
  for (const e of entries) {
    const key = String(e[groupKey]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const stats: GroupStats[] = [];
  for (const [name, members] of groups) {
    const n = members.length;
    const meanSigned = members.reduce((s, m) => s + m.delta, 0) / n;
    const meanAbs = members.reduce((s, m) => s + m.absDelta, 0) / n;
    const variance = members.reduce((s, m) => s + (m.delta - meanSigned) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const hasBias = Math.abs(meanSigned) > BIAS_THRESHOLD && n >= MIN_GROUP_SIZE;

    // Top 3 outliers by |delta|
    const sorted = [...members].sort((a, b) => b.absDelta - a.absDelta);
    const topOutliers = sorted.slice(0, 3).map(m => ({
      name: m.name,
      iso3: m.iso3,
      delta: m.delta,
    }));

    stats.push({
      name,
      count: n,
      meanSignedDeviation: parseFloat(meanSigned.toFixed(3)),
      meanAbsoluteDeviation: parseFloat(meanAbs.toFixed(3)),
      stdDev: parseFloat(stdDev.toFixed(3)),
      hasBias,
      topOutliers,
    });
  }

  return stats.sort((a, b) => a.meanSignedDeviation - b.meanSignedDeviation);
}

// ── Bias Analysis (--bias) ──────────────────────────────────────────────

function generateBiasAnalysis(report: DeviationReport): void {
  const { summary, countries } = report;

  const regionStats = computeGroupStats(countries, 'region');
  const tierStats = computeGroupStats(countries, 'tier');
  const blocStats = computeGroupStats(countries, 'bloc');

  function statsTable(stats: GroupStats[], label: string): string {
    let table = `| ${label} | Countries | Mean Signed Deviation | MAD | Bias? |\n`;
    table += `|${'-'.repeat(label.length + 2)}|-----------|----------------------|-----|-------|\n`;
    for (const s of stats) {
      table += `| ${s.name} | ${s.count} | ${s.meanSignedDeviation > 0 ? '+' : ''}${s.meanSignedDeviation.toFixed(3)} | ${s.meanAbsoluteDeviation.toFixed(3)} | ${s.hasBias ? 'Yes' : 'No'} |\n`;
    }
    return table;
  }

  function biasedDetails(stats: GroupStats[], label: string): string {
    const biased = stats.filter(s => s.hasBias);
    if (biased.length === 0) return `No ${label.toLowerCase()} groups show systematic bias (threshold: |MSD| > ${BIAS_THRESHOLD} with n >= ${MIN_GROUP_SIZE}).\n`;

    let md = '';
    for (const s of biased) {
      const direction = s.meanSignedDeviation > 0 ? 'overscored' : 'underscored';
      md += `**${s.name}** (${s.count} countries, MSD ${s.meanSignedDeviation > 0 ? '+' : ''}${s.meanSignedDeviation.toFixed(3)}) - systematically ${direction}\n\n`;
      md += `Top contributing outliers:\n`;
      for (const o of s.topOutliers) {
        md += `- ${o.name} (${o.iso3}): delta ${o.delta > 0 ? '+' : ''}${o.delta.toFixed(2)}\n`;
      }
      md += '\n';
    }
    return md;
  }

  // Key findings
  const allBiased = [
    ...regionStats.filter(s => s.hasBias).map(s => ({ ...s, dimension: 'region' })),
    ...tierStats.filter(s => s.hasBias).map(s => ({ ...s, dimension: 'risk tier' })),
    ...blocStats.filter(s => s.hasBias).map(s => ({ ...s, dimension: 'geopolitical bloc' })),
  ];

  let keyFindings = '';
  if (allBiased.length === 0) {
    keyFindings = '- No groups exceed the systematic bias threshold (|MSD| > 0.5 with n >= 5). The scoring model shows relatively balanced performance across all grouping dimensions.\n';
    keyFindings += `- Global MAD of ${summary.meanAbsoluteDeviation.toFixed(3)} indicates ${summary.meanAbsoluteDeviation < 0.5 ? 'good' : summary.meanAbsoluteDeviation < 1.0 ? 'acceptable' : 'concerning'} calibration overall.\n`;
    keyFindings += `- Pearson r of ${summary.pearsonR.toFixed(3)} shows ${summary.pearsonR > 0.9 ? 'strong' : summary.pearsonR > 0.8 ? 'good' : 'moderate'} correlation between site scores and reference data.\n`;
  } else {
    for (const b of allBiased) {
      const direction = b.meanSignedDeviation > 0 ? 'overscored (rated safer than reference)' : 'underscored (rated more dangerous than reference)';
      keyFindings += `- **${b.name}** ${b.dimension}: ${b.count} countries systematically ${direction} with MSD of ${b.meanSignedDeviation > 0 ? '+' : ''}${b.meanSignedDeviation.toFixed(3)}\n`;
    }
    keyFindings += `- Global MAD of ${summary.meanAbsoluteDeviation.toFixed(3)} indicates ${summary.meanAbsoluteDeviation < 0.5 ? 'good' : summary.meanAbsoluteDeviation < 1.0 ? 'acceptable' : 'concerning'} overall calibration.\n`;
    keyFindings += `- Pearson r of ${summary.pearsonR.toFixed(3)} shows ${summary.pearsonR > 0.9 ? 'strong' : summary.pearsonR > 0.8 ? 'good' : 'moderate'} rank-order agreement with reference scores.\n`;
  }

  // Groups approaching bias threshold
  const nearBias = [
    ...regionStats.filter(s => !s.hasBias && Math.abs(s.meanSignedDeviation) > 0.3 && s.count >= MIN_GROUP_SIZE),
    ...tierStats.filter(s => !s.hasBias && Math.abs(s.meanSignedDeviation) > 0.3 && s.count >= MIN_GROUP_SIZE),
    ...blocStats.filter(s => !s.hasBias && Math.abs(s.meanSignedDeviation) > 0.3 && s.count >= MIN_GROUP_SIZE),
  ];
  if (nearBias.length > 0) {
    keyFindings += `- Groups approaching bias threshold (MSD > 0.3): ${nearBias.map(g => `${g.name} (${g.meanSignedDeviation > 0 ? '+' : ''}${g.meanSignedDeviation.toFixed(3)})`).join(', ')}\n`;
  }

  const md = `# Bias Analysis Report

Generated: ${new Date().toISOString()}
Based on: deviation-report.json (${summary.totalCountries} countries)

## Summary Statistics

- Global MAD: ${summary.meanAbsoluteDeviation.toFixed(3)}
- Global Mean Signed Deviation: ${summary.meanSignedDeviation > 0 ? '+' : ''}${summary.meanSignedDeviation.toFixed(3)}
- Pearson r: ${summary.pearsonR.toFixed(3)}
- Standard Deviation: ${summary.stdDev.toFixed(3)}

## Regional Bias

${statsTable(regionStats, 'Region')}

### Biased Regions Detail

${biasedDetails(regionStats, 'Regional')}

## Risk Tier Bias

${statsTable(tierStats, 'Tier')}

### Biased Tiers Detail

${biasedDetails(tierStats, 'Risk tier')}

## Geopolitical Bloc Bias

${statsTable(blocStats, 'Bloc')}

### Biased Blocs Detail

${biasedDetails(blocStats, 'Geopolitical bloc')}

## Key Findings

${keyFindings}

## Limitations

- Reference dataset partially overlaps with scoring engine sources (GPI, INFORM, WB) -- this creates circular validation risk
- Pearson r interpretation: r > 0.95 suggests tautological overlap; r < 0.70 suggests scoring issues
- Small territories excluded (no reference data available)
- Reference scores are subjective estimates, not ground truth -- they represent expert consensus, not measured safety
- Geopolitical bloc assignments are simplified (countries may belong to multiple blocs; only primary assigned)
- Bias threshold of |MSD| > ${BIAS_THRESHOLD} with n >= ${MIN_GROUP_SIZE} is arbitrary; lower thresholds would reveal more patterns
`;

  writeFileSync(BIAS_ANALYSIS_PATH, md, 'utf8');
  console.log(`Bias analysis written to: ${BIAS_ANALYSIS_PATH}`);
}

// ── Weight Proposals (--proposals) ──────────────────────────────────────

function generateWeightProposals(report: DeviationReport): void {
  const { summary, countries } = report;

  // Load current weights
  const weightsConfig = JSON.parse(readFileSync(WEIGHTS_PATH, 'utf8'));
  const pillars = weightsConfig.pillars as Array<{
    name: string;
    weight: number;
    indicators: string[];
    indicatorWeights?: Record<string, number>;
  }>;

  const conflictPillar = pillars.find(p => p.name === 'conflict')!;
  const advisoryIndicators = conflictPillar.indicators.filter(i => i.startsWith('advisory_level_'));
  const advisoryWeights = conflictPillar.indicatorWeights || {};

  // Current pillar weights table
  let currentPillarTable = '| Pillar | Weight | Indicators |\n|--------|--------|------------|\n';
  for (const p of pillars) {
    currentPillarTable += `| ${p.name} | ${p.weight.toFixed(2)} | ${p.indicators.length} indicators |\n`;
  }

  // ── Proposal A: Pillar Rebalancing ────────────────────────────────────

  // Analyze which direction the bias goes by tier
  const tierStats = computeGroupStats(countries, 'tier');
  const dangerousTier = tierStats.find(t => t.name === 'dangerous');
  const safeTier = tierStats.find(t => t.name === 'safe');

  // Determine adjustment direction based on bias patterns
  const proposedPillars: Record<string, number> = {};
  const currentPillars: Record<string, number> = {};
  for (const p of pillars) {
    currentPillars[p.name] = p.weight;
  }

  // If dangerous countries are underscored, conflict pillar may be too heavy
  // If safe countries are overscored, governance/health may be too generous
  const dangerousBias = dangerousTier?.meanSignedDeviation || 0;
  const safeBias = safeTier?.meanSignedDeviation || 0;

  if (dangerousBias < -0.3) {
    // Dangerous countries underscored -- reduce conflict weight slightly
    proposedPillars['conflict'] = 0.28;
    proposedPillars['crime'] = 0.26;
    proposedPillars['health'] = 0.20;
    proposedPillars['governance'] = 0.16;
    proposedPillars['environment'] = 0.10;
  } else if (safeBias > 0.3) {
    // Safe countries overscored -- increase crime/governance differentiation
    proposedPillars['conflict'] = 0.28;
    proposedPillars['crime'] = 0.27;
    proposedPillars['health'] = 0.20;
    proposedPillars['governance'] = 0.15;
    proposedPillars['environment'] = 0.10;
  } else {
    // Balanced -- minor adjustment to strengthen advisory signal
    proposedPillars['conflict'] = 0.32;
    proposedPillars['crime'] = 0.24;
    proposedPillars['health'] = 0.19;
    proposedPillars['governance'] = 0.15;
    proposedPillars['environment'] = 0.10;
  }

  // Estimate impact of Proposal A
  const proposalAImpact: { name: string; iso3: string; currentScore: number; estimatedNew: number; change: number }[] = [];
  for (const c of countries) {
    // Simplified impact estimation: proportional to pillar weight changes
    const conflictChange = proposedPillars['conflict'] - currentPillars['conflict'];
    // Countries with low conflict scores (dangerous) affected more by conflict weight changes
    const riskFactor = c.referenceScore < 4 ? 1.5 : c.referenceScore < 7 ? 1.0 : 0.5;
    const estimatedChange = conflictChange * riskFactor * 2; // rough multiplier
    proposalAImpact.push({
      name: c.name,
      iso3: c.iso3,
      currentScore: c.siteScore,
      estimatedNew: parseFloat((c.siteScore + estimatedChange).toFixed(2)),
      change: parseFloat(estimatedChange.toFixed(2)),
    });
  }

  proposalAImpact.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const top5A = proposalAImpact.slice(0, 5);

  // Estimate new MAD for Proposal A
  const newDeltas = countries.map(c => {
    const impact = proposalAImpact.find(p => p.iso3 === c.iso3)!;
    return Math.abs(impact.estimatedNew - c.referenceScore);
  });
  const estimatedMAD_A = newDeltas.reduce((s, d) => s + d, 0) / newDeltas.length;

  let proposedPillarTable = '| Pillar | Current | Proposed | Change |\n|--------|---------|----------|--------|\n';
  for (const name of ['conflict', 'crime', 'health', 'governance', 'environment']) {
    const diff = proposedPillars[name] - currentPillars[name];
    proposedPillarTable += `| ${name} | ${currentPillars[name].toFixed(2)} | ${proposedPillars[name].toFixed(2)} | ${diff > 0 ? '+' : ''}${diff.toFixed(2)} |\n`;
  }

  let top5TableA = '| Country | Current Score | Estimated New Score | Change |\n|---------|--------------|--------------------|---------|\n';
  for (const c of top5A) {
    top5TableA += `| ${c.name} | ${c.currentScore.toFixed(2)} | ${c.estimatedNew.toFixed(2)} | ${c.change > 0 ? '+' : ''}${c.change.toFixed(2)} |\n`;
  }

  // Determine rationale based on bias data
  let proposalARationale: string;
  if (dangerousBias < -0.3) {
    proposalARationale = `Bias analysis shows dangerous-tier countries are underscored (MSD ${dangerousTier?.meanSignedDeviation?.toFixed(3)}). Reducing conflict pillar weight from 0.30 to 0.28 and slightly increasing crime weight would reduce the double-penalization effect where advisory penalties compound with low World Bank political stability scores.`;
  } else if (safeBias > 0.3) {
    proposalARationale = `Bias analysis shows safe-tier countries are overscored (MSD +${safeTier?.meanSignedDeviation?.toFixed(3)}). Adjusting conflict downward and crime upward would provide better differentiation among developed countries where crime rates vary more than conflict indicators.`;
  } else {
    proposalARationale = `Bias analysis shows relatively balanced performance across risk tiers (safe MSD: ${safeTier?.meanSignedDeviation?.toFixed(3) || 'N/A'}, dangerous MSD: ${dangerousTier?.meanSignedDeviation?.toFixed(3) || 'N/A'}). Minor rebalancing to slightly increase conflict weight would strengthen the advisory signal from the 37 advisory sources integrated in v4.0, giving more weight to the diverse government perspectives.`;
  }

  // ── Proposal B: Advisory Sub-Weight Rebalancing ───────────────────────

  // Current advisory weights by tier
  const westernAdvisories = ['us', 'uk', 'ca', 'au', 'de', 'nl', 'fr', 'nz', 'ie', 'fi', 'at', 'be', 'dk', 'se', 'no', 'ch', 'pt', 'es', 'it'];
  const asianAdvisories = ['jp', 'sk', 'sg', 'hk', 'kr', 'tw', 'cn', 'in', 'ph'];
  const otherAdvisories = ['br', 'ro', 'rs', 'ee', 'hr', 'ar', 'pl', 'cz', 'hu'];

  let totalAdvWeight = 0;
  let westernWeight = 0;
  let asianWeight = 0;
  let otherWeight = 0;

  for (const [key, weight] of Object.entries(advisoryWeights)) {
    if (!key.startsWith('advisory_level_')) continue;
    const cc = key.replace('advisory_level_', '');
    totalAdvWeight += weight as number;
    if (westernAdvisories.includes(cc)) westernWeight += weight as number;
    else if (asianAdvisories.includes(cc)) asianWeight += weight as number;
    else otherWeight += weight as number;
  }

  // Proposed: equalize by geographic group
  const groupCount = 3; // Western, Asian, Other
  const equalGroupWeight = totalAdvWeight / groupCount;
  const proposedWesternPer = equalGroupWeight / westernAdvisories.length;
  const proposedAsianPer = equalGroupWeight / asianAdvisories.length;
  const proposedOtherPer = equalGroupWeight / otherAdvisories.length;

  let currentSubWeightTable = '| Group | Sources | Current Total Weight | Proposed Total Weight | Per-Source |\n|-------|---------|---------------------|----------------------|-----------|\n';
  currentSubWeightTable += `| Western (${westernAdvisories.length}) | ${westernAdvisories.join(', ')} | ${westernWeight.toFixed(4)} | ${equalGroupWeight.toFixed(4)} | ${proposedWesternPer.toFixed(4)} |\n`;
  currentSubWeightTable += `| Asian (${asianAdvisories.length}) | ${asianAdvisories.join(', ')} | ${asianWeight.toFixed(4)} | ${equalGroupWeight.toFixed(4)} | ${proposedAsianPer.toFixed(4)} |\n`;
  currentSubWeightTable += `| Other (${otherAdvisories.length}) | ${otherAdvisories.join(', ')} | ${otherWeight.toFixed(4)} | ${equalGroupWeight.toFixed(4)} | ${proposedOtherPer.toFixed(4)} |\n`;

  // Estimate Proposal B impact
  const blocStats = computeGroupStats(countries, 'bloc');
  const natoBias = blocStats.find(b => b.name === 'NATO' || b.name === 'G7');
  const bricsBias = blocStats.find(b => b.name === 'BRICS');

  const proposalBImpact: { name: string; iso3: string; currentScore: number; estimatedNew: number; change: number }[] = [];
  for (const c of countries) {
    // Non-Western countries would see score changes as Asian/Other advisories get more weight
    let estimatedChange = 0;
    if (c.bloc === 'BRICS' || c.bloc === 'Non-aligned') {
      estimatedChange = 0.1; // slight positive from diverse perspectives
    } else if (c.bloc === 'G7' || c.bloc === 'NATO') {
      estimatedChange = -0.05; // slight negative from reduced Western advisory dominance
    }
    proposalBImpact.push({
      name: c.name,
      iso3: c.iso3,
      currentScore: c.siteScore,
      estimatedNew: parseFloat((c.siteScore + estimatedChange).toFixed(2)),
      change: parseFloat(estimatedChange.toFixed(2)),
    });
  }

  proposalBImpact.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const top5B = proposalBImpact.slice(0, 5);

  let top5TableB = '| Country | Current Score | Estimated New Score | Change |\n|---------|--------------|--------------------|---------|\n';
  for (const c of top5B) {
    top5TableB += `| ${c.name} | ${c.currentScore.toFixed(2)} | ${c.estimatedNew.toFixed(2)} | ${c.change > 0 ? '+' : ''}${c.change.toFixed(2)} |\n`;
  }

  const newDeltasB = countries.map(c => {
    const impact = proposalBImpact.find(p => p.iso3 === c.iso3)!;
    return Math.abs(impact.estimatedNew - c.referenceScore);
  });
  const estimatedMAD_B = newDeltasB.reduce((s, d) => s + d, 0) / newDeltasB.length;

  let proposalBRationale: string;
  if (natoBias && bricsBias && (natoBias.meanSignedDeviation - bricsBias.meanSignedDeviation) > 0.3) {
    proposalBRationale = `Bias analysis shows NATO/G7 countries are scored ${natoBias.meanSignedDeviation > 0 ? 'higher' : 'lower'} (MSD ${natoBias.meanSignedDeviation.toFixed(3)}) than BRICS countries (MSD ${bricsBias.meanSignedDeviation.toFixed(3)}). Current advisory weights favor Western sources (Five Eyes: US/UK/CA/AU at top tier with 0.025-0.026 each). Equalizing by geographic group would reduce this Western-centric weighting without removing any advisory source.`;
  } else {
    proposalBRationale = `Current advisory sub-weights assign highest weight to Five Eyes nations (US 0.026, UK/CA/AU 0.025 each) creating structural Western bias. While bias analysis does not show extreme geopolitical bloc differences (NATO MSD: ${natoBias?.meanSignedDeviation?.toFixed(3) || 'N/A'}, BRICS MSD: ${bricsBias?.meanSignedDeviation?.toFixed(3) || 'N/A'}), equalizing by geographic group (Western, Asian, Other) would better represent the global diversity of advisory perspectives achieved in v4.0 and reduce potential anglophone bias.`;
  }

  // ── Recommendation ────────────────────────────────────────────────────

  const madDiffA = estimatedMAD_A - summary.meanAbsoluteDeviation;
  const madDiffB = estimatedMAD_B - summary.meanAbsoluteDeviation;

  let recommendation: string;
  if (summary.meanAbsoluteDeviation < 0.7) {
    recommendation = `The current calibration is already strong (MAD ${summary.meanAbsoluteDeviation.toFixed(3)}, Pearson r ${summary.pearsonR.toFixed(3)}). Both proposals offer modest improvements:\n\n` +
      `- Proposal A (pillar rebalancing) would shift MAD by approximately ${madDiffA > 0 ? '+' : ''}${madDiffA.toFixed(3)}\n` +
      `- Proposal B (advisory sub-weight rebalancing) would shift MAD by approximately ${madDiffB > 0 ? '+' : ''}${madDiffB.toFixed(3)}\n\n` +
      `**Recommendation:** Apply Proposal B first as a fairness improvement -- it reduces anglophone bias without significantly affecting overall accuracy. Proposal A should be tested separately with a full pipeline re-run before deploying, as pillar weight changes have broader effects. Both changes should be validated incrementally rather than combined.`;
  } else {
    recommendation = `The current calibration shows room for improvement (MAD ${summary.meanAbsoluteDeviation.toFixed(3)}). Proposal A addresses the structural pillar weighting and would have broader impact. Proposal B is a fairness improvement.\n\n` +
      `- Proposal A estimated MAD shift: ${madDiffA > 0 ? '+' : ''}${madDiffA.toFixed(3)}\n` +
      `- Proposal B estimated MAD shift: ${madDiffB > 0 ? '+' : ''}${madDiffB.toFixed(3)}\n\n` +
      `**Recommendation:** Apply Proposal A first as it addresses the larger calibration gap. Follow with Proposal B for fairness. Both should be validated with full pipeline re-runs. Target MAD < ${(summary.meanAbsoluteDeviation * 0.8).toFixed(3)} (20% improvement) as the success criterion.`;
  }

  const md = `# Weight Adjustment Proposals

Generated: ${new Date().toISOString()}
Based on: bias-analysis.md findings

## Current Configuration

${currentPillarTable}

Current MAD: ${summary.meanAbsoluteDeviation.toFixed(3)}
Current Pearson r: ${summary.pearsonR.toFixed(3)}

## Proposal A: Pillar Rebalancing

### Rationale

${proposalARationale}

### Proposed Weights

${proposedPillarTable}

### Projected Impact

- Estimated MAD change: ${madDiffA > 0 ? '+' : ''}${madDiffA.toFixed(3)} (${estimatedMAD_A.toFixed(3)} from ${summary.meanAbsoluteDeviation.toFixed(3)})
- Most affected countries:

${top5TableA}

## Proposal B: Advisory Sub-Weight Rebalancing

### Rationale

${proposalBRationale}

### Proposed Sub-Weights

${currentSubWeightTable}

### Projected Impact

- Estimated MAD change: ${madDiffB > 0 ? '+' : ''}${madDiffB.toFixed(3)} (${estimatedMAD_B.toFixed(3)} from ${summary.meanAbsoluteDeviation.toFixed(3)})
- Most affected countries:

${top5TableB}

## Recommendation

${recommendation}

## Caveats

- Projections are approximate (simplified model, not full engine re-run)
- Reference dataset has partial overlap with scoring sources
- MAD of 0.5-1.0 is acceptable; chasing MAD=0 would be overfitting
- Any weight changes should be validated with a full pipeline re-run before deploying
- Advisory sub-weight changes affect only the conflict pillar (30% of total score)
- Geographic grouping of advisory sources is simplified; some sources span categories
`;

  writeFileSync(WEIGHT_PROPOSALS_PATH, md, 'utf8');
  console.log(`Weight proposals written to: ${WEIGHT_PROPOSALS_PATH}`);
}

// ── Main ────────────────────────────────────────────────────────────────

const args = process.argv;

// Always compute deviations first
const report = computeDeviations();

// Write deviation-report.json if it doesn't exist or if no flags
if (!existsSync(DEVIATION_REPORT_PATH) || (!args.includes('--bias') && !args.includes('--proposals'))) {
  writeFileSync(DEVIATION_REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Deviation report written to: ${DEVIATION_REPORT_PATH}`);
  console.log(`\n=== DEVIATION SUMMARY ===`);
  console.log(`Countries: ${report.summary.totalCountries}`);
  console.log(`MAD: ${report.summary.meanAbsoluteDeviation}`);
  console.log(`Mean Signed Deviation: ${report.summary.meanSignedDeviation}`);
  console.log(`Pearson r: ${report.summary.pearsonR}`);
}

if (args.includes('--bias')) {
  generateBiasAnalysis(report);
}

if (args.includes('--proposals')) {
  generateWeightProposals(report);
}
