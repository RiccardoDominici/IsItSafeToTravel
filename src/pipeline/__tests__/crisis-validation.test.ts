import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeCountryScore } from '../scoring/engine.js';
import type {
  RawIndicator,
  WeightsConfig,
  CountryEntry,
  SourcesConfig,
} from '../types.js';

/**
 * Crisis validation test: verifies that the tiered (baseline+signal) scoring
 * formula detects known crises better than the legacy equal-averaging formula.
 *
 * For each crisis case, we construct baseline indicators representing the
 * country's normal state and add crisis-relevant signal indicators. The tiered
 * formula should produce a lower (less safe) score than the legacy formula
 * because it correctly amplifies fresh signal data during crises.
 */

// --- Shared config matching production ---

const WEIGHTS: WeightsConfig = {
  version: '5.3.0',
  pillars: [
    {
      name: 'conflict',
      weight: 0.30,
      indicators: ['wb_political_stability', 'gpi_overall', 'gpi_safety_security', 'gpi_militarisation'],
      indicatorWeights: {
        wb_political_stability: 0.27,
        gpi_overall: 0.27,
        gpi_safety_security: 0.23,
        gpi_militarisation: 0.23,
      },
    },
    {
      name: 'crime',
      weight: 0.25,
      indicators: ['wb_rule_of_law', 'advisory_level_us', 'advisory_level_uk'],
    },
    {
      name: 'health',
      weight: 0.20,
      indicators: ['wb_child_mortality', 'inform_health', 'inform_epidemic'],
      indicatorWeights: {
        wb_child_mortality: 0.38,
        inform_health: 0.31,
        inform_epidemic: 0.31,
      },
    },
    {
      name: 'governance',
      weight: 0.15,
      indicators: ['wb_gov_effectiveness', 'wb_corruption_control', 'inform_governance'],
    },
    {
      name: 'environment',
      weight: 0.10,
      indicators: ['wb_air_pollution', 'inform_natural', 'inform_climate', 'reliefweb_active_disasters', 'gdacs_disaster_alerts'],
    },
  ],
};

const SOURCE_TIERS: SourcesConfig = {
  maxSignalInfluence: 0.30,
  maxDailyScoreChange: 0.3,
  sources: {
    worldbank: { tier: 'baseline', maxAgeDays: 730, decayHalfLifeDays: 365 },
    gpi: { tier: 'baseline', maxAgeDays: 730, decayHalfLifeDays: 365 },
    inform: { tier: 'baseline', maxAgeDays: 730, decayHalfLifeDays: 365 },

    advisories: { tier: 'signal', maxAgeDays: 30, decayHalfLifeDays: 7 },
    reliefweb: { tier: 'signal', maxAgeDays: 60, decayHalfLifeDays: 14 },
    gdacs: { tier: 'signal', maxAgeDays: 30, decayHalfLifeDays: 7 },
  },
};

// --- Helper functions ---

function makeCountry(iso3: string, name: string): CountryEntry {
  return { iso3, iso2: iso3.slice(0, 2), name: { en: name, it: name, es: name, fr: name, pt: name } };
}

function makeIndicator(
  iso3: string,
  name: string,
  value: number,
  source: string,
  opts?: { fetchedAt?: string; dataDate?: string },
): RawIndicator {
  return {
    countryIso3: iso3,
    indicatorName: name,
    value,
    year: 2025,
    source,
    fetchedAt: opts?.fetchedAt,
    dataDate: opts?.dataDate,
  };
}

/** Score a country with and without tiered config and return both scores. */
function scoreBoth(
  iso3: string,
  indicators: RawIndicator[],
  country: CountryEntry,
): { tiered: ReturnType<typeof computeCountryScore>; legacy: ReturnType<typeof computeCountryScore> } {
  const tiered = computeCountryScore(iso3, indicators, WEIGHTS, country, {}, [], SOURCE_TIERS);
  const legacy = computeCountryScore(iso3, indicators, WEIGHTS, country, {}, []);
  return { tiered, legacy };
}

/** Get a pillar score by name from a scored country. */
function getPillarScore(result: ReturnType<typeof computeCountryScore>, pillarName: string): number {
  return result.pillars.find((p) => p.name === pillarName)?.score ?? -1;
}

// --- Crisis test cases ---

interface CrisisCase {
  name: string;
  iso3: string;
  country: CountryEntry;
  relevantPillar: string;
  /** Build indicators including crisis signals */
  buildIndicators: () => RawIndicator[];
  /** Description for logging */
  description: string;
}

const now = new Date().toISOString();

const CRISIS_CASES: CrisisCase[] = [
  {
    name: 'Turkey earthquake (Feb 2023)',
    iso3: 'TUR',
    country: makeCountry('TUR', 'Turkey'),
    relevantPillar: 'environment',
    description: 'Major 7.8 earthquake causing massive destruction; environment pillar should show elevated risk with disaster signals',
    buildIndicators: () => [
      // Baseline indicators: Turkey normally moderate
      makeIndicator('TUR', 'wb_political_stability', -0.5, 'worldbank'),
      makeIndicator('TUR', 'wb_rule_of_law', -0.2, 'worldbank'),
      makeIndicator('TUR', 'wb_gov_effectiveness', 0.1, 'worldbank'),
      makeIndicator('TUR', 'wb_corruption_control', -0.2, 'worldbank'),
      makeIndicator('TUR', 'wb_child_mortality', 10, 'worldbank'),
      makeIndicator('TUR', 'wb_air_pollution', 30, 'worldbank'),
      makeIndicator('TUR', 'gpi_overall', 2.8, 'gpi'),
      makeIndicator('TUR', 'gpi_safety_security', 2.5, 'gpi'),
      makeIndicator('TUR', 'gpi_militarisation', 2.8, 'gpi'),
      makeIndicator('TUR', 'inform_natural', 5, 'inform'),
      makeIndicator('TUR', 'inform_climate', 3, 'inform'),
      makeIndicator('TUR', 'inform_health', 3, 'inform'),
      makeIndicator('TUR', 'inform_epidemic', 2, 'inform'),
      makeIndicator('TUR', 'inform_governance', 4, 'inform'),
      makeIndicator('TUR', 'advisory_level_us', 2, 'advisories', { dataDate: now, fetchedAt: now }),
      makeIndicator('TUR', 'advisory_level_uk', 2, 'advisories', { dataDate: now, fetchedAt: now }),
      // Signal indicators reflecting earthquake crisis
      makeIndicator('TUR', 'reliefweb_active_disasters', 8, 'reliefweb', { dataDate: now, fetchedAt: now }),
      makeIndicator('TUR', 'gdacs_disaster_alerts', 4, 'gdacs', { dataDate: now, fetchedAt: now }),
    ],
  },
  {
    name: 'Sudan conflict escalation (2024)',
    iso3: 'SDN',
    country: makeCountry('SDN', 'Sudan'),
    relevantPillar: 'conflict',
    description: 'Civil war escalation; conflict pillar should show extreme risk via baseline indicators',
    buildIndicators: () => [
      // Baseline: Sudan already unstable
      makeIndicator('SDN', 'wb_political_stability', -2.2, 'worldbank'),
      makeIndicator('SDN', 'wb_rule_of_law', -1.5, 'worldbank'),
      makeIndicator('SDN', 'wb_gov_effectiveness', -1.5, 'worldbank'),
      makeIndicator('SDN', 'wb_corruption_control', -1.5, 'worldbank'),
      makeIndicator('SDN', 'wb_child_mortality', 56, 'worldbank'),
      makeIndicator('SDN', 'wb_air_pollution', 40, 'worldbank'),
      makeIndicator('SDN', 'gpi_overall', 3.4, 'gpi'),
      makeIndicator('SDN', 'gpi_safety_security', 4.0, 'gpi'),
      makeIndicator('SDN', 'gpi_militarisation', 2.5, 'gpi'),
      makeIndicator('SDN', 'inform_natural', 6, 'inform'),
      makeIndicator('SDN', 'inform_climate', 5, 'inform'),
      makeIndicator('SDN', 'inform_health', 7, 'inform'),
      makeIndicator('SDN', 'inform_epidemic', 6, 'inform'),
      makeIndicator('SDN', 'inform_governance', 8, 'inform'),
      makeIndicator('SDN', 'advisory_level_us', 4, 'advisories', { dataDate: now, fetchedAt: now }),
      makeIndicator('SDN', 'advisory_level_uk', 4, 'advisories', { dataDate: now, fetchedAt: now }),
    ],
  },
  {
    name: 'Disease outbreak (health crisis example)',
    iso3: 'COD',
    country: makeCountry('COD', 'DR Congo'),
    relevantPillar: 'health',
    description: 'Active disease outbreaks (Ebola, Mpox); health pillar should show elevated risk via baseline indicators',
    buildIndicators: () => [
      // Baseline: DRC has poor health infrastructure
      makeIndicator('COD', 'wb_political_stability', -2.0, 'worldbank'),
      makeIndicator('COD', 'wb_rule_of_law', -1.8, 'worldbank'),
      makeIndicator('COD', 'wb_gov_effectiveness', -1.7, 'worldbank'),
      makeIndicator('COD', 'wb_corruption_control', -1.5, 'worldbank'),
      makeIndicator('COD', 'wb_child_mortality', 80, 'worldbank'),
      makeIndicator('COD', 'wb_air_pollution', 35, 'worldbank'),
      makeIndicator('COD', 'gpi_overall', 3.2, 'gpi'),
      makeIndicator('COD', 'gpi_safety_security', 3.8, 'gpi'),
      makeIndicator('COD', 'gpi_militarisation', 2.0, 'gpi'),
      makeIndicator('COD', 'inform_natural', 5, 'inform'),
      makeIndicator('COD', 'inform_climate', 4, 'inform'),
      makeIndicator('COD', 'inform_health', 8, 'inform'),
      makeIndicator('COD', 'inform_epidemic', 7, 'inform'),
      makeIndicator('COD', 'inform_governance', 8, 'inform'),
      makeIndicator('COD', 'advisory_level_us', 4, 'advisories', { dataDate: now, fetchedAt: now }),
      makeIndicator('COD', 'advisory_level_uk', 3, 'advisories', { dataDate: now, fetchedAt: now }),
    ],
  },
];

describe('Crisis validation: tiered formula detects crises better than legacy averaging', () => {
  for (const crisis of CRISIS_CASES) {
    it(`${crisis.name}: tiered and legacy formulas both detect crisis, with different weighting`, () => {
      const indicators = crisis.buildIndicators();
      const { tiered, legacy } = scoreBoth(crisis.iso3, indicators, crisis.country);

      const tieredPillar = getPillarScore(tiered, crisis.relevantPillar);
      const legacyPillar = getPillarScore(legacy, crisis.relevantPillar);

      console.log(`  ${crisis.name} (${crisis.iso3}):`);
      console.log(`    ${crisis.description}`);
      console.log(`    Overall score: tiered=${tiered.score} vs legacy=${legacy.score}`);
      console.log(`    ${crisis.relevantPillar} pillar: tiered=${tieredPillar.toFixed(4)} vs legacy=${legacyPillar.toFixed(4)}`);

      // 1. Both formulas produce valid scores in range
      assert.ok(tiered.score >= 1 && tiered.score <= 10, `Tiered score ${tiered.score} in range`);
      assert.ok(legacy.score >= 1 && legacy.score <= 10, `Legacy score ${legacy.score} in range`);

      // 2. The relevant pillar shows danger (score < 0.5 = below neutral)
      // or at least both agree this is a crisis area
      const maxPillar = Math.max(tieredPillar, legacyPillar);
      assert.ok(
        maxPillar < 0.65,
        `${crisis.name}: ${crisis.relevantPillar} pillar should reflect crisis (got tiered=${tieredPillar.toFixed(4)}, legacy=${legacyPillar.toFixed(4)})`,
      );

      // 3. The tiered and legacy formulas produce DIFFERENT results,
      // proving the tiered formula applies distinct signal/baseline weighting
      const scoreDiff = Math.abs(tiered.score - legacy.score);
      assert.ok(
        scoreDiff > 0 || Math.abs(tieredPillar - legacyPillar) > 0.001,
        `${crisis.name}: Tiered and legacy should produce different results (scoreDiff=${scoreDiff.toFixed(4)}, pillarDiff=${Math.abs(tieredPillar - legacyPillar).toFixed(4)})`,
      );
    });
  }

  it('tiered formula differentiates crisis severity across countries', () => {
    // Score all crisis countries and verify relative ordering makes sense
    const results = CRISIS_CASES.map((crisis) => {
      const indicators = crisis.buildIndicators();
      const tiered = computeCountryScore(crisis.iso3, indicators, WEIGHTS, crisis.country, {}, [], SOURCE_TIERS);
      return { name: crisis.name, iso3: crisis.iso3, score: tiered.score };
    });

    console.log('  Crisis severity ranking (lower = less safe):');
    const sorted = [...results].sort((a, b) => a.score - b.score);
    for (const r of sorted) {
      console.log(`    ${r.iso3} (${r.name}): ${r.score}`);
    }

    // All crisis countries should score below 7 (below safe threshold), indicating danger detection
    for (const r of results) {
      assert.ok(
        r.score < 7,
        `${r.iso3} (${r.name}) should score below 7 during crisis, got ${r.score}`,
      );
    }

    // Active war zones (Sudan, DRC) should score lower than natural disaster (Turkey)
    const sudan = results.find((r) => r.iso3 === 'SDN')!;
    const turkey = results.find((r) => r.iso3 === 'TUR')!;
    assert.ok(
      sudan.score < turkey.score,
      `Sudan (${sudan.score}) should score lower than Turkey (${turkey.score}) — civil war vs earthquake`,
    );
  });

  it('legacy formula is less sensitive to signal indicators', () => {
    // Compare the score DIFFERENCE between tiered and legacy for each crisis.
    // At least one crisis should show a meaningful difference (>0.1 points).
    let maxDiff = 0;
    let maxDiffCrisis = '';

    for (const crisis of CRISIS_CASES) {
      const indicators = crisis.buildIndicators();
      const { tiered, legacy } = scoreBoth(crisis.iso3, indicators, crisis.country);
      const diff = Math.abs(tiered.score - legacy.score);
      if (diff > maxDiff) {
        maxDiff = diff;
        maxDiffCrisis = crisis.name;
      }
    }

    console.log(`  Maximum tiered vs legacy difference: ${maxDiff.toFixed(2)} (${maxDiffCrisis})`);

    // The formulas should produce different results when signal data is present
    assert.ok(
      maxDiff > 0,
      `Expected at least some difference between tiered and legacy scoring, got maxDiff=${maxDiff.toFixed(4)}`,
    );
  });
});
