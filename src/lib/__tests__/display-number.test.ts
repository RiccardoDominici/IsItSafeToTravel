/**
 * The site's one number formatter (src/lib/display-number.ts): decimal separator and grouping per
 * page language, rounding, signs, and the machine-side rounding that must follow the printed figure.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { formatNumber, formatPillar10, formatSigned, formatTenths, roundForDisplay } from '../display-number';
import type { Lang } from '../../i18n/ui';

const COMMA: readonly Lang[] = ['it', 'es', 'fr', 'pt', 'de'];
const DOT: readonly Lang[] = ['en', 'zh'];
const NNBSP = ' ';

describe('decimal separator per language', () => {
  it('uses the comma in it, es, fr, pt, de and the dot in en, zh', () => {
    for (const lang of COMMA) assert.equal(formatTenths(8.46, lang), '8,5', lang);
    for (const lang of DOT) assert.equal(formatTenths(8.46, lang), '8.5', lang);
  });

  it('keeps fixed decimals, trailing zeros included', () => {
    assert.equal(formatTenths(4, 'de'), '4,0');
    assert.equal(formatTenths(4, 'en'), '4.0');
    assert.equal(formatNumber(2.5, 2, 'fr'), '2,50');
    assert.equal(formatNumber(7, 0, 'it'), '7');
  });

  it('prints a 0-1 pillar on the /10 scale', () => {
    assert.equal(formatPillar10(0.734, 'pt'), '7,3');
    assert.equal(formatPillar10(0.734, 'zh'), '7.3');
  });
});

describe('thousands per language', () => {
  it('groups four digits as each locale does (Italian always, Spanish from five digits)', () => {
    assert.equal(formatNumber(2428, 0, 'en'), '2,428');
    assert.equal(formatNumber(2428, 0, 'zh'), '2,428');
    assert.equal(formatNumber(2428, 0, 'it'), '2.428');
    assert.equal(formatNumber(2428, 0, 'de'), '2.428');
    assert.equal(formatNumber(2428, 0, 'pt'), '2.428');
    assert.equal(formatNumber(2428, 0, 'fr'), `2${NNBSP}428`);
    assert.equal(formatNumber(2428, 0, 'es'), '2428');
    assert.equal(formatNumber(24000, 0, 'es'), '24.000');
  });

  it('combines grouping and decimals', () => {
    assert.equal(formatNumber(12345.67, 1, 'de'), '12.345,7');
    assert.equal(formatNumber(12345.67, 1, 'en'), '12,345.7');
    assert.equal(formatNumber(12345.67, 1, 'fr'), `12${NNBSP}345,7`);
  });
});

describe('rounding', () => {
  it('rounds half away from zero on the decimal value, in every language', () => {
    assert.equal(formatNumber(1.825, 2, 'en'), '1.83');
    assert.equal(formatNumber(1.825, 2, 'it'), '1,83');
    assert.equal(formatTenths(8.35, 'de'), '8,4');
    assert.equal(formatTenths(4.97, 'es'), '5,0');
    assert.equal(formatTenths(4.94, 'es'), '4,9');
  });

  it('roundForDisplay returns the printed value as a number', () => {
    assert.equal(roundForDisplay(4.97, 1), 5);
    assert.equal(roundForDisplay(1.825, 2), 1.83);
    assert.equal(roundForDisplay(-3.195, 2), -3.2);
    for (const v of [0.05, 4.949, 6.951, 7.05, 8.35, 9.999]) {
      for (const lang of [...COMMA, ...DOT]) {
        assert.equal(formatTenths(v, lang).replace(',', '.'), roundForDisplay(v, 1).toFixed(1), `${v} ${lang}`);
      }
    }
  });
});

describe('negative numbers and signs', () => {
  it('prints negatives with U+2212, never a hyphen', () => {
    assert.equal(formatNumber(-3.195, 2, 'fr'), '−3,20');
    assert.equal(formatNumber(-0.36, 1, 'en'), '−0.4');
    assert.equal(formatNumber(-2428, 0, 'de'), '−2.428');
  });

  it('never prints a signed zero', () => {
    assert.equal(formatNumber(-0.04, 1, 'en'), '0.0');
    assert.equal(formatNumber(-0.04, 1, 'it'), '0,0');
    assert.equal(formatSigned(0.04, 1, 'en'), '0.0');
    assert.equal(formatSigned(-0.04, 1, 'de'), '0,0');
  });

  it('formatSigned adds + to positive changes', () => {
    assert.equal(formatSigned(0.34, 1, 'en'), '+0.3');
    assert.equal(formatSigned(0.34, 1, 'pt'), '+0,3');
    assert.equal(formatSigned(-0.36, 1, 'es'), '−0,4');
    assert.equal(formatSigned(1, 1, 'zh'), '+1.0');
    assert.equal(formatSigned(0.123, 2, 'it'), '+0,12');
  });
});
