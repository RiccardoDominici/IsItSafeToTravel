import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeAllScores } from '../../scoring/engine.js';
import type { WeightsConfig, RawSourceData, PillarName } from '../../types.js';

/**
 * Automated proof-by-construction of D-06 (display-only guarantee): sentiment
 * lives entirely outside the scoring types (see `types.ts`'s "Sentiment
 * (display-only, NOT a scoring pillar)" block and `aggregate.ts`), so
 * introducing sentiment data cannot change any country's total `score`.
 *
 * This guard fails the build if a 6th pillar is ever added to weights.json
 * or if any scored country's `pillars` array grows beyond 5 or contains a
 * pillar named 'sentiment'.
 */

const CLOSED_PILLAR_SET: ReadonlySet<PillarName> = new Set([
  'conflict',
  'crime',
  'health',
  'governance',
  'environment',
]);

describe('score-invariance guard (D-06): weights.json has exactly 5 pillars', () => {
  const weightsPath = join(process.cwd(), 'src/pipeline/config/weights.json');
  const weightsJson = JSON.parse(readFileSync(weightsPath, 'utf-8')) as WeightsConfig;

  it('has exactly 5 pillars', () => {
    assert.equal(weightsJson.pillars.length, 5, 'weights.json must declare exactly 5 pillars');
  });

  it('pillar names are exactly the closed set (no "sentiment" entry)', () => {
    const names = new Set(weightsJson.pillars.map((p) => p.name));
    assert.equal(names.size, CLOSED_PILLAR_SET.size);
    for (const name of CLOSED_PILLAR_SET) {
      assert.ok(names.has(name), `weights.json must contain the "${name}" pillar`);
    }
    for (const name of names) {
      assert.ok(CLOSED_PILLAR_SET.has(name as PillarName), `Unexpected pillar name "${name}" in weights.json`);
    }
    assert.ok(!names.has('sentiment' as PillarName), 'weights.json must NOT contain a "sentiment" pillar');
  });
});

describe('score-invariance guard (D-06): computeAllScores output', () => {
  const TEST_WEIGHTS: WeightsConfig = {
    version: '1.0.0',
    pillars: [
      { name: 'conflict', weight: 0.30, indicators: ['gpi_overall'] },
      { name: 'crime', weight: 0.25, indicators: ['gpi_safety_security'] },
      { name: 'health', weight: 0.20, indicators: ['inform_health'] },
      { name: 'governance', weight: 0.15, indicators: ['inform_governance'] },
      { name: 'environment', weight: 0.10, indicators: ['inform_natural'] },
    ],
  };

  it('every ScoredCountry has pillars.length === 5', () => {
    const rawData = new Map<string, RawSourceData>();
    rawData.set('test', {
      source: 'test',
      fetchedAt: new Date().toISOString(),
      indicators: [
        { countryIso3: 'USA', indicatorName: 'gpi_overall', value: 1.3, year: 2025, source: 'gpi' },
        { countryIso3: 'AFG', indicatorName: 'gpi_overall', value: 3.5, year: 2025, source: 'gpi' },
      ],
    });

    const results = computeAllScores(rawData, TEST_WEIGHTS);

    assert.ok(results.length > 0, 'computeAllScores must return at least one country');
    for (const country of results) {
      assert.equal(country.pillars.length, 5, `${country.iso3} must have exactly 5 pillars`);
    }
  });

  it('no PillarScore in the output has name === "sentiment"', () => {
    const rawData = new Map<string, RawSourceData>();
    rawData.set('test', {
      source: 'test',
      fetchedAt: new Date().toISOString(),
      indicators: [
        { countryIso3: 'USA', indicatorName: 'gpi_overall', value: 1.3, year: 2025, source: 'gpi' },
      ],
    });

    const results = computeAllScores(rawData, TEST_WEIGHTS);

    for (const country of results) {
      for (const pillar of country.pillars) {
        assert.notEqual(pillar.name, 'sentiment', `${country.iso3} must not have a "sentiment" pillar`);
        assert.ok(CLOSED_PILLAR_SET.has(pillar.name), `${country.iso3} pillar "${pillar.name}" must be in the closed set`);
      }
    }
  });
});
