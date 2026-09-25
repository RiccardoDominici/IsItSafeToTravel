import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseUsJsonApiData, parseUsRssXml, daysBetween } from '../fetchers/advisories.js';

/**
 * SOURCE-REPAIR-BRIEF (2026-09-25): the US State Department HTML advisories
 * page (travel.state.gov/.../traveladvisories.html) has returned HTTP 403 to
 * every GitHub Actions run since ~2026-07-14/16, plus to plain curl and
 * WebFetch from outside networks during this repair -- it silently masked its
 * own failure by falling back to a 2026-07-13 cache that then got re-persisted
 * forward every day. fetchUsAdvisories() now tries, in order, the State
 * Department's own JSON API, then its RSS feed, then the HTML page as a last
 * resort (advisories.ts, US_ENDPOINTS).
 *
 * These tests cover the two NEW structured-endpoint parsers in isolation, with
 * no network access: parseUsJsonApiData / parseUsRssXml take already-fetched
 * data and return the same FetcherResult shape the rest of the pipeline
 * expects. The fixtures are trimmed-but-real payloads captured 2026-09-25 from
 * the live JSON API and RSS feed (fixtures/us-advisories.json / .xml) --
 * chosen specifically to cover every non-trivial resolution path found while
 * investigating this repair: plain titles, the "<Name> Travel Advisory -
 * Level N" wording variant (Mexico), 12 government-label/ISO-name aliases,
 * the shared China/Hong-Kong/Macau headline, a country split across two
 * source rows (Palestine, BES islands), one source row that covers two of our
 * countries (French West Indies), a benign duplicate row (Saint Kitts), and a
 * destination outside our 248-country list (Bermuda).
 */

const FIXTURES_DIR = join(process.cwd(), 'src', 'pipeline', '__tests__', 'fixtures');
const JSON_FIXTURE = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'us-advisories.json'), 'utf-8'),
) as unknown[];
const RSS_FIXTURE = readFileSync(join(FIXTURES_DIR, 'us-advisories.xml'), 'utf-8');

/** Look up a single country's `us` AdvisoryInfo out of a FetcherResult, or undefined. */
function usInfo(result: ReturnType<typeof parseUsJsonApiData>, iso3: string) {
  return result.advisoryInfo[iso3]?.us;
}

describe('advisories.ts: parseUsJsonApiData (US State Dept JSON API)', () => {
  const result = parseUsJsonApiData(JSON_FIXTURE, 2026);

  it('parses plain "<Name> - Level N: ..." titles', () => {
    assert.equal(usInfo(result, 'JPN')?.level, 1);
    assert.equal(usInfo(result, 'AFG')?.level, 4);
  });

  it('parses the "<Name> Travel Advisory - Level N" wording variant (Mexico)', () => {
    assert.equal(usInfo(result, 'MEX')?.level, 2);
  });

  it('resolves government-label aliases to our ISO-based country names', () => {
    assert.equal(usInfo(result, 'MAC')?.level, 3, 'Macau -> Macao (MAC)');
    assert.equal(usInfo(result, 'CUW')?.level, 1, 'Curaçao -> Curacao (CUW)');
    assert.equal(usInfo(result, 'BHS')?.level, 2, 'The Bahamas -> Bahamas (BHS)');
    assert.equal(usInfo(result, 'FSM')?.level, 1, 'Federated States of Micronesia -> Micronesia (FSM)');
    assert.equal(usInfo(result, 'MMR')?.level, 4, 'Burma -> Myanmar (MMR)');
    assert.equal(usInfo(result, 'CIV')?.level, 2, "Cote d Ivoire -> Cote d'Ivoire (CIV)");
    assert.equal(usInfo(result, 'KGZ')?.level, 1, 'The Kyrgyz Republic -> Kyrgyzstan (KGZ)');
    assert.equal(usInfo(result, 'GMB')?.level, 2, 'The Gambia -> Gambia (GMB)');
    assert.equal(usInfo(result, 'CZE')?.level, 1, 'Czechia -> Czech Republic (CZE)');
    assert.equal(usInfo(result, 'DNK')?.level, 2, 'Kingdom of Denmark -> Denmark (DNK)');
  });

  it('does not confuse Congo (COG) with DR Congo (COD) via the "Republic of the Congo" alias', () => {
    assert.equal(usInfo(result, 'COG')?.level, 2, 'Republic of the Congo -> Congo (COG)');
    assert.equal(usInfo(result, 'COD')?.level, 4, 'Democratic Republic of the Congo -> COD, already an exact match');
  });

  it('merges a country split across two source rows to the MOST SEVERE level (composite territories)', () => {
    // West Bank = Level 3, Gaza = Level 4 -- both map to Palestine (PSE).
    // Correct data beats coverage: understating Gaza's Do Not Travel level by
    // averaging/picking West Bank instead would be the "wrong level on a war
    // zone" the repair brief calls out as worse than no data.
    assert.equal(usInfo(result, 'PSE')?.level, 4);
    // Bonaire = Level 1, Saba and Sint Eustatius = Level 1 -- both map to BES;
    // tie is resolved deterministically (first row wins on an exact tie).
    assert.equal(usInfo(result, 'BES')?.level, 1);
  });

  it('fans a single "French West Indies" row out to both Martinique and Guadeloupe', () => {
    assert.equal(usInfo(result, 'MTQ')?.level, 1);
    assert.equal(usInfo(result, 'GLP')?.level, 1);
  });

  it('rescues mainland China from the shared "Mainland China, Hong Kong & Macau" headline via its URL, and does not let the other two grouped duplicate rows overwrite Hong Kong/Macau\'s own clean rows', () => {
    assert.equal(usInfo(result, 'CHN')?.level, 2, 'china-travel-advisory.html row -> China');
    assert.equal(usInfo(result, 'HKG')?.level, 2, 'own clean "Hong Kong - Level 2" row, untouched by the grouped dup');
    assert.equal(usInfo(result, 'MAC')?.level, 3, 'own clean "Macau - Level 3" row, untouched by the grouped dup');
  });

  it('drops a destination with no entry in our 248-country list (Bermuda) without throwing', () => {
    assert.equal(usInfo(result, 'BMU'), undefined);
    assert.ok(
      !result.indicators.some((i) => i.countryIso3 === 'BMU'),
      'Bermuda must not appear anywhere in the output',
    );
  });

  it('keeps only one entry for a country listed twice under different URL schemes (Saint Kitts and Nevis)', () => {
    const knaRows = result.indicators.filter((i) => i.countryIso3 === 'KNA');
    assert.equal(knaRows.length, 1);
    assert.equal(usInfo(result, 'KNA')?.level, 1);
  });

  it('keeps the per-country deep link as `url`, not a generic listing-page URL', () => {
    assert.match(usInfo(result, 'JPN')?.url ?? '', /japan-travel-advisory\.html$/);
  });

  it('parses `updatedAt` as the LOCAL calendar date, not the UTC-shifted instant', () => {
    // Afghanistan's Published is "2026-02-19T19:00:00-05:00": naively converting
    // to a UTC instant would land on 2026-02-20. We must keep 2026-02-19.
    assert.equal(usInfo(result, 'AFG')?.updatedAt, '2026-02-19T00:00:00Z');
  });

  it('every emitted level is within the valid 1-4 range', () => {
    for (const ind of result.indicators) {
      assert.ok(ind.value >= 1 && ind.value <= 4, `${ind.countryIso3}: ${ind.value}`);
    }
  });

  it('reaches a plausible total distinct-country count for this trimmed fixture', () => {
    const distinct = new Set(result.indicators.map((i) => i.countryIso3));
    assert.equal(distinct.size, 22);
  });

  it('silently skips malformed entries (no "Level N:" in title, non-object array items) instead of throwing', () => {
    const malformed = [
      { Title: 'Some Announcement With No Level', Link: 'https://travel.state.gov/x.html' },
      { Title: 'Missing Link - Level 2: Exercise Increased Caution' }, // no Link
      null,
      42,
      'a string, not an object',
      { Title: 'France - Level 2: Exercise Increased Caution', Link: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/france-travel-advisory.html' },
    ];
    const r = parseUsJsonApiData(malformed, 2026);
    assert.equal(r.indicators.length, 1, 'only the one well-formed France row should survive');
    assert.equal(usInfo(r, 'FRA')?.level, 2);
  });
});

describe('advisories.ts: parseUsRssXml (US State Dept RSS feed)', () => {
  const result = parseUsRssXml(RSS_FIXTURE, 2026);

  it('parses plain titles and the "Travel Advisory" wording variant', () => {
    assert.equal(usInfo(result, 'JPN')?.level, 1);
    assert.equal(usInfo(result, 'AFG')?.level, 4);
    assert.equal(usInfo(result, 'MEX')?.level, 2);
  });

  it('resolves the same government-label aliases as the JSON API parser', () => {
    assert.equal(usInfo(result, 'MAC')?.level, 3);
    assert.equal(usInfo(result, 'CUW')?.level, 1);
    assert.equal(usInfo(result, 'BHS')?.level, 2);
    assert.equal(usInfo(result, 'MMR')?.level, 4);
  });

  it('merges West Bank + Gaza to Palestine at the most severe level (4)', () => {
    assert.equal(usInfo(result, 'PSE')?.level, 4);
  });

  it('rescues China from the grouped headline via URL and leaves Hong Kong/Macau on their own clean rows', () => {
    assert.equal(usInfo(result, 'CHN')?.level, 2);
    assert.equal(usInfo(result, 'HKG')?.level, 2);
    assert.equal(usInfo(result, 'MAC')?.level, 3);
  });

  it('drops Bermuda (not in our 248-country list)', () => {
    assert.equal(usInfo(result, 'BMU'), undefined);
  });

  it('dedupes the Saint Kitts and Nevis duplicate row', () => {
    const knaRows = result.indicators.filter((i) => i.countryIso3 === 'KNA');
    assert.equal(knaRows.length, 1);
  });

  it('parses `updatedAt` from a time-less RFC-822-ish pubDate without a timezone-dependent shift', () => {
    // "Fri, 20 Feb 2026" has no time component; a naive `new Date(str)` would
    // interpret it in the running process's local timezone.
    assert.equal(usInfo(result, 'AFG')?.updatedAt, '2026-02-20T00:00:00Z');
  });

  it('prefers the structured <category domain="Threat-Level"> field over the title text when they disagree', () => {
    // Synthetic (not from the fixture file): proves the category-wins branch
    // in parseUsRssXml, which real-world data has never exercised so far
    // (title and category have always agreed in every fetch checked 2026-09-25).
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>France - Level 2: Exercise Increased Caution</title>
    <link>https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/france-travel-advisory.html</link>
    <pubDate>Mon, 01 Jun 2026</pubDate>
    <category domain="Threat-Level">Level 3: Reconsider Travel</category>
  </item>
</channel></rss>`;
    const r = parseUsRssXml(xml, 2026);
    assert.equal(usInfo(r, 'FRA')?.level, 3, 'category (3) must win over the title text (2)');
  });

  it('every emitted level is within the valid 1-4 range', () => {
    for (const ind of result.indicators) {
      assert.ok(ind.value >= 1 && ind.value <= 4, `${ind.countryIso3}: ${ind.value}`);
    }
  });
});

describe('advisories.ts: daysBetween', () => {
  it('computes whole days across a month/year boundary regardless of process timezone', () => {
    assert.equal(daysBetween('2026-09-25', '2026-07-13'), 74);
    assert.equal(daysBetween('2026-01-01', '2025-12-31'), 1);
  });

  it('returns 0 for the same date', () => {
    assert.equal(daysBetween('2026-09-25', '2026-09-25'), 0);
  });
});
