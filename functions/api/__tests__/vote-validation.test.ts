import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  isValidDelta,
  isValidIso3,
  isJsonContentType,
  isSameOriginOrAbsent,
  normalizeOfficialScore,
  voterHash,
} from '../vote.ts';

describe('isValidDelta', () => {
  it('accepts every valid calibration delta (-2..2)', () => {
    for (const d of [-2, -1, 0, 1, 2]) {
      assert.equal(isValidDelta(d), true, `expected ${d} to be valid`);
    }
  });

  it('rejects out-of-range integers', () => {
    assert.equal(isValidDelta(3), false);
    assert.equal(isValidDelta(-3), false);
  });

  it('rejects non-integers', () => {
    assert.equal(isValidDelta(1.5), false);
  });

  it('rejects a numeric string', () => {
    assert.equal(isValidDelta('1'), false);
  });

  it('rejects null', () => {
    assert.equal(isValidDelta(null), false);
  });

  it('rejects NaN', () => {
    assert.equal(isValidDelta(NaN), false);
  });
});

describe('isValidIso3', () => {
  it('accepts known ISO3 codes', () => {
    assert.equal(isValidIso3('ITA'), true);
    assert.equal(isValidIso3('JPN'), true);
  });

  it('rejects an unknown 2-letter code', () => {
    assert.equal(isValidIso3('XX'), false);
  });

  it('rejects a full country name', () => {
    assert.equal(isValidIso3('italy'), false);
  });

  it('rejects lowercase of a known code', () => {
    assert.equal(isValidIso3('ita'), false);
  });

  it('rejects an empty string', () => {
    assert.equal(isValidIso3(''), false);
  });

  it('rejects a non-string', () => {
    assert.equal(isValidIso3(123), false);
  });
});

describe('voterHash', () => {
  it('is deterministic for identical inputs', async () => {
    const a = await voterHash('salt1', '1.2.3.4', 'ITA:100');
    const b = await voterHash('salt1', '1.2.3.4', 'ITA:100');
    assert.equal(a, b);
  });

  it('produces a 64-char lowercase hex digest', async () => {
    const h = await voterHash('salt1', '1.2.3.4', 'ITA:100');
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it('changes when the ip changes', async () => {
    const a = await voterHash('salt1', '1.2.3.4', 'ITA:100');
    const b = await voterHash('salt1', '5.6.7.8', 'ITA:100');
    assert.notEqual(a, b);
  });

  it('changes when the scope changes', async () => {
    const a = await voterHash('salt1', '1.2.3.4', 'ITA:100');
    const b = await voterHash('salt1', '1.2.3.4', 'JPN:100');
    assert.notEqual(a, b);
  });

  it('never contains the raw ip substring', async () => {
    const ip = '203.0.113.42';
    const h = await voterHash('salt1', ip, 'ITA:100');
    assert.equal(h.includes(ip), false);
    assert.equal(h.includes('203'), false);
  });
});

describe('normalizeOfficialScore', () => {
  it('accepts an in-range number', () => {
    assert.equal(normalizeOfficialScore(5.5), 5.5);
  });

  it('accepts the lower bound', () => {
    assert.equal(normalizeOfficialScore(1), 1);
  });

  it('accepts the upper bound', () => {
    assert.equal(normalizeOfficialScore(10), 10);
  });

  it('nulls out-of-range values', () => {
    assert.equal(normalizeOfficialScore(0.5), null);
    assert.equal(normalizeOfficialScore(10.1), null);
  });

  it('nulls undefined (the real-world contract case)', () => {
    assert.equal(normalizeOfficialScore(undefined), null);
  });

  it('nulls non-numeric input', () => {
    assert.equal(normalizeOfficialScore('7'), null);
    assert.equal(normalizeOfficialScore(null), null);
    assert.equal(normalizeOfficialScore({}), null);
  });

  it('nulls NaN and Infinity', () => {
    assert.equal(normalizeOfficialScore(NaN), null);
    assert.equal(normalizeOfficialScore(Infinity), null);
  });
});

describe('isJsonContentType', () => {
  it('accepts a bare application/json', () => {
    assert.equal(isJsonContentType('application/json'), true);
  });

  it('accepts application/json with a charset parameter', () => {
    assert.equal(isJsonContentType('application/json; charset=utf-8'), true);
  });

  it('accepts mismatched case', () => {
    assert.equal(isJsonContentType('Application/JSON'), true);
  });

  it('rejects text/plain', () => {
    assert.equal(isJsonContentType('text/plain'), false);
  });

  it('rejects a form-encoded type', () => {
    assert.equal(isJsonContentType('application/x-www-form-urlencoded'), false);
  });

  it('rejects a missing header', () => {
    assert.equal(isJsonContentType(null), false);
  });

  it('rejects an empty string', () => {
    assert.equal(isJsonContentType(''), false);
  });
});

describe('isSameOriginOrAbsent', () => {
  const requestUrl = 'https://isitsafetotravel.org/api/vote';

  it('allows an absent Origin header', () => {
    assert.equal(isSameOriginOrAbsent(null, requestUrl), true);
  });

  it('allows a matching origin', () => {
    assert.equal(isSameOriginOrAbsent('https://isitsafetotravel.org', requestUrl), true);
  });

  it('rejects a cross-origin mismatch', () => {
    assert.equal(isSameOriginOrAbsent('https://evil.example', requestUrl), false);
  });

  it('rejects a scheme mismatch (http vs https)', () => {
    assert.equal(isSameOriginOrAbsent('http://isitsafetotravel.org', requestUrl), false);
  });

  it('rejects a malformed origin value', () => {
    assert.equal(isSameOriginOrAbsent('not-a-url', requestUrl), false);
  });
});
