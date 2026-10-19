/**
 * The shared data-coverage floor (scoring/coverage.ts): one definition for the engine's grey
 * rule, the rankings, llms.txt and the news engine; disaster-alert feeds never count.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  ADVISORY_SOURCE,
  EVENT_FEED_SOURCES,
  MIN_COVERAGE_SOURCES,
  REQUIRED_PILLARS,
  coverageShortfall,
  coverageSourceCount,
  isEventFeedSource,
  meetsCoverageFloor,
  missingRequiredPillars,
  sourcesSupplyingScoredValues,
  suppliesScoredValue,
} from '../coverage.js';
import { computeAllScores } from '../engine.js';
import { hasSufficientData } from '../../../lib/hub-data.js';
import { greySourceItems } from '../../../i18n/grey-copy.js';
import type { RawIndicator, RawSourceData, ScoredCountry, WeightsConfig } from '../../types.js';

const named = (...names: string[]) => names.map((name) => ({ name }));

describe('coverage floor', () => {
  it('MIN_COVERAGE_SOURCES equals weights.json formulaV9.minSources (the engine reads the JSON)', () => {
    const weights = JSON.parse(readFileSync(join(process.cwd(), 'src', 'pipeline', 'config', 'weights.json'), 'utf-8'));
    assert.equal(MIN_COVERAGE_SOURCES, weights.formulaV9.minSources);
  });

  it('the event feeds are exactly GDACS and ReliefWeb', () => {
    assert.deepEqual([...EVENT_FEED_SOURCES].sort(), ['gdacs', 'reliefweb']);
    assert.equal(isEventFeedSource('gdacs'), true);
    assert.equal(isEventFeedSource('worldbank'), false);
    assert.equal(isEventFeedSource(undefined), false);
  });

  it('counts every source except the disaster-alert feeds', () => {
    assert.equal(coverageSourceCount(named('advisories', 'worldbank', 'reliefweb', 'gdacs')), 2);
    assert.equal(coverageSourceCount(named('advisories', 'gpi', 'inform', 'vdem', 'worldbank', 'ucdp', 'gdacs')), 6);
    assert.equal(coverageSourceCount(undefined), 0);
    assert.equal(coverageSourceCount([{}]), 1, 'an unnamed entry is still a source, as before');
  });

  it('the floor: four coverage sources pass, three plus alerts do not', () => {
    assert.equal(meetsCoverageFloor({ sources: named('advisories', 'worldbank', 'inform', 'vdem') }), true);
    assert.equal(meetsCoverageFloor({ sources: named('advisories', 'worldbank', 'inform', 'gdacs', 'reliefweb') }), false);
  });

  it('rankings use the same floor: a scored place whose fourth source is an alert is not ranked', () => {
    const place = (sources: string[]) => ({ iso3: 'GUM', score: 6.55, scoreStatus: 'scored', sources: named(...sources) }) as unknown as ScoredCountry;
    assert.equal(hasSufficientData(place(['advisories', 'worldbank', 'reliefweb', 'gdacs'])), false);
    assert.equal(hasSufficientData(place(['advisories', 'worldbank', 'inform', 'vdem'])), true);
  });
});

// Owner decision 2026-10-19 (scripts/calibration/coverage-floor-study.ts): four sources are not
// enough when none of them measures crime. Cabo Verde (advisories, INFORM, UCDP, V-Dem) has four,
// but its crime pillar is the prior alone, and the study measured such scores 0.5 too low.
describe('required pillars: no crime value, no official score', () => {
  const pillar = (name: string, indicators: number) => ({ name, indicators: Array.from({ length: indicators }, () => ({})) });
  const capeVerde = {
    sources: named('advisories', 'inform', 'ucdp', 'vdem', 'reliefweb'),
    pillars: [pillar('conflict', 1), pillar('crime', 0), pillar('health', 2), pillar('governance', 4), pillar('environment', 2)],
  };
  const stLucia = {
    sources: named('advisories', 'inform', 'ucdp', 'worldbank'),
    pillars: [pillar('conflict', 1), pillar('crime', 1), pillar('health', 2), pillar('governance', 1), pillar('environment', 1)],
  };

  it('REQUIRED_PILLARS equals weights.json formulaV9.requiredPillars (the engine reads the JSON)', () => {
    const weights = JSON.parse(readFileSync(join(process.cwd(), 'src', 'pipeline', 'config', 'weights.json'), 'utf-8'));
    assert.deepEqual([...REQUIRED_PILLARS], weights.formulaV9.requiredPillars);
    assert.deepEqual([...REQUIRED_PILLARS], ['crime']);
  });

  it('a crime pillar listed with no indicator is missing; no pillar detail is not', () => {
    assert.deepEqual(missingRequiredPillars(capeVerde.pillars), ['crime']);
    assert.deepEqual(missingRequiredPillars(stLucia.pillars), []);
    assert.deepEqual(missingRequiredPillars([pillar('health', 2)]), [], 'no crime pillar listed: unknown, not missing');
    assert.deepEqual(missingRequiredPillars([{ name: 'crime' }]), [], 'no indicator list: unknown, not missing');
    assert.deepEqual(missingRequiredPillars(undefined), []);
  });

  it('names the reason: too few sources first, then no crime value', () => {
    assert.equal(coverageShortfall(capeVerde), 'crime');
    assert.equal(coverageShortfall(stLucia), null);
    assert.equal(coverageShortfall({ sources: named('advisories', 'inform', 'vdem'), pillars: capeVerde.pillars }), 'sources');
    assert.equal(meetsCoverageFloor(capeVerde), false);
    assert.equal(meetsCoverageFloor(stLucia), true);
  });

  it('the rankings leave out a place without a crime value even when it is scored (danger guard)', () => {
    const place = (p: typeof capeVerde) => ({ iso3: 'CPV', score: 6.89, scoreStatus: 'scored', ...p }) as unknown as ScoredCountry;
    assert.equal(hasSufficientData(place(capeVerde)), false);
    assert.equal(hasSufficientData(place(stLucia)), true);
  });

  const weights = JSON.parse(readFileSync(join(process.cwd(), 'src', 'pipeline', 'config', 'weights.json'), 'utf-8')) as WeightsConfig;
  const row = (iso3: string, indicatorName: string, value: number, year: number, source: string): RawIndicator => ({ countryIso3: iso3, indicatorName, value, year, source });
  const src = (name: string, indicators: RawIndicator[]): [string, RawSourceData] => [name, { source: name, fetchedAt: '2026-10-19T06:00:00.000Z', indicators }];
  function scoreIsland(opts: { homicide?: boolean; level?: number; config?: WeightsConfig }): ScoredCountry {
    const iso3 = 'CPV';
    const dir = mkdtempSync(join(tmpdir(), 'coverage-crime-test-'));
    const log = console.log;
    console.log = () => {};
    try {
      const level = opts.level ?? 1;
      const advisory = { level, text: '', source: 'US State Department', url: 'https://example.org' };
      writeFileSync(join(dir, 'advisories-info.json'), JSON.stringify({ [iso3]: { us: advisory, uk: advisory, ca: advisory } }));
      const sources = new Map([
        src('advisories', [row(iso3, 'advisory_level_us', level, 2026, 'advisories_us')]),
        src('inform', [row(iso3, 'inform_natural', 2, 2026, 'inform'), row(iso3, 'inform_epidemic', 4, 2026, 'inform'), row(iso3, 'inform_governance', 4, 2026, 'inform')]),
        src('ucdp', [row(iso3, 'ucdp_conflict_deaths', 0, 2025, 'ucdp')]),
        src('vdem', [row(iso3, 'vdem_rule_of_law', 0.8, 2025, 'vdem')]),
        src('worldbank', opts.homicide ? [row(iso3, 'wb_population', 520_000, 2025, 'worldbank'), row(iso3, 'wb_homicide', 7, 2023, 'worldbank')] : []),
      ]);
      return computeAllScores(sources, opts.config ?? weights, '2026-10-19', { rawDir: dir, community: null }).find((c) => c.iso3 === iso3)!;
    } finally {
      console.log = log;
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('the engine greys a four-source place with no crime value', () => {
    const place = scoreIsland({});
    assert.deepEqual(place.sources.map((s) => s.name).sort(), ['advisories', 'inform', 'ucdp', 'vdem']);
    assert.equal(place.pillars.find((p) => p.name === 'crime')!.indicators.length, 0);
    assert.equal(place.scoreStatus, 'insufficient_data');
    assert.equal(place.score, null);
  });

  it('a homicide rate is enough crime data: the same place is scored', () => {
    const place = scoreIsland({ homicide: true });
    assert.equal(place.scoreStatus, 'scored');
    assert.equal(typeof place.score, 'number');
  });

  it('the danger guard still overrides: three governments at level 4 keep it scored', () => {
    assert.equal(scoreIsland({ level: 4 }).scoreStatus, 'scored');
  });

  it('without requiredPillars in the config (before 2026-10-19) the place is scored', () => {
    const legacy = JSON.parse(JSON.stringify(weights)) as WeightsConfig;
    delete (legacy.formulaV9 as { requiredPillars?: unknown }).requiredPillars;
    assert.equal(scoreIsland({ config: legacy }).scoreStatus, 'scored');
  });
});

describe('a source counts only when it supplies a value the score uses (I29)', () => {
  it('keeps the sources whose keys supplied a scored value, in order, and nothing else', () => {
    const used = new Set(['gpi', 'inform', ADVISORY_SOURCE]);
    assert.equal(suppliesScoredValue('worldbank', used), false);
    assert.equal(suppliesScoredValue(undefined, used), false);
    assert.deepEqual(
      sourcesSupplyingScoredValues(named('advisories', 'worldbank', 'gpi', 'inform'), used).map((s) => s.name),
      ['advisories', 'gpi', 'inform'],
    );
  });

  // The engine applies the rule to the list it publishes: a World Bank entry held up by the
  // population alone (no homicide rate, or one older than the five-year limit) is not a source.
  const weights = JSON.parse(readFileSync(join(process.cwd(), 'src', 'pipeline', 'config', 'weights.json'), 'utf-8')) as WeightsConfig;
  const row = (iso3: string, indicatorName: string, value: number, year: number, source: string): RawIndicator => ({ countryIso3: iso3, indicatorName, value, year, source });
  const src = (name: string, indicators: RawIndicator[]): [string, RawSourceData] => [name, { source: name, fetchedAt: '2026-10-15T06:00:00.000Z', indicators }];
  function scorePlace(iso3: string, worldbank: RawIndicator[]): ScoredCountry {
    const dir = mkdtempSync(join(tmpdir(), 'coverage-i29-test-'));
    const log = console.log;
    console.log = () => {};
    try {
      const level = { level: 1, text: '', source: 'US State Department', url: 'https://example.org' };
      writeFileSync(join(dir, 'advisories-info.json'), JSON.stringify({ [iso3]: { us: level, uk: level, ca: level } }));
      const sources = new Map([
        src('advisories', [row(iso3, 'advisory_level_us', 1, 2026, 'advisories_us')]),
        src('inform', [row(iso3, 'inform_natural', 3, 2026, 'inform'), row(iso3, 'inform_epidemic', 3, 2026, 'inform')]),
        src('ucdp', [row(iso3, 'ucdp_conflict_deaths', 0, 2025, 'ucdp')]),
        src('worldbank', worldbank),
      ]);
      return computeAllScores(sources, weights, '2026-10-15', { rawDir: dir, community: null }).find((c) => c.iso3 === iso3)!;
    } finally {
      console.log = log;
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('a population-only World Bank entry is not published and does not make the fourth source', () => {
    const place = scorePlace('PLW', [row('PLW', 'wb_population', 18_000, 2025, 'worldbank'), row('PLW', 'wb_homicide', 3, 2018, 'worldbank')]);
    assert.deepEqual(place.sources.map((s) => s.name).sort(), ['advisories', 'inform', 'ucdp']);
    assert.equal(place.scoreStatus, 'insufficient_data');
  });

  it('a World Bank entry with a scored homicide rate stays and counts', () => {
    const place = scorePlace('PLW', [row('PLW', 'wb_population', 18_000, 2025, 'worldbank'), row('PLW', 'wb_homicide', 3, 2023, 'worldbank')]);
    assert.deepEqual(place.sources.map((s) => s.name).sort(), ['advisories', 'inform', 'ucdp', 'worldbank']);
    assert.equal(place.scoreStatus, 'scored');
  });
});

describe('grey hero source list', () => {
  it('lists an alert feed but marks it as not counting toward the four, in every language', () => {
    for (const lang of ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de'] as const) {
      const items = greySourceItems(lang, 6, ['advisories', 'worldbank', 'reliefweb', 'gdacs']);
      assert.equal(items.length, 4, lang);
      assert.ok(!items[1].includes('('), `${lang}: World Bank is plain coverage: ${items[1]}`);
      for (const alert of items.slice(2)) {
        assert.ok(/[(（]/.test(alert), `${lang}: an alert item carries the "not counted" note: ${alert}`);
      }
    }
    assert.equal(
      greySourceItems('en', 6, ['advisories', 'gdacs'])[1],
      'GDACS disaster alerts (only while a disaster is under way, so not counted toward the four-source minimum)',
    );
  });
});
