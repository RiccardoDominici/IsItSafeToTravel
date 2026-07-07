import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalize, normalizeInverse, normalizeIndicators } from '../normalize.js';
import {
  computeCountryScore,
  computeAllScores,
  MIN_PILLAR_COVERAGE,
  INDICATOR_SOURCE_MAP,
  SOURCE_CATALOG,
  DEFAULT_FORMULA_V9,
} from '../engine.js';
import type {
  RawIndicator,
  WeightsConfig,
  FormulaV9Config,
  CountryEntry,
  AdvisoryInfo,
  SourceMeta,
  RawSourceData,
  SourcesConfig,
} from '../../types.js';

// --- Normalization tests (unchanged by Formula v9 — normalize.ts is UNCHANGED) ---

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

// --- Formula v9 scoring engine tests (quick-260706-x81) ---
//
// computeCountryScore no longer applies eligibility gates, neutral-0.5 pillar
// defaults, a low-data advisory blend, a critical floor, or a majority-L4 hard
// cap. It instead uses per-pillar Bayesian shrinkage toward a conservative,
// region-anchored prior (mu), a weighted geometric mean + down-only acute
// soft-min over conflict/crime, and a count-damped severe-advisory modifier.
// These tests exercise those v9 mechanisms directly (synthetic-config style).

const TEST_COUNTRY: CountryEntry = {
  iso3: 'TST',
  iso2: 'TS',
  name: { en: 'Testland', it: 'Testlandia', es: 'Testlandia', fr: 'Testlande', pt: 'Testlandia' },
};

const TEST_SOURCES: SourceMeta[] = [];
const NO_ADVISORIES = {};

/** Small v9-shaped formula config: same constants as production, tiers limited to a few test codes. */
function makeFormulaV9(overrides: Partial<FormulaV9Config> = {}): FormulaV9Config {
  return {
    ...DEFAULT_FORMULA_V9,
    advisoryTiers: { us: 4, uk: 4, ca: 4, au: 4, fr: 3 },
    frozenExcludedSources: [],
    advisoryRebase: [],
    regionOffset: { americas: -0.02, europe: 0.05, other: 0 },
    ...overrides,
  };
}

/** Minimal single-indicator-per-pillar v9 weights config for isolated mechanism testing. */
function makeWeightsV9(overrides: Partial<FormulaV9Config> = {}): WeightsConfig {
  return {
    version: '9.0.0-test',
    pillars: [
      {
        name: 'conflict',
        weight: 0.30,
        indicators: ['gpi_overall', 'A'],
        indicatorWeights: { gpi_overall: 0.60, A: 0.40 },
        indicatorPrecision: { gpi_overall: 2.0 },
      },
      {
        name: 'crime',
        weight: 0.25,
        indicators: ['gpi_safety_security'],
        indicatorWeights: { gpi_safety_security: 1.0 },
        indicatorPrecision: { gpi_safety_security: 2.5 },
      },
      {
        name: 'health',
        weight: 0.20,
        indicators: ['inform_health'],
        indicatorWeights: { inform_health: 1.0 },
        indicatorPrecision: { inform_health: 1 },
      },
      {
        name: 'governance',
        weight: 0.15,
        indicators: ['inform_governance'],
        indicatorWeights: { inform_governance: 1.0 },
        indicatorPrecision: { inform_governance: 1 },
      },
      {
        name: 'environment',
        weight: 0.10,
        indicators: ['inform_natural'],
        indicatorWeights: { inform_natural: 1.0 },
        indicatorPrecision: { inform_natural: 1 },
      },
    ],
    formulaV9: makeFormulaV9(overrides),
  };
}

describe('computeCountryScore — Formula v9: prior collapse', () => {
  it('collapses every pillar to mu when zero indicators and zero advisories are present', () => {
    const weights = makeWeightsV9();
    // USA -> region 'americas' (real regions.ts mapping) -> regionOffset -0.02
    const result = computeCountryScore('USA', [], weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);

    const expectedMu = weights.formulaV9!.muBase + weights.formulaV9!.regionOffset.americas;
    for (const pillar of result.pillars) {
      assert.ok(
        Math.abs(pillar.score - expectedMu) < 1e-9,
        `Pillar ${pillar.name} should collapse to mu=${expectedMu}, got ${pillar.score}`,
      );
      assert.equal(pillar.dataCompleteness, 0);
    }
    assert.ok(result.score >= 1 && result.score <= 10);
    assert.equal(result.confidence, 0, 'confidence must be 0 with zero precision everywhere');
  });

  it('mu differs by region (europe +0.05 vs americas -0.02) with identical zero-data inputs', () => {
    const weights = makeWeightsV9();
    const usa = computeCountryScore('USA', [], weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES); // americas
    const deu = computeCountryScore('DEU', [], weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES); // europe

    assert.ok(deu.score > usa.score, `Europe prior (${deu.score}) should exceed Americas prior (${usa.score})`);
  });
});

describe('computeCountryScore — Formula v9: Bayesian shrinkage monotonicity', () => {
  it('higher precision (rho) pulls the pillar value further from mu toward the evidence', () => {
    const goodIndicator: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 1.0, year: 2025, source: 'gpi' }, // normalized 1.0 (best)
    ];

    const lowPrecisionWeights = makeWeightsV9();
    lowPrecisionWeights.pillars[0].indicatorPrecision = { gpi_overall: 0.5 };
    const highPrecisionWeights = makeWeightsV9();
    highPrecisionWeights.pillars[0].indicatorPrecision = { gpi_overall: 20 };

    const low = computeCountryScore('TST', goodIndicator, lowPrecisionWeights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);
    const high = computeCountryScore('TST', goodIndicator, highPrecisionWeights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);

    const lowConflict = low.pillars.find((p) => p.name === 'conflict')!.score;
    const highConflict = high.pillars.find((p) => p.name === 'conflict')!.score;

    assert.ok(
      highConflict > lowConflict,
      `Higher precision (${highConflict}) should shrink less toward mu than low precision (${lowConflict}) for good evidence`,
    );
  });

  it('good evidence raises the score above the zero-data baseline; bad evidence lowers it', () => {
    const weights = makeWeightsV9();
    const baseline = computeCountryScore('TST', [], weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);

    const goodIndicators: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 1.0, year: 2025, source: 'gpi' },
      { countryIso3: 'TST', indicatorName: 'gpi_safety_security', value: 1.0, year: 2025, source: 'gpi' },
    ];
    const badIndicators: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 4.0, year: 2025, source: 'gpi' },
      { countryIso3: 'TST', indicatorName: 'gpi_safety_security', value: 5.0, year: 2025, source: 'gpi' },
    ];

    const good = computeCountryScore('TST', goodIndicators, weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);
    const bad = computeCountryScore('TST', badIndicators, weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);

    assert.ok(good.score > baseline.score, `Good evidence (${good.score}) should exceed the zero-data baseline (${baseline.score})`);
    assert.ok(bad.score < baseline.score, `Bad evidence (${bad.score}) should be below the zero-data baseline (${baseline.score})`);
  });

  it('freshness-decayed (stale) data shrinks precision toward zero, collapsing back toward the mu baseline', () => {
    const sourcesConfig: SourcesConfig = {
      maxSignalInfluence: 0.30,
      maxDailyScoreChange: 0.3,
      sources: {
        gpi: { tier: 'baseline', maxAgeDays: 30, decayHalfLifeDays: 7 },
      },
    };
    const weights = makeWeightsV9();
    const baseline = computeCountryScore('TST', [], weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);

    const now = new Date().toISOString();
    const staleDate = new Date(Date.now() - 90 * 86_400_000).toISOString(); // past maxAgeDays=30

    const freshIndicator: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 1.0, year: 2025, source: 'gpi', fetchedAt: now },
    ];
    const staleIndicator: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 1.0, year: 2025, source: 'gpi', fetchedAt: staleDate },
    ];

    const fresh = computeCountryScore('TST', freshIndicator, weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES, sourcesConfig);
    const stale = computeCountryScore('TST', staleIndicator, weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES, sourcesConfig);

    const freshConflict = fresh.pillars.find((p) => p.name === 'conflict')!.score;
    const staleConflict = stale.pillars.find((p) => p.name === 'conflict')!.score;
    const baselineConflict = baseline.pillars.find((p) => p.name === 'conflict')!.score;

    assert.ok(
      Math.abs(staleConflict - baselineConflict) < Math.abs(freshConflict - baselineConflict),
      `Stale data (${staleConflict}) should sit closer to the zero-data baseline (${baselineConflict}) than fresh data (${freshConflict})`,
    );
  });
});

describe('computeCountryScore — Formula v9: severe advisory modifier', () => {
  it('is bounded: composite/score never drop out of [1,10] even at maximum severity', () => {
    const weights = makeWeightsV9();
    const advisories: Record<string, AdvisoryInfo> = {};
    for (const code of ['us', 'uk', 'ca', 'au'] as const) {
      advisories[code] = { level: 4, text: 'Do not travel', source: code, url: '', updatedAt: '2026-01-01' };
    }
    const result = computeCountryScore('TST', [], weights, TEST_COUNTRY, advisories, TEST_SOURCES);
    assert.ok(result.score >= 1 && result.score <= 10, `Score ${result.score} must stay in [1,10]`);
  });

  it('is count-damped: a broad multi-government L4 consensus sinks the score more than a single thin L4 record', () => {
    const weights = makeWeightsV9();
    const sharedIndicators: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 2.0, year: 2025, source: 'gpi' },
      { countryIso3: 'TST', indicatorName: 'gpi_safety_security', value: 2.0, year: 2025, source: 'gpi' },
    ];

    const thinAdvisory: Record<string, AdvisoryInfo> = {
      us: { level: 4, text: '', source: 'us', url: '', updatedAt: '2026-01-01' },
    };
    const broadAdvisory: Record<string, AdvisoryInfo> = {
      us: { level: 4, text: '', source: 'us', url: '', updatedAt: '2026-01-01' },
      uk: { level: 4, text: '', source: 'uk', url: '', updatedAt: '2026-01-01' },
      ca: { level: 4, text: '', source: 'ca', url: '', updatedAt: '2026-01-01' },
      au: { level: 4, text: '', source: 'au', url: '', updatedAt: '2026-01-01' },
    };

    const thin = computeCountryScore('TST', sharedIndicators, weights, TEST_COUNTRY, thinAdvisory, TEST_SOURCES);
    const broad = computeCountryScore('TST', sharedIndicators, weights, TEST_COUNTRY, broadAdvisory, TEST_SOURCES);

    assert.ok(
      broad.score < thin.score,
      `Broad L4 consensus (${broad.score}) should sink the score more than a single thin L4 record (${thin.score})`,
    );
  });

  it('continuity: a single advisory-level step changes the score by less than 0.5 on a sparse country', () => {
    const weights = makeWeightsV9();
    // Sparse: no other data at all, exactly one advisory source, stepping L3 -> L4.
    const levelThree: Record<string, AdvisoryInfo> = {
      us: { level: 3, text: '', source: 'us', url: '', updatedAt: '2026-01-01' },
    };
    const levelFour: Record<string, AdvisoryInfo> = {
      us: { level: 4, text: '', source: 'us', url: '', updatedAt: '2026-01-01' },
    };

    const before = computeCountryScore('TST', [], weights, TEST_COUNTRY, levelThree, TEST_SOURCES);
    const after = computeCountryScore('TST', [], weights, TEST_COUNTRY, levelFour, TEST_SOURCES);

    const delta = Math.abs(after.score - before.score);
    assert.ok(delta < 0.5, `Single advisory-level step should change the score by < 0.5, got ${delta.toFixed(3)}`);
  });
});

describe('computeCountryScore — Formula v9: acute term is down-only', () => {
  it('capping acute at G (acuteDownOnly=1) never scores higher than leaving it uncapped, when conflict/crime are the STRONGEST pillars', () => {
    // Build a country where conflict/crime are excellent (normalized ~1.0) and the
    // other 3 pillars are only middling (~0.5) — so acuteRaw > G. Toggle the
    // formulaV9.acuteDownOnly flag (same frozen constant, isolated) to prove the
    // down-only cap can only ever drag the composite DOWN toward G, never inflate
    // it above what an uncapped acute soft-min would produce.
    const makeWeightsWithCap = (acuteDownOnly: 0 | 1): WeightsConfig => ({
      version: '9.0.0-test',
      pillars: [
        { name: 'conflict', weight: 0.30, indicators: ['gpi_overall'], indicatorWeights: { gpi_overall: 1.0 }, indicatorPrecision: { gpi_overall: 5 } },
        { name: 'crime', weight: 0.25, indicators: ['gpi_safety_security'], indicatorWeights: { gpi_safety_security: 1.0 }, indicatorPrecision: { gpi_safety_security: 5 } },
        { name: 'health', weight: 0.20, indicators: ['inform_health'], indicatorWeights: { inform_health: 1.0 }, indicatorPrecision: { inform_health: 5 } },
        { name: 'governance', weight: 0.15, indicators: ['inform_governance'], indicatorWeights: { inform_governance: 1.0 }, indicatorPrecision: { inform_governance: 5 } },
        { name: 'environment', weight: 0.10, indicators: ['inform_natural'], indicatorWeights: { inform_natural: 1.0 }, indicatorPrecision: { inform_natural: 5 } },
      ],
      formulaV9: { ...DEFAULT_FORMULA_V9, acuteDownOnly, regionOffset: {} },
    });

    const indicators: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 1, year: 2025, source: 'gpi' }, // normalized 1.0
      { countryIso3: 'TST', indicatorName: 'gpi_safety_security', value: 1, year: 2025, source: 'gpi' }, // normalized 1.0
      { countryIso3: 'TST', indicatorName: 'inform_health', value: 5, year: 2025, source: 'inform' }, // normalized 0.5
      { countryIso3: 'TST', indicatorName: 'inform_governance', value: 5, year: 2025, source: 'inform' }, // normalized 0.5
      { countryIso3: 'TST', indicatorName: 'inform_natural', value: 5, year: 2025, source: 'inform' }, // normalized 0.5
    ];

    const capped = computeCountryScore('TST', indicators, makeWeightsWithCap(1), TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);
    const uncapped = computeCountryScore('TST', indicators, makeWeightsWithCap(0), TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);

    assert.ok(
      capped.score < uncapped.score,
      `Down-only cap should score no higher than the uncapped acute blend: capped=${capped.score}, uncapped=${uncapped.score}`,
    );
  });
});

describe('computeCountryScore — Formula v9: score bounds + advisory pass-through', () => {
  it('never produces a score outside [1,10] across a spread of synthetic inputs', () => {
    const weights = makeWeightsV9();
    const scenarios: RawIndicator[][] = [
      [],
      [{ countryIso3: 'TST', indicatorName: 'gpi_overall', value: 1, year: 2025, source: 'gpi' }],
      [{ countryIso3: 'TST', indicatorName: 'gpi_overall', value: 4, year: 2025, source: 'gpi' }],
      [
        { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 1, year: 2025, source: 'gpi' },
        { countryIso3: 'TST', indicatorName: 'gpi_safety_security', value: 1, year: 2025, source: 'gpi' },
        { countryIso3: 'TST', indicatorName: 'inform_health', value: 0, year: 2025, source: 'inform' },
        { countryIso3: 'TST', indicatorName: 'inform_governance', value: 0, year: 2025, source: 'inform' },
        { countryIso3: 'TST', indicatorName: 'inform_natural', value: 0, year: 2025, source: 'inform' },
      ],
      [
        { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 4, year: 2025, source: 'gpi' },
        { countryIso3: 'TST', indicatorName: 'gpi_safety_security', value: 5, year: 2025, source: 'gpi' },
        { countryIso3: 'TST', indicatorName: 'inform_health', value: 10, year: 2025, source: 'inform' },
        { countryIso3: 'TST', indicatorName: 'inform_governance', value: 10, year: 2025, source: 'inform' },
        { countryIso3: 'TST', indicatorName: 'inform_natural', value: 10, year: 2025, source: 'inform' },
      ],
    ];

    for (const indicators of scenarios) {
      const result = computeCountryScore('TST', indicators, weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);
      assert.ok(result.score >= 1 && result.score <= 10, `Score ${result.score} out of [1,10] for scenario with ${indicators.length} indicators`);
      assert.ok(result.scoreDisplay >= 1 && result.scoreDisplay <= 10);
      assert.ok(result.confidence >= 0 && result.confidence <= 1, `confidence ${result.confidence} out of [0,1]`);
    }
  });

  it('confidence increases as more high-precision indicators become available', () => {
    const weights = makeWeightsV9();
    const zero = computeCountryScore('TST', [], weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);
    const some: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 2, year: 2025, source: 'gpi' },
    ];
    const partial = computeCountryScore('TST', some, weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);
    const full: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 2, year: 2025, source: 'gpi' },
      { countryIso3: 'TST', indicatorName: 'gpi_safety_security', value: 2, year: 2025, source: 'gpi' },
      { countryIso3: 'TST', indicatorName: 'inform_health', value: 5, year: 2025, source: 'inform' },
      { countryIso3: 'TST', indicatorName: 'inform_governance', value: 5, year: 2025, source: 'inform' },
      { countryIso3: 'TST', indicatorName: 'inform_natural', value: 5, year: 2025, source: 'inform' },
    ];
    const fullResult = computeCountryScore('TST', full, weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);

    assert.equal(zero.confidence, 0);
    assert.ok(partial.confidence > zero.confidence, `Partial confidence (${partial.confidence}) should exceed zero (${zero.confidence})`);
    assert.ok(fullResult.confidence > partial.confidence, `Full confidence (${fullResult.confidence}) should exceed partial (${partial.confidence})`);
  });

  it('includes advisory info when provided (pass-through, unaffected by v9 shrinkage)', () => {
    const usAdvisory: AdvisoryInfo = {
      level: 2,
      text: 'Exercise increased caution',
      source: 'US State Dept',
      url: 'https://example.com',
      updatedAt: '2025-01-01',
    };
    const weights = makeWeightsV9();
    const result = computeCountryScore('TST', [], weights, TEST_COUNTRY, { us: usAdvisory }, TEST_SOURCES);
    assert.deepEqual(result.advisories.us, usAdvisory);
  });

  it('dataCompleteness reflects found/expected indicators per pillar (full / partial / missing)', () => {
    const weights = makeWeightsV9();
    const indicators: RawIndicator[] = [
      { countryIso3: 'TST', indicatorName: 'gpi_overall', value: 2, year: 2025, source: 'gpi' }, // conflict: 1 real indicator present (of 2 slots incl. 'A')
      { countryIso3: 'TST', indicatorName: 'inform_health', value: 3, year: 2025, source: 'inform' }, // health: fully present (1/1)
    ];
    const result = computeCountryScore('TST', indicators, weights, TEST_COUNTRY, NO_ADVISORIES, TEST_SOURCES);

    const conflict = result.pillars.find((p) => p.name === 'conflict')!;
    const health = result.pillars.find((p) => p.name === 'health')!;
    const governance = result.pillars.find((p) => p.name === 'governance')!;

    // conflict has 2 slots (gpi_overall + synthetic A); only gpi_overall present, A absent (no advisories) => 0.5
    assert.equal(conflict.dataCompleteness, 0.5);
    assert.equal(health.dataCompleteness, 1.0);
    assert.equal(governance.dataCompleteness, 0);
  });
});

// --- computeAllScores (generic contract, unaffected by the v9 rewrite) ---

const TEST_WEIGHTS: WeightsConfig = {
  version: '1.0.0',
  pillars: [
    { name: 'conflict', weight: 0.20, indicators: ['gpi_overall'] },
    { name: 'crime', weight: 0.20, indicators: ['gpi_safety_security', 'advisory_level_us', 'advisory_level_uk'] },
    { name: 'health', weight: 0.20, indicators: ['inform_health', 'inform_epidemic'] },
    { name: 'governance', weight: 0.20, indicators: ['inform_governance', 'gpi_militarisation'] },
    { name: 'environment', weight: 0.20, indicators: ['inform_natural', 'inform_climate'] },
  ],
};

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
    // Every scored country carries a numeric confidence
    for (const r of results) {
      assert.equal(typeof r.confidence, 'number');
    }
  });
});

// --- MIN_PILLAR_COVERAGE: retained export, no longer used for score gating ---

describe('MIN_PILLAR_COVERAGE (legacy export, display-layer only)', () => {
  it('is still exported at 0.30 for UI/FAQ pillar-eligibility filtering (src/lib/seo.ts)', () => {
    assert.equal(MIN_PILLAR_COVERAGE, 0.30);
  });
});

// --- Formula v9: weights.json structure (quick-260706-x81) ---

describe('Formula v9: weights.json structure', () => {
  const weightsPath = join(process.cwd(), 'src/pipeline/config/weights.json');
  const weightsJson = JSON.parse(readFileSync(weightsPath, 'utf-8')) as WeightsConfig;

  it('version is "9.0.0"', () => {
    assert.equal(weightsJson.version, '9.0.0');
  });

  it('pillar weights are still 30/25/20/15/10 and sum to 1.0', () => {
    const byName = new Map(weightsJson.pillars.map((p) => [p.name, p.weight]));
    assert.equal(byName.get('conflict'), 0.30);
    assert.equal(byName.get('crime'), 0.25);
    assert.equal(byName.get('health'), 0.20);
    assert.equal(byName.get('governance'), 0.15);
    assert.equal(byName.get('environment'), 0.10);
    const sum = weightsJson.pillars.reduce((acc, p) => acc + p.weight, 0);
    assert.ok(Math.abs(sum - 1.0) < 1e-9);
  });

  it('conflict pillar is [gpi_overall, gpi_militarisation, A] — no advisory_level_* entries', () => {
    const conflict = weightsJson.pillars.find((p) => p.name === 'conflict')!;
    assert.ok(conflict, 'conflict pillar must exist');
    const advisoryCount = conflict.indicators.filter((n) => n.startsWith('advisory_level_')).length;
    assert.equal(advisoryCount, 0, 'conflict.indicators must not contain any advisory_level_* entries in v9');
    assert.deepEqual([...conflict.indicators].sort(), ['A', 'gpi_militarisation', 'gpi_overall']);
  });

  it('conflict pillar subweights (gpi_overall .45 / gpi_militarisation .15 / A .40) sum to 1.0', () => {
    const conflict = weightsJson.pillars.find((p) => p.name === 'conflict')!;
    assert.ok(conflict.indicatorWeights);
    assert.equal(conflict.indicatorWeights!.gpi_overall, 0.45);
    assert.equal(conflict.indicatorWeights!.gpi_militarisation, 0.15);
    assert.equal(conflict.indicatorWeights!.A, 0.40);
    const sum = Object.values(conflict.indicatorWeights!).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 1e-9);
  });

  it('crime pillar indicators equals ["gpi_safety_security"] exactly (moved from conflict)', () => {
    const crime = weightsJson.pillars.find((p) => p.name === 'crime')!;
    assert.ok(crime, 'crime pillar must exist');
    assert.deepEqual(crime.indicators, ['gpi_safety_security']);
  });

  it('governance pillar includes vdem_rule_of_law (moved from crime) alongside the original 3', () => {
    const gov = weightsJson.pillars.find((p) => p.name === 'governance')!;
    assert.ok(gov, 'governance pillar must exist');
    const expected = new Set(['vdem_rule_of_law', 'vdem_gov_effectiveness', 'vdem_corruption_control', 'inform_governance']);
    const actual = new Set(gov.indicators);
    assert.equal(actual.size, expected.size, `governance indicators size mismatch: ${gov.indicators.join(',')}`);
    for (const name of expected) {
      assert.ok(actual.has(name), `governance.indicators must contain ${name}`);
    }
  });

  it('has a formulaV9 constants section with the frozen tunables', () => {
    const f9 = weightsJson.formulaV9;
    assert.ok(f9, 'formulaV9 section must exist');
    assert.equal(f9!.K, 1.0);
    assert.equal(f9!.lambda, 0.25);
    assert.equal(f9!.q, 3);
    assert.equal(f9!.gamma, 0.79);
    assert.equal(f9!.S_MAX, 0.25);
    assert.equal(f9!.N_SEV, 6);
    assert.ok(f9!.frozenExcludedSources.includes('jp'));
    assert.ok(f9!.advisoryRebase.includes('at') && f9!.advisoryRebase.includes('nz'));
    assert.equal(f9!.regionOffset.europe, 0.05);
    assert.equal(f9!.regionOffset.middle_east, -0.05);
  });
});

describe('Formula v9: engine.ts INDICATOR_SOURCE_MAP + SOURCE_CATALOG', () => {
  it('INDICATOR_SOURCE_MAP maps the three vdem_* keys to "vdem"', () => {
    assert.equal(INDICATOR_SOURCE_MAP['vdem_rule_of_law'], 'vdem');
    assert.equal(INDICATOR_SOURCE_MAP['vdem_gov_effectiveness'], 'vdem');
    assert.equal(INDICATOR_SOURCE_MAP['vdem_corruption_control'], 'vdem');
  });

  it('INDICATOR_SOURCE_MAP does NOT contain the four retired wb_* WGI keys', () => {
    assert.equal(INDICATOR_SOURCE_MAP['wb_political_stability'], undefined);
    assert.equal(INDICATOR_SOURCE_MAP['wb_rule_of_law'], undefined);
    assert.equal(INDICATOR_SOURCE_MAP['wb_gov_effectiveness'], undefined);
    assert.equal(INDICATOR_SOURCE_MAP['wb_corruption_control'], undefined);
  });

  it('SOURCE_CATALOG.vdem has v-dem.net URL and CC-BY-SA + Coppedge + DOI in description', () => {
    const vdem = SOURCE_CATALOG['vdem'];
    assert.ok(vdem, 'SOURCE_CATALOG.vdem must exist');
    assert.ok(vdem.url.includes('v-dem.net'), `vdem.url must include v-dem.net, got ${vdem.url}`);
    assert.ok(vdem.description.includes('CC-BY-SA'),
      `vdem.description must mention CC-BY-SA, got: ${vdem.description}`);
    assert.ok(vdem.description.includes('Coppedge'),
      `vdem.description must mention Coppedge, got: ${vdem.description}`);
    assert.ok(vdem.description.includes('10.23696/vdemds26'),
      `vdem.description must mention DOI 10.23696/vdemds26, got: ${vdem.description}`);
  });
});
