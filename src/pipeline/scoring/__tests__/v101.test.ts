/**
 * Formula v10.1 engine tests (2026-10-15 consistency audit, weights.json `_comment_v101`):
 *  - I10: a level-3 advisory counts at half weight in the severe-advisory modifier, while the
 *    danger guard still reads level 4 only;
 *  - I49: the natural-hazards indicator is exposure combined with INFORM's lack of coping capacity;
 *  - I66: the UCDP conflict-death curve keeps falling past D_MAX inside the conflict pillar;
 *  - I42: the prior has no 0.60 ceiling any more;
 *  - the v10 configuration (scripts/lib/v10-fixture.ts) that the frozen pillar maps are
 *    reproduced under.
 * Each test compares the committed weights with the same weights minus the one change, so it
 * pins the mechanism, not today's data.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { advisorySeverity, computeAllScores, naturalHazardRisk, ucdpConflictValue } from '../engine.js';
import { normalizeIndicators } from '../normalize.js';
import { V101_OPTION_KEYS, V10_CHANGED_CONSTANTS, v10Configuration } from '../../../../scripts/lib/v10-fixture.js';
import type { AdvisoryInfo, RawIndicator, RawSourceData, ScoredCountry, WeightsConfig } from '../../types.js';

const WEIGHTS: WeightsConfig = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'pipeline', 'config', 'weights.json'), 'utf-8'),
);
const RUN_DATE = '2026-10-15';

/** Tier-weighted governments that enter the consensus (none excluded, none rebased). */
const GOVERNMENTS = ['us', 'uk', 'ca', 'au', 'de', 'nl', 'fr', 'fi', 'br', 'ph', 'dk', 'sg', 'ro', 'rs', 'ee', 'hr', 'it', 'kr', 'tw', 'se'];

function row(countryIso3: string, indicatorName: string, value: number, year: number, source: string): RawIndicator {
  return { countryIso3, indicatorName, value, year, source };
}

function advisories(levels: number[]): Record<string, AdvisoryInfo> {
  return Object.fromEntries(levels.map((level, i) => [GOVERNMENTS[i], { level, text: '', source: GOVERNMENTS[i], url: 'https://example.org' }]));
}

/** Weights without one v10.1 change: the option removed, or the changed constant set back to v10. */
function without(key: string): WeightsConfig {
  const w = JSON.parse(JSON.stringify(WEIGHTS)) as WeightsConfig;
  const f9 = w.formulaV9 as unknown as Record<string, unknown>;
  if (key in V10_CHANGED_CONSTANTS) f9[key] = (V10_CHANGED_CONSTANTS as Record<string, number>)[key];
  else delete f9[key];
  return w;
}

/** A country with all six coverage sources (the values are those of a calm, well-run place). */
function wellCovered(iso3: string, extra: RawIndicator[] = []): Array<[string, RawSourceData]> {
  const groups: Record<string, RawIndicator[]> = {
    gpi: [row(iso3, 'gpi_overall', 1.6, 2026, 'gpi'), row(iso3, 'gpi_militarisation', 1.8, 2026, 'gpi'), row(iso3, 'gpi_safety_security', 1.7, 2026, 'gpi')],
    inform: [
      row(iso3, 'inform_natural', 4, 2026, 'inform'),
      row(iso3, 'inform_epidemic', 1.5, 2026, 'inform'),
      row(iso3, 'inform_health_access', 0.6, 2026, 'inform'),
      row(iso3, 'inform_governance', 2.1, 2026, 'inform'),
    ],
    vdem: [row(iso3, 'vdem_rule_of_law', 0.9, 2025, 'vdem'), row(iso3, 'vdem_gov_effectiveness', 2, 2025, 'vdem'), row(iso3, 'vdem_corruption_control', 0.1, 2025, 'vdem')],
    worldbank: [row(iso3, 'wb_homicide', 1.2, 2023, 'worldbank'), row(iso3, 'wb_population', 50_000_000, 2025, 'worldbank')],
    ucdp: [row(iso3, 'ucdp_conflict_deaths', 0, 2025, 'ucdp')],
    advisories: [row(iso3, 'advisory_level_us', 1, 2026, 'advisories_us')],
  };
  for (const ind of extra) {
    const list = groups[ind.source] ?? (groups[ind.source] = []);
    const i = list.findIndex((x) => x.indicatorName === ind.indicatorName);
    if (i >= 0) list[i] = ind;
    else list.push(ind);
  }
  return Object.entries(groups).map(([name, indicators]) => [name, { source: name, fetchedAt: `${RUN_DATE}T06:00:00.000Z`, indicators }]);
}

function scoreOne(
  iso3: string,
  sources: Array<[string, RawSourceData]>,
  advisoryInfo: Record<string, AdvisoryInfo>,
  weights: WeightsConfig,
): ScoredCountry {
  const dir = mkdtempSync(join(tmpdir(), 'v101-engine-test-'));
  const log = console.log;
  console.log = () => {};
  try {
    writeFileSync(join(dir, 'advisories-info.json'), JSON.stringify({ [iso3]: advisoryInfo }));
    const results = computeAllScores(new Map(sources), weights, RUN_DATE, { rawDir: dir, community: null });
    return results.find((c) => c.iso3 === iso3)!;
  } finally {
    console.log = log;
    rmSync(dir, { recursive: true, force: true });
  }
}

const pillar = (c: ScoredCountry, name: string) => c.pillars.find((p) => p.name === name)!;
/** composite = ((score - 1) / 9)^(1/gamma): the quantity the severe modifier multiplies. */
const composite = (score: number) => Math.pow((score - 1) / 9, 1 / WEIGHTS.formulaV9!.gamma);

describe('Formula v10.1 weights.json', () => {
  it('is version 10.1.x and carries the four v10.1 values', () => {
    assert.match(WEIGHTS.version, /^10\.1\./);
    const f9 = WEIGHTS.formulaV9!;
    assert.equal(f9.severeLevel3Weight, 0.5);
    assert.equal(f9.naturalHazardCoping, 'inform_coping');
    assert.equal(f9.ucdpTailFloor, -0.5);
    assert.equal(f9.muClampMax, 1.0);
  });

  it('keeps the v10 per-pillar maps frozen (only health, governance, environment)', () => {
    assert.deepEqual(WEIGHTS.formulaV9!.pillarCalibration, {
      health: { alpha: 0.161743, beta: 0.913643 },
      governance: { alpha: 0.019734, beta: 0.970809 },
      environment: { alpha: -0.113726, beta: 1.311236 },
    });
  });

  it('v10Configuration removes every v10.1 option and restores the changed constants', () => {
    const v10 = v10Configuration(WEIGHTS).formulaV9 as unknown as Record<string, unknown>;
    for (const key of V101_OPTION_KEYS) assert.equal(key in v10, false, `${key} must be absent in the v10 configuration`);
    assert.equal(v10.muClampMax, 0.6);
    assert.deepEqual(v10.pillarCalibration, WEIGHTS.formulaV9!.pillarCalibration);
    assert.equal(WEIGHTS.formulaV9!.muClampMax, 1.0, 'the committed weights are not mutated');
  });
});

describe('Formula v10.1 (I10): level 3 in the severe-advisory modifier', () => {
  it('weighs level 4 fully, level 3 at the configured share, levels 1-2 not at all', () => {
    assert.equal(advisorySeverity(4, 0.5), 1);
    assert.equal(advisorySeverity(3, 0.5), 0.5);
    assert.equal(advisorySeverity(3, 0), 0);
    assert.equal(advisorySeverity(2, 0.5), 0);
    assert.equal(advisorySeverity(1, 0.5), 0);
  });

  it('a "reconsider travel" consensus lowers the composite by exactly the modifier', () => {
    const levels = new Array(8).fill(3);
    const v101 = scoreOne('ARE', wellCovered('ARE'), advisories(levels), WEIGHTS);
    const v10 = scoreOne('ARE', wellCovered('ARE'), advisories(levels), without('severeLevel3Weight'));
    // 8 governments, all level 3: severity share 0.5, damping 8/(8+6), ramp 1 => factor 1 - 0.32 * 0.5 * 8/14.
    const expected = 1 - WEIGHTS.formulaV9!.S_MAX * 0.5 * (8 / (8 + WEIGHTS.formulaV9!.N_SEV));
    assert.ok(Math.abs(composite(v101.dataScore!) / composite(v10.dataScore!) - expected) < 1e-12);
    assert.ok(v101.dataScore! < v10.dataScore!);
    for (const p of ['conflict', 'crime', 'health', 'governance', 'environment']) {
      assert.equal(pillar(v101, p).score, pillar(v10, p).score, `${p} pillar is untouched: only the modifier changes`);
    }
  });

  it('changes nothing when no government is at level 3', () => {
    const levels = [1, 2, 2, 1, 4, 2, 1, 2];
    const v101 = scoreOne('ARE', wellCovered('ARE'), advisories(levels), WEIGHTS);
    const v10 = scoreOne('ARE', wellCovered('ARE'), advisories(levels), without('severeLevel3Weight'));
    assert.equal(v101.dataScore, v10.dataScore);
  });

  it('does not feed the danger guard: a data-poor place with only level-3 advisories stays grey', () => {
    const sources: Array<[string, RawSourceData]> = [
      ['advisories', { source: 'advisories', fetchedAt: `${RUN_DATE}T06:00:00.000Z`, indicators: [row('TUV', 'advisory_level_us', 3, 2026, 'advisories_us')] }],
    ];
    const grey = scoreOne('TUV', sources, advisories(new Array(12).fill(3)), WEIGHTS);
    assert.equal(grey.scoreStatus, 'insufficient_data');
    assert.equal(grey.score, null);
  });
});

describe('Formula v10.1 (I49): natural hazards weighed by coping capacity', () => {
  it('naturalHazardRisk is 1 - sqrt(exposure x lack of coping)/10, bounded to [0, 1]', () => {
    assert.ok(Math.abs(naturalHazardRisk(8.3, 0.9) - (1 - Math.sqrt(8.3 * 0.9) / 10)) < 1e-12);
    assert.equal(naturalHazardRisk(0, 9), 1, 'no hazard, no risk whatever the coping capacity');
    assert.equal(naturalHazardRisk(10, 10), 0);
    assert.ok(naturalHazardRisk(8.3, 0.9) > naturalHazardRisk(4.9, 3.4), 'a prepared exposed country (Japan) beats a less prepared, less exposed one (Italy)');
  });

  it('replaces the exposure-only value of inform_natural, keeps its raw value, never lists the coping input', () => {
    const extra = [row('JPN', 'inform_natural', 8.3, 2026, 'inform'), row('JPN', 'inform_coping', 0.9, 2026, 'inform')];
    const v101 = scoreOne('JPN', wellCovered('JPN', extra), advisories([1, 1, 1, 1, 1, 1]), WEIGHTS);
    const v10 = scoreOne('JPN', wellCovered('JPN', extra), advisories([1, 1, 1, 1, 1, 1]), without('naturalHazardCoping'));
    const natural = (c: ScoredCountry) => pillar(c, 'environment').indicators.find((i) => i.name === 'inform_natural')!;
    assert.equal(natural(v101).rawValue, 8.3);
    assert.ok(Math.abs(natural(v101).normalizedValue - naturalHazardRisk(8.3, 0.9)) < 1e-12);
    assert.ok(Math.abs(natural(v10).normalizedValue - (1 - 8.3 / 10)) < 1e-12);
    assert.ok(pillar(v101, 'environment').score > pillar(v10, 'environment').score);
    const listed = v101.pillars.flatMap((p) => p.indicators.map((i) => i.name));
    assert.equal(listed.includes('inform_coping'), false);
  });

  it('falls back to exposure only when the coping row is missing', () => {
    const v101 = scoreOne('JPN', wellCovered('JPN', [row('JPN', 'inform_natural', 8.3, 2026, 'inform')]), advisories([1, 1, 1]), WEIGHTS);
    const natural = pillar(v101, 'environment').indicators.find((i) => i.name === 'inform_natural')!;
    assert.ok(Math.abs(natural.normalizedValue - (1 - 8.3 / 10)) < 1e-12);
  });
});

describe('Formula v10.1 (I66): conflict deaths past D_MAX', () => {
  const D_MAX = WEIGHTS.formulaV9!.D_MAX;

  it('equals the v9.1 curve up to D_MAX and keeps falling after it, down to the floor', () => {
    for (const deaths of [0, 41, 280, 4333, D_MAX]) {
      const published = normalizeIndicators([row('SDN', 'ucdp_conflict_deaths', deaths, 2025, 'ucdp')])[0].normalizedValue;
      assert.ok(Math.abs(ucdpConflictValue(deaths, D_MAX, -0.5) - published) < 1e-12, `${deaths} deaths`);
    }
    assert.ok(ucdpConflictValue(75_044, D_MAX, -0.5) < 0, 'a 75,000-death war is below the knee');
    assert.ok(ucdpConflictValue(90_345, D_MAX, -0.5) < ucdpConflictValue(75_044, D_MAX, -0.5));
    assert.equal(ucdpConflictValue(1e9, D_MAX, -0.5), -0.5);
  });

  it('lowers the conflict pillar of a war past D_MAX, leaves the published value in [0, 1] and smaller wars alone', () => {
    const war = [row('SDN', 'ucdp_conflict_deaths', 75_044, 2025, 'ucdp')];
    const v101 = scoreOne('SDN', wellCovered('SDN', war), advisories(new Array(10).fill(4)), WEIGHTS);
    const v10 = scoreOne('SDN', wellCovered('SDN', war), advisories(new Array(10).fill(4)), without('ucdpTailFloor'));
    assert.ok(pillar(v101, 'conflict').score < pillar(v10, 'conflict').score);
    const ucdp = pillar(v101, 'conflict').indicators.find((i) => i.name === 'ucdp_conflict_deaths')!;
    assert.equal(ucdp.normalizedValue, 0);

    const smaller = [row('BFA', 'ucdp_conflict_deaths', 4_333, 2025, 'ucdp')];
    const a = scoreOne('BFA', wellCovered('BFA', smaller), advisories(new Array(10).fill(4)), WEIGHTS);
    const b = scoreOne('BFA', wellCovered('BFA', smaller), advisories(new Array(10).fill(4)), without('ucdpTailFloor'));
    assert.equal(pillar(a, 'conflict').score, pillar(b, 'conflict').score);
  });
});

describe('Formula v10.1 (I42): the prior without its 0.60 ceiling', () => {
  // A pillar with no data at all is the prior itself (crime and conflict are not mapped).
  const calmEurope = (weights: WeightsConfig) =>
    scoreOne('LIE', [['advisories', { source: 'advisories', fetchedAt: `${RUN_DATE}T06:00:00.000Z`, indicators: [row('LIE', 'advisory_level_us', 1, 2026, 'advisories_us')] }]], advisories(new Array(20).fill(1)), weights);

  it('lets unanimous level-1 advisories lift a data-poor pillar above 0.60, to the nudge bound', () => {
    const f9 = WEIGHTS.formulaV9!;
    // Europe offset +0.05; A = 1; 20 governments; full ramp.
    const expected = f9.muBase + f9.regionOffset.europe + 0.5 * f9.nudgeScale * (20 / (20 + f9.nudgeDenom));
    assert.ok(expected > 0.6);
    assert.ok(Math.abs(pillar(calmEurope(WEIGHTS), 'crime').score - expected) < 1e-12);
    assert.equal(pillar(calmEurope(without('muClampMax')), 'crime').score, 0.6, 'v10 capped it at 0.60');
  });

  it('never lifts the prior above the bound of the nudge (0.675 with any number of governments)', () => {
    const f9 = WEIGHTS.formulaV9!;
    const bound = f9.muBase + Math.max(...Object.values(f9.regionOffset)) + 0.5 * f9.nudgeScale;
    assert.ok(bound <= 0.675 + 1e-12);
    assert.ok(pillar(calmEurope(WEIGHTS), 'crime').score < bound);
  });

  it('still lets a danger signal pull the prior down, exactly as in v10', () => {
    const f9 = WEIGHTS.formulaV9!;
    const levels = new Array(20).fill(4);
    const danger = (weights: WeightsConfig) =>
      scoreOne('LIE', [['advisories', { source: 'advisories', fetchedAt: `${RUN_DATE}T06:00:00.000Z`, indicators: [row('LIE', 'advisory_level_us', 4, 2026, 'advisories_us')] }]], advisories(levels), weights);
    const expected = f9.muBase + f9.regionOffset.europe - 0.5 * f9.nudgeScale * (20 / (20 + f9.nudgeDenom));
    assert.ok(Math.abs(pillar(danger(WEIGHTS), 'crime').score - expected) < 1e-12);
    assert.ok(expected < f9.muBase);
    assert.equal(pillar(danger(WEIGHTS), 'crime').score, pillar(danger(without('muClampMax')), 'crime').score);
  });
});
