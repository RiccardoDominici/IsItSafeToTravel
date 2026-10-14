import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildPublishedScoresPayload,
  isGreyScore,
  publishedScoreOf,
} from '../published-scores.js';

describe('isGreyScore (formula v10 grey rule, shared by the vote widget and the vote API)', () => {
  it('is false for any finite score', () => {
    for (const score of [1, 5.9, 7.25, 10]) assert.equal(isGreyScore(score), false);
  });

  it('is true for null (v10 insufficient_data) and for anything that is not a finite number', () => {
    for (const score of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, '7', {}]) {
      assert.equal(isGreyScore(score), true, `expected ${String(score)} to be grey`);
    }
  });

  it('publishedScoreOf keeps the number and maps grey to null', () => {
    assert.equal(publishedScoreOf(6.65212272171292), 6.65212272171292);
    assert.equal(publishedScoreOf(null), null);
    assert.equal(publishedScoreOf(Number.NaN), null);
  });
});

describe('buildPublishedScoresPayload', () => {
  it('maps every country to its exact score (no rounding), grey to null, and keeps the date', () => {
    const payload = buildPublishedScoresPayload(
      [
        { iso3: 'FRA', score: 7.2512 },
        { iso3: 'ALA', score: null },
        { iso3: 42, score: 5 },
      ],
      '2026-10-14',
    );
    assert.deepEqual(payload, { date: '2026-10-14', scores: { FRA: 7.2512, ALA: null } });
  });

  it('is small enough for a cold isolate: the real snapshot serialises to a few KB', () => {
    // data/scores/latest.json is what `astro build` renders the pages from (deploy.yml copies the
    // same file to public/scores.json). The vote API parses this payload on each cold isolate.
    const snapshot = JSON.parse(readFileSync(join(process.cwd(), 'data', 'scores', 'latest.json'), 'utf-8'));
    const payload = buildPublishedScoresPayload(snapshot.countries, snapshot.date);
    const bytes = Buffer.byteLength(JSON.stringify(payload));
    assert.equal(Object.keys(payload.scores).length, snapshot.countries.length);
    assert.ok(bytes < 16_000, `payload is ${bytes} bytes`);
    for (const country of snapshot.countries) {
      assert.equal(payload.scores[country.iso3], publishedScoreOf(country.score));
    }
  });
});
