/**
 * Tests for src/lib/comparisons.ts (country-page comparison table + related
 * countries block) and the i18n keys those sections render.
 *
 * Fixtures use dyadic pillar values (0.25, 0.5, 0.75...) so every distance in
 * the tie-break tests is exact in floating point. Real neighbours come from the
 * real borderMap; only the countries under test are synthetic.
 *
 * Run with: node --import tsx --test src/lib/__tests__/comparisons.test.ts
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import type { ScoredCountry, PillarScore } from '../../pipeline/types.js';
import { ui } from '../../i18n/ui.js';
import {
  selectComparison,
  selectRelated,
  profileDistance,
  comparisonRows,
  MIN_NEIGHBOURS_BEFORE_FILL,
  COMPARISON_SIZE,
  RELATED_LIST_SIZE,
} from '../comparisons.js';
import { hasSufficientData } from '../hub-data.js';
import { borderMap } from '../neighbors.js';
import { getRegion } from '../regions.js';

const PILLAR_NAMES = ['conflict', 'crime', 'health', 'governance', 'environment'] as const;
type Vec = [number, number, number, number, number];

/** Fixture country. Pillars default to a flat profile at score/10; `sources` defaults to a passing 4. */
function country(iso3: string, score: number, opts: { sources?: number; pillars?: Vec } = {}): ScoredCountry {
  const flat = score / 10;
  const vec: Vec = opts.pillars ?? [flat, flat, flat, flat, flat];
  const pillars: PillarScore[] = PILLAR_NAMES.map((name, i) => ({
    name,
    score: vec[i],
    weight: 0.2,
    indicators: [],
    dataCompleteness: 1,
  }));
  const sources = Array.from({ length: opts.sources ?? 4 }, (_, i) => ({
    name: `src-${i}`,
    url: 'https://example.test/',
    fetchedAt: '2026-10-14T00:00:00Z',
    description: 'fixture',
  }));
  return {
    iso3,
    name: { en: iso3, it: iso3, es: iso3, fr: iso3, pt: iso3 },
    score,
    scoreDisplay: Math.round(score),
    pillars,
    advisories: {},
    dataCompleteness: 1,
    confidence: 1,
    lastUpdated: '2026-10-14T00:00:00Z',
    sources,
  } as ScoredCountry;
}

const iso = (xs: ScoredCountry[]): string[] => xs.map((c) => c.iso3);
const find = (world: ScoredCountry[], code: string): ScoredCountry => {
  const hit = world.find((c) => c.iso3 === code);
  if (!hit) throw new Error(`fixture ${code} missing`);
  return hit;
};

// --- selectComparison: real neighbours ---

describe('selectComparison: real neighbours', () => {
  it('uses real neighbours only, capped at the 6 highest scores, with no nearby fill at 3 or more', () => {
    // DEU has 9 real borders. The cap keeps the six best-scoring ones.
    const world = [
      country('DEU', 8.36),
      country('DNK', 8.75), country('CHE', 8.71), country('LUX', 8.7), country('CZE', 8.57),
      country('AUT', 8.48), country('BEL', 8.36), country('NLD', 8.2), country('FRA', 7.9), country('POL', 7.0),
      country('ITA', 9.0), // not a neighbour of Germany, however high it scores
      country('JPN', 8.36), // not a neighbour either
    ];
    const sel = selectComparison(find(world, 'DEU'), world);
    assert.deepEqual(iso(sel.neighbours), ['DNK', 'CHE', 'LUX', 'CZE', 'AUT', 'BEL']);
    assert.deepEqual(sel.nearby, []);
  });

  it('drops neighbours failing hasSufficientData before the top-6 cap, so a comparable one is not pushed out', () => {
    // FRA has 8 real borders. AND and MCO score highest but have 3 sources each.
    // Capping first would keep them and lose a comparable neighbour.
    const world = [
      country('FRA', 7.95),
      country('ESP', 6.6), country('ITA', 6.5), country('CHE', 6.4),
      country('DEU', 6.3), country('LUX', 6.2), country('BEL', 6.1),
      country('AND', 7.9, { sources: 3 }), country('MCO', 7.8, { sources: 3 }),
    ];
    const sel = selectComparison(find(world, 'FRA'), world);
    assert.deepEqual(iso(sel.neighbours), ['ESP', 'ITA', 'CHE', 'DEU', 'LUX', 'BEL']);
    assert.deepEqual(sel.nearby, []);
  });

  it('applies the fill threshold exactly: 3 data-sufficient neighbours means no fill', () => {
    // ESP borders FRA, PRT, AND (3 sources, filtered) and MAR: three remain.
    const world = [
      country('ESP', 7.0),
      country('FRA', 7.9), country('PRT', 7.5), country('MAR', 5.0),
      country('AND', 7.9, { sources: 3 }),
      country('ITA', 7.01), // closest in score, same region, but not needed
    ];
    assert.equal(MIN_NEIGHBOURS_BEFORE_FILL, 3);
    const sel = selectComparison(find(world, 'ESP'), world);
    assert.equal(sel.neighbours.length, 3);
    assert.deepEqual(sel.nearby, []);
  });
});

// --- selectComparison: nearby fill ---

describe('selectComparison: nearby fill for islands and sparse borders', () => {
  it('tops up to COMPARISON_SIZE with same-region, data-sufficient countries closest in score', () => {
    // ECU has 2 real neighbours (COL, PER). Fill 2 from the Americas by score gap.
    // GUF is closest of all but has 1 source; DEU is closest but wrong region.
    const world = [
      country('ECU', 6.0),
      country('COL', 5.75), country('PER', 6.97),
      country('BRA', 6.46), // gap 0.46
      country('BOL', 6.88), // gap 0.88
      country('VEN', 5.07), // gap 0.93
      country('CHL', 7.66), // gap 1.66
      country('GUF', 6.36, { sources: 1 }), // gap 0.36, data-poor
      country('DEU', 6.1), // gap 0.10, wrong region
    ];
    assert.equal(COMPARISON_SIZE, 4);
    const sel = selectComparison(find(world, 'ECU'), world);
    assert.deepEqual(iso(sel.neighbours), ['PER', 'COL']);
    assert.deepEqual(iso(sel.nearby), ['BRA', 'BOL']);
    assert.equal(sel.neighbours.length + sel.nearby.length, COMPARISON_SIZE);
  });

  it('breaks equal score gaps by iso3, whatever the input order', () => {
    // BOL (6.5) and VEN (5.5) are both 0.5 away from ECU (6.0). ISO3 order decides.
    const world = [
      country('ECU', 6.0), country('COL', 5.75), country('PER', 6.97),
      country('VEN', 5.5), country('BOL', 6.5),
    ];
    const forward = selectComparison(find(world, 'ECU'), world);
    const reversed = selectComparison(find(world, 'ECU'), [...world].reverse());
    assert.deepEqual(iso(forward.nearby), ['BOL', 'VEN']);
    assert.deepEqual(iso(reversed.nearby), ['BOL', 'VEN']);
  });

  it('never fills a region-"other" country, even when other "other" peers pass the data floor', () => {
    // Antarctica (ATA) sits in region "other". Without the guard it would pull in every "other" entry.
    const world = [country('ATA', 5.8), country('BVT', 5.8, { sources: 5 }), country('CCK', 5.2, { sources: 4 })];
    assert.equal(getRegion('ATA'), 'other');
    const sel = selectComparison(find(world, 'ATA'), world);
    assert.deepEqual(sel.neighbours, []);
    assert.deepEqual(sel.nearby, []);
  });

  it('gives a data-poor country its comparison: its own sources never gate the section', () => {
    // Aland has no borderMap entry (0 neighbours) and 0 sources. Jersey is closest but data-poor.
    const world = [
      country('ALA', 5.9, { sources: 0 }),
      country('JEY', 5.9, { sources: 0 }),
      country('FRA', 6.0), country('ITA', 6.5), country('ESP', 7.0),
      country('GBR', 7.5), country('DEU', 8.0), country('ISL', 8.9),
    ];
    const sel = selectComparison(find(world, 'ALA'), world);
    assert.deepEqual(sel.neighbours, []);
    assert.deepEqual(iso(sel.nearby), ['FRA', 'ITA', 'ESP', 'GBR']);
  });
});

// --- selectRelated ---

describe('selectRelated', () => {
  // Shared world: ECU compares to COL/PER (neighbours) and BRA/BOL (fill).
  // ECU, COL, PER, BRA, BOL, VEN, CHL are flat 0.5 pillars, so COL/BRA/BOL/VEN are all
  // at distance 0 from ECU. They must NOT reach the similar list: COL/BRA/BOL are
  // already shown in the comparison, VEN and CHL are in the same-region list, and
  // GUF/TWN are data-poor. JPN (0), PHL, KOR, CHN are the only eligible similar countries.
  const flat: Vec = [0.5, 0.5, 0.5, 0.5, 0.5];
  const world: ScoredCountry[] = [
    country('ECU', 6.0, { pillars: flat }),
    country('COL', 5.75, { pillars: flat }), country('PER', 6.97, { pillars: flat }),
    country('BRA', 6.46, { pillars: flat }), country('BOL', 6.88, { pillars: flat }),
    country('VEN', 5.07, { pillars: flat }), country('CHL', 7.66, { pillars: flat }),
    country('GUF', 6.36, { sources: 1, pillars: flat }),
    country('JPN', 8.24, { pillars: flat }),
    country('TWN', 7.57, { sources: 1, pillars: flat }),
    country('KOR', 8.06, { pillars: [0.8, 0.5, 0.5, 0.5, 0.5] }),
    country('PHL', 6.12, { pillars: [0.6, 0.6, 0.5, 0.5, 0.5] }),
    country('CHN', 6.83, { pillars: [0.5, 0.5, 0.5, 0.5, 0.9] }),
  ];

  it('excludes self, data-poor countries and anything the comparison already shows', () => {
    const ecu = find(world, 'ECU');
    const shown = selectComparison(ecu, world);
    const rel = selectRelated(ecu, world, shown);
    assert.deepEqual(iso(shown.neighbours), ['PER', 'COL']);
    assert.deepEqual(iso(shown.nearby), ['BRA', 'BOL']);
    // Same region, closest total score: VEN (0.93) then CHL (1.66). GUF is data-poor, BRA/BOL shown.
    assert.deepEqual(iso(rel.sameRegion), ['VEN', 'CHL']);
    // Most similar profile, outside sameRegion: JPN (0), PHL (~0.14), KOR (0.3). CHN (0.4) is fourth.
    assert.deepEqual(iso(rel.similarProfile), ['JPN', 'PHL', 'KOR']);
    const all = [...iso(rel.sameRegion), ...iso(rel.similarProfile)];
    for (const banned of ['ECU', 'COL', 'PER', 'BRA', 'BOL', 'GUF', 'TWN']) {
      assert.ok(!all.includes(banned), `${banned} must not appear in the related block`);
    }
    assert.equal(new Set(all).size, all.length, 'no country may appear twice');
  });

  it('keeps lists at RELATED_LIST_SIZE or fewer', () => {
    assert.equal(RELATED_LIST_SIZE, 3);
    const ecu = find(world, 'ECU');
    const rel = selectRelated(ecu, world, selectComparison(ecu, world));
    assert.ok(rel.sameRegion.length <= RELATED_LIST_SIZE);
    assert.ok(rel.similarProfile.length <= RELATED_LIST_SIZE);
  });

  it('ranks similar profiles by smallest Euclidean distance, breaking ties by iso3, whatever the input order', () => {
    // ECU is flat 0.5. Four candidates each differ by one pillar: three at 0.25 (ties) and one at 0.5.
    const ties = [
      country('ECU', 6.0, { pillars: flat }),
      country('GBR', 6.0, { pillars: [1.0, 0.5, 0.5, 0.5, 0.5] }), // 0.5
      country('NLD', 6.0, { pillars: [0.5, 0.5, 0.75, 0.5, 0.5] }), // 0.25
      country('FRA', 6.0, { pillars: [0.5, 0.25, 0.5, 0.5, 0.5] }), // 0.25
      country('DEU', 6.0, { pillars: [0.75, 0.5, 0.5, 0.5, 0.5] }), // 0.25
    ];
    const ecu = find(ties, 'ECU');
    const forward = selectRelated(ecu, ties, { neighbours: [], nearby: [] });
    const reversed = selectRelated(ecu, [...ties].reverse(), { neighbours: [], nearby: [] });
    assert.deepEqual(iso(forward.similarProfile), ['DEU', 'FRA', 'NLD']);
    assert.deepEqual(iso(reversed.similarProfile), ['DEU', 'FRA', 'NLD']);
  });

  it('gives a data-poor subject full lists', () => {
    const ala = country('ALA', 5.89, { sources: 0 });
    // Eight Europe peers: the comparison takes four as nearby fillers, and the
    // related block takes three of the remaining four. Nothing is shown twice.
    const europe = [
      country('DEU', 8.36), country('FRA', 7.95), country('ISL', 8.87), country('GBR', 8.31),
      country('ITA', 8.12), country('ESP', 8.26), country('NLD', 8.29), country('AUT', 8.48),
    ];
    const fixture = [ala, ...europe, ...world.filter((c) => c.iso3 !== 'ECU')];
    const shown = selectComparison(ala, fixture);
    assert.equal(shown.nearby.length, COMPARISON_SIZE, 'a data-poor country still gets its comparison');
    const rel = selectRelated(ala, fixture, shown);
    assert.equal(rel.sameRegion.length, RELATED_LIST_SIZE, 'a data-poor country still gets a same-region list');
    assert.ok(rel.similarProfile.length > 0, 'a data-poor country still gets a similar-profile list');
  });

  it('gives a region-"other" country no same-region list but still a similar-profile list', () => {
    const ata = country('ATA', 5.83, { sources: 1, pillars: flat });
    const fixture = [ata, country('JPN', 8.24, { pillars: flat }), country('DEU', 8.36, { pillars: [0.6, 0.5, 0.5, 0.5, 0.5] })];
    const rel = selectRelated(ata, fixture, { neighbours: [], nearby: [] });
    assert.deepEqual(rel.sameRegion, []);
    assert.deepEqual(iso(rel.similarProfile), ['JPN', 'DEU']);
  });
});

// --- profileDistance ---

describe('profileDistance', () => {
  const base = country('AAA', 5.0, { pillars: [0.5, 0.5, 0.5, 0.5, 0.5] });

  it('is the Euclidean distance over the five pillar scores', () => {
    const other = country('BBB', 5.0, { pillars: [0.75, 0.5, 0.5, 0.5, 0.5] });
    assert.equal(profileDistance(base, other), 0.25);
  });

  it('is exact for a 3-4-5 difference across two pillars', () => {
    const a = country('AAA', 0, { pillars: [0, 0, 0, 0, 0] });
    const b = country('BBB', 0, { pillars: [0.3, 0.4, 0, 0, 0] });
    const d = profileDistance(a, b);
    assert.ok(d !== null && Math.abs(d - 0.5) < 1e-12, `expected 0.5, got ${d}`);
  });

  it('counts only pillars present on both sides', () => {
    // b carries only conflict and crime. Its missing pillars must not count as zero.
    const partial = { ...country('BBB', 5.0), pillars: [
      { name: 'conflict', score: 0.8, weight: 0.3, indicators: [], dataCompleteness: 1 },
      { name: 'crime', score: 0.9, weight: 0.25, indicators: [], dataCompleteness: 1 },
    ] } as ScoredCountry;
    const d = profileDistance(base, partial);
    assert.ok(d !== null && Math.abs(d - 0.5) < 1e-12, `expected 0.5 over two shared pillars, got ${d}`);
  });

  it('returns null when the two countries share no pillar', () => {
    const none = { ...country('BBB', 5.0), pillars: [] } as ScoredCountry;
    assert.equal(profileDistance(base, none), null);
  });

  it('is symmetric', () => {
    const other = country('BBB', 5.0, { pillars: [0.1, 0.9, 0.3, 0.7, 0.2] });
    assert.equal(profileDistance(base, other), profileDistance(other, base));
  });
});

// --- determinism ---

describe('determinism', () => {
  it('the same countries in any array order produce identical comparison and related selections', () => {
    const flat: Vec = [0.5, 0.5, 0.5, 0.5, 0.5];
    const world: ScoredCountry[] = [
      country('ECU', 6.0, { pillars: flat }), country('COL', 5.75), country('PER', 6.97),
      country('BRA', 6.5), country('BOL', 5.5), country('VEN', 5.9), country('CHL', 7.66),
      country('JPN', 8.24, { pillars: flat }), country('KOR', 8.06), country('PHL', 6.12),
    ];
    const ecu = find(world, 'ECU');
    const snapshot = (xs: ScoredCountry[]) => {
      const shown = selectComparison(ecu, xs);
      const rel = selectRelated(ecu, xs, shown);
      return {
        neighbours: iso(shown.neighbours), nearby: iso(shown.nearby),
        sameRegion: iso(rel.sameRegion), similar: iso(rel.similarProfile),
        rows: comparisonRows(ecu, shown).map((c) => c.iso3),
      };
    };
    const base = snapshot(world);
    const reordered = [...world].reverse();
    const rotated = [...world.slice(4), ...world.slice(0, 4)];
    assert.deepEqual(snapshot(reordered), base);
    assert.deepEqual(snapshot(rotated), base);
  });
});

// --- invariants on the real dataset (robust to the daily pipeline) ---

describe('real dataset invariants', () => {
  const dataPath = path.join(process.cwd(), 'public', 'scores.json');
  const all: ScoredCountry[] = JSON.parse(fs.readFileSync(dataPath, 'utf8')).countries;
  const byIso3 = new Map(all.map((c) => [c.iso3, c]));

  it('every country gets well-formed selections that respect the data floor, borders and region', () => {
    assert.ok(all.length > 200, 'expected the full 248-country dataset');
    for (const c of all) {
      const cmp = selectComparison(c, all);
      const rel = selectRelated(c, all, cmp);
      const label = c.iso3;

      // Comparison
      for (const n of cmp.neighbours) {
        assert.ok(hasSufficientData(n), `${label}: neighbour ${n.iso3} fails the data floor`);
        assert.ok((borderMap[c.iso3] ?? []).includes(n.iso3), `${label}: ${n.iso3} is not a real border`);
      }
      assert.ok(cmp.neighbours.length <= 6, `${label}: more than 6 neighbours`);
      if (cmp.neighbours.length >= MIN_NEIGHBOURS_BEFORE_FILL) {
        assert.equal(cmp.nearby.length, 0, `${label}: fillers added despite enough neighbours`);
      }
      const region = getRegion(c.iso3);
      for (const f of cmp.nearby) {
        assert.ok(hasSufficientData(f), `${label}: nearby ${f.iso3} fails the data floor`);
        assert.equal(getRegion(f.iso3), region, `${label}: nearby ${f.iso3} is outside the region`);
      }
      const compIso = [...iso(cmp.neighbours), ...iso(cmp.nearby)];
      assert.equal(new Set(compIso).size, compIso.length, `${label}: duplicate in comparison`);
      assert.ok(!compIso.includes(c.iso3), `${label}: lists itself in comparison`);

      // Related
      assert.ok(rel.sameRegion.length <= RELATED_LIST_SIZE && rel.similarProfile.length <= RELATED_LIST_SIZE);
      const relIso = [...iso(rel.sameRegion), ...iso(rel.similarProfile)];
      assert.equal(new Set(relIso).size, relIso.length, `${label}: duplicate in related block`);
      for (const r of relIso) {
        assert.ok(byIso3.has(r), `${label}: unknown country ${r}`);
        assert.ok(hasSufficientData(byIso3.get(r)!), `${label}: related ${r} fails the data floor`);
        assert.ok(r !== c.iso3 && !compIso.includes(r), `${label}: related ${r} is already shown`);
      }
    }
  });

  it('Ecuador never lists a data-poor territory (Antarctica, Aland, Guernsey, Jersey)', () => {
    const ecu = byIso3.get('ECU');
    assert.ok(ecu, 'ECU must be in the dataset');
    const cmp = selectComparison(ecu, all);
    const rel = selectRelated(ecu, all, cmp);
    const shownIso = [...iso(cmp.neighbours), ...iso(cmp.nearby), ...iso(rel.sameRegion), ...iso(rel.similarProfile)];
    for (const code of ['ATA', 'ALA', 'GGY', 'JEY']) {
      const dataPoor = !hasSufficientData(byIso3.get(code)!);
      if (dataPoor) assert.ok(!shownIso.includes(code), `${code} is data-poor and must not appear for ECU`);
    }
    assert.ok(shownIso.length > 0);
  });
});

// --- i18n keys rendered by the comparison section ---

describe('i18n: comparison section keys exist in all seven locales', () => {
  const locales = ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de'] as const;

  it('every locale has the neighbour and nearby headings with a {name} placeholder, and a badge', () => {
    for (const lang of locales) {
      assert.ok(ui[lang]['country.compare_title'].includes('{name}'), `${lang}: compare_title needs {name}`);
      assert.ok(ui[lang]['country.compare_title_nearby'].includes('{name}'), `${lang}: compare_title_nearby needs {name}`);
      assert.ok(ui[lang]['country.compare_nearby'].length > 0, `${lang}: compare_nearby badge is empty`);
    }
  });

  it('German headings carry the {copula} slot, so the verb agrees with plural country names', () => {
    assert.ok(ui.de['country.compare_title'].includes('{copula}'));
    assert.ok(ui.de['country.compare_title_nearby'].includes('{copula}'));
  });
});
