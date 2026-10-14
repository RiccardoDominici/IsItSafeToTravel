import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { needsLegacyLookup, perceivedScore, utcDateOf, type PublishedScoreLookup } from '../perceive.js';
import type { VoteRow } from '../../types.js';

const NO_LOOKUP: PublishedScoreLookup = { scoreOn: () => null };

function row(o: Partial<VoteRow> = {}): VoteRow {
  return {
    iso3: 'AAA',
    delta: 0,
    rating: null,
    official_score: 6,
    country_iso: 'FR',
    created_at: 1_700_000_000,
    ...o,
  };
}

describe('utcDateOf', () => {
  it('returns the UTC calendar day of a unix-seconds timestamp', () => {
    assert.equal(utcDateOf(1_700_000_000), '2023-11-14');
  });

  it('uses UTC, not local time, at the day boundary', () => {
    assert.equal(utcDateOf(Date.UTC(2026, 9, 13, 23, 59, 59) / 1000), '2026-10-13');
    assert.equal(utcDateOf(Date.UTC(2026, 9, 14, 0, 0, 0) / 1000), '2026-10-14');
  });
});

describe('needsLegacyLookup', () => {
  it('is true for a relative vote stored without an official score', () => {
    assert.equal(needsLegacyLookup(row({ official_score: null })), true);
  });

  it('is false when the official score was stored', () => {
    assert.equal(needsLegacyLookup(row({ official_score: 6 })), false);
  });

  it('is false for an absolute (rating) vote', () => {
    assert.equal(needsLegacyLookup(row({ rating: 3, official_score: null })), false);
  });
});

describe('perceivedScore: absolute ratings (grey countries)', () => {
  it('maps ratings 1..5 to 2, 4, 6, 8, 10', () => {
    const got = [1, 2, 3, 4, 5].map((rating) => perceivedScore(row({ rating }), NO_LOOKUP));
    assert.deepEqual(got, [2, 4, 6, 8, 10]);
  });

  it('rejects ratings outside 1..5 and non-integers', () => {
    for (const rating of [0, 6, 2.5, -1]) {
      assert.equal(perceivedScore(row({ rating }), NO_LOOKUP), null, `rating ${rating} must be rejected`);
    }
  });

  it('ignores the delta placeholder on rating rows', () => {
    assert.equal(perceivedScore(row({ rating: 4, delta: 0, official_score: null }), NO_LOOKUP), 8);
  });
});

describe('perceivedScore: relative votes (scored countries)', () => {
  it('is the stored score plus 0.5 * delta', () => {
    assert.ok(Math.abs(perceivedScore(row({ official_score: 7.25, delta: -1 }), NO_LOOKUP)! - 6.75) < 1e-12);
    assert.ok(Math.abs(perceivedScore(row({ official_score: 7.25, delta: 2 }), NO_LOOKUP)! - 8.25) < 1e-12);
    assert.ok(Math.abs(perceivedScore(row({ official_score: 7.25, delta: -2 }), NO_LOOKUP)! - 6.25) < 1e-12);
  });

  it('anchors a legacy row to the published score of its UTC date', () => {
    const calls: Array<[string, string]> = [];
    const lookup: PublishedScoreLookup = {
      scoreOn: (iso3, date) => {
        calls.push([iso3, date]);
        return 7;
      },
    };
    const legacy = row({ official_score: null, delta: 2, created_at: Date.UTC(2026, 9, 13, 8) / 1000 });
    assert.equal(perceivedScore(legacy, lookup), 8);
    assert.deepEqual(calls, [['AAA', '2026-10-13']]);
  });

  it('is null for a legacy row whose score cannot be resolved', () => {
    assert.equal(perceivedScore(row({ official_score: null, delta: 1 }), NO_LOOKUP), null);
  });

  it('treats an out-of-range stored score as missing and falls back to the lookup', () => {
    for (const bad of [0, 11, Number.NaN]) {
      const lookup: PublishedScoreLookup = { scoreOn: () => 5 };
      assert.equal(perceivedScore(row({ official_score: bad, delta: 0 }), lookup), 5, `stored ${bad}`);
    }
  });

  it('rejects a delta outside -2..+2 or non-integer, even when the score is known', () => {
    for (const delta of [3, -3, 1.5]) {
      assert.equal(perceivedScore(row({ delta }), NO_LOOKUP), null, `delta ${delta} must be rejected`);
    }
  });
});
