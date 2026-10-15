/**
 * Locks the land-border map, the sovereign-state map and the M49 sub-regions
 * against the 248 places.
 *
 * WHY (2026-10 audit, I37): 48 places had no border entry (Jersey without the UK,
 * Western Sahara without Algeria, French Guiana without Brazil) and 40 pairs were
 * one-sided (Korea omitted China while Japan listed it). These tests keep every place
 * covered and every land border symmetric.
 *
 * Run with: node --import tsx --test src/lib/__tests__/neighbors.test.ts
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { landBorders, sovereignState, getLandNeighbours, getSovereignState } from '../neighbors.js';
import { getSubregion, subregionMap } from '../subregions.js';

const root = process.cwd();
const places: string[] = JSON.parse(fs.readFileSync(path.join(root, 'public', 'scores.json'), 'utf8'))
  .countries.map((c: { iso3: string }) => c.iso3)
  .sort();
const placeSet = new Set(places);

describe('landBorders', () => {
  it('has exactly one entry for every place, and no unknown code', () => {
    assert.ok(places.length >= 248, `expected the full dataset, found ${places.length}`);
    assert.deepEqual(Object.keys(landBorders).sort(), places);
    for (const [a, list] of Object.entries(landBorders)) {
      for (const b of list) assert.ok(placeSet.has(b), `${a}: unknown neighbour ${b}`);
    }
  });

  it('is symmetric: A lists B exactly when B lists A', () => {
    const oneSided: string[] = [];
    for (const [a, list] of Object.entries(landBorders)) {
      for (const b of list) if (!landBorders[b].includes(a)) oneSided.push(`${a}->${b}`);
    }
    assert.deepEqual(oneSided, []);
  });

  it('has no self-border and no duplicate', () => {
    for (const [a, list] of Object.entries(landBorders)) {
      assert.ok(!list.includes(a), `${a} borders itself`);
      assert.equal(new Set(list).size, list.length, `${a} lists a neighbour twice`);
    }
  });

  it('China lists all 16 land neighbours, including the riskiest', () => {
    assert.deepEqual([...getLandNeighbours('CHN')].sort(), [
      'AFG', 'BTN', 'HKG', 'IND', 'KAZ', 'KGZ', 'LAO', 'MAC', 'MMR', 'MNG', 'NPL', 'PAK', 'PRK', 'RUS', 'TJK', 'VNM',
    ]);
  });

  it('Brazil lists its 10 land neighbours, French Guiana included', () => {
    assert.deepEqual([...getLandNeighbours('BRA')].sort(), [
      'ARG', 'BOL', 'COL', 'GUF', 'GUY', 'PER', 'PRY', 'SUR', 'URY', 'VEN',
    ]);
  });

  it('DR Congo lists its 9 land neighbours', () => {
    assert.deepEqual([...getLandNeighbours('COD')].sort(), [
      'AGO', 'BDI', 'CAF', 'COG', 'RWA', 'SSD', 'TZA', 'UGA', 'ZMB',
    ]);
  });

  it('holds land borders only: sea crossings and islands are not in the map', () => {
    assert.deepEqual([...getLandNeighbours('KOR')], ['PRK']);
    assert.deepEqual([...getLandNeighbours('GBR')], ['IRL']);
    for (const island of ['JPN', 'ISL', 'MLT', 'CYP', 'NZL', 'AUS', 'FJI', 'SGP', 'BHR', 'TWN']) {
      assert.deepEqual([...getLandNeighbours(island)], [], `${island} has no land border`);
    }
    assert.deepEqual([...getLandNeighbours('XXX')], []);
  });

  it('places the site shows separately keep their own borders (Western Sahara, French Guiana, Gibraltar)', () => {
    assert.deepEqual([...getLandNeighbours('ESH')].sort(), ['DZA', 'MAR', 'MRT']);
    assert.deepEqual([...getLandNeighbours('GUF')].sort(), ['BRA', 'SUR']);
    assert.deepEqual([...getLandNeighbours('GIB')], ['ESP']);
    assert.ok(!getLandNeighbours('MAR').includes('MRT'), 'Morocco and Mauritania meet only through Western Sahara');
  });
});

describe('sovereignState', () => {
  it('maps territories to sovereign places, never to itself, a territory or an unknown code', () => {
    for (const [territory, state] of Object.entries(sovereignState)) {
      assert.ok(placeSet.has(territory), `unknown territory ${territory}`);
      assert.ok(placeSet.has(state), `${territory}: unknown sovereign ${state}`);
      assert.notEqual(territory, state);
      assert.equal(getSovereignState(state), null, `${territory}: sovereign ${state} is itself a territory`);
    }
  });

  it('covers the territories the audit found without their state, and no disputed place', () => {
    assert.equal(getSovereignState('JEY'), 'GBR');
    assert.equal(getSovereignState('SJM'), 'NOR');
    assert.equal(getSovereignState('GUF'), 'FRA');
    assert.equal(getSovereignState('REU'), 'FRA');
    assert.equal(getSovereignState('ALA'), 'FIN');
    assert.equal(getSovereignState('NFK'), 'AUS');
    for (const disputedOrSovereign of ['ESH', 'PSE', 'XKX', 'TWN', 'ATA', 'FRA', 'CHN']) {
      assert.equal(getSovereignState(disputedOrSovereign), null, `${disputedOrSovereign} has no sovereign entry`);
    }
  });
});

describe('subregions (UN M49)', () => {
  it('give every place but Antarctica one sub-region, and list no unknown code', () => {
    for (const iso3 of places) {
      if (iso3 === 'ATA') assert.equal(getSubregion(iso3), null);
      else assert.ok(getSubregion(iso3), `${iso3} has no sub-region`);
    }
    for (const iso3 of Object.keys(subregionMap)) assert.ok(placeSet.has(iso3), `unknown code ${iso3}`);
  });

  it('are travel-scale, not continents', () => {
    assert.equal(getSubregion('AFG'), 'southern_asia');
    assert.notEqual(getSubregion('AFG'), getSubregion('PRK'));
    assert.notEqual(getSubregion('LAO'), getSubregion('TJK'));
    assert.notEqual(getSubregion('DZA'), getSubregion('ZMB'));
    assert.equal(getSubregion('XKX'), 'southern_europe');
    assert.equal(getSubregion('TWN'), 'eastern_asia');
  });
});
