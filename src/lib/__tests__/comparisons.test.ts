/**
 * Tests for src/lib/comparisons.ts (country-page comparison table + related
 * countries block) and the i18n keys those sections render.
 *
 * Fixtures are small and hand-written. Coordinates are rounded approximations of
 * the Wikidata centroids in src/data/country-coords.json, pinned here so the unit
 * tests do not depend on live data. Distances in the comments are haversine values
 * from those coordinates. Real borders come from the real borderMap.
 * The dataset-invariant block at the end does read the real files.
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
  haversineKm,
  coordsOf,
  MIN_NEIGHBOURS_BEFORE_FILL,
  COMPARISON_SIZE,
  RELATED_LIST_SIZE,
  NEARBY_MAX_KM,
  type CoordMap,
} from '../comparisons.js';
import { hasSufficientData } from '../hub-data.js';
import { borderMap } from '../neighbors.js';

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
const flat: Vec = [0.5, 0.5, 0.5, 0.5, 0.5];

// --- Ecuador fixture -------------------------------------------------------
// Distances from ECU (haversine, km): PAN 1101, CRI 1392, VEN 1579, NIC 1739,
// BOL 2287 (beyond the cap), MEX 3740. COL and PER are real borders.
const ECU_COORDS: CoordMap = {
  ECU: [-1, -78],
  COL: [4, -73.25],
  PER: [-9.4, -76],
  PAN: [8.62, -80.37],
  CRI: [10, -84],
  VEN: [8, -67],
  NIC: [13, -85],
  BOL: [-17.06, -64.99],
  MEX: [23, -102],
};

/** Ecuador and its candidates. PAN is the nearest country but fails the data floor. */
function ecuWorld(): ScoredCountry[] {
  return [
    country('ECU', 5.85, { pillars: flat }),
    country('COL', 5.75),
    country('PER', 6.97),
    country('PAN', 6.0, { sources: 1 }),
    country('CRI', 7.2),
    country('VEN', 5.07),
    country('NIC', 5.95),
    country('BOL', 6.73),
    country('MEX', 5.93),
  ];
}

const pointOf = (code: string, coords: CoordMap): [number, number] => {
  const at = coordsOf(code, coords);
  if (!at) throw new Error(`fixture coordinates for ${code} missing`);
  return at;
};

// --- selectComparison: real neighbours -------------------------------------

describe('selectComparison: real neighbours', () => {
  it('uses real neighbours only, capped at the 6 highest scores, and adds no nearby countries at 3 or more', () => {
    // DEU has 9 real borders. The cap keeps the six best-scoring ones.
    const world = [
      country('DEU', 8.36),
      country('DNK', 8.75), country('CHE', 8.71), country('LUX', 8.7), country('CZE', 8.57),
      country('AUT', 8.48), country('BEL', 8.36), country('NLD', 8.2), country('FRA', 7.9), country('POL', 7.0),
      country('ITA', 9.0), // not a neighbour of Germany, however high it scores
      country('JPN', 8.36), // not a neighbour either
    ];
    const sel = selectComparison(find(world, 'DEU'), world, {});
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
    const sel = selectComparison(find(world, 'FRA'), world, {});
    assert.deepEqual(iso(sel.neighbours), ['ESP', 'ITA', 'CHE', 'DEU', 'LUX', 'BEL']);
    assert.deepEqual(sel.nearby, []);
  });

  it('applies the fill threshold exactly: 3 data-sufficient neighbours means no fill', () => {
    // ESP borders FRA, PRT, AND (3 sources, filtered) and MAR: three remain.
    const world = [
      country('ESP', 7.0),
      country('FRA', 7.9), country('PRT', 7.5), country('MAR', 5.0),
      country('AND', 7.9, { sources: 3 }),
      country('ITA', 7.01), // nearby by score, but not needed
    ];
    assert.equal(MIN_NEIGHBOURS_BEFORE_FILL, 3);
    const sel = selectComparison(find(world, 'ESP'), world, {});
    assert.equal(sel.neighbours.length, 3);
    assert.deepEqual(sel.nearby, []);
  });
});

// --- selectComparison: nearby fill by distance -----------------------------

describe('selectComparison: nearby fill by great-circle distance', () => {
  it('fills with the nearest data-sufficient countries, not the closest in score or the same region', () => {
    const world = ecuWorld();
    const sel = selectComparison(find(world, 'ECU'), world, ECU_COORDS);
    assert.deepEqual(iso(sel.neighbours), ['PER', 'COL']);
    // CRI (1392 km) and VEN (1579 km). PAN is data-poor, BOL is beyond 2000 km,
    // and MEX and NIC are excluded by distance even though they are closest in score.
    assert.deepEqual(iso(sel.nearby), ['CRI', 'VEN']);
    assert.equal(sel.neighbours.length + sel.nearby.length, COMPARISON_SIZE);

    // The ordering the assertions rely on, stated explicitly.
    const d = (code: string): number => haversineKm(pointOf('ECU', ECU_COORDS), pointOf(code, ECU_COORDS));
    assert.ok(d('CRI') < d('VEN') && d('VEN') < d('NIC') && d('NIC') < NEARBY_MAX_KM);
    assert.ok(d('BOL') > NEARBY_MAX_KM, 'BOL must sit beyond the cap for this fixture to mean anything');
  });

  it('takes as many fillers as are missing to reach COMPARISON_SIZE others', () => {
    // Only one real neighbour (COL), so three fillers are needed.
    const world = ecuWorld().filter((c) => c.iso3 !== 'PER');
    const sel = selectComparison(find(world, 'ECU'), world, ECU_COORDS);
    assert.deepEqual(iso(sel.neighbours), ['COL']);
    assert.deepEqual(iso(sel.nearby), ['CRI', 'VEN', 'NIC']);
    assert.equal(COMPARISON_SIZE, 4);
  });

  it('real borders are never fillers, even when they are the nearest countries', () => {
    // Panama borders Costa Rica (427 km, the nearest of all) and Colombia (940 km).
    // Both are real borders, so neither may be a filler. The nearest non-borders are NIC (702 km) and ECU (1101 km).
    const world = [
      country('PAN', 6.0),
      country('CRI', 7.2), country('COL', 5.75),
      country('NIC', 5.95), country('ECU', 5.85), country('VEN', 5.07),
    ];
    const sel = selectComparison(find(world, 'PAN'), world, ECU_COORDS);
    assert.deepEqual(iso(sel.neighbours), ['CRI', 'COL']);
    assert.deepEqual(iso(sel.nearby), ['NIC', 'ECU']);
  });

  it('a candidate without coordinates is never a filler', () => {
    // XNC is sufficient and only ~500 km from Ecuador, but has no coordinates entry.
    const world = [...ecuWorld(), country('XNC', 5.9)];
    const sel = selectComparison(find(world, 'ECU'), world, ECU_COORDS);
    assert.deepEqual(iso(sel.nearby), ['CRI', 'VEN']);
  });

  it('a subject without coordinates keeps its real neighbours and gets no fillers', () => {
    const world = ecuWorld();
    const coordsWithoutEcu: CoordMap = { ...ECU_COORDS, ECU: undefined };
    const sel = selectComparison(find(world, 'ECU'), world, coordsWithoutEcu);
    assert.deepEqual(iso(sel.neighbours), ['PER', 'COL']);
    assert.deepEqual(sel.nearby, []);
  });

  it('when nothing qualifies within the cap, only the real neighbours are kept', () => {
    // New Zealand borders Australia and Fiji. Every other country is more than 2000 km away.
    const coords: CoordMap = {
      NZL: [-41.2, 174], AUS: [-25, 133], FJI: [-18, 178], ARG: [-38, -63], ZAF: [-29, 24],
    };
    const world = [
      country('NZL', 8.0), country('AUS', 7.5), country('FJI', 6.4),
      country('ARG', 7.0), country('ZAF', 6.9),
    ];
    const sel = selectComparison(find(world, 'NZL'), world, coords);
    assert.deepEqual(iso(sel.neighbours), ['AUS', 'FJI']);
    assert.deepEqual(sel.nearby, []);
  });

  it('a country with no neighbours and nothing within the cap has an empty comparison', () => {
    // Antarctica (ATA) sits at the pole. The sub-Antarctic islands are thousands of km away.
    const coords: CoordMap = { ATA: [-90, 0], SGS: [-54.5, -36.6] };
    const world = [country('ATA', 5.8, { sources: 1 }), country('SGS', 5.5, { sources: 5 })];
    const sel = selectComparison(find(world, 'ATA'), world, coords);
    assert.deepEqual(sel.neighbours, []);
    assert.deepEqual(sel.nearby, []);
  });

  it('breaks equal distances by iso3, whatever the input order', () => {
    // ZZA and ZZB are both exactly one degree of arc from AAA, so their distances are equal.
    const coords: CoordMap = { AAA: [0, 0], ZZB: [0, 1], ZZA: [1, 0] };
    const world = [country('AAA', 5.0), country('ZZB', 5.0), country('ZZA', 5.0)];
    const forward = selectComparison(find(world, 'AAA'), world, coords);
    const reversed = selectComparison(find(world, 'AAA'), [...world].reverse(), coords);
    assert.deepEqual(iso(forward.nearby), ['ZZA', 'ZZB']);
    assert.deepEqual(iso(reversed.nearby), ['ZZA', 'ZZB']);
  });

  it('a data-poor subject still gets its comparison, and the nearest countries are chosen, not Serbia or Georgia', () => {
    // XAL stands in for Aland at Aland's coordinates, with no border entry and 0 sources. Distances
    // from it (km): SWE 285, EST 365, LVA 463, FIN 637, DNK 753, SRB 1808, GEO 2544. XDP is 0-source
    // and nearest of all, so it is excluded.
    const coords: CoordMap = {
      XAL: [60.25, 20], SWE: [61, 15], EST: [59, 26], LVA: [57, 25], FIN: [65, 27],
      DNK: [56, 10], SRB: [44, 21], GEO: [42.3, 43.4], XDP: [60.5, 21.5],
    };
    const world = [
      country('XAL', 5.9, { sources: 0 }),
      country('SWE', 8.3), country('EST', 7.0), country('LVA', 6.8), country('FIN', 8.8),
      country('DNK', 8.8), country('SRB', 7.5), country('GEO', 7.4),
      country('XDP', 5.9, { sources: 0 }),
    ];
    const sel = selectComparison(find(world, 'XAL'), world, coords);
    assert.deepEqual(sel.neighbours, []);
    assert.deepEqual(iso(sel.nearby), ['SWE', 'EST', 'LVA', 'FIN']);
  });

  it('Aland lists Finland and Sweden as real neighbours and the nearest other countries as nearby', () => {
    // borderMap gives ALA -> FIN, SWE. Both pass the floor, so only two fillers are needed.
    const coords: CoordMap = {
      ALA: [60.25, 20], FIN: [65, 27], SWE: [61, 15], EST: [59, 26], LVA: [57, 25], DNK: [56, 10],
    };
    const world = [
      country('ALA', 5.9, { sources: 0 }),
      country('FIN', 8.8), country('SWE', 8.3), country('EST', 7.0), country('LVA', 6.8), country('DNK', 8.8),
    ];
    const sel = selectComparison(find(world, 'ALA'), world, coords);
    assert.deepEqual(iso(sel.neighbours), ['FIN', 'SWE']);
    assert.deepEqual(iso(sel.nearby), ['EST', 'LVA']);
  });
});

// --- coordsOf and haversineKm ----------------------------------------------

describe('haversineKm and coordsOf', () => {
  it('one degree of longitude on the equator is about 111.2 km', () => {
    assert.ok(Math.abs(haversineKm([0, 0], [0, 1]) - 111.195) < 0.05);
  });

  it('is symmetric, zero for identical points, and half the circumference for antipodes', () => {
    const a: [number, number] = [-1, -78];
    const b: [number, number] = [8.62, -80.37];
    assert.equal(haversineKm(a, b), haversineKm(b, a));
    assert.equal(haversineKm(a, a), 0);
    assert.ok(Math.abs(haversineKm([0, 0], [0, 180]) - Math.PI * 6371) < 0.5);
  });

  it('Ecuador to Panama is well inside the cap, and Ecuador to Bolivia is beyond it', () => {
    const ecu = pointOf('ECU', ECU_COORDS);
    assert.ok(haversineKm(ecu, pointOf('PAN', ECU_COORDS)) < 1150);
    assert.ok(haversineKm(ecu, pointOf('BOL', ECU_COORDS)) > NEARBY_MAX_KM);
  });

  it('returns null for missing, non-finite, out-of-range or wrong-length entries', () => {
    const coords: CoordMap = {
      OK: [1, 2], NAN: [Number.NaN, 5], LAT: [91, 0], LON: [0, 181], SHORT: [1], LONG: [1, 2, 3], NONE: undefined,
    };
    assert.deepEqual(coordsOf('OK', coords), [1, 2]);
    for (const bad of ['NAN', 'LAT', 'LON', 'SHORT', 'LONG', 'NONE', 'MISSING', 'constructor']) {
      assert.equal(coordsOf(bad, coords), null, `${bad} must read as no coordinates`);
    }
  });
});

// --- selectRelated ---------------------------------------------------------

describe('selectRelated', () => {
  // Ecuador with its comparison: neighbours COL and PER, nearby CRI and VEN.
  // Same region (Americas), data-sufficient and not shown: MEX (gap 0.08), NIC (0.10), BOL (0.88).
  // Similar profile (Ecuador is flat 0.5): JPN (0), PHL (0.14), KOR (0.30), CHN (0.40).
  // TWN is data-poor and PAN is data-poor, so neither may appear.
  function ecuRelatedWorld(): ScoredCountry[] {
    return [
      ...ecuWorld(),
      country('JPN', 8.24, { pillars: flat }),
      country('TWN', 7.57, { sources: 1, pillars: flat }),
      country('KOR', 8.06, { pillars: [0.8, 0.5, 0.5, 0.5, 0.5] }),
      country('PHL', 6.12, { pillars: [0.6, 0.6, 0.5, 0.5, 0.5] }),
      country('CHN', 6.83, { pillars: [0.5, 0.5, 0.5, 0.5, 0.9] }),
    ];
  }

  it('excludes self, data-poor countries and anything the comparison already shows', () => {
    const world = ecuRelatedWorld();
    const ecu = find(world, 'ECU');
    const shown = selectComparison(ecu, world, ECU_COORDS);
    const rel = selectRelated(ecu, world, shown);
    assert.deepEqual(iso(shown.neighbours), ['PER', 'COL']);
    assert.deepEqual(iso(shown.nearby), ['CRI', 'VEN']);
    assert.deepEqual(iso(rel.sameRegion), ['MEX', 'NIC', 'BOL']);
    assert.deepEqual(iso(rel.similarProfile), ['JPN', 'PHL', 'KOR']);
    const all = [...iso(rel.sameRegion), ...iso(rel.similarProfile)];
    for (const banned of ['ECU', 'COL', 'PER', 'CRI', 'VEN', 'PAN', 'TWN']) {
      assert.ok(!all.includes(banned), `${banned} must not appear in the related block`);
    }
    assert.equal(new Set(all).size, all.length, 'no country may appear twice');
  });

  it('keeps each list at RELATED_LIST_SIZE or fewer', () => {
    assert.equal(RELATED_LIST_SIZE, 3);
    const world = ecuRelatedWorld();
    const ecu = find(world, 'ECU');
    const rel = selectRelated(ecu, world, selectComparison(ecu, world, ECU_COORDS));
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
    const none = { neighbours: [], nearby: [] };
    const forward = selectRelated(ecu, ties, none);
    const reversed = selectRelated(ecu, [...ties].reverse(), none);
    assert.deepEqual(iso(forward.similarProfile), ['DEU', 'FRA', 'NLD']);
    assert.deepEqual(iso(reversed.similarProfile), ['DEU', 'FRA', 'NLD']);
  });

  it('a data-poor subject keeps its same-region list but gets no similar-profile list', () => {
    // Aland fails the floor. Its prior-driven pillars would be compared with real profiles, so none are produced.
    const coords: CoordMap = {
      ALA: [60.25, 20], SWE: [61, 15], EST: [59, 26], LVA: [57, 25], FIN: [65, 27],
      DNK: [56, 10], ITA: [41.9, 12.5], ESP: [40.4, -3.7], GBR: [54, -2], DEU: [51, 10],
    };
    const world = [
      country('ALA', 5.89, { sources: 0 }),
      country('SWE', 8.3), country('EST', 7.0), country('LVA', 6.8), country('FIN', 8.8),
      country('DNK', 8.8), country('ITA', 8.12), country('ESP', 8.26), country('GBR', 8.31), country('DEU', 8.36),
    ];
    const ala = find(world, 'ALA');
    const rel = selectRelated(ala, world, selectComparison(ala, world, coords));
    assert.equal(rel.sameRegion.length, RELATED_LIST_SIZE, 'a data-poor subject still gets a same-region list');
    assert.deepEqual(rel.similarProfile, [], 'a data-poor subject gets no similar-profile list');
  });

  it('a region-"other" country gets no same-region list but still a similar-profile list', () => {
    // Sufficient-data subject, so the similar list is produced. Its region is "other".
    const ata = country('ATA', 5.83, { sources: 4, pillars: flat });
    const fixture = [ata, country('JPN', 8.24, { pillars: flat }), country('DEU', 8.36, { pillars: [0.6, 0.5, 0.5, 0.5, 0.5] })];
    const rel = selectRelated(ata, fixture, { neighbours: [], nearby: [] });
    assert.deepEqual(rel.sameRegion, []);
    assert.deepEqual(iso(rel.similarProfile), ['JPN', 'DEU']);
  });
});

// --- profileDistance -------------------------------------------------------

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

// --- determinism -----------------------------------------------------------

describe('determinism', () => {
  it('the same countries in any array order produce identical comparison and related selections', () => {
    const world: ScoredCountry[] = [
      country('ECU', 6.0, { pillars: flat }), country('COL', 5.75), country('PER', 6.97),
      country('CRI', 6.5), country('VEN', 5.5), country('PAN', 7.9),
      country('JPN', 8.24, { pillars: flat }), country('KOR', 8.06), country('PHL', 6.12),
    ];
    const ecu = find(world, 'ECU');
    const snapshot = (xs: ScoredCountry[]) => {
      const shown = selectComparison(ecu, xs, ECU_COORDS);
      const rel = selectRelated(ecu, xs, shown);
      return {
        neighbours: iso(shown.neighbours), nearby: iso(shown.nearby),
        sameRegion: iso(rel.sameRegion), similar: iso(rel.similarProfile),
        rows: comparisonRows(ecu, shown).map((c) => c.iso3),
      };
    };
    const base = snapshot(world);
    assert.deepEqual(snapshot([...world].reverse()), base);
    assert.deepEqual(snapshot([...world.slice(4), ...world.slice(0, 4)]), base);
  });
});

// --- invariants on the real dataset (robust to the daily pipeline) ----------

describe('real dataset invariants', () => {
  const root = process.cwd();
  const all: ScoredCountry[] = JSON.parse(fs.readFileSync(path.join(root, 'public', 'scores.json'), 'utf8')).countries;
  const coords: CoordMap = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'country-coords.json'), 'utf8'));
  const byIso3 = new Map(all.map((c) => [c.iso3, c]));

  it('every country gets well-formed selections: data floor, real borders, distance cap, order and exclusions', () => {
    assert.ok(all.length > 200, 'expected the full dataset');
    for (const c of all) {
      const label = c.iso3;
      const cmp = selectComparison(c, all, coords);
      const rel = selectRelated(c, all, cmp);
      const bordering = new Set<string>(borderMap[c.iso3] ?? []);

      for (const n of cmp.neighbours) {
        assert.ok(hasSufficientData(n), `${label}: neighbour ${n.iso3} fails the data floor`);
        assert.ok(bordering.has(n.iso3), `${label}: ${n.iso3} is not a real border`);
      }
      assert.ok(cmp.neighbours.length <= 6, `${label}: more than 6 neighbours`);
      if (cmp.neighbours.length >= MIN_NEIGHBOURS_BEFORE_FILL) {
        assert.equal(cmp.nearby.length, 0, `${label}: fillers added despite enough neighbours`);
      }
      assert.ok(
        cmp.nearby.length <= Math.max(0, COMPARISON_SIZE - cmp.neighbours.length),
        `${label}: too many fillers`,
      );

      const subject = coordsOf(c.iso3, coords);
      if (cmp.nearby.length > 0) assert.ok(subject, `${label}: fillers without subject coordinates`);
      let lastKm = -Infinity;
      for (const f of cmp.nearby) {
        assert.ok(hasSufficientData(f), `${label}: nearby ${f.iso3} fails the data floor`);
        assert.ok(!bordering.has(f.iso3) && f.iso3 !== c.iso3, `${label}: ${f.iso3} is a border or self`);
        const at = coordsOf(f.iso3, coords);
        assert.ok(at, `${label}: nearby ${f.iso3} has no coordinates`);
        const km = haversineKm(subject!, at!);
        assert.ok(km <= NEARBY_MAX_KM, `${label}: nearby ${f.iso3} is ${km.toFixed(0)} km away`);
        assert.ok(km >= lastKm, `${label}: nearby countries not in distance order`);
        lastKm = km;
      }

      const shown = new Set<string>([c.iso3, ...iso(cmp.neighbours), ...iso(cmp.nearby)]);
      const relIso = [...iso(rel.sameRegion), ...iso(rel.similarProfile)];
      assert.equal(new Set(relIso).size, relIso.length, `${label}: duplicate in related block`);
      assert.ok(rel.sameRegion.length <= RELATED_LIST_SIZE && rel.similarProfile.length <= RELATED_LIST_SIZE);
      for (const r of relIso) {
        assert.ok(byIso3.has(r), `${label}: unknown country ${r}`);
        assert.ok(hasSufficientData(byIso3.get(r)!), `${label}: related ${r} fails the data floor`);
        assert.ok(!shown.has(r), `${label}: related ${r} is already shown`);
      }
      if (!hasSufficientData(c)) {
        assert.equal(rel.similarProfile.length, 0, `${label}: similar-profile list shown for a data-poor subject`);
      }
    }
  });

  it('the coordinates file has one valid [lat, lon] per country, rounded to 2 decimals', () => {
    const entries = Object.entries(coords);
    assert.ok(entries.length >= 240, `expected coverage for the 248 countries, found ${entries.length}`);
    for (const [code, value] of entries) {
      assert.match(code, /^[A-Z]{3}$/, `${code}: not an ISO3 key`);
      assert.ok(coordsOf(code, coords), `${code}: malformed entry`);
      for (const v of value!) {
        assert.equal(Math.round(v * 100) / 100, v, `${code}: ${v} is not rounded to 2 decimals`);
      }
    }
  });

  it('Ecuador never lists a data-poor territory (Antarctica, Aland, Guernsey, Jersey)', () => {
    const ecu = byIso3.get('ECU');
    assert.ok(ecu, 'ECU must be in the dataset');
    const cmp = selectComparison(ecu, all, coords);
    const rel = selectRelated(ecu, all, cmp);
    const shownIso = [...iso(cmp.neighbours), ...iso(cmp.nearby), ...iso(rel.sameRegion), ...iso(rel.similarProfile)];
    for (const code of ['ATA', 'ALA', 'GGY', 'JEY']) {
      const dataPoor = !hasSufficientData(byIso3.get(code)!);
      if (dataPoor) assert.ok(!shownIso.includes(code), `${code} is data-poor and must not appear for ECU`);
    }
    assert.ok(shownIso.length > 0);
  });
});

// --- i18n keys rendered by the comparison section ---------------------------

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
