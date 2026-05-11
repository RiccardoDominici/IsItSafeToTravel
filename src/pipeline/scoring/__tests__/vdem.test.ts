import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseVdemCsv } from '../../fetchers/vdem.js';
import { normalizeIndicators, __INDICATOR_RANGES_FOR_TESTS } from '../normalize.js';
import type { RawIndicator } from '../../types.js';

/**
 * V-Dem fetcher and normalize.ts contract tests.
 *
 * Behaviour covered:
 * - Case (a): a normal country row is kept.
 * - Case (b): an OWID aggregate row (OWID_* code) is filtered.
 * - Case (c): a row with empty Code is filtered.
 * - Case (d): a row whose ISO3 is not in countries.ts is filtered.
 * - Case (e): when two years exist for the same country, the latest is kept.
 * - Case (f): a row with a non-numeric value is filtered.
 * - Case (g): the year-boundary case — when targetYear is 2026 but the
 *             latest V-Dem v16 row is 2025, the parser MUST emit year=2025.
 * - INDICATOR_RANGES contract: vdem_rule_of_law, vdem_gov_effectiveness,
 *   vdem_corruption_control exist with the correct bounds and direction.
 * - The four retired wb_* WGI keys are absent.
 * - Single-inversion: normalizing a v2x_corr value of 0.0 yields 1.0 (clean = safe),
 *   and a value of 1.0 yields 0.0 (corrupt = unsafe).
 */

const HEADER = 'Entity,Code,Year,IndicatorValue,World region';

describe('parseVdemCsv', () => {
  it('(a) keeps a normal country row', () => {
    const csv = `${HEADER}\nAustralia,AUS,2025,3.324,Oceania\n`;
    const out = parseVdemCsv(csv, 2025, 'vdem_rule_of_law');
    assert.equal(out.length, 1);
    assert.equal(out[0].countryIso3, 'AUS');
    assert.equal(out[0].value, 3.324);
    assert.equal(out[0].year, 2025);
    assert.equal(out[0].indicatorName, 'vdem_rule_of_law');
    assert.equal(out[0].source, 'vdem');
  });

  it('(b) filters OWID aggregate rows (OWID_AFR)', () => {
    const csv = `${HEADER}\nAfrica (population-weighted),OWID_AFR,2025,-0.6,Africa\n`;
    const out = parseVdemCsv(csv, 2025, 'vdem_rule_of_law');
    assert.equal(out.length, 0);
  });

  it('(c) filters rows with empty Code', () => {
    const csv = `${HEADER}\nAfrica,,2025,-0.5,Africa\n`;
    const out = parseVdemCsv(csv, 2025, 'vdem_rule_of_law');
    assert.equal(out.length, 0);
  });

  it('(d) filters rows whose ISO3 is not in countries.ts', () => {
    // "ATL" is not a real ISO3; getCountryByIso3('ATL') returns undefined
    const csv = `${HEADER}\nAtlantis,ATL,2025,0.5,Atlantic\n`;
    const out = parseVdemCsv(csv, 2025, 'vdem_rule_of_law');
    assert.equal(out.length, 0);
  });

  it('(e) picks the latest year per country when multiple rows exist', () => {
    const csv = `${HEADER}\nUnited States,USA,2022,0.7,North America\nUnited States,USA,2024,0.8,North America\n`;
    const out = parseVdemCsv(csv, 2025, 'vdem_rule_of_law');
    assert.equal(out.length, 1);
    assert.equal(out[0].countryIso3, 'USA');
    assert.equal(out[0].year, 2024);
    assert.equal(out[0].value, 0.8);
  });

  it('(f) filters rows whose value is not a finite number', () => {
    const csv = `${HEADER}\nUnited States,USA,2024,not-a-number,North America\n`;
    const out = parseVdemCsv(csv, 2025, 'vdem_rule_of_law');
    assert.equal(out.length, 0);
  });

  it('(g) year-boundary: targetYear=2026, latest V-Dem row=2025 -> emits year=2025', () => {
    const csv = `${HEADER}\nUnited States,USA,2025,0.8,North America\n`;
    const out = parseVdemCsv(csv, 2026, 'vdem_rule_of_law');
    assert.equal(out.length, 1);
    assert.equal(out[0].countryIso3, 'USA');
    assert.equal(out[0].year, 2025);
    assert.equal(out[0].value, 0.8);
  });

  it('respects targetYear cap: rows with year > targetYear are skipped', () => {
    // If a row's year exceeds targetYear, it should NOT be picked.
    const csv = `${HEADER}\nUnited States,USA,2020,0.7,North America\nUnited States,USA,2024,0.9,North America\n`;
    const out = parseVdemCsv(csv, 2021, 'vdem_rule_of_law');
    assert.equal(out.length, 1);
    assert.equal(out[0].year, 2020);
    assert.equal(out[0].value, 0.7);
  });
});

describe('INDICATOR_RANGES (vdem contract)', () => {
  it('contains vdem_rule_of_law with min=0, max=1, inverse=false', () => {
    const r = __INDICATOR_RANGES_FOR_TESTS['vdem_rule_of_law'];
    assert.ok(r, 'vdem_rule_of_law must exist in INDICATOR_RANGES');
    assert.equal(r.min, 0);
    assert.equal(r.max, 1);
    assert.equal(r.inverse, false);
  });

  it('contains vdem_gov_effectiveness with min=-3.5, max=3.5, inverse=false', () => {
    const r = __INDICATOR_RANGES_FOR_TESTS['vdem_gov_effectiveness'];
    assert.ok(r, 'vdem_gov_effectiveness must exist in INDICATOR_RANGES');
    assert.equal(r.min, -3.5);
    assert.equal(r.max, 3.5);
    assert.equal(r.inverse, false);
  });

  it('contains vdem_corruption_control with min=0, max=1, inverse=true', () => {
    const r = __INDICATOR_RANGES_FOR_TESTS['vdem_corruption_control'];
    assert.ok(r, 'vdem_corruption_control must exist in INDICATOR_RANGES');
    assert.equal(r.min, 0);
    assert.equal(r.max, 1);
    assert.equal(r.inverse, true);
  });

  it('does NOT contain any of the four retired wb_* WGI keys', () => {
    assert.equal(__INDICATOR_RANGES_FOR_TESTS['wb_political_stability'], undefined);
    assert.equal(__INDICATOR_RANGES_FOR_TESTS['wb_rule_of_law'], undefined);
    assert.equal(__INDICATOR_RANGES_FOR_TESTS['wb_gov_effectiveness'], undefined);
    assert.equal(__INDICATOR_RANGES_FOR_TESTS['wb_corruption_control'], undefined);
  });

  it('keeps wb_child_mortality and wb_air_pollution (still live)', () => {
    assert.ok(__INDICATOR_RANGES_FOR_TESTS['wb_child_mortality']);
    assert.ok(__INDICATOR_RANGES_FOR_TESTS['wb_air_pollution']);
  });
});

describe('normalizeIndicators on vdem_corruption_control (single-inversion proof)', () => {
  it('value=0.0 (perfectly clean) -> normalized=1.0 (safe)', () => {
    const raw: RawIndicator[] = [
      { countryIso3: 'USA', indicatorName: 'vdem_corruption_control', value: 0.0, year: 2025, source: 'vdem' },
    ];
    const out = normalizeIndicators(raw);
    assert.equal(out.length, 1);
    assert.equal(out[0].normalizedValue, 1.0);
  });

  it('value=1.0 (maximally corrupt) -> normalized=0.0 (unsafe)', () => {
    const raw: RawIndicator[] = [
      { countryIso3: 'USA', indicatorName: 'vdem_corruption_control', value: 1.0, year: 2025, source: 'vdem' },
    ];
    const out = normalizeIndicators(raw);
    assert.equal(out.length, 1);
    assert.equal(out[0].normalizedValue, 0.0);
  });

  it('value=0.5 (midpoint) -> normalized=0.5', () => {
    const raw: RawIndicator[] = [
      { countryIso3: 'USA', indicatorName: 'vdem_corruption_control', value: 0.5, year: 2025, source: 'vdem' },
    ];
    const out = normalizeIndicators(raw);
    assert.equal(out.length, 1);
    assert.equal(out[0].normalizedValue, 0.5);
  });
});

describe('normalizeIndicators on vdem_rule_of_law and vdem_gov_effectiveness', () => {
  it('vdem_rule_of_law value=0.0 -> normalized=0.0 (lowest score)', () => {
    const raw: RawIndicator[] = [
      { countryIso3: 'USA', indicatorName: 'vdem_rule_of_law', value: 0.0, year: 2025, source: 'vdem' },
    ];
    const out = normalizeIndicators(raw);
    assert.equal(out[0].normalizedValue, 0.0);
  });

  it('vdem_rule_of_law value=1.0 -> normalized=1.0 (highest score)', () => {
    const raw: RawIndicator[] = [
      { countryIso3: 'USA', indicatorName: 'vdem_rule_of_law', value: 1.0, year: 2025, source: 'vdem' },
    ];
    const out = normalizeIndicators(raw);
    assert.equal(out[0].normalizedValue, 1.0);
  });

  it('vdem_gov_effectiveness midpoint (0.0) -> normalized=0.5', () => {
    const raw: RawIndicator[] = [
      { countryIso3: 'USA', indicatorName: 'vdem_gov_effectiveness', value: 0.0, year: 2025, source: 'vdem' },
    ];
    const out = normalizeIndicators(raw);
    assert.equal(out[0].normalizedValue, 0.5);
  });
});
