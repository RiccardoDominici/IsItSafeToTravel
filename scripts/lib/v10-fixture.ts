/**
 * Formula v10 frozen fixture (SPEC §3 and §6): shared paths and loader for
 * scripts/build-v10-fixture.ts, scripts/calibrate-v10.ts and
 * scripts/verify-formula-v10-parity.ts.
 *
 * The fixture folder holds the parsed inputs of raw date 2026-10-14, the calibration
 * date, exactly as run.ts would load them on that day, with two sources replaced by the
 * v10 parsers' output: INFORM re-parsed from the stored 2026 edition, GPI re-parsed
 * (with gpi_conflict) from the GPI 2026 domain scores. Nothing here reads or writes
 * data/raw, data/scores or public/: the fixture is self-contained and read-only.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadUcdpByYear, selectUcdpIndicatorsForYear } from '../../src/pipeline/backfill.js';
import type { PillarName, RawSourceData, WeightsConfig } from '../../src/pipeline/types.js';

export const FIXTURE_DATE = '2026-10-14';
export const FIXTURE_ROOT = join(process.cwd(), 'scripts', 'fixtures', 'v10');
export const FIXTURE_RAW_DIR = join(FIXTURE_ROOT, `raw-${FIXTURE_DATE}`);
export const FIXTURE_INPUTS_DIR = join(FIXTURE_ROOT, 'inputs');
/** v9.1 published scores and pillar values of the fixture date (copied from data/scores/2026-10-14.json). */
export const V91_REFERENCE_PATH = join(FIXTURE_ROOT, `v91-scores-${FIXTURE_DATE}.json`);
export const PARITY_CSV_PATH = join(process.cwd(), 'scripts', 'fixtures', 'formula-v10-parity.csv');
export const WEIGHTS_PATH = join(process.cwd(), 'src', 'pipeline', 'config', 'weights.json');

export const PILLAR_NAMES: readonly PillarName[] = ['conflict', 'crime', 'health', 'governance', 'environment'];

export interface V91ReferenceRow {
  score: number;
  scoreDisplay: number;
  /** Number of ScoredCountry.sources entries (the v9.1 hasSufficientData input). */
  sources: number;
  /** Published (shrunk) pillar values, the per-pillar calibration target (SPEC §3). */
  pillars: Record<PillarName, number>;
}

export interface V91Reference {
  date: string;
  weightsVersion: string;
  countries: Record<string, V91ReferenceRow>;
}

/**
 * Load a raw folder the way run.ts Stage 2 does for one date: every *-parsed.json, then
 * the UCDP vintage selection (year = min(run year, latest year), as injectUcdpForDate),
 * but reading the folder given instead of data/raw/<date>.
 */
export function loadRawFolder(dir: string, date: string): Map<string, RawSourceData> {
  const map = new Map<string, RawSourceData>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('-parsed.json')).sort()) {
    const data = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as RawSourceData;
    map.set(data.source, data);
  }
  if (map.has('ucdp')) {
    const byYear = loadUcdpByYear(join(dir, 'ucdp-parsed.json'));
    const indicators = selectUcdpIndicatorsForYear(byYear, parseInt(date.slice(0, 4), 10));
    map.set('ucdp', { source: 'ucdp', fetchedAt: new Date(`${date}T00:00:00.000Z`).toISOString(), indicators });
  }
  return map;
}

export function readWeights(path: string = WEIGHTS_PATH): WeightsConfig {
  return JSON.parse(readFileSync(path, 'utf-8')) as WeightsConfig;
}

/** The weights with the frozen per-pillar maps removed: the engine then reports unmapped pillar values. */
export function withoutPillarCalibration(weights: WeightsConfig): WeightsConfig {
  const f9 = { ...weights.formulaV9! };
  delete f9.pillarCalibration;
  return { ...weights, formulaV9: f9 };
}

export function readV91Reference(path: string = V91_REFERENCE_PATH): V91Reference {
  return JSON.parse(readFileSync(path, 'utf-8')) as V91Reference;
}

/** The site's canonical band of a score (src/lib/bands.ts, on the 1-decimal display value). */
export { getBand as bandOf } from '../../src/lib/bands.js';

export function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Population standard deviation (the ratio SD_v91 / SD_v10 is the same with n - 1). */
export function sd(xs: readonly number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
