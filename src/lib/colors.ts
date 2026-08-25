// Dependency-free color utilities.
//
// Previously this module imported d3 (scaleLinear + interpolateRgb) just to
// interpolate three hex anchors — which dragged d3-scale/d3-color into every
// client chunk that wanted a score color (TrendChart, ScoreHero, …). The piecewise-linear RGB lerp below produces the same values as d3 for these anchors.

// MUST match src/lib/map-utils.ts hex constants exactly.
// v9 domain re-anchored to the compressed score range (~[3.72 YEM, 8.89 ISL],
// mean 6.75) — see map-utils.ts for rationale.
const DANGER_HEX = '#9e3a2a';   // oklch(0.55 0.20 25) - score 3.7 (v9 danger floor)
const MODERATE_HEX = '#d4b83c'; // oklch(0.85 0.15 90) - score 6.5 (v9 distribution centre)
const SAFE_HEX = '#4a7fbf';    // oklch(0.65 0.15 250) - score 8.9 (v9 excellent ceiling)

const DOMAIN = [3.7, 6.5, 8.9];
const RANGE = [DANGER_HEX, MODERATE_HEX, SAFE_HEX];

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const ch = (i: number): number => Math.round(ca[i] + (cb[i] - ca[i]) * t);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

/** Piecewise-linear interpolation across DOMAIN → RANGE with clamping (d3-compatible output). */
function colorScale(score: number): string {
  if (score <= DOMAIN[0]) return RANGE[0];
  if (score >= DOMAIN[DOMAIN.length - 1]) return RANGE[RANGE.length - 1];
  for (let i = 0; i < DOMAIN.length - 1; i++) {
    if (score >= DOMAIN[i] && score <= DOMAIN[i + 1]) {
      const t = (score - DOMAIN[i]) / (DOMAIN[i + 1] - DOMAIN[i]);
      return mix(RANGE[i], RANGE[i + 1], t);
    }
  }
  return RANGE[0];
}

/** Maps a safety score (1-10) to a CSS color string, matching the map color scale. */
export function scoreToColor(score: number): string {
  return colorScale(score);
}

/** Maps a pillar score (0-1) to a CSS color string using the shared scale. */
export function pillarToColor(normalizedScore: number): string {
  // Pillar scores are 0-1, map to 1-10 for the color scale
  return colorScale(normalizedScore * 9 + 1);
}

/**
 * Pick readable text (WCAG) for a background produced by the scale above.
 *
 * The moderate band (#d4b83c yellow) fails WCAG contrast with white text
 * (~1.9:1) — it needs dark text; the danger/safe bands keep white (their large
 * bold score numbers pass AA-large at ~8:1 and ~4:1 respectively). Threshold is
 * relative luminance 0.30: between SAFE_HEX (≈0.21 → white) and MODERATE_HEX
 * (≈0.46 → dark).
 */
export function readableTextColor(bg: string): '#ffffff' | '#1c1917' {
  let rgb: [number, number, number];
  if (bg.startsWith('#')) {
    rgb = hexToRgb(bg);
  } else {
    // Parse "rgb(r, g, b)" output of our own mixer.
    const parts = bg.match(/\d+/g);
    if (!parts || parts.length < 3) return '#ffffff';
    rgb = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  }
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  return L > 0.3 ? '#1c1917' : '#ffffff';
}
