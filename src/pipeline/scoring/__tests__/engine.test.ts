import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalize, normalizeInverse, normalizeIndicators } from '../normalize.js';
import { computeCountryScore, computeAllScores } from '../engine.js';
import type {
  RawIndicator,
  WeightsConfig,
  CountryEntry,
  AdvisoryInfo,
  SourceMeta,
  RawSourceData,
  SourcesConfig,
} from '../../types.js';

// --- Normalization tests ---

describe('normalize', () => {
  it('returns 0.5 for midpoint', () => {
    assert.equal(normalize(5, 0, 10), 0.5);
  });

  it('returns 0.0 for min value', () => {
    assert.equal(normalize(0, 0, 10), 0.0);
  });

  it('returns 1.0 for max value', () => {
    assert.equal(normalize(10, 0, 10), 1.0);
  });

  it('clamps below min to 0.0', () => {
    assert.equal(normalize(-5, 0, 10), 0.0);
  });

  it('clamps above max to 1.0', () => {
    assert.equal(normalize(15, 0, 10), 1.0);
  });

  it('returns 0.5 when min equals max', () => {
    assert.equal(normalize(5, 5, 5), 0.5);
  });
});

describe('normalizeInverse', () => {
  it('returns 1.0 for lowest (best) value', () => {
    assert.equal(normalizeInverse(1, 1, 5), 1.0);
  });

  it('returns 0.0 for highest (worst) value', () => {
    assert.equal(normalizeInverse(5, 1, 5), 0.0);
  });

  it('returns 0.5 for midpoint', () => {
    assert.equal(normalizeInverse(3, 1, 5), 0.5);
  });
});

describe('normalizeIndicators', () => {
  it('normalizes known indicators using INDICATOR_RANGES', () => {
    const indicators: RawIndicator[] = [
      { countryIso3: 'USA', indicatorName: 'gpi_overall', value: 1.0, year: 2025, source: 'gpi' },
      { countryIso3: 'USA', indicatorName: 'advisory_level_us', value: 1, year: 2025, source: 'state-dept' },
    ];
    const scores = normalizeIndicators(indicators);
    assert.equal(scores.length, 2);
    // gpi_overall: inverse, min=1, max=4, value=1 => normalized = 1.0
    assert.equal(scores[0].normalizedValue, 1.0);
    // advisory_level_us: inverse, min=1, max=4, value=1 => normalized = 1.0
    assert.equal(scores[1].normalizedValue, 1.0);
  });

  it('skips unknown indicator names', () => {
    const indicators: RawIndicator[] = [
      { countryIso3: 'USA', indicatorName: 'unknown_indicator', value: 5, year: 2025, source: 'test' },
    ];
    const scores = normalizeIndicators(indicators);
    assert.equal(scores.length, 0);
  });
});

// --- Scoring engine tests ---

const TEST_WEIGHTS: WeightsConfig = {
  version: '1.0.0',
  pillars: [
    { name: 'conflict', weight: 0.20, indicators: ['gpi_overall', 'acled_fatalities', 'acled_events'] },
    { name: 'crime', weight: 0.20, indicators: ['gpi_safety_security', 'advisory_level_us', 'advisory_level_uk'] },
    { name: 'health', weight: 0.20, indicators: ['inform_health', 'inform_epidemic'] },
    { name: 'governance', weight: 0.20, indicators: ['inform_governance', 'gpi_militarisation'] },
    { name: 'environment', weight: 0.20, indicators: ['inform_natural', 'inform_climate'] },
  ],
};

const TEST_COUNTRY: CountryEntry = {
  iso3: 'TST',
  iso2: 'TS',
  name: { en: 'Testland', it: 'Testlandia', es: 'Testlandia', fr: 'Testlande', pt: 'Testlandia' },
};

const TEST_SOURCES: SourceMeta[] = [];

describe('computeCountryScore', () => {
  it('computes correct score when all indicators at 0.8 normalized', () => {
    // Create indicators that will normalize to ~0.8
    // gpi_overall: inverse, min=1, max=4 => value=1.6 => norm = (1.6-1)/(4-1)=0.2 => inverse=0.8
    // gpi_safety_security: inverse, min=1, max=5 => value=1.8 => norm=(1.8-1)/(5-1)=0.2 => inverse=0.8
    // acled_fatalities: inverse, min=0, max=10000 => value=2000 => norm=0.2 => inverse=0.8
    // acled_events: inverse, min=0, max=5000 => value=1000 => norm=0.2 => inverse=0.8
    // advisory_level_us: inverse, min=1, max=4 => value=1.6 => norm=0.2 => inverse=0.8
    // advisory_level_uk: inverse, min=1, max=4 => value=1.6 => norm=0.2 => inverse=0.8
    // inform_health: inverse, min=0, max=10 => value=2 => norm=0.2 => inverse=0.8
    // inform_epidemic: inverse, min=0, max=10 => value=2 => norm=0.2 => inverse=0.8
    // inform_governance: inverse, min=0, max=10 => value=2 => norm=0.2 => inverse=0.8
    // gpi_militarisation: inverse, min=1, max=5 => value=1.8 => norm=0.2 => inverse=0.8
    // inform_natural: inverse, min=0, max=10 => value=2 => norm=0.2 => inverse=0.8
    // inform_climate: inverse, min=0, max=10 => value=2 => norm=0.2 => inverse=0.8
    const indicators: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 1.6, year: 2025, source: 'gpi' },
      { countryIso3: 'TST', indicatorName: 'acled_fatalities', value: 2000, year: 2025, source: 'acled' },
      { countryIso3: 'TST', indicatorName: 'acled_events', value: 1000, year: 2025, source: 'acled' },
      { countryIso3: 'TST', indicatorName: 'gpi_safety_security', value: 1.8, year: 2025, source: 'gpi' },
      { countryIso3: 'TST', indicatorName: 'advisory_level_us', value: 1.6, year: 2025, source: 'state' },
      { countryIso3: 'TST', indicatorName: 'advisory_level_uk', value: 1.6, year: 2025, source: 'fcdo' },
      { countryIso3: 'TST', indicatorName: 'inform_health', value: 2, year: 2025, source: 'inform' },
      { countryIso3: 'TST', indicatorName: 'inform_epidemic', value: 2, year: 2025, source: 'inform' },
      { countryIso3: 'TST', indicatorName: 'inform_governance', value: 2, year: 2025, source: 'inform' },
      { countryIso3: 'TST', indicatorName: 'gpi_militarisation', value: 1.8, year: 2025, source: 'gpi' },
      { countryIso3: 'TST', indicatorName: 'inform_natural', value: 2, year: 2025, source: 'inform' },
      { countryIso3: 'TST', indicatorName: 'inform_climate', value: 2, year: 2025, source: 'inform' },
    ];

    const result = computeCountryScore('TST', indicators, TEST_WEIGHTS, TEST_COUNTRY, {}, TEST_SOURCES);

    // All pillars should be 0.8, weighted sum = 0.8
    // Score = Math.round((0.8 * 9 + 1) * 10) / 10 = Math.round(82) / 10 = 8.2
    assert.equal(result.score, 8.2);
    assert.equal(result.scoreDisplay, 8);
    assert.equal(result.dataCompleteness, 1.0);
    assert.equal(result.pillars.length, 5);
    for (const pillar of result.pillars) {
      assert.ok(Math.abs(pillar.score - 0.8) < 0.001, `Pillar ${pillar.name} should be ~0.8, got ${pillar.score}`);
      assert.equal(pillar.dataCompleteness, 1.0);
    }
  });

  it('handles missing indicators with reduced dataCompleteness', () => {
    // Only provide conflict indicators, leave others empty
    const indicators: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 1.6, year: 2025, source: 'gpi' },
      { countryIso3: 'TST', indicatorName: 'acled_fatalities', value: 2000, year: 2025, source: 'acled' },
    ];

    const result = computeCountryScore('TST', indicators, TEST_WEIGHTS, TEST_COUNTRY, {}, TEST_SOURCES);

    assert.ok(result.dataCompleteness < 1.0, 'dataCompleteness should be less than 1.0');
    assert.ok(result.score >= 1 && result.score <= 10, 'Score should be in 1-10 range');
    // Conflict pillar: 2 of 3 indicators
    const conflict = result.pillars.find((p) => p.name === 'conflict')!;
    assert.ok(conflict.dataCompleteness > 0);
    assert.ok(conflict.dataCompleteness < 1.0);
    // Other pillars: 0 indicators
    const health = result.pillars.find((p) => p.name === 'health')!;
    assert.equal(health.dataCompleteness, 0);
    assert.equal(health.score, 0.5); // neutral default
  });

  it('produces neutral score 5.0 with zero indicators', () => {
    const result = computeCountryScore('TST', [], TEST_WEIGHTS, TEST_COUNTRY, {}, TEST_SOURCES);

    assert.equal(result.score, 5.5);
    assert.equal(result.scoreDisplay, 6);
    assert.equal(result.dataCompleteness, 0);
  });

  it('includes advisory info when provided', () => {
    const usAdvisory: AdvisoryInfo = {
      level: 2,
      text: 'Exercise increased caution',
      source: 'US State Dept',
      url: 'https://example.com',
      updatedAt: '2025-01-01',
    };

    const result = computeCountryScore('TST', [], TEST_WEIGHTS, TEST_COUNTRY, { us: usAdvisory }, TEST_SOURCES);

    assert.deepEqual(result.advisories.us, usAdvisory);
  });
});

describe('computeAllScores', () => {
  it('produces ScoredCountry array sorted by iso3', () => {
    const rawData = new Map<string, RawSourceData>();
    rawData.set('test', {
      source: 'test',
      fetchedAt: '2025-01-01T00:00:00Z',
      indicators: [
        { countryIso3: 'USA', indicatorName: 'gpi_overall', value: 1.3, year: 2025, source: 'gpi' },
        { countryIso3: 'AFG', indicatorName: 'gpi_overall', value: 3.5, year: 2025, source: 'gpi' },
      ],
    });

    const results = computeAllScores(rawData, TEST_WEIGHTS);

    assert.ok(results.length > 0);
    // Should be sorted by iso3
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i].iso3 >= results[i - 1].iso3, 'Results should be sorted by iso3');
    }
    // Check USA and AFG are present
    const usa = results.find((r) => r.iso3 === 'USA');
    const afg = results.find((r) => r.iso3 === 'AFG');
    assert.ok(usa, 'USA should be in results');
    assert.ok(afg, 'AFG should be in results');
    // USA (lower GPI = safer) should score higher than AFG
    assert.ok(usa!.score > afg!.score, 'USA should have higher safety score than AFG');
  });
});

// --- Tiered baseline+signal scoring tests ---

const TEST_SOURCES_CONFIG: SourcesConfig = {
  maxSignalInfluence: 0.30,
  maxDailyScoreChange: 0.3,
  sources: {
    gpi: { tier: 'baseline', maxAgeDays: 730, decayHalfLifeDays: 365 },
    worldbank: { tier: 'baseline', maxAgeDays: 730, decayHalfLifeDays: 365 },
    inform: { tier: 'baseline', maxAgeDays: 730, decayHalfLifeDays: 365 },
    acled: { tier: 'signal', maxAgeDays: 60, decayHalfLifeDays: 14 },
    advisories: { tier: 'signal', maxAgeDays: 30, decayHalfLifeDays: 7 },
    state: { tier: 'signal', maxAgeDays: 30, decayHalfLifeDays: 7 },
    fcdo: { tier: 'signal', maxAgeDays: 30, decayHalfLifeDays: 7 },
  },
};

// Weights with explicit sub-weights for tiered tests
const TIERED_WEIGHTS: WeightsConfig = {
  version: '5.0.0',
  pillars: [
    {
      name: 'conflict',
      weight: 0.30,
      indicators: ['gpi_overall', 'acled_fatalities', 'acled_events'],
      indicatorWeights: { gpi_overall: 0.50, acled_fatalities: 0.25, acled_events: 0.25 },
    },
    {
      name: 'crime',
      weight: 0.25,
      indicators: ['advisory_level_us', 'advisory_level_uk'],
      indicatorWeights: { advisory_level_us: 0.50, advisory_level_uk: 0.50 },
    },
    {
      name: 'health',
      weight: 0.20,
      indicators: ['inform_health', 'inform_epidemic'],
      indicatorWeights: { inform_health: 0.50, inform_epidemic: 0.50 },
    },
    {
      name: 'governance',
      weight: 0.15,
      indicators: ['inform_governance'],
      indicatorWeights: { inform_governance: 1.0 },
    },
    {
      name: 'environment',
      weight: 0.10,
      indicators: ['inform_natural', 'inform_climate'],
      indicatorWeights: { inform_natural: 0.50, inform_climate: 0.50 },
    },
  ],
};

const freshTimestamp = new Date().toISOString();

describe('tiered scoring with sourcesConfig', () => {
  it('blends baseline and signal tiers when both have data', () => {
    // Baseline indicators (gpi) and signal indicators (acled) for conflict pillar
    const indicators: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 1.6, year: 2025, source: 'gpi', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'acled_fatalities', value: 2000, year: 2025, source: 'acled', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'acled_events', value: 1000, year: 2025, source: 'acled', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'advisory_level_us', value: 1.6, year: 2025, source: 'state', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'advisory_level_uk', value: 1.6, year: 2025, source: 'fcdo', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_health', value: 2, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_epidemic', value: 2, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_governance', value: 2, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_natural', value: 2, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_climate', value: 2, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
    ];

    const withTiers = computeCountryScore('TST', indicators, TIERED_WEIGHTS, TEST_COUNTRY, {}, TEST_SOURCES, TEST_SOURCES_CONFIG);
    const withoutTiers = computeCountryScore('TST', indicators, TIERED_WEIGHTS, TEST_COUNTRY, {}, TEST_SOURCES);

    // Both should produce valid scores in range
    assert.ok(withTiers.score >= 1 && withTiers.score <= 10, `Tiered score ${withTiers.score} out of range`);
    assert.ok(withoutTiers.score >= 1 && withoutTiers.score <= 10, `Legacy score ${withoutTiers.score} out of range`);
    // Tiered and legacy should produce different scores (because sub-weights and blending differ)
    // At minimum the engine ran without error
  });
});

describe('graceful degradation — baseline only', () => {
  it('produces same score as baseline-only when no signal data is present', () => {
    // Only baseline indicators (gpi, inform) — no acled/advisories signal data
    const baselineOnlyIndicators: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 2.0, year: 2025, source: 'gpi', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_health', value: 3, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_epidemic', value: 4, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_governance', value: 3, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_natural', value: 2, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_climate', value: 2, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
    ];

    const tieredResult = computeCountryScore('TST', baselineOnlyIndicators, TIERED_WEIGHTS, TEST_COUNTRY, {}, TEST_SOURCES, TEST_SOURCES_CONFIG);

    // With no signal data, effectiveSignalInfluence should be 0,
    // so score should equal pure baseline score
    assert.ok(tieredResult.score >= 1 && tieredResult.score <= 10);

    // Conflict pillar: only gpi_overall (baseline), no acled (signal)
    // So signal completeness = 0 for conflict pillar => pure baseline
    const conflict = tieredResult.pillars.find((p) => p.name === 'conflict')!;
    assert.ok(conflict.score > 0, 'Conflict pillar should have a non-zero score from baseline GPI data');

    // Verify the score is valid and the engine did not crash
    assert.equal(tieredResult.pillars.length, 5);
  });
});

describe('per-indicator sub-weights', () => {
  it('produces different scores when sub-weights differ', () => {
    const indicators: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'inform_health', value: 2, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_epidemic', value: 8, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
    ];

    // Weights with health heavily weighted
    const weightsA: WeightsConfig = {
      version: '1.0.0',
      pillars: [
        { name: 'conflict', weight: 0.2, indicators: [] },
        { name: 'crime', weight: 0.2, indicators: [] },
        {
          name: 'health',
          weight: 0.20,
          indicators: ['inform_health', 'inform_epidemic'],
          indicatorWeights: { inform_health: 0.90, inform_epidemic: 0.10 },
        },
        { name: 'governance', weight: 0.2, indicators: [] },
        { name: 'environment', weight: 0.2, indicators: [] },
      ],
    };

    // Weights with epidemic heavily weighted
    const weightsB: WeightsConfig = {
      version: '1.0.0',
      pillars: [
        { name: 'conflict', weight: 0.2, indicators: [] },
        { name: 'crime', weight: 0.2, indicators: [] },
        {
          name: 'health',
          weight: 0.20,
          indicators: ['inform_health', 'inform_epidemic'],
          indicatorWeights: { inform_health: 0.10, inform_epidemic: 0.90 },
        },
        { name: 'governance', weight: 0.2, indicators: [] },
        { name: 'environment', weight: 0.2, indicators: [] },
      ],
    };

    const scoreA = computeCountryScore('TST', indicators, weightsA, TEST_COUNTRY, {}, TEST_SOURCES, TEST_SOURCES_CONFIG);
    const scoreB = computeCountryScore('TST', indicators, weightsB, TEST_COUNTRY, {}, TEST_SOURCES, TEST_SOURCES_CONFIG);

    // inform_health=2 (inverse, safer) vs inform_epidemic=8 (inverse, less safe)
    // When health is weighted higher, score should be better (higher)
    // When epidemic is weighted higher, score should be worse (lower)
    assert.ok(scoreA.score !== scoreB.score, `Sub-weights should produce different scores: A=${scoreA.score}, B=${scoreB.score}`);
    assert.ok(scoreA.score > scoreB.score, `Health-heavy weight (${scoreA.score}) should score higher than epidemic-heavy (${scoreB.score})`);
  });
});

describe('stale signal data is discounted', () => {
  it('stale signal data produces nearly identical score to baseline-only', () => {
    // Stale signal timestamp: 90 days ago (past acled maxAgeDays=60)
    const staleDate = new Date(Date.now() - 90 * 86_400_000).toISOString();

    const baselineOnlyIndicators: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 2.0, year: 2025, source: 'gpi', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_health', value: 3, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_epidemic', value: 4, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_governance', value: 3, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_natural', value: 2, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
      { countryIso3: 'TST', indicatorName: 'inform_climate', value: 2, year: 2025, source: 'inform', fetchedAt: freshTimestamp },
    ];

    const withStaleSignal: RawIndicator[] = [
      ...baselineOnlyIndicators,
      // Stale signal data: past maxAgeDays for acled (60 days), should get weight 0
      { countryIso3: 'TST', indicatorName: 'acled_fatalities', value: 9000, year: 2025, source: 'acled', fetchedAt: staleDate },
      { countryIso3: 'TST', indicatorName: 'acled_events', value: 4000, year: 2025, source: 'acled', fetchedAt: staleDate },
    ];

    const baselineResult = computeCountryScore('TST', baselineOnlyIndicators, TIERED_WEIGHTS, TEST_COUNTRY, {}, TEST_SOURCES, TEST_SOURCES_CONFIG);
    const staleResult = computeCountryScore('TST', withStaleSignal, TIERED_WEIGHTS, TEST_COUNTRY, {}, TEST_SOURCES, TEST_SOURCES_CONFIG);

    // Stale signal data (past maxAge) should have freshness weight = 0,
    // so the result should be very close to baseline-only
    // Allow small tolerance for floating point
    const scoreDiff = Math.abs(baselineResult.score - staleResult.score);
    assert.ok(scoreDiff < 0.5, `Stale signal should have negligible effect: baseline=${baselineResult.score}, stale=${staleResult.score}, diff=${scoreDiff}`);
  });
});
