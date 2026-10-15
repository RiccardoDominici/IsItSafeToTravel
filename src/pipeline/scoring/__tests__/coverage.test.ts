/**
 * The shared data-coverage floor (scoring/coverage.ts): one definition for the engine's grey
 * rule, the rankings, llms.txt and the news engine; disaster-alert feeds never count.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EVENT_FEED_SOURCES,
  MIN_COVERAGE_SOURCES,
  coverageSourceCount,
  isEventFeedSource,
  meetsCoverageFloor,
} from '../coverage.js';
import { hasSufficientData } from '../../../lib/hub-data.js';
import { greySourceItems } from '../../../i18n/grey-copy.js';
import type { ScoredCountry } from '../../types.js';

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
