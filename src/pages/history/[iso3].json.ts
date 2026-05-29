import type { APIRoute, GetStaticPaths } from 'astro';
import { loadHistoricalScores, loadLatestScores } from '../../lib/scores';

export const prerender = true;

// Full per-country score history, emitted as one cacheable JSON asset per country
// (e.g. /history/ita.json). The compare page fetches only the selected countries on
// demand instead of inlining the entire ~11MB history dataset into every page's HTML.
const history = loadHistoricalScores();

export const getStaticPaths: GetStaticPaths = () =>
  loadLatestScores().map((c) => ({ params: { iso3: c.iso3.toLowerCase() } }));

export const GET: APIRoute = ({ params }) => {
  const iso3 = (params.iso3 ?? '').toUpperCase();
  const points = history.get(iso3) ?? [];
  return new Response(JSON.stringify(points), {
    headers: { 'Content-Type': 'application/json' },
  });
};
