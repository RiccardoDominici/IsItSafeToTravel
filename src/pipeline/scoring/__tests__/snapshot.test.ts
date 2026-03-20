import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeSnapshot, loadLatestSnapshot, loadSnapshot, listSnapshotDates } from '../snapshot.js';
import type { ScoredCountry, FetchResult } from '../../types.js';

const TEST_SCORES_DIR = join(process.cwd(), 'data', 'scores');
const BACKUP_DIR = join(process.cwd(), 'data', 'scores-backup-test');

// Minimal scored country fixture
function makeScoredCountry(iso3: string, score: number): ScoredCountry {
  return {
    iso3,
    name: { en: `Country ${iso3}`, it: `Paese ${iso3}`, es: `Pais ${iso3}`, fr: `Pays ${iso3}`, pt: `Pais ${iso3}` },
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

describe('snapshot: writeSnapshot and loadLatestSnapshot', () => {
  // Save any existing scores files before tests, restore after
  let hadExistingLatest = false;
  let existingLatestContent: string | null = null;

  beforeEach(() => {
    const latestPath = join(TEST_SCORES_DIR, 'latest.json');
    if (existsSync(latestPath)) {
      hadExistingLatest = true;
      existingLatestContent = readFileSync(latestPath, 'utf-8');
    }
  });

  afterEach(() => {
    // Clean up test snapshot files
    const testDate1 = join(TEST_SCORES_DIR, '2099-01-01.json');
    const testDate2 = join(TEST_SCORES_DIR, '2099-01-02.json');
    if (existsSync(testDate1)) rmSync(testDate1);
    if (existsSync(testDate2)) rmSync(testDate2);

    // Restore original latest.json if it existed
    const latestPath = join(TEST_SCORES_DIR, 'latest.json');
    if (hadExistingLatest && existingLatestContent) {
      writeFileSync(latestPath, existingLatestContent, 'utf-8');
    } else if (!hadExistingLatest && existsSync(latestPath)) {
      rmSync(latestPath);
    }
  });

  it('writes a date-stamped snapshot file and latest.json', () => {
    const countries = [makeScoredCountry('USA', 7.5), makeScoredCountry('AFG', 2.3)];
    const snapshot = writeSnapshot('2099-01-01', countries, TEST_FETCH_RESULTS, '1.0.0');

    // date-stamped file exists
    const datePath = join(TEST_SCORES_DIR, '2099-01-01.json');
    assert.ok(existsSync(datePath), 'Date-stamped snapshot file should exist');

    // latest.json exists
    const latestPath = join(TEST_SCORES_DIR, 'latest.json');
    assert.ok(existsSync(latestPath), 'latest.json should exist');

    // Snapshot structure
    assert.equal(snapshot.date, '2099-01-01');
    assert.equal(snapshot.weightsVersion, '1.0.0');
    assert.equal(snapshot.countries.length, 2);
    assert.ok(snapshot.generatedAt, 'generatedAt should be set');
    assert.ok(snapshot.pipelineVersion, 'pipelineVersion should be set');
  });

  it('loadLatestSnapshot returns the most recent write', () => {
    const countries = [makeScoredCountry('ITA', 8.1)];
    writeSnapshot('2099-01-01', countries, TEST_FETCH_RESULTS, '1.0.0');

    const loaded = loadLatestSnapshot();
    assert.ok(loaded, 'loadLatestSnapshot should return a snapshot');
    assert.equal(loaded!.date, '2099-01-01');
    assert.equal(loaded!.countries.length, 1);
    assert.equal(loaded!.countries[0].iso3, 'ITA');
  });

  it('loadSnapshot retrieves a specific date snapshot', () => {
    const countries = [makeScoredCountry('DEU', 7.9)];
    writeSnapshot('2099-01-02', countries, TEST_FETCH_RESULTS, '1.0.0');

    const loaded = loadSnapshot('2099-01-02');
    assert.ok(loaded, 'loadSnapshot should return data for the given date');
    assert.equal(loaded!.date, '2099-01-02');
    assert.equal(loaded!.countries[0].iso3, 'DEU');
  });

  it('loadSnapshot returns null for nonexistent date', () => {
    const loaded = loadSnapshot('1900-01-01');
    assert.equal(loaded, null, 'Should return null for nonexistent date');
  });

  it('historical snapshots are preserved across multiple writes', () => {
    writeSnapshot('2099-01-01', [makeScoredCountry('USA', 7.5)], TEST_FETCH_RESULTS, '1.0.0');
    writeSnapshot('2099-01-02', [makeScoredCountry('ITA', 8.1)], TEST_FETCH_RESULTS, '1.0.0');

    // Both date files should exist
    assert.ok(existsSync(join(TEST_SCORES_DIR, '2099-01-01.json')), 'First snapshot should still exist');
    assert.ok(existsSync(join(TEST_SCORES_DIR, '2099-01-02.json')), 'Second snapshot should exist');

    // latest.json should be the most recent write
    const latest = loadLatestSnapshot();
    assert.equal(latest!.date, '2099-01-02');

    // But the first is still retrievable
    const first = loadSnapshot('2099-01-01');
    assert.ok(first, 'First snapshot should be retrievable');
    assert.equal(first!.countries[0].iso3, 'USA');
  });
});

describe('snapshot: globalScore computation', () => {
  let hadExistingLatest = false;
  let existingLatestContent: string | null = null;

  beforeEach(() => {
    const latestPath = join(TEST_SCORES_DIR, 'latest.json');
    if (existsSync(latestPath)) {
      hadExistingLatest = true;
      existingLatestContent = readFileSync(latestPath, 'utf-8');
    }
  });

  afterEach(() => {
    const testDate = join(TEST_SCORES_DIR, '2099-03-01.json');
    if (existsSync(testDate)) rmSync(testDate);

    const latestPath = join(TEST_SCORES_DIR, 'latest.json');
    if (hadExistingLatest && existingLatestContent) {
      writeFileSync(latestPath, existingLatestContent, 'utf-8');
    } else if (!hadExistingLatest && existsSync(latestPath)) {
      rmSync(latestPath);
    }
  });

  it('computes globalScore as arithmetic mean of country scores rounded to 1 decimal', () => {
    const countries = [
      makeScoredCountry('USA', 7.5),
      makeScoredCountry('AFG', 2.3),
      makeScoredCountry('ITA', 8.1),
    ];
    const snapshot = writeSnapshot('2099-03-01', countries, TEST_FETCH_RESULTS, '1.0.0');
    // (7.5 + 2.3 + 8.1) / 3 = 5.966... -> 6.0
    assert.equal(snapshot.globalScore, 6.0);
  });

  it('returns globalScore 0 when there are no countries', () => {
    const snapshot = writeSnapshot('2099-03-01', [], TEST_FETCH_RESULTS, '1.0.0');
    assert.equal(snapshot.globalScore, 0);
  });

  it('persists globalScore in the date-stamped JSON file', () => {
    const countries = [makeScoredCountry('USA', 7.5), makeScoredCountry('AFG', 2.3), makeScoredCountry('ITA', 8.1)];
    writeSnapshot('2099-03-01', countries, TEST_FETCH_RESULTS, '1.0.0');
    const raw = JSON.parse(readFileSync(join(TEST_SCORES_DIR, '2099-03-01.json'), 'utf-8'));
    assert.equal(raw.globalScore, 6.0);
  });

  it('persists globalScore in latest.json', () => {
    const countries = [makeScoredCountry('USA', 7.5), makeScoredCountry('AFG', 2.3), makeScoredCountry('ITA', 8.1)];
    writeSnapshot('2099-03-01', countries, TEST_FETCH_RESULTS, '1.0.0');
    const raw = JSON.parse(readFileSync(join(TEST_SCORES_DIR, 'latest.json'), 'utf-8'));
    assert.equal(raw.globalScore, 6.0);
  });
});

describe('snapshot: listSnapshotDates', () => {
  afterEach(() => {
    const testDate1 = join(TEST_SCORES_DIR, '2099-01-01.json');
    const testDate2 = join(TEST_SCORES_DIR, '2099-01-02.json');
    if (existsSync(testDate1)) rmSync(testDate1);
    if (existsSync(testDate2)) rmSync(testDate2);
  });

  it('returns dates in ascending order', () => {
    writeSnapshot('2099-01-02', [makeScoredCountry('USA', 7.0)], TEST_FETCH_RESULTS, '1.0.0');
    writeSnapshot('2099-01-01', [makeScoredCountry('USA', 7.0)], TEST_FETCH_RESULTS, '1.0.0');

    const dates = listSnapshotDates();
    const testDates = dates.filter((d) => d.startsWith('2099-'));
    assert.ok(testDates.length >= 2, 'Should have at least 2 test dates');
    // Ascending order
    assert.ok(testDates[0] <= testDates[1], 'Dates should be in ascending order');
  });
});
