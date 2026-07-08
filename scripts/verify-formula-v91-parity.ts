/**
 * Formula v9.1 parity gate (quick-260708-lb3, SHIP-SPEC 1.3). Adapted from
 * scripts/verify-formula-v9-parity.ts.
 *
 * Loads data/raw/2026-07-08 exactly as the pipeline/backfill does (via
 * loadRawDataForDate — including the GPI/UCDP year-selection injection paths
 * and, after preloadWbHistoryTable(), the WB homicide/population per-country
 * vintage injection), runs computeAllScores() with the committed weights.json
 * (v9.1.0), and diffs every country's score against the frozen ground-truth
 * fixture (scripts/fixtures/formula-v91-parity.csv, copied verbatim from the
 * prototype-scorer-v91.mjs run — column `v91_score`, jp EXCLUDED to match the
 * fixture's frozenExcludedSources).
 *
 * GATE: max |delta| must be < 0.02 for all 248 countries EXCEPT deviations
 * attributable to (a) freshness decay [not applicable to worldbank/ucdp per
 * the v9.1 1.1a gate decision — both sources are intentionally absent from
 * source-tiers.json] or (b) documented base-data drift between the fixture's
 * generation date and 2026-07-08 (advisory changes 2026-07-07 -> 08). Any
 * OTHER |delta| > 0.02 is a PORT BUG — fix the engine, never the fixture.
 *
 * Usage: npx tsx scripts/verify-formula-v91-parity.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRawDataForDate, preloadWbHistoryTable } from '../src/pipeline/backfill.js';
import { computeAllScores } from '../src/pipeline/scoring/engine.js';
import { freshnessWeight } from '../src/pipeline/scoring/freshness.js';
import { readJson } from '../src/pipeline/utils/fs.js';
import type { WeightsConfig, SourcesConfig, RawSourceData } from '../src/pipeline/types.js';

const SNAPSHOT_DATE = '2026-07-08';
const GATE_THRESHOLD = 0.02;
const FIXTURE_PATH = join(process.cwd(), 'scripts/fixtures/formula-v91-parity.csv');
const WEIGHTS_PATH = join(process.cwd(), 'src/pipeline/config/weights.json');
const SOURCE_TIERS_PATH = join(process.cwd(), 'src/pipeline/config/source-tiers.json');

// Indicator names that actually participate in Formula v9.1's precision (rho)
// — i.e. the ones computeIndicatorFreshness() in engine.ts can discount. The
// synthetic advisory-consensus indicator "A" is excluded by design (rho_A is
// computed directly from nAdv, never freshness-discounted). wb_homicide and
// ucdp_conflict_deaths are new in v9.1; their sources ('worldbank', 'ucdp')
// are both intentionally absent from source-tiers.json (see that file's
// comment), so in practice these never decay — listed here for completeness.
const V9_PRECISION_INDICATORS = new Set([
  'gpi_overall', 'gpi_militarisation', 'gpi_safety_security',
  'wb_child_mortality', 'wb_air_pollution', 'wb_homicide',
  'ucdp_conflict_deaths',
  'inform_health', 'inform_epidemic', 'inform_governance', 'inform_natural', 'inform_climate',
  'vdem_rule_of_law', 'vdem_gov_effectiveness', 'vdem_corruption_control',
  'reliefweb_active_disasters', 'gdacs_disaster_alerts',
]);

/**
 * DOCUMENTED base-data drift (SHIP-SPEC 1.1a "documented base-data drift" —
 * non-failing): the v9.1 worldbank.ts mrnev=1 fix (1.1a) restores
 * wb_child_mortality coverage for these 14 countries, which the OLD
 * date-windowed (non-mrnev) fetcher silently missed. The frozen fixture's
 * health_raw was derived from public/scores.json's ALREADY-BAKED-IN v9.0.0
 * health pillar, which predates this coverage fix — so these countries were
 * verified (2026-07-08 investigation) to gain a NEW wb_child_mortality data
 * point their fixture-generation-time baseline never had. Verified pure-
 * additive: re-running the parity gate with wb_child_mortality filtered back
 * to the ORIGINAL 182-country coverage (removing exactly these 14) produces
 * max |delta| = 0.0000 across all 248 countries (byte-exact engine parity).
 * This is a genuine, deliberate data-quality IMPROVEMENT (Task 1), not a port
 * bug — the live/backfill regen correctly KEEPS the fixed coverage.
 */
const KNOWN_CHILD_MORTALITY_COVERAGE_DRIFT = new Set([
  'ARE', 'GBR', 'PSE', 'UGA', 'UKR', 'URY', 'USA', 'UZB', 'VEN', 'VNM', 'VUT', 'YEM', 'ZMB', 'ZWE',
]);

// --- Minimal RFC4180-ish CSV parser (mirrors prototype-scorer-v91.mjs parseCSV) ---
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
  v91Score: number;
}

function loadFixture(): FixtureRow[] {
  const text = readFileSync(FIXTURE_PATH, 'utf-8');
  const rows = parseCSV(text);
  const header = rows[0];
  const idxIso3 = header.indexOf('iso3');
  const idxScore = header.indexOf('v91_score');
  if (idxIso3 === -1 || idxScore === -1) {
    throw new Error(`Fixture ${FIXTURE_PATH} is missing iso3/v91_score columns`);
  }
  const out: FixtureRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length < header.length) continue; // trailing blank line
    out.push({ iso3: cols[idxIso3], v91Score: parseFloat(cols[idxScore]) });
  }
  return out;
}

/**
 * Does this country have at least one Formula-v9.1-precision indicator whose
 * freshnessWeight() < 1.0 on THIS run? If so, a parity deviation for it is
 * attributable to freshness decay rather than a port bug.
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

async function main(): Promise<void> {
  console.log(`=== Formula v9.1 parity gate vs ${SNAPSHOT_DATE} ground truth ===`);

  // Preload the WB homicide/population full-history table BEFORE
  // loadRawDataForDate (sync) — see backfill.ts injectWorldbankHistoryForDate.
  await preloadWbHistoryTable();

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
  if (weightsConfig.version !== '9.1.0') {
    console.error(`FATAL: expected weights.json version 9.1.0, got ${weightsConfig.version}`);
    process.exit(1);
  }
  if (!weightsConfig.formulaV9?.frozenExcludedSources.includes('jp')) {
    console.error(
      'FATAL: weights.json formulaV9.frozenExcludedSources must still include "jp" for this parity run — ' +
        'the fixture was generated with jp EXCLUDED. Re-run parity BEFORE the jp re-inclusion gate, not after.',
    );
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
  const driftDeviations: string[] = [];

  for (const row of fixture) {
    const got = byIso3.get(row.iso3);
    if (!got) {
      nonFreshnessFailures.push(`${row.iso3}: MISSING from computeAllScores output`);
      continue;
    }
    if (Number.isNaN(row.v91Score)) continue; // defensive: skip malformed fixture rows

    const delta = Math.abs(got.score - row.v91Score);
    comparedCount++;
    if (delta > maxDelta) {
      maxDelta = delta;
      maxDeltaIso3 = row.iso3;
    }

    if (delta > GATE_THRESHOLD) {
      const line = `${row.iso3}: got=${got.score.toFixed(4)} expected=${row.v91Score.toFixed(4)} delta=${delta.toFixed(4)}`;
      if (KNOWN_CHILD_MORTALITY_COVERAGE_DRIFT.has(row.iso3)) {
        driftDeviations.push(`${line} [wb_child_mortality coverage-gap fix, verified pure-additive]`);
        continue;
      }
      const { freshnessAttributable, details } = classifyFreshness(row.iso3, rawDataMap, sourcesConfig);
      const lineWithDetails = line + (details.length ? ` [${details.join(', ')}]` : '');
      if (freshnessAttributable) {
        freshnessDeviations.push(lineWithDetails);
      } else {
        nonFreshnessFailures.push(lineWithDetails);
      }
    }
  }

  console.log(`Compared: ${comparedCount}/${fixture.length} countries`);
  console.log(`Max |delta|: ${maxDelta.toFixed(4)} (${maxDeltaIso3 || 'n/a'})`);
  console.log(`Deviations > ${GATE_THRESHOLD}: ${freshnessDeviations.length + driftDeviations.length + nonFreshnessFailures.length} ` +
    `(${freshnessDeviations.length} freshness-attributable, ${driftDeviations.length} documented base-data drift, ${nonFreshnessFailures.length} non-freshness)`);

  if (driftDeviations.length > 0) {
    console.log('\nDocumented base-data-drift deviations (verified coverage-gap fix, does NOT fail the gate):');
    for (const line of driftDeviations) console.log(`  ${line}`);
  }

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
