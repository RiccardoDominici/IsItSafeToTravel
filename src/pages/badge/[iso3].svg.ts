import type { APIRoute, GetStaticPaths } from 'astro';
import { loadLatestScores } from '../../lib/scores';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const countries = loadLatestScores();
  return countries.map((c) => ({
    params: { iso3: c.iso3.toLowerCase() },
    props: { name: c.name.en, score: c.score },
  }));
};

export const GET: APIRoute = ({ props }) => {
  const { name, score } = props as { name: string; score: number };
  const roundedScore = score.toFixed(1);

  // Color based on score
  let bgColor: string;
  let accentColor: string;
  if (score >= 7) {
    bgColor = '#065f46'; // emerald-800
    accentColor = '#34d399'; // emerald-400
  } else if (score >= 4) {
    bgColor = '#92400e'; // amber-800
    accentColor = '#fbbf24'; // amber-400
  } else {
    bgColor = '#991b1b'; // red-800
    accentColor = '#f87171'; // red-400
  }

  // Escape XML special chars in country name
  const escapedName = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1c1917"/>
      <stop offset="100%" stop-color="#292524"/>
    </linearGradient>
  </defs>
  <rect width="300" height="80" rx="8" fill="url(#bg)"/>
  <rect x="0" y="0" width="8" height="80" rx="8" fill="${bgColor}"/>
  <rect x="4" y="0" width="4" height="80" fill="${bgColor}"/>
  <text x="20" y="22" font-family="system-ui,-apple-system,sans-serif" font-size="10" fill="#a8a29e">IsItSafeToTravel.org</text>
  <text x="20" y="45" font-family="system-ui,-apple-system,sans-serif" font-size="16" font-weight="bold" fill="#fafaf9">${escapedName}</text>
  <text x="20" y="65" font-family="system-ui,-apple-system,sans-serif" font-size="11" fill="#a8a29e">Safety Score</text>
  <text x="280" y="52" font-family="system-ui,-apple-system,sans-serif" font-size="28" font-weight="bold" fill="${accentColor}" text-anchor="end">${roundedScore}</text>
  <text x="280" y="68" font-family="system-ui,-apple-system,sans-serif" font-size="11" fill="#78716c" text-anchor="end">/10</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
