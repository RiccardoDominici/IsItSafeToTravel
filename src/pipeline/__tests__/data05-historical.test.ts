import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, rmSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeSnapshot, loadSnapshot, listSnapshotDates } from '../scoring/snapshot.js';
import type { ScoredCountry, FetchResult } from '../types.js';

// Isolate ALL snapshot writes to a temp dir (getScoresDir honors SCORES_DIR):
// these tests used to corrupt the real data/scores/latest.json.
const SCORES_DIR = mkdtempSync(join(tmpdir(), 'scores-data05-'));
process.env.SCORES_DIR = SCORES_DIR;

function makeCountry(iso3: string, score: number): ScoredCountry {
  return {
    iso3,
    name: { en: iso3, it: iso3, es: iso3, fr: iso3, pt: iso3 },
    score,
    scoreDisplay: Math.round(score),
    pillars: [
      { name: 'conflict', score: 0.5, weight: 0.2, indicators: [], dataCompleteness: 0 },
      { name: 'crime', score: 0.5, weight: 0.2, indicators: [], dataCompleteness: 0 },
      { name: 'health', score: 0.5, weight: 0.2, indicators: [], dataCompleteness: 0 },
      { name: 'governance', score: 0.5, weight: 0.2, indicators: [], dataCompleteness: 0 },
      { name: 'environment', score: 0.5, weight: 0.2, indicators: [], dataCompleteness: 0 },
    ],
    advisories: {},
    dataCompleteness: 0,
    confidence: 0,
    lastUpdated: '2026-01-01T00:00:00Z',
    sources: [],
  };
}

const FETCH_RESULTS: FetchResult[] = [
  { source: 'test', success: true, countriesFound: 1, fetchedAt: '2026-01-01T00:00:00Z' },
];

describe('DATA-05: historical scores stored and retrievable', () => {
  const testDates = ['2098-06-01', '2098-06-02', '2098-06-03'];

  // writeSnapshot() also overwrites latest.json as a side effect -- back it up
  // and restore it (same pattern as snapshot.test.ts) so this suite doesn't
  // leave a test fixture sitting in the real data/scores dir.
  let hadExistingLatest = false;
  let existingLatestContent: string | null = null;

  beforeEach(() => {
    const latestPath = join(SCORES_DIR, 'latest.json');
    if (existsSync(latestPath)) {
      hadExistingLatest = true;
      existingLatestContent = readFileSync(latestPath, 'utf-8');
    }
  });

  afterEach(() => {
    for (const d of testDates) {
      const f = join(SCORES_DIR, `${d}.json`);
      if (existsSync(f)) rmSync(f);
    }

    // Restore original latest.json if it existed
    const latestPath = join(SCORES_DIR, 'latest.json');
    if (hadExistingLatest && existingLatestContent) {
      writeFileSync(latestPath, existingLatestContent, 'utf-8');
    } else if (!hadExistingLatest && existsSync(latestPath)) {
      rmSync(latestPath);
    }
  });

  it('multiple days create separate date-stamped files', () => {
    for (const d of testDates) {
      writeSnapshot(d, [makeCountry('USA', 7.0)], FETCH_RESULTS, '1.0.0');
    }

    for (const d of testDates) {
      assert.ok(existsSync(join(SCORES_DIR, `${d}.json`)), `Snapshot for ${d} should exist`);
    }
  });

  it('previous days scores are retrievable after new day is written', () => {
    writeSnapshot('2098-06-01', [makeCountry('USA', 7.0)], FETCH_RESULTS, '1.0.0');
    writeSnapshot('2098-06-02', [makeCountry('USA', 7.5)], FETCH_RESULTS, '1.0.0');
    writeSnapshot('2098-06-03', [makeCountry('USA', 8.0)], FETCH_RESULTS, '1.0.0');

    // Day 1 is still retrievable
    const day1 = loadSnapshot('2098-06-01');
    assert.ok(day1, 'Day 1 snapshot should be retrievable');
    assert.equal(day1!.countries[0].score, 7.0);

    // Day 2 is still retrievable
    const day2 = loadSnapshot('2098-06-02');
    assert.ok(day2, 'Day 2 snapshot should be retrievable');
    assert.equal(day2!.countries[0].score, 7.5);
  });

  it('listSnapshotDates includes all written dates', () => {
    for (const d of testDates) {
      writeSnapshot(d, [makeCountry('USA', 7.0)], FETCH_RESULTS, '1.0.0');
    }

    const allDates = listSnapshotDates();
    for (const d of testDates) {
      assert.ok(allDates.includes(d), `listSnapshotDates should include ${d}`);
    }
  });

  it('snapshot file follows DailySnapshot schema with required fields', () => {
    writeSnapshot('2098-06-01', [makeCountry('USA', 7.0)], FETCH_RESULTS, '1.0.0');
    const snapshot = loadSnapshot('2098-06-01');
    assert.ok(snapshot, 'Snapshot should load');

    // DailySnapshot required fields
    assert.equal(typeof snapshot!.date, 'string');
    assert.equal(typeof snapshot!.generatedAt, 'string');
    assert.equal(typeof snapshot!.pipelineVersion, 'string');
    assert.equal(typeof snapshot!.weightsVersion, 'string');
    assert.ok(Array.isArray(snapshot!.countries));
    assert.ok(Array.isArray(snapshot!.fetchResults));
  });
});
