/**
 * Detects vote-count phrases in reader-facing text, in all 7 site languages.
 *
 * WHY: the owner's rule (2026-10-19) is that the site never says how many community votes a
 * country has. A country page shows either the community rating (once the activation threshold
 * is met) or "not enough votes yet", nothing in between: no "based on 74 votes", no "4/30 votes"
 * progress, no "55 votes" per ranked row, no "Total votes" tile. This module is the one
 * definition of what such a phrase looks like, shared by the unit test
 * (src/lib/__tests__/vote-count-guard.test.ts) and the built-page test
 * (src/__tests__/page-ui-build.test.ts), so a count cannot creep back in through new copy.
 *
 * Pure module (no Node imports). It works on plain text, not HTML: callers strip the tags first.
 *
 * The activation threshold itself ("once a country has 30 votes from at least 3 countries of
 * origin") is a rule, the same for every country, not a count. Callers pass it in
 * `allowedNumbers` so the rule text in the methodology, the API docs and under the community
 * block does not trip the check. A progress fraction ("4/30 votes") is flagged whatever its
 * numbers, since it always carries a country's own count.
 */

/**
 * Vote nouns, singular and plural, in the 7 site languages. The Latin-script words must end
 * there ("3 voters" or "Stimmung" are other words); zh 票 / 票数 has no plural and is usually
 * followed straight away by another Chinese character ("30 票后"), so it takes no such guard.
 */
const VOTE_WORD = String.raw`(?:(?:votes?|voti|votos?|Stimmen?)(?![\p{L}])|票数?)`;

/**
 * A number as the pages print it: digits with optional thousands/decimal separators, including
 * the French narrow no-break space and the no-break space ("1 234"). Must start and end on a digit.
 */
const NUMBER = String.raw`\d(?:[\d.,   ]*\d)?`;

/** The patterns, each with a short name for the failure message. */
const PATTERNS: ReadonlyArray<{ name: string; re: RegExp; usesAllowList: boolean }> = [
  // "4/30 votes", "12/30 voti", "4/30 票": a progress meter, always a country's own count.
  { name: 'progress', re: new RegExp(String.raw`${NUMBER}\s*/\s*${NUMBER}\s*${VOTE_WORD}`, 'giu'), usesAllowList: false },
  // "74 votes", "Based on 74 votes", "77 票", "55 Stimmen". The number is captured so the
  // threshold (30) can be allowed.
  { name: 'count', re: new RegExp(String.raw`(${NUMBER})\s*${VOTE_WORD}`, 'giu'), usesAllowList: true },
  // "votes: 74", "票数：77": a vote noun directly followed by a number.
  { name: 'label-count', re: new RegExp(String.raw`${VOTE_WORD}\s*[:：]\s*(${NUMBER})`, 'giu'), usesAllowList: true },
  // "Total votes" stat tiles (the number sits in a separate element, so match the label itself).
  {
    name: 'total-label',
    re: /\b(?:total votes|voti totali|votos totales|votes au total|votos totais|stimmen insgesamt)\b|总票数/giu,
    usesAllowList: false,
  },
  // "12 travelers voted", "12 viaggiatori hanno votato", ...
  {
    name: 'voters',
    re: /\d+\s+(?:travell?ers?|people|viaggiatori|persone|viajeros|personas|voyageurs|personnes|viajantes|pessoas|Reisende|Personen)\b[^.]{0,30}?\b(?:voted|votato|votado|votaron|voté|votaram|abgestimmt)\b/giu,
    usesAllowList: false,
  },
];

export interface VoteCountMatch {
  /** Which pattern matched (see PATTERNS). */
  pattern: string;
  /** The matched text, trimmed. */
  text: string;
}

/** Parse "1,234" / "1.234" / "1 234" back to an integer for the allow-list check. */
function toInteger(numberText: string): number {
  return Number(numberText.replace(/[.,   ]/g, ''));
}

/**
 * Every vote-count phrase found in `text`. `allowedNumbers` (usually [MIN_VOTE_FLOOR]) are
 * threshold mentions and are not reported by the "count" / "label-count" patterns.
 */
export function findVoteCountPhrases(text: string, allowedNumbers: readonly number[] = []): VoteCountMatch[] {
  const allowed = new Set(allowedNumbers);
  const found: VoteCountMatch[] = [];
  for (const { name, re, usesAllowList } of PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      if (usesAllowList && m[1] !== undefined && allowed.has(toInteger(m[1]))) continue;
      found.push({ pattern: name, text: m[0].trim() });
    }
  }
  return found;
}
