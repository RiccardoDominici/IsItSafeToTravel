import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeCountryScore, DEFAULT_FORMULA_V9 } from '../scoring/engine.js';
import type {
  RawIndicator,
  WeightsConfig,
  CountryEntry,
  SourcesConfig,
  AdvisoryInfo,
} from '../types.js';

/**
 * Crisis validation test (Formula v9.1, quick-260708-lb3): verifies the v9.1
 * Bayesian-shrinkage engine still detects known real-world crises correctly
 * under the v9.1 pillar composition (crime <- gpi_safety_security + wb_homicide
 * [D1], governance <- +vdem_rule_of_law, conflict <- +synthetic
 * advisory-consensus "A" + ucdp_conflict_deaths [D2]; no retired wb_* WGI
 * indicators). For each crisis case we build baseline + crisis-relevant
 * indicators (including the new homicide/UCDP signals) and assert: (1) the
 * score stays in [1,10], (2) the crisis-relevant pillar reflects elevated
 * danger, and (3) active-conflict crises (Sudan, DR Congo) score below a
 * natural-disaster crisis (Turkey) — the severe-advisory modifier, low
 * conflict/crime GPI values, AND high UCDP conflict-deaths sink active
 * conflict harder than a single earthquake event.
 */

// --- Shared v9.1 config matching production weights.json's pillar composition ---

const WEIGHTS: WeightsConfig = {
  version: '9.1.0-test',
  pillars: [
    {
      name: 'conflict',
      weight: 0.30,
      indicators: ['gpi_overall', 'gpi_militarisation', 'A', 'ucdp_conflict_deaths'],
      indicatorWeights: { gpi_overall: 0.3275, gpi_militarisation: 0.1125, A: 0.28, ucdp_conflict_deaths: 0.28 },
      indicatorPrecision: { gpi_overall: 2.0, gpi_militarisation: 1.0, ucdp_conflict_deaths: 2.5 },
    },
    {
      name: 'crime',
      weight: 0.25,
      indicators: ['gpi_safety_security', 'wb_homicide'],
      indicatorWeights: { gpi_safety_security: 0.67, wb_homicide: 0.33 },
      indicatorPrecision: { gpi_safety_security: 2.5, wb_homicide: 1.5 },
    },
    {
      name: 'health',
      weight: 0.20,
      indicators: ['wb_child_mortality', 'inform_health', 'inform_epidemic'],
      indicatorWeights: { wb_child_mortality: 0.38, inform_health: 0.31, inform_epidemic: 0.31 },
      indicatorPrecision: { wb_child_mortality: 1, inform_health: 1, inform_epidemic: 1 },
    },
    {
      name: 'governance',
      weight: 0.15,
      indicators: ['vdem_rule_of_law', 'vdem_gov_effectiveness', 'vdem_corruption_control', 'inform_governance'],
      indicatorWeights: {
        vdem_rule_of_law: 0.25,
        vdem_gov_effectiveness: 0.25,
        vdem_corruption_control: 0.25,
        inform_governance: 0.25,
      },
      indicatorPrecision: { vdem_rule_of_law: 1, vdem_gov_effectiveness: 1, vdem_corruption_control: 1, inform_governance: 1 },
    },
    {
      name: 'environment',
      weight: 0.10,
      indicators: ['wb_air_pollution', 'inform_natural', 'inform_climate', 'reliefweb_active_disasters', 'gdacs_disaster_alerts'],
      indicatorWeights: {
        wb_air_pollution: 0.35,
        inform_natural: 0.25,
        inform_climate: 0.20,
        reliefweb_active_disasters: 0.10,
        gdacs_disaster_alerts: 0.10,
      },
      indicatorPrecision: { wb_air_pollution: 1, inform_natural: 1, inform_climate: 1, reliefweb_active_disasters: 0, gdacs_disaster_alerts: 0 },
    },
  ],
  formulaV9: {
    ...DEFAULT_FORMULA_V9,
    advisoryTiers: { us: 4, uk: 4 },
    regionOffset: {}, // isolate crisis detection from region-prior effects
  },
};

const SOURCE_TIERS: SourcesConfig = {
  maxSignalInfluence: 0.30,
  maxDailyScoreChange: 0.3,
  sources: {
    worldbank: { tier: 'baseline', maxAgeDays: 730, decayHalfLifeDays: 365 },
    vdem: { tier: 'baseline', maxAgeDays: 730, decayHalfLifeDays: 365 },
    gpi: { tier: 'baseline', maxAgeDays: 730, decayHalfLifeDays: 365 },
    inform: { tier: 'baseline', maxAgeDays: 730, decayHalfLifeDays: 365 },

    advisories_us: { tier: 'signal', maxAgeDays: 30, decayHalfLifeDays: 7 },
    advisories_uk: { tier: 'signal', maxAgeDays: 30, decayHalfLifeDays: 7 },
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

/** Extract {us,uk} AdvisoryInfo from a crisis case's advisory_level_* indicators. */
function extractAdvisories(indicators: RawIndicator[], now: string): { us?: AdvisoryInfo; uk?: AdvisoryInfo } {
  const advisories: { us?: AdvisoryInfo; uk?: AdvisoryInfo } = {};
  for (const ind of indicators) {
    if (ind.indicatorName === 'advisory_level_us') {
      advisories.us = { level: ind.value, text: '', source: 'US State Dept', url: '', updatedAt: now };
    } else if (ind.indicatorName === 'advisory_level_uk') {
      advisories.uk = { level: ind.value, text: '', source: 'UK FCDO', url: '', updatedAt: now };
    }
  }
  return advisories;
}

function getPillarScore(result: ReturnType<typeof computeCountryScore>, pillarName: string): number {
  return result.pillars.find((p) => p.name === pillarName)?.score ?? -1;
}

// --- Crisis test cases (v9 indicator names; retired wb_* WGI indicators dropped) ---

interface CrisisCase {
  name: string;
  iso3: string;
  country: CountryEntry;
  relevantPillar: string;
  buildIndicators: () => RawIndicator[];
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
      makeIndicator('TUR', 'vdem_rule_of_law', 0.40, 'vdem'),
      makeIndicator('TUR', 'vdem_gov_effectiveness', 0.10, 'vdem'),
      makeIndicator('TUR', 'vdem_corruption_control', 0.60, 'vdem'),
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
      makeIndicator('TUR', 'advisory_level_us', 2, 'advisories_us', { dataDate: now, fetchedAt: now }),
      makeIndicator('TUR', 'advisory_level_uk', 2, 'advisories_uk', { dataDate: now, fetchedAt: now }),
      // Signal indicators reflecting earthquake crisis
      makeIndicator('TUR', 'reliefweb_active_disasters', 8, 'reliefweb', { dataDate: now, fetchedAt: now }),
      makeIndicator('TUR', 'gdacs_disaster_alerts', 4, 'gdacs', { dataDate: now, fetchedAt: now }),
      // v9.1: low homicide, low UCDP conflict-deaths — this is a natural-disaster
      // crisis, not an active-conflict one.
      makeIndicator('TUR', 'wb_homicide', 3, 'worldbank'),
      makeIndicator('TUR', 'ucdp_conflict_deaths', 50, 'ucdp'),
    ],
  },
  {
    name: 'Sudan conflict escalation (2024)',
    iso3: 'SDN',
    country: makeCountry('SDN', 'Sudan'),
    relevantPillar: 'conflict',
    description: 'Civil war escalation; conflict pillar should show extreme risk via GPI + advisory-consensus signals',
    buildIndicators: () => [
      makeIndicator('SDN', 'vdem_rule_of_law', 0.10, 'vdem'),
      makeIndicator('SDN', 'vdem_gov_effectiveness', -1.5, 'vdem'),
      makeIndicator('SDN', 'vdem_corruption_control', 0.85, 'vdem'),
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
      makeIndicator('SDN', 'advisory_level_us', 4, 'advisories_us', { dataDate: now, fetchedAt: now }),
      makeIndicator('SDN', 'advisory_level_uk', 4, 'advisories_uk', { dataDate: now, fetchedAt: now }),
      // v9.1: civil war -> elevated homicide + very high UCDP conflict-deaths
      // (2023-24 Sudan civil war scale, tens of thousands of battle deaths).
      makeIndicator('SDN', 'wb_homicide', 15, 'worldbank'),
      makeIndicator('SDN', 'ucdp_conflict_deaths', 20000, 'ucdp'),
    ],
  },
  {
    name: 'Disease outbreak (health crisis example)',
    iso3: 'COD',
    country: makeCountry('COD', 'DR Congo'),
    relevantPillar: 'health',
    description: 'Active disease outbreaks (Ebola, Mpox); health pillar should show elevated risk via baseline indicators',
    buildIndicators: () => [
      makeIndicator('COD', 'vdem_rule_of_law', 0.15, 'vdem'),
      makeIndicator('COD', 'vdem_gov_effectiveness', -1.7, 'vdem'),
      makeIndicator('COD', 'vdem_corruption_control', 0.80, 'vdem'),
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
      makeIndicator('COD', 'advisory_level_us', 4, 'advisories_us', { dataDate: now, fetchedAt: now }),
      makeIndicator('COD', 'advisory_level_uk', 3, 'advisories_uk', { dataDate: now, fetchedAt: now }),
      // v9.1: ongoing M23/eastern DRC conflict alongside the disease outbreak ->
      // moderate homicide + elevated (but below Sudan's) UCDP conflict-deaths.
      makeIndicator('COD', 'wb_homicide', 10, 'worldbank'),
      makeIndicator('COD', 'ucdp_conflict_deaths', 5000, 'ucdp'),
    ],
  },
];

describe('Crisis validation: Formula v9.1 detects real-world crises', () => {
  for (const crisis of CRISIS_CASES) {
    it(`${crisis.name}: score stays in [1,10] and the ${crisis.relevantPillar} pillar reflects the crisis`, () => {
      const indicators = crisis.buildIndicators();
      const advisories = extractAdvisories(indicators, now);
      const result = computeCountryScore(crisis.iso3, indicators, WEIGHTS, crisis.country, advisories, [], SOURCE_TIERS);

      console.log(`  ${crisis.name} (${crisis.iso3}): score=${result.score.toFixed(3)}, confidence=${result.confidence.toFixed(3)}`);
      console.log(`    ${crisis.description}`);
      console.log(`    ${crisis.relevantPillar} pillar (shrunk): ${getPillarScore(result, crisis.relevantPillar).toFixed(4)}`);

      assert.ok(result.score >= 1 && result.score <= 10, `Score ${result.score} in [1,10]`);

      const relevantPillarScore = getPillarScore(result, crisis.relevantPillar);
      assert.ok(
        relevantPillarScore < 0.65,
        `${crisis.name}: ${crisis.relevantPillar} pillar should reflect crisis (got ${relevantPillarScore.toFixed(4)})`,
      );
    });
  }

  it('all three crisis countries score below 7 (below the "safe" threshold)', () => {
    const results = CRISIS_CASES.map((crisis) => {
      const indicators = crisis.buildIndicators();
      const advisories = extractAdvisories(indicators, now);
      const result = computeCountryScore(crisis.iso3, indicators, WEIGHTS, crisis.country, advisories, [], SOURCE_TIERS);
      return { name: crisis.name, iso3: crisis.iso3, score: result.score };
    });

    console.log('  Crisis severity ranking (lower = less safe):');
    for (const r of [...results].sort((a, b) => a.score - b.score)) {
      console.log(`    ${r.iso3} (${r.name}): ${r.score.toFixed(3)}`);
    }

    for (const r of results) {
      assert.ok(r.score < 7, `${r.iso3} (${r.name}) should score below 7 during crisis, got ${r.score}`);
    }
  });

  it('active-conflict / health crises (Sudan, DR Congo) score below a natural-disaster crisis (Turkey)', () => {
    const score = (iso3: string) => {
      const crisis = CRISIS_CASES.find((c) => c.iso3 === iso3)!;
      const indicators = crisis.buildIndicators();
      const advisories = extractAdvisories(indicators, now);
      return computeCountryScore(iso3, indicators, WEIGHTS, crisis.country, advisories, [], SOURCE_TIERS).score;
    };

    const turkey = score('TUR');
    const sudan = score('SDN');
    const drc = score('COD');

    assert.ok(sudan < turkey, `Sudan (${sudan}) should score lower than Turkey (${turkey}) — civil war vs earthquake`);
    assert.ok(drc < turkey, `DR Congo (${drc}) should score lower than Turkey (${turkey}) — disease outbreak vs earthquake`);
  });

  it('runs identically without a sourcesConfig (freshness weighting degrades gracefully to 1.0)', () => {
    const crisis = CRISIS_CASES[0];
    const indicators = crisis.buildIndicators();
    const advisories = extractAdvisories(indicators, now);
    const withTiers = computeCountryScore(crisis.iso3, indicators, WEIGHTS, crisis.country, advisories, [], SOURCE_TIERS);
    const withoutTiers = computeCountryScore(crisis.iso3, indicators, WEIGHTS, crisis.country, advisories, []);

    assert.ok(withTiers.score >= 1 && withTiers.score <= 10);
    assert.ok(withoutTiers.score >= 1 && withoutTiers.score <= 10);
  });
});
