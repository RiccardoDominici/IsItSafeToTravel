import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCaOpenData,
  summarizeCaOpenData,
  CA_LEVEL_TEXT,
  CA_MIN_COUNTRIES,
} from '../fetchers/advisories-ca.js';
import { COUNTRIES } from '../config/countries.js';

/**
 * Canada open-data parser (data.international.gc.ca/travel-voyage/index-alpha-eng.json).
 * Synthetic records follow the feed's published shape, as found in real copies from 2014,
 * 2022 and 2025-03-07: `data` keyed by ISO2, `advisory-state` 0-3, `has-regional-advisory`
 * 0/1, `date-published.date`, `eng.{name,url-slug,advisory-text}`. The live feed could not be
 * reached from the build machine (sandbox DNS); the first live read is the next CI data run.
 * Synthetic levels are the travel.gc.ca levels of the 2026-10-01 HTML parse (the last good
 * read). Peru's state/label disagreement is synthetic.
 */
function record(iso2: string, name: string, slug: string, state: number, text: string, regional = 0) {
  return {
    'country-id': 1,
    'country-iso': iso2,
    'country-eng': name,
    'country-fra': name,
    'advisory-state': state,
    'date-published': { timestamp: 1758700000, date: '2026-09-24 10:24:57', asp: '2026-09-24T10:24:57.000Z' },
    'has-advisory-warning': state >= 2 ? 1 : 0,
    'has-regional-advisory': regional,
    'has-content': 1,
    eng: { name, 'url-slug': slug, 'friendly-date': 'September 24, 2026 10:24 ET', 'advisory-text': text },
    fra: { name, 'url-slug': slug, 'friendly-date': '24 septembre 2026 10:24 HE', 'advisory-text': text },
  };
}

const METADATA = { generated: { timestamp: 1760500000, date: '2026-10-15 06:00:00' } };

const SMALL_FEED = {
  metadata: METADATA,
  data: {
    AF: record('AF', 'Afghanistan', 'afghanistan', 3, 'Avoid all travel'),
    SY: record('SY', 'Syria', 'syria', 3, 'Avoid all travel'),
    KP: record('KP', 'North Korea', 'north-korea', 3, 'Avoid all travel'),
    MX: record('MX', 'Mexico', 'mexico', 1, 'Exercise a high degree of caution (with regional advisories)', 1),
    CO: record('CO', 'Colombia', 'colombia', 1, 'Exercise a high degree of caution (with regional advisories)', 1),
    SA: record('SA', 'Saudi Arabia', 'saudi-arabia', 2, 'Avoid non-essential travel'),
    FR: record('FR', 'France', 'france', 1, 'Exercise a high degree of caution'),
    JP: record('JP', 'Japan', 'japan', 0, 'Exercise normal security precautions'),
    'PT-20': record('PT-20', 'Azores', 'azores', 0, 'Exercise normal security precautions'),
    XK: record('XK', 'Kosovo', 'kosovo', 0, 'Exercise normal security precautions'),
    PE: record('PE', 'Peru', 'peru', 1, 'Avoid non-essential travel', 1),
  },
};

/** A well-formed feed with one record per country of ours that has an ISO2 code (> 150). */
function fullFeed(edit: (data: Record<string, ReturnType<typeof record>>) => void = () => {}) {
  const data: Record<string, ReturnType<typeof record>> = {};
  for (const c of COUNTRIES) data[c.iso2] = record(c.iso2, c.iso2, c.iso2.toLowerCase(), 0, 'Exercise normal security precautions');
  edit(data);
  return { metadata: METADATA, data };
}

describe('parseCaOpenData: levels', () => {
  const result = parseCaOpenData(SMALL_FEED, 2026, { minCountries: 0 });
  const level = (iso3: string) => result.advisoryInfo[iso3]?.ca.level;

  it('maps advisory-state 0-3 one-to-one to levels 1-4 ("avoid all travel" = 4)', () => {
    assert.deepEqual(result.problems, []);
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
    assert.equal(result.advisoryInfo.MEX.ca.text, 'Exercise a high degree of caution (with regional advisories)');
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
    assert.deepEqual(
      result.indicators.find((i) => i.countryIso3 === 'AFG'),
      { countryIso3: 'AFG', indicatorName: 'advisory_level_ca', value: 4, year: 2026, source: 'advisories_ca' },
    );
  });

  it('matches by ISO code only: XK is Kosovo, PT-20 (Azores) is unmatched, a name alone matches nothing', () => {
    assert.equal(level('XKX'), 1);
    assert.ok(result.unmatched.some((u) => u.startsWith('PT-20')));
    const byName = parseCaOpenData(
      { metadata: METADATA, data: { 'FR-X': { ...record('', 'France', 'france', 0, 'Exercise normal security precautions') } } },
      2026,
      { minCountries: 0 },
    );
    assert.equal(byName.indicators.length, 0, 'the name "France" is never used to match');
  });

  it('uses advisory-state over a disagreeing label and reports the disagreement', () => {
    assert.equal(level('PER'), 2);
    assert.deepEqual(result.mismatches, ['PER: advisory-state 1 vs "Avoid non-essential travel"']);
  });
});

describe('parseCaOpenData: strict validation, whole payload or nothing', () => {
  it(`accepts a well-formed feed of ${COUNTRIES.length} records with the default floor of ${CA_MIN_COUNTRIES}`, () => {
    const result = parseCaOpenData(fullFeed(), 2026);
    assert.deepEqual(result.problems, []);
    assert.ok(result.indicators.length >= CA_MIN_COUNTRIES);
  });

  it('rejects a feed resolving to fewer than 150 countries (truncated) and publishes none of it', () => {
    const result = parseCaOpenData(SMALL_FEED, 2026);
    assert.equal(result.indicators.length, 0);
    assert.deepEqual(result.advisoryInfo, {});
    assert.match(result.problems[0], /only 10 records match our countries \(< 150\)/);
  });

  it('rejects the whole feed when one record has an advisory-state outside 0-3, or none', () => {
    const outOfRange = parseCaOpenData(fullFeed((d) => (d.FR['advisory-state'] = 4)), 2026);
    assert.equal(outOfRange.indicators.length, 0);
    assert.match(outOfRange.problems[0], /FR: advisory-state 4 is not an integer 0-3/);

    const missing = parseCaOpenData(
      fullFeed((d) => delete (d.MX as Partial<ReturnType<typeof record>>)['advisory-state']),
      2026,
    );
    assert.match(missing.problems[0], /MX: advisory-state undefined/);

    const asString = parseCaOpenData(fullFeed((d) => ((d.DE as Record<string, unknown>)['advisory-state'] = '2')), 2026);
    assert.match(asString.problems[0], /DE: advisory-state "2"/);
  });

  it('rejects records missing an expected key (eng url-slug, has-regional-advisory)', () => {
    const noSlug = parseCaOpenData(fullFeed((d) => (d.IT.eng['url-slug'] = '')), 2026);
    assert.match(noSlug.problems[0], /IT: eng block lacks url-slug/);
    const noRegional = parseCaOpenData(
      fullFeed((d) => delete (d.ES as Partial<ReturnType<typeof record>>)['has-regional-advisory']),
      2026,
    );
    assert.match(noRegional.problems[0], /ES: no has-regional-advisory/);
  });

  it('rejects a payload without metadata.generated.date or data, and non-JSON-object payloads', () => {
    assert.match(parseCaOpenData({ data: fullFeed().data }, 2026).problems[0], /metadata\.generated\.date missing/);
    assert.match(parseCaOpenData({ metadata: METADATA }, 2026).problems.join(), /data object missing/);
    assert.match(parseCaOpenData('<html>', 2026).problems[0], /not a JSON object/);
    assert.match(parseCaOpenData({ metadata: METADATA, data: [] }, 2026).problems.join(), /data object missing/);
  });

  it('accepts a few label disagreements, rejects more than 10% of the records', () => {
    const few = parseCaOpenData(fullFeed((d) => (d.FR.eng['advisory-text'] = 'Avoid all travel')), 2026);
    assert.deepEqual(few.problems, []);
    assert.equal(few.mismatches.length, 1);

    const many = parseCaOpenData(
      fullFeed((d) => {
        for (const key of Object.keys(d).slice(0, 40)) d[key].eng['advisory-text'] = 'Avoid all travel';
      }),
      2026,
    );
    assert.equal(many.indicators.length, 0);
    assert.match(many.problems.join(), /40 of \d+ records contradict their own label/);
  });
});

/**
 * A real copy of the feed: 16 records of index-alpha-eng.json as generated 2025-03-07 (from a
 * public GitHub mirror; "recent-updates" prose removed). Open Government Licence - Canada.
 */
describe('parseCaOpenData on a real 2025-03-07 excerpt of the feed', () => {
  const real = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'ca-open-data-2025-03-07.json'), 'utf-8'),
  );
  const result = parseCaOpenData(real, 2025, { minCountries: 0 });
  const level = (iso3: string) => result.advisoryInfo[iso3]?.ca.level;

  it('passes validation: every record but the Azores matches, no state/label disagreement', () => {
    assert.deepEqual(result.problems, []);
    assert.equal(result.indicators.length, 15);
    assert.deepEqual(result.unmatched, ['PT-20 (Azores)']);
    assert.deepEqual(result.mismatches, []);
  });

  it('"Avoid all travel" countries are 4, Israel "Avoid non-essential travel" is 3, Mexico/Colombia/Turkey/India are 2 with regional advisories, the US is 1', () => {
    for (const iso3 of ['AFG', 'SYR', 'PRK', 'UKR', 'RUS', 'VEN', 'HTI']) assert.equal(level(iso3), 4, iso3);
    assert.equal(level('ISR'), 3);
    for (const iso3 of ['MEX', 'COL', 'TUR', 'IND']) {
      assert.equal(level(iso3), 2, iso3);
      assert.match(result.advisoryInfo[iso3].ca.text, /\(with regional advisories\)$/);
    }
    assert.equal(level('FRA'), 2);
    assert.equal(level('USA'), 1);
    assert.equal(result.advisoryInfo.USA.ca.text, 'Exercise normal security precautions');
    assert.equal(level('XKX'), 1, 'regional advisories do not raise Kosovo above its national 1');
  });

  it('uses the travel.gc.ca slugs the feed carries (Türkiye renamed)', () => {
    assert.equal(result.advisoryInfo.TUR.ca.url, 'https://travel.gc.ca/destinations/turkiye');
    assert.equal(result.advisoryInfo.ISR.ca.url, 'https://travel.gc.ca/destinations/israel-the-west-bank-and-the-gaza-strip');
    assert.equal(result.advisoryInfo.MEX.ca.updatedAt, '2025-03-06');
  });
});

describe('summarizeCaOpenData', () => {
  it('keeps one compact audit row per record', () => {
    const rows = summarizeCaOpenData(SMALL_FEED);
    assert.equal(rows.length, Object.keys(SMALL_FEED.data).length);
    assert.deepEqual(rows[0], { key: 'AF', state: 3, regional: 0, published: '2026-09-24 10:24:57' });
  });
});
