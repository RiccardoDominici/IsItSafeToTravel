import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  communityCopy,
  fillCommunityTemplate,
  formatProseDecimal,
  formatSignedPoints,
  placeFor,
  voteQuestion,
  type CommunityCopy,
} from '../community-copy.js';
import { publishedLanguages, type Lang } from '../ui.js';

const LANGS = publishedLanguages as readonly Lang[];

/** Every value the components substitute, so a filled string must contain no {token}. */
const ALL_TOKENS = { place: 'X', votes: 12, minVotes: 30, origins: 2, minOrigins: 3, cap: '1.0' };

function stringFields(copy: CommunityCopy): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(copy)) {
    if (typeof value === 'string') out.push([key, value]);
    else value.forEach((v: string, i: number) => out.push([`${key}[${i}]`, v]));
  }
  return out;
}

describe('communityCopy: completeness (7 locales)', () => {
  it('covers every published language', () => {
    assert.deepEqual(Object.keys(communityCopy).sort(), [...LANGS].sort());
  });

  for (const lang of LANGS) {
    it(`${lang}: every field is non-empty and both scales have exactly 5 distinct answers`, () => {
      const copy = communityCopy[lang];
      for (const [key, value] of stringFields(copy)) assert.ok(value.trim().length > 0, `${lang}.${key} is empty`);
      for (const levels of [copy.relativeLevels, copy.absoluteLevels]) {
        assert.equal(levels.length, 5);
        assert.equal(new Set(levels).size, 5, `${lang}: duplicate answer`);
      }
    });

    it(`${lang}: templates carry exactly the tokens the components fill`, () => {
      const c = communityCopy[lang];
      const tokens = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      assert.deepEqual(tokens(c.relativeQuestion), ['place']);
      assert.deepEqual(tokens(c.absoluteQuestion), ['place']);
      assert.deepEqual(tokens(c.votesFromOrigins), ['origins', 'votes']);
      assert.deepEqual(tokens(c.insufficient), ['minOrigins', 'minVotes', 'origins', 'votes']);
      assert.deepEqual(tokens(c.rulesScored), ['cap', 'minOrigins', 'minVotes']);
      for (const [key, value] of stringFields(c)) {
        assert.ok(!/\{\w+\}/.test(fillCommunityTemplate(value, ALL_TOKENS)), `${lang}.${key} keeps a token`);
      }
    });
  }
});

describe('communityCopy: the numbers in the rules match the activation constants', () => {
  it('insufficient and rules texts are templated, never hard-coded 30 / 3 / 50', () => {
    for (const lang of LANGS) {
      const c = communityCopy[lang];
      for (const text of [c.insufficient, c.rulesScored]) {
        assert.ok(!/\b30\b|\b50\b/.test(text), `${lang}: hard-coded floor in "${text}"`);
      }
    }
  });
});

describe('vote questions: country grammar through country-grammar.ts', () => {
  const q = (lang: Lang, kind: 'relative' | 'absolute', iso3: string, name: string) => voteQuestion(lang, kind, iso3, name);

  it('en adds "the" where English needs it', () => {
    assert.equal(q('en', 'relative', 'USA', 'United States'), 'Does this safety score feel right for the United States?');
    assert.equal(q('en', 'absolute', 'JPN', 'Japan'), 'Have you been to Japan? How safe did you feel?');
  });

  it('it contracts the article into the locative preposition', () => {
    assert.equal(q('it', 'absolute', 'USA', 'Stati Uniti'), 'Hai viaggiato negli Stati Uniti? Quanto ti sentivi al sicuro?');
    assert.equal(placeFor('it', 'relative', 'MDV', 'Maldive'), 'alle Maldive');
    assert.equal(placeFor('it', 'relative', 'JPN', 'Giappone'), 'in Giappone');
    assert.equal(placeFor('it', 'relative', 'MLT', 'Malta'), 'a Malta');
  });

  it('fr picks au / en / aux / à', () => {
    assert.equal(placeFor('fr', 'absolute', 'JPN', 'Japon'), 'au Japon');
    assert.equal(placeFor('fr', 'absolute', 'FRA', 'France'), 'en France');
    assert.equal(placeFor('fr', 'absolute', 'USA', 'États-Unis'), 'aux États-Unis');
    assert.equal(placeFor('fr', 'absolute', 'CUB', 'Cuba'), 'à Cuba');
    assert.ok(q('fr', 'relative', 'ECU', 'Équateur').includes('pour un voyage en Équateur ?'));
  });

  it('pt keeps the article (para o / ao / aos) wherever the helper knows it', () => {
    assert.equal(q('pt', 'relative', 'JPN', 'Japão'), 'Esta pontuação de segurança parece correta para o Japão?');
    assert.equal(q('pt', 'absolute', 'USA', 'Estados Unidos'), 'Já foi aos Estados Unidos? Até que ponto se sentiu em segurança?');
    assert.equal(placeFor('pt', 'absolute', 'ITA', 'Itália'), 'à Itália');
    assert.equal(placeFor('pt', 'absolute', 'PRT', 'Portugal'), 'a Portugal');
  });

  it(
    'pt: countries the helper table does not list yet (Equador, Brasil) still need their article',
    { todo: 'country-grammar.ts pt table fix lands from the coordinator branch; not changed here by request' },
    () => {
      assert.equal(placeFor('pt', 'absolute', 'ECU', 'Equador'), 'ao Equador');
      assert.equal(placeFor('pt', 'relative', 'BRA', 'Brasil'), 'para o Brasil');
    },
  );

  it('de uses für + accusative and nach / in die for the trip', () => {
    assert.equal(q('de', 'relative', 'TUR', 'Türkei'), 'Ist diese Sicherheitsbewertung für die Türkei aus Ihrer Sicht angemessen?');
    assert.equal(
      q('de', 'absolute', 'ECU', 'Ecuador'),
      'Sind Sie schon einmal nach Ecuador gereist? Wie sicher haben Sie sich dort gefühlt?',
    );
    assert.equal(placeFor('de', 'absolute', 'USA', 'Vereinigte Staaten'), 'in die Vereinigten Staaten');
  });

  it('es and zh take the bare name; zh never puts a space next to it', () => {
    assert.equal(q('es', 'absolute', 'MEX', 'México'), '¿Has estado en México? ¿Hasta qué punto te sentiste seguro allí?');
    const zh = [q('zh', 'relative', 'CHN', '中国'), q('zh', 'absolute', 'ALA', '奥兰群岛')];
    assert.equal(zh[0], '您觉得中国的这个安全评分准确吗？');
    assert.equal(zh[1], '您去过奥兰群岛吗？您在那里感觉有多安全？');
    for (const s of zh) assert.ok(!/\s/.test(s), `whitespace in "${s}"`);
  });
});

describe('typography and case', () => {
  /** Words after the first one of each sentence (any {token} removed), for sentence-case checks. */
  function laterWords(text: string): string[] {
    return text
      .replace(/\{\w+\}/g, '')
      .split(/[.?!:—]\s+|\(|\)/)
      .flatMap((sentence) => sentence.replace(/^[\s¿¡]+/, '').split(/\s+/).slice(1))
      .filter(Boolean);
  }

  for (const lang of ['it', 'es', 'fr', 'pt'] as const) {
    it(`${lang}: sentence case (no Title Case words mid-sentence)`, () => {
      for (const [key, value] of stringFields(communityCopy[lang])) {
        for (const word of laterWords(value)) {
          assert.ok(!/^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]/.test(word), `${lang}.${key}: "${word}" in "${value}"`);
        }
      }
    });
  }

  it('de: sentence case, with nouns capitalised', () => {
    const all = stringFields(communityCopy.de).map(([, v]) => v).join(' ');
    for (const noun of ['Sicherheitsbewertung', 'Stimmen', 'Herkunftsländer', 'Daten', 'Reisenden', 'Community']) {
      assert.ok(all.includes(noun), `expected the noun ${noun}`);
      assert.ok(!new RegExp(`\\b${noun.toLowerCase()}\\b`).test(all), `"${noun}" must be capitalised`);
    }
    // Adjectives and participles stay lowercase inside a sentence (first word excepted).
    const lowercaseOnly = new Set(['sicher', 'unsicher', 'unabhängige', 'offizielle', 'verlässliche', 'angemessen', 'getrennt', 'genügend']);
    for (const [key, value] of stringFields(communityCopy.de)) {
      for (const word of laterWords(value)) {
        const bareWord = word.replace(/[,.;]$/, '');
        if (lowercaseOnly.has(bareWord.toLowerCase())) {
          assert.equal(bareWord, bareWord.toLowerCase(), `de.${key}: "${bareWord}" capitalised mid-sentence`);
        }
      }
    }
  });

  it('fr: a non-breaking space before ? ! : (never a plain space)', () => {
    for (const [key, value] of stringFields(communityCopy.fr)) {
      assert.ok(!/ [?!:]/.test(value), `fr.${key}: plain space before punctuation in "${value}"`);
    }
  });
});

describe('SEO gate compatibility', () => {
  it('zh never puts a number right before 个来源 (validate-seo reads that as a data-source count)', () => {
    for (const [key, value] of stringFields(communityCopy.zh)) {
      const filled = fillCommunityTemplate(value, ALL_TOKENS);
      assert.ok(!/\d\s*个来源/.test(filled), `zh.${key}: "${filled}"`);
    }
  });
});

describe('number formatting', () => {
  it('prose decimals follow the locale separator', () => {
    assert.equal(formatProseDecimal('en', 1), '1.0');
    assert.equal(formatProseDecimal('zh', 1), '1.0');
    for (const lang of ['it', 'es', 'fr', 'pt', 'de'] as const) assert.equal(formatProseDecimal(lang, 1), '1,0');
  });

  it('signed points use U+2212 and never show a signed zero', () => {
    assert.equal(formatSignedPoints(0.34), '+0.3');
    assert.equal(formatSignedPoints(-0.36), '−0.4');
    assert.equal(formatSignedPoints(1), '+1.0');
    assert.equal(formatSignedPoints(0.04), '0.0');
    assert.equal(formatSignedPoints(-0.04), '0.0');
  });
});
