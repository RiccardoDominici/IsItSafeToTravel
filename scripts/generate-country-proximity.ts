/**
 * generate-country-proximity.ts
 *
 * Writes src/data/country-proximity.json: for each of the 248 places, the shortest
 * distance in km from its coast or border to the coast or border of other places.
 * Land neighbours are 0. The country-page comparison table uses it to pick and label
 * across-sea places ("about 80 km away"), and the related block to pick the nearest
 * places in the same sub-region (src/lib/comparisons.ts).
 *
 * Run:  npm run generate:proximity            (downloads Natural Earth once, ~13 MB)
 *       npx tsx scripts/generate-country-proximity.ts --input <map_units.geojson>
 *
 * Source: Natural Earth 1:10m Cultural Vectors, Admin 0 - Map Units, v5.1.2
 * (https://www.naturalearthdata.com/). Natural Earth is in the public domain: no
 * licence restriction, no attribution required (credited in the file anyway).
 * Map units, not countries, because the site treats French Guiana, Réunion, Svalbard
 * and the Caribbean Netherlands as places of their own.
 *
 * What is stored per place (the file stays small; nothing else is ever looked up):
 *  - the NEAREST_COUNT nearest places, and every place within NEARBY_MAX_KM (the
 *    filler radius in src/lib/comparisons.ts, so the filler pick is never cut short),
 *  - every land neighbour and the sovereign state (src/lib/neighbors.ts),
 *  - every place in the same UN M49 sub-region (src/lib/subregions.ts).
 * Distances are rounded to whole km. A few remote specks are left out of the outlines
 * (REMOTE_ISLETS_LEFT_OUT). A place Natural Earth does not draw falls back
 * to its Wikidata point (src/data/country-coords.json); the run lists them.
 *
 * Checks (printed, and the run fails on the first kind): a declared land border
 * whose outlines are more than LAND_TOLERANCE_KM apart, unless listed in
 * LAND_BORDERS_NOT_IN_NATURAL_EARTH; and touching outlines not declared as a land border.
 *
 * Output is sorted and has no timestamp, so a re-run on the same inputs is identical.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NEARBY_MAX_KM } from '../src/lib/comparisons.js';
import { landBorders, sovereignState } from '../src/lib/neighbors.js';
import { getSubregion } from '../src/lib/subregions.js';
import {
  COARSE_STEP_KM,
  buildOutline,
  coarseDistanceKm,
  exactDistanceKm,
  type PlaceOutline,
  type PolygonRings,
} from './lib/geo-proximity.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT = path.resolve(ROOT, 'src/data/country-proximity.json');
const COORDS = path.resolve(ROOT, 'src/data/country-coords.json');
const NE_VERSION = 'v5.1.2';
const NE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_VERSION}/geojson/ne_10m_admin_0_map_units.geojson`;
const USER_AGENT = 'Mozilla/5.0 (compatible; IsItSafeToTravelBot/1.0; +https://isitsafetotravel.org)';

/** Nearest places stored per place, before land, sovereign and sub-region entries. */
const NEAREST_COUNT = 16;
/** A declared land border may show at most this gap in the 1:10m outlines. */
const LAND_TOLERANCE_KM = 1;
/** Real land borders Natural Earth v5.1.2 does not draw (reason given). */
const LAND_BORDERS_NOT_IN_NATURAL_EARTH: ReadonlySet<string> = new Set([
  'CAN-GRL', // Hans Island, split by the 2022 Canada-Denmark agreement
]);
/** Outlines that touch in Natural Earth without a land border (reason given). */
const TOUCHING_WITHOUT_BORDER: ReadonlySet<string> = new Set([
  'NAM-ZWE', // the Kazungula near-quadripoint: Namibia and Zimbabwe do not share a border
]);

/**
 * Natural Earth map units that belong to one of our places under another code (GU_A3 -> ISO3).
 * Breakaway or special-status units are folded into the place the site shows for that ground.
 */
const UNIT_TO_PLACE: Readonly<Record<string, string>> = {
  KOS: 'XKX', // Kosovo
  NJM: 'SJM', // Jan Mayen (ISO 3166 SJM is Svalbard and Jan Mayen)
  GAZ: 'PSE', WEB: 'PSE', // Gaza, West Bank
  SOL: 'SOM', // Somaliland
  CYN: 'CYP', CNM: 'CYP', ESB: 'CYP', WSB: 'CYP', // northern Cyprus, UN buffer zone, UK bases
  KAB: 'KAZ', // Baikonur lease
  KNX: 'KOR', KNZ: 'PRK', // the two halves of the Korean DMZ
  SYU: 'SYR', // UNDOF zone
};
/** Units left out: uninhabited reefs, disputed specks and leased bases that would invent borders or neighbours. */
const SKIPPED_UNITS: ReadonlySet<string> = new Set([
  'ATC', 'CSI', // Ashmore and Cartier, Coral Sea Islands (uninhabited Australian reefs)
  'BJN', 'SER', 'SCR', 'PFA', 'PGA', // Bajo Nuevo, Serranilla, Scarborough, Paracel, Spratly
  'BRI', 'BRT', 'KAS', 'SPI', // Brazilian Island, Bir Tawil, Siachen, Southern Patagonian Ice Field
  'CLP', // Clipperton (uninhabited, ~1,000 km off Mexico)
  'USG', // Guantánamo Bay naval base (a lease, not a USA-Cuba border)
]);

/**
 * Remote specks left out of a place's outline, because measuring from them misleads a
 * traveller: the distance would describe an islet nobody travels to, not the country.
 * Each one moved a table row or label (checked against the full outlines); the run fails
 * if a box no longer matches a polygon. Box: [west, south, east, north] in degrees.
 * Inhabited outlying islands stay (San Andrés, Lakshadweep, Seychelles outer islands, ...).
 */
const REMOTE_ISLETS_LEFT_OUT: ReadonlyArray<{ place: string; name: string; box: readonly [number, number, number, number] }> = [
  // ~500 km off the mainland, 0.01 km2: made Venezuela "about 190 km" from Antigua, St Kitts, Anguilla.
  { place: 'VEN', name: 'Isla Aves', box: [-63.8, 15.5, -63.4, 15.9] },
  // Sub-antarctic station, ~1,500 km south-east of Tasmania: made New Zealand "about 620 km" from Australia.
  { place: 'AUS', name: 'Macquarie Island', box: [158.5, -55.3, 159.2, -54.3] },
  // Uninhabited nature reserve, ~1,000 km north-east of the North Island: made Tonga "about 790 km" from New Zealand.
  { place: 'NZL', name: 'Kermadec Islands', box: [-179.3, -31.7, -177.4, -28.9] },
  // Uninhabited reef ~450 km south-west of Viti Levu: made Vanuatu "about 510 km" from Fiji.
  { place: 'FJI', name: 'Ceva-i-Ra (Conway Reef)', box: [174.3, -22.0, 174.9, -21.4] },
];

/** True when every vertex of the polygon's outer ring lies inside the box. */
function insideBox(polygon: PolygonRings, box: readonly [number, number, number, number]): boolean {
  const [w, s, e, n] = box;
  return polygon[0].every(([lon, lat]) => lon >= w && lon <= e && lat >= s && lat <= n);
}

interface NeFeature {
  properties: Record<string, unknown>;
  geometry: { type: 'Polygon'; coordinates: PolygonRings } | { type: 'MultiPolygon'; coordinates: PolygonRings[] } | null;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Path to the Natural Earth file: --input, else a cached download in the OS temp dir. */
async function naturalEarthPath(): Promise<string> {
  const given = argValue('--input');
  if (given) return path.resolve(given);
  const cached = path.join(os.tmpdir(), `ne_10m_admin_0_map_units-${NE_VERSION}.geojson`);
  if (fs.existsSync(cached)) return cached;
  console.log(`Downloading ${NE_URL}`);
  const response = await fetch(NE_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Natural Earth download failed: HTTP ${response.status}`);
  fs.writeFileSync(cached, Buffer.from(await response.arrayBuffer()));
  return cached;
}

/** Our place for a Natural Earth unit, or null to skip it. */
function placeOf(props: Record<string, unknown>, places: ReadonlySet<string>): string | null {
  const unit = String(props.GU_A3 ?? '');
  if (SKIPPED_UNITS.has(unit)) return null;
  if (UNIT_TO_PLACE[unit]) return UNIT_TO_PLACE[unit];
  for (const key of ['ISO_A3', 'ADM0_A3']) {
    const code = String(props[key] ?? '');
    if (places.has(code)) return code;
  }
  return null;
}

const pairKey = (a: string, b: string): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

async function main(): Promise<void> {
  const places = new Set(Object.keys(landBorders));
  const source = await naturalEarthPath();
  const features = (JSON.parse(fs.readFileSync(source, 'utf8')) as { features: NeFeature[] }).features;

  // 1. Polygons per place.
  const polygonsByPlace = new Map<string, PolygonRings[]>();
  const unmatched: string[] = [];
  for (const f of features) {
    if (!f.geometry) continue;
    const place = placeOf(f.properties, places);
    if (!place) {
      unmatched.push(`${f.properties.GU_A3} (${f.properties.NAME})`);
      continue;
    }
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polygonsByPlace.set(place, [...(polygonsByPlace.get(place) ?? []), ...polys]);
  }
  console.log(`Natural Earth units not used: ${unmatched.sort().join(', ')}`);
  for (const islet of REMOTE_ISLETS_LEFT_OUT) {
    const polys = polygonsByPlace.get(islet.place) ?? [];
    const kept = polys.filter((polygon) => !insideBox(polygon, islet.box));
    if (kept.length === polys.length) throw new Error(`${islet.place} ${islet.name}: no polygon in its box any more`);
    polygonsByPlace.set(islet.place, kept);
    console.log(`Left out ${islet.place} ${islet.name}: ${polys.length - kept.length} polygon(s)`);
  }

  // 2. Outlines; places Natural Earth does not draw fall back to their Wikidata point.
  const coords = JSON.parse(fs.readFileSync(COORDS, 'utf8')) as Record<string, [number, number]>;
  const order = [...places].sort();
  const outlines = new Map<string, PlaceOutline>();
  const fallback: string[] = [];
  for (const iso3 of order) {
    const polys = polygonsByPlace.get(iso3);
    if (polys) {
      outlines.set(iso3, buildOutline(polys));
    } else if (coords[iso3]) {
      const [lat, lon] = coords[iso3];
      outlines.set(iso3, buildOutline([[[[lon, lat]]]]));
      fallback.push(iso3);
    } else {
      throw new Error(`${iso3}: no Natural Earth geometry and no Wikidata point`);
    }
  }
  console.log(fallback.length ? `Wikidata point used for: ${fallback.join(', ')}` : 'Every place has Natural Earth geometry.');
  const finePoints = [...outlines.values()].reduce((n, o) => n + o.fine.length / 3, 0);
  const coarsePoints = [...outlines.values()].reduce((n, o) => n + o.coarse.length / 3, 0);
  console.log(`Outline points: ${finePoints} fine, ${coarsePoints} coarse`);

  // 3. Coarse distances for every pair (an upper bound within 2 * COARSE_STEP_KM).
  const coarse = new Map<string, number>();
  for (let i = 0; i < order.length; i += 1) {
    for (let j = i + 1; j < order.length; j += 1) {
      coarse.set(`${order[i]}-${order[j]}`, coarseDistanceKm(outlines.get(order[i])!, outlines.get(order[j])!));
    }
  }
  const exact = new Map<string, number>();
  const exactKm = (a: string, b: string): number => {
    const key = pairKey(a, b);
    let km = exact.get(key);
    if (km === undefined) {
      km = exactDistanceKm(outlines.get(a)!, outlines.get(b)!, coarse.get(key)!);
      exact.set(key, km);
    }
    return km;
  };

  // 4. Stored entries per place.
  const table: Record<string, Array<[string, number]>> = {};
  for (const a of order) {
    const others = order.filter((b) => b !== a);
    const byCoarse = others.map((b) => ({ b, c: coarse.get(pairKey(a, b))! })).sort((x, y) => x.c - y.c);
    const cutoff = byCoarse[NEAREST_COUNT - 1].c;
    const nearest = byCoarse
      .filter((x) => x.c - 2 * COARSE_STEP_KM <= cutoff)
      .map((x) => ({ b: x.b, km: exactKm(a, x.b) }))
      .sort((x, y) => x.km - y.km || (x.b < y.b ? -1 : 1))
      .slice(0, NEAREST_COUNT)
      .map((x) => x.b);
    const withinRadius = byCoarse
      .filter((x) => x.c - 2 * COARSE_STEP_KM <= NEARBY_MAX_KM && exactKm(a, x.b) <= NEARBY_MAX_KM)
      .map((x) => x.b);
    const region = getSubregion(a);
    const wanted = new Set<string>([
      ...nearest,
      ...withinRadius,
      ...landBorders[a],
      ...(sovereignState[a] ? [sovereignState[a]] : []),
      ...(region ? others.filter((b) => getSubregion(b) === region) : []),
    ]);
    table[a] = [...wanted]
      .map((b): [string, number] => [b, Math.round(exactKm(a, b))])
      .sort((x, y) => x[1] - y[1] || (x[0] < y[0] ? -1 : 1));
  }

  // 5. Land-border checks: declared pairs must touch, touching pairs must be declared.
  const declared = new Set(order.flatMap((a) => landBorders[a].map((b) => pairKey(a, b))));
  const notTouching: string[] = [];
  for (const key of [...declared].sort()) {
    const [a, b] = key.split('-');
    const km = exactKm(a, b);
    if (km > LAND_TOLERANCE_KM && !LAND_BORDERS_NOT_IN_NATURAL_EARTH.has(key)) notTouching.push(`${key} (${km.toFixed(1)} km)`);
  }
  const undeclared: string[] = [];
  for (const [key, c] of coarse) {
    if (c > 2 * COARSE_STEP_KM + 1 || declared.has(key) || TOUCHING_WITHOUT_BORDER.has(key)) continue;
    const [a, b] = key.split('-');
    const km = exactKm(a, b);
    if (km <= LAND_TOLERANCE_KM) undeclared.push(`${key} (${km.toFixed(2)} km)`);
  }
  if (undeclared.length) console.warn(`Touching in Natural Earth but not a declared land border (review): ${undeclared.join(', ')}`);
  if (notTouching.length) {
    throw new Error(`Declared land borders that do not touch in Natural Earth: ${notTouching.join(', ')}`);
  }

  // 6. Write: one place per line, entries nearest first.
  const lines = order.map((a) => `  "${a}": {${table[a].map(([b, km]) => `"${b}": ${km}`).join(', ')}}`);
  fs.writeFileSync(OUTPUT, `{\n${lines.join(',\n')}\n}\n`);
  const entries = order.reduce((n, a) => n + table[a].length, 0);
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}: ${order.length} places, ${entries} distances`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
