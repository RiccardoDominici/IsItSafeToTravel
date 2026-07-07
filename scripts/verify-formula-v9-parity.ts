/**
 * Formula v9 parity gate (quick-260706-x81, SHIP-SPEC 1.4).
 *
 * Loads data/raw/2026-07-06 exactly as the pipeline/backfill does (via
 * loadRawDataForDate — including the Task 2 GPI year-selection injection
 * path), runs computeAllScores() with the committed weights.json (v9.0.0),
 * and diffs every country's score against the frozen ground-truth fixture
 * (scripts/fixtures/formula-v9-parity-2026-07-06.csv, copied verbatim from
 * the prototype-scorer.mjs run on the 2026-07-06 snapshot).
 *
 * GATE: max |delta| must be < 0.02 for all 248 countries EXCEPT deviations
 * attributable to freshness decay (a signal/baseline source whose
 * freshnessWeight() < 1.0 on this run, which the frozen prototype's
 * fresh-snapshot simplification could not have produced). Any such country is
 * printed and labelled, but does NOT fail the gate. A deviation with no
 * freshness-decayed indicator behind it is a genuine port bug and DOES fail
 * the gate (exit 1) — per SHIP-SPEC: fix the port, never the prototype/fixture.
 *
 * Usage: npx tsx scripts/verify-formula-v9-parity.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRawDataForDate } from '../src/pipeline/backfill.js';
import { computeAllScores } from '../src/pipeline/scoring/engine.js';
import { freshnessWeight } from '../src/pipeline/scoring/freshness.js';
import { readJson } from '../src/pipeline/utils/fs.js';
import type { WeightsConfig, SourcesConfig, RawSourceData } from '../src/pipeline/types.js';

const SNAPSHOT_DATE = '2026-07-06';
const GATE_THRESHOLD = 0.02;
const FIXTURE_PATH = join(process.cwd(), 'scripts/fixtures/formula-v9-parity-2026-07-06.csv');
const WEIGHTS_PATH = join(process.cwd(), 'src/pipeline/config/weights.json');
const SOURCE_TIERS_PATH = join(process.cwd(), 'src/pipeline/config/source-tiers.json');

// Indicator names that actually participate in Formula v9's precision (rho) —
// i.e. the ones computeIndicatorFreshness() in engine.ts can discount. The
// synthetic advisory-consensus indicator "A" is excluded by design (rho_A is
// computed directly from nAdv, never freshness-discounted).
const V9_PRECISION_INDICATORS = new Set([
  'gpi_overall', 'gpi_militarisation', 'gpi_safety_security',
  'wb_child_mortality', 'wb_air_pollution',
  'inform_health', 'inform_epidemic', 'inform_governance', 'inform_natural', 'inform_climate',
  'vdem_rule_of_law', 'vdem_gov_effectiveness', 'vdem_corruption_control',
  'reliefweb_active_disasters', 'gdacs_disaster_alerts',
]);

// --- Minimal RFC4180-ish CSV parser (mirrors prototype-scorer.mjs parseCSV) ---
// The fixture's `name` column may contain embedded commas (e.g. "Bonaire, Sint
// Eustatius and Saba"), so a naive split(',') would misalign columns.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

interface FixtureRow {
  iso3: string;
  newScore: number;
}

function loadFixture(): FixtureRow[] {
  const text = readFileSync(FIXTURE_PATH, 'utf-8');
  const rows = parseCSV(text);
  const header = rows[0];
  const idxIso3 = header.indexOf('iso3');
  const idxNewScore = header.indexOf('new_score');
  if (idxIso3 === -1 || idxNewScore === -1) {
    throw new Error(`Fixture ${FIXTURE_PATH} is missing iso3/new_score columns`);
  }
  const out: FixtureRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length < header.length) continue; // trailing blank line
    out.push({ iso3: cols[idxIso3], newScore: parseFloat(cols[idxNewScore]) });
  }
  return out;
}

/**
 * Does this country have at least one Formula-v9-precision indicator whose
 * freshnessWeight() < 1.0 on THIS run? If so, a parity deviation for it is
 * attributable to freshness decay (the frozen prototype assumed fw=1.0
 * everywhere — an explicitly documented simplification) rather than a port bug.
 */
function classifyFreshness(
  iso3: string,
  rawDataMap: Map<string, RawSourceData>,
  sourcesConfig: SourcesConfig | undefined,
): { freshnessAttributable: boolean; details: string[] } {
  if (!sourcesConfig) return { freshnessAttributable: false, details: [] };
  const now = Date.now();
  const details: string[] = [];
  let freshnessAttributable = false;

  for (const sourceData of rawDataMap.values()) {
    const sourceConf = sourcesConfig.sources[sourceData.source];
    for (const ind of sourceData.indicators) {
      if (ind.countryIso3.toUpperCase() !== iso3) continue;
      if (!V9_PRECISION_INDICATORS.has(ind.indicatorName)) continue;
      const conf = sourcesConfig.sources[ind.source] ?? sourceConf;
      if (!conf) continue;
      const dateStr = ind.dataDate ?? ind.fetchedAt;
      if (!dateStr) continue; // no timestamp -> engine defaults fw=1.0 (not decayed)
      const ageMs = now - new Date(dateStr).getTime();
      const fw = freshnessWeight(ageMs, conf.decayHalfLifeDays, conf.maxAgeDays);
      if (fw < 0.999) {
        freshnessAttributable = true;
        details.push(`${ind.indicatorName}@${ind.source} fw=${fw.toFixed(3)}`);
      }
    }
  }

  return { freshnessAttributable, details };
}

function main(): void {
  console.log(`=== Formula v9 parity gate vs ${SNAPSHOT_DATE} ground truth ===`);

  const rawDataMap = loadRawDataForDate(SNAPSHOT_DATE);
  if (!rawDataMap) {
    console.error(`FATAL: no parsable raw data for ${SNAPSHOT_DATE}`);
    process.exit(1);
  }

  const weightsConfig = readJson<WeightsConfig>(WEIGHTS_PATH);
  if (!weightsConfig) {
    console.error(`FATAL: could not load ${WEIGHTS_PATH}`);
    process.exit(1);
  }
  if (weightsConfig.version !== '9.0.0') {
    console.error(`FATAL: expected weights.json version 9.0.0, got ${weightsConfig.version}`);
    process.exit(1);
  }

  const sourcesConfig = readJson<SourcesConfig>(SOURCE_TIERS_PATH) ?? undefined;

  const results = computeAllScores(rawDataMap, weightsConfig);
  const byIso3 = new Map(results.map((r) => [r.iso3, r]));

  const fixture = loadFixture();
  console.log(`Loaded ${fixture.length} fixture rows, scored ${results.length} countries.\n`);

  let maxDelta = 0;
  let maxDeltaIso3 = '';
  let comparedCount = 0;
  const nonFreshnessFailures: string[] = [];
  const freshnessDeviations: string[] = [];

  for (const row of fixture) {
    const got = byIso3.get(row.iso3);
    if (!got) {
      nonFreshnessFailures.push(`${row.iso3}: MISSING from computeAllScores output`);
      continue;
    }
    if (Number.isNaN(row.newScore)) continue; // defensive: skip malformed fixture rows

    const delta = Math.abs(got.score - row.newScore);
    comparedCount++;
    if (delta > maxDelta) {
      maxDelta = delta;
      maxDeltaIso3 = row.iso3;
    }

    if (delta > GATE_THRESHOLD) {
      const { freshnessAttributable, details } = classifyFreshness(row.iso3, rawDataMap, sourcesConfig);
      const line = `${row.iso3}: got=${got.score.toFixed(4)} expected=${row.newScore.toFixed(4)} delta=${delta.toFixed(4)}` +
        (details.length ? ` [${details.join(', ')}]` : '');
      if (freshnessAttributable) {
        freshnessDeviations.push(line);
      } else {
        nonFreshnessFailures.push(line);
      }
    }
  }

  console.log(`Compared: ${comparedCount}/${fixture.length} countries`);
  console.log(`Max |delta|: ${maxDelta.toFixed(4)} (${maxDeltaIso3 || 'n/a'})`);
  console.log(`Deviations > ${GATE_THRESHOLD}: ${freshnessDeviations.length + nonFreshnessFailures.length} ` +
    `(${freshnessDeviations.length} freshness-attributable, ${nonFreshnessFailures.length} non-freshness)`);

  if (freshnessDeviations.length > 0) {
    console.log('\nFreshness-attributable deviations (documented, does NOT fail the gate):');
    for (const line of freshnessDeviations) console.log(`  ${line}`);
  }

  if (nonFreshnessFailures.length > 0) {
    console.log('\nNON-FRESHNESS PARITY FAILURES (port bug — fix the engine, not the prototype/fixture):');
    for (const line of nonFreshnessFailures) console.log(`  ${line}`);
    console.log('\nPARITY GATE: FAILED');
    process.exit(1);
  }

  console.log('\nPARITY GATE: PASSED');
}

main();
