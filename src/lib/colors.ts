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

// --- sRGB <-> OKLCH, for badgeColors' lightness-only darkening step below ---
// (Matrices: Björn Ottosson's OKLab reference, https://bottosson.github.io/posts/oklab/)

function srgbToOklch(r: number, g: number, b: number): [number, number, number] {
  const [rl, gl, bl] = [r, g, b].map((c) => srgbChannelToLinear(c));
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  const H = (Math.atan2(bb, a) * 180) / Math.PI;
  return [L, C, H];
}

function oklchToSrgb(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * bb;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const rl = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const linearToSrgbByte = (c: number): number => {
    const clamped = Math.min(1, Math.max(0, c));
    const s = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, s)) * 255);
  };
  return [linearToSrgbByte(rl), linearToSrgbByte(gl), linearToSrgbByte(bl)];
}

/**
 * Background + text color for a *small* score chip/badge (table score cells,
 * the global-score pill, ...) — these need the full 4.5:1, unlike the large
 * score hero (>=24px bold) which only needs 3:1 and keeps the original
 * gradient untouched; see readableTextColor above for that case, and never
 * use this for the map fill or its legend (2026-09 contrast fix).
 *
 * Starts from the same scoreToColor/pillarToColor gradient. Around score
 * ~4.6-4.9, and again from ~8.7 through the clamped 8.9-10 tail, neither
 * white nor #1c1917 reaches 4.5:1 against it (measured worst case ~4.20:1
 * and ~4.23:1) — a real gap in the 3-stop DANGER/MODERATE/SAFE gradient, not
 * something readableTextColor's white-vs-dark choice can fix. When that
 * happens this darkens the background in small OKLCH lightness steps (same
 * hue/chroma, so it still reads as "the same colour, just deeper") until
 * white text clears 4.5:1, and returns that darkened background instead.
 */
export function badgeColors(score: number): { bg: string; fg: '#ffffff' | '#1c1917' } {
  const bg = scoreToColor(score);
  let [r, g, b] = parseColorToRgb(bg);
  let L = relLuminance(r, g, b);
  const bestRatio = Math.max(contrastRatio(L, 1.0), contrastRatio(L, DARK_TEXT_LUM));

  if (bestRatio < 4.5) {
    const [okL, okC, okH] = srgbToOklch(r, g, b);
    const STEP = 0.005;
    for (let stepL = okL - STEP; stepL > 0; stepL -= STEP) {
      const [nr, ng, nb] = oklchToSrgb(stepL, okC, okH);
      if (contrastRatio(relLuminance(nr, ng, nb), 1.0) >= 4.5) {
        r = nr;
        g = ng;
        b = nb;
        L = relLuminance(nr, ng, nb);
        break;
      }
    }
  }

  const fg = contrastRatio(L, 1.0) >= contrastRatio(L, DARK_TEXT_LUM) ? '#ffffff' : '#1c1917';
  return { bg: `rgb(${r}, ${g}, ${b})`, fg };
}
