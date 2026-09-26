import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  extractNzListingEntries,
  parseNzUpdateDate,
  NZ_ADVICE_LEVEL_MAP,
} from '../fetchers/advisories-tier2a.js';

/**
 * Regression coverage for the 2026-09-26 NZ (SafeTravel) regional-promotion repair
 * (PARSER-REGIONAL-BRIEF.md). The old fetcher's fallback path did
 * `pageHtml.toLowerCase().includes('do not travel')` against a per-country page's FULL text
 * -- SafeTravel states an overall level for the country PLUS separate "do not travel"/"avoid
 * non-essential travel" call-outs for named border zones, so that bare substring search
 * promoted the whole country whenever ANY region was flagged (verified live 2026-09-26:
 * Armenia's own page separately states "Exercise normal safety and security precautions ...
 * in Armenia overall (level 1 of 4)" AND "Do not travel within 5km of the border with
 * Azerbaijan ... (level 4 of 4)" for one specific border zone).
 *
 * The fix reads the site's OWN structured data instead: the `/destinations` listing page
 * server-renders `<div id="js-country-listing" data-content="{...}">`, a Kentico CMS
 * hydration blob with one JSON entry per country whose `adviceLevel` field IS ALREADY the
 * overall level, verified against each country's own "overall" accordion section (see the
 * doc comment on NZ_ADVICE_LEVEL_MAP for the cross-check). The fixture below is a trimmed
 * VERBATIM excerpt (same escaping the live page uses: HTML-entity-encoded double quotes
 * inside a double-quoted attribute) of the real `/destinations` page fetched 2026-09-26,
 * covering all 5 real `adviceLevel` bucket names and Armenia specifically (the country
 * whose OWN per-country page most directly demonstrates the old bug).
 */

const LISTING_HTML = (dataJson: string) =>
  `<html><body><div id="js-country-listing" data-content="${dataJson}"></div></body></html>`;

// Real (trimmed) payload shape, HTML-entity-escaped exactly as the live page delivers it.
const REAL_LISTING_DATA_JSON =
  '{&quot;data&quot;:[' +
  '{&quot;code&quot;:&quot;af&quot;,&quot;link&quot;:{&quot;title&quot;:&quot;Afghanistan&quot;,&quot;href&quot;:&quot;/destinations/afghanistan&quot;},&quot;region&quot;:&quot;Central Asia&quot;,&quot;adviceLevel&quot;:&quot;avoid&quot;,&quot;updatedDate&quot;:&quot;27 July 2026&quot;},' +
  '{&quot;code&quot;:&quot;bh&quot;,&quot;link&quot;:{&quot;title&quot;:&quot;Bahrain&quot;,&quot;href&quot;:&quot;/destinations/bahrain&quot;},&quot;region&quot;:&quot;Middle East&quot;,&quot;adviceLevel&quot;:&quot;high&quot;,&quot;updatedDate&quot;:&quot;01 June 2026&quot;},' +
  '{&quot;code&quot;:&quot;al&quot;,&quot;link&quot;:{&quot;title&quot;:&quot;Albania&quot;,&quot;href&quot;:&quot;/destinations/albania&quot;},&quot;region&quot;:&quot;Europe&quot;,&quot;adviceLevel&quot;:&quot;medium&quot;,&quot;updatedDate&quot;:&quot;14 July 2025&quot;},' +
  // Armenia: "low" overall despite its OWN per-country page having a separate Level-4
  // "do not travel within 5km of the border with Azerbaijan" regional call-out -- the whole
  // point of the fix is that this listing entry is unaffected by that regional text.
  '{&quot;code&quot;:&quot;am&quot;,&quot;link&quot;:{&quot;title&quot;:&quot;Armenia&quot;,&quot;href&quot;:&quot;/destinations/armenia&quot;},&quot;region&quot;:&quot;Europe&quot;,&quot;adviceLevel&quot;:&quot;low&quot;,&quot;updatedDate&quot;:&quot;27 November 2024&quot;},' +
  '{&quot;code&quot;:&quot;as&quot;,&quot;link&quot;:{&quot;title&quot;:&quot;American Samoa&quot;,&quot;href&quot;:&quot;/destinations/american-samoa&quot;},&quot;region&quot;:&quot;Pacific&quot;,&quot;adviceLevel&quot;:&quot;normal&quot;,&quot;updatedDate&quot;:&quot;28 July 2025&quot;}' +
  ']}';

describe('extractNzListingEntries (NZ/SafeTravel structured listing)', () => {
  it('parses all 5 real adviceLevel buckets from the entity-escaped data-content attribute', () => {
    const entries = extractNzListingEntries(LISTING_HTML(REAL_LISTING_DATA_JSON));
    assert.equal(entries.length, 5);
    assert.deepEqual(
      entries.map((e) => [e.code, e.adviceLevel]),
      [
        ['af', 'avoid'],
        ['bh', 'high'],
        ['al', 'medium'],
        ['am', 'low'],
        ['as', 'normal'],
      ],
    );
  });

  it('Armenia is "low" (Level 1 overall) in the structured listing, unaffected by its own page\'s separate Level-4 border-zone call-out', () => {
    const entries = extractNzListingEntries(LISTING_HTML(REAL_LISTING_DATA_JSON));
    const armenia = entries.find((e) => e.code === 'am');
    assert.ok(armenia);
    assert.equal(NZ_ADVICE_LEVEL_MAP[armenia.adviceLevel], 1);
  });

  it('every real bucket name maps to a distinct, correct unified level', () => {
    assert.equal(NZ_ADVICE_LEVEL_MAP.avoid, 4);
    assert.equal(NZ_ADVICE_LEVEL_MAP.high, 3);
    assert.equal(NZ_ADVICE_LEVEL_MAP.medium, 2);
    assert.equal(NZ_ADVICE_LEVEL_MAP.low, 1);
    assert.equal(NZ_ADVICE_LEVEL_MAP.normal, 1);
  });

  it('throws (never returns a guessed empty result) when #js-country-listing is missing entirely', () => {
    const html = '<html><body><div id="somethingElse">no listing here</div></body></html>';
    assert.throws(() => extractNzListingEntries(html));
  });

  it('throws when the data-content JSON is malformed', () => {
    const html = LISTING_HTML('{&quot;data&quot;:[this is not valid json');
    assert.throws(() => extractNzListingEntries(html));
  });
});

describe('parseNzUpdateDate (NZ "D Month YYYY" -> ISO, UTC-safe)', () => {
  it('parses a real single-digit-day date without shifting the calendar date across timezones', () => {
    assert.equal(parseNzUpdateDate('01 June 2026'), '2026-06-01T00:00:00.000Z');
  });

  it('parses a real double-digit-day date', () => {
    assert.equal(parseNzUpdateDate('27 July 2026'), '2026-07-27T00:00:00.000Z');
  });

  it('returns undefined for an unparseable or absent date rather than guessing', () => {
    assert.equal(parseNzUpdateDate('not a date'), undefined);
    assert.equal(parseNzUpdateDate(undefined), undefined);
  });
});
