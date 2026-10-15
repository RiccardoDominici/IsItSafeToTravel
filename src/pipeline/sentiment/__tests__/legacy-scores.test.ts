import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadLegacyScoreLookup,
  preferLegacyAnchors,
  readLegacyAnchors,
  resolveLegacyLookup,
  type DayScores,
} from '../legacy-scores.js';
import { perceivedScore, type PublishedScoreLookup } from '../perceive.js';
import type { VoteRow } from '../../types.js';

function day(entries: Record<string, number | null>): DayScores {
  return new Map(Object.entries(entries));
}

/** Unix seconds of `utcDate` at `time` UTC (noon by default). */
function at(utcDate: string, time = '12:00:00'): number {
  return Date.parse(`${utcDate}T${time}Z`) / 1000;
}

/** A legacy relative vote (no stored score, delta +1), cast at `time` UTC on `utcDate`. */
function legacy(iso3: string, utcDate: string, time = '12:00:00'): VoteRow {
  return {
    iso3,
    delta: 1,
    rating: null,
    official_score: null,
    country_iso: 'FR',
    created_at: at(utcDate, time),
  };
}

/** A vote that already stores its published score. */
function stored(iso3: string): VoteRow {
  return { ...legacy(iso3, '2026-10-12'), official_score: 6 };
}

/** Run `fn` with console.warn/error captured (and silenced); returns its result and the messages. */
function capturingWarnings<T>(fn: () => T): { result: T; warnings: string[] } {
  const warnings: string[] = [];
  const { warn, error } = console;
  console.warn = (...parts: unknown[]) => warnings.push(parts.join(' '));
  console.error = (...parts: unknown[]) => warnings.push(parts.join(' '));
  try {
    return { result: fn(), warnings };
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

describe('resolveLegacyLookup (snapshot fallback, pure core)', () => {
  it("uses the snapshot of the vote's own UTC date when it exists", () => {
    const { lookup, stats } = resolveLegacyLookup(
      ['2026-10-13'],
      (date) => (date === '2026-10-13' ? day({ AAA: 7 }) : null),
      ['2026-10-12', '2026-10-13'],
    );
    assert.equal(lookup.scoreAt('AAA', at('2026-10-13')), 7);
    assert.deepEqual(stats, { exact: 1, fallback: 0, missing: 0 });
  });

  it('answers every moment of a UTC day from that day, and nothing past midnight', () => {
    const { lookup } = resolveLegacyLookup(['2026-10-13'], () => day({ AAA: 7 }), ['2026-10-13']);
    assert.equal(lookup.scoreAt('AAA', at('2026-10-13', '00:00:00')), 7);
    assert.equal(lookup.scoreAt('AAA', at('2026-10-13', '23:59:59')), 7);
    assert.equal(lookup.scoreAt('AAA', at('2026-10-14', '00:00:00')), null, 'the next day was never loaded');
  });

  it('falls back to the nearest EARLIER snapshot when the date has none', () => {
    const { lookup, stats } = resolveLegacyLookup(
      ['2026-10-14'],
      (date) => (date === '2026-10-12' ? day({ AAA: 4 }) : null),
      ['2026-10-10', '2026-10-12'],
    );
    assert.equal(lookup.scoreAt('AAA', at('2026-10-14')), 4);
    assert.deepEqual(stats, { exact: 0, fallback: 1, missing: 0 });
  });

  it('never borrows a LATER snapshot', () => {
    const { lookup, stats } = resolveLegacyLookup(
      ['2026-10-12'],
      (date) => (date === '2026-10-13' ? day({ AAA: 9 }) : null),
      ['2026-10-13'],
    );
    assert.equal(lookup.scoreAt('AAA', at('2026-10-12')), null);
    assert.deepEqual(stats, { exact: 0, fallback: 0, missing: 1 });
  });

  it('gives up beyond the fallback window (7 days by default)', () => {
    const load = (date: string) => (date === '2026-10-12' ? day({ AAA: 5 }) : null);
    const far = resolveLegacyLookup(['2026-10-20'], load, ['2026-10-12']);
    assert.equal(far.lookup.scoreAt('AAA', at('2026-10-20')), null, '8 days back is outside the default window');
    assert.equal(far.stats.missing, 1);

    const wider = resolveLegacyLookup(['2026-10-20'], load, ['2026-10-12'], 10);
    assert.equal(wider.lookup.scoreAt('AAA', at('2026-10-20')), 5);
  });

  it('keeps a grey (null) score on the exact day as null, without falling back to an older day', () => {
    const { lookup, stats } = resolveLegacyLookup(
      ['2026-10-13'],
      (date) => (date === '2026-10-13' ? day({ AAA: null }) : day({ AAA: 8 })),
      ['2026-10-12', '2026-10-13'],
    );
    assert.equal(lookup.scoreAt('AAA', at('2026-10-13')), null);
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
    assert.equal(lookup.scoreAt('BBB', at('2026-10-13')), null);
    assert.equal(lookup.scoreAt('AAA', at('2026-10-01')), null);
  });
});

describe('preferLegacyAnchors (frozen table first, pure)', () => {
  // China's first votes: live at 2.66 on 4 July 2026, while the regenerated snapshot says 6.51.
  const anchors = new Map([['CHN|2026-07-04T03:24:41Z', 2.66]]);

  function spyFallback(value: number | null): { lookup: PublishedScoreLookup; calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      lookup: {
        scoreAt: (iso3, epochSeconds) => {
          calls.push(`${iso3}@${epochSeconds}`);
          return value;
        },
      },
    };
  }

  it('answers from the table when it has the row, without asking the fallback', () => {
    const fallback = spyFallback(6.51);
    const lookup = preferLegacyAnchors(anchors, fallback.lookup);
    assert.equal(lookup.scoreAt('CHN', at('2026-07-04', '03:24:41')), 2.66);
    assert.deepEqual(fallback.calls, []);
  });

  it('asks the fallback for anything the table lacks: another second, or another country', () => {
    const fallback = spyFallback(6.51);
    const lookup = preferLegacyAnchors(anchors, fallback.lookup);
    assert.equal(lookup.scoreAt('CHN', at('2026-07-04', '03:24:42')), 6.51);
    assert.equal(lookup.scoreAt('USA', at('2026-07-04', '03:24:41')), 6.51, 'the key names the country');
    assert.equal(fallback.calls.length, 2);
  });

  it('keeps the fallback null when neither source knows the row', () => {
    const lookup = preferLegacyAnchors(new Map(), spyFallback(null).lookup);
    assert.equal(lookup.scoreAt('CHN', at('2026-07-04', '03:24:41')), null);
  });
});

describe('loadLegacyScoreLookup (frozen table, then data/scores snapshots)', () => {
  let dir = '';
  let tablePath = '';
  let noTablePath = '';
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

    // The frozen table: FRA was live at 3.25 at 09:30:00 on 12 October (the snapshot says 7.5).
    tablePath = join(dir, 'legacy-anchors.json');
    writeFileSync(tablePath, JSON.stringify({ note: 'test', rule: 'test', ref: 'test', anchors: { 'FRA|2026-10-12T09:30:00Z': 3.25 } }));
    noTablePath = join(dir, 'no-such-table.json');
  });

  after(() => {
    if (previousScoresDir === undefined) delete process.env.SCORES_DIR;
    else process.env.SCORES_DIR = previousScoresDir;
    rmSync(dir, { recursive: true, force: true });
  });

  it('prefers the table and leaves only the rows it lacks to the snapshots', () => {
    const anchored = legacy('FRA', '2026-10-12', '09:30:00');
    const unlisted = legacy('FRA', '2026-10-13');
    const { lookup, stats } = loadLegacyScoreLookup([anchored, unlisted], tablePath);

    assert.equal(lookup.scoreAt('FRA', anchored.created_at), 3.25, 'table, not the 7.5 snapshot of that day');
    assert.equal(lookup.scoreAt('FRA', unlisted.created_at), 7.1, 'snapshot of the vote date');
    // Only 2026-10-13 was needed from the snapshots: the anchored row's day was never loaded.
    assert.deepEqual(stats, { anchoredRows: 1, snapshotRows: 1, exact: 1, fallback: 0, missing: 0 });

    // End to end through the per-vote formula: S_shown + 0.5 * delta.
    assert.equal(perceivedScore(anchored, lookup), 3.75);
    assert.ok(Math.abs(perceivedScore(unlisted, lookup)! - 7.6) < 1e-12);
  });

  it('a table that covers every legacy row needs no snapshot at all', () => {
    const { stats } = loadLegacyScoreLookup([legacy('FRA', '2026-10-12', '09:30:00')], tablePath);
    assert.deepEqual(stats, { anchoredRows: 1, snapshotRows: 0, exact: 0, fallback: 0, missing: 0 });
  });

  it('without a table, anchors legacy votes to the snapshot of their UTC date, grey days included', () => {
    const { result, warnings } = capturingWarnings(() =>
      loadLegacyScoreLookup([legacy('FRA', '2026-10-12'), legacy('ALA', '2026-10-12')], noTablePath),
    );
    assert.equal(result.lookup.scoreAt('FRA', at('2026-10-12')), 7.5);
    assert.equal(result.lookup.scoreAt('ALA', at('2026-10-12')), null);
    assert.deepEqual(result.stats, { anchoredRows: 0, snapshotRows: 2, exact: 1, fallback: 0, missing: 0 });
    assert.ok(warnings.some((w) => w.includes('Legacy anchor table missing')), 'a lost table is logged');
  });

  it('without a table, serves a day without its own snapshot from the nearest earlier file', () => {
    const { result } = capturingWarnings(() => loadLegacyScoreLookup([legacy('FRA', '2026-10-15')], noTablePath));
    assert.equal(result.lookup.scoreAt('FRA', at('2026-10-15')), 7.1);
    assert.deepEqual(result.stats, { anchoredRows: 0, snapshotRows: 1, exact: 0, fallback: 1, missing: 0 });
  });

  it('a corrupt table is not fatal: its rows fall back to the snapshots', () => {
    const corrupt = join(dir, 'corrupt-anchors.json');
    writeFileSync(corrupt, '{ not json');
    const row = legacy('FRA', '2026-10-12', '09:30:00');
    const { result } = capturingWarnings(() => loadLegacyScoreLookup([row], corrupt));
    assert.equal(result.lookup.scoreAt('FRA', row.created_at), 7.5);
    assert.deepEqual(result.stats, { anchoredRows: 0, snapshotRows: 1, exact: 1, fallback: 0, missing: 0 });
  });

  it('reads neither the table nor a snapshot when every vote already stores its score', () => {
    // A missing table would be logged if it were read; nothing is.
    const { result, warnings } = capturingWarnings(() => loadLegacyScoreLookup([stored('FRA')], noTablePath));
    assert.equal(result.lookup.scoreAt('FRA', at('2026-10-12')), null);
    assert.deepEqual(result.stats, { anchoredRows: 0, snapshotRows: 0, exact: 0, fallback: 0, missing: 0 });
    assert.deepEqual(warnings, []);
  });

  it('readLegacyAnchors: a missing file is an empty table, not an error', () => {
    const { result } = capturingWarnings(() => readLegacyAnchors(noTablePath));
    assert.equal(result.size, 0);
    assert.equal(readLegacyAnchors(tablePath).get('FRA|2026-10-12T09:30:00Z'), 3.25);
  });
});
