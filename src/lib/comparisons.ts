/**
 * Selection logic for the country page's comparison table and its
 * "related countries" block (components/country/ComparisonTable.astro and
 * RelatedCountries.astro).
 *
 * Pure: no I/O, no logging. Coordinates are passed in (src/data/country-coords.json,
 * built by scripts/generate-country-coords.ts). Every ordering ends in an iso3
 * tie-break, so the same countries always produce the same lists, whatever order
 * the caller passes them in.
 *
 * Comparison rows:
 *  - Neighbours: real borders (borderMap via getNeighbors) that pass
 *    hasSufficientData, by score, max 6.
 *  - Nearby: only when fewer than MIN_NEIGHBOURS_BEFORE_FILL neighbours remain.
 *    Filled up to COMPARISON_SIZE other countries with the NEAREST countries by
 *    great-circle distance. Candidates must pass hasSufficientData, lie within
 *    NEARBY_MAX_KM of the subject, and not be the subject or one of its real
 *    borders. Nearby means geographically close: not "same region", not "similar
 *    score".
 *  - A subject or candidate without coordinates gets no nearby countries. No
 *    coordinates are invented.
 *  - When nothing qualifies, the table keeps only the real neighbours. A country
 *    with neither real neighbours nor nearby countries is not rendered.
 *
 * Related block:
 *  - Same region: closest total score first (data-sufficient, excluding the rows above).
 *  - Similar risk profile: smallest Euclidean distance over the five pillar scores,
 *    excluding the same-region list. Hidden entirely when the subject fails
 *    hasSufficientData: its pillars are then prior-driven, so the list would compare
 *    priors with real profiles.
 *
 * Data coverage filters the CANDIDATES, never the page: a country with thin data
 * still gets a comparison table.
 *
 * WHY: fillers used to be the countries closest in score within the same region,
 * so Ecuador got Nicaragua and Mexico and Aland got Serbia and Georgia. Those are
 * not nearby, and a reader called them wrong. Distance decides now.
 */
import type { ScoredCountry } from '../pipeline/types';
import { borderMap, getNeighbors } from './neighbors';
import { getRegion } from './regions';
import { hasSufficientData } from './hub-data';

/** Fewer data-sufficient real neighbours than this, and nearby countries are added. */
export const MIN_NEIGHBOURS_BEFORE_FILL = 3;
/** Other-country rows in the comparison table once filled (neighbours + nearby). */
export const COMPARISON_SIZE = 4;
/** Entries per list in the related-countries block. */
export const RELATED_LIST_SIZE = 3;
/** A nearby country must lie within this great-circle distance of the subject (km). */
export const NEARBY_MAX_KM = 2000;

const EARTH_RADIUS_KM = 6371;

/** ISO3 -> [lat, lon] (src/data/country-coords.json). A missing or malformed entry means "no coordinates". */
export type CoordMap = Readonly<Record<string, readonly number[] | undefined>>;

/** What the comparison table shows for a country, besides the country itself. */
export interface ComparisonSelection {
  /** Real neighbours that pass hasSufficientData, score descending, max 6. */
  neighbours: ScoredCountry[];
  /** Nearest countries by distance. Empty unless neighbours.length < MIN_NEIGHBOURS_BEFORE_FILL. */
  nearby: ScoredCountry[];
}

/** What the related-countries block shows for a country. */
export interface RelatedSelection {
  /** Same region, closest total score first. */
  sameRegion: ScoredCountry[];
  /** Most similar risk profile first. Empty when the subject fails the data floor. Never repeats a sameRegion entry. */
  similarProfile: ScoredCountry[];
}

/** Plain code-unit ascending order on iso3 (locale-independent tie-break). */
function byIso3(a: ScoredCountry, b: ScoredCountry): number {
  return a.iso3 < b.iso3 ? -1 : a.iso3 > b.iso3 ? 1 : 0;
}

/** Absolute total-score gap: the closeness measure for the same-region list. */
function scoreGap(candidate: ScoredCountry, subject: ScoredCountry): number {
  return Math.abs(candidate.score - subject.score);
}

/**
 * Great-circle distance in km between two [lat, lon] points (haversine formula,
 * spherical Earth). Longitudes may cross the antimeridian.
 */
export function haversineKm(a: readonly [number, number], b: readonly [number, number]): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The [lat, lon] for an ISO3 code, or null when there is none or it is malformed
 * (not two finite numbers, or outside the valid ranges).
 */
export function coordsOf(iso3: string, coords: CoordMap): [number, number] | null {
  if (!Object.prototype.hasOwnProperty.call(coords, iso3)) return null;
  const entry = coords[iso3];
  if (!entry || entry.length !== 2) return null;
  const [lat, lon] = entry;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lat, lon];
}

/**
 * Euclidean distance between two countries over their pillar scores (0-1 each).
 * Only pillars present on both sides count. Returns null when they share none,
 * so such a pair is never ranked. Every country in the dataset carries the full
 * five-pillar set today, so the shared-pillar rule is a guard, not a live path.
 */
export function profileDistance(a: ScoredCountry, b: ScoredCountry): number | null {
  const bScores = new Map(b.pillars.map((p) => [p.name, p.score]));
  let sumSquares = 0;
  let shared = 0;
  for (const p of a.pillars) {
    const other = bScores.get(p.name);
    if (other === undefined) continue;
    sumSquares += (p.score - other) ** 2;
    shared += 1;
  }
  return shared === 0 ? null : Math.sqrt(sumSquares);
}

/**
 * Comparison selection for one country: real neighbours first, then, only when too
 * few remain, the nearest countries by great-circle distance to top up to
 * COMPARISON_SIZE others.
 */
export function selectComparison(
  country: ScoredCountry,
  allCountries: ScoredCountry[],
  coords: CoordMap,
): ComparisonSelection {
  const neighbours = getNeighbors(country.iso3, allCountries, hasSufficientData);
  if (neighbours.length >= MIN_NEIGHBOURS_BEFORE_FILL) {
    return { neighbours, nearby: [] };
  }

  const subject = coordsOf(country.iso3, coords);
  if (!subject) return { neighbours, nearby: [] };

  // Real borders are never fillers, even when the data floor would have dropped them.
  const excluded = new Set<string>([
    country.iso3,
    ...(borderMap[country.iso3] ?? []),
    ...neighbours.map((c) => c.iso3),
  ]);
  const nearby = allCountries
    .filter((c) => !excluded.has(c.iso3) && hasSufficientData(c))
    .flatMap((c) => {
      const at = coordsOf(c.iso3, coords);
      return at ? [{ c, km: haversineKm(subject, at) }] : [];
    })
    .filter((x) => x.km <= NEARBY_MAX_KM)
    .sort((a, b) => a.km - b.km || byIso3(a.c, b.c))
    .slice(0, COMPARISON_SIZE - neighbours.length)
    .map((x) => x.c);

  return { neighbours, nearby };
}

/** Rows for the comparison table: the country itself plus its selected others, by score descending. */
export function comparisonRows(country: ScoredCountry, selection: ComparisonSelection): ScoredCountry[] {
  return [country, ...selection.neighbours, ...selection.nearby].sort(
    (a, b) => b.score - a.score || byIso3(a, b),
  );
}

/**
 * Related-countries block. `shown` is the comparison selection rendered on the
 * same page; those countries are excluded so no country appears twice.
 */
export function selectRelated(
  country: ScoredCountry,
  allCountries: ScoredCountry[],
  shown: ComparisonSelection,
): RelatedSelection {
  const excluded = new Set<string>([
    country.iso3,
    ...shown.neighbours.map((c) => c.iso3),
    ...shown.nearby.map((c) => c.iso3),
  ]);
  const candidates = allCountries.filter((c) => !excluded.has(c.iso3) && hasSufficientData(c));

  const region = getRegion(country.iso3);
  const sameRegion: ScoredCountry[] =
    region === 'other'
      ? []
      : candidates
          .filter((c) => getRegion(c.iso3) === region)
          .sort((a, b) => scoreGap(a, country) - scoreGap(b, country) || byIso3(a, b))
          .slice(0, RELATED_LIST_SIZE);

  // A subject below the data floor has prior-driven pillars. Its "similar profile"
  // would compare priors with real profiles, so the list is not produced at all.
  if (!hasSufficientData(country)) return { sameRegion, similarProfile: [] };

  const regionShown = new Set(sameRegion.map((c) => c.iso3));
  const similarProfile = candidates
    .filter((c) => !regionShown.has(c.iso3))
    .map((c) => ({ c, d: profileDistance(country, c) }))
    .filter((x): x is { c: ScoredCountry; d: number } => x.d !== null)
    .sort((x, y) => x.d - y.d || byIso3(x.c, y.c))
    .slice(0, RELATED_LIST_SIZE)
    .map((x) => x.c);

  return { sameRegion, similarProfile };
}
