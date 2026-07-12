// Daily News / "Safety Movers" — event schema + tuning constants.
// See .planning/quick/260711-daily-news-and-mailing-list/PLAN-news.md for the full spec.
//
// Events are language-neutral: params carry ONLY ISO3 codes, numbers, and enum keys —
// NEVER localized text. Rendering into copy happens at build/send time via src/lib/news.ts.

export type NewsEventType =
  | 'severe_advisory'
  | 'new_country'
  | 'top10_change'
  | 'band_change'
  | 'rank_overtake'
  | 'score_jump';

export type BandKey = 'excellent' | 'good' | 'moderate' | 'high_caution' | 'danger';

export interface NewsEventParams {
  country?: string; // primary iso3 (all types except pure-pair use this as the subject)
  other?: string; // secondary iso3 (rank_overtake: the overtaken country)
  delta?: number; // signed score delta, 2dp (score_jump)
  score?: number; // new score, 1dp
  prevScore?: number; // previous score, 1dp
  rank?: number; // 1-based global "safest" rank (rank_overtake / top10_change)
  direction?: 'up' | 'down' | 'enter' | 'exit';
  fromBand?: BandKey; // band_change
  toBand?: BandKey; // band_change
  issuer?: string; // advisory issuer code, subset of MAJOR_ISSUERS
  level?: number; // advisory level 3|4
  /**
   * INTERNAL ONLY — never rendered. Scoring-engine confidence (0-1) of the subject
   * country (min of the pair for rank_overtake) at generation time. Present on the
   * coverage-gated types (score_jump, band_change, top10_change, rank_overtake) for
   * observability/tuning; renderers must ignore it.
   */
  confidence?: number;
}

export interface NewsEvent {
  id: string; // deterministic: `${date}:${type}:${country}[:${other|issuer}]`
  date: string; // YYYY-MM-DD (the run date; used in copy, NOT generatedAt)
  type: NewsEventType;
  priority: number;
  params: NewsEventParams;
}

// Day file: data/news/YYYY-MM-DD.json
export interface NewsDayFile {
  date: string;
  generatedAt: string;
  events: NewsEvent[];
}

// Rolling index: data/news/index.json
export interface NewsIndex {
  generatedAt: string;
  lastProcessedDate: string;
  cooldowns: Record<string, string>; // key -> YYYY-MM-DD (last date this key fired)
  recentEvents: NewsEvent[]; // last ARCHIVE_DAYS days, rebuilt each run, date desc
}

// --- Tuning constants (frozen — see PLAN-news.md "Tuning constants") ---

/** >=0.15 day-over-day on the ~[3.4,8.9] scale is a real move, not rounding. */
export const SCORE_JUMP_MIN = 0.15;
/** Overtakes only newsworthy near the top of the safest ranking. */
export const RANK_OVERTAKE_MAX_RANK = 40;
/** Today's score gap between the pair must exceed float noise. */
export const RANK_OVERTAKE_MIN_GAP = 0.02;
/** At least one of the pair moved >=0.05 in score (not a pure tie-break flip). */
export const RANK_OVERTAKE_MIN_MOVE = 0.05;
/**
 * Raw score must sit >=BAND_HYSTERESIS past the crossed band boundary (kills 6.99<->7.01
 * flap). Duplicated (not imported) in src/lib/bands.ts to keep that shared UI helper
 * dependency-free of the pipeline layer — keep both values in sync manually.
 */
export const BAND_HYSTERESIS = 0.03;
/** Fire on new advisory level >=3 ("Reconsider Travel") or 4 ("Do Not Travel"). */
export const SEVERE_ADVISORY_MIN_LEVEL = 3;
/** Big-four advisory issuers only (avoids 37-issuer noise). */
export const MAJOR_ISSUERS = ['us', 'uk', 'ca', 'au'] as const;
/** If prev snapshot is more than this many days stale, skip movement events (keep new_country). */
export const MAX_DIFF_GAP_DAYS = 7;
/**
 * Movement events (score_jump, band_change, top10_change, rank_overtake) are suppressed
 * for countries whose scoring-engine `confidence` is below this — a low-coverage score
 * moves mostly because its prior/advisory nudge moves, and that is not news. Aligned with
 * the "limited data" UI flag threshold (ScoreHero); severe_advisory and new_country are
 * exempt (real external facts, meaningful regardless of coverage).
 */
export const MIN_NEWS_CONFIDENCE = 0.4;
/** Hard daily cap on persisted events (highest-priority kept). */
export const MAX_EVENTS_PER_DAY = 15;
/** Homepage section shows at most this many events. */
export const HOMEPAGE_MAX = 5;
/** Rolling window (days) for the news page + index.recentEvents. */
export const ARCHIVE_DAYS = 30;

/** Higher = more prominent. Used for sort order + the daily cap. */
export const PRIORITY: Record<NewsEventType, number> = {
  severe_advisory: 100,
  new_country: 90,
  top10_change: 80,
  band_change: 70,
  rank_overtake: 60,
  score_jump: 50,
};

/** Whole-day difference (b - a) between two YYYY-MM-DD dates. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
