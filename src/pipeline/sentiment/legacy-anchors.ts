import { isScore } from './perceive.js';

/**
 * Frozen anchors for legacy community votes (formula v10, SPEC §5).
 *
 * A relative vote ("does this score feel right?") is placed at S_shown + 0.5 * delta, where S_shown
 * is the score its voter saw. Until the vote API stored that score in `official_score`, every row
 * was saved without it. data/sentiment/legacy-anchors.json holds, for each of those rows, the score
 * that was LIVE on the site when the vote was cast, reconstructed once from master's git history by
 * scripts/build-legacy-vote-anchors.ts (method and validation in that script's header).
 *
 * It is a frozen one-off table, not pipeline output: rows recorded after the API started storing
 * `official_score` never need it, and the history it was read from does not change.
 *
 * WHY not the per-day snapshots data/scores/YYYY-MM-DD.json alone: they were regenerated after the
 * fact (formula v9, then v9.1, on 2026-07-08), so for the July votes they hold scores no voter ever
 * saw (China was live at 2.66 on 4 July; the regenerated snapshot says 6.51). A per-day file also
 * cannot tell a vote cast before that day's deploy from one cast after it.
 *
 * Pure module: the key format and the table's validation, shared by the builder and the pipeline.
 */

/** Location of the table, relative to the repository root. */
export const LEGACY_ANCHORS_PATH = 'data/sentiment/legacy-anchors.json';

/** Shape of data/sentiment/legacy-anchors.json. Only `anchors` is read by the pipeline. */
export interface LegacyAnchorsFile {
  /** What the table is and who writes it (JSON cannot carry a comment). */
  note: string;
  /** How "live when the vote was cast" was decided. */
  rule: string;
  /** Commit of master whose history was read. */
  ref: string;
  /** legacyAnchorKey(iso3, created_at) -> score live at that moment, in vote order. */
  anchors: Record<string, number>;
}

/** `ISO3|YYYY-MM-DDTHH:MM:SSZ`, exactly as legacyAnchorKey writes it. */
const KEY_PATTERN = /^[A-Z]{3}\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/**
 * Key of one legacy vote: the voted country and the vote's `created_at` in UTC to the second,
 * e.g. `CHN|2026-07-04T03:24:41Z`.
 *
 * WHY this key rather than votes.id: it is the row's own immutable content (votes are append-only,
 * created_at is server time at insert), so it survives a table rebuild or re-import that renumbers
 * ids, and because it names the country it can never anchor one country's vote on another's score.
 * It needs no extra column in the pipeline's D1 read and carries no voter hash. It is also the
 * exact input of "what was live then", so anyone can audit an entry against the git history. Two
 * votes on the same country in the same second would share an entry, which is correct: they saw
 * the same score. (On 2026-10-14 the key was unique across all 322 legacy rows.)
 */
export function legacyAnchorKey(iso3: string, createdAt: number): string {
  return `${iso3}|${new Date(createdAt * 1000).toISOString().slice(0, 19)}Z`;
}

/**
 * The usable entries of a parsed table: well-formed keys whose value is a score on the 1..10
 * scale. Anything else is counted in `rejected` and left out, so the pipeline falls back to the
 * snapshots for that row instead of trusting a damaged entry.
 */
export function parseLegacyAnchors(data: unknown): { anchors: Map<string, number>; rejected: number } {
  const anchors = new Map<string, number>();
  let rejected = 0;

  const table = typeof data === 'object' && data !== null ? (data as { anchors?: unknown }).anchors : undefined;
  if (typeof table !== 'object' || table === null || Array.isArray(table)) return { anchors, rejected };

  for (const [key, value] of Object.entries(table)) {
    if (KEY_PATTERN.test(key) && isScore(value)) anchors.set(key, value);
    else rejected++;
  }
  return { anchors, rejected };
}
