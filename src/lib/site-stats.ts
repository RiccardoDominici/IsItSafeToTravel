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
 * Round an exact count DOWN to the nearest multiple of 5 and format as "N+".
 *
 * WHY floor-and-plus instead of the exact number: (1) it never overstates —
 * the one hard rule this whole file exists to enforce; (2) it stays true and
 * stable across the day-to-day noise of a live pipeline (a government
 * dropping from 26 to 24 active countries shouldn't flip site copy from
 * "26" to "24" on every rebuild — "25+" absorbs that until a real 5-count
 * swing). Falls back to the bare exact number when it's below 5: a "0+"
 * claim would be true but silly, and rounding UP to "5+" when the real
 * count is, say, 3 would overstate — exactly what this function must not do.
 */
function roundedPlusDisplay(exact: number): string {
  const floored = Math.floor(exact / 5) * 5;
  return floored > 0 ? `${floored}+` : String(exact);
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
export const ADVISORY_GOV_COUNT_DISPLAY = roundedPlusDisplay(ADVISORY_GOV_COUNT);

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

/** Site-wide "N+ other data feeds" display string, e.g. "5+". */
export const OTHER_SOURCE_COUNT_DISPLAY = roundedPlusDisplay(OTHER_SOURCE_COUNT);

/** Exact total: active advisory governments + other data feeds. */
export const SOURCE_COUNT = ADVISORY_GOV_COUNT + OTHER_SOURCE_COUNT;

/**
 * Site-wide framing for the upstream public sources feeding the score —
 * replaces the old fixed '40+' (37 governments padded up to "40+" regardless
 * of how many were actually live) with a real, conservatively-rounded count
 * of active governments + other feeds. Today that's ~26 + 7 = 33 -> "30+".
 */
export const SOURCE_COUNT_DISPLAY = roundedPlusDisplay(SOURCE_COUNT);
