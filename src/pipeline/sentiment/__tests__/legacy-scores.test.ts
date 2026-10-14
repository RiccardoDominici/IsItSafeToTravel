import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadLegacyScoreLookup, resolveLegacyLookup, type DayScores } from '../legacy-scores.js';
import type { VoteRow } from '../../types.js';

function day(entries: Record<string, number | null>): DayScores {
  return new Map(Object.entries(entries));
}

/** A legacy relative vote: no stored score, cast at noon UTC on `utcDate`. */
function legacy(iso3: string, utcDate: string): VoteRow {
  return {
    iso3,
    delta: 1,
    rating: null,
    official_score: null,
    country_iso: 'FR',
    created_at: Date.parse(`${utcDate}T12:00:00Z`) / 1000,
  };
}

/** A vote that already stores its published score. */
function stored(iso3: string): VoteRow {
  return { ...legacy(iso3, '2026-10-12'), official_score: 6 };
}

describe('resolveLegacyLookup (pure core)', () => {
  it("uses the snapshot of the vote's own UTC date when it exists", () => {
    const { lookup, stats } = resolveLegacyLookup(
      ['2026-10-13'],
      (date) => (date === '2026-10-13' ? day({ AAA: 7 }) : null),
      ['2026-10-12', '2026-10-13'],
    );
    assert.equal(lookup.scoreOn('AAA', '2026-10-13'), 7);
    assert.deepEqual(stats, { exact: 1, fallback: 0, missing: 0 });
  });

  it('falls back to the nearest EARLIER snapshot when the date has none', () => {
    const { lookup, stats } = resolveLegacyLookup(
      ['2026-10-14'],
      (date) => (date === '2026-10-12' ? day({ AAA: 4 }) : null),
      ['2026-10-10', '2026-10-12'],
    );
    assert.equal(lookup.scoreOn('AAA', '2026-10-14'), 4);
    assert.deepEqual(stats, { exact: 0, fallback: 1, missing: 0 });
  });

  it('never borrows a LATER snapshot', () => {
    const { lookup, stats } = resolveLegacyLookup(
      ['2026-10-12'],
      (date) => (date === '2026-10-13' ? day({ AAA: 9 }) : null),
      ['2026-10-13'],
    );
    assert.equal(lookup.scoreOn('AAA', '2026-10-12'), null);
    assert.deepEqual(stats, { exact: 0, fallback: 0, missing: 1 });
  });

  it('gives up beyond the fallback window (7 days by default)', () => {
    const load = (date: string) => (date === '2026-10-12' ? day({ AAA: 5 }) : null);
    const far = resolveLegacyLookup(['2026-10-20'], load, ['2026-10-12']);
    assert.equal(far.lookup.scoreOn('AAA', '2026-10-20'), null, '8 days back is outside the default window');
    assert.equal(far.stats.missing, 1);

    const wider = resolveLegacyLookup(['2026-10-20'], load, ['2026-10-12'], 10);
    assert.equal(wider.lookup.scoreOn('AAA', '2026-10-20'), 5);
  });

  it('keeps a grey (null) score on the exact day as null, without falling back to an older day', () => {
    const { lookup, stats } = resolveLegacyLookup(
      ['2026-10-13'],
      (date) => (date === '2026-10-13' ? day({ AAA: null }) : day({ AAA: 8 })),
      ['2026-10-12', '2026-10-13'],
    );
    assert.equal(lookup.scoreOn('AAA', '2026-10-13'), null);
    assert.deepEqual(stats, { exact: 1, fallback: 0, missing: 0 });
  });

  it('loads each needed date once, however many votes share it', () => {
    const calls: string[] = [];
    resolveLegacyLookup(
      ['2026-10-13', '2026-10-13', '2026-10-12'],
      (date) => {
        calls.push(date);
        return day({ AAA: 6 });
      },
      ['2026-10-12', '2026-10-13'],
    );
    assert.deepEqual(calls.sort(), ['2026-10-12', '2026-10-13']);
  });

  it('returns null for a country or date that was never loaded', () => {
    const { lookup } = resolveLegacyLookup(['2026-10-13'], () => day({ AAA: 6 }), ['2026-10-13']);
    assert.equal(lookup.scoreOn('BBB', '2026-10-13'), null);
    assert.equal(lookup.scoreOn('AAA', '2026-10-01'), null);
  });
});

describe('loadLegacyScoreLookup (reads data/scores snapshots)', () => {
  let dir = '';
  let previousScoresDir: string | undefined;

  before(() => {
    // Isolated snapshot directory, same convention as the score-history tests.
    dir = mkdtempSync(join(tmpdir(), 'legacy-scores-'));
    previousScoresDir = process.env.SCORES_DIR;
    process.env.SCORES_DIR = dir;
    writeFileSync(
      join(dir, '2026-10-12.json'),
      JSON.stringify({ date: '2026-10-12', countries: [{ iso3: 'FRA', score: 7.5 }, { iso3: 'ALA', score: null }] }),
    );
    writeFileSync(join(dir, '2026-10-13.json'), JSON.stringify({ date: '2026-10-13', countries: [{ iso3: 'FRA', score: 7.1 }] }));
    // Non-snapshot files in the same directory must be ignored.
    writeFileSync(join(dir, 'history-index.json'), '{"noise":true}');
    writeFileSync(join(dir, 'latest.json'), '{"noise":true}');
  });

  after(() => {
    if (previousScoresDir === undefined) delete process.env.SCORES_DIR;
    else process.env.SCORES_DIR = previousScoresDir;
    rmSync(dir, { recursive: true, force: true });
  });

  it("anchors legacy votes to the snapshot of their UTC date, grey days included", () => {
    const { lookup, stats } = loadLegacyScoreLookup([legacy('FRA', '2026-10-12'), legacy('ALA', '2026-10-12')]);
    assert.equal(lookup.scoreOn('FRA', '2026-10-12'), 7.5);
    assert.equal(lookup.scoreOn('ALA', '2026-10-12'), null);
    assert.deepEqual(stats, { exact: 1, fallback: 0, missing: 0 });
  });

  it('serves a day without its own snapshot from the nearest earlier file', () => {
    const { lookup, stats } = loadLegacyScoreLookup([legacy('FRA', '2026-10-15')]);
    assert.equal(lookup.scoreOn('FRA', '2026-10-15'), 7.1);
    assert.deepEqual(stats, { exact: 0, fallback: 1, missing: 0 });
  });

  it('reads no snapshot file when every vote already stores its score', () => {
    const { lookup, stats } = loadLegacyScoreLookup([stored('FRA')]);
    assert.equal(lookup.scoreOn('FRA', '2026-10-12'), null);
    assert.deepEqual(stats, { exact: 0, fallback: 0, missing: 0 });
  });
});
