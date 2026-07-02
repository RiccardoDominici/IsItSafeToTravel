import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { isValidDelta, isValidIso3, voterHash } from '../vote.ts';

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
