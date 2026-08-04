// Canonical site-wide claim numbers — the single source of truth for copy that
// states how many countries / data sources / advisory governments we cover.
//
// Context: the 2026-08 SEO audit found four contradictory source counts ("7
// trusted", "9+", "37+", "40+") and three country counts ("200+", "240+", 248)
// published simultaneously across the site — a direct trust (E-E-A-T) defect
// for a data publisher. Every piece of copy should interpolate or match these
// values; scripts/validate-seo.ts greps the built output for the known stale
// variants and fails the build if any creeps back in.
import { loadLatestScores } from './scores';

/** Exact number of countries in the current score snapshot (248 as of 2026-08). */
export const COUNTRY_COUNT = loadLatestScores().length;

/**
 * Site-wide framing for the upstream public sources feeding the score
 * (37 government advisories + World Bank, V-Dem, INFORM, GPI, UCDP,
 * ReliefWeb, GDACS = 44 distinct feeds → stated conservatively as "40+").
 */
export const SOURCE_COUNT_DISPLAY = '40+';

/** Number of governments whose travel advisories the pipeline ingests. */
export const ADVISORY_GOV_COUNT = 37;
