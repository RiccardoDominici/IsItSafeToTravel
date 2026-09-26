/**
 * Color for each unified advisory level (1-4). Mirrors
 * src/components/country/AdvisoryCard.astro's existing level->color mapping
 * exactly (green/yellow/orange/red) so the same 1-4 scale reads identically
 * everywhere it appears on the site — the country page's advisory cards, the
 * government-advisories hub/issuer pages, and the governments-disagree page
 * (see src/components/gov-advisories/LevelBadge.astro / LevelDistributionBars.astro).
 */
export const ADVISORY_LEVEL_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: '#22c55e',
  2: '#eab308',
  3: '#f97316',
  4: '#ef4444',
};
