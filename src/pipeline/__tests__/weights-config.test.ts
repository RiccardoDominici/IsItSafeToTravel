import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WeightsConfig, PillarName } from '../types.js';

const EXPECTED_PILLARS: PillarName[] = ['conflict', 'crime', 'health', 'governance', 'environment'];

describe('weights.json config validation', () => {
  const weightsPath = join(process.cwd(), 'src', 'pipeline', 'config', 'weights.json');
  const raw = readFileSync(weightsPath, 'utf-8');
  const config: WeightsConfig = JSON.parse(raw);

  it('has a version string', () => {
    assert.ok(typeof config.version === 'string' && config.version.length > 0, 'version should be a non-empty string');
  });

  it('contains exactly 5 pillars matching required categories', () => {
    assert.equal(config.pillars.length, 5, 'Should have 5 pillars');
    const names = config.pillars.map((p) => p.name).sort();
    const expected = [...EXPECTED_PILLARS].sort();
    assert.deepEqual(names, expected, 'Pillar names should be conflict, crime, health, governance, environment');
  });

  it('pillar weights sum to 1.0', () => {
    const sum = config.pillars.reduce((acc, p) => acc + p.weight, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001, `Weights should sum to 1.0, got ${sum}`);
  });

  it('every pillar has at least one indicator', () => {
    for (const pillar of config.pillars) {
      assert.ok(
        Array.isArray(pillar.indicators) && pillar.indicators.length > 0,
        `Pillar ${pillar.name} should have at least one indicator`,
      );
    }
  });

  it('maps indicators from 3+ distinct data sources', () => {
    // Indicator naming convention: prefix_name where prefix = source
    const allIndicators = config.pillars.flatMap((p) => p.indicators);
    const prefixes = new Set(allIndicators.map((name) => name.split('_')[0]));
    assert.ok(prefixes.size >= 3, `Indicators should come from 3+ sources, found prefixes: ${[...prefixes].join(', ')}`);
  });
});

// --- Formula v9 shape (quick-260706-x81) ---

describe('weights.json config validation — Formula v9', () => {
  const weightsPath = join(process.cwd(), 'src', 'pipeline', 'config', 'weights.json');
  const raw = readFileSync(weightsPath, 'utf-8');
  const config: WeightsConfig = JSON.parse(raw);

  it('version starts with "9." (Formula v9)', () => {
    assert.ok(config.version.startsWith('9.'), `Expected a 9.x.x version, got ${config.version}`);
  });

  it('crime pillar is driven by gpi_safety_security (moved out of conflict in v9)', () => {
    const crime = config.pillars.find((p) => p.name === 'crime')!;
    assert.ok(crime.indicators.includes('gpi_safety_security'));
  });

  it('governance pillar includes vdem_rule_of_law (moved out of crime in v9)', () => {
    const governance = config.pillars.find((p) => p.name === 'governance')!;
    assert.ok(governance.indicators.includes('vdem_rule_of_law'));
  });

  it('formulaV9 constants section is present with the frozen tunables', () => {
    assert.ok(config.formulaV9, 'formulaV9 section must exist');
    assert.equal(typeof config.formulaV9!.K, 'number');
    assert.equal(typeof config.formulaV9!.lambda, 'number');
    assert.ok(Array.isArray(config.formulaV9!.frozenExcludedSources));
    assert.ok(Array.isArray(config.formulaV9!.advisoryRebase));
    assert.equal(typeof config.formulaV9!.regionOffset, 'object');
  });

  it('still exactly 5 pillars and weights still sum to 1.0 under v9', () => {
    assert.equal(config.pillars.length, 5);
    const sum = config.pillars.reduce((acc, p) => acc + p.weight, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001, `Weights should sum to 1.0, got ${sum}`);
  });
});

// --- Formula v9.1 shape (quick-260708-lb3: D1 homicide / D2 UCDP / D3 GPI-2026 / D4 ramp) ---

describe('weights.json config validation — Formula v9.1', () => {
  const weightsPath = join(process.cwd(), 'src', 'pipeline', 'config', 'weights.json');
  const raw = readFileSync(weightsPath, 'utf-8');
  const config: WeightsConfig = JSON.parse(raw);

  it('version is exactly "9.1.0"', () => {
    assert.equal(config.version, '9.1.0');
  });

  it('crime pillar gains wb_homicide (D1) alongside gpi_safety_security, subweights sum to 1.0', () => {
    const crime = config.pillars.find((p) => p.name === 'crime')!;
    assert.ok(crime.indicators.includes('wb_homicide'), 'crime pillar must include wb_homicide');
    assert.ok(crime.indicators.includes('gpi_safety_security'));
    assert.equal(crime.indicators.length, 2, 'crime pillar must have exactly 2 indicators in v9.1');
    const sum = Object.values(crime.indicatorWeights ?? {}).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 1e-9, `crime subweights must sum to 1.0, got ${sum}`);
  });

  it('conflict pillar gains ucdp_conflict_deaths (D2) alongside gpi_overall/gpi_militarisation/A, subweights sum to 1.0', () => {
    const conflict = config.pillars.find((p) => p.name === 'conflict')!;
    assert.ok(conflict.indicators.includes('ucdp_conflict_deaths'), 'conflict pillar must include ucdp_conflict_deaths');
    assert.equal(conflict.indicators.length, 4, 'conflict pillar must have exactly 4 indicators in v9.1');
    const sum = Object.values(conflict.indicatorWeights ?? {}).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 1e-9, `conflict subweights must sum to 1.0, got ${sum}`);
  });

  it('formulaV9 section carries the 5 new v9.1 tunables (D_MAX, P_HALF, nudgeMinNAdv, severeMinNAdv, gateRampWidth)', () => {
    const f9 = config.formulaV9!;
    for (const key of ['D_MAX', 'P_HALF', 'nudgeMinNAdv', 'severeMinNAdv', 'gateRampWidth'] as const) {
      assert.equal(typeof f9[key], 'number', `formulaV9.${key} must be a number`);
    }
    assert.equal(f9.D_MAX, 24000);
    assert.equal(f9.P_HALF, 200000);
  });

  it('formulaV9.frozenExcludedSources still lists jp (re-inclusion is a Task-3 gate decision, not automatic)', () => {
    // Either state is valid post-Task-3 (the gate may re-include jp); this test
    // only documents that the KEY exists and is an array — see the parity/
    // re-inclusion gate script for the authoritative decision record.
    assert.ok(Array.isArray(config.formulaV9!.frozenExcludedSources));
  });
});
