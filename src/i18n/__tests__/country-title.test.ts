/**
 * Country page <title> and H1 for all 248 places x 7 languages, rendered the way the pages render
 * them (getLocalizedCountryName -> getCountryPageTitle / country.h1_question + getH1CountryPhrase).
 *
 * Two layers, like country-grammar.test.ts:
 *  1. Golden titles for the places the 2026-10-15 consistency audit quoted (issues I11, I12, I24,
 *     I28, I52, I62, I65 in scripts/calibration/consistency/issues.json).
 *  2. Guards over every place: patterns a native editor rejects on sight ("Ist Salomonen", "au
 *     Guinée-Bissau", "in Isola", "a Reino Unido", "Is the Cayman Islands"), so a new place or a
 *     renamed one cannot bring the error back unnoticed.
 *
 * Run with: npx tsx --test src/i18n/__tests__/country-title.test.ts
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { COUNTRIES, getCountryByName } from '../../pipeline/config/countries.js';
import { getLocalizedCountryName } from '../../lib/scores.js';
import { getCountryPageTitle } from '../country-title.js';
import { getH1CountryPhrase, getEnglishPossessive, isEnglishPlural, isGermanPlural } from '../country-grammar.js';
import { ui, type Lang } from '../ui.js';

const LANGS: Lang[] = ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de'];

function bare(iso3: string, lang: Lang): string {
  const c = COUNTRIES.find((x) => x.iso3 === iso3);
  assert.ok(c, `${iso3} must exist in COUNTRIES`);
  return getLocalizedCountryName({ iso3, name: c!.name as unknown as Record<string, string> }, lang);
}
const title = (lang: Lang, iso3: string, score: number | null = 6) => getCountryPageTitle(lang, iso3, bare(iso3, lang), score);
const h1 = (lang: Lang, iso3: string) => ui[lang]['country.h1_question'].replace('{name}', getH1CountryPhrase(lang, iso3, bare(iso3, lang)));

// --- 1. Golden titles ---

describe('de titles: article, verb number and weak adjective endings (I11, I62)', () => {
  const golden: [string, string, string][] = [
    ['ATA', 'Ist die Antarktis sicher?', 'in die Antarktis'],
    ['SLB', 'Sind die Salomonen sicher?', 'auf die Salomonen'],
    ['FRO', 'Sind die Färöer sicher?', 'auf die Färöer'],
    ['MNP', 'Sind die Nördlichen Marianen sicher?', 'auf die Nördlichen Marianen'],
    ['PSE', 'Sind die Palästinensischen Autonomiegebiete sicher?', 'in die Palästinensischen Autonomiegebiete'],
    ['UMI', 'Sind die Amerikanischen Überseeinseln sicher?', 'auf die Amerikanischen Überseeinseln'],
    ['VIR', 'Sind die Amerikanischen Jungferninseln sicher?', 'auf die Amerikanischen Jungferninseln'],
    ['VGB', 'Sind die Britischen Jungferninseln sicher?', 'auf die Britischen Jungferninseln'],
    ['ATF', 'Sind die Französischen Süd- und Antarktisgebiete sicher?', 'in die Französischen Süd- und Antarktisgebiete'],
    ['BES', 'Sind die Karibischen Niederlande sicher?', 'in die Karibischen Niederlande'],
    ['IOT', 'Ist das Britische Territorium im Indischen Ozean sicher?', 'ins Britische Territorium im Indischen Ozean'],
    ['BVT', 'Ist die Bouvetinsel sicher?', 'auf die Bouvetinsel'],
    ['CXR', 'Ist die Weihnachtsinsel sicher?', 'auf die Weihnachtsinsel'],
    ['NFK', 'Ist die Norfolkinsel sicher?', 'auf die Norfolkinsel'],
    ['IMN', 'Ist die Isle of Man sicher?', 'auf die Isle of Man'],
    ['VAT', 'Ist die Vatikanstadt sicher?', 'in die Vatikanstadt'],
    ['ESH', 'Ist die Westsahara sicher?', 'in die Westsahara'],
    ['HKG', 'Ist Hongkong sicher?', 'nach Hongkong'],
    ['MAC', 'Ist Macau sicher?', 'nach Macau'],
    ['BRN', 'Ist Brunei sicher?', 'nach Brunei'],
    ['SGS', 'Ist Südgeorgien und die Südlichen Sandwichinseln sicher?', 'nach Südgeorgien und auf die Südlichen Sandwichinseln'],
    ['MDV', 'Sind die Malediven sicher?', 'auf die Malediven'],
    ['TUR', 'Ist die Türkei sicher?', 'in die Türkei'],
    ['IRN', 'Ist der Iran sicher?', 'in den Iran'],
    ['JPN', 'Ist Japan sicher?', 'nach Japan'],
  ];
  for (const [iso3, question, dir] of golden) {
    it(`${iso3}: "${question}" / "${dir} zu reisen"`, () => {
      assert.equal(title('de', iso3), `${question} Sicherheitswert 6.0/10 (2026)`);
      assert.equal(h1('de', iso3), `Ist es aktuell sicher, ${dir} zu reisen?`);
    });
  }
  it('grey places get the partial-data suffix and no number', () => {
    assert.equal(title('de', 'SLB', null), 'Sind die Salomonen sicher? Unvollständige Datenlage (2026)');
  });
});

describe('fr titles: au / en / aux / à (I12, I24, I28)', () => {
  const golden: [string, string][] = [
    ['GNB', 'Voyager en Guinée-Bissau'],
    ['PRK', 'Voyager en Corée du Nord'],
    ['KOR', 'Voyager en Corée du Sud'],
    ['MKD', 'Voyager en Macédoine du Nord'],
    ['SGS', 'Voyager en Géorgie du Sud'],
    ['FJI', 'Voyager aux Fidji'],
    ['ASM', 'Voyager aux Samoa américaines'],
    ['ATF', 'Voyager aux Terres australes françaises'],
    ['VAT', 'Voyager à la Cité du Vatican'],
    ['BRB', 'Voyager à la Barbade'],
    ['GRD', 'Voyager à la Grenade'],
    ['TTO', 'Voyager à Trinité-et-Tobago'],
    ['WLF', 'Voyager à Wallis-et-Futuna'],
    ['SMR', 'Voyager à Saint-Marin'],
    ['LCA', 'Voyager à Sainte-Lucie'],
    ['CUW', 'Voyager à Curaçao'],
    ['GIB', 'Voyager à Gibraltar'],
    ['TWN', 'Voyager à Taïwan'],
    ['REU', 'Voyager à La Réunion'],
    ['MUS', 'Voyager à Maurice'],
    ['BVT', "Voyager sur l'île Bouvet"],
    ['IMN', "Voyager sur l'île de Man"],
    ['SJM', 'Voyager au Svalbard et à Jan Mayen'],
    ['SLV', 'Voyager au Salvador'],
    ['NPL', 'Voyager au Népal'],
    ['CIV', "Voyager en Côte d'Ivoire"],
    ['COG', 'Voyager en République du Congo'],
    ['JPN', 'Voyager au Japon'],
    ['FRA', 'Voyager en France'],
    ['USA', 'Voyager aux États-Unis'],
  ];
  for (const [iso3, phrase] of golden) {
    it(`${iso3}: "${phrase}"`, () => {
      assert.equal(title('fr', iso3), `${phrase} : est-ce sûr ? 6.0/10 (2026)`);
    });
  }
});

describe('it titles: in / a / su with the article (I52)', () => {
  const golden: [string, string][] = [
    ['BVT', "sull'Isola Bouvet"],
    ['CXR', "sull'Isola di Natale"],
    ['NFK', "sull'Isola Norfolk"],
    ['IMN', "sull'Isola di Man"],
    ['CPV', 'a Capo Verde'],
    ['MUS', 'a Mauritius'],
    ['HKG', 'a Hong Kong'],
    ['ABW', 'ad Aruba'],
    ['ATG', 'ad Antigua e Barbuda'],
    ['FJI', 'alle Figi'],
    ['REU', 'alla Riunione'],
    ['ESH', 'nel Sahara Occidentale'],
    ['ASM', 'nelle Samoa Americane'],
    ['COG', 'nella Repubblica del Congo'],
    ['CYM', 'nelle Isole Cayman'],
    ['JPN', 'in Giappone'],
    ['USA', 'negli Stati Uniti'],
  ];
  for (const [iso3, phrase] of golden) {
    it(`${iso3}: "viaggiare ${phrase}"`, () => {
      assert.equal(title('it', iso3), `È sicuro viaggiare ${phrase}? 6.0/10 (2026)`);
      assert.equal(h1('it', iso3), `È sicuro viaggiare ${phrase} adesso?`);
    });
  }
});

describe('en titles: plural island groups take "Are" (I65, I24, I28)', () => {
  const golden: [string, string][] = [
    ['CYM', 'Are the Cayman Islands Safe?'],
    ['SLB', 'Are the Solomon Islands Safe?'],
    ['ALA', 'Are the Åland Islands Safe?'],
    ['ATF', 'Are the French Southern Territories Safe?'],
    ['USA', 'Is the United States Safe?'],
    ['PHL', 'Is the Philippines Safe?'],
    ['COG', 'Is the Republic of the Congo Safe?'],
    ['COD', 'Is the Democratic Republic of the Congo Safe?'],
    ['REU', 'Is Réunion Safe?'],
    ['BLM', 'Is Saint Barthélemy Safe?'],
    ['CIV', "Is Côte d'Ivoire Safe?"],
    ['JPN', 'Is Japan Safe?'],
  ];
  for (const [iso3, question] of golden) {
    it(`${iso3}: "${question}"`, () => {
      assert.equal(title('en', iso3), `${question} 6.0/10 Safety Score (2026)`);
    });
  }
  it('possessive: bare apostrophe after a final "s"', () => {
    assert.equal(getEnglishPossessive('PHL', 'Philippines'), "the Philippines'");
    assert.equal(getEnglishPossessive('CYM', 'Cayman Islands'), "the Cayman Islands'");
    assert.equal(getEnglishPossessive('JPN', 'Japan'), "Japan's");
    assert.equal(getEnglishPossessive('GBR', 'United Kingdom'), "the United Kingdom's");
  });
});

describe('es titles and H1: the article where Spanish always writes one', () => {
  const golden: [string, string][] = [
    ['GBR', 'al Reino Unido'],
    ['NLD', 'a los Países Bajos'],
    ['ARE', 'a los Emiratos Árabes Unidos'],
    ['DOM', 'a la República Dominicana'],
    ['COG', 'a la República del Congo'],
    ['CYM', 'a las Islas Caimán'],
    ['IMN', 'a la Isla de Man'],
    ['ATA', 'a la Antártida'],
    ['ESH', 'al Sahara Occidental'],
    ['VAT', 'a la Ciudad del Vaticano'],
    ['BEN', 'a Benín'],
    ['PNG', 'a Papúa Nueva Guinea'],
    ['JPN', 'a Japón'],
    ['USA', 'a Estados Unidos'],
    ['SLV', 'a El Salvador'],
  ];
  for (const [iso3, phrase] of golden) {
    it(`${iso3}: "viajar ${phrase}"`, () => {
      assert.equal(title('es', iso3), `¿Es seguro viajar ${phrase}? 6.0/10 (2026)`);
      assert.equal(h1('es', iso3), `¿Es seguro viajar ${phrase} ahora mismo?`);
    });
  }
});

describe('pt and zh titles', () => {
  it('pt: Republic of the Congo, Faroe, Åland and Bahamas', () => {
    assert.equal(title('pt', 'COG'), 'É seguro viajar para a República do Congo? 6.0/10 (2026)');
    assert.equal(title('pt', 'FRO'), 'É seguro viajar para as Ilhas Feroé? 6.0/10 (2026)');
    assert.equal(title('pt', 'ALA'), 'É seguro viajar para as Ilhas Åland? 6.0/10 (2026)');
    assert.equal(title('pt', 'BHS'), 'É seguro viajar para as Bahamas? 6.0/10 (2026)');
  });
  it('zh: no space around the name, short names for Hong Kong and Macao', () => {
    assert.equal(title('zh', 'DEU'), '德国安全吗？安全评分6.0/10（2026）');
    assert.equal(title('zh', 'HKG'), '中国香港安全吗？安全评分6.0/10（2026）');
    assert.equal(title('zh', 'MAC', null), '中国澳门安全吗？数据不完整（2026）');
  });
});

describe('names (I24, I28) and the matcher aliases that keep fetchers resolving them', () => {
  const name = (iso3: string) => COUNTRIES.find((c) => c.iso3 === iso3)!.name;
  it('diacritics and local spellings', () => {
    assert.equal(name('ALA').en, 'Åland Islands');
    assert.equal(name('REU').en, 'Réunion');
    assert.equal(name('BLM').en, 'Saint Barthélemy');
    assert.equal(name('CIV').en, "Côte d'Ivoire");
    assert.equal(name('CIV').fr, "Côte d'Ivoire");
    assert.equal(name('NPL').fr, 'Népal');
    assert.equal(name('BEN').es, 'Benín');
    assert.equal(name('BRN').es, 'Brunéi');
    assert.equal(name('PNG').es, 'Papúa Nueva Guinea');
    assert.equal(name('FRO').pt, 'Ilhas Feroé');
  });
  it('the Republic of the Congo is never a bare "Congo"', () => {
    for (const lang of ['en', 'it', 'es', 'fr', 'pt'] as const) {
      assert.notEqual(name('COG')[lang], 'Congo', `COG/${lang}`);
      assert.notEqual(name('COG')[lang], name('COD')[lang], `COG/${lang} must differ from COD`);
    }
  });
  it('old spellings still resolve to the same place by name', () => {
    for (const [old, iso3] of [
      ['Aland Islands', 'ALA'], ['Åland Islands', 'ALA'], ['Reunion', 'REU'], ['Saint Barthelemy', 'BLM'],
      ["Cote d'Ivoire", 'CIV'], ["Côte d’Ivoire", 'CIV'], ['Sao Tome and Principe', 'STP'], ['Curacao', 'CUW'],
      ['Congo', 'COG'], ['Republic of the Congo', 'COG'], ['Democratic Republic of the Congo', 'COD'],
    ] as [string, string][]) {
      assert.equal(getCountryByName(old)?.iso3, iso3, `"${old}" -> ${iso3}`);
    }
  });
});

// --- 2. Guards over every place and language ---

describe('every title and H1 (248 places x 7 languages)', () => {
  const rows = COUNTRIES.flatMap((c) => LANGS.map((lang) => ({ iso3: c.iso3, lang, name: bare(c.iso3, lang), title: title(lang, c.iso3), h1: h1(lang, c.iso3) })));

  it('no empty slot, doubled space, or stray placeholder', () => {
    for (const r of rows) {
      for (const text of [r.title, r.h1]) {
        assert.ok(!/\s{2}|undefined|\{|\}/.test(text), `${r.iso3}/${r.lang}: "${text}"`);
        assert.ok(text.includes(r.name) || r.lang === 'de' || r.lang === 'fr', `${r.iso3}/${r.lang}: name missing in "${text}"`);
      }
    }
  });

  it('en: "…Islands" and "…Territories" take "Are"; everything else "Is"', () => {
    for (const r of rows.filter((x) => x.lang === 'en')) {
      const plural = /(Islands|Territories)$/.test(r.name);
      assert.equal(isEnglishPlural(r.iso3), plural, `${r.iso3}: "${r.name}"`);
      assert.ok(r.title.startsWith(plural ? 'Are ' : 'Is '), `${r.iso3}: "${r.title}"`);
    }
  });

  it('de: plural names take "Sind die", plural adjectives the weak "-en", islands "auf", and no English "Score"', () => {
    const pluralEnding = /(inseln|gebiete|Niederlande|Marianen|Salomonen|Färöer|Malediven|Seychellen|Komoren|Philippinen|Emirate|Staaten|Bahamas)$/;
    for (const r of rows.filter((x) => x.lang === 'de')) {
      assert.ok(!r.title.includes('Score'), `${r.iso3}: "${r.title}"`);
      if (pluralEnding.test(r.name) && r.iso3 !== 'SGS') {
        assert.ok(isGermanPlural(r.iso3, r.name), `${r.iso3}: "${r.name}" is plural`);
        assert.ok(r.title.startsWith('Sind die '), `${r.iso3}: "${r.title}"`);
      }
      assert.ok(!/^Sind die [A-ZÄÖÜ][a-zäöüß]+(isch|lich)e\b/.test(r.title), `${r.iso3}: strong adjective after "die": "${r.title}"`);
      assert.ok(!/nach \S*insel/.test(r.h1), `${r.iso3}: "nach" with an island: "${r.h1}"`);
      assert.ok(!/(^Ist|, nach) (Antarktis|Westsahara|Vatikanstadt|Isle of Man)\b/.test(`${r.title}, ${r.h1}`), `${r.iso3}: article missing: "${r.title}"`);
    }
  });

  it('fr: no "au" before a feminine head noun, no au/en before a city-like island', () => {
    const MASC_E = /^(Mexique|Cambodge|Mozambique|Zimbabwe|Belize|Suriname|Royaume|Territoire)$/;
    for (const r of rows.filter((x) => x.lang === 'fr')) {
      const m = /^Voyager au (\S+?)(?=[\s-]|\s:)/.exec(r.title);
      if (m) assert.ok(!/(e|ée)$/.test(m[1]) || MASC_E.test(m[1]), `${r.iso3}: "${r.title}"`);
      assert.ok(!/^Voyager (au|en) (Île|Saint|Sainte|Sao|Sint|La)\b/.test(r.title), `${r.iso3}: "${r.title}"`);
      assert.ok(!/^Voyager au [AEIOUÉÈÊÎÔ]/.test(r.title), `${r.iso3}: "au" before a vowel: "${r.title}"`);
    }
  });

  it('it: no bare "in" before Isola/Isole/Saint/Sant\'/Repubblica', () => {
    for (const r of rows.filter((x) => x.lang === 'it')) {
      assert.ok(!/viaggiare in (Isola|Isole|Saint|Sant'|San |Repubblica|Città)/.test(r.title), `${r.iso3}: "${r.title}"`);
      assert.ok(!/viaggiare a [AEIOU]/.test(r.title), `${r.iso3}: "a" before a vowel needs "ad": "${r.title}"`);
    }
  });

  it('es: names that always carry an article get it ("al Reino Unido", "a las Islas…")', () => {
    for (const r of rows.filter((x) => x.lang === 'es')) {
      assert.ok(!/viajar a (Islas?|República|Reino Unido|Países Bajos|Emiratos|Ciudad del Vaticano|Antártida) /.test(r.title), `${r.iso3}: "${r.title}"`);
      assert.ok(!/ a el /.test(r.title), `${r.iso3}: "a el" must contract: "${r.title}"`);
    }
  });

  it('zh: no ASCII space next to Chinese text in the title or H1', () => {
    for (const r of rows.filter((x) => x.lang === 'zh')) {
      for (const text of [r.title, r.h1]) {
        assert.ok(!/[一-鿿（）？] | [一-鿿（）？]/.test(text), `${r.iso3}: "${text}"`);
      }
    }
  });
});
