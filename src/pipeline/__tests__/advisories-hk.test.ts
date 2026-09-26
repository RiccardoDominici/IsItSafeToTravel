import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeHkAlert } from '../normalize/advisory-levels.js';
import {
  isHkWholeCountryTitle,
  parseHkUpdateDate,
  resolveHkCountryLevel,
  type HkCountryHit,
} from '../fetchers/advisories-tier2a.js';

/**
 * Regression coverage for the 2026-09-26 HK (Hong Kong Security Bureau OTA)
 * repair (SOURCE-REPAIR-BRIEF.md). The old fetcher scraped the OTA index
 * page's server HTML for .redAlert/.amberAlert classes that are only ever
 * populated client-side (confirmed live: zero matches). The new fetcher
 * reads the JSON the page's own script fetches,
 * `GET /json/ota_index/ota_index.json` -- see fetchHkAdvisories.
 */

describe('normalizeHkAlert (HK/OTA level string -> unified scale)', () => {
  it('black -> 4, red -> 3, amber/yellow -> 2', () => {
    assert.equal(normalizeHkAlert('black'), 4);
    assert.equal(normalizeHkAlert('red'), 3);
    assert.equal(normalizeHkAlert('amber'), 2);
    assert.equal(normalizeHkAlert('yellow'), 2);
  });

  it('unrecognised level string -> null, never falls back to 1 (repair brief rule 1)', () => {
    assert.equal(normalizeHkAlert('green'), null);
    assert.equal(normalizeHkAlert(''), null);
  });
});

describe('isHkWholeCountryTitle (parenthetical = sub-national scope)', () => {
  it('bare country names are whole-country', () => {
    assert.equal(isHkWholeCountryTitle('Iran'), true);
    assert.equal(isHkWholeCountryTitle('Democratic Republic of the Congo'), true);
    assert.equal(isHkWholeCountryTitle('Türkiye'), true);
  });

  it('a parenthetical region/province suffix marks a regional-only entry -- real titles from the live OTA 2026-09-26', () => {
    assert.equal(isHkWholeCountryTitle('Myanmar (south-eastern regions)'), false);
    assert.equal(isHkWholeCountryTitle('Türkiye (south-eastern provinces)'), false);
    assert.equal(isHkWholeCountryTitle('Japan (areas near the Fukushima Dai-ichi nuclear power plant)'), false);
  });
});

describe('parseHkUpdateDate ("YYYYMMDDHHmmss" -> ISO)', () => {
  it('parses a real OTA updateDate', () => {
    assert.equal(parseHkUpdateDate('20260323000000'), new Date('2026-03-23T00:00:00Z').toISOString());
  });

  it('undefined/unparseable input -> undefined, not a thrown error or a fabricated date', () => {
    assert.equal(parseHkUpdateDate(undefined), undefined);
    assert.equal(parseHkUpdateDate('not-a-date'), undefined);
  });
});

describe('resolveHkCountryLevel (per-country aggregation across active OTA hits)', () => {
  const hit = (level: 2 | 3 | 4, wholeCountry: boolean, url: string): HkCountryHit => ({
    level,
    wholeCountry,
    url,
    updatedAt: undefined,
  });

  it('a single whole-country hit counts at face value', () => {
    const result = resolveHkCountryLevel([hit(4, true, 'note-Iran.html')]);
    assert.equal(result?.level, 4);
    assert.equal(result?.hit.url, 'note-Iran.html');
  });

  it('a single regional-only hit is capped at 2 even though its own bucket is red/black (Pakistan-style entries aside, this covers a hypothetical regional-only black alert)', () => {
    const result = resolveHkCountryLevel([hit(4, false, 'note-SomeRegion.html')]);
    assert.equal(result?.level, 2);
  });

  it('REGRESSION (Myanmar 2026-09-26): a regional "red" (capped to 2) plus a separate whole-country "amber" (2) -> final level 2, and the WHOLE-COUNTRY page wins the URL, not the regional one processed first', () => {
    const result = resolveHkCountryLevel([
      hit(3, false, 'note-MyanmarProvinces.html'), // regional red, capped to 2
      hit(2, true, 'note-Myanmar.html'), // whole-country amber
    ]);
    assert.equal(result?.level, 2);
    assert.equal(result?.hit.url, 'note-Myanmar.html');
  });

  it('a whole-country hit beats a regional hit even when the regional bucket is nominally more severe', () => {
    const result = resolveHkCountryLevel([
      hit(4, false, 'note-SomeProvince.html'), // regional black, capped to 2
      hit(3, true, 'note-Whole.html'), // whole-country red beats the capped regional
    ]);
    assert.equal(result?.level, 3);
    assert.equal(result?.hit.url, 'note-Whole.html');
  });

  it('empty hit list -> null (defensive; the real fetcher never calls this with an empty array, but it must not throw)', () => {
    assert.equal(resolveHkCountryLevel([]), null);
  });
});
