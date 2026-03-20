import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeSnapshot } from '../snapshot.js';
import { writeHistoryIndex } from '../history.js';
import type { ScoredCountry, FetchResult } from '../../types.js';

const TEST_SCORES_DIR = join(process.cwd(), 'data', 'scores');
const HISTORY_INDEX_PATH = join(TEST_SCORES_DIR, 'history-index.json');

// Minimal scored country fixture (same as snapshot tests)
function makeScoredCountry(iso3: string, score: number): ScoredCountry {
  return {
    iso3,
    name: { en: `Country ${iso3}`, it: `Paese ${iso3}`, es: `Pais ${iso3}` },
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
    lastUpdated: '2026-01-01T00:00:00Z',
    sources: [],
  };
}

const TEST_FETCH_RESULTS: FetchResult[] = [
  { source: 'inform', success: true, countriesFound: 190, fetchedAt: '2026-01-01T00:00:00Z' },
];

describe('history: writeHistoryIndex', () => {
  let hadExistingLatest = false;
  let existingLatestContent: string | null = null;
  let hadExistingIndex = false;
  let existingIndexContent: string | null = null;

  beforeEach(() => {
    const latestPath = join(TEST_SCORES_DIR, 'latest.json');
    if (existsSync(latestPath)) {
      hadExistingLatest = true;
      existingLatestContent = readFileSync(latestPath, 'utf-8');
    }
    if (existsSync(HISTORY_INDEX_PATH)) {
      hadExistingIndex = true;
      existingIndexContent = readFileSync(HISTORY_INDEX_PATH, 'utf-8');
    }
  });

  afterEach(() => {
    // Clean up test snapshot files
    for (const date of ['2099-01-01', '2099-01-02', '2099-01-03']) {
      const f = join(TEST_SCORES_DIR, `${date}.json`);
      if (existsSync(f)) rmSync(f);
    }

    // Restore latest.json
    const latestPath = join(TEST_SCORES_DIR, 'latest.json');
    if (hadExistingLatest && existingLatestContent) {
      writeFileSync(latestPath, existingLatestContent, 'utf-8');
    } else if (!hadExistingLatest && existsSync(latestPath)) {
      rmSync(latestPath);
    }

    // Restore history-index.json
    if (hadExistingIndex && existingIndexContent) {
      writeFileSync(HISTORY_INDEX_PATH, existingIndexContent, 'utf-8');
    } else if (!hadExistingIndex && existsSync(HISTORY_INDEX_PATH)) {
      rmSync(HISTORY_INDEX_PATH);
    }
  });

  it('produces a history-index.json file from multiple snapshots', () => {
    writeSnapshot('2099-01-01', [makeScoredCountry('USA', 7.5)], TEST_FETCH_RESULTS, '1.0.0');
    writeSnapshot('2099-01-02', [makeScoredCountry('USA', 7.6)], TEST_FETCH_RESULTS, '1.0.0');

    writeHistoryIndex();

    assert.ok(existsSync(HISTORY_INDEX_PATH), 'history-index.json should exist');
  });

  it('has correct structure: generatedAt, global, countries', () => {
    writeSnapshot('2099-01-01', [makeScoredCountry('USA', 7.5)], TEST_FETCH_RESULTS, '1.0.0');

    const result = writeHistoryIndex();

    assert.ok(typeof result.generatedAt === 'string', 'generatedAt should be a string');
    assert.ok(Array.isArray(result.global), 'global should be an array');
    assert.ok(typeof result.countries === 'object', 'countries should be an object');
  });

  it('builds per-country arrays from multiple snapshots', () => {
    writeSnapshot('2099-01-01', [makeScoredCountry('USA', 7.5), makeScoredCountry('AFG', 2.3)], TEST_FETCH_RESULTS, '1.0.0');
    writeSnapshot('2099-01-02', [makeScoredCountry('USA', 7.6), makeScoredCountry('AFG', 2.4)], TEST_FETCH_RESULTS, '1.0.0');

    const result = writeHistoryIndex();

    // Filter to only test dates
    const usaPoints = result.countries['USA']?.filter(p => p.date.startsWith('2099-'));
    const afgPoints = result.countries['AFG']?.filter(p => p.date.startsWith('2099-'));

    assert.ok(usaPoints, 'USA should exist in countries');
    assert.equal(usaPoints!.length, 2);
    assert.deepEqual(usaPoints, [
      { date: '2099-01-01', score: 7.5 },
      { date: '2099-01-02', score: 7.6 },
    ]);

    assert.ok(afgPoints, 'AFG should exist in countries');
    assert.equal(afgPoints!.length, 2);
    assert.deepEqual(afgPoints, [
      { date: '2099-01-01', score: 2.3 },
      { date: '2099-01-02', score: 2.4 },
    ]);
  });

  it('global array contains globalScore from each snapshot', () => {
    writeSnapshot('2099-01-01', [makeScoredCountry('USA', 7.5), makeScoredCountry('AFG', 2.3)], TEST_FETCH_RESULTS, '1.0.0');
    writeSnapshot('2099-01-02', [makeScoredCountry('USA', 7.6), makeScoredCountry('AFG', 2.4)], TEST_FETCH_RESULTS, '1.0.0');

    const result = writeHistoryIndex();

    const testGlobal = result.global.filter(p => p.date.startsWith('2099-'));
    assert.equal(testGlobal.length, 2);
    // (7.5+2.3)/2 = 4.9
    assert.equal(testGlobal[0].score, 4.9);
    // (7.6+2.4)/2 = 5.0
    assert.equal(testGlobal[1].score, 5.0);
  });
});
