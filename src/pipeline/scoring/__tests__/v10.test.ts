/**
 * Formula v10 engine tests (SPEC .planning/quick/261014-formula-v10/SPEC.md §1-§5):
 * max-age filter, official grey rule + danger guard, calibration, community component.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyMaxAge, formatMaxAgeLog, isAdvisoryRow } from '../max-age.js';
import { DANGER_GUARD, dangerGuardReasons, decideScoreStatus } from '../status.js';
import {
  communityWeight,
  computeCommunityComponent,
  loadCommunitySnapshot,
  parseCommunitySnapshot,
  type CommunityEntry,
} from '../community.js';
import { PILLAR_CALIBRATION_MIN, calibratePillar, computeAllScores } from '../engine.js';
import { normalizeIndicators } from '../normalize.js';
import type { AdvisoryInfo, CommunityConfig, RawIndicator, RawSourceData, WeightsConfig } from '../../types.js';

const WEIGHTS: WeightsConfig = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'pipeline', 'config', 'weights.json'), 'utf-8'),
);
const COMMUNITY: CommunityConfig = WEIGHTS.formulaV9!.community!;
const RUN_DATE = '2026-10-14';

function row(countryIso3: string, indicatorName: string, value: number, year: number, source: string): RawIndicator {
  return { countryIso3, indicatorName, value, year, source };
}

function source(name: string, indicators: RawIndicator[]): [string, RawSourceData] {
  return [name, { source: name, fetchedAt: `${RUN_DATE}T06:00:00.000Z`, indicators }];
}

function advisory(level: number, name: string): AdvisoryInfo {
  return { level, text: '', source: name, url: 'https://example.org' };
}

/** Run computeAllScores against synthetic data with advisory side files in a temp folder. */
function scoreAll(
  sources: Array<[string, RawSourceData]>,
  advisoryInfo: Record<string, Record<string, AdvisoryInfo>>,
  opts: { weights?: WeightsConfig; community?: Map<string, CommunityEntry> | null } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), 'v10-engine-test-'));
  try {
    writeFileSync(join(dir, 'advisories-info.json'), JSON.stringify(advisoryInfo));
    const results = computeAllScores(new Map(sources), opts.weights ?? WEIGHTS, RUN_DATE, {
      rawDir: dir,
      community: opts.community ?? null,
    });
    return new Map(results.map((c) => [c.iso3, c]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A well-covered country: 6 sources (advisories, gpi, inform, vdem, worldbank, ucdp). */
function wellCovered(iso3: string): RawIndicator[][] {
  return [
    [row(iso3, 'advisory_level_us', 1, 2026, 'advisories_us')],
    [row(iso3, 'gpi_conflict', 1.3, 2026, 'gpi'), row(iso3, 'gpi_safety_security', 1.7, 2026, 'gpi')],
    [
      row(iso3, 'inform_natural', 4, 2026, 'inform'),
      row(iso3, 'inform_epidemic', 1.5, 2026, 'inform'),
      row(iso3, 'inform_health_access', 0.6, 2026, 'inform'),
      row(iso3, 'inform_governance', 2.1, 2026, 'inform'),
    ],
    [
      row(iso3, 'vdem_rule_of_law', 0.95, 2025, 'vdem'),
      row(iso3, 'vdem_gov_effectiveness', 2.5, 2025, 'vdem'),
      row(iso3, 'vdem_corruption_control', 0.05, 2025, 'vdem'),
    ],
    [row(iso3, 'wb_homicide', 0.9, 2023, 'worldbank'), row(iso3, 'wb_population', 83_000_000, 2025, 'worldbank')],
    [row(iso3, 'ucdp_conflict_deaths', 0, 2025, 'ucdp')],
  ];
}

function bySource(rowsList: RawIndicator[][]): Array<[string, RawSourceData]> {
  const merged = new Map<string, RawIndicator[]>();
  for (const rows of rowsList) {
    for (const r of rows) {
      const key = r.source.startsWith('advisories') ? 'advisories' : r.source;
      merged.set(key, [...(merged.get(key) ?? []), r]);
    }
  }
  return [...merged].map(([key, rows]) => source(key, rows));
}

/* -------------------------------------------------------------------------- */
/* Max-age filter                                                              */
/* -------------------------------------------------------------------------- */

describe('v10 max-age filter', () => {
  const data = new Map<string, RawSourceData>([
    source('vdem', [row('VAT', 'vdem_rule_of_law', 0.9, 1870, 'vdem'), row('DEU', 'vdem_rule_of_law', 0.95, 2025, 'vdem')]),
    source('worldbank', [
      row('AFG', 'wb_homicide', 4, 2016, 'worldbank'),
      row('AFG', 'wb_homicide_recent', 4, 2021, 'worldbank'),
      row('TUV', 'wb_population', 11_000, 2012, 'worldbank'),
    ]),
    source('advisories', [row('AFG', 'advisory_level_us', 4, 1999, 'advisories_us')]),
  ]);

  it('drops non-advisory rows older than run year - 5 and keeps the boundary year', () => {
    const result = applyMaxAge(data, 2026, 5);
    assert.equal(result.minYear, 2021);
    assert.deepEqual(
      result.dropped.map((d) => `${d.countryIso3}:${d.indicatorName}:${d.year}`).sort(),
      ['AFG:wb_homicide:2016', 'VAT:vdem_rule_of_law:1870'],
    );
    assert.equal(result.data.get('vdem')!.indicators.length, 1);
    assert.ok(result.data.get('worldbank')!.indicators.some((i) => i.year === 2021), '2021 = run year - 5 is still in');
  });

  it('never drops advisories, and exempts wb_population (an engine input, not a scored value)', () => {
    const result = applyMaxAge(data, 2026, 5);
    assert.equal(result.data.get('advisories')!.indicators.length, 1);
    assert.ok(result.data.get('worldbank')!.indicators.some((i) => i.indicatorName === 'wb_population'));
    assert.equal(isAdvisoryRow('advisories_tier1', row('X', 'advisory_level_fr', 2, 2000, 'advisories_fr')), true);
  });

  it('is the identity without maxAgeYears (pre-v10 configs) and never mutates its input', () => {
    const before = JSON.stringify([...data]);
    const identity = applyMaxAge(data, 2026, undefined);
    assert.equal(identity.data, data);
    assert.deepEqual(identity.dropped, []);
    applyMaxAge(data, 2026, 5);
    assert.equal(JSON.stringify([...data]), before, 'input map untouched');
  });

  it('logs one line per indicator with the country/year pairs', () => {
    const lines = formatMaxAgeLog(applyMaxAge(data, 2026, 5));
    assert.match(lines[0], /2 row\(s\) with data year < 2021/);
    assert.ok(lines.includes('[MAX-AGE] vdem_rule_of_law: 1 row(s) dropped: VAT 1870'));
    assert.ok(lines.includes('[MAX-AGE] wb_homicide: 1 row(s) dropped: AFG 2016'));
  });
});

/* -------------------------------------------------------------------------- */
/* Official grey rule + danger guard                                           */
/* -------------------------------------------------------------------------- */

describe('v10 scoreStatus and danger guard (unit)', () => {
  const calm = { level4Governments: 0, severeShare: 0, ucdpDeaths: 0 };

  it('the guard thresholds are the SPEC invariant', () => {
    assert.deepEqual({ ...DANGER_GUARD }, { minLevel4Governments: 3, minSevereShare: 0.5, minUcdpDeaths: 0 });
  });

  it('grey below the source floor without danger, scored at or above it', () => {
    assert.equal(decideScoreStatus(3, 4, calm).status, 'insufficient_data');
    assert.equal(decideScoreStatus(4, 4, calm).status, 'scored');
    assert.equal(decideScoreStatus(0, undefined, calm).status, 'scored', 'no floor configured = pre-v10 behaviour');
  });

  it('each guard condition alone keeps a data-poor country scored', () => {
    for (const signals of [
      { level4Governments: 3, severeShare: 0, ucdpDeaths: 0 },
      { level4Governments: 0, severeShare: 0.5, ucdpDeaths: null },
      { level4Governments: 0, severeShare: 0, ucdpDeaths: 1 },
    ]) {
      const decision = decideScoreStatus(1, 4, signals);
      assert.equal(decision.status, 'scored', JSON.stringify(signals));
      assert.equal(decision.guardApplied, true);
      assert.equal(decision.guardReasons.length, 1);
    }
  });

  it('just below every threshold is not danger', () => {
    assert.deepEqual(dangerGuardReasons({ level4Governments: 2, severeShare: 0.49, ucdpDeaths: 0 }), []);
    assert.deepEqual(dangerGuardReasons({ level4Governments: 0, severeShare: 0, ucdpDeaths: null }), []);
  });
});

describe('v10 computeAllScores: grey countries and the danger guard (synthetic, end to end)', () => {
  // SOM: data-poor (advisories + UCDP = 2 sources) but three governments at level 4.
  // TUV: data-poor (advisories + inform = 2 sources), calm.
  // DEU: six sources.
  const sources = bySource([
    ...wellCovered('DEU'),
    [row('SOM', 'advisory_level_us', 4, 2026, 'advisories_us')],
    [row('SOM', 'ucdp_conflict_deaths', 0, 2025, 'ucdp')],
    [row('TUV', 'advisory_level_us', 1, 2026, 'advisories_us')],
    [row('TUV', 'inform_natural', 5, 2026, 'inform')],
  ]);
  const info = {
    DEU: { us: advisory(1, 'US State Department') },
    SOM: { us: advisory(4, 'US'), uk: advisory(4, 'UK'), ca: advisory(4, 'CA') },
    TUV: { us: advisory(1, 'US State Department') },
  };

  it('a dangerous but data-poor country stays scored (3 governments at level 4)', () => {
    const scored = scoreAll(sources, info);
    const som = scored.get('SOM')!;
    assert.equal(som.sources.length, 2);
    assert.equal(som.scoreStatus, 'scored');
    assert.equal(typeof som.score, 'number');
    assert.equal(typeof som.dataScore, 'number');
    assert.ok(som.score! < 5, `a level-4 country must not look safe, got ${som.score}`);
  });

  it('a dangerous but data-poor country stays scored on UCDP deaths alone', () => {
    const deadly = bySource([
      [row('SOM', 'advisory_level_us', 2, 2026, 'advisories_us')],
      [row('SOM', 'ucdp_conflict_deaths', 340, 2025, 'ucdp')],
    ]);
    const som = scoreAll(deadly, { SOM: { us: advisory(2, 'US') } }).get('SOM')!;
    assert.equal(som.scoreStatus, 'scored');
  });

  it('a calm data-poor place is grey: score, scoreDisplay and dataScore are null, pillars kept', () => {
    const tuv = scoreAll(sources, info).get('TUV')!;
    assert.equal(tuv.scoreStatus, 'insufficient_data');
    assert.equal(tuv.score, null);
    assert.equal(tuv.scoreDisplay, null);
    assert.equal(tuv.dataScore, null);
    assert.equal(tuv.pillars.length, 5, 'pillars are kept internally for transparency');
    assert.equal(tuv.community?.adjustment, 0);
  });

  it('a well-covered country is scored, and without community input score = dataScore', () => {
    const deu = scoreAll(sources, info).get('DEU')!;
    assert.equal(deu.scoreStatus, 'scored');
    assert.equal(deu.sources.length, 6);
    assert.equal(deu.score, deu.dataScore);
    assert.equal(deu.scoreDisplay, Math.round(deu.score!));
  });

  it('stale rows do not count as a source: a country whose only V-Dem row is from 1870 loses that source', () => {
    const vat = bySource([
      [row('VAT', 'advisory_level_us', 1, 2026, 'advisories_us')],
      [row('VAT', 'inform_natural', 2, 2026, 'inform')],
      [row('VAT', 'wb_population', 800, 2025, 'worldbank')],
      [row('VAT', 'vdem_rule_of_law', 0.9, 1870, 'vdem')],
    ]);
    const result = scoreAll(vat, { VAT: { us: advisory(1, 'US') } }).get('VAT')!;
    assert.deepEqual(result.sources.map((s) => s.name).sort(), ['advisories', 'inform', 'worldbank']);
    assert.equal(result.scoreStatus, 'insufficient_data', '3 in-age sources < 4');
    const governance = result.pillars.find((p) => p.name === 'governance')!;
    assert.equal(governance.indicators.some((i) => i.name === 'vdem_rule_of_law'), false, 'the 1870 value is not scored');
  });

  it('pre-v10 config (no minSources/maxAgeYears): every country is scored, as in v9.1', () => {
    const { minSources, maxAgeYears, ...legacyF9 } = WEIGHTS.formulaV9!;
    void minSources;
    void maxAgeYears;
    const legacy: WeightsConfig = { ...WEIGHTS, formulaV9: legacyF9 };
    const tuv = scoreAll(sources, info, { weights: legacy }).get('TUV')!;
    assert.equal(tuv.scoreStatus, 'scored');
    assert.equal(typeof tuv.score, 'number');
  });
});

/* -------------------------------------------------------------------------- */
/* Calibration                                                                 */
/* -------------------------------------------------------------------------- */

describe('v10 per-pillar scale continuity', () => {
  it('maps p to alpha + beta * p and clamps to [0.001, 1]', () => {
    assert.equal(calibratePillar(0.5, { alpha: 0.1, beta: 0.8 }), 0.5);
    assert.equal(calibratePillar(0.95, { alpha: 0.2, beta: 1 }), 1);
    assert.equal(calibratePillar(0.05, { alpha: -0.2, beta: 1 }), PILLAR_CALIBRATION_MIN);
  });

  it('is the identity for a pillar without a map', () => {
    assert.equal(calibratePillar(0.6123, undefined), 0.6123);
  });

  it('weights.json maps exactly health, governance and environment, never crime or conflict, and has no global calibration', () => {
    const f9 = WEIGHTS.formulaV9! as typeof WEIGHTS.formulaV9 & { calibration?: unknown };
    assert.deepEqual(Object.keys(f9.pillarCalibration ?? {}).sort(), ['environment', 'governance', 'health']);
    for (const cal of Object.values(f9.pillarCalibration!)) {
      assert.ok(Number.isFinite(cal!.alpha) && Number.isFinite(cal!.beta) && cal!.beta > 0);
    }
    assert.equal(f9.calibration, undefined, 'the global affine calibration is gone');
  });

  it('the engine maps the shrunk pillar BEFORE aggregation: the mapped value is published and drives the score', () => {
    const sources = bySource(wellCovered('DEU'));
    const info = { DEU: { us: advisory(1, 'US') } };
    const base = scoreAll(sources, info, { weights: { ...WEIGHTS, formulaV9: { ...WEIGHTS.formulaV9!, pillarCalibration: {} } } }).get('DEU')!;
    // A degenerate map (beta 0) pins health at 0.2: the published pillar and the score must both follow it.
    const pinned = scoreAll(sources, info, {
      weights: { ...WEIGHTS, formulaV9: { ...WEIGHTS.formulaV9!, pillarCalibration: { health: { alpha: 0.2, beta: 0 } } } },
    }).get('DEU')!;
    const pillar = (c: typeof base, name: string) => c.pillars.find((p) => p.name === name)!.score;
    assert.equal(pillar(pinned, 'health'), 0.2);
    assert.ok(pillar(base, 'health') > 0.2);
    for (const other of ['conflict', 'crime', 'governance', 'environment']) {
      assert.equal(pillar(pinned, other), pillar(base, other), `${other} is untouched`);
    }
    assert.ok(pinned.score! < base.score!, 'a lower mapped health pillar lowers the score');
    assert.equal(pinned.confidence, base.confidence, 'confidence (evidence) does not depend on the scale map');
  });

});

/* -------------------------------------------------------------------------- */
/* Community component                                                         */
/* -------------------------------------------------------------------------- */

function entry(overrides: Partial<CommunityEntry> = {}): CommunityEntry {
  return { iso3: 'DEU', votes: 60, origins: 5, topOriginShare: 0.4, nEff: 30, perceived: 9, status: 'active', ...overrides };
}

describe('v10 community: snapshot contract', () => {
  it('accepts the v10 shape and an empty snapshot', () => {
    const lookup = parseCommunitySnapshot({ generatedAt: 'x', countries: { DEU: entry() } });
    assert.equal(lookup?.get('DEU')?.perceived, 9);
    assert.equal(parseCommunitySnapshot({ generatedAt: 'x', countries: {} })?.size, 0);
  });

  it('treats the pre-v10 shape (count/avgDelta/correction/official) as absent', () => {
    const v91 = {
      generatedAt: 'x',
      countries: { CHN: { iso3: 'CHN', count: 73, avgDelta: 1.34, correction: 0.5, perceived: 7.3, official: 6.8 } },
    };
    assert.equal(parseCommunitySnapshot(v91), null);
  });

  it('rejects the whole file when any entry is malformed, so a half-written file moves nothing', () => {
    assert.equal(parseCommunitySnapshot({ countries: { DEU: entry(), FRA: { ...entry({ iso3: 'FRA' }), nEff: 'x' } } }), null);
    assert.equal(parseCommunitySnapshot({ countries: { DEU: { ...entry(), topOriginShare: 1.5 } } }), null);
    assert.equal(parseCommunitySnapshot(null), null);
    assert.equal(parseCommunitySnapshot({ countries: [] }), null);
  });

  it('a missing file loads as null (no adjustment)', () => {
    assert.equal(loadCommunitySnapshot(join(tmpdir(), 'definitely-missing-sentiment-latest.json')), null);
  });
});

describe('v10 community: adjustment bounds', () => {
  it('Z = nEff / (nEff + 30), adjustment = Z * (P - S_data) inside the cap', () => {
    assert.equal(communityWeight(30, 30), 0.5);
    const { component } = computeCommunityComponent(entry({ nEff: 30, perceived: 7.0 }), 6.6, COMMUNITY);
    assert.equal(component.status, 'active');
    assert.ok(Math.abs(component.adjustment - 0.2) < 1e-12);
  });

  it('never exceeds +/- 1.0 point, however far P is from S_data', () => {
    const up = computeCommunityComponent(entry({ nEff: 1000, perceived: 10 }), 3, COMMUNITY).component;
    const down = computeCommunityComponent(entry({ nEff: 1000, perceived: 1 }), 9, COMMUNITY).component;
    assert.equal(up.adjustment, 1.0);
    assert.equal(down.adjustment, -1.0);
  });

  it('an insufficient community does not move the score but keeps its progress numbers', () => {
    const { component } = computeCommunityComponent(entry({ status: 'insufficient', votes: 12, origins: 2 }), 6, COMMUNITY);
    assert.deepEqual(component, { status: 'insufficient', votes: 12, origins: 2, perceived: 9, adjustment: 0 });
  });

  it('re-checks the floors: an entry marked active with 29 votes, 2 origins or a 0.6 origin share is not applied', () => {
    for (const bad of [{ votes: 29 }, { origins: 2 }, { topOriginShare: 0.6 }]) {
      const result = computeCommunityComponent(entry(bad), 6, COMMUNITY);
      assert.equal(result.component.status, 'insufficient', JSON.stringify(bad));
      assert.equal(result.component.adjustment, 0);
      assert.equal(result.rejectedActive, true);
    }
  });

  it('a grey official country never gets a score from votes, but keeps the community rating P for display', () => {
    const { component } = computeCommunityComponent(entry({ perceived: 8.5 }), null, COMMUNITY);
    assert.equal(component.status, 'active');
    assert.equal(component.adjustment, 0);
    assert.equal(component.perceived, 8.5);
  });

  it('absent entry or absent config = inert component', () => {
    assert.deepEqual(computeCommunityComponent(undefined, 6, COMMUNITY).component, {
      status: 'insufficient', votes: 0, origins: 0, perceived: null, adjustment: 0,
    });
    assert.equal(computeCommunityComponent(entry(), 6, undefined).component.adjustment, 0);
  });
});

describe('v10 community: engine integration', () => {
  const sources = bySource([...wellCovered('DEU'), [row('TUV', 'advisory_level_us', 1, 2026, 'advisories_us')]]);
  const info = { DEU: { us: advisory(1, 'US') }, TUV: { us: advisory(1, 'US') } };

  it('score = clamp(S_data + adjustment, 1, 10); no lookup = no adjustment', () => {
    const base = scoreAll(sources, info).get('DEU')!;
    assert.equal(base.community?.status, 'insufficient');
    assert.equal(base.score, base.dataScore);

    const community = new Map([['DEU', entry({ nEff: 30, perceived: 1 })]]);
    const adjusted = scoreAll(sources, info, { community }).get('DEU')!;
    assert.equal(adjusted.dataScore, base.dataScore, 'the data score is independent of votes');
    const expectedAdj = Math.max(-1, 0.5 * (1 - base.dataScore!));
    assert.ok(Math.abs(adjusted.community!.adjustment - expectedAdj) < 1e-12);
    assert.ok(Math.abs(adjusted.score! - (base.dataScore! + expectedAdj)) < 1e-12);
    assert.ok(adjusted.score! >= base.dataScore! - 1 - 1e-12);
  });

  it('a grey country with an active community stays grey', () => {
    const community = new Map([['TUV', entry({ iso3: 'TUV', perceived: 9.5 })]]);
    const tuv = scoreAll(sources, info, { community }).get('TUV')!;
    assert.equal(tuv.scoreStatus, 'insufficient_data');
    assert.equal(tuv.score, null);
    assert.equal(tuv.community?.status, 'active');
    assert.equal(tuv.community?.perceived, 9.5);
  });
});

describe('v10 normalisation of the new indicators', () => {
  it('gpi_conflict is the 1-5 GPI scale inverted; inform_health_access is 0-10 inverted', () => {
    const out = normalizeIndicators([
      row('DEU', 'gpi_conflict', 1, 2026, 'gpi'),
      row('ISR', 'gpi_conflict', 3, 2026, 'gpi'),
      row('XXX', 'gpi_conflict', 5, 2026, 'gpi'),
      row('DEU', 'inform_health_access', 0.6, 2026, 'inform'),
    ]);
    assert.deepEqual(out.map((o) => o.normalizedValue), [1, 0.5, 0, 0.94]);
  });
});
