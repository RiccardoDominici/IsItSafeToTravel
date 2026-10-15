/**
 * Geometry for scripts/generate-country-proximity.ts: shortest great-circle distance
 * between two places' outlines (coast or border), not between their centroids.
 *
 * WHY: one centroid per country put Libya's point deep in the Sahara, so Malta's
 * "nearby" list skipped Libya and Tunisia for places 800-2,000 km away. Measuring
 * outline to outline gives what a reader means by "near": Malta-Sicily is ~80 km.
 *
 * Method (coarse-to-fine, exact on the sampled outline):
 *  1. Every ring vertex of every polygon is kept, and long edges are densified to
 *     MAX_SEGMENT_KM, so a point lies on the outline at least every 2 km. Points are
 *     3D unit vectors: the nearest pair is the pair with the largest dot product.
 *  2. A coarse sample (one point per COARSE_STEP_KM along each ring) bounds the
 *     distance: every fine point lies within COARSE_STEP_KM of its coarse parent,
 *     so true <= coarse <= true + 2 * COARSE_STEP_KM.
 *  3. For an exact distance, only fine points whose coarse parent lies within
 *     coarse + 2 * COARSE_STEP_KM of the other place can hold the nearest pair; the
 *     rest are skipped.
 *  4. Two places that share a vertex (Natural Earth borders are topologically
 *     shared) touch: distance 0, a land border.
 *
 * Pure: no I/O.
 */

export const EARTH_RADIUS_KM = 6371;
/** Longest edge kept as is; longer edges get intermediate points. */
export const MAX_SEGMENT_KM = 2;
/** Spacing of the coarse sample used to bound and prune. */
export const COARSE_STEP_KM = 50;

/** [lon, lat] as in GeoJSON. */
export type LonLat = readonly [number, number];
/** One polygon: outer ring first, then holes (holes are outlines too: enclaves). */
export type PolygonRings = ReadonlyArray<ReadonlyArray<LonLat>>;

/** One place's sampled outline. */
export interface PlaceOutline {
  /** xyz unit vectors, 3 numbers per point. */
  fine: Float64Array;
  /** xyz unit vectors of the coarse sample. */
  coarse: Float64Array;
  /** For coarse point i, its fine children are [start[i], end[i]) (point indices). */
  childStart: Int32Array;
  childEnd: Int32Array;
  /** Vertex keys (lon/lat rounded to 1e-6 degrees) for the shared-vertex test. */
  vertexKeys: Set<string>;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle km for a chord length on the unit sphere. */
export function chordToKm(chord: number): number {
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, chord / 2));
}

/** Chord length on the unit sphere for a great-circle distance in km. */
export function kmToChord(km: number): number {
  return 2 * Math.sin(Math.min(Math.PI / 2, km / (2 * EARTH_RADIUS_KM)));
}

function unit(lon: number, lat: number): [number, number, number] {
  const la = toRad(lat);
  const lo = toRad(lon);
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

/** Haversine km between two [lon, lat] points. */
export function lonLatKm(a: LonLat, b: LonLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const vertexKey = (p: LonLat): string => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

/**
 * Samples a place's polygons into fine and coarse point sets. Edges are densified by
 * linear interpolation in lon/lat (Natural Earth edges are straight in that plane);
 * an edge spanning more than 180 degrees of longitude is an antimeridian artefact and
 * is not densified.
 */
export function buildOutline(polygons: ReadonlyArray<PolygonRings>): PlaceOutline {
  const fine: number[] = [];
  const coarse: number[] = [];
  const childStart: number[] = [];
  const childEnd: number[] = [];
  const vertexKeys = new Set<string>();
  const coarseChord = kmToChord(COARSE_STEP_KM);

  let lastCoarse: [number, number, number] | null = null;
  const pushPoint = (lon: number, lat: number): void => {
    const v = unit(lon, lat);
    const index = fine.length / 3;
    fine.push(v[0], v[1], v[2]);
    const far =
      lastCoarse === null ||
      Math.hypot(v[0] - lastCoarse[0], v[1] - lastCoarse[1], v[2] - lastCoarse[2]) > coarseChord;
    if (far) {
      if (childStart.length > 0) childEnd.push(index);
      coarse.push(v[0], v[1], v[2]);
      childStart.push(index);
      lastCoarse = v;
    }
  };

  for (const polygon of polygons) {
    for (const ring of polygon) {
      lastCoarse = null; // every ring opens its own coarse run
      for (let i = 0; i < ring.length; i += 1) {
        const p = ring[i];
        vertexKeys.add(vertexKey(p));
        pushPoint(p[0], p[1]);
        const q = ring[i + 1];
        if (!q) continue;
        if (Math.abs(q[0] - p[0]) > 180) continue;
        const steps = Math.ceil(lonLatKm(p, q) / MAX_SEGMENT_KM);
        for (let s = 1; s < steps; s += 1) {
          const t = s / steps;
          pushPoint(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t);
        }
      }
    }
  }
  if (childStart.length > 0) childEnd.push(fine.length / 3);

  return {
    fine: Float64Array.from(fine),
    coarse: Float64Array.from(coarse),
    childStart: Int32Array.from(childStart),
    childEnd: Int32Array.from(childEnd),
    vertexKeys,
  };
}

/** Largest dot product between any point of `a` and any point of `b` (xyz triples). */
function maxDot(a: Float64Array, b: Float64Array): number {
  let best = -2;
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i];
    const y = a[i + 1];
    const z = a[i + 2];
    for (let j = 0; j < b.length; j += 3) {
      const d = x * b[j] + y * b[j + 1] + z * b[j + 2];
      if (d > best) best = d;
    }
  }
  return best;
}

/** Chord on the unit sphere for a dot product of two unit vectors. */
const dotToChord = (dot: number): number => Math.sqrt(Math.max(0, 2 - 2 * dot));

/** Upper bound (within 2 * COARSE_STEP_KM of the truth) from the coarse samples, in km. */
export function coarseDistanceKm(a: PlaceOutline, b: PlaceOutline): number {
  return chordToKm(dotToChord(maxDot(a.coarse, b.coarse)));
}

/** True when the two outlines share at least one vertex (a land border). */
export function sharesVertex(a: PlaceOutline, b: PlaceOutline): boolean {
  const [small, large] = a.vertexKeys.size <= b.vertexKeys.size ? [a, b] : [b, a];
  for (const key of small.vertexKeys) if (large.vertexKeys.has(key)) return true;
  return false;
}

/** Fine points of `a` whose coarse parent lies within `limitChord` of any coarse point of `b`. */
function candidateFinePoints(a: PlaceOutline, b: PlaceOutline, limitChord: number): Float64Array {
  const minDot = 1 - (limitChord * limitChord) / 2;
  const out: number[] = [];
  for (let c = 0; c < a.childStart.length; c += 1) {
    const x = a.coarse[c * 3];
    const y = a.coarse[c * 3 + 1];
    const z = a.coarse[c * 3 + 2];
    let near = false;
    for (let j = 0; j < b.coarse.length; j += 3) {
      if (x * b.coarse[j] + y * b.coarse[j + 1] + z * b.coarse[j + 2] >= minDot) {
        near = true;
        break;
      }
    }
    if (!near) continue;
    for (let i = a.childStart[c]; i < a.childEnd[c]; i += 1) {
      out.push(a.fine[i * 3], a.fine[i * 3 + 1], a.fine[i * 3 + 2]);
    }
  }
  return Float64Array.from(out);
}

/**
 * Shortest outline-to-outline distance in km (0 when the places share a vertex).
 * `coarseKm` is coarseDistanceKm(a, b), passed in because the caller has it already.
 */
export function exactDistanceKm(a: PlaceOutline, b: PlaceOutline, coarseKm: number): number {
  if (sharesVertex(a, b)) return 0;
  const limit = kmToChord(coarseKm + 2 * COARSE_STEP_KM + 1);
  const fa = candidateFinePoints(a, b, limit);
  const fb = candidateFinePoints(b, a, limit);
  if (fa.length === 0 || fb.length === 0) return coarseKm;
  return Math.min(coarseKm, chordToKm(dotToChord(maxDot(fa, fb))));
}
