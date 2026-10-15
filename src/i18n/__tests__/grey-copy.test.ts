import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  greyCopy,
  greyHasNoData,
  greySourceItems,
  greySourceItemsFor,
  greyTitleSuffix,
  type GreyCopy,
} from '../grey-copy.js';
import { publishedLanguages, type Lang } from '../ui.js';

const LANGS = publishedLanguages as readonly Lang[];

function stringFields(copy: GreyCopy): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(copy)) {
    if (typeof value === 'string') out.push([key, value]);
    else if (Array.isArray(value)) value.forEach((v: string, i: number) => out.push([`${key}[${i}]`, v]));
    else for (const [k, v] of Object.entries(value as Record<string, string>)) out.push([`${key}.${k}`, v]);
  }
  return out;
}

describe('greyCopy: completeness (7 locales)', () => {
  it('covers every published language with the same fields', () => {
    assert.deepEqual(Object.keys(greyCopy).sort(), [...LANGS].sort());
    const fields = Object.keys(greyCopy.en).sort();
    for (const lang of LANGS) assert.deepEqual(Object.keys(greyCopy[lang]).sort(), fields, lang);
  });

  for (const lang of LANGS) {
    it(`${lang}: no empty field; whyNone takes {name} exactly when why does`, () => {
      const c = greyCopy[lang];
      for (const [key, value] of stringFields(c)) assert.ok(value.trim().length > 0, `${lang}.${key} is empty`);
      assert.equal(c.whyNone.includes('{name}'), c.why.includes('{name}'), lang);
      assert.ok(c.advisories.every((a) => a.includes('{n}')), `${lang}: advisory item without {n}`);
    });
  }
});

describe('grey hero list: what counts toward the four sources (audit I21)', () => {
  it('the advisory item says all advisories count as one source, in every language', () => {
    const marker: Record<Lang, RegExp> = {
      en: /one source/,
      it: /una (sola )?fonte/,
      es: /una (sola )?fuente/,
      fr: /une (seule )?source/,
      pt: /uma (única )?fonte/,
      zh: /一个来源/,
      de: /eine Quelle/,
    };
    for (const lang of LANGS) {
      for (const count of [1, 17]) {
        const [item] = greySourceItems(lang, count, ['advisories']);
        assert.match(item, marker[lang], `${lang} (${count}): ${item}`);
        assert.ok(item.includes(String(count)), `${lang}: count missing in ${item}`);
      }
    }
    assert.equal(greySourceItems('en', 17, ['advisories'])[0], 'Travel advisories from 17 governments (counted together as one source)');
  });

  it('an alert feed is marked as not counting toward the four-source minimum', () => {
    assert.equal(
      greySourceItems('en', 0, ['gdacs'])[0],
      'GDACS disaster alerts (only while a disaster is under way, so not counted toward the four-source minimum)',
    );
  });

  it('never writes "<digit> sources" (validate-seo reads it as a site-wide source-count claim)', () => {
    for (const lang of LANGS) {
      for (const [key, value] of stringFields(greyCopy[lang])) {
        const filled = value.replace('{n}', '17').replace('{source}', 'X').replace('{name}', 'Y');
        assert.ok(!/\d\s*(sources|fonti|fuentes|fontes|Quellen|个来源)/.test(filled), `${lang}.${key}: ${filled}`);
      }
    }
  });
});

describe('grey place with nothing to list (audit I27)', () => {
  const none = { advisories: {}, sources: [] };
  const advisoryOnly = { advisories: { us: {} }, sources: [{ name: 'advisories' }] };
  const alertOnly = { advisories: {}, sources: [{ name: 'gdacs' }] };

  it('greyHasNoData: true only without any advisory or source', () => {
    assert.equal(greyHasNoData(none), true);
    assert.equal(greyHasNoData({}), true);
    assert.equal(greyHasNoData(advisoryOnly), false);
    assert.equal(greyHasNoData(alertOnly), false, 'an alert feed is still something to list');
  });

  it('greySourceItemsFor reads the snapshot entry the way the hero does', () => {
    assert.deepEqual(greySourceItemsFor('en', none), []);
    assert.deepEqual(greySourceItemsFor('en', advisoryOnly), ['A travel advisory from 1 government (counted as one source)']);
  });

  it('title suffix: "No data yet" with nothing to list, "Partial data" otherwise', () => {
    for (const lang of LANGS) {
      assert.equal(greyTitleSuffix(lang, none), greyCopy[lang].noDataTitleSuffix, lang);
      assert.equal(greyTitleSuffix(lang, advisoryOnly), greyCopy[lang].titleSuffix, lang);
      assert.notEqual(greyCopy[lang].noDataTitleSuffix, greyCopy[lang].titleSuffix, lang);
    }
    assert.equal(greyTitleSuffix('en', none), 'No Data Yet');
  });
});
