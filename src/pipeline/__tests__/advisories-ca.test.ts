import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseCaOpenData, summarizeCaOpenData, CA_LEVEL_TEXT } from '../fetchers/advisories-ca.js';

/**
 * Canada open-data parser (data.international.gc.ca/travel-voyage/index-alpha-eng.json).
 * The fixture follows the index's published shape: `data` keyed by ISO2, `advisory-state`
 * 0-3, `has-regional-advisory` 0/1, `date-published.date`, `eng.{name,url-slug,advisory-text}`.
 * The live feed could not be reached from the build machine (sandbox DNS), so the levels below
 * are the travel.gc.ca levels the 2026-10-01 HTML parse recorded (the last good read), not a
 * live capture. Thailand, Peru and Nauru are synthetic edge cases.
 */
function entry(iso2: string, name: string, slug: string, state: number | null, text: string, regional = 0) {
  return {
    'country-id': 1,
    'country-iso': iso2,
    'country-eng': name,
    'country-fra': name,
    ...(state === null ? {} : { 'advisory-state': state }),
    'date-published': { timestamp: 1758700000, date: '2026-09-24 10:24:57', asp: '2026-09-24T10:24:57.000Z' },
    'has-advisory-warning': state !== null && state >= 2 ? 1 : 0,
    'has-regional-advisory': regional,
    'has-content': 1,
    eng: { name, 'url-slug': slug, 'friendly-date': 'September 24, 2026 10:24 ET', 'advisory-text': text },
    fra: { name, 'url-slug': slug, 'friendly-date': '24 septembre 2026 10:24 HE', 'advisory-text': text },
  };
}

const FEED = {
  metadata: { generated: { timestamp: 1760500000, date: '2026-10-15 06:00:00' } },
  data: {
    AF: entry('AF', 'Afghanistan', 'afghanistan', 3, 'Avoid all travel'),
    SY: entry('SY', 'Syria', 'syria', 3, 'Avoid all travel'),
    KP: entry('KP', 'North Korea', 'north-korea', 3, 'Avoid all travel'),
    MX: entry('MX', 'Mexico', 'mexico', 1, 'Exercise a high degree of caution (with regional advisories)', 1),
    CO: entry('CO', 'Colombia', 'colombia', 1, 'Exercise a high degree of caution (with regional advisories)', 1),
    SA: entry('SA', 'Saudi Arabia', 'saudi-arabia', 2, 'Avoid non-essential travel'),
    FR: entry('FR', 'France', 'france', 1, 'Exercise a high degree of caution'),
    JP: entry('JP', 'Japan', 'japan', 0, 'Take normal security precautions'),
    'PT-20': entry('PT-20', 'Azores', 'azores', 0, 'Take normal security precautions'),
    XK: entry('XK', 'Kosovo', 'kosovo', 0, 'Take normal security precautions'),
    // advisory-state missing: the English label still says the level.
    TH: entry('TH', 'Thailand', 'thailand', null, 'Exercise a high degree of caution', 1),
    // Neither a usable state nor a known label: skipped, never guessed.
    ZZ: { ...entry('NR', 'Nauru', 'nauru', null, 'See the full advice'), 'country-iso': 'NR' },
    // State and label disagree: the structured state wins, the disagreement is reported.
    PE: entry('PE', 'Peru', 'peru', 1, 'Avoid non-essential travel', 1),
  },
};

describe('parseCaOpenData', () => {
  const result = parseCaOpenData(FEED, 2026);
  const level = (iso3: string) => result.advisoryInfo[iso3]?.ca.level;

  it('maps advisory-state 0-3 to levels 1-4 ("avoid all travel" = 4)', () => {
    assert.equal(level('AFG'), 4);
    assert.equal(level('SYR'), 4);
    assert.equal(level('PRK'), 4);
    assert.equal(level('SAU'), 3);
    assert.equal(level('FRA'), 2);
    assert.equal(level('JPN'), 1);
  });

  it('a regional advisory never raises the national level; it only shows in the label', () => {
    assert.equal(level('MEX'), 2);
    assert.equal(level('COL'), 2);
    assert.equal(result.advisoryInfo.MEX.ca.text, 'Exercise a high degree of caution, with regional advisories');
    assert.equal(result.advisoryInfo.JPN.ca.text, CA_LEVEL_TEXT[1]);
  });

  it('builds the travel.gc.ca page URL from the slug and keeps the publication date', () => {
    assert.deepEqual(result.advisoryInfo.AFG.ca, {
      level: 4,
      text: 'Avoid all travel',
      source: 'Government of Canada',
      url: 'https://travel.gc.ca/destinations/afghanistan',
      updatedAt: '2026-09-24',
    });
    const indicator = result.indicators.find((i) => i.countryIso3 === 'AFG');
    assert.deepEqual(indicator, {
      countryIso3: 'AFG',
      indicatorName: 'advisory_level_ca',
      value: 4,
      year: 2026,
      source: 'advisories_ca',
    });
  });

  it('resolves XK to Kosovo, skips sub-national keys (Azores), and reads country-iso before the key', () => {
    assert.equal(level('XKX'), 1);
    assert.ok(result.unmatched.some((u) => u.startsWith('PT-20')));
    assert.ok(result.unreadable.some((u) => u.startsWith('NRU')), 'the ZZ-keyed record is Nauru by its country-iso');
  });

  it('falls back to the English label when advisory-state is missing, and never guesses when both are unusable', () => {
    assert.equal(level('THA'), 2);
    assert.equal(level('NRU'), undefined);
  });

  it('trusts advisory-state over a disagreeing label and reports it', () => {
    assert.equal(level('PER'), 2);
    assert.deepEqual(result.mismatches, ['PER: advisory-state 1 vs "Avoid non-essential travel"']);
  });

  it('returns nothing for an unexpected shape instead of throwing', () => {
    assert.equal(parseCaOpenData(null, 2026).indicators.length, 0);
    assert.equal(parseCaOpenData({ data: [] }, 2026).indicators.length, 0);
    assert.equal(parseCaOpenData('<html>', 2026).indicators.length, 0);
  });
});

describe('summarizeCaOpenData', () => {
  it('keeps one compact audit row per record', () => {
    const rows = summarizeCaOpenData(FEED);
    assert.equal(rows.length, Object.keys(FEED.data).length);
    assert.deepEqual(rows[0], { key: 'AF', state: 3, regional: 0, published: '2026-09-24 10:24:57' });
  });
});
