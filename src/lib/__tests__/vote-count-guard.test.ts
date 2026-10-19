/**
 * Unit tests for the vote-count detector (owner's rule, 2026-10-19: the site never says how many
 * community votes a country has). Two halves:
 *  - the detector catches every count-bearing phrase the site used to print, in all 7 languages
 *    (the "before" strings below are the exact pre-2026-10-19 copy, filled with real numbers);
 *  - none of today's community copy, filled the way the pages fill it, contains one.
 * The built-page counterpart is in src/__tests__/page-ui-build.test.ts.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { findVoteCountPhrases } from '../vote-count-guard.js';
import { communityCopy, fillCommunityTemplate } from '../../i18n/community-copy.js';
import { communityVsDataCopy } from '../../i18n/community-vs-data-copy.js';
import { publishedLanguages, type Lang } from '../../i18n/ui.js';
import { MIN_ORIGIN_FLOOR, MIN_VOTE_FLOOR } from '../sentiment.js';

const LANGS = publishedLanguages as readonly Lang[];

describe('findVoteCountPhrases: catches the phrases the site used to print', () => {
  const BEFORE: Array<[string, string]> = [
    ['en', 'Based on 74 votes from 14 countries of origin'],
    ['en', 'Not enough votes yet (4/30 votes, 2/3 countries of origin) — vote to make the community count.'],
    ['en', '55 votes'],
    ['en', 'Total votes'],
    ['en', '1,234 votes'],
    ['en', '1 vote'],
    ['en', '12 travelers voted on this score'],
    ['it', 'Basata su 74 voti da 14 paesi di provenienza'],
    ['it', 'Non ci sono ancora abbastanza voti (4/30 voti, 2/3 paesi di provenienza)'],
    ['it', 'Voti totali'],
    ['it', '1 voto'],
    ['es', 'Basada en 74 votos de 14 países de origen'],
    ['es', 'Aún no hay suficientes votos (12/30 votos, 2/3 países de origen)'],
    ['fr', 'Sur la base de 74 votes issus de 14 pays'],
    ['fr', 'Votes au total'],
    ['fr', '1 234 votes'],
    ['pt', 'Com base em 74 votos de 14 países de origem'],
    ['pt', 'Votos totais'],
    ['zh', '基于来自 14 个国家或地区的 74 票'],
    ['zh', '投票还不够（4/30 票，来自 2/3 个国家或地区）'],
    ['zh', '总票数'],
    ['zh', '票数：77'],
    ['de', 'Basierend auf 74 Stimmen aus 14 Herkunftsländern'],
    ['de', 'Noch nicht genügend Stimmen (4/30 Stimmen, 2/3 Herkunftsländer)'],
    ['de', 'Stimmen insgesamt'],
    ['de', '1 Stimme'],
  ];
  for (const [lang, text] of BEFORE) {
    it(`${lang}: "${text}"`, () => {
      assert.ok(findVoteCountPhrases(text, [MIN_VOTE_FLOOR]).length > 0, `missed: ${text}`);
    });
  }

  it('a progress fraction is flagged even when its denominator is the allowed threshold', () => {
    assert.deepEqual(
      findVoteCountPhrases('(4/30 votes)', [MIN_VOTE_FLOOR]).map((m) => m.pattern),
      ['progress'],
    );
  });
});

describe('findVoteCountPhrases: lets the threshold rule and unrelated text through', () => {
  const CLEAN = [
    'Once a country has 30 votes from at least 3 countries of origin, travelers can move its score.',
    'Sobald für ein Land 30 Stimmen aus mindestens 3 Herkunftsländern vorliegen',
    '当一个国家获得来自至少 3 个国家或地区的 30 票后',
    'Community rating 7.4/10',
    'Submit vote',
    'Stimme abgeben',
    'Votez pour Japon →',
    '3 voters', // another word, not "votes"
    'Ratings from 12 governments',
  ];
  for (const text of CLEAN) {
    it(`"${text}"`, () => {
      assert.deepEqual(findVoteCountPhrases(text, [MIN_VOTE_FLOOR]), []);
    });
  }

  it('without the allow-list, the threshold itself reads as a count (callers opt in)', () => {
    assert.equal(findVoteCountPhrases('at least 30 votes').length, 1);
  });
});

describe("today's community copy carries no vote count (7 locales)", () => {
  for (const lang of LANGS) {
    it(`${lang}: community block and vote widget`, () => {
      const c = communityCopy[lang];
      for (const [key, value] of Object.entries(c)) {
        const texts = typeof value === 'string' ? [value] : [...value];
        for (const text of texts) {
          // Fill the tokens the way SentimentPillar does; the floors are the threshold, allowed.
          const filled = fillCommunityTemplate(text, {
            place: 'X',
            minVotes: MIN_VOTE_FLOOR,
            minOrigins: MIN_ORIGIN_FLOOR,
            cap: '1.0',
          });
          assert.deepEqual(findVoteCountPhrases(filled, [MIN_VOTE_FLOOR]), [], `${lang}.${key}: "${filled}"`);
        }
      }
    });

    it(`${lang}: community-vs-data page`, () => {
      const c = communityVsDataCopy[lang];
      const strings: string[] = [];
      const collect = (v: unknown): void => {
        if (typeof v === 'string') strings.push(v);
        else if (v && typeof v === 'object') Object.values(v).forEach(collect);
      };
      collect(c);
      for (const text of strings) {
        const filled = text
          .replace('{floor}', String(MIN_VOTE_FLOOR))
          .replace('{origins}', String(MIN_ORIGIN_FLOOR))
          .replace('{count}', '4'); // {count} is a number of countries here, never of votes
        assert.deepEqual(findVoteCountPhrases(filled, [MIN_VOTE_FLOOR]), [], `${lang}: "${filled}"`);
      }
    });
  }
});
