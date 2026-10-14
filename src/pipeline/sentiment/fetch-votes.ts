import type { VoteRow } from '../types.js';

/**
 * Read raw sentiment vote rows from Cloudflare D1 over the HTTP query API,
 * for the daily pipeline's "Stage 6: Sentiment" aggregation step.
 *
 * This module NEVER throws (D-14): missing credentials, network errors,
 * non-2xx responses, and malformed JSON all degrade to `{ ok: false, rows: [] }`
 * so a D1 permissions gap or an outage never breaks the daily pipeline run.
 *
 * Schema tolerance: votes.rating arrives with migration 005 (formula v10). Until it is applied,
 * selecting it fails with "no such column: rating", which would leave the pipeline on its last
 * pre-v10 latest.json indefinitely. So that one error triggers a second read without the column
 * (every row then has rating null, which is exact: no absolute vote can exist without it).
 */

/** D1 database id for the sentiment votes table (see wrangler.toml `[[d1_databases]]`). */
export const SENTIMENT_D1_DATABASE_ID = '83acaffe-32ff-43fc-b68f-5343d01000d5';

/** Columns the aggregation reads (formula v10). */
export const VOTE_COLUMNS = 'iso3, delta, rating, official_score, country_iso, created_at';

/** Same read for a database where migration 005 (votes.rating) has not been applied yet. */
export const VOTE_COLUMNS_PRE_RATING = 'iso3, delta, official_score, country_iso, created_at';

interface D1QueryResultRow {
  iso3: string;
  delta: number;
  rating?: number | null;
  official_score?: number | null;
  country_iso?: string | null;
  created_at: number;
}

interface D1QueryResponse {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: Array<{ success?: boolean; results?: D1QueryResultRow[] }>;
}

type QueryOutcome =
  | { ok: true; results: D1QueryResultRow[] }
  | { ok: false; missingRatingColumn: boolean };

/** True when D1 reported that votes.rating does not exist (migration 005 not applied). */
function reportsMissingRatingColumn(body: D1QueryResponse | null): boolean {
  return (body?.errors ?? []).some((e) => /no such column:\s*rating\b/i.test(e?.message ?? ''));
}

async function queryVotes(
  accountId: string,
  token: string,
  columns: string,
  sinceEpochSeconds: number,
): Promise<QueryOutcome> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${SENTIMENT_D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `SELECT ${columns} FROM votes WHERE created_at > ? ORDER BY created_at DESC;`,
        params: [sinceEpochSeconds],
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    // Error bodies are JSON on the D1 API; read them only to recognise the missing column.
    const body = (await response.json().catch(() => null)) as D1QueryResponse | null;
    console.warn(`[Sentiment] D1 query failed: HTTP ${response.status}`);
    return { ok: false, missingRatingColumn: reportsMissingRatingColumn(body) };
  }

  const json = (await response.json()) as D1QueryResponse;
  // A 2xx envelope that still reports failure must not read as "zero votes": that would publish an
  // empty community file and wipe every country's community reading.
  if (json.success === false || json.result?.[0]?.success === false) {
    console.warn('[Sentiment] D1 query reported success:false');
    return { ok: false, missingRatingColumn: reportsMissingRatingColumn(json) };
  }
  return { ok: true, results: json.result?.[0]?.results ?? [] };
}

/**
 * Fetch votes created after `sinceEpochSeconds` (unix epoch seconds).
 *
 * @returns `{ ok: true, rows }` on a successful (possibly empty) read,
 *   or `{ ok: false, rows: [] }` on any missing-env/network/parse failure.
 */
export async function fetchVotes(sinceEpochSeconds: number): Promise<{ ok: boolean; rows: VoteRow[] }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  // Prefer the dedicated least-privilege D1 token (Account -> D1 -> Edit only);
  // fall back to the Pages deploy token for setups where it carries D1 scope.
  const token = process.env.CLOUDFLARE_D1_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    console.warn('[Sentiment] CF credentials absent — skipping D1 read');
    return { ok: false, rows: [] };
  }

  try {
    let outcome = await queryVotes(accountId, token, VOTE_COLUMNS, sinceEpochSeconds);
    if (!outcome.ok && outcome.missingRatingColumn) {
      console.warn(
        '[Sentiment] votes.rating does not exist yet (migration 005 not applied) — reading without it',
      );
      outcome = await queryVotes(accountId, token, VOTE_COLUMNS_PRE_RATING, sinceEpochSeconds);
    }
    if (!outcome.ok) return { ok: false, rows: [] };

    // `?? null` keeps the mapping total: a read without the newer columns (pre-migration database,
    // or a stub) maps them to null, and the aggregation treats null as "not stored".
    const rows: VoteRow[] = outcome.results.map((r) => ({
      iso3: r.iso3,
      delta: r.delta,
      rating: r.rating ?? null,
      official_score: r.official_score ?? null,
      country_iso: r.country_iso ?? null,
      created_at: r.created_at,
    }));

    return { ok: true, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Sentiment] D1 query failed: ${message}`);
    return { ok: false, rows: [] };
  }
}
