/**
 * Tests for src/i18n/source-descriptions.ts — the render-time localization for the
 * country-page data-source list (SourcesList.astro). Two things are covered:
 *
 *  1. buildLocalizedAdvisoryDescription: the per-country 'advisories' sentence, across
 *     issuer counts (0/1/2/3+) and all 7 published languages, checked against the exact
 *     agency names in src/i18n/ui.ts ('country.advisory.<code>') so a future edit to
 *     those names can't silently desync from this module's expectations.
 *  2. getLocalizedSourceDescription / getLocalizedSourceMeasures: the fixed-catalog
 *     lookup, its 'en' passthrough, and its fallback-to-stored-text safety net for any
 *     key not (yet) translated — the same guarantee SourcesList.astro relies on so a
 *     new pipeline source never renders blank.
 *
 * Run with: npx tsx --test src/i18n/__tests__/source-descriptions.test.ts
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import type { Lang } from '../ui.js';
import { publishedLanguages } from '../ui.js';
import type { ScoredCountry } from '../../pipeline/types.js';
import {
  buildLocalizedAdvisoryDescription,
  getLocalizedSourceDescription,
  getLocalizedSourceMeasures,
} from '../source-descriptions.js';

type AdvisoryCode = keyof ScoredCountry['advisories'];

/** Minimal, type-correct AdvisoryInfo stub — only `source` feeds the sentence builder,
 *  but the other fields are required by the type, so they're filled with placeholders. */
function stubAdvisory(source: string): NonNullable<ScoredCountry['advisories']['us']> {
  return { level: 1, text: 'placeholder', source, url: 'https://example.test/' };
}

function advisories(codes: AdvisoryCode[]): ScoredCountry['advisories'] {
  const out: ScoredCountry['advisories'] = {};
  for (const code of codes) {
    (out as Record<string, unknown>)[code] = stubAdvisory(`stub-${code}`);
  }
  return out;
}

describe('buildLocalizedAdvisoryDescription', () => {
  it('returns null for zero issuers, for every published language', () => {
    for (const lang of publishedLanguages) {
      assert.equal(buildLocalizedAdvisoryDescription(lang, {}), null, `lang=${lang}`);
    }
  });

  it('returns null when advisories is undefined (defensive/back-compat path)', () => {
    assert.equal(buildLocalizedAdvisoryDescription('en', undefined), null);
  });

  // Exact expected sentences per language, for 1/2/3 issuers (in ADVISORY_CODES order:
  // us, uk, ca, ...), using each language's real 'country.advisory.<code>' names from
  // src/i18n/ui.ts so a future rename there is caught here too.
  const expected: Record<Lang, { one: string; two: string; three: string }> = {
    en: {
      one: 'Travel advisory from US State Department',
      two: 'Travel advisories from 2 governments: US State Department and UK FCDO',
      three: 'Travel advisories from 3 governments: US State Department, UK FCDO, and Government of Canada',
    },
    it: {
      one: 'Avviso di viaggio da Dipartimento di Stato USA',
      two: 'Avvisi di viaggio da 2 governi: Dipartimento di Stato USA e FCDO Regno Unito',
      three: 'Avvisi di viaggio da 3 governi: Dipartimento di Stato USA, FCDO Regno Unito e Governo del Canada',
    },
    es: {
      one: 'Aviso de viaje de Departamento de Estado de EE.UU.',
      two: 'Avisos de viaje de 2 gobiernos: Departamento de Estado de EE.UU. y FCDO Reino Unido',
      three: 'Avisos de viaje de 3 gobiernos: Departamento de Estado de EE.UU., FCDO Reino Unido y Gobierno de Canadá',
    },
    fr: {
      one: "Avis de voyage de Département d'État américain",
      two: "Avis de voyage de 2 gouvernements : Département d'État américain et FCDO Royaume-Uni",
      three: "Avis de voyage de 3 gouvernements : Département d'État américain, FCDO Royaume-Uni et Gouvernement du Canada",
    },
    pt: {
      one: 'Aviso de viagem de Departamento de Estado dos EUA',
      two: 'Avisos de viagem de 2 governos: Departamento de Estado dos EUA e FCDO Reino Unido',
      three: 'Avisos de viagem de 3 governos: Departamento de Estado dos EUA, FCDO Reino Unido e Governo do Canadá',
    },
    zh: {
      one: '来自美国国务院的旅行建议',
      two: '来自 2 个政府的旅行建议：美国国务院和英国外交、联邦及发展事务部（FCDO）',
      three: '来自 3 个政府的旅行建议：美国国务院、英国外交、联邦及发展事务部（FCDO）和加拿大政府',
    },
    de: {
      one: 'Reisehinweis von US-Außenministerium',
      two: 'Reisehinweise von 2 Regierungen: US-Außenministerium und Britisches FCDO',
      three: 'Reisehinweise von 3 Regierungen: US-Außenministerium, Britisches FCDO und Regierung von Kanada',
    },
  };

  for (const lang of publishedLanguages) {
    it(`renders the 1-issuer sentence in ${lang}`, () => {
      assert.equal(buildLocalizedAdvisoryDescription(lang, advisories(['us'])), expected[lang].one);
    });

    it(`renders the 2-issuer sentence in ${lang}`, () => {
      assert.equal(buildLocalizedAdvisoryDescription(lang, advisories(['us', 'uk'])), expected[lang].two);
    });

    it(`renders the 3-issuer sentence in ${lang}`, () => {
      assert.equal(buildLocalizedAdvisoryDescription(lang, advisories(['us', 'uk', 'ca'])), expected[lang].three);
    });
  }

  it('follows ADVISORY_CODES order regardless of object key insertion order', () => {
    // 'ca' inserted before 'us' — the sentence must still list US before Canada,
    // matching buildAdvisoryDescription()'s own ADVISORY_CODES.map() order in the
    // pipeline (src/pipeline/scoring/engine.ts), not object iteration order.
    const out: ScoredCountry['advisories'] = {};
    (out as Record<string, unknown>).ca = stubAdvisory('stub-ca');
    (out as Record<string, unknown>).us = stubAdvisory('stub-us');
    assert.equal(
      buildLocalizedAdvisoryDescription('en', out),
      'Travel advisories from 2 governments: US State Department and Government of Canada',
    );
  });
});

describe('getLocalizedSourceDescription', () => {
  it('returns the stored (English) text unchanged for lang en, regardless of key', () => {
    assert.equal(getLocalizedSourceDescription('en', 'gpi', 'stored English text'), 'stored English text');
  });

  it('returns the localized text for a known key in a non-English language', () => {
    const result = getLocalizedSourceDescription('it', 'gpi', 'stored English text');
    assert.notEqual(result, 'stored English text');
    assert.match(result, /pacificità/);
  });

  it('falls back to the stored text for an unrecognized key (never blank)', () => {
    assert.equal(
      getLocalizedSourceDescription('it', 'some_future_source', 'stored English text'),
      'stored English text',
    );
  });

  it('covers every CatalogSourceKey for every published language (no accidental gaps)', () => {
    const keys = ['worldbank', 'vdem', 'gpi', 'inform', 'reliefweb', 'gdacs', 'ucdp'];
    for (const lang of publishedLanguages) {
      for (const key of keys) {
        const result = getLocalizedSourceDescription(lang, key, `STORED[${key}]`);
        assert.ok(result.length > 0, `lang=${lang} key=${key}`);
        if (lang !== 'en') {
          assert.notEqual(result, `STORED[${key}]`, `lang=${lang} key=${key} should be translated`);
        }
      }
    }
  });
});

describe('getLocalizedSourceMeasures', () => {
  it('returns the stored (English) text unchanged for lang en', () => {
    assert.equal(getLocalizedSourceMeasures('en', 'worldbank', 'Child Mortality, PM2.5 Air Pollution'), 'Child Mortality, PM2.5 Air Pollution');
  });

  it('returns localized text for a known key in a non-English language', () => {
    const result = getLocalizedSourceMeasures('fr', 'gdacs', 'stored');
    assert.notEqual(result, 'stored');
    assert.match(result, /catastrophes naturelles/);
  });

  it('falls back to the stored text for an unrecognized key', () => {
    assert.equal(getLocalizedSourceMeasures('de', 'ucdp', 'stored measures'), 'stored measures');
  });
});
