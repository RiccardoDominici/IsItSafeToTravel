import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { isValidChoice, normalizeLang, normalizeNonce } from '../consent.ts';

describe('isValidChoice', () => {
  it('accepts the two banner outcomes', () => {
    assert.equal(isValidChoice('granted'), true);
    assert.equal(isValidChoice('denied'), true);
  });

  it('rejects any other string', () => {
    assert.equal(isValidChoice('accepted'), false);
    assert.equal(isValidChoice('GRANTED'), false);
    assert.equal(isValidChoice(''), false);
  });

  it('rejects non-strings', () => {
    assert.equal(isValidChoice(null), false);
    assert.equal(isValidChoice(undefined), false);
    assert.equal(isValidChoice(1), false);
    assert.equal(isValidChoice({ choice: 'granted' }), false);
  });
});

describe('normalizeLang', () => {
  it('passes through every supported UI locale', () => {
    for (const lang of ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de']) {
      assert.equal(normalizeLang(lang), lang);
    }
  });

  it('returns null (never undefined) for anything else', () => {
    assert.equal(normalizeLang('ko'), null);
    assert.equal(normalizeLang('EN'), null);
    assert.equal(normalizeLang(''), null);
    assert.equal(normalizeLang(undefined), null);
    assert.equal(normalizeLang(null), null);
    assert.equal(normalizeLang(42), null);
  });
});

describe('normalizeNonce', () => {
  it('passes through alphanumeric nonces up to 40 chars', () => {
    assert.equal(normalizeNonce('mcvx1a2b8f3k9z'), 'mcvx1a2b8f3k9z');
    assert.equal(normalizeNonce('A1'), 'A1');
    assert.equal(normalizeNonce('a'.repeat(40)), 'a'.repeat(40));
  });

  it("returns '' (IP-only fallback) for anything else", () => {
    assert.equal(normalizeNonce(''), '');
    assert.equal(normalizeNonce('a'.repeat(41)), '');
    assert.equal(normalizeNonce('has space'), '');
    assert.equal(normalizeNonce('semi;colon'), '');
    assert.equal(normalizeNonce(undefined), '');
    assert.equal(normalizeNonce(null), '');
    assert.equal(normalizeNonce(123), '');
  });
});
