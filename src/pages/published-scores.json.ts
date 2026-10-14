import type { APIRoute } from 'astro';
import { loadLatestSnapshot } from '../lib/scores';
import { buildPublishedScoresPayload } from '../lib/published-scores';

export const prerender = true;

// iso3 -> published score (null = grey, no official score) for the vote endpoint
// (functions/api/vote.ts via functions/lib/published-scores.ts). Built from the same snapshot as
// the country pages in this deployment, so the score stored with a vote is the one the visitor
// saw. See src/lib/published-scores.ts for why this is not read from the 1.6 MB /scores.json.
export const GET: APIRoute = () => {
  const snapshot = loadLatestSnapshot();
  const payload = buildPublishedScoresPayload(snapshot?.countries ?? [], snapshot?.date ?? null);
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });
};
