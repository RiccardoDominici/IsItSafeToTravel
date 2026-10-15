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
  coverageSourceCount,
  isEventFeedSource,
  meetsCoverageFloor,
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
    assert.equal(meetsCoverageFloor(named('advisories', 'worldbank', 'inform', 'vdem')), true);
    assert.equal(meetsCoverageFloor(named('advisories', 'worldbank', 'inform', 'gdacs', 'reliefweb')), false);
  });

  it('rankings use the same floor: a scored place whose fourth source is an alert is not ranked', () => {
    const place = (sources: string[]) => ({ iso3: 'GUM', score: 6.55, scoreStatus: 'scored', sources: named(...sources) }) as unknown as ScoredCountry;
    assert.equal(hasSufficientData(place(['advisories', 'worldbank', 'reliefweb', 'gdacs'])), false);
    assert.equal(hasSufficientData(place(['advisories', 'worldbank', 'inform', 'vdem'])), true);
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
      'GDACS disaster alerts (only while a disaster is under way, so not counted toward the four)',
    );
  });
});
