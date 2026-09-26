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
