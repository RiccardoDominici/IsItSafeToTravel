/**
 * GPI current-edition guard (2026-10-15 incident, pipeline run 38711757500): every per-year JSON
 * but 2012 failed to download, the fetcher published 2012 as "the GPI", the five-year rule dropped
 * all of it, and every score went out without the Global Peace Index. The current edition is the
 * manifest's newest year or nothing; the fallback is the cached copy of the newest edition held.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { gpiEditionOf, pickBestCachedGpi, selectCurrentGpiEdition, type CachedGpi } from '../fetchers/gpi.js';
import type { RawIndicator } from '../types.js';

const rows = (year: number, n = 2): RawIndicator[] =>
  Array.from({ length: n }, (_, k) => ({
    countryIso3: k === 0 ? 'DEU' : 'ECU',
    indicatorName: 'gpi_overall',
    value: 1.6 + k,
    year,
    source: 'gpi',
  }));

const cached = (date: string, year: number): CachedGpi => ({
  date,
  data: { source: 'gpi', fetchedAt: `${date}T06:00:00.000Z`, indicators: rows(year) },
});

describe('GPI current edition', () => {
  it('never promotes an older year: only 2012 loaded, edition 2026 -> null (the 2026-10-15 incident)', () => {
    const byYear = new Map([[2012, rows(2012)]]);
    assert.equal(selectCurrentGpiEdition(byYear, 2026), null);
  });

  it('returns the edition rows when they loaded, whatever else did', () => {
    const byYear = new Map([
      [2025, rows(2025)],
      [2026, rows(2026)],
    ]);
    assert.deepEqual(selectCurrentGpiEdition(byYear, 2026), rows(2026));
    assert.equal(selectCurrentGpiEdition(new Map([[2026, []]]), 2026), null, 'an empty edition is not an edition');
  });

  it('the edition of a parsed file is its newest data year', () => {
    assert.equal(gpiEditionOf([...rows(2025), ...rows(2026)]), 2026);
    assert.equal(gpiEditionOf([]), 0);
  });
});

describe('GPI cache fallback', () => {
  it('prefers the newest edition over the newest date: a bad day that wrote 2012 is skipped', () => {
    const best = pickBestCachedGpi([cached('2026-10-15', 2012), cached('2026-10-14', 2026), cached('2026-10-13', 2026)]);
    assert.equal(best?.date, '2026-10-14');
  });

  it('among files of the same edition, the most recent date wins', () => {
    const best = pickBestCachedGpi([cached('2026-10-12', 2026), cached('2026-10-14', 2026), cached('2026-10-13', 2026)]);
    assert.equal(best?.date, '2026-10-14');
  });

  it('nothing usable -> null', () => {
    assert.equal(pickBestCachedGpi([]), null);
    assert.equal(pickBestCachedGpi([{ date: '2026-10-14', data: { source: 'gpi', fetchedAt: '', indicators: [] } }]), null);
  });
});
