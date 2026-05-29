import type { APIRoute } from 'astro';
import { loadLatestScores } from '../lib/scores';

export const prerender = true;

// Slim dataset for the homepage world map. SafetyMap.astro only needs each country's
// iso3, localized names, composite score, per-pillar name+score, and advisory source
// keys + level. The full per-country payload (pillar indicators, sources, advisory
// text/url/dates) stays in /scores.json — that remains the public downloadable dataset.
// This cuts the homepage map fetch from ~1.37 MB to ~128 KB (≈19 KB gzipped) and a
// far smaller JSON parse on the main thread.
export const GET: APIRoute = () => {
  const countries = loadLatestScores().map((c) => {
    const advisories: Record<string, { level: number | string }> = {};
    for (const [key, adv] of Object.entries(c.advisories || {})) {
      if (adv && (adv as { level?: number | string }).level !== undefined) {
        advisories[key] = { level: (adv as { level: number | string }).level };
      }
    }
    return {
      iso3: c.iso3,
      name: c.name,
      score: c.score,
      scoreDisplay: c.scoreDisplay,
      pillars: c.pillars.map((p) => ({ name: p.name, score: p.score })),
      advisories,
    };
  });
  return new Response(JSON.stringify({ countries }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
