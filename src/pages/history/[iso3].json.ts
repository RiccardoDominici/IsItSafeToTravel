import type { APIRoute, GetStaticPaths } from 'astro';
import { loadHistoricalScores, loadLatestScores } from '../../lib/scores';

export const prerender = true;

// Full per-country score history, emitted as one cacheable JSON asset per country
// (e.g. /history/ita.json). The compare page fetches only the selected countries on
// demand instead of inlining the entire ~11MB history dataset into every page's HTML.
const history = loadHistoricalScores();

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const getStaticPaths: GetStaticPaths = () =>
  loadLatestScores().map((c) => ({ params: { iso3: c.iso3.toLowerCase() } }));

export const GET: APIRoute = ({ params }) => {
  const iso3 = (params.iso3 ?? '').toUpperCase();
  // Round to 2 decimals — the compare page displays toFixed(2), so no precision loss.
  // Format MUST stay a plain array: the deployed compare page depends on it.
  const points = (history.get(iso3) ?? []).map((p) =>
    p.dc !== undefined
      ? { date: p.date, score: round2(p.score), dc: round2(p.dc) }
      : { date: p.date, score: round2(p.score) }
  );
  return new Response(JSON.stringify(points), {
    headers: { 'Content-Type': 'application/json' },
  });
};
