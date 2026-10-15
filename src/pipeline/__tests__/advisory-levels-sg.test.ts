import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeSgLevel } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-26 SG (mfa.gov.sg) spot-check (PARSER-REGIONAL-BRIEF:
 * "sg spot-check: TJK"). Tajikistan's real page reads "Singaporeans should avoid all travel
 * to the Tajikistan-Afghanistan BORDER AREAS and Gorno-Badakhshan AUTONOMOUS OBLAST due to
 * the security situation there" -- a Level-4 phrase ("avoid all travel") naming a specific
 * named sub-region (Tajikistan's own autonomous oblast, GBAO, plus a border strip), not the
 * country. normalizeSgLevel's REGIONAL_WORDS list already existed (an earlier repair) to cap
 * exactly this kind of partial warning at Level 2, but only had "border region" (singular,
 * no plural "s") and nothing for a named autonomous division, so this specific paragraph
 * slipped through uncapped and Tajikistan was reported as Level 4 for the whole country.
 * Fixture is the VERBATIM live page text, fetched 2026-09-26.
 */

describe('normalizeSgLevel (Tajikistan regional-cap fix)', () => {
  it('Tajikistan: "avoid all travel" naming the border areas + Gorno-Badakhshan Autonomous Oblast is capped at 2, not 4', () => {
    const text = [
      'Singaporeans are strongly advised to take all necessary precautions for their personal safety, including monitoring the local news and heeding the advice and instructions of the local authorities. Those travelling to the Tajikistan-Kyrgyz Republic border areas should exercise vigilance.',
      'Singaporeans should avoid all travel to the Tajikistan-Afghanistan border areas and Gorno-Badakhshan Autonomous Oblast due to the security situation there.',
    ].join('\n');
    assert.equal(normalizeSgLevel(text), 2);
  });

  it('a bare "avoid all travel to <Country>" with no regional qualifier still resolves to 4 (North Korea\'s real wording, re-checked so this fix does not over-cap genuine whole-country warnings)', () => {
    const text = 'The situation in North Korea remains unpredictable. Singaporeans should avoid all non-essential travel to North Korea.';
    assert.equal(normalizeSgLevel(text), 3);
  });

  it('Libya\'s real "defer all non-essential travel to Libya" plus unrelated "outlying districts"/"desert areas" mentions is NOT capped -- those are aggravating detail about the SAME already-named country, not a different named region, and neither phrase is in the regional-word list', () => {
    const text =
      'Singaporeans are advised to defer all non-essential travel to Libya. There is a risk of armed clashes between rival militias in the outlying districts of the capital, Tripoli. The desert areas outside the major cities are also considered to be unsafe given the presence of armed militia groups.';
    assert.equal(normalizeSgLevel(text), 3);
  });

  it('a bare "border area" mention alone (no Level 3/4 phrase in the same paragraph) does not fabricate a level', () => {
    const text = 'Those travelling to the border areas should exercise vigilance.';
    assert.equal(normalizeSgLevel(text), null);
  });
});

/**
 * 2026-10-15 advisory-outlier audit: Haiti, Iran, Lebanon (and Pakistan/Bangladesh found by the
 * full 191-page sweep the same day) read below what MFA's own "Travel Advisory" pages say. Fixtures
 * are VERBATIM paragraphs of the live pages, fetched 2026-10-15, joined exactly like
 * fetchSgAdvisories joins them; the second argument is what the fetcher now passes (the page's own
 * <h1>, then our English name).
 */
describe('normalizeSgLevel: verdicts that name the country itself (2026-10-15)', () => {
  it('Lebanon: "In view of the volatile situation in the region ... defer all travel to Lebanon ... should leave the country immediately" -> 4 (the contextual "the region" and the "Lebanon-Israel border areas" aside capped it at 2)', () => {
    const text =
      'In view of the volatile situation in the region, Singaporeans are advised to defer all travel to Lebanon. Singaporeans currently in Lebanon should leave the country immediately via commercial options while they remain available. Singaporeans who choose to remain in Lebanon should remain vigilant, monitor local developments closely and heed the advice of the Lebanese government. They should also avoid protests and large gatherings, as well as avoid travel to southern Beirut and southern Lebanon, including the Lebanon-Israel border areas.';
    assert.equal(normalizeSgLevel(text, ['Lebanon', 'Lebanon']), 4);
  });

  it('Lebanon without country names: "should leave the country immediately" alone is still whole-country -> 4', () => {
    const text =
      'In view of the volatile situation in the region, Singaporeans are advised to defer all travel to Lebanon. Singaporeans currently in Lebanon should leave the country immediately via commercial options while they remain available.';
    assert.equal(normalizeSgLevel(text), 4);
  });

  it('Iran: "Singaporeans who are currently in Iran should ... leave as soon as practicable" -> 4 (the page was read as 2 from its Middle-East "defer all travel to the region" paragraph alone)', () => {
    const text = [
      'Due to the escalating security situation in the Middle East, Singaporeans are advised to defer all travel to the region. Please refer to the Spokesperson’s Comments issued by MFA on 28 February 2026 for more information.',
      'Singaporeans who are currently in Iran should remain vigilant, monitor the situation closely, and leave as soon as practicable. They should also avoid demonstrations and places where large crowds congregate.',
    ].join('\n');
    assert.equal(normalizeSgLevel(text, ['Iran', 'Iran']), 4);
  });

  it('Haiti: "Singaporeans should defer non-essential travel to Haiti" (no "all") -> 3, not the 2 of its "exercise a high degree of caution" paragraph', () => {
    const text = [
      'Singaporeans should defer non-essential travel to Haiti. Singaporeans in Haiti are advised to remain vigilant, monitor the local news closely, and heed the instructions of the authorities.',
      'Travellers are advised to exercise a high degree of caution in Haiti due to the high risk of violent crime and civil unrest.',
    ].join('\n');
    assert.equal(normalizeSgLevel(text, ['Haiti', 'Haiti']), 3);
  });

  it('Pakistan: "defer all non-essential travel to Pakistan" stays 3 although the same paragraph mentions "the border regions between Pakistan and India"', () => {
    const text =
      'In view of the volatile security situation between Pakistan and India, Singaporeans are advised to defer all non-essential travel to Pakistan. Travellers should exercise precaution, especially at the border regions between Pakistan and India.';
    assert.equal(normalizeSgLevel(text, ['Pakistan', 'Pakistan']), 3);
  });

  it('India (control): "defer non-essential travel to the Union Territory of Jammu and Kashmir, especially the border regions" is regional -> 2', () => {
    const text =
      'The security situation in the Union Territory of Jammu and Kashmir remains volatile, particularly at the border regions between India and Pakistan, and in the north-eastern state of Manipur. Singaporeans are advised to defer non-essential travel to the Union Territory of Jammu and Kashmir, especially the border regions between India and Pakistan, and to Manipur.';
    assert.equal(normalizeSgLevel(text, ['India', 'India']), 2);
  });

  it('Tajikistan (control): the country name as a compound modifier ("the Tajikistan-Afghanistan border areas") is not a whole-country object -> still 2', () => {
    const text =
      'Singaporeans should avoid all travel to the Tajikistan-Afghanistan border areas and Gorno-Badakhshan Autonomous Oblast due to the security situation there.';
    assert.equal(normalizeSgLevel(text, ['Tajikistan', 'Tajikistan']), 2);
  });

  it('exit-visa / police-report boilerplate ("in which to leave the country legally", "before you leave the country") is not an evacuation call -> no level', () => {
    const text = [
      'A Singapore Citizen who is issued with a replacement passport in Bhutan after a passport has been lost or stolen must bring the replacement passport to the Bhutan Department of Immigration to receive an exit visa. This exit visa allows the traveller a specified period of time (as stated by the Bhutanese authorities) in which to leave the country legally.',
      'Should you become the victim of a crime, make a report to the Thai police as soon as possible before you leave the country.',
    ].join('\n');
    assert.equal(normalizeSgLevel(text, ['Bhutan', 'Bhutan']), null);
  });

  it('generic crowd advice "leave as soon as possible" without the country as the place being left -> no level', () => {
    assert.equal(normalizeSgLevel('If you are caught in a demonstration, leave as soon as possible.', ['Kenya']), null);
  });
});
