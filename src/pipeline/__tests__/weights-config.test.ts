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
