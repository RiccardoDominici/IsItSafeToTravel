/**
 * Tests for src/lib/comparisons.ts (country-page comparison table + related
 * countries block) and the i18n keys those sections render.
 *
 * Geography is the real committed data: land borders and sovereign states
 * (src/lib/neighbors.ts), coast-or-border distances (src/data/country-proximity.json)
 * and Wikidata points (src/data/country-coords.json). Scores are fixtures, so the
 * tests do not move with the daily pipeline; the dataset-invariant block at the end
 * reads the real scores.
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
  comparisonPillarCells,
  roundDistanceKm,
  proximityKm,
  MIN_NEIGHBOURS_BEFORE_FILL,
  COMPARISON_SIZE,
  RELATED_LIST_SIZE,
  NEARBY_MAX_KM,
  MIN_ROWS_REMOTE,
  REMOTE_MAX_KM,
  type ComparisonSelection,
  type Geography,
  type ProximityMap,
} from '../comparisons.js';
import { hasSufficientData } from '../hub-data.js';
import { landBorders, getLandNeighbours, getSovereignState } from '../neighbors.js';
import { getSubregion } from '../subregions.js';
import { isEstimatedPillar } from '../pillar-presentation.js';

const root = process.cwd();
const readJson = <T>(...parts: string[]): T => JSON.parse(fs.readFileSync(path.join(root, ...parts), 'utf8')) as T;
const GEO: Geography = {
  proximity: readJson('src', 'data', 'country-proximity.json'),
  coords: readJson('src', 'data', 'country-coords.json'),
};

const PILLAR_NAMES = ['conflict', 'crime', 'health', 'governance', 'environment'] as const;
type Vec = [number, number, number, number, number];

/** Fixture country. Pillars default to a flat profile at score/10; `grey` makes it a formula-v10 grey place. */
function country(iso3: string, score: number, opts: { grey?: boolean; pillars?: Vec } = {}): ScoredCountry {
  const flat = score / 10;
  const vec: Vec = opts.pillars ?? [flat, flat, flat, flat, flat];
  const pillars: PillarScore[] = PILLAR_NAMES.map((name, i) => ({
    name,
    score: vec[i],
    weight: 0.2,
    indicators: [],
    dataCompleteness: 1,
  }));
  const sources = Array.from({ length: opts.grey ? 2 : 4 }, (_, i) => ({
    name: `src-${i}`,
    url: 'https://example.test/',
    fetchedAt: '2026-10-15T00:00:00Z',
    description: 'fixture',
  }));
  return {
    iso3,
    name: { en: iso3, it: iso3, es: iso3, fr: iso3, pt: iso3 },
    score: opts.grey ? null : score,
    scoreDisplay: opts.grey ? null : Math.round(score),
    ...(opts.grey ? { scoreStatus: 'insufficient_data' } : {}),
    pillars,
    advisories: {},
    dataCompleteness: 1,
    confidence: 1,
    lastUpdated: '2026-10-15T00:00:00Z',
    sources,
  } as unknown as ScoredCountry;
}

/**
 * Every place on the site, scored 6.0 unless `scores` says otherwise; codes in `grey` have no score.
 * The real geography decides everything else.
 */
function world(scores: Record<string, number> = {}, grey: readonly string[] = []): ScoredCountry[] {
  const greySet = new Set(grey);
  return Object.keys(landBorders).map((iso3) => country(iso3, scores[iso3] ?? 6.0, { grey: greySet.has(iso3) }));
}

const find = (xs: ScoredCountry[], code: string): ScoredCountry => {
  const hit = xs.find((c) => c.iso3 === code);
  if (!hit) throw new Error(`fixture ${code} missing`);
  return hit;
};
const others = (sel: ComparisonSelection): string[] => sel.others.map((r) => r.country.iso3);
const iso = (xs: ScoredCountry[]): string[] => xs.map((c) => c.iso3);
const select = (xs: ScoredCountry[], code: string): ComparisonSelection => selectComparison(find(xs, code), xs, GEO);
const flat: Vec = [0.5, 0.5, 0.5, 0.5, 0.5];

// --- land neighbours ---------------------------------------------------------

describe('selectComparison: land neighbours (I09)', () => {
  it('China shows all 16 land neighbours, the riskiest included, never capped or filtered by score', () => {
    const xs = world({ AFG: 3.6, MMR: 4.1, RUS: 4.1, PRK: 4.8, PAK: 5.1, MNG: 7.5, BTN: 7.9 }, ['HKG', 'MAC']);
    const sel = select(xs, 'CHN');
    assert.deepEqual([...others(sel)].sort(), [...getLandNeighbours('CHN')].sort());
    for (const risky of ['AFG', 'MMR', 'RUS', 'PRK', 'PAK']) assert.ok(others(sel).includes(risky), `CHN must show ${risky}`);
    assert.ok(sel.others.every((r) => r.relation === 'land' && r.km === 0));
  });

  it('Brazil shows Bolivia, Colombia and Venezuela, and grey French Guiana', () => {
    const sel = select(world({ BOL: 6.5, COL: 5.9, VEN: 4.8 }, ['GUF']), 'BRA');
    assert.equal(sel.others.length, 10);
    for (const code of ['BOL', 'COL', 'VEN', 'GUF']) assert.ok(others(sel).includes(code), `BRA must show ${code}`);
  });

  it('DR Congo shows all 9, the Central African Republic and South Sudan included', () => {
    const sel = select(world({ CAF: 3.7, SSD: 3.4 }), 'COD');
    assert.deepEqual([...others(sel)].sort(), ['AGO', 'BDI', 'CAF', 'COG', 'RWA', 'SSD', 'TZA', 'UGA', 'ZMB']);
  });

  it('orders rows by distance, not score: the order does not change when the scores do', () => {
    const a = others(select(world({ AFG: 3.6, MNG: 7.5 }), 'CHN'));
    const b = others(select(world({ AFG: 9.0, MNG: 1.5 }), 'CHN'));
    assert.deepEqual(a, b);
  });

  it('keeps grey land neighbours (shown as "Partial data") and adds no fillers at 3 or more', () => {
    const sel = select(world({}, ['AND', 'MCO']), 'FRA');
    assert.ok(others(sel).includes('AND') && others(sel).includes('MCO'));
    assert.ok(sel.others.every((r) => r.relation === 'land'));
    assert.ok(getLandNeighbours('FRA').length >= MIN_NEIGHBOURS_BEFORE_FILL);
  });

  it('Germany shows its 9 neighbours and nothing across the sea', () => {
    const sel = select(world(), 'DEU');
    assert.deepEqual([...others(sel)].sort(), ['AUT', 'BEL', 'CHE', 'CZE', 'DNK', 'FRA', 'LUX', 'NLD', 'POL']);
  });
});

// --- across-sea rows -------------------------------------------------------

describe('selectComparison: across-sea places and sovereign states (I35, I37)', () => {
  it('fills an island with the nearest places by coast distance, each labelled with its distance', () => {
    const sel = select(world(), 'MLT');
    assert.deepEqual(others(sel), ['ITA', 'TUN', 'LBY', 'DZA']);
    assert.ok(sel.others.every((r) => r.relation === 'sea'));
    const km = sel.others.map((r) => r.km);
    assert.deepEqual(km, [...km].sort((x, y) => x - y), 'nearest first');
    assert.ok(km[0] < 100, `Malta-Sicily is under 100 km, got ${km[0]}`);
  });

  it('adds Korea-China and Timor-Leste-Australia by distance', () => {
    assert.deepEqual(others(select(world(), 'KOR')), ['PRK', 'JPN', 'CHN', 'RUS']);
    assert.deepEqual(others(select(world(), 'TLS')), ['IDN', 'AUS']);
  });

  it('Kuwait gets Iran across the Gulf; Aruba gets Venezuela and Colombia', () => {
    assert.ok(others(select(world(), 'KWT')).includes('IRN'));
    const abw = others(select(world(), 'ABW'));
    assert.equal(abw[0], 'VEN');
    assert.ok(abw.includes('COL'));
  });

  it('a territory shows its sovereign state, however far, labelled with its distance', () => {
    // Guernsey (grey, 19 km) is skipped as a filler; France is the nearest scored place, the UK the sovereign.
    const jey = select(world({}, ['GGY']), 'JEY');
    assert.deepEqual(others(jey).slice(0, 2), ['FRA', 'GBR']);
    const reu = select(world(), 'REU');
    const fra = reu.others.find((r) => r.country.iso3 === 'FRA');
    assert.ok(fra && fra.relation === 'sea' && fra.km > 8000, 'Réunion lists France, ~9,000 km away');
    assert.equal(reu.others.at(-1)?.country.iso3, 'FRA', 'the far sovereign sorts last');
    const sjm = others(select(world(), 'SJM'));
    assert.ok(sjm.includes('NOR'), 'Svalbard lists Norway');
    const esh = others(select(world(), 'ESH'));
    assert.ok(esh.includes('DZA'), 'Western Sahara lists Algeria');
    const guf = others(select(world(), 'GUF'));
    assert.ok(guf.includes('BRA') && guf.includes('FRA'), 'French Guiana lists Brazil and France');
  });

  it('fillers must have an official score and lie within NEARBY_MAX_KM', () => {
    // Iceland: Greenland, Faroe and Svalbard are nearer than the UK, but grey places carry no numbers to compare.
    const sel = select(world({}, ['GRL', 'FRO', 'SJM']), 'ISL');
    assert.deepEqual(others(sel), ['GBR', 'NOR']);
    assert.ok(sel.others.every((r) => r.km <= NEARBY_MAX_KM));
    // Same place, Greenland scored: it is the nearest and comes in first.
    assert.equal(others(select(world({}, ['FRO', 'SJM']), 'ISL'))[0], 'GRL');
  });

  it('caps the fill at COMPARISON_SIZE rows', () => {
    assert.equal(COMPARISON_SIZE, 4);
    for (const code of ['MLT', 'CYP', 'JPN', 'ALA', 'GBR']) {
      assert.ok(select(world(), code).others.length <= COMPARISON_SIZE, `${code}: too many rows`);
    }
  });

  it('a remote island reaches MIN_ROWS_REMOTE rows from farther away (New Zealand)', () => {
    const sel = select(world({}, ['NFK', 'NCL']), 'NZL');
    assert.equal(sel.others.length, MIN_ROWS_REMOTE);
    assert.equal(others(sel)[0], 'AUS');
    assert.ok(sel.others.every((r) => r.km > NEARBY_MAX_KM && r.km <= REMOTE_MAX_KM));
  });

  it('a place with no geography entry gets land neighbours and sovereign only', () => {
    const geo: Geography = { proximity: {}, coords: {} };
    const xs = world();
    const sel = selectComparison(find(xs, 'JEY'), xs, geo);
    assert.deepEqual(others(sel), ['GBR']);
    assert.equal(sel.others[0].km, Infinity);
  });
});

// --- comparisonRows, labels, lookups ---------------------------------------

describe('comparisonRows, roundDistanceKm, proximityKm', () => {
  it('puts the place itself first, then the selection in order', () => {
    const xs = world({}, ['ALA']);
    const ala = find(xs, 'ALA');
    const sel = selectComparison(ala, xs, GEO);
    const rows = comparisonRows(ala, sel);
    assert.equal(rows[0].country.iso3, 'ALA');
    assert.equal(rows[0].relation, 'self');
    assert.deepEqual(rows.slice(1).map((r) => r.country.iso3), others(sel));
    assert.equal(others(sel)[0], 'FIN');
  });

  it('rounds the label to what the measure supports', () => {
    assert.equal(roundDistanceKm(0.4), 1);
    assert.equal(roundDistanceKm(4), 4);
    assert.equal(roundDistanceKm(82), 80);
    assert.equal(roundDistanceKm(286), 290);
    assert.equal(roundDistanceKm(8366), 8400);
  });

  it('looks a pair up in either direction, and returns null when neither side stores it', () => {
    const p: ProximityMap = { AAA: { BBB: 12 }, CCC: {} };
    assert.equal(proximityKm('AAA', 'BBB', p), 12);
    assert.equal(proximityKm('BBB', 'AAA', p), 12);
    assert.equal(proximityKm('AAA', 'CCC', p), null);
    assert.equal(proximityKm('ZZZ', 'AAA', p), null);
  });
});

// --- pillar cells -----------------------------------------------------------

describe('comparisonPillarCells: estimated pillars show no number (I31 rule, as the pillar bars)', () => {
  const names = ['conflict', 'crime', 'health', 'governance', 'environment'] as const;
  const real: ScoredCountry[] = readJson<{ countries: ScoredCountry[] }>('public', 'scores.json').countries;

  it('a pillar with nothing measured (or missing) is null, a measured one is its score out of 10', () => {
    const c = country('AAA', 6.0);
    const conflict = c.pillars.find((p) => p.name === 'conflict')!;
    const crime = c.pillars.find((p) => p.name === 'crime')!;
    assert.equal(isEstimatedPillar(conflict), false, 'fixture: advisory slot counts as measured');
    assert.equal(isEstimatedPillar(crime), true, 'fixture: no crime indicator');
    const withoutHealth = { ...c, pillars: c.pillars.filter((p) => p.name !== 'health') } as ScoredCountry;
    const cells = comparisonPillarCells(withoutHealth, names);
    assert.deepEqual(cells.map((x) => x.name), [...names]);
    assert.equal(cells[0].score10, conflict.score * 10);
    assert.equal(cells[1].score10, null);
    assert.equal(cells[2].score10, null, 'a missing pillar is not 0.0');
  });

  it('on the real data: null exactly for the estimated pillars (Nauru crime), numbers elsewhere', () => {
    for (const c of real) {
      for (const cell of comparisonPillarCells(c, names)) {
        const pillar = c.pillars.find((p) => p.name === cell.name);
        const estimated = !pillar || isEstimatedPillar(pillar);
        assert.equal(cell.score10 === null, estimated, `${c.iso3}/${cell.name}`);
      }
    }
    const nru = real.find((c) => c.iso3 === 'NRU');
    if (nru && nru.pillars.some((p) => p.name === 'crime' && isEstimatedPillar(p))) {
      assert.equal(comparisonPillarCells(nru, ['crime'])[0].score10, null);
    }
  });
});

// --- selectRelated ---------------------------------------------------------

describe('selectRelated (I33)', () => {
  const related = (xs: ScoredCountry[], code: string) => {
    const c = find(xs, code);
    return selectRelated(c, xs, selectComparison(c, xs, GEO), GEO);
  };

  it('picks the nearest places in the M49 sub-region, then shows them by score', () => {
    const xs = world({ IND: 6.0, NPL: 6.8, BTN: 7.9, PRK: 4.8, MMR: 4.1 });
    const rel = related(xs, 'AFG');
    assert.deepEqual([...iso(rel.sameRegion)].sort(), ['BTN', 'IND', 'NPL']);
    assert.deepEqual(iso(rel.sameRegion), ['BTN', 'NPL', 'IND'], 'displayed by score, highest first');
    for (const r of rel.sameRegion) assert.equal(getSubregion(r.iso3), 'southern_asia');
  });

  it('no longer pairs Laos with Central Asia or Algeria with Zambia', () => {
    const xs = world();
    const lao = iso(related(xs, 'LAO').sameRegion);
    assert.ok(!lao.includes('TJK') && !lao.includes('TKM'));
    assert.deepEqual([...iso(related(xs, 'DZA').sameRegion)].sort(), ['EGY', 'SDN']);
  });

  it('excludes self, grey places and anything the table shows; no place twice', () => {
    const xs = world({}, ['XKX']);
    const alb = find(xs, 'ALB');
    const shown = selectComparison(alb, xs, GEO);
    const rel = selectRelated(alb, xs, shown, GEO);
    const all = [...iso(rel.sameRegion), ...iso(rel.similarProfile)];
    for (const banned of ['ALB', 'XKX', ...others(shown)]) assert.ok(!all.includes(banned), `${banned} must not appear`);
    assert.equal(new Set(all).size, all.length);
    assert.ok(rel.sameRegion.length <= RELATED_LIST_SIZE && rel.similarProfile.length <= RELATED_LIST_SIZE);
  });

  it('a grey subject gets no related block at all', () => {
    const rel = related(world({}, ['ALA']), 'ALA');
    assert.deepEqual(rel, { sameRegion: [], similarProfile: [] });
  });

  it('a place without a sub-region gets no same-region list but still a similar-profile list', () => {
    const xs = [country('ATA', 5.8, { pillars: flat }), country('JPN', 8.2, { pillars: flat }), country('DEU', 8.4, { pillars: [0.6, 0.5, 0.5, 0.5, 0.5] })];
    const rel = selectRelated(xs[0], xs, { others: [] }, GEO);
    assert.deepEqual(rel.sameRegion, []);
    assert.deepEqual(iso(rel.similarProfile), ['JPN', 'DEU']);
  });

  it('ranks similar profiles by Euclidean distance, ties by iso3, whatever the input order', () => {
    const ties = [
      country('ECU', 6.0, { pillars: flat }),
      country('GBR', 6.0, { pillars: [1.0, 0.5, 0.5, 0.5, 0.5] }),
      country('NLD', 6.0, { pillars: [0.5, 0.5, 0.75, 0.5, 0.5] }),
      country('FRA', 6.0, { pillars: [0.5, 0.25, 0.5, 0.5, 0.5] }),
      country('DEU', 6.0, { pillars: [0.75, 0.5, 0.5, 0.5, 0.5] }),
    ];
    const none = { others: [] };
    assert.deepEqual(iso(selectRelated(ties[0], ties, none, GEO).similarProfile), ['DEU', 'FRA', 'NLD']);
    assert.deepEqual(iso(selectRelated(ties[0], [...ties].reverse(), none, GEO).similarProfile), ['DEU', 'FRA', 'NLD']);
  });
});

// --- profileDistance -------------------------------------------------------

describe('profileDistance', () => {
  const base = country('AAA', 5.0, { pillars: flat });

  it('is the Euclidean distance over the five pillar scores', () => {
    assert.equal(profileDistance(base, country('BBB', 5.0, { pillars: [0.75, 0.5, 0.5, 0.5, 0.5] })), 0.25);
  });

  it('counts only pillars present on both sides, and is null when none is shared', () => {
    const partial = { ...country('BBB', 5.0), pillars: [
      { name: 'conflict', score: 0.8, weight: 0.3, indicators: [], dataCompleteness: 1 },
      { name: 'crime', score: 0.9, weight: 0.25, indicators: [], dataCompleteness: 1 },
    ] } as ScoredCountry;
    const d = profileDistance(base, partial);
    assert.ok(d !== null && Math.abs(d - 0.5) < 1e-12);
    assert.equal(profileDistance(base, { ...country('CCC', 5.0), pillars: [] } as ScoredCountry), null);
  });
});

// --- determinism -----------------------------------------------------------

describe('determinism', () => {
  it('the same countries in any array order produce identical selections', () => {
    const xs = world({ ITA: 8.2, TUN: 6.9, LBY: 4.8 });
    const snapshot = (list: ScoredCountry[], code: string) => {
      const c = find(list, code);
      const shown = selectComparison(c, list, GEO);
      const rel = selectRelated(c, list, shown, GEO);
      return { rows: others(shown), region: iso(rel.sameRegion), similar: iso(rel.similarProfile) };
    };
    for (const code of ['MLT', 'CHN', 'AFG', 'JEY']) {
      assert.deepEqual(snapshot([...xs].reverse(), code), snapshot(xs, code), code);
    }
  });
});

// --- invariants on the real dataset (robust to the daily pipeline) ----------

describe('real dataset invariants', () => {
  const all: ScoredCountry[] = readJson<{ countries: ScoredCountry[] }>('public', 'scores.json').countries;
  const byIso3 = new Map(all.map((c) => [c.iso3, c]));

  it('every place gets a table with at least one other row, built by the rules', () => {
    assert.ok(all.length > 200, 'expected the full dataset');
    for (const c of all) {
      const label = c.iso3;
      const cmp = selectComparison(c, all, GEO);
      const land = new Set(getLandNeighbours(c.iso3));
      const sovereign = getSovereignState(c.iso3);
      assert.ok(cmp.others.length >= 1, `${label}: empty table`);

      const shownLand = cmp.others.filter((r) => r.relation === 'land').map((r) => r.country.iso3);
      assert.deepEqual([...shownLand].sort(), [...land].filter((b) => byIso3.has(b)).sort(), `${label}: land neighbours`);
      if (sovereign && !land.has(sovereign)) assert.ok(others(cmp).includes(sovereign), `${label}: sovereign ${sovereign} missing`);

      let lastKm = -Infinity;
      for (const r of cmp.others) {
        assert.notEqual(r.country.iso3, c.iso3, `${label}: lists itself`);
        assert.ok(r.km >= lastKm, `${label}: rows not in distance order`);
        lastKm = r.km;
        const isFiller = r.relation === 'sea' && r.country.iso3 !== sovereign;
        if (isFiller) {
          assert.ok(hasSufficientData(r.country), `${label}: filler ${r.country.iso3} has no official score`);
          assert.ok(r.km <= REMOTE_MAX_KM, `${label}: filler ${r.country.iso3} is ${r.km} km away`);
        }
      }
      assert.equal(new Set(others(cmp)).size, cmp.others.length, `${label}: duplicate row`);

      const rel = selectRelated(c, all, cmp, GEO);
      const relIso = [...iso(rel.sameRegion), ...iso(rel.similarProfile)];
      assert.equal(new Set(relIso).size, relIso.length, `${label}: duplicate in related block`);
      for (const r of rel.sameRegion) assert.equal(getSubregion(r.iso3), getSubregion(c.iso3), `${label}: ${r.iso3} not in sub-region`);
      for (const r of relIso) {
        assert.ok(hasSufficientData(byIso3.get(r)!), `${label}: related ${r} fails the data floor`);
        assert.ok(!others(cmp).includes(r) && r !== c.iso3, `${label}: related ${r} is already shown`);
      }
      if (!hasSufficientData(c)) assert.equal(relIso.length, 0, `${label}: related block for a grey subject`);
    }
  });
});

// --- i18n keys rendered by the comparison section ---------------------------

describe('i18n: comparison section keys exist in all seven locales', () => {
  const locales = ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de'] as const;

  it('every locale has both headings with {name}, and a distance label with {km}', () => {
    for (const lang of locales) {
      assert.ok(ui[lang]['country.compare_title'].includes('{name}'), `${lang}: compare_title needs {name}`);
      assert.ok(ui[lang]['country.compare_title_nearby'].includes('{name}'), `${lang}: compare_title_nearby needs {name}`);
      assert.ok(ui[lang]['country.compare_distance'].includes('{km}'), `${lang}: compare_distance needs {km}`);
    }
  });

  it('German headings carry the {copula} slot, so the verb agrees with plural country names', () => {
    assert.ok(ui.de['country.compare_title'].includes('{copula}'));
    assert.ok(ui.de['country.compare_title_nearby'].includes('{copula}'));
  });
});
