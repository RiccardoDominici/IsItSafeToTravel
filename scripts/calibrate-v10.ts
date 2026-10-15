/**
 * Formula v10 per-pillar scale continuity (SPEC §3).
 *
 * Pillar weights only mean something relative to pillar scales: swapping the indicators
 * inside a pillar changes its mean and spread, and so silently changes how much that
 * pillar moves the score. v10 therefore maps the final (shrunk) value of each pillar
 * whose indicator set changed back onto its v9.1 scale before aggregation:
 *
 *   p' = clamp(alpha + beta * p, 0.001, 1)
 *   beta = SD_v91 / SD_v10,   alpha = mean_v91 - beta * mean_v10
 *
 * computed ONCE on raw date 2026-10-14 over the countries scored by both (v10 status
 * 'scored'), against the PUBLISHED v9.1 pillar values of that date, then frozen in
 * weights.json formulaV9.pillarCalibration. Mapped pillars: health, governance and
 * environment (their indicators changed). Not mapped: conflict (identical to v9.1) and
 * crime (same indicators; its shift comes only from the 5-year max-age rule turning stale
 * homicide rates into missing values, and mapping it away would undo that rule). There
 * is no global calibration of the final score.
 *
 * This script only recomputes the constants from the frozen fixture and reports whether
 * weights.json still matches them. Reads scripts/fixtures/v10/ only; writes nothing.
 *
 * Formula v10.1 keeps these maps frozen. Its options (level-3 severity, natural hazards weighed
 * by coping capacity, the UCDP tail) and the prior ceiling it removed are switched back to v10
 * here (v10Configuration), so the maps are reproduced under the configuration they were fitted
 * with; the v10.1 changes are formula changes, not scale shifts, and a refit would undo part of
 * them (e.g. the prior change would be re-centred away).
 *
 * Usage: npx tsx scripts/calibrate-v10.ts
 */
import { computeAllScores } from '../src/pipeline/scoring/engine.js';
import type { PillarName } from '../src/pipeline/types.js';
import {
  FIXTURE_DATE,
  FIXTURE_RAW_DIR,
  PILLAR_NAMES,
  bandOf,
  loadRawFolder,
  mean,
  readV91Reference,
  readWeights,
  sd,
  v10Configuration,
  withoutPillarCalibration,
} from './lib/v10-fixture.js';

/** The pillars whose indicator set changed in v10 (SPEC §2): the only ones mapped. */
const MAPPED_PILLARS: readonly PillarName[] = ['health', 'governance', 'environment'];

/** Rounding used for the frozen constants. */
const FROZEN_DECIMALS = 6;

function round(x: number, decimals = FROZEN_DECIMALS): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}

function main(): void {
  const committed = readWeights();
  // The maps were fitted under formula v10: reproduce them under that configuration.
  const weights = v10Configuration(committed);
  const reference = readV91Reference();
  const quiet = console.log;
  console.log = () => {};
  const unmapped = computeAllScores(
    loadRawFolder(FIXTURE_RAW_DIR, FIXTURE_DATE),
    withoutPillarCalibration(weights),
    FIXTURE_DATE,
    { rawDir: FIXTURE_RAW_DIR, community: null },
  );
  const mapped = computeAllScores(loadRawFolder(FIXTURE_RAW_DIR, FIXTURE_DATE), weights, FIXTURE_DATE, {
    rawDir: FIXTURE_RAW_DIR,
    community: null,
  });
  console.log = quiet;

  const scored = unmapped.filter((c) => c.scoreStatus === 'scored' && reference.countries[c.iso3]);
  console.log(`=== Formula v10 per-pillar calibration on raw date ${FIXTURE_DATE} (weights ${committed.version}, v10 configuration) ===`);
  console.log(`Countries: ${unmapped.length} total, ${scored.length} scored by both v9.1 and v10, ${unmapped.length - scored.length} insufficient_data`);
  console.log('pillar        v9.1 mean   SD     | v10 mean   SD     | mapped');

  const recomputed: Partial<Record<PillarName, { alpha: number; beta: number }>> = {};
  for (const pillar of PILLAR_NAMES) {
    const v91 = scored.map((c) => reference.countries[c.iso3].pillars[pillar]);
    const v10 = scored.map((c) => c.pillars.find((p) => p.name === pillar)!.score);
    const beta = sd(v91) / sd(v10);
    const alpha = mean(v91) - beta * mean(v10);
    const isMapped = MAPPED_PILLARS.includes(pillar);
    if (isMapped) recomputed[pillar] = { alpha: round(alpha), beta: round(beta) };
    console.log(
      `${pillar.padEnd(13)} ${mean(v91).toFixed(4)}  ${sd(v91).toFixed(4)} | ${mean(v10).toFixed(4)}  ${sd(v10).toFixed(4)} | ` +
        (isMapped ? `alpha ${round(alpha)} beta ${round(beta)}` : `no (shift ${(mean(v10) - mean(v91)).toFixed(4)})`),
    );
  }

  // Effect on the published score (with whatever is frozen in weights.json).
  const pairs = mapped
    .filter((c) => c.scoreStatus === 'scored' && c.score !== null)
    .map((c) => ({ v10: c.score as number, v91: reference.countries[c.iso3].score }));
  const bandChanges = pairs.filter((p) => bandOf(p.v10) !== bandOf(p.v91)).length;
  console.log(
    `Scores with the frozen maps: mean ${mean(pairs.map((p) => p.v10)).toFixed(4)} (v9.1 ${mean(pairs.map((p) => p.v91)).toFixed(4)}), ` +
      `${bandChanges} band changes vs v9.1`,
  );

  const frozen = weights.formulaV9?.pillarCalibration ?? {};
  const frozenKeys = Object.keys(frozen).sort();
  const expectedKeys = [...MAPPED_PILLARS].sort();
  const matches =
    JSON.stringify(frozenKeys) === JSON.stringify(expectedKeys) &&
    MAPPED_PILLARS.every((p) => frozen[p]?.alpha === recomputed[p]!.alpha && frozen[p]?.beta === recomputed[p]!.beta);
  if (matches) {
    console.log('\nweights.json formulaV9.pillarCalibration matches the recomputed values: OK');
  } else {
    console.log(`\nMISMATCH: weights.json has ${JSON.stringify(frozen)}`);
    console.log(`Recomputed from the fixture: ${JSON.stringify(recomputed)}`);
    process.exitCode = 1;
  }
}

main();
