/**
 * Formula v10 scale-continuity calibration (SPEC §3).
 *
 * Changing the indicator set moved the whole score distribution for no real-world
 * reason. v10 therefore maps the raw data score through a frozen affine map,
 *
 *   S_data = clamp(alpha + beta * S_raw, 1, 10)
 *   beta   = SD_v91 / SD_v10raw,   alpha = mean_v91 - beta * mean_v10raw
 *
 * computed ONCE on raw date 2026-10-14 over the countries scored by both (v10 status
 * 'scored'; v9.1 scored every country), then frozen in weights.json
 * formulaV9.calibration. It is never refitted: this script only recomputes the values
 * from the frozen fixture and reports whether weights.json still matches them.
 *
 * Reads scripts/fixtures/v10/ only; writes nothing.
 *
 * Usage: npx tsx scripts/calibrate-v10.ts
 */
import { computeAllScores } from '../src/pipeline/scoring/engine.js';
import {
  FIXTURE_DATE,
  FIXTURE_RAW_DIR,
  bandOf,
  loadRawFolder,
  mean,
  readV91Reference,
  readWeights,
  sd,
  withoutCalibration,
} from './lib/v10-fixture.js';

/** Rounding used for the frozen constants (well below the 0.01 display resolution). */
const FROZEN_DECIMALS = 6;

function round(x: number, decimals = FROZEN_DECIMALS): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}

function main(): void {
  const weights = readWeights();
  const raw = loadRawFolder(FIXTURE_RAW_DIR, FIXTURE_DATE);
  const reference = readV91Reference();

  // S_raw = the v10 data score with calibration removed and no community input.
  const v10raw = computeAllScores(raw, withoutCalibration(weights), FIXTURE_DATE, { rawDir: FIXTURE_RAW_DIR, community: null });

  const pairs = v10raw
    .filter((c) => c.scoreStatus === 'scored' && c.dataScore !== null && c.dataScore !== undefined && reference.countries[c.iso3])
    .map((c) => ({ iso3: c.iso3, v10raw: c.dataScore as number, v91: reference.countries[c.iso3].score }));
  const grey = v10raw.filter((c) => c.scoreStatus === 'insufficient_data').length;

  const v91 = pairs.map((p) => p.v91);
  const v10 = pairs.map((p) => p.v10raw);
  const beta = sd(v91) / sd(v10);
  const alpha = mean(v91) - beta * mean(v10);
  const frozen = { alpha: round(alpha), beta: round(beta) };

  const calibrated = pairs.map((p) => ({ ...p, v10: Math.max(1, Math.min(10, frozen.alpha + frozen.beta * p.v10raw)) }));
  const bandChangesRaw = pairs.filter((p) => bandOf(p.v10raw) !== bandOf(p.v91)).length;
  const bandChangesCal = calibrated.filter((p) => bandOf(p.v10) !== bandOf(p.v91)).length;
  const mae = mean(calibrated.map((p) => Math.abs(p.v10 - p.v91)));

  console.log(`=== Formula v10 calibration on raw date ${FIXTURE_DATE} (weights ${weights.version}) ===`);
  console.log(`Countries: ${v10raw.length} total, ${pairs.length} scored by both v9.1 and v10, ${grey} insufficient_data in v10`);
  console.log(`v9.1:     mean ${mean(v91).toFixed(4)}  SD ${sd(v91).toFixed(4)}`);
  console.log(`v10 raw:  mean ${mean(v10).toFixed(4)}  SD ${sd(v10).toFixed(4)}  min ${Math.min(...v10).toFixed(3)}  max ${Math.max(...v10).toFixed(3)}`);
  console.log(`beta  = SD_v91 / SD_v10raw            = ${beta.toFixed(10)}`);
  console.log(`alpha = mean_v91 - beta * mean_v10raw = ${alpha.toFixed(10)}`);
  console.log(`Frozen (${FROZEN_DECIMALS} decimals): ${JSON.stringify(frozen)}`);
  console.log(
    `v10 calibrated: mean ${mean(calibrated.map((p) => p.v10)).toFixed(4)}  SD ${sd(calibrated.map((p) => p.v10)).toFixed(4)}  ` +
      `MAE vs v9.1 ${mae.toFixed(4)}`,
  );
  console.log(`Band changes vs v9.1 (scored by both): ${bandChangesRaw} without calibration, ${bandChangesCal} with it`);

  const inConfig = weights.formulaV9?.calibration;
  if (!inConfig) {
    console.log('\nweights.json has no formulaV9.calibration yet. Freeze:');
    console.log(`  "calibration": { "alpha": ${frozen.alpha}, "beta": ${frozen.beta} }`);
    process.exitCode = 1;
  } else if (inConfig.alpha === frozen.alpha && inConfig.beta === frozen.beta) {
    console.log('\nweights.json formulaV9.calibration matches the recomputed values: OK');
  } else {
    console.log(`\nMISMATCH: weights.json has ${JSON.stringify(inConfig)}, the fixture gives ${JSON.stringify(frozen)}`);
    process.exitCode = 1;
  }
}

main();
