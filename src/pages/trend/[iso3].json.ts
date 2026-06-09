import type { APIRoute, GetStaticPaths } from 'astro';
import {
  loadHistoricalScores,
  loadLatestScores,
  loadPillarHistory,
  type HistoryPoint,
  type PillarHistoryData,
} from '../../lib/scores';

export const prerender = true;

// Per-country trend payload for the country-page TrendChart: composite history +
// per-pillar history in one cacheable JSON asset (e.g. /trend/ita.json). The chart
// fetches this lazily instead of inlining ~250KB of history into every page's HTML.
const history = loadHistoricalScores();

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export const getStaticPaths: GetStaticPaths = () =>
  loadLatestScores().map((c) => ({ params: { iso3: c.iso3.toLowerCase() } }));

export const GET: APIRoute = ({ params }) => {
  const iso3 = (params.iso3 ?? '').toUpperCase();

  const points: HistoryPoint[] = (history.get(iso3) ?? []).map((p) =>
    p.dc !== undefined
      ? { date: p.date, score: round2(p.score), dc: round2(p.dc) }
      : { date: p.date, score: round2(p.score) }
  );

  const rawPillars = loadPillarHistory(iso3);
  let pillars: PillarHistoryData | null = null;
  if (rawPillars) {
    pillars = Object.fromEntries(
      Object.entries(rawPillars).map(([pillar, pts]) => [
        pillar,
        // Pillar scores are on a 0-1 scale → 3 decimals keep display precision.
        pts.map((p) => ({ date: p.date, score: round3(p.score) })),
      ])
    ) as PillarHistoryData;
  }

  return new Response(JSON.stringify({ history: points, pillars }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
