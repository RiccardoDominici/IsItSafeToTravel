/**
 * generate-country-coords.ts
 *
 * Refreshes src/data/country-coords.json: one [lat, lon] pair per ISO3 code,
 * taken from Wikidata property P625 ("coordinate location") of each country's
 * QID in src/data/countries-wikidata.json.
 *
 * Run:  npm run generate:coords        (or: npx tsx scripts/generate-country-coords.ts)
 *
 * Why it exists: the country pages add "nearby" countries to the comparison
 * table by distance. Matching by region and score produced results like
 * Nicaragua for Ecuador and Serbia or Georgia for Aland, which are not nearby.
 * Distance needs coordinates, and they must come from a source that can be cited
 * and re-run, not typed in by hand.
 *
 * Notes:
 *  - Wikidata content is CC0, so no attribution is required.
 *  - One batched SPARQL request, with a descriptive User-Agent as the Wikidata
 *    usage policy asks.
 *  - P625 is a single point per country, usually near the centroid. For large or
 *    elongated countries (Russia, USA, Canada, Chile, Indonesia) that point can
 *    sit far from the borders, so distance is a proxy. Real neighbours still come
 *    from borderMap (src/lib/neighbors.ts).
 *  - Countries without P625 are left out on purpose. No coordinates are invented:
 *    the consumer treats a missing entry as "no coordinates" and adds no nearby
 *    countries for that country.
 *  - Output is sorted by ISO3 and rounded to 2 decimals, so re-running against
 *    unchanged Wikidata data produces an identical file.
 *  - Refuses to write when the endpoint returns no coordinates at all, so an
 *    outage cannot empty the committed file.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const QID_SOURCE = path.resolve(ROOT, "src/data/countries-wikidata.json");
const OUTPUT = path.resolve(ROOT, "src/data/country-coords.json");
const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "IsItSafeToTravelBot/1.0 (+https://isitsafetotravel.org)";

interface QidEntry {
  qid?: string;
}

interface SparqlBinding {
  item: { value: string };
  coord: { value: string };
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

/** "http://www.wikidata.org/entity/Q736" -> "Q736". */
function qidFromUri(uri: string): string {
  return uri.slice(uri.lastIndexOf("/") + 1);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Parses a WKT point as returned by P625, "Point(lon lat)" (note the order). Null for anything else. */
function parseWktPoint(wkt: string): [number, number] | null {
  const num = "([-+]?\\d+(?:\\.\\d+)?(?:e[-+]?\\d+)?)";
  const match = new RegExp(`^Point\\(\\s*${num}\\s+${num}\\s*\\)$`, "i").exec(wkt.trim());
  if (!match) return null;
  const lon = Number(match[1]);
  const lat = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [round2(lat), round2(lon)];
}

async function main(): Promise<void> {
  const source = JSON.parse(fs.readFileSync(QID_SOURCE, "utf8")) as Record<string, QidEntry>;

  const iso3ByQid = new Map<string, string>();
  for (const [iso3, entry] of Object.entries(source)) {
    if (entry.qid && /^Q\d+$/.test(entry.qid)) iso3ByQid.set(entry.qid, iso3);
  }
  const qids = [...iso3ByQid.keys()].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  const query = `SELECT ?item ?coord WHERE { VALUES ?item { ${qids.map((q) => `wd:${q}`).join(" ")} } ?item wdt:P625 ?coord . }`;
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ query, format: "json" }),
  });
  if (!response.ok) {
    throw new Error(`Wikidata SPARQL request failed: HTTP ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as SparqlResponse;

  // A country can carry several P625 statements. Keep the smallest WKT string so the choice is deterministic.
  const wktByIso3 = new Map<string, string[]>();
  for (const binding of body.results.bindings) {
    const iso3 = iso3ByQid.get(qidFromUri(binding.item.value));
    if (!iso3) continue;
    const values = wktByIso3.get(iso3) ?? [];
    values.push(binding.coord.value);
    wktByIso3.set(iso3, values);
  }

  const coords = new Map<string, [number, number]>();
  for (const [iso3, values] of wktByIso3) {
    const point = parseWktPoint([...values].sort()[0]);
    if (point) coords.set(iso3, point);
  }
  if (coords.size === 0) {
    throw new Error(`No usable P625 coordinates returned; refusing to overwrite ${path.relative(ROOT, OUTPUT)}`);
  }

  const lines = [...coords.keys()]
    .sort()
    .map((iso3) => {
      const [lat, lon] = coords.get(iso3)!;
      return `  "${iso3}": [${lat}, ${lon}]`;
    });
  fs.writeFileSync(OUTPUT, `{\n${lines.join(",\n")}\n}\n`);

  const missing = [...iso3ByQid.values()].filter((iso3) => !coords.has(iso3)).sort();
  console.log(`P625 coverage: ${coords.size} of ${iso3ByQid.size} countries`);
  console.log(missing.length ? `Without P625 (left out, no coordinates invented): ${missing.join(", ")}` : "No country is missing P625.");
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
