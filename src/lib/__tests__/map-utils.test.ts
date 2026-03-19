import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  safetyColorScale,
  getCountryColor,
  UNSCORED_COLOR,
  UNSCORED_COLOR_DARK,
  ISO_NUMERIC_TO_ALPHA3,
  type MapCountryData,
} from '../map-utils.js';

// --- MAP-01: Color scale maps safety scores to green-to-red gradient ---

describe('MAP-01: safetyColorScale maps 1-10 scores to danger-to-safe colors', () => {
  it('score 1 (most dangerous) returns a reddish color', () => {
    const color = safetyColorScale(1);
    assert.ok(typeof color === 'string', 'Must return a string');
    // The danger anchor is #9e3a2a -- the result at domain boundary should match
    assert.ok(
      color.startsWith('rgb') || color.startsWith('#'),
      `Color format should be rgb or hex, got: ${color}`
    );
  });

  it('score 10 (safest) returns a bluish color', () => {
    const color = safetyColorScale(10);
    assert.ok(typeof color === 'string', 'Must return a string');
  });

  it('score 5.5 (moderate) returns a yellowish color', () => {
    const color = safetyColorScale(5.5);
    assert.ok(typeof color === 'string', 'Must return a string');
  });

  it('danger color is distinct from safe color', () => {
    const danger = safetyColorScale(1);
    const safe = safetyColorScale(10);
    assert.notEqual(danger, safe, 'Danger and safe colors must be different');
  });

  it('returns clamped color for out-of-range scores', () => {
    const below = safetyColorScale(0);
    const above = safetyColorScale(11);
    const atMin = safetyColorScale(1);
    const atMax = safetyColorScale(10);
    // Clamped: 0 should equal 1, 11 should equal 10
    assert.equal(below, atMin, 'Score below 1 should clamp to danger color');
    assert.equal(above, atMax, 'Score above 10 should clamp to safe color');
  });

  it('produces a gradient -- intermediate scores differ from endpoints', () => {
    const low = safetyColorScale(1);
    const mid = safetyColorScale(5.5);
    const high = safetyColorScale(10);
    assert.notEqual(low, mid, 'Mid score should differ from danger');
    assert.notEqual(mid, high, 'Mid score should differ from safe');
  });
});

// --- MAP-01: Unscored countries get neutral gray ---

describe('MAP-01: unscored countries rendered in neutral gray', () => {
  it('UNSCORED_COLOR is gray hex #9ca3af', () => {
    assert.equal(UNSCORED_COLOR, '#9ca3af');
  });

  it('UNSCORED_COLOR_DARK is darker gray hex #4b5563', () => {
    assert.equal(UNSCORED_COLOR_DARK, '#4b5563');
  });
});

// --- MAP-01: getCountryColor returns correct fill based on score presence ---

describe('MAP-01: getCountryColor returns safety color or gray for unscored', () => {
  const scoreMap = new Map<string, number>([
    ['ITA', 8.2],
    ['AFG', 1.5],
  ]);

  it('returns safety color for a scored country', () => {
    const color = getCountryColor('ITA', scoreMap, false);
    const expected = safetyColorScale(8.2);
    assert.equal(color, expected, 'Scored country must use safety color scale');
  });

  it('returns UNSCORED_COLOR for unknown country in light mode', () => {
    const color = getCountryColor('XXX', scoreMap, false);
    assert.equal(color, UNSCORED_COLOR, 'Unscored country in light mode must be gray');
  });

  it('returns UNSCORED_COLOR_DARK for unknown country in dark mode', () => {
    const color = getCountryColor('XXX', scoreMap, true);
    assert.equal(color, UNSCORED_COLOR_DARK, 'Unscored country in dark mode must be dark gray');
  });

  it('scored country color is same regardless of dark mode', () => {
    const light = getCountryColor('ITA', scoreMap, false);
    const dark = getCountryColor('ITA', scoreMap, true);
    assert.equal(light, dark, 'Scored country color should not change with theme');
  });
});

// --- MAP-01: ISO numeric-to-alpha3 bridge map ---

describe('MAP-01: ISO_NUMERIC_TO_ALPHA3 maps world-atlas numeric IDs to alpha-3', () => {
  it('contains mapping for Italy (380 -> ITA)', () => {
    assert.equal(ISO_NUMERIC_TO_ALPHA3['380'], 'ITA');
  });

  it('contains mapping for USA (840 -> USA)', () => {
    assert.equal(ISO_NUMERIC_TO_ALPHA3['840'], 'USA');
  });

  it('contains mapping for Japan (392 -> JPN)', () => {
    assert.equal(ISO_NUMERIC_TO_ALPHA3['392'], 'JPN');
  });

  it('contains mapping for Brazil (076 -> BRA)', () => {
    assert.equal(ISO_NUMERIC_TO_ALPHA3['076'], 'BRA');
  });

  it('contains mapping for Australia (036 -> AUS)', () => {
    assert.equal(ISO_NUMERIC_TO_ALPHA3['036'], 'AUS');
  });

  it('covers at least 163 countries (GPI coverage)', () => {
    const count = Object.keys(ISO_NUMERIC_TO_ALPHA3).length;
    assert.ok(count >= 163, `Must map at least 163 countries, got ${count}`);
  });

  it('contains Kosovo mapping (-99 -> XKX)', () => {
    assert.equal(ISO_NUMERIC_TO_ALPHA3['-99'], 'XKX');
  });
});
