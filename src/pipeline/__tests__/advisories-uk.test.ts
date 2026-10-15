import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWholeCountryObject, parseUkAdvisory, ukTitleNames, ukWarningsText } from '../fetchers/advisories-uk.js';

/**
 * UK FCDO level + label (consistency issues I45 and I46, 2026-10-15). The fixture holds the
 * live gov.uk content-API documents fetched 2026-10-15, trimmed to the "Areas where FCDO
 * advises against travel" section (Crown copyright, Open Government Licence v3.0).
 */
const fixtures = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'uk-fcdo-warnings.json'), 'utf-8'),
) as Record<string, Record<string, unknown> & { title: string }>;

/** Same inputs as fetchUkAdvisories: FCDO's own title name, never our display names. */
function parse(slug: string) {
  const doc = fixtures[slug];
  assert.ok(doc, `fixture ${slug}`);
  return parseUkAdvisory(doc, ukTitleNames(doc.title.replace(/\s*travel advice\s*$/i, '')));
}

describe('parseUkAdvisory: whole-country verdicts on "parts" pages (I46)', () => {
  it('Sudan: "all travel to Sudan because of the ongoing military conflict" -> 4, not "all but essential"', () => {
    assert.deepEqual(parse('sudan'), { level: 4, text: 'Advise against all travel to most of the country' });
  });

  it('Somalia: "all travel to Somalia, including Somaliland, except for the regions of Awdal..." -> 4', () => {
    assert.equal(parse('somalia').level, 4);
  });

  it('Central African Republic ("the whole of ... except to the capital"), Libya ("Libya except for the cities of"), Ukraine ("all other regions of Ukraine") -> 4', () => {
    assert.equal(parse('central-african-republic').level, 4);
    assert.equal(parse('libya').level, 4);
    assert.equal(parse('ukraine').level, 4);
  });

  it('Chad and Venezuela: a rest-of-country "all but essential" catch-all is 3, labelled as covering most of the country', () => {
    assert.deepEqual(parse('chad'), {
      level: 3,
      text: 'Advise against all but essential travel to most of the country, and all travel to parts',
    });
    assert.equal(parse('venezuela').level, 3);
    assert.equal(parse('eritrea').level, 3);
  });
});

describe('parseUkAdvisory: regional verdicts keep the alert_status mapping', () => {
  it('Turkey: "all travel to within 10km of the border with Syria" stays the parts mapping (3), labelled as parts', () => {
    assert.deepEqual(parse('turkey'), { level: 3, text: 'Advise against all travel to parts of the country' });
  });

  it('Djibouti: "the Djibouti-Eritrea border" names the country only as a modifier -> not national', () => {
    assert.equal(parse('djibouti').level, 3);
  });

  it('Iraq ("the Kurdistan Region of Iraq", "Iraq\'s borders") and Israel ("all travel to Gaza") are regional', () => {
    assert.equal(parse('iraq').level, 3);
    assert.equal(parse('israel').level, 3);
  });

  it('Saudi Arabia\'s list form ("FCDO advises against:" + "all travel to within 10km...") is read and stays regional', () => {
    assert.match(ukWarningsText(fixtures['saudi-arabia']), /^all travel to within 10km of the border with Yemen$/m);
    assert.equal(parse('saudi-arabia').level, 3);
  });

  it('Laos: "all but essential travel to parts" is 2 with a level label, never the flood-update description (I45)', () => {
    const laos = parse('laos');
    assert.deepEqual(laos, { level: 2, text: 'Advise against all but essential travel to parts of the country' });
    assert.doesNotMatch(laos.text, /flood/i);
  });
});

describe('parseUkAdvisory: whole-country statuses and no advice', () => {
  it('avoid_all_travel_to_whole_country -> 4 "Advise against all travel" (Afghanistan, Haiti)', () => {
    assert.deepEqual(parse('afghanistan'), { level: 4, text: 'Advise against all travel' });
    assert.deepEqual(parse('haiti'), { level: 4, text: 'Advise against all travel' });
  });

  it('an empty alert_status is level 1 with a level label, never the page description (Costa Rica, I45)', () => {
    const costaRica = parse('costa-rica');
    assert.deepEqual(costaRica, { level: 1, text: 'No advice against travel' });
    assert.match(String(fixtures['costa-rica'].description), /^Latest FCDO travel advice for Costa Rica/);
  });

  it('avoid_all_but_essential_travel_to_whole_country -> 3', () => {
    const doc = { details: { alert_status: ['avoid_all_but_essential_travel_to_whole_country'], parts: [] } };
    assert.deepEqual(parseUkAdvisory(doc, ['Cuba']), { level: 3, text: 'Advise against all but essential travel' });
  });
});

describe('isWholeCountryObject', () => {
  const sudan = ['Sudan'];
  it('accepts the country with exceptions, reasons, and catch-all forms', () => {
    assert.equal(isWholeCountryObject('Sudan because of the conflict', sudan), true);
    assert.equal(isWholeCountryObject('the whole of Sudan, except Port Sudan', sudan), true);
    assert.equal(isWholeCountryObject('all other regions of Sudan', sudan), true);
    assert.equal(isWholeCountryObject('the rest of the country', sudan), true);
    assert.equal(isWholeCountryObject('the remaining areas of Sudan including Khartoum', sudan), true);
  });

  it('rejects regions, borders and possessives', () => {
    assert.equal(isWholeCountryObject('within 10km of the border with Sudan', sudan), false);
    assert.equal(isWholeCountryObject("Sudan's border with Chad", sudan), false);
    assert.equal(isWholeCountryObject('Sudan border areas', sudan), false);
    assert.equal(isWholeCountryObject('the Sudan-Chad border', sudan), false);
    assert.equal(isWholeCountryObject('South Sudan', sudan), false);
    assert.equal(isWholeCountryObject('the rest of Darfur', sudan), false);
  });

  it('matches names with a leading "the" or a parenthetical on either side', () => {
    assert.equal(isWholeCountryObject('the Central African Republic', ['Central African Republic']), true);
    assert.equal(isWholeCountryObject('Gambia', ['The Gambia']), true);
    assert.equal(isWholeCountryObject('North Korea', ['Korea, DPR (North Korea)', 'North Korea']), true);
  });
});

describe('ukTitleNames', () => {
  it('takes the names from FCDO\'s own title, splitting off a parenthetical alias', () => {
    assert.deepEqual(ukTitleNames('Sudan'), ['Sudan']);
    assert.deepEqual(ukTitleNames('Korea, DPR (North Korea)'), ['Korea, DPR', 'North Korea']);
    assert.deepEqual(ukTitleNames('Central African Republic'), ['Central African Republic']);
  });
});
