import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { communityVsDataCopy } from '../community-vs-data-copy.js';
import { publishedLanguages, type Lang } from '../ui.js';

// Formula v10 (SPEC §5): a country is ranked only once its community reading is active, i.e. it
// has MIN_VOTE_FLOOR votes from MIN_ORIGIN_FLOOR countries of origin. Both floors are templated
// so the copy can never drift from src/pipeline/sentiment/constants.ts.
describe('communityVsDataCopy: v10 activation rule in every locale', () => {
  for (const lang of publishedLanguages as readonly Lang[]) {
    it(`${lang}: empty/growing texts carry both {floor} and {origins}`, () => {
      const c = communityVsDataCopy[lang];
      for (const text of [c.emptyStateBody, c.growingBody]) {
        assert.ok(text.includes('{floor}'), `${lang}: missing {floor} in "${text}"`);
        assert.ok(text.includes('{origins}'), `${lang}: missing {origins} in "${text}"`);
      }
      assert.ok(c.growingBody.includes('{count}') && c.growingBody.includes('{countryNoun}'));
    });

    it(`${lang}: how-to-read describes the origin cap and the 30-day half-life`, () => {
      const c = communityVsDataCopy[lang];
      assert.ok(/30/.test(c.howToReadP2), `${lang}: half-life missing`);
      assert.ok(/1/.test(c.howToReadP2), `${lang}: ±1 cap missing`);
    });
  }
});
