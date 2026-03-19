import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeCountryScore } from '../scoring/engine.js';
import type { RawIndicator, WeightsConfig, CountryEntry } from '../types.js';

const WEIGHTS: WeightsConfig = {
  version: '1.0.0',
  pillars: [
    { name: 'conflict', weight: 0.20, indicators: ['gpi_overall', 'acled_fatalities', 'acled_events'] },
    { name: 'crime', weight: 0.20, indicators: ['gpi_safety_security', 'advisory_level_us', 'advisory_level_uk'] },
    { name: 'health', weight: 0.20, indicators: ['inform_health', 'inform_epidemic'] },
    { name: 'governance', weight: 0.20, indicators: ['inform_governance', 'gpi_militarisation'] },
    { name: 'environment', weight: 0.20, indicators: ['inform_natural', 'inform_climate'] },
  ],
};

const COUNTRY: CountryEntry = { iso3: 'TST', iso2: 'TS', name: { en: 'Test', it: 'Test' } };

function makeIndicator(name: string, value: number): RawIndicator {
  return { countryIso3: 'TST', indicatorName: name, value, year: 2025, source: 'test' };
}

describe('DATA-02: composite score is always in 1-10 range', () => {
  it('score is 1-10 with no indicators (neutral)', () => {
    const result = computeCountryScore('TST', [], WEIGHTS, COUNTRY, {}, []);
    assert.ok(result.score >= 1.0, `Score ${result.score} should be >= 1`);
    assert.ok(result.score <= 10.0, `Score ${result.score} should be <= 10`);
    assert.ok(result.scoreDisplay >= 1, `scoreDisplay ${result.scoreDisplay} should be >= 1`);
    assert.ok(result.scoreDisplay <= 10, `scoreDisplay ${result.scoreDisplay} should be <= 10`);
  });

  it('score is 1-10 with worst-case indicators', () => {
    // All indicators at maximum danger values
    const indicators: RawIndicator[] = [
      makeIndicator('gpi_overall', 4.0),        // worst
      makeIndicator('acled_fatalities', 10000),  // worst
      makeIndicator('acled_events', 5000),       // worst
      makeIndicator('gpi_safety_security', 5.0), // worst
      makeIndicator('advisory_level_us', 4),     // worst
      makeIndicator('advisory_level_uk', 4),     // worst
      makeIndicator('inform_health', 10),        // worst
      makeIndicator('inform_epidemic', 10),      // worst
      makeIndicator('inform_governance', 10),    // worst
      makeIndicator('gpi_militarisation', 5.0),  // worst
      makeIndicator('inform_natural', 10),       // worst
      makeIndicator('inform_climate', 10),       // worst
    ];
    const result = computeCountryScore('TST', indicators, WEIGHTS, COUNTRY, {}, []);
    assert.ok(result.score >= 1.0, `Worst-case score ${result.score} should be >= 1`);
    assert.ok(result.score <= 10.0, `Worst-case score ${result.score} should be <= 10`);
  });

  it('score is 1-10 with best-case indicators', () => {
    // All indicators at maximum safety values
    const indicators: RawIndicator[] = [
      makeIndicator('gpi_overall', 1.0),        // best
      makeIndicator('acled_fatalities', 0),      // best
      makeIndicator('acled_events', 0),          // best
      makeIndicator('gpi_safety_security', 1.0), // best
      makeIndicator('advisory_level_us', 1),     // best
      makeIndicator('advisory_level_uk', 0),     // best
      makeIndicator('inform_health', 0),         // best
      makeIndicator('inform_epidemic', 0),       // best
      makeIndicator('inform_governance', 0),     // best
      makeIndicator('gpi_militarisation', 1.0),  // best
      makeIndicator('inform_natural', 0),        // best
      makeIndicator('inform_climate', 0),        // best
    ];
    const result = computeCountryScore('TST', indicators, WEIGHTS, COUNTRY, {}, []);
    assert.ok(result.score >= 1.0, `Best-case score ${result.score} should be >= 1`);
    assert.ok(result.score <= 10.0, `Best-case score ${result.score} should be <= 10`);
  });

  it('best-case scores higher than worst-case', () => {
    const bestIndicators: RawIndicator[] = [
      makeIndicator('gpi_overall', 1.0),
      makeIndicator('inform_health', 0),
    ];
    const worstIndicators: RawIndicator[] = [
      makeIndicator('gpi_overall', 4.0),
      makeIndicator('inform_health', 10),
    ];
    const best = computeCountryScore('TST', bestIndicators, WEIGHTS, COUNTRY, {}, []);
    const worst = computeCountryScore('TST', worstIndicators, WEIGHTS, COUNTRY, {}, []);
    assert.ok(best.score > worst.score, `Safe country (${best.score}) should score higher than dangerous (${worst.score})`);
  });
});

describe('DATA-03: every scored country has all 5 category sub-scores', () => {
  it('5 pillars present even with no data', () => {
    const result = computeCountryScore('TST', [], WEIGHTS, COUNTRY, {}, []);
    assert.equal(result.pillars.length, 5);
    const names = result.pillars.map((p) => p.name).sort();
    assert.deepEqual(names, ['conflict', 'crime', 'environment', 'governance', 'health']);
  });

  it('each pillar has score in 0-1 range', () => {
    const indicators: RawIndicator[] = [
      makeIndicator('gpi_overall', 2.5),
      makeIndicator('inform_health', 5),
    ];
    const result = computeCountryScore('TST', indicators, WEIGHTS, COUNTRY, {}, []);
    for (const pillar of result.pillars) {
      assert.ok(pillar.score >= 0 && pillar.score <= 1, `Pillar ${pillar.name} score ${pillar.score} should be in 0-1`);
      assert.ok(pillar.dataCompleteness >= 0 && pillar.dataCompleteness <= 1, `Pillar ${pillar.name} completeness should be in 0-1`);
    }
  });
});
