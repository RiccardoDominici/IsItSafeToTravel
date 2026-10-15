/**
 * Selection logic for the country page's comparison table and its
 * "related countries" block (components/country/ComparisonTable.astro and
 * RelatedCountries.astro).
 *
 * Pure: no I/O, no logging. Geography is passed in: coast-or-border distances
 * (src/data/country-proximity.json, built from Natural Earth by
 * scripts/generate-country-proximity.ts) and Wikidata points
 * (src/data/country-coords.json). Every ordering ends in an iso3 tie-break, so the
 * same countries always produce the same lists, whatever order the caller passes.
 *
 * Comparison rows (selectComparison), all ordered by distance, never by score:
 *  - Land neighbours: EVERY real land border (src/lib/neighbors.ts), places without
 *    an official score included (the table shows "Partial data" for them). Never
 *    capped, never filtered: China shows all 16, Afghanistan and North Korea too.
 *    They share a border (distance 0), so among themselves they go nearest centre
 *    first.
 *  - The sovereign state of a territory (Jersey -> United Kingdom, Réunion -> France),
 *    however far, labelled with its distance.
 *  - Across-sea places: only when the two kinds above give fewer than
 *    MIN_NEIGHBOURS_BEFORE_FILL rows. Topped up to COMPARISON_SIZE rows with the
 *    nearest places by shortest coast-or-border distance, within NEARBY_MAX_KM, that
 *    pass hasSufficientData (a filler is there to compare numbers with). Each is
 *    labelled with its distance ("about 80 km away"), not a blanket "nearby".
 *  - Remote islands only (New Zealand, Pitcairn): when that still leaves fewer than
 *    MIN_ROWS_REMOTE rows, the nearest scored places within REMOTE_MAX_KM are added
 *    up to MIN_ROWS_REMOTE, so the table is not empty. Labelled the same way.
 *
 * Related block (selectRelated):
 *  - Same region: the RELATED_LIST_SIZE places nearest to the subject within its
 *    UN M49 sub-region (src/lib/subregions.ts), shown by score.
 *  - Similar risk profile: smallest Euclidean distance over the five pillar scores,
 *    excluding the same-region list.
 *  - Both lists skip what the table shows and places below the data floor, and are
 *    withheld entirely when the subject fails hasSufficientData (its score and
 *    pillars would rest on priors).
 *
 * WHY (2026-10 audit, I09/I33/I35/I37): the table kept the six best-scoring
 * neighbours, so China lost Afghanistan, Myanmar, Russia, North Korea and Pakistan;
 * fillers were picked by centroid distance up to 2,000 km and all tagged "nearby"
 * (Malta got Tunisia but not Libya, Kuwait missed Iran); "same region" meant a
 * continent, ordered by score (Afghanistan got North Korea).
 */
import type { ScoredCountry } from '../pipeline/types';
import { getLandNeighbours, getSovereignState } from './neighbors';
import { getSubregion } from './subregions';
import { hasSufficientData } from './hub-data';
import type { Scored } from './score-status';

/** Fewer land-neighbour + sovereign rows than this, and across-sea places are added. */
export const MIN_NEIGHBOURS_BEFORE_FILL = 3;
/** Other-country rows in the comparison table once filled. */
export const COMPARISON_SIZE = 4;
/** Entries per list in the related-countries block. */
export const RELATED_LIST_SIZE = 3;
/** An across-sea filler must lie within this coast-or-border distance of the subject (km). */
export const NEARBY_MAX_KM = 1000;
/** A remote island with fewer other rows than this after the first fill gets the nearest farther places... */
export const MIN_ROWS_REMOTE = 2;
/** ...within this distance (km). New Zealand: Australia ~1,500 km, Fiji ~1,800 km. */
export const REMOTE_MAX_KM = 2500;

const EARTH_RADIUS_KM = 6371;

/** ISO3 -> [lat, lon] (src/data/country-coords.json). A missing or malformed entry means "no coordinates". */
export type CoordMap = Readonly<Record<string, readonly number[] | undefined>>;
/** ISO3 -> (ISO3 -> shortest coast-or-border distance in km) (src/data/country-proximity.json). */
export type ProximityMap = Readonly<Record<string, Readonly<Record<string, number>> | undefined>>;

/** The geography every selection needs. */
export interface Geography {
  proximity: ProximityMap;
  coords: CoordMap;
}

/** How a row relates to the page's place. */
export type RowRelation = 'self' | 'land' | 'sea';

/** One row of the comparison table. */
export interface ComparisonRow {
  country: ScoredCountry;
  /** 'self': the page's own place. 'land': shares a land border. 'sea': across the sea, labelled with its distance. */
  relation: RowRelation;
  /** Shortest coast-or-border distance in km (0 for 'self' and 'land'). */
  km: number;
}

/** What the comparison table shows besides the place itself, nearest first. */
export interface ComparisonSelection {
  others: ComparisonRow[];
}

/** What the related-countries block shows for a country. */
export interface RelatedSelection {
  /** Nearest places in the same M49 sub-region, displayed by score descending. Empty when the subject fails the data floor. */
  sameRegion: Scored<ScoredCountry>[];
  /** Most similar risk profile first. Empty when the subject fails the data floor. Never repeats a sameRegion entry. */
  similarProfile: Scored<ScoredCountry>[];
}

/** Plain code-unit ascending order on iso3 (locale-independent tie-break). */
function byIso3(a: ScoredCountry, b: ScoredCountry): number {
  return a.iso3 < b.iso3 ? -1 : a.iso3 > b.iso3 ? 1 : 0;
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

/** Centre-to-centre km from the Wikidata points, or Infinity when either is missing. */
function centreKm(a: string, b: string, coords: CoordMap): number {
  const pa = coordsOf(a, coords);
  const pb = coordsOf(b, coords);
  return pa && pb ? haversineKm(pa, pb) : Infinity;
}

/**
 * Shortest coast-or-border distance in km between two places, looked up in either
 * direction, or null when the proximity data has no entry for the pair.
 */
export function proximityKm(a: string, b: string, proximity: ProximityMap): number | null {
  const own = Object.prototype.hasOwnProperty.call(proximity, a) ? proximity[a] : undefined;
  if (own && Object.prototype.hasOwnProperty.call(own, b) && Number.isFinite(own[b])) return own[b];
  const other = Object.prototype.hasOwnProperty.call(proximity, b) ? proximity[b] : undefined;
  if (other && Object.prototype.hasOwnProperty.call(other, a) && Number.isFinite(other[a])) return other[a];
  return null;
}

/**
 * Distance for display and ordering: coast-or-border km when known, else the
 * centre-to-centre km (a far pair the proximity file does not store), else Infinity.
 */
function distanceKm(a: string, b: string, geo: Geography): number {
  return proximityKm(a, b, geo.proximity) ?? centreKm(a, b, geo.coords);
}

/**
 * The distance shown in a row label, rounded to what the measure supports:
 * whole km under 10, then to 5 km under 100, 10 km under 1,000, 100 km above.
 */
export function roundDistanceKm(km: number): number {
  if (km < 10) return Math.max(1, Math.round(km));
  if (km < 100) return Math.round(km / 5) * 5;
  if (km < 1000) return Math.round(km / 10) * 10;
  return Math.round(km / 100) * 100;
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

/** Row order: nearest first; equal distances (land neighbours, all 0) nearest centre first; then iso3. */
function byDistance(subject: string, geo: Geography): (x: ComparisonRow, y: ComparisonRow) => number {
  return (x, y) =>
    x.km - y.km ||
    centreKm(subject, x.country.iso3, geo.coords) - centreKm(subject, y.country.iso3, geo.coords) ||
    byIso3(x.country, y.country);
}

/**
 * Comparison selection for one place: every land neighbour, the sovereign state of a
 * territory, and, only when those give too few rows, the nearest data-sufficient
 * places across the sea (within NEARBY_MAX_KM, or REMOTE_MAX_KM for remote islands).
 * Rows come back nearest first.
 */
export function selectComparison(
  country: ScoredCountry,
  allCountries: ScoredCountry[],
  geo: Geography,
): ComparisonSelection {
  const byIso = new Map(allCountries.map((c) => [c.iso3, c]));
  const subject = country.iso3;

  const land: ComparisonRow[] = getLandNeighbours(subject)
    .filter((iso3) => byIso.has(iso3))
    .map((iso3) => ({ country: byIso.get(iso3)!, relation: 'land' as const, km: 0 }));

  const rows: ComparisonRow[] = [...land];
  const sovereign = getSovereignState(subject);
  if (sovereign && byIso.has(sovereign) && !land.some((r) => r.country.iso3 === sovereign)) {
    rows.push({ country: byIso.get(sovereign)!, relation: 'sea', km: distanceKm(subject, sovereign, geo) });
  }

  // Nearest scored places across the sea, not yet in the table, within maxKm, up to `upTo` rows.
  const fillUpTo = (upTo: number, maxKm: number): void => {
    if (rows.length >= upTo) return;
    const taken = new Set<string>([subject, ...rows.map((r) => r.country.iso3)]);
    const own = Object.prototype.hasOwnProperty.call(geo.proximity, subject) ? geo.proximity[subject] : undefined;
    const nearest = Object.entries(own ?? {})
      .flatMap(([iso3, km]) => {
        const c = byIso.get(iso3);
        if (!c || taken.has(iso3) || !Number.isFinite(km) || km > maxKm || !hasSufficientData(c)) return [];
        return [{ country: c as ScoredCountry, relation: 'sea' as const, km }];
      })
      .sort(byDistance(subject, geo))
      .slice(0, upTo - rows.length);
    rows.push(...nearest);
  };
  if (rows.length < MIN_NEIGHBOURS_BEFORE_FILL) fillUpTo(COMPARISON_SIZE, NEARBY_MAX_KM);
  fillUpTo(MIN_ROWS_REMOTE, REMOTE_MAX_KM);

  return { others: rows.sort(byDistance(subject, geo)) };
}

/**
 * Rows for the comparison table: the place itself first (the row the table is about,
 * with or without a score), then its selected others, nearest first.
 */
export function comparisonRows(country: ScoredCountry, selection: ComparisonSelection): ComparisonRow[] {
  return [{ country, relation: 'self', km: 0 }, ...selection.others];
}

/**
 * Related-countries block. `shown` is the comparison selection rendered on the
 * same page; those places are excluded so none appears twice.
 *
 * Withheld entirely (both lists empty) for a subject below the data floor: its score
 * and pillars are prior-driven, and both lists rest on them.
 */
export function selectRelated(
  country: ScoredCountry,
  allCountries: ScoredCountry[],
  shown: ComparisonSelection,
  geo: Geography,
): RelatedSelection {
  if (!hasSufficientData(country)) return { sameRegion: [], similarProfile: [] };

  const excluded = new Set<string>([country.iso3, ...shown.others.map((r) => r.country.iso3)]);
  const candidates = allCountries.filter(
    (c): c is Scored<ScoredCountry> => !excluded.has(c.iso3) && hasSufficientData(c),
  );

  // Nearest within the sub-region picks the three; score only orders them for display.
  const region = getSubregion(country.iso3);
  const sameRegion: Scored<ScoredCountry>[] =
    region === null
      ? []
      : candidates
          .filter((c) => getSubregion(c.iso3) === region)
          .map((c) => ({ c, km: distanceKm(country.iso3, c.iso3, geo) }))
          .sort((x, y) => x.km - y.km || byIso3(x.c, y.c))
          .slice(0, RELATED_LIST_SIZE)
          .map((x) => x.c)
          .sort((a, b) => b.score - a.score || byIso3(a, b));

  const regionShown = new Set(sameRegion.map((c) => c.iso3));
  const similarProfile = candidates
    .filter((c) => !regionShown.has(c.iso3))
    .map((c) => ({ c, d: profileDistance(country, c) }))
    .filter((x): x is { c: Scored<ScoredCountry>; d: number } => x.d !== null)
    .sort((x, y) => x.d - y.d || byIso3(x.c, y.c))
    .slice(0, RELATED_LIST_SIZE)
    .map((x) => x.c);

  return { sameRegion, similarProfile };
}
