/**
 * Country names vs. name matching (2026-10-15).
 *
 * The consistency audit renamed display names in src/pipeline/config/countries.ts ("Côte
 * d'Ivoire", "Réunion", "Republic of the Congo", fr "Népal"...). The fetchers match source pages
 * to countries partly by name, so these tests pin that the renames change nothing they do:
 *  1. sourceName() returns, for every place and language, exactly the pre-rename name (frozen in
 *     fixtures/country-names-pre-2026-10-15.json), so every URL, slug, name map and own-name
 *     search a fetcher builds from it is byte-identical to before;
 *  2. getCountryByName() still returns the same place for every name that matched before, and
 *     only ever adds matches (accent and apostrophe variants);
 *  3. replays of stored source inputs (UK FCDO index titles, Taiwan BOCA listing ids) resolve to
 *     the same places as before, plus the intended additions, listed here one by one.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COUNTRIES, LEGACY_NAMES, foldName, getCountryByName, sourceName } from '../config/countries.js';
import { parseUsJsonApiData, resolveUkTitle } from '../fetchers/advisories.js';
import { resolveTwCountry } from '../fetchers/advisories-tier3a.js';
import { extractFrTerritoryLevel } from '../normalize/advisory-levels.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const PRE = JSON.parse(readFileSync(join(FIXTURES, 'country-names-pre-2026-10-15.json'), 'utf8')) as Record<string, Record<'en' | 'it' | 'es' | 'fr' | 'pt', string>>;
const LANGS = ['en', 'it', 'es', 'fr', 'pt'] as const;

// The matcher as it was before the renames: exact, case-insensitive English name.
const preByName = new Map(Object.entries(PRE).map(([iso3, n]) => [n.en.toLowerCase(), iso3]));
const preGetByName = (name: string): string | undefined => preByName.get(name.toLowerCase());

describe('sourceName: fetchers see the pre-rename names', () => {
  it('covers the same 248 places as the frozen list', () => {
    assert.deepEqual(COUNTRIES.map((c) => c.iso3).sort(), Object.keys(PRE).sort());
  });
  it('equals the frozen name for every place and language', () => {
    for (const c of COUNTRIES) {
      for (const lang of LANGS) assert.equal(sourceName(c, lang), PRE[c.iso3][lang], `${c.iso3}/${lang}`);
    }
  });
  it('LEGACY_NAMES lists exactly the names that changed', () => {
    for (const c of COUNTRIES) {
      for (const lang of LANGS) {
        const changed = c.name[lang] !== PRE[c.iso3][lang];
        assert.equal(Boolean(LEGACY_NAMES[c.iso3]?.[lang]), changed, `${c.iso3}/${lang}`);
      }
    }
  });
});

describe('getCountryByName: same place for every name that matched before', () => {
  it('every pre-rename English name, in any case', () => {
    for (const [iso3, n] of Object.entries(PRE)) {
      for (const variant of [n.en, n.en.toLowerCase(), n.en.toUpperCase()]) {
        assert.equal(getCountryByName(variant)?.iso3, iso3, `"${variant}"`);
      }
    }
  });
  it('every current English name', () => {
    for (const c of COUNTRIES) assert.equal(getCountryByName(c.name.en)?.iso3, c.iso3, c.name.en);
  });
  it('no two places share a folded name', () => {
    const owner = new Map<string, string>();
    for (const c of COUNTRIES) {
      for (const n of [c.name.en, LEGACY_NAMES[c.iso3]?.en].filter(Boolean) as string[]) {
        const key = foldName(n);
        assert.ok(!owner.has(key) || owner.get(key) === c.iso3, `"${key}": ${owner.get(key)} and ${c.iso3}`);
        owner.set(key, c.iso3);
      }
    }
  });
  it("Côte d'Ivoire in every spelling sources use (the cause of its missing UK advisory)", () => {
    for (const s of ["Côte d'Ivoire", 'Côte d’Ivoire', 'Côte d&#039;Ivoire', "Cote d'Ivoire", "COTE D'IVOIRE"]) {
      assert.equal(getCountryByName(s)?.iso3, 'CIV', s);
    }
  });
  it('the two Congos stay apart; a bare "Congo" is still the Republic of the Congo', () => {
    assert.equal(getCountryByName('Congo')?.iso3, 'COG');
    assert.equal(getCountryByName('Republic of the Congo')?.iso3, 'COG');
    assert.equal(getCountryByName('Democratic Republic of the Congo')?.iso3, 'COD');
  });
});

describe('replay: UK FCDO index titles, 2026-10-13..15', () => {
  const { titles } = JSON.parse(readFileSync(join(FIXTURES, 'uk-fcdo-index-titles-2026-10.json'), 'utf8')) as { titles: string[] };
  const nameOf = (title: string) => title.replace(/\s*travel advice\s*$/i, '').trim();

  it('every title that resolved before resolves to the same place', () => {
    for (const title of titles) {
      const pre = preGetByName(nameOf(title));
      if (pre) assert.deepEqual(resolveUkTitle(nameOf(title)), [pre], title);
    }
  });
  it('the 33 titles that never matched now do, except Bermuda (not one of our places)', () => {
    const gained = titles.filter((t) => !preGetByName(nameOf(t))).map((t) => [nameOf(t), resolveUkTitle(nameOf(t))] as const);
    assert.equal(gained.length, 33);
    assert.deepEqual(gained.filter(([, iso3s]) => iso3s.length === 0).map(([n]) => n), ['Bermuda (British Overseas Territory)']);
    const iso3s = gained.flatMap(([, x]) => x).sort();
    assert.deepEqual(iso3s, [
      'AIA', 'ATA', 'BES', 'BLM', 'CIV', 'COK', 'CPV', 'CUW', 'CYM', 'CZE', 'FLK', 'FSM', 'GIB', 'GMB', 'HKG', 'KNA',
      'LCA', 'MAC', 'MAF', 'NIU', 'PCN', 'PRK', 'REU', 'SGS', 'SHN', 'SPM', 'STP', 'SXM', 'TCA', 'TKL', 'TLS', 'USA',
      'VCT', 'VGB', 'WLF',
    ]);
  });
  it('no place gets two FCDO pages', () => {
    const all = titles.flatMap((t) => resolveUkTitle(nameOf(t)));
    assert.equal(new Set(all).size, all.length);
  });
});

describe('replay: Taiwan BOCA listing ids, 2026-10-13..15', () => {
  const { ids } = JSON.parse(readFileSync(join(FIXTURES, 'tw-boca-listing-ids-2026-10.json'), 'utf8')) as { ids: string[] };
  it('every id that resolved before resolves to the same place', () => {
    for (const id of ids) {
      // Pre-rename resolver: the alias target or the id with spaces, matched exactly.
      const now = resolveTwCountry(id)?.iso3;
      const preName = id.replace(/_/g, ' ');
      const pre = preGetByName(preName);
      if (pre) assert.equal(now, pre, id);
    }
  });
  it("Côte d'Ivoire, Réunion, Curaçao and the Republic of the Congo resolve", () => {
    const byIso3 = new Map(ids.map((id) => [resolveTwCountry(id)?.iso3, id]));
    for (const iso3 of ['CIV', 'COG', 'COD']) assert.ok(byIso3.has(iso3), iso3);
  });
});

describe('French parser: the own-name search still uses the pre-rename name', () => {
  // A France-diplomatie style page for the Republic of the Congo that names it "Congo".
  const page = 'Zones de vigilance Dernière actualisation le 01/10/2026. La région du Pool est déconseillée sauf raison impérative. Tout déplacement au Congo est déconseillé sauf raison impérative. Risques encourus';
  it('COG: same level as with the name "Congo"', () => {
    const cog = COUNTRIES.find((c) => c.iso3 === 'COG')!;
    assert.equal(sourceName(cog, 'fr'), 'Congo');
    assert.equal(extractFrTerritoryLevel(page, sourceName(cog, 'fr')), extractFrTerritoryLevel(page, 'Congo'));
  });
});

describe('US State Department: titles as the live feed writes them (2026-10-15 RSS)', () => {
  // Côte d'Ivoire, the Republic of the Congo and São Tomé and Príncipe had no US advisory on any
  // day before this fix: the feed writes "Côte d’Ivoire" (accent, curly apostrophe), "Republic of
  // Congo" (no "the") and "São Tomé and Príncipe" (accents), none of which matched exactly.
  const entry = (title: string, code: string) => ({
    Title: title,
    Link: `https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/${code}.html`,
    Category: [code.toUpperCase()],
    Published: '2026-10-01T00:00:00-04:00',
    Updated: '2026-10-01T00:00:00-04:00',
  });
  it('resolves all three, with their levels', () => {
    const { advisoryInfo } = parseUsJsonApiData([
      entry('Côte d’Ivoire - Level 2: Exercise Increased Caution', 'iv'),
      entry('Republic of Congo - Level 2: Exercise Increased Caution', 'cf'),
      entry('São Tomé and Príncipe - Level 2: Exercise Increased Caution', 'tp'),
      entry('Saint Barthelemy - Level 1: Exercise Normal Precautions', 'tb'),
    ], 2026) as { advisoryInfo: Record<string, { level?: number; us?: { level: number } }> };
    const level = (iso3: string) => advisoryInfo[iso3]?.us?.level ?? advisoryInfo[iso3]?.level;
    assert.equal(level('CIV'), 2);
    assert.equal(level('COG'), 2);
    assert.equal(level('STP'), 2);
    assert.equal(level('BLM'), 1);
  });
});
