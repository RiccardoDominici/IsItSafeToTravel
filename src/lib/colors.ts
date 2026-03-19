import { scaleLinear, interpolateRgb } from 'd3';

// MUST match src/lib/map-utils.ts hex constants exactly
const DANGER_HEX = '#9e3a2a';   // oklch(0.55 0.20 25) - score 1
const MODERATE_HEX = '#d4b83c'; // oklch(0.85 0.15 90) - score 5.5
const SAFE_HEX = '#4a7fbf';    // oklch(0.65 0.15 250) - score 10

const colorScale = scaleLinear<string>()
  .domain([1, 5.5, 10])
  .range([DANGER_HEX, MODERATE_HEX, SAFE_HEX])
  .interpolate(interpolateRgb)
  .clamp(true);

/** Maps a safety score (1-10) to a hex color string, matching the map color scale. */
export function scoreToColor(score: number): string {
  return colorScale(score);
}

/** Maps a pillar score (0-1) to a hex color string using the shared scale. */
export function pillarToColor(normalizedScore: number): string {
  // Pillar scores are 0-1, map to 1-10 for the color scale
  return colorScale(normalizedScore * 9 + 1);
}
