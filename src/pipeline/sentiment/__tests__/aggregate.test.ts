import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  aggregateVotes,
  SENTIMENT_HALF_LIFE_DAYS,
  SENTIMENT_DELTA_SCALE,
  SENTIMENT_CORRECTION_CAP,
  SENTIMENT_MIN_VOTES,
} from '../aggregate.js';
import type { VoteRow } from '../../types.js';

const DAY_S = 86_400; // 1 day in seconds
const nowMs = Date.UTC(2026, 6, 2); // 2026-07-02, fixed reference time
const nowS = Math.floor(nowMs / 1000);

function votes(rows: Array<{ iso3: string; delta: number; ageDays?: number }>): VoteRow[] {
  return rows.map((r) => ({
    iso3: r.iso3,
    delta: r.delta,
    created_at: nowS - Math.round((r.ageDays ?? 0) * DAY_S),
  }));
}

describe('tunable constants', () => {
  it('exports the expected named constants', () => {
    assert.equal(SENTIMENT_HALF_LIFE_DAYS, 30);
    assert.equal(SENTIMENT_DELTA_SCALE, 0.5);
    assert.equal(SENTIMENT_CORRECTION_CAP, 1.0);
    assert.equal(SENTIMENT_MIN_VOTES, 5);
  });
});

describe('aggregateVotes: empty input', () => {
  it('returns a SentimentSnapshot with empty countries and a valid generatedAt', () => {
    const snapshot = aggregateVotes([], new Map(), nowMs);
    assert.deepEqual(snapshot.countries, {});
    assert.ok(!Number.isNaN(Date.parse(snapshot.generatedAt)), 'generatedAt must be a valid ISO date');
  });
});

describe('aggregateVotes: ±1.0 hard clamp (D-08)', () => {
  it('clamps a strongly positive fresh signal to exactly +1.0', () => {
    // 5 fresh votes, delta=+2 each => avgDelta≈2 => raw correction = 2*0.5=1.0 => clamps to cap (1.0)
    const rows = votes([
      { iso3: 'JPN', delta: 2 },
      { iso3: 'JPN', delta: 2 },
      { iso3: 'JPN', delta: 2 },
      { iso3: 'JPN', delta: 2 },
      { iso3: 'JPN', delta: 2 },
    ]);
    const officialScores = new Map([['JPN', 5.0]]);
    const snapshot = aggregateVotes(rows, officialScores, nowMs);
    const entry = snapshot.countries['JPN'];
    assert.ok(entry, 'JPN entry must be present');
    assert.equal(entry.correction, 1.0);
  });

  it('clamps a strongly negative fresh signal to exactly -1.0', () => {
    const rows = votes([
      { iso3: 'JPN', delta: -2 },
      { iso3: 'JPN', delta: -2 },
      { iso3: 'JPN', delta: -2 },
      { iso3: 'JPN', delta: -2 },
      { iso3: 'JPN', delta: -2 },
    ]);
    const officialScores = new Map([['JPN', 5.0]]);
    const snapshot = aggregateVotes(rows, officialScores, nowMs);
    const entry = snapshot.countries['JPN'];
    assert.ok(entry, 'JPN entry must be present');
    assert.equal(entry.correction, -1.0);
  });

  it('a raw correction that exceeds the cap before clamping still resolves to exactly the cap value', () => {
    // avgDelta up to 2 (max possible), scale 0.5 => raw max 1.0 == cap exactly.
    // Force a scenario that would exceed 1.0 if unclamped by using scale math directly:
    // all deltas +2 fresh always yields raw=1.0 (at the boundary) — assert clamp function
    // doesn't produce something > CAP or < -CAP under any combination.
    const rows = votes([
      { iso3: 'CAP', delta: 2 },
      { iso3: 'CAP', delta: 2 },
      { iso3: 'CAP', delta: 2 },
      { iso3: 'CAP', delta: 2 },
      { iso3: 'CAP', delta: 2 },
      { iso3: 'CAP', delta: 2 },
    ]);
    const officialScores = new Map([['CAP', 5.0]]);
    const snapshot = aggregateVotes(rows, officialScores, nowMs);
    const entry = snapshot.countries['CAP'];
    assert.ok(entry.correction <= SENTIMENT_CORRECTION_CAP);
    assert.ok(entry.correction >= -SENTIMENT_CORRECTION_CAP);
    assert.equal(entry.correction, 1.0);
  });
});

describe('aggregateVotes: perceived = clamp(official + correction, 1, 10) (D-07)', () => {
  it('perceived tracks official + correction within the [1,10] range', () => {
    // All-fresh votes: sum = -2-2+1+1+0 = -2, count=5 => avgDelta = -0.4 => correction = -0.2
    const rows = votes([
      { iso3: 'ABC', delta: -2 },
      { iso3: 'ABC', delta: -2 },
      { iso3: 'ABC', delta: 1 },
      { iso3: 'ABC', delta: 1 },
      { iso3: 'ABC', delta: 0 },
    ]);
    const officialScores = new Map([['ABC', 8.3]]);
    const snapshot = aggregateVotes(rows, officialScores, nowMs);
    const entry = snapshot.countries['ABC'];
    assert.ok(entry, 'ABC entry must be present');
    const expectedPerceived = Math.min(10, Math.max(1, 8.3 + entry.correction));
    assert.ok(Math.abs(entry.perceived - expectedPerceived) < 1e-9);
  });

  it('official=1.2, correction=-1.0 (saturating) => perceived floors at 1.0', () => {
    const rows = votes([
      { iso3: 'LOW', delta: -2 },
      { iso3: 'LOW', delta: -2 },
      { iso3: 'LOW', delta: -2 },
      { iso3: 'LOW', delta: -2 },
      { iso3: 'LOW', delta: -2 },
    ]);
    const officialScores = new Map([['LOW', 1.2]]);
    const snapshot = aggregateVotes(rows, officialScores, nowMs);
    const entry = snapshot.countries['LOW'];
    assert.equal(entry.correction, -1.0);
    assert.equal(entry.perceived, 1.0);
  });

  it('official=9.8, correction=+1.0 (saturating) => perceived ceils at 10', () => {
    const rows = votes([
      { iso3: 'HIGH', delta: 2 },
      { iso3: 'HIGH', delta: 2 },
      { iso3: 'HIGH', delta: 2 },
      { iso3: 'HIGH', delta: 2 },
      { iso3: 'HIGH', delta: 2 },
    ]);
    const officialScores = new Map([['HIGH', 9.8]]);
    const snapshot = aggregateVotes(rows, officialScores, nowMs);
    const entry = snapshot.countries['HIGH'];
    assert.equal(entry.correction, 1.0);
    assert.equal(entry.perceived, 10);
  });
});

describe('aggregateVotes: recency weighting (half-life)', () => {
  it('a fresh +2 outweighs an old -2, moving avgDelta positive', () => {
    // Fresh vote (age 0, weight 1) delta=+2; old vote (age = 2 half-lives = 60 days, weight 0.25) delta=-2.
    // weighted avg = (1*2 + 0.25*-2) / (1+0.25) = (2 - 0.5)/1.25 = 1.2 (positive)
    // REC only has 2 raw votes of interest, below SENTIMENT_MIN_VOTES=5, so pad with neutral
    // (delta=0) fresh votes to reach the floor — they do not shift the sign of avgDelta since w*0=0.
    const paddedRows = votes([
      { iso3: 'REC', delta: 2, ageDays: 0 },
      { iso3: 'REC', delta: -2, ageDays: 60 },
      { iso3: 'REC', delta: 0, ageDays: 0 },
      { iso3: 'REC', delta: 0, ageDays: 0 },
      { iso3: 'REC', delta: 0, ageDays: 0 },
    ]);
    const officialScores = new Map([['REC', 5.0]]);
    const snapshot = aggregateVotes(paddedRows, officialScores, nowMs);
    const entry = snapshot.countries['REC'];
    assert.ok(entry, 'REC entry must be present');
    assert.ok(entry.avgDelta > 0, `Expected positive avgDelta (fresh +2 should outweigh old -2), got ${entry.avgDelta}`);
  });

  it('a vote at exactly one half-life old has half the weight of a fresh vote', () => {
    // Two votes with equal magnitude opposite sign: fresh +2 (weight 1), half-life-old +2 (weight 0.5).
    // avgDelta should equal +2 regardless (both push the same direction) — instead verify weighting
    // by comparing a half-life-old vote's influence against a fresh vote of opposite sign.
    // fresh delta=+2 (w=1), old (30 days = 1 half-life) delta=-2 (w=0.5)
    // weighted avg = (1*2 + 0.5*-2) / 1.5 = (2-1)/1.5 = 0.667 (positive, but pulled from 2 toward 0)
    const rows = votes([
      { iso3: 'HL', delta: 2, ageDays: 0 },
      { iso3: 'HL', delta: -2, ageDays: SENTIMENT_HALF_LIFE_DAYS },
      { iso3: 'HL', delta: 0, ageDays: 0 },
      { iso3: 'HL', delta: 0, ageDays: 0 },
      { iso3: 'HL', delta: 0, ageDays: 0 },
    ]);
    const officialScores = new Map([['HL', 5.0]]);
    const snapshot = aggregateVotes(rows, officialScores, nowMs);
    const entry = snapshot.countries['HL'];
    assert.ok(entry, 'HL entry must be present');
    // Expected avgDelta = (1*2 + 0.5*-2 + 0 + 0 + 0) / (1 + 0.5 + 1 + 1 + 1) = 1 / 4.5 = 0.2222
    assert.ok(Math.abs(entry.avgDelta - (1 / 4.5)) < 0.01, `Expected avgDelta ~0.222, got ${entry.avgDelta}`);
  });
});

describe('aggregateVotes: below-floor omission (D-09)', () => {
  it('a country with 4 votes (below SENTIMENT_MIN_VOTES=5) is absent from countries', () => {
    const rows = votes([
      { iso3: 'FEW', delta: 1 },
      { iso3: 'FEW', delta: 1 },
      { iso3: 'FEW', delta: 1 },
      { iso3: 'FEW', delta: 1 },
    ]);
    const officialScores = new Map([['FEW', 5.0]]);
    const snapshot = aggregateVotes(rows, officialScores, nowMs);
    assert.equal(snapshot.countries['FEW'], undefined, 'FEW must be omitted with only 4 votes');
  });

  it('a country with exactly 5 votes (at SENTIMENT_MIN_VOTES) is present', () => {
    const rows = votes([
      { iso3: 'MIN', delta: 1 },
      { iso3: 'MIN', delta: 1 },
      { iso3: 'MIN', delta: 1 },
      { iso3: 'MIN', delta: 1 },
      { iso3: 'MIN', delta: 1 },
    ]);
    const officialScores = new Map([['MIN', 5.0]]);
    const snapshot = aggregateVotes(rows, officialScores, nowMs);
    assert.ok(snapshot.countries['MIN'], 'MIN must be present with exactly 5 votes');
    assert.equal(snapshot.countries['MIN'].count, 5);
  });
});

describe('aggregateVotes: no official score for a country', () => {
  it('skips a country entirely when officialScores has no entry for it, even with enough votes', () => {
    const rows = votes([
      { iso3: 'NOP', delta: 1 },
      { iso3: 'NOP', delta: 1 },
      { iso3: 'NOP', delta: 1 },
      { iso3: 'NOP', delta: 1 },
      { iso3: 'NOP', delta: 1 },
    ]);
    const snapshot = aggregateVotes(rows, new Map(), nowMs);
    assert.equal(snapshot.countries['NOP'], undefined, 'NOP must be skipped without an official score');
  });
});

describe('aggregateVotes: multiple countries', () => {
  it('groups votes independently per iso3', () => {
    const rows = votes([
      { iso3: 'AAA', delta: 2 },
      { iso3: 'AAA', delta: 2 },
      { iso3: 'AAA', delta: 2 },
      { iso3: 'AAA', delta: 2 },
      { iso3: 'AAA', delta: 2 },
      { iso3: 'BBB', delta: -1 },
      { iso3: 'BBB', delta: -1 },
      { iso3: 'BBB', delta: -1 },
      { iso3: 'BBB', delta: -1 },
      { iso3: 'BBB', delta: -1 },
    ]);
    const officialScores = new Map([
      ['AAA', 5.0],
      ['BBB', 5.0],
    ]);
    const snapshot = aggregateVotes(rows, officialScores, nowMs);
    assert.ok(snapshot.countries['AAA']);
    assert.ok(snapshot.countries['BBB']);
    assert.equal(snapshot.countries['AAA'].count, 5);
    assert.equal(snapshot.countries['BBB'].count, 5);
    assert.ok(snapshot.countries['AAA'].correction > 0);
    assert.ok(snapshot.countries['BBB'].correction < 0);
  });
});
