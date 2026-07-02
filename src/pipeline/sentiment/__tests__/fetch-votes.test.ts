import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchVotes, SENTIMENT_D1_DATABASE_ID } from '../fetch-votes.js';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ORIGINAL_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

function restoreEnv(): void {
  if (ORIGINAL_ACCOUNT_ID === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
  else process.env.CLOUDFLARE_ACCOUNT_ID = ORIGINAL_ACCOUNT_ID;

  if (ORIGINAL_TOKEN === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
  else process.env.CLOUDFLARE_API_TOKEN = ORIGINAL_TOKEN;
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  restoreEnv();
});

describe('fetchVotes: missing credentials', () => {
  it('returns {ok:false, rows:[]} and does NOT invoke fetch when env vars are absent', async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;

    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error('fetch should not have been called');
    }) as typeof fetch;

    const result = await fetchVotes(0);
    assert.deepEqual(result, { ok: false, rows: [] });
    assert.equal(called, false);
  });

  it('short-circuits when only CLOUDFLARE_ACCOUNT_ID is set', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    delete process.env.CLOUDFLARE_API_TOKEN;

    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error('fetch should not have been called');
    }) as typeof fetch;

    const result = await fetchVotes(0);
    assert.deepEqual(result, { ok: false, rows: [] });
    assert.equal(called, false);
  });
});

describe('fetchVotes: network / parse failure (never throws — D-14)', () => {
  it('returns {ok:false, rows:[]} when fetch rejects', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';

    globalThis.fetch = (async () => {
      throw new Error('network down');
    }) as typeof fetch;

    const result = await fetchVotes(0);
    assert.deepEqual(result, { ok: false, rows: [] });
  });

  it('returns {ok:false, rows:[]} on a non-2xx HTTP response', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';

    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 403,
        json: async () => ({}),
      }) as unknown as Response) as typeof fetch;

    const result = await fetchVotes(0);
    assert.deepEqual(result, { ok: false, rows: [] });
  });

  it('returns {ok:false, rows:[]} when the response body is malformed JSON', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';

    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token in JSON');
        },
      }) as unknown as Response) as typeof fetch;

    const result = await fetchVotes(0);
    assert.deepEqual(result, { ok: false, rows: [] });
  });
});

describe('fetchVotes: successful response', () => {
  it('maps D1 result rows to VoteRow[] and posts to the correct D1 query endpoint', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';

    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: [
            {
              results: [
                { iso3: 'ITA', delta: 1, created_at: 1_700_000_000 },
                { iso3: 'FRA', delta: -2, created_at: 1_700_000_100 },
              ],
            },
          ],
        }),
      } as unknown as Response;
    }) as typeof fetch;

    const result = await fetchVotes(1_699_000_000);

    assert.equal(result.ok, true);
    assert.deepEqual(result.rows, [
      { iso3: 'ITA', delta: 1, created_at: 1_700_000_000 },
      { iso3: 'FRA', delta: -2, created_at: 1_700_000_100 },
    ]);
    assert.ok(
      capturedUrl.includes(
        `https://api.cloudflare.com/client/v4/accounts/test-account/d1/database/${SENTIMENT_D1_DATABASE_ID}/query`,
      ),
    );
    assert.equal((capturedInit?.headers as Record<string, string>)?.Authorization, 'Bearer test-token');
  });

  it('returns {ok:true, rows:[]} on a successful response with zero rows (distinct from ok:false)', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';

    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ result: [{ results: [] }] }),
      }) as unknown as Response) as typeof fetch;

    const result = await fetchVotes(0);
    assert.deepEqual(result, { ok: true, rows: [] });
  });
});
