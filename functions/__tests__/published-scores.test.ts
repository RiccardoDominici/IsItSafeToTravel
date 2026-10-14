import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  PUBLISHED_SCORES_PATH,
  buildPublishedScoreIndex,
  classifyCountry,
  loadPublishedScoreIndex,
  resetPublishedScoreCache,
} from '../lib/published-scores.ts';

function assetsReturning(body: string, status = 200) {
  const calls: string[] = [];
  return {
    calls,
    async fetch(input: URL | string): Promise<Response> {
      calls.push(String(input));
      return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
    },
  };
}

const HEALTHY_BODY = JSON.stringify({
  countries: [
    { iso3: 'FRA', score: 7.25 },
    { iso3: 'ALA', score: null, scoreStatus: 'insufficient_data' },
  ],
});

beforeEach(() => {
  resetPublishedScoreCache();
});

describe('buildPublishedScoreIndex', () => {
  it('maps numeric scores and null (grey) scores', () => {
    const index = buildPublishedScoreIndex({
      countries: [
        { iso3: 'FRA', score: 7.25 },
        { iso3: 'ALA', score: null },
      ],
    });
    assert.ok(index);
    assert.equal(index.get('FRA'), 7.25);
    assert.equal(index.has('ALA'), true);
    assert.equal(index.get('ALA'), null);
  });

  it('skips entries whose iso3 or score is malformed (they classify as unknown)', () => {
    const index = buildPublishedScoreIndex({
      countries: [
        { iso3: 'FRA', score: 7 },
        { iso3: 'ITA', score: '7' },
        { iso3: 'ESP', score: Number.POSITIVE_INFINITY },
        { iso3: 'DEU' },
        { iso3: 42, score: 5 },
        null,
      ],
    });
    assert.ok(index);
    assert.deepEqual([...index.keys()], ['FRA']);
  });

  it('returns null when there are no usable countries', () => {
    assert.equal(buildPublishedScoreIndex({}), null);
    assert.equal(buildPublishedScoreIndex({ countries: 'nope' }), null);
    assert.equal(buildPublishedScoreIndex({ countries: [] }), null);
    assert.equal(buildPublishedScoreIndex(null), null);
  });
});

describe('classifyCountry', () => {
  const index = buildPublishedScoreIndex({
    countries: [
      { iso3: 'FRA', score: 7.25 },
      { iso3: 'ALA', score: null },
    ],
  })!;

  it('classifies a numeric score as scored (relative vote)', () => {
    assert.equal(classifyCountry(index, 'FRA'), 'scored');
  });

  it('classifies a null score as grey (absolute rating)', () => {
    assert.equal(classifyCountry(index, 'ALA'), 'grey');
  });

  it('returns null for a country absent from the index (vote type unknown)', () => {
    assert.equal(classifyCountry(index, 'ITA'), null);
  });
});

describe('loadPublishedScoreIndex', () => {
  it('reads PUBLISHED_SCORES_PATH resolved against the request origin', async () => {
    const assets = assetsReturning(HEALTHY_BODY);
    const index = await loadPublishedScoreIndex(assets, 'https://isitsafetotravel.org/api/vote');
    assert.ok(index);
    assert.deepEqual(assets.calls, [`https://isitsafetotravel.org${PUBLISHED_SCORES_PATH}`]);
    assert.equal(PUBLISHED_SCORES_PATH, '/scores.json');
  });

  it('serves later calls from the per-isolate cache', async () => {
    const assets = assetsReturning(HEALTHY_BODY);
    const first = await loadPublishedScoreIndex(assets, 'https://isitsafetotravel.org/api/vote');
    const second = await loadPublishedScoreIndex(assets, 'https://isitsafetotravel.org/api/vote');
    assert.equal(assets.calls.length, 1);
    assert.strictEqual(second, first);
  });

  it('does not cache a failed read', async () => {
    const failing = assetsReturning('{}', 500);
    assert.equal(await loadPublishedScoreIndex(failing, 'https://isitsafetotravel.org/api/vote'), null);
    const healthy = assetsReturning(HEALTHY_BODY);
    assert.ok(await loadPublishedScoreIndex(healthy, 'https://isitsafetotravel.org/api/vote'));
    assert.equal(healthy.calls.length, 1);
  });

  it('returns null when the ASSETS binding is missing', async () => {
    assert.equal(await loadPublishedScoreIndex(undefined, 'https://isitsafetotravel.org/api/vote'), null);
  });

  it('returns null (never throws) when the fetch rejects', async () => {
    const broken = {
      async fetch(): Promise<Response> {
        throw new Error('asset binding unavailable');
      },
    };
    assert.equal(await loadPublishedScoreIndex(broken, 'https://isitsafetotravel.org/api/vote'), null);
  });

  it('returns null when scores.json is not valid JSON', async () => {
    assert.equal(await loadPublishedScoreIndex(assetsReturning('<html>'), 'https://isitsafetotravel.org/api/vote'), null);
  });

  it('resetPublishedScoreCache forces the next call to read again', async () => {
    const assets = assetsReturning(HEALTHY_BODY);
    await loadPublishedScoreIndex(assets, 'https://isitsafetotravel.org/api/vote');
    resetPublishedScoreCache();
    await loadPublishedScoreIndex(assets, 'https://isitsafetotravel.org/api/vote');
    assert.equal(assets.calls.length, 2);
  });
});
