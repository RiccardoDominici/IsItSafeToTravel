import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { dropSelfAdvisories, issuerHomeIso3 } from '../fetchers/advisory-self.js';
import { ADVISORY_CODES } from '../scoring/engine.js';
import type { RawIndicator } from '../types.js';
import type { AdvisoryInfoMap } from '../fetchers/advisories.js';

/**
 * I51 (consistency database, 2026-10-15): Austria's and Argentina's ministries published a
 * "travel advisory" for their own country (AUT at=1 "Sichere Lage", ARG ar=2 "Precaucion" in
 * the 2026-10-15 raw data), counted in both countries' advisory consensus.
 */

function ind(countryIso3: string, issuer: string, value: number): RawIndicator {
  return { countryIso3, indicatorName: `advisory_level_${issuer}`, value, year: 2026, source: `advisories_${issuer}` };
}

function info(level: number, source: string) {
  return { level, text: `Level ${level}`, source, url: 'https://example.org' };
}

describe('issuerHomeIso3', () => {
  it('resolves every issuer code the engine knows to a country', () => {
    for (const code of ADVISORY_CODES) {
      assert.ok(issuerHomeIso3(code), `issuer "${code}" has no home country`);
    }
  });

  it('maps the non-ISO "uk" key to GBR and the I51 cases to AUT and ARG', () => {
    assert.equal(issuerHomeIso3('uk'), 'GBR');
    assert.equal(issuerHomeIso3('at'), 'AUT');
    assert.equal(issuerHomeIso3('ar'), 'ARG');
    assert.equal(issuerHomeIso3('hk'), 'HKG');
    assert.equal(issuerHomeIso3('tw'), 'TWN');
  });
});

describe('dropSelfAdvisories', () => {
  it('drops the 2026-10-15 Austria and Argentina self-entries and keeps every other issuer', () => {
    const indicators = [ind('AUT', 'at', 1), ind('AUT', 'de', 1), ind('ARG', 'ar', 2), ind('ARG', 'at', 1), ind('FRA', 'at', 2)];
    const advisoryInfo: AdvisoryInfoMap = {
      AUT: { at: info(1, 'Austrian Federal Ministry'), de: info(1, 'German Federal Foreign Office') },
      ARG: { ar: info(2, 'Argentine Ministry of Foreign Affairs'), at: info(1, 'Austrian Federal Ministry') },
      FRA: { at: info(2, 'Austrian Federal Ministry') },
    };

    const dropped = dropSelfAdvisories(indicators, advisoryInfo);

    assert.deepEqual(dropped.sort(), ['ar -> ARG', 'at -> AUT']);
    assert.deepEqual(
      indicators.map((i) => `${i.countryIso3}:${i.source}`),
      ['AUT:advisories_de', 'ARG:advisories_at', 'FRA:advisories_at'],
    );
    assert.deepEqual(Object.keys(advisoryInfo.AUT ?? {}), ['de']);
    assert.deepEqual(Object.keys(advisoryInfo.ARG ?? {}), ['at']);
    assert.ok(advisoryInfo.FRA?.at);
  });

  it('removes a country entry left empty, and catches the UK about GBR', () => {
    const indicators = [ind('GBR', 'uk', 1)];
    const advisoryInfo: AdvisoryInfoMap = { GBR: { uk: info(1, 'UK FCDO') } };
    assert.deepEqual(dropSelfAdvisories(indicators, advisoryInfo), ['uk -> GBR']);
    assert.equal(indicators.length, 0);
    assert.equal(advisoryInfo.GBR, undefined);
  });

  it('leaves non-advisory indicators alone', () => {
    const indicators: RawIndicator[] = [
      { countryIso3: 'AUT', indicatorName: 'gpi_overall', value: 1.3, year: 2026, source: 'gpi' },
    ];
    assert.deepEqual(dropSelfAdvisories(indicators, {}), []);
    assert.equal(indicators.length, 1);
  });
});
