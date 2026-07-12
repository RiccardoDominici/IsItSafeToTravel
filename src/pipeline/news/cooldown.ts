// Daily News / "Safety Movers" — cooldown suppression + deterministic sort/cap.
import { BAND_ORDER } from '../../lib/bands.js';
import type { NewsEvent, NewsEventType } from './types.js';
import { daysBetween, MAX_EVENTS_PER_DAY } from './types.js';

// Cooldown window (days) per event type; Infinity = any stored entry suppresses forever.
const WINDOW: Record<NewsEventType, number> = {
  rank_overtake: 14,
  score_jump: 7,
  band_change: 14,
  top10_change: 14,
  severe_advisory: 21,
  new_country: Infinity,
};

export function cooldownKey(e: NewsEvent): string {
  switch (e.type) {
    case 'rank_overtake':
      return `overtake:${[e.params.country, e.params.other].sort().join('|')}`;
    case 'score_jump':
      return `jump:${e.params.country}`;
    case 'band_change':
      return `band:${e.params.country}`;
    case 'top10_change':
      return `top10:${e.params.country}`;
    case 'severe_advisory':
      return `advisory:${e.params.country}:${e.params.issuer}`;
    case 'new_country':
      return `newcountry:${e.params.country}`;
    default:
      return `unknown:${(e as NewsEvent).type}`;
  }
}

function magnitude(e: NewsEvent): number {
  switch (e.type) {
    case 'score_jump':
      return Math.abs(e.params.delta ?? 0);
    case 'band_change':
      return Math.abs(BAND_ORDER.indexOf(e.params.toBand!) - BAND_ORDER.indexOf(e.params.fromBand!));
    case 'rank_overtake':
    case 'top10_change':
      return 1 / (e.params.rank ?? 999);
    case 'severe_advisory':
      return e.params.level ?? 0;
    default:
      return 0;
  }
}

/** Drop cooled-down events, sort deterministically (priority desc, then magnitude, then id), cap. */
export function filterSortCap(events: NewsEvent[], cooldowns: Record<string, string>, date: string): NewsEvent[] {
  const alive = events.filter((e) => {
    const seen = cooldowns[cooldownKey(e)];
    if (!seen) return true;
    return daysBetween(seen, date) >= WINDOW[e.type]; // Infinity window => always suppressed
  });

  alive.sort(
    (a, b) => b.priority - a.priority || magnitude(b) - magnitude(a) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id),
  );

  return alive.slice(0, MAX_EVENTS_PER_DAY);
}
