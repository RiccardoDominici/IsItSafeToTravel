/**
 * Tests for src/i18n/country-grammar.ts. Two layers:
 *  1. Coverage — every iso3 in COUNTRIES produces a non-empty string from
 *     every exported wrapper, for every locale, without throwing. This is
 *     the "every iso3 has forms for every locale that needs them" guarantee
 *     from the implementation brief: it doesn't assert each of the 248
 *     countries is grammatically perfect (many rely on the documented
 *     default rules), but it does guarantee the module never crashes or
 *     silently drops a country on the real dataset.
 *  2. Golden checks — exact expected output for a curated set of countries
 *     that exercise every irregular category the module handles: state-like
 *     plurals (USA, NLD, ARE), a generic/descriptive compound name (GBR,
 *     COD), small vacation archipelagos (MDV), a larger archipelago nation
 *     (PHL), lexicalized German genders (TUR, CHE, IRN), regular singular
 *     names (JPN, FRA, ITA), and small single-place states used like a city
 *     name (SGP, CUB).
 *
 * Run with: npx tsx --test src/i18n/__tests__/country-grammar.test.ts
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { COUNTRIES } from '../../pipeline/config/countries.js';
import {
  getEnglishCountryPhrase,
  getItalianLocative,
  getItalianGeneric,
  getPortuguesePhrase,
  getPortugueseWithArticle,
  getPortugueseDe,
  getComparisonSubject,
  getGermanNominative,
  getGermanDirectional,
  getGermanFuerPhrase,
  getGermanCopula,
  getFrenchPreposition,
  getH1CountryPhrase,
  getSpanishA,
  getSpanishWithArticle,
  getItalianWithArticle,
  getItalianArticulated,
  getItalianAgreement,
  getFrenchWithArticle,
  getFrenchDe,
  getFrenchAgreement,
  getGermanDative,
  getGermanVon,
  getGermanLocative,
  getPortugueseEm,
  getPortugueseAgreement,
  isEnglishPlural,
} from '../country-grammar.js';

// The bare German name getLocalizedCountryName resolves at runtime: the pinned
// name.de from COUNTRIES where there is one (die Nördlichen Marianen, Hongkong…),
// else the real Intl.DisplayNames('de-DE') output.
const deDisplayNames = new Intl.DisplayNames(['de-DE'], { type: 'region' });
function bareDeName(iso2: string, iso3: string): string {
  const pinned = COUNTRIES.find((c) => c.iso3 === iso3)?.name.de;
  return pinned ?? deDisplayNames.of(iso2) ?? iso3;
}

// Places whose German phrase replaces the bare strong-declension name with its
// weak form after the article ("die Nördlichen Marianen"), or with a full
// directional phrase (SGS) — see the DeForm docstring in country-grammar.ts.
const DE_REWRITTEN = new Set(['USA', 'GBR', 'ARE', 'MNP', 'VIR', 'VGB', 'UMI', 'ATF', 'BES', 'PSE', 'IOT', 'SGS']);

// --- 1. Coverage: every iso3, every locale, no crash, non-empty output ---

describe('country-grammar coverage (all 248 countries)', () => {
  for (const country of COUNTRIES) {
    const { iso3, iso2, name } = country;
    const deName = bareDeName(iso2, iso3);

    it(`${iso3}: en/it/pt/de/fr all return a non-empty string`, () => {
      const outputs = [
        getEnglishCountryPhrase(iso3, name.en),
        getItalianLocative(iso3, name.it),
        getItalianGeneric(iso3, name.it),
        getPortuguesePhrase(iso3, name.pt, 'para'),
        getPortuguesePhrase(iso3, name.pt, 'a'),
        getPortugueseWithArticle(iso3, name.pt),
        getGermanNominative(iso3, deName),
        getGermanDirectional(iso3, deName),
        getGermanFuerPhrase(iso3, deName),
        getFrenchPreposition(iso3, name.fr),
      ];
      for (const out of outputs) {
        assert.equal(typeof out, 'string');
        assert.ok(out.length > 0, `${iso3} produced an empty string`);
      }
    });

    it(`${iso3}: every locative/directional form still contains the bare name`, () => {
      // Whatever article/preposition gets glued on, the underlying place
      // name itself must never be dropped or mangled — EXCEPT the German
      // "weakForm" entries, which by design replace the bare
      // strong-declension adjective ("Vereinigte Staaten") with the correct
      // weak-declension one once an article precedes it ("Vereinigten
      // Staaten") — see the DeForm docstring in country-grammar.ts, and the
      // dedicated weak-declension assertions further down this file — and
      // the French "sur l'île X" form, which lowercases the generic "île".
      assert.ok(getItalianLocative(iso3, name.it).includes(name.it));
      assert.ok(getPortuguesePhrase(iso3, name.pt, 'para').includes(name.pt));
      assert.ok(getSpanishA(iso3, name.es).includes(name.es));
      if (!DE_REWRITTEN.has(iso3)) {
        assert.ok(getGermanDirectional(iso3, deName).includes(deName));
      }
      if (iso3 !== 'SJM') {
        assert.ok(getFrenchPreposition(iso3, name.fr).includes(name.fr.replace(/^Île /, 'île ')));
      }
    });
  }
});

// --- 2. Golden checks for the countries covering every irregular category ---

interface Golden {
  iso3: string;
  deName: string; // real Intl.DisplayNames('de-DE') output, verified separately
  en: string;
  itLocative: string;
  ptPara: string;
  deDirectional: string;
  deNominative: string;
  fr: string;
}

const GOLDEN: Golden[] = [
  { iso3: 'USA', deName: 'Vereinigte Staaten', en: 'the United States', itLocative: 'negli Stati Uniti', ptPara: 'para os Estados Unidos', deDirectional: 'in die Vereinigten Staaten', deNominative: 'die Vereinigten Staaten', fr: 'aux États-Unis' },
  { iso3: 'GBR', deName: 'Vereinigtes Königreich', en: 'the United Kingdom', itLocative: 'nel Regno Unito', ptPara: 'para o Reino Unido', deDirectional: 'ins Vereinigte Königreich', deNominative: 'das Vereinigte Königreich', fr: 'au Royaume-Uni' },
  { iso3: 'NLD', deName: 'Niederlande', en: 'the Netherlands', itLocative: 'nei Paesi Bassi', ptPara: 'para os Países Baixos', deDirectional: 'in die Niederlande', deNominative: 'die Niederlande', fr: 'aux Pays-Bas' },
  { iso3: 'PHL', deName: 'Philippinen', en: 'the Philippines', itLocative: 'nelle Filippine', ptPara: 'para as Filipinas', deDirectional: 'auf die Philippinen', deNominative: 'die Philippinen', fr: 'aux Philippines' },
  { iso3: 'MDV', deName: 'Malediven', en: 'the Maldives', itLocative: 'alle Maldive', ptPara: 'para as Maldivas', deDirectional: 'auf die Malediven', deNominative: 'die Malediven', fr: 'aux Maldives' },
  { iso3: 'TUR', deName: 'Türkei', en: 'Turkey', itLocative: 'in Turchia', ptPara: 'para a Turquia', deDirectional: 'in die Türkei', deNominative: 'die Türkei', fr: 'en Turquie' },
  { iso3: 'CHE', deName: 'Schweiz', en: 'Switzerland', itLocative: 'in Svizzera', ptPara: 'para a Suíça', deDirectional: 'in die Schweiz', deNominative: 'die Schweiz', fr: 'en Suisse' },
  { iso3: 'IRN', deName: 'Iran', en: 'Iran', itLocative: 'in Iran', ptPara: 'para o Irã', deDirectional: 'in den Iran', deNominative: 'der Iran', fr: 'en Iran' },
  { iso3: 'JPN', deName: 'Japan', en: 'Japan', itLocative: 'in Giappone', ptPara: 'para o Japão', deDirectional: 'nach Japan', deNominative: 'Japan', fr: 'au Japon' },
  { iso3: 'FRA', deName: 'Frankreich', en: 'France', itLocative: 'in Francia', ptPara: 'para a França', deDirectional: 'nach Frankreich', deNominative: 'Frankreich', fr: 'en France' },
  { iso3: 'ITA', deName: 'Italien', en: 'Italy', itLocative: 'in Italia', ptPara: 'para a Itália', deDirectional: 'nach Italien', deNominative: 'Italien', fr: 'en Italie' },
  { iso3: 'SGP', deName: 'Singapur', en: 'Singapore', itLocative: 'a Singapore', ptPara: 'para Singapura', deDirectional: 'nach Singapur', deNominative: 'Singapur', fr: 'à Singapour' },
  { iso3: 'CUB', deName: 'Kuba', en: 'Cuba', itLocative: 'a Cuba', ptPara: 'para Cuba', deDirectional: 'nach Kuba', deNominative: 'Kuba', fr: 'à Cuba' },
  { iso3: 'ARE', deName: 'Vereinigte Arabische Emirate', en: 'the United Arab Emirates', itLocative: 'negli Emirati Arabi Uniti', ptPara: 'para os Emirados Árabes Unidos', deDirectional: 'in die Vereinigten Arabischen Emirate', deNominative: 'die Vereinigten Arabischen Emirate', fr: 'aux Émirats arabes unis' },
  { iso3: 'COD', deName: 'Kongo-Kinshasa', en: 'the Democratic Republic of the Congo', itLocative: 'nella Repubblica Democratica del Congo', ptPara: 'para a República Democrática do Congo', deDirectional: 'nach Kongo-Kinshasa', deNominative: 'Kongo-Kinshasa', fr: 'en République démocratique du Congo' },
];

describe('country-grammar golden checks', () => {
  for (const g of GOLDEN) {
    const country = COUNTRIES.find((c) => c.iso3 === g.iso3);
    assert.ok(country, `${g.iso3} must exist in COUNTRIES`);
    const { name } = country!;

    it(`${g.iso3}: en "the" form`, () => {
      assert.equal(getEnglishCountryPhrase(g.iso3, name.en), g.en);
    });

    it(`${g.iso3}: it locative (H1/title)`, () => {
      assert.equal(getItalianLocative(g.iso3, name.it), g.itLocative);
    });

    it(`${g.iso3}: pt "para {article} {name}" (H1/title)`, () => {
      assert.equal(getPortuguesePhrase(g.iso3, name.pt, 'para'), g.ptPara);
    });

    it(`${g.iso3}: de directional (H1/FAQ)`, () => {
      assert.equal(getGermanDirectional(g.iso3, g.deName), g.deDirectional);
    });

    it(`${g.iso3}: de nominative (title)`, () => {
      assert.equal(getGermanNominative(g.iso3, g.deName), g.deNominative);
    });

    it(`${g.iso3}: fr au/en/aux/à (title)`, () => {
      assert.equal(getFrenchPreposition(g.iso3, name.fr), g.fr);
    });

    it(`${g.iso3}: getH1CountryPhrase matches the per-locale wrapper for en/it/es/pt/de`, () => {
      assert.equal(getH1CountryPhrase('en', g.iso3, name.en), g.en);
      assert.equal(getH1CountryPhrase('it', g.iso3, name.it), g.itLocative);
      assert.equal(getH1CountryPhrase('es', g.iso3, name.es), getSpanishA(g.iso3, name.es));
      assert.equal(getH1CountryPhrase('pt', g.iso3, name.pt), g.ptPara);
      assert.equal(getH1CountryPhrase('de', g.iso3, g.deName), g.deDirectional);
      // fr/zh keep the bare name in the H1 (see getH1CountryPhrase docstring).
      assert.equal(getH1CountryPhrase('fr', g.iso3, name.fr), name.fr);
    });
  }

  it('GBR/USA/ARE: German weak adjective declension applies only with an article', () => {
    // Bare Intl.DisplayNames form uses the strong/no-article ending...
    assert.equal(getGermanNominative('JPN', 'Japan'), 'Japan');
    // ...but once an article precedes an adjective-initial name, it must
    // switch to the weak ending (Vereinigtes -> Vereinigte, Vereinigte ->
    // Vereinigten) — see the DeForm docstring in country-grammar.ts.
    assert.ok(getGermanNominative('GBR', 'Vereinigtes Königreich').includes('Vereinigte Königreich'));
    assert.ok(!getGermanNominative('GBR', 'Vereinigtes Königreich').includes('Vereinigtes Königreich'));
    assert.ok(getGermanNominative('USA', 'Vereinigte Staaten').includes('Vereinigten Staaten'));
    assert.ok(getGermanDirectional('ARE', 'Vereinigte Arabische Emirate').includes('Vereinigten Arabischen Emirate'));
  });

  it('de title copula: plural country names need "Sind", singular need "Ist"', () => {
    // Caught by grepping the built title, not by an earlier version of this
    // test: German predicate adjectives ("sicher") don't inflect for number,
    // but the copula verb still must agree with the subject — "Ist die
    // Vereinigten Staaten sicher?" is a real agreement error, "Sind die
    // Vereinigten Staaten sicher?" is correct.
    for (const iso3 of ['USA', 'NLD', 'ARE', 'MDV', 'PHL']) {
      const country = COUNTRIES.find((c) => c.iso3 === iso3)!;
      assert.equal(getGermanCopula(iso3, country.name.en), 'Sind', `${iso3} is plural in German`);
    }
    for (const iso3 of ['JPN', 'FRA', 'ITA', 'TUR', 'CHE', 'IRN', 'SGP', 'CUB']) {
      const country = COUNTRIES.find((c) => c.iso3 === iso3)!;
      assert.equal(getGermanCopula(iso3, country.name.en), 'Ist', `${iso3} is singular in German`);
    }
  });

  it('MDV/SYC/BHS/COM: small archipelago nations use it "alle" not "nelle"', () => {
    for (const iso3 of ['MDV', 'SYC', 'BHS', 'COM']) {
      const country = COUNTRIES.find((c) => c.iso3 === iso3)!;
      assert.match(getItalianLocative(iso3, country.name.it), /^alle /);
    }
  });

  it('PHL: larger archipelago NATION uses it "nelle" (not "alle", unlike MDV/SYC)', () => {
    const country = COUNTRIES.find((c) => c.iso3 === 'PHL')!;
    assert.equal(getItalianLocative('PHL', country.name.it), 'nelle Filippine');
  });

  it('MLT/CUB/SGP: small single-place states take no article at all (it "a", fr "à")', () => {
    for (const iso3 of ['MLT', 'CUB', 'SGP']) {
      const country = COUNTRIES.find((c) => c.iso3 === iso3)!;
      assert.match(getItalianLocative(iso3, country.name.it), /^a /);
      assert.match(getFrenchPreposition(iso3, country.name.fr), /^à /);
    }
  });
});

// --- 3. Comparison heading subject phrases (country.compare_title*) ---

describe('comparison heading: getComparisonSubject / getPortugueseDe', () => {
  it('pt "de" contracts with the article: do / da / dos / das', () => {
    assert.equal(getPortugueseDe('JPN', 'Japão'), 'do Japão');
    assert.equal(getPortugueseDe('DEU', 'Alemanha'), 'da Alemanha');
    assert.equal(getPortugueseDe('USA', 'Estados Unidos'), 'dos Estados Unidos');
    assert.equal(getPortugueseDe('MDV', 'Maldivas'), 'das Maldivas');
  });

  it('en takes "the" where the name needs it; es and zh stay bare', () => {
    assert.deepEqual(getComparisonSubject('en', 'USA', 'United States'), { phrase: 'the United States', copula: '' });
    assert.deepEqual(getComparisonSubject('en', 'ECU', 'Ecuador'), { phrase: 'Ecuador', copula: '' });
    assert.deepEqual(getComparisonSubject('es', 'USA', 'Estados Unidos'), { phrase: 'Estados Unidos', copula: '' });
    assert.deepEqual(getComparisonSubject('zh', 'DEU', '德国'), { phrase: '德国', copula: '' });
  });

  it('it uses the locative and fr the gendered preposition, so the sentence needs no article agreement', () => {
    assert.deepEqual(getComparisonSubject('it', 'ECU', 'Ecuador'), { phrase: 'in Ecuador', copula: '' });
    assert.deepEqual(getComparisonSubject('it', 'USA', 'Stati Uniti'), { phrase: 'negli Stati Uniti', copula: '' });
    assert.deepEqual(getComparisonSubject('fr', 'ECU', 'Équateur'), { phrase: 'en Équateur', copula: '' });
    assert.deepEqual(getComparisonSubject('fr', 'USA', 'États-Unis'), { phrase: 'aux États-Unis', copula: '' });
  });

  it('de gives the nominative with its article, and a copula that agrees with plural names', () => {
    assert.deepEqual(getComparisonSubject('de', 'DEU', 'Deutschland'), { phrase: 'Deutschland', copula: 'ist' });
    assert.deepEqual(getComparisonSubject('de', 'NLD', 'Niederlande'), { phrase: 'die Niederlande', copula: 'sind' });
    assert.deepEqual(getComparisonSubject('de', 'TUR', 'Türkei'), { phrase: 'die Türkei', copula: 'ist' });
  });

  it('covers all 248 countries in every locale: non-empty phrase, copula only in German', () => {
    for (const country of COUNTRIES) {
      const { iso2, iso3, name } = country;
      for (const lang of ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de'] as const) {
        const bare = lang === 'de' ? bareDeName(iso2, iso3) : (name as Record<string, string>)[lang] ?? name.en;
        const subject = getComparisonSubject(lang, iso3, bare);
        assert.ok(subject.phrase.length > 0, `${iso3}/${lang}: empty phrase`);
        if (lang === 'de') assert.ok(['ist', 'sind'].includes(subject.copula), `${iso3}/de: copula "${subject.copula}"`);
        else assert.equal(subject.copula, '', `${iso3}/${lang}: unexpected copula`);
      }
    }
  });
});

// --- 4. Portuguese (pt-BR) articles — audit 2026-10-14 ---
// An external reader called the copy machine-made; titles read "para Brasil",
// "a Quênia", "o Ilhas Salomão". These pin the corrected forms.

describe('pt articles: masculine countries, feminine compounds, island names', () => {
  const ptName = (iso3: string) => COUNTRIES.find((c) => c.iso3 === iso3)!.name.pt;
  const para = (iso3: string) => getPortuguesePhrase(iso3, ptName(iso3), 'para');

  it('common masculine countries take "o", including "-a" names that are masculine', () => {
    assert.equal(para('BRA'), 'para o Brasil');
    assert.equal(para('ECU'), 'para o Equador');
    assert.equal(para('MEX'), 'para o México');
    assert.equal(para('KEN'), 'para o Quênia');
    assert.equal(para('LKA'), 'para o Sri Lanka');
  });

  it('feminine compounds take "a" from their head noun', () => {
    assert.equal(para('KOR'), 'para a Coreia do Sul');
    assert.equal(para('ZAF'), 'para a África do Sul');
    assert.equal(para('VAT'), 'para a Cidade do Vaticano');
    assert.equal(para('REU'), 'para a Reunião');
  });

  it('island groups follow "Ilhas"/"Ilha", never the last word', () => {
    assert.equal(para('SLB'), 'para as Ilhas Salomão');
    assert.equal(para('ALA'), 'para as Ilhas Åland');
    assert.equal(para('IMN'), 'para a Ilha de Man');
  });

  it('island states and saint-named islands stay bare', () => {
    assert.equal(para('MLT'), 'para Malta');
    assert.equal(para('BHS'), 'para as Bahamas'); // the one Brazilian exception: "as Bahamas"
    assert.equal(para('ABW'), 'para Aruba');
    assert.equal(para('LCA'), 'para Santa Lúcia');
  });

  it('"a" contracts with the new articles', () => {
    assert.equal(getPortuguesePhrase('BRA', ptName('BRA'), 'a'), 'ao Brasil');
    assert.equal(getPortuguesePhrase('KOR', ptName('KOR'), 'a'), 'à Coreia do Sul');
    assert.equal(getPortuguesePhrase('CYM', ptName('CYM'), 'a'), 'às Ilhas Cayman');
  });
});

describe('en article: island groups and descriptive names take "the"', () => {
  const enName = (iso3: string) => COUNTRIES.find((c) => c.iso3 === iso3)!.name.en;
  it('plural island groups and descriptive names', () => {
    assert.equal(getEnglishCountryPhrase('CYM', enName('CYM')), 'the Cayman Islands');
    assert.equal(getEnglishCountryPhrase('ALA', enName('ALA')), 'the Åland Islands');
    assert.equal(getEnglishCountryPhrase('CAF', enName('CAF')), 'the Central African Republic');
    assert.equal(getEnglishCountryPhrase('IMN', enName('IMN')), 'the Isle of Man');
  });
  it('singular islands and saint names stay bare', () => {
    assert.equal(getEnglishCountryPhrase('SGS', enName('SGS')), 'South Georgia');
    assert.equal(getEnglishCountryPhrase('SHN', enName('SHN')), 'Saint Helena');
    assert.equal(getEnglishCountryPhrase('JPN', enName('JPN')), 'Japan');
  });
});

// --- 5. Article helpers for sentences that put the name after "di"/"de"/"von"
// or in subject position (2026-10-15 audit I19, I38, I39, I40, I48) ---

describe('it: article, articulated preposition and agreement', () => {
  const it_ = (iso3: string) => COUNTRIES.find((c) => c.iso3 === iso3)!.name.it;
  it('definite article: il / lo / la / l\' / gli / le, none for city-like places', () => {
    const cases: [string, string][] = [
      ['JPN', 'il Giappone'], ['FRA', 'la Francia'], ['AFG', "l'Afghanistan"], ['YEM', 'lo Yemen'],
      ['LKA', 'lo Sri Lanka'], ['ZWE', 'lo Zimbabwe'], ['CAN', 'il Canada'], ['GMB', 'il Gambia'],
      ['HND', "l'Honduras"], ['USA', 'gli Stati Uniti'], ['NLD', 'i Paesi Bassi'], ['MDV', 'le Maldive'],
      ['CIV', "la Costa d'Avorio"], ['COG', 'la Repubblica del Congo'], ['CXR', "l'Isola di Natale"],
      ['MLT', 'Malta'], ['HKG', 'Hong Kong'], ['ISR', 'Israele'],
    ];
    for (const [iso3, expected] of cases) assert.equal(getItalianWithArticle(iso3, it_(iso3)), expected, iso3);
  });
  it('"di"/"su"/"per" with the article (I38: "di Afghanistan", "su Emirati Arabi Uniti")', () => {
    assert.equal(getItalianArticulated('AFG', it_('AFG'), 'di'), "dell'Afghanistan");
    assert.equal(getItalianArticulated('ARE', it_('ARE'), 'su'), 'sugli Emirati Arabi Uniti');
    assert.equal(getItalianArticulated('JPN', it_('JPN'), 'per'), 'per il Giappone');
    assert.equal(getItalianArticulated('MLT', it_('MLT'), 'di'), 'di Malta');
    assert.equal(getItalianArticulated('BHS', it_('BHS'), 'di'), 'delle Bahamas');
  });
  it('agreement: gender and number of the subject ("le Bahamas sono", "il Giappone è")', () => {
    assert.deepEqual(getItalianAgreement('BHS', it_('BHS')), { gender: 'f', plural: true });
    assert.deepEqual(getItalianAgreement('USA', it_('USA')), { gender: 'm', plural: true });
    assert.deepEqual(getItalianAgreement('JPN', it_('JPN')), { gender: 'm', plural: false });
    assert.deepEqual(getItalianAgreement('ITA', it_('ITA')), { gender: 'f', plural: false });
    assert.deepEqual(getItalianAgreement('KEN', it_('KEN')), { gender: 'm', plural: false });
  });
});

describe('fr: article, "de" and agreement (I39)', () => {
  const fr = (iso3: string) => COUNTRIES.find((c) => c.iso3 === iso3)!.name.fr;
  it('le / la / l\' / les, none for city-like places', () => {
    const cases: [string, string, string][] = [
      ['JPN', 'le Japon', 'du Japon'], ['FRA', 'la France', 'de la France'], ['AFG', "l'Afghanistan", "de l'Afghanistan"],
      ['MDV', 'les Maldives', 'des Maldives'], ['USA', 'les États-Unis', 'des États-Unis'], ['BRB', 'la Barbade', 'de la Barbade'],
      ['IMN', "l'île de Man", "de l'île de Man"], ['CUB', 'Cuba', 'de Cuba'], ['ISR', 'Israël', "d'Israël"],
      ['HTI', 'Haïti', "d'Haïti"], ['HND', 'le Honduras', 'du Honduras'], ['COG', 'la République du Congo', 'de la République du Congo'],
    ];
    for (const [iso3, art, de] of cases) {
      assert.equal(getFrenchWithArticle(iso3, fr(iso3)), art, iso3);
      assert.equal(getFrenchDe(iso3, fr(iso3)), de, iso3);
    }
  });
  it('agreement ("les Maldives sont", "le Japon est", "l\'Italie est")', () => {
    assert.deepEqual(getFrenchAgreement('MDV', fr('MDV')), { gender: 'f', plural: true });
    assert.deepEqual(getFrenchAgreement('USA', fr('USA')), { gender: 'm', plural: true });
    assert.deepEqual(getFrenchAgreement('JPN', fr('JPN')), { gender: 'm', plural: false });
    assert.deepEqual(getFrenchAgreement('ITA', fr('ITA')), { gender: 'f', plural: false });
    assert.deepEqual(getFrenchAgreement('IRN', fr('IRN')), { gender: 'm', plural: false });
  });
});

describe('de: dative, "von" and locative (I48, I19)', () => {
  const de = (iso2: string, iso3: string) => bareDeName(iso2, iso3);
  it('weak "-en" adjectives and plural "-n" in the dative', () => {
    assert.equal(getGermanVon('ARE', de('AE', 'ARE')), 'von den Vereinigten Arabischen Emiraten');
    assert.equal(getGermanVon('USA', de('US', 'USA')), 'von den Vereinigten Staaten');
    assert.equal(getGermanVon('GBR', de('GB', 'GBR')), 'vom Vereinigten Königreich');
    assert.equal(getGermanVon('IRN', de('IR', 'IRN')), 'vom Iran');
    assert.equal(getGermanVon('TUR', de('TR', 'TUR')), 'von der Türkei');
    assert.equal(getGermanVon('JPN', de('JP', 'JPN')), 'von Japan');
    assert.equal(getGermanDative('DOM', de('DO', 'DOM')), 'der Dominikanischen Republik');
    assert.equal(getGermanDative('NLD', de('NL', 'NLD')), 'den Niederlanden');
    assert.equal(getGermanDative('FRO', de('FO', 'FRO')), 'den Färöern');
  });
  it('locative: im / in der / in den / auf den', () => {
    assert.equal(getGermanLocative('IRN', de('IR', 'IRN')), 'im Iran');
    assert.equal(getGermanLocative('CHE', de('CH', 'CHE')), 'in der Schweiz');
    assert.equal(getGermanLocative('NLD', de('NL', 'NLD')), 'in den Niederlanden');
    assert.equal(getGermanLocative('MDV', de('MV', 'MDV')), 'auf den Malediven');
    assert.equal(getGermanLocative('JPN', de('JP', 'JPN')), 'in Japan');
    assert.equal(getGermanLocative('SGS', de('GS', 'SGS')), 'in Südgeorgien und auf den Südlichen Sandwichinseln');
  });
});

describe('pt / es / en: the remaining helpers', () => {
  const name = (iso3: string) => COUNTRIES.find((c) => c.iso3 === iso3)!.name;
  it('pt "em" contracted with the article, and agreement', () => {
    assert.equal(getPortugueseEm('BRA', name('BRA').pt), 'no Brasil');
    assert.equal(getPortugueseEm('FRA', name('FRA').pt), 'na França');
    assert.equal(getPortugueseEm('USA', name('USA').pt), 'nos Estados Unidos');
    assert.equal(getPortugueseEm('PRT', name('PRT').pt), 'em Portugal');
    assert.deepEqual(getPortugueseAgreement('PHL', name('PHL').pt), { gender: 'f', plural: true });
  });
  it('es article only where Spanish always writes one', () => {
    assert.equal(getSpanishWithArticle('GBR', name('GBR').es), 'el Reino Unido');
    assert.equal(getSpanishWithArticle('JPN', name('JPN').es), 'Japón');
  });
  it('en plural: island groups only', () => {
    assert.equal(isEnglishPlural('CYM'), true);
    assert.equal(isEnglishPlural('USA'), false);
    assert.equal(isEnglishPlural('PHL'), false);
  });
});
