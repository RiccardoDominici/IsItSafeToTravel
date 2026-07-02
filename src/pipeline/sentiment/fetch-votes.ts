import type { VoteRow } from '../types.js';

/**
 * Read raw sentiment vote rows from Cloudflare D1 over the HTTP query API,
 * for the daily pipeline's "Stage 6: Sentiment" aggregation step.
 *
 * This module NEVER throws (D-14): missing credentials, network errors,
 * non-2xx responses, and malformed JSON all degrade to `{ ok: false, rows: [] }`
 * so a D1 permissions gap or an outage never breaks the daily pipeline run.
 */

/** D1 database id for the sentiment votes table (see wrangler.toml `[[d1_databases]]`). */
export const SENTIMENT_D1_DATABASE_ID = '83acaffe-32ff-43fc-b68f-5343d01000d5';

interface D1QueryResultRow {
  iso3: string;
  delta: number;
  created_at: number;
}

interface D1QueryResponse {
  result?: Array<{ results?: D1QueryResultRow[] }>;
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
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${SENTIMENT_D1_DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT iso3, delta, created_at FROM votes WHERE created_at > ? ORDER BY created_at DESC;',
          params: [sinceEpochSeconds],
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      console.warn(`[Sentiment] D1 query failed: HTTP ${response.status}`);
      return { ok: false, rows: [] };
    }

    const json = (await response.json()) as D1QueryResponse;
    const results = json.result?.[0]?.results ?? [];

    const rows: VoteRow[] = results.map((r) => ({
      iso3: r.iso3,
      delta: r.delta,
      created_at: r.created_at,
    }));

    return { ok: true, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Sentiment] D1 query failed: ${message}`);
    return { ok: false, rows: [] };
  }
}
