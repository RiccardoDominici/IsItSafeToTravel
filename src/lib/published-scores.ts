/**
 * The published score of every country, in the compact form the vote endpoint reads
 * (formula v10, SPEC §5: "S_shown = the published score at vote time, stored server-side").
 *
 * WHY a separate file instead of /scores.json: functions/api/vote.ts reads the published score
 * through env.ASSETS on each cold isolate, and votes are sparse enough that nearly every vote
 * lands on a cold isolate. Parsing the 1.6 MB /scores.json measured 8-17 ms of CPU locally,
 * against the 10 ms per-request CPU budget of the Workers Free plan that Pages Functions run
 * under. This payload carries only iso3 -> score (about 5 KB), and it is generated in the same
 * `astro build`, from the same loadLatestScores() data, as the country pages themselves, so it
 * holds exactly the score the visitor saw on the page that sent the vote.
 *
 * Grey rule (SPEC §4): a country whose score is not a finite number (v10 `score: null`,
 * `scoreStatus: 'insufficient_data'`) has no official score. The UI (SentimentVote,
 * SentimentPillar) and this payload use the same predicate, isGreyScore, so the widget a page
 * renders (relative delta vs absolute rating) always matches what the endpoint accepts.
 *
 * Pure module: no Node imports, so pages, endpoints and tests can all use it.
 */

/** Public path of the payload, served from the static build (src/pages/published-scores.json.ts). */
export const PUBLISHED_SCORES_PUBLIC_PATH = '/published-scores.json';

/** Shape of /published-scores.json. `null` marks a grey country (no official score). */
export interface PublishedScoresPayload {
  /** Snapshot date the scores come from (YYYY-MM-DD), for traceability; null if unknown. */
  date: string | null;
  scores: Record<string, number | null>;
}

/**
 * True when a country has no official score: anything but a finite number. Today every score is a
 * number, so nothing is grey; under formula v10 an `insufficient_data` country publishes null.
 */
export function isGreyScore(score: unknown): boolean {
  return !(typeof score === 'number' && Number.isFinite(score));
}

/** The published score as stored for a vote: the number itself, or null for a grey country. */
export function publishedScoreOf(score: unknown): number | null {
  return isGreyScore(score) ? null : (score as number);
}

/**
 * Build the payload from the scored countries the pages render. Entries without a string iso3 are
 * skipped (they could not be voted on anyway: the vote API validates iso3 against an allowlist).
 */
export function buildPublishedScoresPayload(
  countries: ReadonlyArray<{ iso3?: unknown; score?: unknown }>,
  date: string | null,
): PublishedScoresPayload {
  const scores: Record<string, number | null> = {};
  for (const country of countries) {
    if (typeof country.iso3 !== 'string') continue;
    scores[country.iso3] = publishedScoreOf(country.score);
  }
  return { date, scores };
}
