import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { aggregateVotes } from '../aggregate.js';
import {
  SENTIMENT_ABSOLUTE_SCORES,
  SENTIMENT_DELTA_SCALE,
  SENTIMENT_HALF_LIFE_DAYS,
  SENTIMENT_MIN_ORIGINS,
  SENTIMENT_MIN_VOTES,
  SENTIMENT_ORIGIN_SHARE_CAP,
  SENTIMENT_WINDOW_DAYS,
} from '../constants.js';
import type { PublishedScoreLookup } from '../perceive.js';
import type { VoteRow } from '../../types.js';

const DAY_S = 86_400;
const nowMs = Date.UTC(2026, 9, 14, 12); // 2026-10-14T12:00Z, fixed reference time
const nowS = nowMs / 1000;

const NO_LOOKUP: PublishedScoreLookup = { scoreOn: () => null };

/** Build a vote. Defaults: relative delta 0, origin FR, stored score 6, cast now. */
function vote(o: {
  iso3?: string;
  delta?: number;
  rating?: number | null;
  official?: number | null;
  origin?: string | null;
  ageDays?: number;
} = {}): VoteRow {
  return {
    iso3: o.iso3 ?? 'AAA',
    delta: o.delta ?? 0,
    rating: o.rating ?? null,
    official_score: o.official === undefined ? 6 : o.official,
    country_iso: o.origin === undefined ? 'FR' : o.origin,
    created_at: nowS - Math.round((o.ageDays ?? 0) * DAY_S),
  };
}

/** n votes whose origin cycles through `origins` (null = unknown). */
function fromOrigins(origins: Array<string | null>, n: number, base: Partial<Parameters<typeof vote>[0]> = {}): VoteRow[] {
  return Array.from({ length: n }, (_, i) => vote({ ...base, origin: origins[i % origins.length] }));
}

describe('tunable constants (formula v10, SPEC §5)', () => {
  it('exports the v10 values', () => {
    assert.equal(SENTIMENT_WINDOW_DAYS, 180);
    assert.equal(SENTIMENT_HALF_LIFE_DAYS, 30);
    assert.equal(SENTIMENT_MIN_VOTES, 30);
    assert.equal(SENTIMENT_MIN_ORIGINS, 3);
    assert.equal(SENTIMENT_ORIGIN_SHARE_CAP, 0.5);
    assert.equal(SENTIMENT_DELTA_SCALE, 0.5);
    assert.deepEqual([...SENTIMENT_ABSOLUTE_SCORES], [2, 4, 6, 8, 10]);
  });
});

describe('aggregateVotes: empty input', () => {
  it('returns no countries, zero dropped votes and a valid generatedAt', () => {
    const { snapshot, droppedVotes } = aggregateVotes([], NO_LOOKUP, nowMs);
    assert.deepEqual(snapshot.countries, {});
    assert.equal(droppedVotes, 0);
    assert.ok(!Number.isNaN(Date.parse(snapshot.generatedAt)));
  });
});

describe('aggregateVotes: activation floors (>= 30 votes AND >= 3 known origins)', () => {
  const five = ['FR', 'IT', 'ES', 'DE', 'NL'];

  it('is insufficient with 29 votes even from 5 origins', () => {
    const { snapshot } = aggregateVotes(fromOrigins(five, 29), NO_LOOKUP, nowMs);
    const entry = snapshot.countries['AAA'];
    assert.equal(entry.votes, 29);
    assert.equal(entry.origins, 5);
    assert.equal(entry.status, 'insufficient');
  });

  it('is active with exactly 30 votes from exactly 3 origins', () => {
    const { snapshot } = aggregateVotes(fromOrigins(['FR', 'IT', 'ES'], 30), NO_LOOKUP, nowMs);
    const entry = snapshot.countries['AAA'];
    assert.equal(entry.votes, 30);
    assert.equal(entry.origins, 3);
    assert.equal(entry.status, 'active');
  });

  it('is insufficient with 30 votes from only 2 origins', () => {
    const { snapshot } = aggregateVotes(fromOrigins(['FR', 'IT'], 30), NO_LOOKUP, nowMs);
    assert.equal(snapshot.countries['AAA'].status, 'insufficient');
  });

  it('does not count the unknown group as one of the 3 origins', () => {
    const { snapshot } = aggregateVotes(fromOrigins(['FR', 'IT', null], 30), NO_LOOKUP, nowMs);
    const entry = snapshot.countries['AAA'];
    assert.equal(entry.origins, 2);
    assert.equal(entry.status, 'insufficient');
  });

  it('treats T1 (Tor) and XX (unknown) as unknown, never as countries of origin', () => {
    const { snapshot } = aggregateVotes(fromOrigins(['FR', 'IT', 'T1', 'XX'], 40), NO_LOOKUP, nowMs);
    const entry = snapshot.countries['AAA'];
    assert.equal(entry.origins, 2);
    assert.equal(entry.status, 'insufficient');
  });

  it('normalises lowercase origins to the same country', () => {
    const { snapshot } = aggregateVotes(
      fromOrigins(['fr', 'FR', 'it', 'es'], 30),
      NO_LOOKUP,
      nowMs,
    );
    assert.equal(snapshot.countries['AAA'].origins, 3);
  });
});

describe('aggregateVotes: origin cap (no origin above 50% of weight)', () => {
  it('caps a 60% home origin to exactly 50% of the weight', () => {
    // 6 votes from FR and 4 from four other countries, all fresh: FR holds 6 / 10 = 60%.
    const rows = [
      ...fromOrigins(['FR'], 6),
      vote({ origin: 'IT' }),
      vote({ origin: 'ES' }),
      vote({ origin: 'DE' }),
      vote({ origin: 'NL' }),
    ];
    const entry = aggregateVotes(rows, NO_LOOKUP, nowMs).snapshot.countries['AAA'];
    assert.ok(Math.abs(entry.topOriginShare - 0.5) < 1e-12, `topOriginShare ${entry.topOriginShare} must be exactly 0.5`);
  });

  it('applies the cap to recency weights, not to vote counts', () => {
    // 4 FR votes 30 days old (weight 0.5 each = 2.0) vs 2 IT votes fresh (weight 1 each = 2.0):
    // by count FR is 67%, by weight it is exactly 50%, so nothing is capped.
    const rows = [
      ...fromOrigins(['FR'], 4, { ageDays: SENTIMENT_HALF_LIFE_DAYS }),
      vote({ origin: 'IT' }),
      vote({ origin: 'IT' }),
    ];
    const entry = aggregateVotes(rows, NO_LOOKUP, nowMs).snapshot.countries['AAA'];
    assert.ok(Math.abs(entry.topOriginShare - 0.5) < 1e-12);
  });

  it('never caps a lone origin: it is the only signal, with share 1', () => {
    const entry = aggregateVotes(fromOrigins(['FR'], 40), NO_LOOKUP, nowMs).snapshot.countries['AAA'];
    assert.equal(entry.topOriginShare, 1);
    assert.equal(entry.origins, 1);
    assert.equal(entry.status, 'insufficient');
  });
});

describe('aggregateVotes: perceived score P', () => {
  it('relative votes: S_shown + 0.5 * delta, averaged with equal weights', () => {
    // Stored score 6 with deltas +2, -2, 0 from three origins -> 7, 5, 6 -> mean 6.
    const rows = [
      vote({ origin: 'FR', delta: 2 }),
      vote({ origin: 'IT', delta: -2 }),
      vote({ origin: 'ES', delta: 0 }),
    ];
    const entry = aggregateVotes(rows, NO_LOOKUP, nowMs).snapshot.countries['AAA'];
    assert.ok(Math.abs(entry.perceived - 6) < 1e-12, `perceived ${entry.perceived}`);
  });

  it('uses the score stored with the vote and never calls the lookup for it', () => {
    const calls: string[] = [];
    const spy: PublishedScoreLookup = {
      scoreOn: (iso3, date) => {
        calls.push(`${iso3}:${date}`);
        return 1;
      },
    };
    const rows = [
      vote({ origin: 'FR', delta: 1, official: 6 }),
      vote({ origin: 'IT', delta: 1, official: 6 }),
      vote({ origin: 'ES', delta: 1, official: 6 }),
    ];
    const entry = aggregateVotes(rows, spy, nowMs).snapshot.countries['AAA'];
    assert.deepEqual(calls, []);
    assert.ok(Math.abs(entry.perceived - 6.5) < 1e-12);
  });

  it('legacy relative votes are anchored to the published score of their UTC date', () => {
    // 2026-10-13 published 7 for AAA. Three legacy votes cast on that day with delta +2 -> 8 each.
    const yesterday = nowS - DAY_S;
    const legacy: VoteRow = {
      iso3: 'AAA',
      delta: 2,
      rating: null,
      official_score: null,
      country_iso: 'FR',
      created_at: yesterday,
    };
    const lookup: PublishedScoreLookup = {
      scoreOn: (iso3, date) => (iso3 === 'AAA' && date === '2026-10-13' ? 7 : null),
    };
    const rows = [
      legacy,
      { ...legacy, country_iso: 'IT' },
      { ...legacy, country_iso: 'ES' },
    ];
    const entry = aggregateVotes(rows, lookup, nowMs).snapshot.countries['AAA'];
    assert.ok(Math.abs(entry.perceived - 8) < 1e-12, `perceived ${entry.perceived}`);
  });

  it('absolute ratings map to 2, 4, 6, 8, 10 on the same scale', () => {
    const rows = [1, 2, 3, 4, 5].map((rating, i) => vote({ rating, origin: ['FR', 'IT', 'ES', 'DE', 'NL'][i] }));
    const entry = aggregateVotes(rows, NO_LOOKUP, nowMs).snapshot.countries['AAA'];
    // (2 + 4 + 6 + 8 + 10) / 5 = 6
    assert.ok(Math.abs(entry.perceived - 6) < 1e-12);
  });

  it('combines relative and absolute votes on the same perceived scale', () => {
    const rows = [
      vote({ origin: 'FR', delta: 0, official: 6 }), // 6
      vote({ origin: 'IT', rating: 5 }), // 10
    ];
    const entry = aggregateVotes(rows, NO_LOOKUP, nowMs).snapshot.countries['AAA'];
    assert.ok(Math.abs(entry.perceived - 8) < 1e-12);
  });

  it('drops votes that cannot be placed and counts them', () => {
    const rows = [
      vote({ origin: 'FR', delta: 1 }), // placeable
      { ...vote({ origin: 'IT', delta: 1 }), official_score: null }, // legacy, lookup has no score
      vote({ origin: 'ES', delta: 5 }), // delta out of range
      vote({ origin: 'DE', rating: 7 }), // rating out of range
    ];
    const { snapshot, droppedVotes } = aggregateVotes(rows, NO_LOOKUP, nowMs);
    assert.equal(droppedVotes, 3);
    assert.equal(snapshot.countries['AAA'].votes, 1);
  });

  it('omits a country whose votes are all unplaceable', () => {
    const rows = [vote({ iso3: 'BBB', delta: 9 })];
    const { snapshot, droppedVotes } = aggregateVotes(rows, NO_LOOKUP, nowMs);
    assert.equal(snapshot.countries['BBB'], undefined);
    assert.equal(droppedVotes, 1);
  });
});

describe('aggregateVotes: recency and window', () => {
  it('a vote one half-life old carries half the weight of a fresh one', () => {
    // FR fresh (p=7, w=1); IT and DE 30 days old (p=5 and p=6, w=0.5 each). P = (7 + 2.5 + 3) / 2.
    const rows = [
      vote({ origin: 'FR', delta: 2 }),
      vote({ origin: 'IT', delta: -2, ageDays: SENTIMENT_HALF_LIFE_DAYS }),
      vote({ origin: 'DE', delta: 0, ageDays: SENTIMENT_HALF_LIFE_DAYS }),
    ];
    const entry = aggregateVotes(rows, NO_LOOKUP, nowMs).snapshot.countries['AAA'];
    assert.ok(Math.abs(entry.perceived - 6.25) < 1e-12, `perceived ${entry.perceived}`);
  });

  it('votes older than the 180-day window are ignored and not counted as dropped', () => {
    const rows = [vote({ origin: 'FR', delta: 2, ageDays: SENTIMENT_WINDOW_DAYS + 20 })];
    const { snapshot, droppedVotes } = aggregateVotes(rows, NO_LOOKUP, nowMs);
    assert.equal(snapshot.countries['AAA'], undefined);
    assert.equal(droppedVotes, 0);
  });
});

describe('aggregateVotes: nEff and output shape', () => {
  it('nEff equals the vote count when the capped weights are equal', () => {
    const rows = ['FR', 'IT', 'ES', 'DE'].map((origin) => vote({ origin }));
    const entry = aggregateVotes(rows, NO_LOOKUP, nowMs).snapshot.countries['AAA'];
    assert.ok(Math.abs(entry.nEff - 4) < 1e-12);
  });

  it('nEff = (sum w)^2 / sum w^2 for unequal weights', () => {
    // weights 1, 0.5, 0.5 (FR fresh, IT and DE a half-life old): no origin above 50%, so no cap.
    // (2)^2 / (1 + 0.25 + 0.25) = 4 / 1.5
    const rows = [
      vote({ origin: 'FR' }),
      vote({ origin: 'IT', ageDays: SENTIMENT_HALF_LIFE_DAYS }),
      vote({ origin: 'DE', ageDays: SENTIMENT_HALF_LIFE_DAYS }),
    ];
    const entry = aggregateVotes(rows, NO_LOOKUP, nowMs).snapshot.countries['AAA'];
    assert.ok(Math.abs(entry.nEff - 4 / 1.5) < 1e-12, `nEff ${entry.nEff}`);
  });

  it('exposes exactly the v10 entry fields the engine and UI read', () => {
    const rows = fromOrigins(['FR', 'IT', 'ES'], 30);
    const entry = aggregateVotes(rows, NO_LOOKUP, nowMs).snapshot.countries['AAA'];
    assert.deepEqual(Object.keys(entry).sort(), [
      'iso3',
      'nEff',
      'origins',
      'perceived',
      'status',
      'topOriginShare',
      'votes',
    ]);
  });
});
