// Canonical safety-score band helper, shared by the news engine and (eventually) the UI.
// Extracted from src/components/country/ScoreHero.astro's inline verdict thresholds
// (>=8/>=7/>=6/>=5) so band-crossing detection and the on-page score bands never disagree.
// NOTE: ScoreHero.astro itself is NOT rewired to use this yet (its verdict copy uses a
// different label set: excellent/good/caution/risky/danger) — only the numeric thresholds
// are shared. See PLAN-news.md "bands.ts" section.
import type { BandKey } from '../pipeline/news/types';

export const BAND_ORDER: BandKey[] = ['danger', 'high_caution', 'moderate', 'good', 'excellent'];

/** Band on the displayed 1-decimal score, matching CLAUDE.md's frozen thresholds. */
export function getBand(score: number): BandKey {
  const s = Number(score.toFixed(1));
  if (s >= 8) return 'excellent';
  if (s >= 7) return 'good';
  if (s >= 6) return 'moderate';
  if (s >= 5) return 'high_caution';
  return 'danger';
}

export function bandDirection(from: BandKey, to: BandKey): 'up' | 'down' {
  return BAND_ORDER.indexOf(to) > BAND_ORDER.indexOf(from) ? 'up' : 'down';
}

// Kept in sync manually with src/pipeline/news/types.ts BAND_HYSTERESIS (0.03). Inlined
// (not imported) so this shared lib module never needs a runtime import from the pipeline
// layer — see PLAN-news.md.
const BAND_HYSTERESIS = 0.03;

/**
 * True when a band crossing is a real move, not boundary flap: the raw score must sit
 * >=BAND_HYSTERESIS past the single crossed boundary (a multi-band jump is always real).
 * Directional: an upward cross needs curr >= boundary + h, a downward one curr <= boundary − h —
 * an absolute-distance check would confirm display-rounding "crossings" whose raw score never
 * reached the boundary (e.g. 6.94 -> 6.96 rendering as 6.9 -> 7.0).
 */
export function bandCrossConfirmed(prevRaw: number, currRaw: number): boolean {
  const from = getBand(prevRaw);
  const to = getBand(currRaw);
  if (from === to) return false;
  const fi = BAND_ORDER.indexOf(from);
  const ti = BAND_ORDER.indexOf(to);
  if (Math.abs(fi - ti) >= 2) return true;
  const boundary = 4 + Math.max(fi, ti); // idx1->bd5, idx2->bd6, idx3->bd7, idx4->bd8
  const curr = Number(currRaw.toFixed(2));
  return ti > fi ? curr - boundary >= BAND_HYSTERESIS : boundary - curr >= BAND_HYSTERESIS;
}
