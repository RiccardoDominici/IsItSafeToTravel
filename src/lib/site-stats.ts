// Canonical site-wide claim numbers — the single source of truth for copy that
// states how many countries / data sources / advisory governments we cover.
//
// Context: the 2026-08 SEO audit found four contradictory source counts ("7
// trusted", "9+", "37+", "40+") and three country counts ("200+", "240+", 248)
// published simultaneously across the site — a direct trust (E-E-A-T) defect
// for a data publisher. This file was the fix, but it only fixed COUNTRY_COUNT
// live: SOURCE_COUNT_DISPLAY ('40+') and ADVISORY_GOV_COUNT (37) stayed fixed
// strings, never compared against real data, so the same defect regrew under
// a "single source of truth" surface that looked fixed (2026-09-25 audit,
// findings/inconsistencies.md I2/I3/I12) — e.g. 9 of the 37 advisory codes
// have never produced a single data point in the dataset's history, yet every
// country page claimed "37 governments". Every count below is now derived
// from the current snapshot at build time, like COUNTRY_COUNT always was.
import { loadLatestScores } from './scores';
import { ADVISORY_CODES, type AdvisoryCode } from '../pipeline/scoring/engine';

const scoredCountries = loadLatestScores();

/** Exact number of countries in the current score snapshot (248 as of 2026-08). */
export const COUNTRY_COUNT = scoredCountries.length;

/**
 * Format an exact count for site-wide "+"-style copy.
 *
 * Below 10: show the exact number ("7") — at this size rounding throws away
 * real precision for no reason (there's no meaningful day-to-day noise to
 * absorb when the true count is single-digit), and a claim this small reads
 * as more careful, not less, when it's exact. Callers whose surrounding
 * sentence pluralizes the noun must special-case count === 1 themselves
 * (see OTHER_SOURCE_COUNT's callers in hub-faq.ts for the pattern) — this
 * function only formats the number, it doesn't know the sentence around it.
 *
 * From 10 up: round DOWN to the nearest multiple of 5 and add "+". Never
 * round up or show the bare exact number here — the one hard rule this file
 * exists to enforce is that a claim must never overstate. Flooring also
 * keeps the claim stable across a live pipeline's day-to-day noise (a
 * government dropping from 26 to 24 active countries shouldn't flip site
 * copy from "26" to "24" on every rebuild — "25+" absorbs that until a real
 * 5-count swing), and at 10+ a "+"-suffixed claim never needs singular
 * grammar, so pluralization stops being a concern past this threshold.
 */
const EXACT_BELOW = 10;
function countDisplay(exact: number): string {
  if (exact < EXACT_BELOW) return String(exact);
  return `${Math.floor(exact / 5) * 5}+`;
}

/**
 * Per-government-code count of countries carrying a real advisory level in
 * the current snapshot. Always has all 37 ADVISORY_CODES as keys (0 for
 * codes with no data at all) — powers both ADVISORY_GOV_COUNT below and the
 * /sources/ page's per-source status column (audit I2: dead issuers like
 * br/ph/sg/ro/hr/kr/se/cz/hu were shown with the same "live" table styling
 * as us/uk/ca).
 */
export const ADVISORY_STATUS: Record<AdvisoryCode, number> = Object.fromEntries(
  ADVISORY_CODES.map((code) => {
    const count = scoredCountries.filter((c) => {
      const info = c.advisories[code];
      return info != null && info.level !== undefined && info.level !== null && info.level !== '';
    }).length;
    return [code, count];
  }),
) as Record<AdvisoryCode, number>;

/**
 * A government counts as "active" only once it covers at least this many
 * countries in today's snapshot — filters out single-country noise (e.g. a
 * source that only ever resolves its own territory) while still counting
 * thin-but-real coverage (a government with exactly 3 countries is active;
 * a stray 1-country reading is not). Not a freshness/liveness check — see
 * AdvisoryInfo.restoredFrom (internal-only, not surfaced here) for that.
 */
const MIN_COUNTRIES_FOR_ACTIVE_GOV = 3;

/** The subset of ADVISORY_CODES that clears MIN_COUNTRIES_FOR_ACTIVE_GOV today. */
export const ACTIVE_ADVISORY_CODES: AdvisoryCode[] = ADVISORY_CODES.filter(
  (code) => ADVISORY_STATUS[code] >= MIN_COUNTRIES_FOR_ACTIVE_GOV,
);

/** Exact number of active advisory-issuing governments (never 37 — see file header). */
export const ADVISORY_GOV_COUNT = ACTIVE_ADVISORY_CODES.length;

/** Site-wide "N+ government sources" display string, e.g. "25+". */
export const ADVISORY_GOV_COUNT_DISPLAY = countDisplay(ADVISORY_GOV_COUNT);

/**
 * Distinct non-advisory data feeds actually present in the snapshot (today:
 * gdacs, gpi, inform, reliefweb, ucdp, vdem, worldbank — 7). Derived from
 * ScoredCountry.sources[].name across every country instead of a hand-picked
 * list, so a feed that gets added or silently dropped from the pipeline is
 * reflected here automatically.
 */
export const OTHER_SOURCE_NAMES: string[] = Array.from(
  new Set(
    scoredCountries.flatMap((c) => c.sources.filter((s) => s.name !== 'advisories').map((s) => s.name)),
  ),
).sort();

/** Exact number of non-advisory data feeds. */
export const OTHER_SOURCE_COUNT = OTHER_SOURCE_NAMES.length;

/**
 * Site-wide "other data feeds" display string — exact below 10 (today: "7",
 * not "5+"; see countDisplay), "N+" from 10 up. Callers that pluralize the
 * noun around it must handle the count === 1 case themselves.
 */
export const OTHER_SOURCE_COUNT_DISPLAY = countDisplay(OTHER_SOURCE_COUNT);

/** Exact total: active advisory governments + other data feeds. */
export const SOURCE_COUNT = ADVISORY_GOV_COUNT + OTHER_SOURCE_COUNT;

/**
 * Site-wide framing for the upstream public sources feeding the score —
 * replaces the old fixed '40+' (37 governments padded up to "40+" regardless
 * of how many were actually live) with a real, conservatively-rounded count
 * of active governments + other feeds. Today that's ~26 + 7 = 33 -> "30+".
 */
export const SOURCE_COUNT_DISPLAY = countDisplay(SOURCE_COUNT);
