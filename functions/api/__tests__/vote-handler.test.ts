import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { onRequestPost } from '../vote.ts';
import { resetPublishedScoreCache } from '../../lib/published-scores.ts';
import { buildPublishedScoresPayload } from '../../../src/lib/published-scores.ts';

// End-to-end tests of POST /api/vote against an in-memory stand-in for D1 and env.ASSETS.
// They pin the formula-v10 contract (SPEC §5): the server records the published score, grey
// countries take a rating, scored countries take a delta, and a vote whose type cannot be
// verified is refused.

/** Real ISO3 codes from the vote allowlist; every one is published with a numeric score. */
const SCORED = [
  'FRA', 'ITA', 'ESP', 'DEU', 'GBR', 'PRT', 'GRC', 'AUT', 'BEL', 'NLD', 'CHE', 'SWE', 'NOR', 'DNK',
  'FIN', 'IRL', 'POL', 'CZE', 'HUN', 'ROU', 'BGR', 'HRV', 'SVN', 'SVK', 'EST', 'LVA', 'LTU', 'MLT',
  'CYP', 'LUX', 'ISL', 'USA', 'CAN', 'MEX', 'BRA', 'ARG', 'CHL', 'PER', 'COL', 'JPN', 'CHN', 'KOR',
  'THA', 'VNM', 'IDN', 'MYS', 'SGP', 'PHL', 'AUS', 'NZL', 'ZAF', 'EGY', 'MAR', 'TUR', 'ARE',
];
/** Grey country: no official score (v10 scoreStatus insufficient_data). Åland is the SPEC example. */
const GREY = 'ALA';
const FRA_SCORE = 7.25;

function publishedCountries(omit: string[] = []): Array<{ iso3: string; score: number | null; scoreStatus?: string }> {
  const scored = SCORED.filter((iso3) => !omit.includes(iso3)).map((iso3) => ({
    iso3,
    score: iso3 === 'FRA' ? FRA_SCORE : 6,
  }));
  return [...scored, { iso3: GREY, score: null, scoreStatus: 'insufficient_data' }];
}

/**
 * /published-scores.json exactly as the build writes it (src/pages/published-scores.json.ts uses
 * the same builder), so these tests exercise the real producer/consumer contract.
 */
function published(omit: string[] = []) {
  return buildPublishedScoresPayload(publishedCountries(omit), '2026-10-14');
}

interface StoredVote {
  iso3: string;
  delta: number;
  official_score: number | null;
  voter_hash: string;
  day_hash: string;
  created_at: number;
  country_iso: string | null;
  rating: number | null;
}

/**
 * Just enough of the D1 prepare/bind/first/run surface the handler uses. `hasRatingColumn: false`
 * models the live database before migration 005: any statement naming `rating` fails the way D1
 * does ("no such column: rating").
 */
function fakeDb(opts: { hasRatingColumn?: boolean } = {}) {
  const hasRatingColumn = opts.hasRatingColumn ?? true;
  const rows: StoredVote[] = [];
  return {
    rows,
    prepare(sql: string) {
      if (!hasRatingColumn && /\brating\b/.test(sql)) {
        throw new Error('no such column: rating: SQLITE_ERROR');
      }
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              if (sql.includes('voter_hash = ?')) {
                const [iso3, voter, since] = args as [string, string, number];
                const n = rows.filter((r) => r.iso3 === iso3 && r.voter_hash === voter && r.created_at > since).length;
                return { n };
              }
              if (sql.includes('day_hash = ?')) {
                const [day, since] = args as [string, number];
                return { n: rows.filter((r) => r.day_hash === day && r.created_at > since).length };
              }
              throw new Error(`unexpected SELECT: ${sql}`);
            },
            async run() {
              const match = /^INSERT OR IGNORE INTO votes \(([^)]+)\) VALUES/.exec(sql);
              if (!match) throw new Error(`unexpected write: ${sql}`);
              // Map the bound values by the column list the handler actually wrote, like SQLite does:
              // a column the statement leaves out keeps its default (NULL for rating).
              const columns = match[1].split(',').map((c) => c.trim());
              assert.equal(args.length, columns.length, 'one bound value per named column');
              const value = (name: string): unknown => {
                const i = columns.indexOf(name);
                return i === -1 ? null : args[i];
              };
              const row: StoredVote = {
                iso3: value('iso3') as string,
                delta: value('delta') as number,
                official_score: value('official_score') as number | null,
                voter_hash: value('voter_hash') as string,
                day_hash: value('day_hash') as string,
                created_at: value('created_at') as number,
                country_iso: value('country_iso') as string | null,
                rating: value('rating') as number | null,
              };
              if (rows.some((r) => r.iso3 === row.iso3 && r.voter_hash === row.voter_hash)) {
                return { meta: { changes: 0 } };
              }
              rows.push(row);
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

/** Fake env.ASSETS: serves a published-scores body and records every requested URL. */
function fakeAssets(payload: unknown, opts: { status?: number } = {}) {
  const calls: string[] = [];
  return {
    calls,
    async fetch(input: URL | string): Promise<Response> {
      calls.push(String(input));
      return new Response(JSON.stringify(payload), {
        status: opts.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  };
}

interface CtxOptions {
  body?: unknown;
  rawBody?: string;
  contentType?: string;
  ip?: string;
  country?: string;
  db?: ReturnType<typeof fakeDb>;
  assets?: unknown;
}

function makeContext(o: CtxOptions) {
  const headers: Record<string, string> = {
    'Content-Type': o.contentType ?? 'application/json',
    'CF-Connecting-IP': o.ip ?? '198.51.100.9',
  };
  if (o.country) headers['CF-IPCountry'] = o.country;
  return {
    request: new Request('https://isitsafetotravel.org/api/vote', {
      method: 'POST',
      headers,
      body: o.rawBody ?? JSON.stringify(o.body),
    }),
    env: { DB: o.db, ASSETS: o.assets, VOTE_HASH_SALT: 'test-salt' },
  };
}

async function post(o: CtxOptions): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await onRequestPost(makeContext(o));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  resetPublishedScoreCache();
});

describe('POST /api/vote: scored country takes a relative delta', () => {
  it('stores the PUBLISHED score and ignores a client-sent officialScore', async () => {
    const db = fakeDb();
    const assets = fakeAssets(published());
    const out = await post({ body: { iso3: 'FRA', delta: 1, officialScore: 99 }, db, assets });
    assert.equal(out.status, 200);
    assert.deepEqual(out.body, { ok: true });
    assert.equal(db.rows.length, 1);
    assert.equal(db.rows[0].official_score, FRA_SCORE, 'stored score must be the published one, not 99');
    assert.equal(db.rows[0].delta, 1);
    assert.equal(db.rows[0].rating, null);
  });

  it('reads /published-scores.json from the same origin as the request', async () => {
    const assets = fakeAssets(published());
    await post({ body: { iso3: 'FRA', delta: -2 }, db: fakeDb(), assets });
    assert.deepEqual(assets.calls, ['https://isitsafetotravel.org/published-scores.json']);
  });

  it('rejects a rating for a scored country (400, nothing stored)', async () => {
    const db = fakeDb();
    const out = await post({ body: { iso3: 'FRA', rating: 3 }, db, assets: fakeAssets(published()) });
    assert.equal(out.status, 400);
    assert.equal(out.body.reason, 'invalid_input');
    assert.equal(db.rows.length, 0);
  });

  it('rejects a delta outside -2..+2 (400)', async () => {
    const out = await post({ body: { iso3: 'FRA', delta: 3 }, db: fakeDb(), assets: fakeAssets(published()) });
    assert.equal(out.status, 400);
  });

  it('rejects a non-integer delta (400)', async () => {
    const out = await post({ body: { iso3: 'FRA', delta: 1.5 }, db: fakeDb(), assets: fakeAssets(published()) });
    assert.equal(out.status, 400);
  });
});

describe('POST /api/vote: grey country takes an absolute rating', () => {
  it('accepts ratings 1..5, stores rating with official_score NULL and the delta placeholder 0', async () => {
    const db = fakeDb();
    const assets = fakeAssets(published());
    for (let rating = 1; rating <= 5; rating++) {
      const out = await post({ body: { iso3: GREY, rating }, ip: `198.51.100.${rating}`, db, assets });
      assert.equal(out.status, 200, `rating ${rating} must be accepted`);
    }
    assert.equal(db.rows.length, 5);
    assert.deepEqual(db.rows.map((r) => r.rating), [1, 2, 3, 4, 5]);
    for (const row of db.rows) {
      assert.equal(row.official_score, null, 'a grey country has no published score to store');
      assert.equal(row.delta, 0, 'delta is NOT NULL in D1: rating rows store the 0 placeholder');
    }
  });

  it('rejects a delta for a grey country (400)', async () => {
    const db = fakeDb();
    const out = await post({ body: { iso3: GREY, delta: 1 }, db, assets: fakeAssets(published()) });
    assert.equal(out.status, 400);
    assert.equal(db.rows.length, 0);
  });

  it('rejects a delta sent together with a rating (400)', async () => {
    const out = await post({ body: { iso3: GREY, rating: 4, delta: 1 }, db: fakeDb(), assets: fakeAssets(published()) });
    assert.equal(out.status, 400);
  });

  it('rejects ratings outside 1..5 and non-integers (400)', async () => {
    const assets = fakeAssets(published());
    for (const rating of [0, 6, 2.5, '3', true]) {
      const out = await post({ body: { iso3: GREY, rating }, db: fakeDb(), assets });
      assert.equal(out.status, 400, `rating ${JSON.stringify(rating)} must be rejected`);
    }
  });

  it('treats null fields as absent: delta null with rating 4 is accepted', async () => {
    const db = fakeDb();
    const out = await post({ body: { iso3: GREY, rating: 4, delta: null }, db, assets: fakeAssets(published()) });
    assert.equal(out.status, 200);
    assert.equal(db.rows[0].rating, 4);
  });
});

describe('POST /api/vote: vote type cannot be verified -> 503 score_unavailable', () => {
  it('refuses a country absent from the published scores', async () => {
    const db = fakeDb();
    const out = await post({ body: { iso3: 'ITA', delta: 1 }, db, assets: fakeAssets(published(['ITA'])) });
    assert.equal(out.status, 503);
    assert.equal(out.body.reason, 'score_unavailable');
    assert.equal(db.rows.length, 0);
  });

  it('refuses when the ASSETS binding is missing', async () => {
    const db = fakeDb();
    const out = await post({ body: { iso3: 'FRA', delta: 1 }, db, assets: undefined });
    assert.equal(out.status, 503);
    assert.equal(db.rows.length, 0);
  });

  it('refuses when the published-scores file answers with an HTTP error', async () => {
    const out = await post({ body: { iso3: 'FRA', delta: 1 }, db: fakeDb(), assets: fakeAssets({}, { status: 500 }) });
    assert.equal(out.status, 503);
  });

  it('refuses when the published-scores file has no scores map', async () => {
    const out = await post({ body: { iso3: 'FRA', delta: 1 }, db: fakeDb(), assets: fakeAssets({ date: '2026-10-14' }) });
    assert.equal(out.status, 503);
  });
});

describe('published score cache (per isolate)', () => {
  it('reads the published scores once and reuses them for later votes', async () => {
    const assets = fakeAssets(published());
    const db = fakeDb();
    await post({ body: { iso3: 'FRA', delta: 1 }, ip: '198.51.100.1', db, assets });
    await post({ body: { iso3: 'ITA', delta: -1 }, ip: '198.51.100.2', db, assets });
    assert.equal(assets.calls.length, 1, 'the second vote must be served from the isolate cache');
    assert.equal(db.rows.length, 2);
  });

  it('does not cache a failed read, so the next vote retries', async () => {
    const db = fakeDb();
    const failing = await post({ body: { iso3: 'FRA', delta: 1 }, db, assets: fakeAssets({}, { status: 500 }) });
    assert.equal(failing.status, 503);
    const healthy = fakeAssets(published());
    const ok = await post({ body: { iso3: 'FRA', delta: 1 }, ip: '198.51.100.3', db, assets: healthy });
    assert.equal(ok.status, 200);
    assert.equal(healthy.calls.length, 1);
    assert.equal(db.rows[0].official_score, FRA_SCORE);
  });

  it('resetPublishedScoreCache forces a fresh read', async () => {
    const assets = fakeAssets(published());
    const db = fakeDb();
    await post({ body: { iso3: 'FRA', delta: 1 }, ip: '198.51.100.4', db, assets });
    resetPublishedScoreCache();
    await post({ body: { iso3: 'FRA', delta: 1 }, ip: '198.51.100.5', db, assets });
    assert.equal(assets.calls.length, 2);
  });
});

describe('POST /api/vote: database before migration 005 (no votes.rating column)', () => {
  it('still stores a relative vote, because its INSERT never names the rating column', async () => {
    const db = fakeDb({ hasRatingColumn: false });
    const out = await post({ body: { iso3: 'FRA', delta: -1 }, db, assets: fakeAssets(published()) });
    assert.equal(out.status, 200);
    assert.deepEqual(out.body, { ok: true });
    assert.equal(db.rows.length, 1);
    assert.equal(db.rows[0].official_score, FRA_SCORE);
    assert.equal(db.rows[0].rating, null);
  });

  it('cannot store an absolute vote (needs the column) and says so with ok:false', async () => {
    const db = fakeDb({ hasRatingColumn: false });
    const out = await post({ body: { iso3: GREY, rating: 4 }, db, assets: fakeAssets(published()) });
    assert.equal(out.body.ok, false, 'the widget must not thank the visitor for a vote that was not stored');
    assert.equal(db.rows.length, 0);
  });
});

describe('unchanged guards (dedupe, caps, origin, input shape)', () => {
  it('deduplicates the same visitor voting twice for the same country on the same day', async () => {
    const db = fakeDb();
    const assets = fakeAssets(published());
    await post({ body: { iso3: 'FRA', delta: 1 }, db, assets });
    const again = await post({ body: { iso3: 'FRA', delta: -1 }, db, assets });
    assert.deepEqual(again.body, { ok: true, deduped: true });
    assert.equal(db.rows.length, 1);
  });

  it('caps one visitor at 30 votes per UTC day (the 31st is rate limited)', async () => {
    const db = fakeDb();
    const assets = fakeAssets(published());
    for (let i = 0; i < 30; i++) {
      const out = await post({ body: { iso3: SCORED[i], delta: 0 }, db, assets });
      assert.equal(out.status, 200, `vote ${i + 1} must pass`);
    }
    const capped = await post({ body: { iso3: SCORED[30], delta: 0 }, db, assets });
    assert.equal(capped.status, 429);
    assert.equal(capped.body.reason, 'rate');
    assert.equal(db.rows.length, 30);
  });

  it('stores the voter origin from the CF-IPCountry header', async () => {
    const db = fakeDb();
    await post({ body: { iso3: 'FRA', delta: 1 }, country: 'IT', db, assets: fakeAssets(published()) });
    assert.equal(db.rows[0].country_iso, 'IT');
  });

  it('rejects a non-JSON content type with 415', async () => {
    const out = await post({ rawBody: 'iso3=FRA', contentType: 'application/x-www-form-urlencoded', db: fakeDb(), assets: fakeAssets(published()) });
    assert.equal(out.status, 415);
  });

  it('rejects malformed JSON with 400', async () => {
    const out = await post({ rawBody: '{"iso3":', db: fakeDb(), assets: fakeAssets(published()) });
    assert.equal(out.status, 400);
    assert.equal(out.body.reason, 'invalid_json');
  });

  it('rejects an oversized body with 413', async () => {
    const out = await post({ rawBody: JSON.stringify({ iso3: 'FRA', delta: 1, pad: 'x'.repeat(2000) }), db: fakeDb(), assets: fakeAssets(published()) });
    assert.equal(out.status, 413);
  });

  it('rejects an unknown ISO3 before any lookup (400)', async () => {
    const assets = fakeAssets(published());
    const out = await post({ body: { iso3: 'XX', delta: 1 }, db: fakeDb(), assets });
    assert.equal(out.status, 400);
    assert.equal(assets.calls.length, 0, 'an invalid iso3 must not trigger a published-scores read');
  });
});
