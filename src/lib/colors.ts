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

/** Parses either our own "rgb(r, g, b)" mixer output or a "#rrggbb" hex anchor. */
function parseColorToRgb(color: string): [number, number, number] {
  if (color.startsWith('#')) return hexToRgb(color);
  const parts = color.match(/\d+/g);
  if (!parts || parts.length < 3) return [255, 255, 255];
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

function srgbChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of an 8-bit sRGB triple. */
function relLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b)
  );
}

/** WCAG contrast ratio between two relative luminances. */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const DARK_TEXT_LUM = relLuminance(28, 25, 23); // relative luminance of #1c1917

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
 * Pick readable text (WCAG) for an arbitrary background: white or near-black,
 * whichever gives the higher contrast ratio against `bg`.
 *
 * Originally a fixed relative-luminance threshold (0.30) tuned only for the
 * 3-stop score scale above (its comment: "danger/safe bands keep white, their
 * large bold score numbers pass AA-large at ~8:1 and ~4:1"). This function is
 * now also called for *small* badge text (advisory-level pills, table score
 * chips) that needs the full 4.5:1, not just 3:1 — and the fixed threshold
 * picked the wrong (lower-contrast) option for some inputs, e.g. the level-4
 * advisory red #ef4444 (white -> 3.76:1, FAIL; dark -> 4.65:1, PASS). Always
 * computing both ratios and returning the winner is strictly better or equal
 * for every existing caller and correct for any future one (2026-09 contrast
 * fix; see verify-contrast measurements in that commit).
 */
export function readableTextColor(bg: string): '#ffffff' | '#1c1917' {
  const [r, g, b] = parseColorToRgb(bg);
  const L = relLuminance(r, g, b);
  const whiteRatio = contrastRatio(L, 1.0);
  const darkRatio = contrastRatio(L, DARK_TEXT_LUM);
  return darkRatio >= whiteRatio ? '#1c1917' : '#ffffff';
}
