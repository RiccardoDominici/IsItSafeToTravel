/**
 * Post-build SEO validation script.
 * Runs against dist/client output and validates hreflang tags,
 * JSON-LD structured data, meta tags, and llms-full.txt.
 *
 * Exit code 0 = all checks pass, 1 = at least one failure.
 */

import fs from "node:fs";
import path from "node:path";
import { routes } from "../src/i18n/ui.js";
import {
  localeMap,
  WEBSITE_ID,
  ORGANIZATION_ID,
  AUTHOR_ID,
  SITE_DATASET_ID,
} from "../src/lib/seo.js";
import { SOURCE_COUNT_DISPLAY, OTHER_SOURCE_COUNT_DISPLAY } from "../src/lib/site-stats.js";

const DIST = path.resolve(import.meta.dirname ?? ".", "../dist/client");

const LANGUAGES = ["en", "it", "es", "fr", "pt", "zh", "de"] as const;
type Language = (typeof LANGUAGES)[number];

// ISO3 → Wikidata/Wikipedia entity mapping used for Place.sameAs grounding.
// Loaded leniently: if the file is missing, the sameAs checks are skipped.
const WIKIDATA_MAP_PATH = path.resolve(
  import.meta.dirname ?? ".",
  "../src/data/countries-wikidata.json"
);
const WIKIDATA_MAP: Record<string, { qid?: string; wikipedia?: string; wikipediaByLang?: Partial<Record<Language, string>> }> = (() => {
  try {
    return JSON.parse(fs.readFileSync(WIKIDATA_MAP_PATH, "utf-8"));
  } catch {
    return {};
  }
})();

// Language-specific path segments for "country"
const COUNTRY_SEGMENT: Record<string, string> = {
  en: "country",
  it: "paese",
  es: "pais",
  fr: "pays",
  pt: "pais",
  zh: "country",
  de: "land",
};

// ---- helpers ----

function readHtml(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function getAllCountryCodes(): string[] {
  const dir = path.join(DIST, "en", "country");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((d) =>
    fs.statSync(path.join(dir, d)).isDirectory()
  );
}

function sampleArray<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ---- result tracking ----

let totalChecks = 0;
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  totalChecks++;
  if (ok) {
    passed++;
  } else {
    failed++;
    const msg = detail ? `FAIL: ${name} — ${detail}` : `FAIL: ${name}`;
    failures.push(msg);
  }
}

// =====================================================================
// 1. HREFLANG VALIDATION
// =====================================================================

function validateHreflang() {
  console.log("\n--- Hreflang Validation ---");

  const countryCodes = getAllCountryCodes();
  const sample = sampleArray(countryCodes, 12);

  // For each language, validate homepage + sampled country pages
  for (const lang of LANGUAGES) {
    // Homepage
    const homepagePath = path.join(DIST, lang, "index.html");
    if (fs.existsSync(homepagePath)) {
      validateHreflangPage(homepagePath, `${lang}/index.html`);
    } else {
      check(`hreflang: ${lang} homepage exists`, false, "file not found");
    }

    // Country pages
    for (const code of sample) {
      const seg = COUNTRY_SEGMENT[lang];
      const pagePath = path.join(DIST, lang, seg, code, "index.html");
      if (fs.existsSync(pagePath)) {
        validateHreflangPage(pagePath, `${lang}/${seg}/${code}/index.html`);
      } else {
        check(`hreflang: ${lang}/${seg}/${code} exists`, false, "file not found");
      }
    }
  }
}

/**
 * Site-wide sweep: every hreflang href on every built page must resolve to a
 * file in dist. Guards against the 2026-04 failure mode where a page shipped
 * before its localized route slug existed and getLocalizedPath passed the
 * English sub-slug through untranslated, advertising 404 URLs to Google
 * (e.g. /fr/regions/middle-east/). The sampled checks above miss hub pages.
 */
function validateAllHreflangTargets() {
  console.log("\n--- Hreflang Target Sweep (all pages) ---");

  const htmlFiles: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") htmlFiles.push(full);
    }
  };
  walk(DIST);

  const hreflangRe = /< *link[^>]*hreflang=["'][^"']+["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi;
  const broken: string[] = [];
  let scanned = 0;
  const seen = new Set<string>();

  for (const file of htmlFiles) {
    const html = readHtml(file);
    scanned++;
    let m;
    while ((m = hreflangRe.exec(html)) !== null) {
      const href = m[1];
      if (seen.has(href)) continue;
      seen.add(href);
      let pathname: string;
      try {
        pathname = new URL(href).pathname;
      } catch {
        broken.push(`${href} (unparseable, on ${path.relative(DIST, file)})`);
        continue;
      }
      const target =
        pathname === "/"
          ? null // root is a Accept-Language redirect function, not a file
          : path.join(DIST, pathname, "index.html");
      if (target && !fs.existsSync(target)) {
        broken.push(`${href} (linked from ${path.relative(DIST, file)})`);
      }
    }
  }

  check(
    `hreflang sweep: all targets exist (${scanned} pages, ${seen.size} unique URLs)`,
    broken.length === 0,
    broken.slice(0, 10).join("; ") + (broken.length > 10 ? ` … +${broken.length - 10} more` : "")
  );
}

function validateHreflangPage(filePath: string, label: string) {
  const html = readHtml(filePath);

  // Extract all hreflang tags: <link rel="alternate" hreflang="XX" href="URL">
  const hreflangRe = /< *link[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi;
  const hreflangs = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = hreflangRe.exec(html)) !== null) {
    hreflangs.set(m[1], m[2]);
  }

  // Also try the reversed attribute order
  const hreflangRe2 = /< *link[^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi;
  while ((m = hreflangRe2.exec(html)) !== null) {
    if (!hreflangs.has(m[1])) {
      hreflangs.set(m[1], m[2]);
    }
  }

  // Check all 7 languages are present
  for (const lang of LANGUAGES) {
    check(
      `hreflang(${label}): has ${lang}`,
      hreflangs.has(lang),
      `missing hreflang="${lang}"`
    );
  }

  // Check x-default
  check(
    `hreflang(${label}): has x-default`,
    hreflangs.has("x-default"),
    "missing x-default"
  );

  // x-default should point to English version
  if (hreflangs.has("x-default")) {
    const xDefault = hreflangs.get("x-default")!;
    check(
      `hreflang(${label}): x-default points to /en/`,
      xDefault.includes("/en/"),
      `x-default href: ${xDefault}`
    );
  }

  // Self-referencing check: determine which language this page is
  const langMatch = filePath.match(/dist\/client\/(\w{2})\//);
  if (langMatch) {
    const pageLang = langMatch[1];
    const selfHref = hreflangs.get(pageLang);
    if (selfHref) {
      // Extract path from URL and verify the file exists in dist
      const urlPath = selfHref.replace(/https?:\/\/[^/]+/, "");
      const normalizedPath = urlPath.endsWith("/")
        ? urlPath + "index.html"
        : urlPath.endsWith(".html")
          ? urlPath
          : urlPath + "/index.html";
      const localFile = path.join(DIST, normalizedPath);
      check(
        `hreflang(${label}): self-ref file exists`,
        fs.existsSync(localFile),
        `referenced path not found: ${normalizedPath}`
      );
    }
  }

  // Verify all hreflang URLs resolve to existing files
  for (const [lang, href] of hreflangs) {
    const urlPath = href.replace(/https?:\/\/[^/]+/, "");
    const normalizedPath = urlPath.endsWith("/")
      ? urlPath + "index.html"
      : urlPath.endsWith(".html")
        ? urlPath
        : urlPath + "/index.html";
    const localFile = path.join(DIST, normalizedPath);
    check(
      `hreflang(${label}): ${lang} URL exists`,
      fs.existsSync(localFile),
      `broken hreflang: ${href}`
    );
  }
}

// =====================================================================
// 2. JSON-LD VALIDATION
// =====================================================================

function validateJsonLd() {
  console.log("\n--- JSON-LD Validation ---");

  const countryCodes = getAllCountryCodes();
  const sample = sampleArray(countryCodes, 12);

  const expectedTypes = ["WebPage", "Place", "FAQPage", "TouristDestination", "Dataset"];

  for (const code of sample) {
    const filePath = path.join(DIST, "en", "country", code, "index.html");
    if (!fs.existsSync(filePath)) {
      check(`json-ld(en/country/${code}): file exists`, false);
      continue;
    }

    const html = readHtml(filePath);
    const label = `en/country/${code}`;

    // Extract JSON-LD blocks
    const jsonLdRe = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const blocks: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = jsonLdRe.exec(html)) !== null) {
      blocks.push(m[1]);
    }

    check(
      `json-ld(${label}): has at least 1 block`,
      blocks.length >= 1,
      `found ${blocks.length}`
    );

    for (let i = 0; i < blocks.length; i++) {
      let parsed: any;
      try {
        parsed = JSON.parse(blocks[i]);
        check(`json-ld(${label})[${i}]: valid JSON`, true);
      } catch {
        check(`json-ld(${label})[${i}]: valid JSON`, false, "parse error");
        continue;
      }

      // Check required fields
      check(
        `json-ld(${label})[${i}]: has @context`,
        !!parsed["@context"],
        "missing @context"
      );

      // Either @type or @graph should exist
      const hasType = !!parsed["@type"];
      const hasGraph = Array.isArray(parsed["@graph"]);
      check(
        `json-ld(${label})[${i}]: has @type or @graph`,
        hasType || hasGraph,
        "missing both @type and @graph"
      );

      // If it has @graph, check for expected types
      if (hasGraph) {
        const graphTypes = new Set<string>();
        for (const item of parsed["@graph"]) {
          if (typeof item["@type"] === "string") {
            graphTypes.add(item["@type"]);
          } else if (Array.isArray(item["@type"])) {
            item["@type"].forEach((t: string) => graphTypes.add(t));
          }
        }

        for (const expected of expectedTypes) {
          check(
            `json-ld(${label}): @graph has ${expected}`,
            graphTypes.has(expected),
            `missing ${expected} in @graph types: [${[...graphTypes].join(", ")}]`
          );
        }

        // Check that each graph item has "name" (for items that should)
        const namedTypes = ["WebPage", "Place", "TouristDestination"];
        for (const item of parsed["@graph"]) {
          const itemType = item["@type"];
          if (namedTypes.includes(itemType)) {
            check(
              `json-ld(${label}): ${itemType} has name`,
              !!item["name"],
              `${itemType} missing "name" field`
            );
          }
        }
      }

      // If single type, check name (skip types that don't use name)
      const typesWithoutName = ["BreadcrumbList", "ItemList"];
      if (hasType && !hasGraph && !typesWithoutName.includes(parsed["@type"])) {
        check(
          `json-ld(${label})[${i}]: has name`,
          !!parsed["name"],
          "missing name"
        );
      }
    }
  }
}

// =====================================================================
// 2b. SCHEMA CONNECTIONS & i18n (S1/S2/S6/S7/S9/S10/GEO-07 — 2026-09 audit)
// =====================================================================
// The 2026-09 SEO audit found every JSON-LD node on the site was an island
// (zero @id cross-references anywhere, even within one page's own @graph),
// Dataset/Organization text hardcoded English-only on 6/7 locales, ranking
// hub pages with no WebPage/CollectionPage/dateModified, and Place.sameAs
// always pointing at en.wikipedia.org regardless of page language. The same
// audit noted that several *earlier* schema fixes were written but never
// deployed (or deployed and then drifted) between its two runs — these
// checks exist so that can't happen silently to this round of fixes.

/** All JSON-LD nodes on a page, flattened across every <script> block and
 * every @graph — @type-only blocks and @graph arrays both included. */
function extractGraphNodes(html: string): Record<string, any>[] {
  const jsonLdRe = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const nodes: Record<string, any>[] = [];
  let m: RegExpExecArray | null;
  while ((m = jsonLdRe.exec(html)) !== null) {
    let parsed: any;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if (Array.isArray(parsed["@graph"])) nodes.push(...parsed["@graph"]);
    else nodes.push(parsed);
  }
  return nodes;
}

function nodeHasType(node: Record<string, any>, type: string): boolean {
  const t = node["@type"];
  return t === type || (Array.isArray(t) && t.includes(type));
}

function findNode(nodes: Record<string, any>[], type: string): Record<string, any> | undefined {
  return nodes.find((n) => nodeHasType(n, type));
}

/** routes[lang][key], loosely typed — this script only ever reads known-valid
 * route keys gathered from src/i18n/ui.ts, so a precise Routes type isn't worth
 * threading through just for a build-time validator. */
function routeSlug(lang: string, key: string): string | undefined {
  return (routes as unknown as Record<string, Record<string, string>>)[lang]?.[key];
}

function validateSchemaConnections() {
  console.log("\n--- Schema Connections: @id graph, i18n, Dataset properties ---");

  const countryCodes = getAllCountryCodes();
  // Smaller sample than the base JSON-LD check (12): here every code is
  // checked across all 7 languages (6 x 7 = 42 pages), not just English.
  const sample = sampleArray(countryCodes, 6);

  for (const code of sample) {
    for (const lang of LANGUAGES) {
      const seg = COUNTRY_SEGMENT[lang];
      const filePath = path.join(DIST, lang, seg, code, "index.html");
      if (!fs.existsSync(filePath)) continue; // already reported by validateHreflang/validateJsonLd
      const nodes = extractGraphNodes(readHtml(filePath));
      const label = `${lang}/${seg}/${code}`;

      const webPage = findNode(nodes, "WebPage");
      const place = findNode(nodes, "Place");
      const dataset = findNode(nodes, "Dataset");
      const placeId = place?.["@id"];

      check(`schema(${label}): WebPage node present`, !!webPage);
      if (webPage) {
        check(`schema(${label}): WebPage.isPartOf -> WebSite`, webPage.isPartOf?.["@id"] === WEBSITE_ID, JSON.stringify(webPage.isPartOf));
        check(`schema(${label}): WebPage.mainEntity -> Place`, !!placeId && webPage.mainEntity?.["@id"] === placeId, JSON.stringify(webPage.mainEntity));
        check(`schema(${label}): WebPage.publisher -> Organization`, webPage.publisher?.["@id"] === ORGANIZATION_ID, JSON.stringify(webPage.publisher));
        check(`schema(${label}): WebPage.author -> Person`, webPage.author?.["@id"] === AUTHOR_ID, JSON.stringify(webPage.author));
      }

      check(`schema(${label}): Dataset node present`, !!dataset);
      if (dataset) {
        check(`schema(${label}): Dataset.inLanguage matches page locale`, dataset.inLanguage === localeMap[lang], `got ${dataset.inLanguage}`);
        check(`schema(${label}): Dataset.isAccessibleForFree === true`, dataset.isAccessibleForFree === true, `got ${dataset.isAccessibleForFree}`);
        check(
          `schema(${label}): Dataset.temporalCoverage is a derived open interval`,
          typeof dataset.temporalCoverage === "string" && /^\d{4}-\d{2}-\d{2}\/\.\.$/.test(dataset.temporalCoverage),
          `got ${dataset.temporalCoverage} (should start where data/scores/history-index.json actually begins, not a hardcoded year)`
        );
        check(`schema(${label}): Dataset.spatialCoverage -> this country's Place`, !!placeId && dataset.spatialCoverage?.["@id"] === placeId, JSON.stringify(dataset.spatialCoverage));
        check(`schema(${label}): Dataset.creator -> Organization`, dataset.creator?.["@id"] === ORGANIZATION_ID, JSON.stringify(dataset.creator));
      }

      // GEO-07: Place.sameAs should use the page-language Wikipedia article
      // when countries-wikidata.json has one, falling back to English.
      const wd = WIKIDATA_MAP[code.toUpperCase()];
      if (place && wd) {
        const expectedWikipedia = lang === "en" ? wd.wikipedia : wd.wikipediaByLang?.[lang as Language] ?? wd.wikipedia;
        if (expectedWikipedia) {
          const sameAs: string[] = Array.isArray(place.sameAs) ? place.sameAs : [];
          check(
            `schema(${label}): Place.sameAs has the locale-appropriate Wikipedia article`,
            sameAs.includes(expectedWikipedia),
            `expected ${expectedWikipedia} in ${JSON.stringify(sameAs)}`
          );
        }
      }
    }
  }

  // Site-wide entities (homepage): Organization/WebSite/Dataset carry the
  // stable canonical @id, and Dataset name/description are localized (S2) —
  // regression-guarded here by asserting each non-EN description differs
  // from the English one, since "identical byte-for-byte to English" is
  // exactly how the original audit detected the missing localization.
  let enHomeOrgDescription: string | undefined;
  let enHomeDatasetDescription: string | undefined;
  for (const lang of LANGUAGES) {
    const filePath = path.join(DIST, lang, "index.html");
    if (!fs.existsSync(filePath)) continue;
    const nodes = extractGraphNodes(readHtml(filePath));
    const org = findNode(nodes, "Organization");
    const site = findNode(nodes, "WebSite");
    const dataset = findNode(nodes, "Dataset");
    const label = `${lang}/index`;

    check(`schema(${label}): Organization.@id is the canonical anchor`, org?.["@id"] === ORGANIZATION_ID, JSON.stringify(org?.["@id"]));
    check(`schema(${label}): WebSite.@id is the canonical anchor`, site?.["@id"] === WEBSITE_ID, JSON.stringify(site?.["@id"]));
    check(`schema(${label}): Dataset.@id is the canonical anchor`, dataset?.["@id"] === SITE_DATASET_ID, JSON.stringify(dataset?.["@id"]));
    check(`schema(${label}): Dataset.inLanguage matches page locale`, dataset?.inLanguage === localeMap[lang], `got ${dataset?.inLanguage}`);
    check(`schema(${label}): Dataset.isAccessibleForFree === true`, dataset?.isAccessibleForFree === true);
    check(
      // 5 since 2026-09 (Google Dataset Search pass): scores.json, scores.csv,
      // map-data.json, llms.txt, llms-full.txt (SITE_DATASET_DISTRIBUTION in seo.ts).
      `schema(${label}): Dataset.distribution has the 5 DataDownload entries`,
      Array.isArray(dataset?.distribution) && dataset.distribution.length === 5,
      `got ${JSON.stringify(dataset?.distribution)}`
    );

    if (lang === "en") {
      enHomeOrgDescription = org?.description;
      enHomeDatasetDescription = dataset?.description;
    } else {
      check(
        `schema(${label}): Organization.description is localized (not English)`,
        !!org?.description && org.description !== enHomeOrgDescription,
        org?.description
      );
      check(
        `schema(${label}): Dataset.description is localized (not English)`,
        !!dataset?.description && dataset.description !== enHomeDatasetDescription,
        dataset?.description
      );
    }
  }

  // Methodology Dataset (S9): variableMeasured used to be missing descriptions
  // on 5 of its 6 PropertyValue entries; now shares the same fully-described
  // per-language table as the homepage/country Dataset nodes.
  for (const lang of LANGUAGES) {
    const slug = routeSlug(lang, "methodology");
    if (!slug) continue;
    const filePath = path.join(DIST, lang, slug, "index.html");
    if (!fs.existsSync(filePath)) continue;
    const nodes = extractGraphNodes(readHtml(filePath));
    const dataset = findNode(nodes, "Dataset");
    const label = `${lang}/${slug}`;

    check(`schema(${label}): Dataset.isAccessibleForFree === true`, dataset?.isAccessibleForFree === true);
    check(`schema(${label}): Dataset.inLanguage matches page locale`, dataset?.inLanguage === localeMap[lang], `got ${dataset?.inLanguage}`);
    const variableMeasured: Array<{ description?: string }> = Array.isArray(dataset?.variableMeasured) ? dataset.variableMeasured : [];
    check(
      `schema(${label}): every Dataset.variableMeasured entry has a description`,
      variableMeasured.length > 0 && variableMeasured.every((v) => !!v.description),
      `${variableMeasured.filter((v) => !v.description).length}/${variableMeasured.length} missing description`
    );
  }

  // /en/api/: Dataset.distribution must list all 5 bulk downloads (S4 — used
  // to declare just scores.json even though the page documents 6 endpoints;
  // grew to 5 in 2026-09 when scores.csv was added alongside scores.json).
  const apiSlug = routeSlug("en", "api") ?? "api";
  const apiPath = path.join(DIST, "en", apiSlug, "index.html");
  if (fs.existsSync(apiPath)) {
    const dataset = findNode(extractGraphNodes(readHtml(apiPath)), "Dataset");
    check(
      `schema(en/${apiSlug}): Dataset.distribution has the 5 DataDownload entries`,
      Array.isArray(dataset?.distribution) && dataset.distribution.length === 5,
      `got ${JSON.stringify(dataset?.distribution)}`
    );
  } else {
    check(`schema(en/${apiSlug}): file exists`, false);
  }
}

// =====================================================================
// 2c. HUB COLLECTIONPAGE (S6 — 2026-09 audit)
// =====================================================================
// Ranking hub pages (safest/most-dangerous/countries-to-avoid/regions/...)
// never had a WebPage/CollectionPage node or a dateModified, unlike /news/.
// Sampled across 3 languages (not all 7) to keep this fast — the fix lives in
// one shared layout (HubPageLayout.astro), so a per-language sample is enough
// to catch a locale-specific regression without re-checking all ~13 hub types.

function validateHubSchema() {
  console.log("\n--- Hub CollectionPage (S6) ---");
  const HUB_ROUTE_KEYS = ["safest-countries", "most-dangerous-countries", "countries-to-avoid"];
  const SAMPLE_LANGS: Language[] = ["en", "it", "de"];

  for (const lang of SAMPLE_LANGS) {
    for (const key of HUB_ROUTE_KEYS) {
      const slug = routeSlug(lang, key);
      if (!slug) continue;
      const filePath = path.join(DIST, lang, slug, "index.html");
      const label = `${lang}/${slug}`;
      if (!fs.existsSync(filePath)) {
        check(`hub-schema(${label}): file exists`, false);
        continue;
      }
      const nodes = extractGraphNodes(readHtml(filePath));
      const collectionPage = findNode(nodes, "CollectionPage");
      const itemList = findNode(nodes, "ItemList");
      check(`hub-schema(${label}): has a CollectionPage node`, !!collectionPage);
      if (collectionPage) {
        check(
          `hub-schema(${label}): CollectionPage.dateModified is a date`,
          typeof collectionPage.dateModified === "string" && /^\d{4}-\d{2}-\d{2}$/.test(collectionPage.dateModified),
          `got ${collectionPage.dateModified}`
        );
        check(`hub-schema(${label}): CollectionPage.isPartOf -> WebSite`, collectionPage.isPartOf?.["@id"] === WEBSITE_ID);
        check(
          `hub-schema(${label}): CollectionPage.mainEntity -> ItemList`,
          !!itemList?.["@id"] && collectionPage.mainEntity?.["@id"] === itemList["@id"],
          JSON.stringify(collectionPage.mainEntity)
        );
      }
    }

    // Region pages take no hubType/FAQ prop and were explicitly called out in
    // the audit as still missing CollectionPage even if the ranking hubs got
    // fixed — the layout change must be unconditional, not FAQ-gated.
    const regionsSlug = routeSlug(lang, "regions");
    const europeSlug = routeSlug(lang, "europe");
    if (regionsSlug && europeSlug) {
      const filePath = path.join(DIST, lang, regionsSlug, europeSlug, "index.html");
      const label = `${lang}/${regionsSlug}/${europeSlug}`;
      if (fs.existsSync(filePath)) {
        const hasCollectionPage = !!findNode(extractGraphNodes(readHtml(filePath)), "CollectionPage");
        check(`hub-schema(${label}): region page has a CollectionPage node`, hasCollectionPage);
      } else {
        check(`hub-schema(${label}): file exists`, false);
      }
    }
  }
}

// =====================================================================
// 3. META TAG VALIDATION
// =====================================================================

function validateMeta() {
  console.log("\n--- Meta Tag Validation ---");

  const countryCodes = getAllCountryCodes();
  const sample = sampleArray(countryCodes, 12);
  // Per-language duplicate maps so a coincidental cross-language lowercase
  // collision (e.g. when zh/de fall back to the English country name) does
  // not flag pages that legitimately render different localized templates.
  const descriptionsByLang = new Map<string, Map<string, string>>();
  for (const lang of LANGUAGES) descriptionsByLang.set(lang, new Map());

  // Collect pages to check: homepages + country samples
  const pages: Array<{ path: string; label: string; lang: string }> = [];

  for (const lang of LANGUAGES) {
    pages.push({
      path: path.join(DIST, lang, "index.html"),
      label: `${lang}/index.html`,
      lang,
    });
  }

  for (const code of sample) {
    for (const lang of LANGUAGES) {
      const seg = COUNTRY_SEGMENT[lang];
      pages.push({
        path: path.join(DIST, lang, seg, code, "index.html"),
        label: `${lang}/${seg}/${code}`,
        lang,
      });
    }
  }

  for (const page of pages) {
    if (!fs.existsSync(page.path)) {
      check(`meta(${page.label}): file exists`, false);
      continue;
    }

    const html = readHtml(page.path);

    // Meta description
    const descMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i
    );
    check(
      `meta(${page.label}): has meta description`,
      !!descMatch,
      "missing <meta name=\"description\">"
    );

    if (descMatch) {
      const desc = descMatch[1].trim();
      check(
        `meta(${page.label}): description not empty`,
        desc.length > 0,
        "empty description"
      );

      const langDescriptions = descriptionsByLang.get(page.lang)!;
      const key = desc.toLowerCase();
      if (langDescriptions.has(key)) {
        check(
          `meta(${page.label}): unique description`,
          false,
          `duplicate of ${langDescriptions.get(key)}`
        );
      } else {
        check(`meta(${page.label}): unique description`, true);
        langDescriptions.set(key, page.label);
      }
    }

    // Canonical link
    const canonicalMatch = html.match(
      /<link\s+rel=["']canonical["']\s+href=["'][^"']+["']/i
    );
    check(
      `meta(${page.label}): has canonical`,
      !!canonicalMatch,
      "missing <link rel=\"canonical\">"
    );
  }
}

// =====================================================================
// 4. LLMS-FULL.TXT VALIDATION
// =====================================================================

function validateLlmsFullTxt() {
  console.log("\n--- llms-full.txt Validation ---");

  const filePath = path.join(DIST, "llms-full.txt");

  check("llms-full.txt: file exists", fs.existsSync(filePath));
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf-8");

  check(
    "llms-full.txt: not empty",
    content.length > 0,
    `file size: ${content.length} bytes`
  );

  // Check for citation instruction text
  check(
    "llms-full.txt: has citation instructions",
    content.includes("Citation") || content.includes("citation") || content.includes("cite"),
    "missing citation instruction text"
  );

  // Count country entries — the file uses "### {Country Name} ({ISO3})" headers
  const countryHeaders = content.match(/^### .+ \([A-Z]{3}\)/gm);
  const countryCount = countryHeaders ? countryHeaders.length : 0;

  check(
    "llms-full.txt: has >= 200 country entries",
    countryCount >= 200,
    `found ${countryCount} country-level headers`
  );

  console.log(`  (llms-full.txt: ${content.length} bytes, ~${countryCount} country entries)`);

  // Exactly one regional aggregate: a second "## Regional Averages" list used a
  // different region map than the comparison table and published conflicting
  // numbers in the same file (2026-08 SEO audit).
  check(
    "llms-full.txt: single regional aggregate (no 'Regional Averages' duplicate)",
    !content.includes("## Regional Averages"),
    "duplicate regional section reintroduced"
  );
}

// =====================================================================
// 4b. CANONICAL COUNT CLAIMS
// =====================================================================
// The 2026-08 SEO audit found four contradictory source counts ("7 trusted",
// "9+", "40+") and three country counts ("200+", "240+", 248) live at once.
// Canonical values live in src/lib/site-stats.ts; this walk fails the build
// if any known stale variant creeps back into the rendered output.

function validateCanonicalCounts() {
  console.log("\n--- Canonical Count Claims ---");

  // Source-count stale literals ("7 trusted", "9+", "40+" -- the 2026-08
  // audit's four contradictory variants, plus "40+" once it too went stale
  // in phase 2) used to be hand-enumerated here as a blocklist. Replaced by
  // validateComputedCounts() below: a static list can only catch numbers
  // someone thought to type in by hand, and phase 2 hit that limit directly
  // -- "ad altre 7 fonti pubbliche" (legitimately 7 non-advisory feeds once
  // OTHER_SOURCE_COUNT_DISPLAY started showing exact counts below 10)
  // substring-matched the old `/(?<!\d)7 fonti pubbliche/` guard, which was
  // written years before that value could ever legitimately be single-digit.
  // A check against the live SOURCE_COUNT_DISPLAY/OTHER_SOURCE_COUNT_DISPLAY
  // catches that same class of bug (and any future one) without needing a
  // new pattern added by hand every time the computed value's shape changes.
  //
  // Country-count stale literals stay here: COUNTRY_COUNT has none of the
  // source-count axis's ambiguity (single exact value, always 248 today, no
  // "total vs. other subset" split) and no report of it going stale, so a
  // blocklist remains the simplest correct guard for it.
  //
  // Government-count stale literals ALSO stay here as a blocklist, not a
  // computed check: unlike the source-count axis, "N governments"/"N
  // government travel advisories" is also a legitimate, CORRECT *per-country*
  // claim (engine.ts's buildAdvisoryDescription, hub.blurb_advisories,
  // country-faq-copy.ts's advisoryCountNoun each vary this number by design,
  // one country at a time) -- a positive check like validateComputedCounts()
  // below would fail every country page instead of catching a real
  // regression. "37" itself is safe to blocklist outright, site-wide or
  // per-country: it's ADVISORY_CODES.length, the dead static array size no
  // real computation (aggregate or per-country) has produced since this
  // audit shipped. NOTE: this axis had NO guard at all before this comment
  // was written -- an earlier commit on this branch claimed a "37
  // governments"-family blocklist already existed here "for that axis";
  // it did not, the pre-existing comment just explained why the "7 …"
  // regexes below use a digit lookbehind. Fixed the actual gap here instead
  // of leaving the incorrect claim standing.
  //
  // "37 governments" excludes a trailing "worldwide" on purpose: that exact
  // phrase ("Travel advisories from 37 governments worldwide including...")
  // is SOURCE_CATALOG.advisories.description in engine.ts, fixed in code
  // (I1, buildAdvisoryDescription now lists only the real issuers per
  // country) but still live in the already-committed data/scores/latest.json
  // and public/scores.json this exact snapshot ships with -- out of scope to
  // regenerate here (never hand-edit committed data), and it resolves itself
  // automatically on the next scheduled pipeline run. Blocking the bare
  // phrase would fail this check against every already-built page today for
  // a staleness that isn't a code regression and needs no code change.
  const FORBIDDEN: (string | RegExp)[] = [
    /(?<!\d)37 governments\b(?! worldwide)/,
    /(?<!\d)37 government sources/,
    /(?<!\d)37 government foreign affairs ministries/,
    /(?<!\d)37 government travel advisories/,
    /(?<!\d)37 governi\b/,
    /(?<!\d)37 fonti governative/,
    /(?<!\d)37 gobiernos\b/,
    /(?<!\d)37 fuentes gubernamentales/,
    /(?<!\d)37 ministerios de asuntos exteriores gubernamentales/,
    /(?<!\d)37 gouvernements\b/,
    /(?<!\d)37 sources gouvernementales/,
    /(?<!\d)37 governos\b/,
    /(?<!\d)37 fontes governamentais/,
    /(?<!\d)37 ministérios de relações exteriores governamentais/,
    /(?<!\d)37 个政府/,
    /(?<!\d)37 个政府来源/,
    /(?<!\d)37 个政府外交部/,
    /(?<!\d)37 Regierungen/,
    /(?<!\d)37 staatlich(e|en) Quellen/,
    /(?<!\d)37 Außenministerien/,
    /(?<!\d)37 Ländern\b/,
    "200+ countries",
    "240+ countries",
    "240+ Countries",
    "240+ paesi",
    "240+ Paesi",
    "240+ paises",
    "240+ Paises",
    "240+ pays",
    "240+ Pays",
    "240+ Länder",
    "240+ 国家",
    "200+ 个国家",
    "200+ Länder",
  ];

  // Walk every rendered HTML file plus the llms outputs.
  const targets: string[] = [
    path.join(DIST, "llms.txt"),
    path.join(DIST, "llms-full.txt"),
  ];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".html")) targets.push(full);
    }
  };
  walk(DIST);

  const offenders = new Map<string, string>();
  for (const file of targets) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf-8");
    for (const pattern of FORBIDDEN) {
      const key = pattern.toString();
      const hit = typeof pattern === "string" ? content.includes(pattern) : pattern.test(content);
      if (hit && !offenders.has(key)) {
        offenders.set(key, path.relative(DIST, file));
      }
    }
  }

  check(
    "counts: no stale source/country-count claims in rendered output",
    offenders.size === 0,
    [...offenders.entries()].map(([p, f]) => `"${p}" in ${f}`).join("; ")
  );
  console.log(`  (scanned ${targets.length} files for ${FORBIDDEN.length} stale patterns)`);
}

// =====================================================================
// 4c. COMPUTED SOURCE-COUNT CONSISTENCY
// =====================================================================
// Positive complement to the blocklist above: instead of only rejecting
// specific OLD known-bad numbers, assert that wherever a number appears
// directly before one of the "public sources" noun phrases this fix round
// actually used, that number is one of the values site-stats.ts currently
// computes -- catches ANY wrong number, not just the ones enumerated by
// hand, so a future regression doesn't need a new blocklist entry to be
// caught.
//
// Deliberately scoped to SOURCE/OTHER-SOURCE counts only, not government
// counts: "N governments" and "N government travel advisories" are also
// legitimate, CORRECT *per-country* claims (buildAdvisoryDescription in
// engine.ts, hub.blurb_advisories, country-faq-copy.ts's advisoryCountNoun
// all vary this number by design, one country at a time) — a generic regex
// can't tell "this is the site-wide ADVISORY_GOV_COUNT_DISPLAY claim" apart
// from "this is Japan's real count of 14," so a positive check there would
// fail every country page instead of catching a real regression. The
// blocklist's exact "37 governments"-family patterns above remain the
// guard for that axis: safe specifically because 37 is a dead number no
// correct value (site-wide or per-country) can legitimately produce.
function validateComputedCounts() {
  console.log("\n--- Computed Source-Count Consistency ---");

  // Noun-phrase families actually used for "how many public sources" claims
  // across this fix round's edits (ui.ts, about-copy.ts, hub-faq.ts,
  // CitePage.astro, seo.ts, ApiDocs.astro, generate-llms-full.ts,
  // send-daily-digest.ts, HubPageLayout.astro). Best-effort, not exhaustive:
  // covers the noun phrases already in use, not every phrasing a future edit
  // might introduce — a new sentence shape needs its noun phrase added here
  // to stay covered.
  const SOURCE_NOUNS = [
    "trusted public sources", "public data sources", "public sources",
    "independent sources", "global sources", "data sources", "sources",
    "fonti pubbliche", "fonti",
    "fuentes públicas", "fuentes",
    "sources publiques",
    "fontes públicas", "fontes",
    "个可信公开来源", "个公开数据源", "个公开来源", "个数据来源", "个数据源",
    "个全球信息源", "个全球数据源", "个独立数据源", "个官方与公开数据源",
    "个官方与公开来源", "个来源",
    "vertrauenswürdigen öffentlichen Quellen", "öffentlichen Quellen",
    "globalen Quellen", "weltweiten Quellen", "Datenquellen", "Quellen",
  ];

  // A number is valid only for the ONE context its sentence actually is --
  // not "any currently-computed value" -- otherwise a stray "7 trusted
  // public sources" would slip through today simply because 7 happens to
  // also be the unrelated OTHER_SOURCE_COUNT_DISPLAY, defeating the point.
  // it/es/zh put their "other/additional" qualifier (altre/otra(s)/其他)
  // directly before the NUMBER ("ad altre 7 fonti pubbliche", "其他 7 个公开
  // 数据源"); en/fr/pt/de put it between the number and noun instead ("7
  // other public sources"), which already never matches SOURCE_NOUNS's
  // "number immediately before noun" shape -- those 4 languages' "other"
  // sentences simply aren't captured by this check either way, a known gap,
  // not a false accept.
  const OTHER_QUALIFIER_BEFORE_NUMBER = /(altre|otras?|其他)\s*$/i;
  // "independent sources" is also generate-llms-full.ts's noun for the
  // unrelated, intentionally-fixed MIN_RANKING_SOURCES=4 ranking-eligibility
  // footnote (hub-data.ts, documented in CLAUDE.md) -- accepted alongside
  // whichever count the context otherwise expects, not instead of it.
  const RANKING_FLOOR_DISPLAY = "4+";

  // Longest-first so "trusted public sources" matches before the bare
  // "sources" alternative would otherwise win inside the same regex. The
  // trailing negative lookahead excludes "N fuentes/fonti/fontes/sources
  // gubernamentales/governative/governamentais/gouvernementales" -- es/it/pt/fr
  // put the "government" qualifier AFTER the noun (unlike en/de, where it
  // comes before and so never collides with these alternatives at all): that
  // compound is the ADVISORY_GOV_COUNT_DISPLAY claim, a different metric this
  // function deliberately doesn't check (see the file comment above) --
  // without the guard this function false-failed its own author's correct
  // Phase 1 output ("25+ fuentes gubernamentales" etc.), caught by actually
  // running it against the real build rather than assuming the regex was safe.
  const escaped = [...SOURCE_NOUNS]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(
    `(\\d+\\+?) (${escaped.join("|")})(?!\\s*(gubernamentales|governative|governativi|governamentais|gouvernementales))`,
    "g"
  );

  const targets: string[] = [
    path.join(DIST, "llms.txt"),
    path.join(DIST, "llms-full.txt"),
  ];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".html")) targets.push(full);
    }
  };
  walk(DIST);

  const bad: string[] = [];
  for (const file of targets) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf-8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const before = content.slice(Math.max(0, m.index - 20), m.index);
      const isOtherContext = OTHER_QUALIFIER_BEFORE_NUMBER.test(before);
      const expected = isOtherContext ? OTHER_SOURCE_COUNT_DISPLAY : SOURCE_COUNT_DISPLAY;
      if (m[1] !== expected && m[1] !== RANKING_FLOOR_DISPLAY) {
        bad.push(`"${m[1]} ${m[2]}" in ${path.relative(DIST, file)} (expected ${expected})`);
      }
    }
  }

  check(
    "counts: every source-count claim matches a currently computed value",
    bad.length === 0,
    [...new Set(bad)].slice(0, 15).join("; ")
  );
  console.log(
    `  (live values: total=${SOURCE_COUNT_DISPLAY}, other-feeds=${OTHER_SOURCE_COUNT_DISPLAY}; scanned ${targets.length} files)`
  );
}

// =====================================================================
// 5. ADVISORY COVERAGE VALIDATION
// =====================================================================
// Catches regressions like the 2026-05-27 → 2026-06-02 incident where the
// US State Department HTML structure changed (level-badge-N → level-title-N)
// and the per-source fetcher silently returned 0 countries for ~6 days.
// Using JPN as a canary because all four tier-1 sources cover Japan.

function validateAdvisoryCoverage() {
  console.log("\n--- Advisory Coverage Validation ---");

  const scoresPath = path.join(DIST, "scores.json");
  if (!fs.existsSync(scoresPath)) {
    check("advisories: scores.json present in dist", false, scoresPath);
    return;
  }

  let scores: { countries?: Array<{ iso3: string; advisories?: Record<string, unknown> }> };
  try {
    scores = JSON.parse(fs.readFileSync(scoresPath, "utf-8"));
  } catch (err) {
    check("advisories: scores.json parses", false, String(err));
    return;
  }

  const countries = scores.countries ?? [];
  const jpn = countries.find((c) => c.iso3 === "JPN");

  check(
    "advisories: JPN entry exists in scores.json",
    !!jpn,
    "no country with iso3=JPN found"
  );
  if (!jpn) return;

  const adv = jpn.advisories ?? {};
  for (const src of ["us", "uk", "ca", "au"] as const) {
    check(
      `advisories: JPN.${src} is non-null (per-source canary)`,
      adv[src] != null,
      `JPN.${src} = ${JSON.stringify(adv[src])}`
    );
  }

  // Per-column coverage floor — same idea, broader.
  let usCovered = 0, ukCovered = 0, caCovered = 0, auCovered = 0;
  for (const c of countries) {
    const a = (c.advisories ?? {}) as Record<string, unknown>;
    if (a.us != null) usCovered++;
    if (a.uk != null) ukCovered++;
    if (a.ca != null) caCovered++;
    if (a.au != null) auCovered++;
  }
  const FLOOR = 150;
  check(`advisories: US column has >= ${FLOOR} countries`, usCovered >= FLOOR, `${usCovered} countries`);
  check(`advisories: UK column has >= ${FLOOR} countries`, ukCovered >= FLOOR, `${ukCovered} countries`);
  check(`advisories: CA column has >= ${FLOOR} countries`, caCovered >= FLOOR, `${caCovered} countries`);
  check(`advisories: AU column has >= ${FLOOR} countries`, auCovered >= FLOOR, `${auCovered} countries`);

  console.log(
    `  (advisory coverage: US=${usCovered} UK=${ukCovered} CA=${caCovered} AU=${auCovered})`
  );
}

// =====================================================================
// 5b. DATASET DESCRIPTION LENGTH (Google Dataset rich-result spec)
// =====================================================================
// Google's Dataset structured data spec requires description in [50, 5000]
// characters. A too-short description (e.g. the original zh template that
// only rendered ~30 chars for short country names) triggers the GSC
// "Lunghezza stringa non valida nel campo 'description'" alert and the
// page falls out of dataset rich results. Canary on JPN (its locale-zh
// page was the original regression).

function validateDatasetDescriptionLength() {
  console.log("\n--- Dataset Description Length ---");
  const MIN = 50;
  const MAX = 5000;
  const LOCALE_TO_COUNTRY_PATH: Record<string, string> = {
    en: "country", it: "paese", es: "pais", fr: "pays",
    pt: "pais", zh: "country", de: "land",
  };

  for (const lang of LANGUAGES) {
    const seg = LOCALE_TO_COUNTRY_PATH[lang];
    const filePath = path.join(DIST, lang, seg, "jpn", "index.html");
    if (!fs.existsSync(filePath)) {
      check(`dataset(${lang}): JPN file exists`, false, filePath);
      continue;
    }
    const html = readHtml(filePath);
    const jsonLdRe = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let foundDataset = false;
    let m: RegExpExecArray | null;
    while ((m = jsonLdRe.exec(html)) !== null) {
      let parsed: { "@graph"?: Array<{ "@type"?: string | string[]; description?: string }> };
      try {
        parsed = JSON.parse(m[1]);
      } catch {
        continue;
      }
      const graph = parsed["@graph"] ?? [];
      for (const node of graph) {
        const t = node["@type"];
        const isDataset = t === "Dataset" || (Array.isArray(t) && t.includes("Dataset"));
        if (!isDataset) continue;
        foundDataset = true;
        const desc = typeof node.description === "string" ? node.description : "";
        const ok = desc.length >= MIN && desc.length <= MAX;
        check(
          `dataset(${lang}/JPN): description length ${desc.length} in [${MIN}, ${MAX}]`,
          ok,
          ok ? undefined : `description="${desc}" (length ${desc.length})`,
        );
      }
    }
    check(
      `dataset(${lang}/JPN): Dataset graph node present`,
      foundDataset,
      foundDataset ? undefined : "no Dataset node found in any JSON-LD block",
    );
  }
}

// =====================================================================
// 6. ADVISORY LEVEL + SOURCE INTEGRITY (regression guards)
// =====================================================================
// Additional invariants tied to the prior 11-bug investigation:
//  - JPN NL advisory level ≤ 2 (Fukushima sub-region promotion regression)
//  - JPN DE advisory level ≤ 2 (Teilreisewarnung promotion regression)
//  - No source entries with empty url (broken-anchor regression)
//  - No tier-source aggregates leak into sources list

function validateAdvisoryIntegrity() {
  console.log("\n--- Advisory Integrity ---");
  const scoresPath = path.join(DIST, "scores.json");
  if (!fs.existsSync(scoresPath)) return; // already reported in validateAdvisoryCoverage

  const data = JSON.parse(fs.readFileSync(scoresPath, "utf-8")) as {
    countries: Array<{
      iso3: string;
      advisories?: Record<string, { level?: number } | null>;
      sources?: Array<{ name: string; url: string }>;
    }>;
  };

  const jpn = data.countries.find((c) => c.iso3 === "JPN");
  if (jpn) {
    const nl = jpn.advisories?.nl?.level ?? 0;
    check(
      "advisories: JPN NL advisory level <= 2",
      nl <= 2,
      nl > 2 ? `got level=${nl} (Fukushima sub-region promotion regression)` : undefined,
    );
    const de = jpn.advisories?.de?.level ?? 0;
    check(
      "advisories: JPN DE advisory level <= 2",
      de <= 2,
      de > 2 ? `got level=${de} (Teilreisewarnung promotion regression)` : undefined,
    );
  }

  let emptyUrls = 0;
  let tierLeak = 0;
  for (const c of data.countries) {
    for (const s of c.sources ?? []) {
      if (!s.url) emptyUrls++;
      if (s.name && s.name.startsWith("advisories_tier")) tierLeak++;
    }
  }
  check(
    "advisories: no source entries with empty url",
    emptyUrls === 0,
    emptyUrls > 0 ? `${emptyUrls} entries with empty url (broken anchors)` : undefined,
  );
  check(
    "advisories: no tier-source aggregates leak into sources",
    tierLeak === 0,
    tierLeak > 0 ? `${tierLeak} aggregates leaked (engine.ts skip filter regression)` : undefined,
  );
}

// =====================================================================
// DATASET COMPLETENESS (Google Dataset Search visibility pass, 2026-09-26)
// =====================================================================
// Extends the existing per-country Dataset check above (validateDatasetDescriptionLength)
// with checks on the SITE-WIDE Dataset node (buildDatasetJsonLd/SITE_DATASET_ID),
// which homepage/api/cite-this-data/methodology all embed. Verifies the fields
// added for Google Dataset Search: dateModified, version, includedInDataCatalog,
// and a CSV entry in `distribution` alongside the pre-existing JSON one.

function findDatasetNode(html: string): Record<string, unknown> | null {
  const jsonLdRe = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonLdRe.exec(html)) !== null) {
    let parsed: { "@graph"?: Array<Record<string, unknown>> };
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }
    for (const node of parsed["@graph"] ?? []) {
      const t = node["@type"];
      if (t === "Dataset" || (Array.isArray(t) && t.includes("Dataset"))) return node;
    }
  }
  return null;
}

function validateSiteDatasetCompleteness() {
  console.log("\n--- Site-wide Dataset Completeness (Google Dataset Search) ---");
  const filePath = path.join(DIST, "en", "api", "index.html");
  if (!fs.existsSync(filePath)) {
    check("dataset(site-wide): /en/api/ exists", false, filePath);
    return;
  }
  const dataset = findDatasetNode(readHtml(filePath));
  check("dataset(site-wide): Dataset node present on /en/api/", dataset !== null);
  if (!dataset) return;

  const dateModified = dataset.dateModified;
  check(
    "dataset(site-wide): dateModified present",
    typeof dateModified === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateModified),
    `dateModified=${JSON.stringify(dateModified)}`,
  );

  const version = dataset.version;
  check(
    "dataset(site-wide): version present",
    typeof version === "string" && version.length > 0,
    `version=${JSON.stringify(version)}`,
  );

  const catalog = dataset.includedInDataCatalog as { "@type"?: string } | undefined;
  check(
    "dataset(site-wide): includedInDataCatalog present",
    !!catalog && catalog["@type"] === "DataCatalog",
  );

  const distribution = (dataset.distribution ?? []) as Array<{ encodingFormat?: string; contentUrl?: string }>;
  const hasJson = distribution.some((d) => d.encodingFormat === "application/json" && d.contentUrl?.endsWith("scores.json"));
  const hasCsv = distribution.some((d) => d.encodingFormat === "text/csv" && d.contentUrl?.endsWith("scores.csv"));
  check("dataset(site-wide): distribution includes scores.json", hasJson);
  check("dataset(site-wide): distribution includes scores.csv", hasCsv);
}

// =====================================================================
// SCORES.CSV (tabular twin of scores.json — src/lib/dataset-csv.ts)
// =====================================================================

function validateScoresCsv() {
  console.log("\n--- scores.csv ---");
  const csvPath = path.join(DIST, "scores.csv");
  const scoresJsonPath = path.join(DIST, "scores.json");
  if (!fs.existsSync(csvPath)) {
    check("scores.csv: file exists", false, csvPath);
    return;
  }
  const raw = fs.readFileSync(csvPath, "utf-8");
  const noBom = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  check("scores.csv: has UTF-8 BOM", raw.charCodeAt(0) === 0xfeff);
  const lines = noBom.split("\r\n").filter((l) => l.length > 0);
  check("scores.csv: uses CRLF line endings", noBom.includes("\r\n"));
  const header = lines[0] ?? "";
  check(
    "scores.csv: header has expected columns",
    header.startsWith("iso3,name_en,score,band,pillar_conflict,pillar_crime,pillar_health,pillar_governance,pillar_environment,confidence,advisory_sources,data_date"),
    header,
  );

  if (fs.existsSync(scoresJsonPath)) {
    const { countries } = JSON.parse(fs.readFileSync(scoresJsonPath, "utf-8")) as { countries: unknown[] };
    check(
      `scores.csv: one row per country (${countries.length} expected)`,
      lines.length - 1 === countries.length,
      `got ${lines.length - 1} data rows, scores.json has ${countries.length} countries`,
    );
  }
}

// =====================================================================
// 7. NEWS PAGES (Daily News / "Safety Movers")
// =====================================================================
// Keep NEWS_SLUG in sync with the `news` key in src/i18n/ui.ts `routes` for every locale.

function validateNewsPages() {
  console.log("\n--- News Pages ---");
  const NEWS_SLUG: Record<string, string> = {
    en: "news",
    it: "notizie",
    es: "noticias",
    fr: "actualites",
    pt: "noticias",
    zh: "news",
    de: "nachrichten",
  };

  for (const lang of LANGUAGES) {
    const p = path.join(DIST, lang, NEWS_SLUG[lang], "index.html");
    const ok = fs.existsSync(p);
    check(`news: ${lang}/${NEWS_SLUG[lang]} exists`, ok, ok ? "" : "file not found");
    if (ok) {
      const html = readHtml(p);
      check(`news: ${lang} has JSON-LD`, html.includes('application/ld+json'));
    }
  }
}

// =====================================================================
// 8. COMMUNITY VS DATA PAGE (2026-09-26 visibility-pages batch)
// =====================================================================
// /community-vs-data/: ranks every country with enough sentiment votes by the
// gap between our score and community sentiment (CommunityVsDataPage.astro).
// Thin-page guard: fewer than 3 ranked countries must noindex
// (VISIBILITY-BRIEF-COMMON.md) -- both directions of that rule are asserted
// here, kept in sync with the identical `ranked.length < 3` check in
// CommunityVsDataPage.astro (the source of truth; this just guards against
// the two drifting apart).

function validateCommunityVsDataPage() {
  console.log("\n--- Community vs Data Page ---");

  for (const lang of LANGUAGES) {
    const slug = routeSlug(lang, "community-vs-data");
    if (!slug) {
      check(`community-vs-data(${lang}): route slug configured`, false, "missing routes[lang]['community-vs-data']");
      continue;
    }
    const filePath = path.join(DIST, lang, slug, "index.html");
    const label = `${lang}/${slug}`;
    if (!fs.existsSync(filePath)) {
      check(`community-vs-data(${label}): file exists`, false);
      continue;
    }

    const html = readHtml(filePath);
    const nodes = extractGraphNodes(html);
    const webPage = findNode(nodes, "WebPage");
    const breadcrumbList = findNode(nodes, "BreadcrumbList");
    const itemList = findNode(nodes, "ItemList");

    check(`community-vs-data(${label}): has WebPage node`, !!webPage);
    check(`community-vs-data(${label}): has BreadcrumbList node`, !!breadcrumbList);
    check(`community-vs-data(${label}): has ItemList node`, !!itemList);
    if (webPage) {
      check(
        `community-vs-data(${label}): WebPage.dateModified is a date`,
        typeof webPage.dateModified === "string" && /^\d{4}-\d{2}-\d{2}$/.test(webPage.dateModified),
        `got ${webPage.dateModified}`
      );
      check(`community-vs-data(${label}): WebPage.isPartOf -> WebSite`, webPage.isPartOf?.["@id"] === WEBSITE_ID);
    }

    const numberOfItems = typeof itemList?.numberOfItems === "number" ? itemList.numberOfItems : -1;
    check(
      `community-vs-data(${label}): ItemList.numberOfItems is a number`,
      numberOfItems >= 0,
      `got ${itemList?.numberOfItems}`
    );

    const robotsMatch = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
    const isNoindexed = !!robotsMatch && /noindex/i.test(robotsMatch[1]);

    // Whichever side of the 3-country line today's live data happens to land
    // on, only the matching direction of the rule is asserted.
    if (numberOfItems >= 0 && numberOfItems < 3) {
      check(`community-vs-data(${label}): noindex below 3 ranked countries (today: ${numberOfItems})`, isNoindexed);
    } else if (numberOfItems >= 3) {
      check(`community-vs-data(${label}): indexable at 3+ ranked countries (today: ${numberOfItems})`, !isNoindexed);
    }
  }
}

// =====================================================================
// 9. TRAVEL SAFETY INDEX PAGE (flagship "travel safety index" head-term page)
// =====================================================================
// Keep TSI_SLUG in sync with the `travel-safety-index` key in src/i18n/ui.ts `routes`.

function validateTravelSafetyIndexPage() {
  console.log("\n--- Travel Safety Index Page ---");
  const TSI_SLUG: Record<string, string> = {
    en: "travel-safety-index",
    it: "indice-sicurezza-viaggi",
    es: "indice-seguridad-viajes",
    fr: "indice-securite-voyage",
    pt: "indice-seguranca-viagem",
    zh: "travel-safety-index",
    de: "reisesicherheitsindex",
  };

  for (const lang of LANGUAGES) {
    const p = path.join(DIST, lang, TSI_SLUG[lang], "index.html");
    const ok = fs.existsSync(p);
    check(`travel-safety-index: ${lang}/${TSI_SLUG[lang]} exists`, ok, ok ? "" : "file not found");
    if (!ok) continue;

    const html = readHtml(p);
    check(`travel-safety-index: ${lang} has exactly one <h1>`, (html.match(/<h1[\s>]/g) ?? []).length === 1);

    // Collects @type across BOTH shapes present on this page: the page's own
    // @graph array (WebPage/Dataset/ItemList/FAQPage) AND the separate bare
    // '@type': 'BreadcrumbList' object <Breadcrumb>.astro emits on its own
    // (same dual-shape scan as validateJsonLd above) — BreadcrumbList is
    // deliberately NOT duplicated inside the page's own @graph (see the
    // "No inline BreadcrumbList here" comment in ApiDocs.astro: shipping it in
    // both places was a real regression on every /api/ page previously).
    const jsonLdRe = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const graphTypes = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = jsonLdRe.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(m[1]) as { "@type"?: string | string[]; "@graph"?: Array<{ "@type"?: string | string[] }> };
        const t = parsed["@type"];
        if (typeof t === "string") graphTypes.add(t);
        else if (Array.isArray(t)) t.forEach((tt) => graphTypes.add(tt));
        for (const node of parsed["@graph"] ?? []) {
          const nt = node["@type"];
          if (typeof nt === "string") graphTypes.add(nt);
          else if (Array.isArray(nt)) nt.forEach((tt) => graphTypes.add(tt));
        }
      } catch {
        // ignore non-JSON-LD script blocks
      }
    }
    for (const required of ["WebPage", "BreadcrumbList", "Dataset", "ItemList", "FAQPage"]) {
      check(`travel-safety-index: ${lang} JSON-LD includes ${required}`, graphTypes.has(required), `found types: ${[...graphTypes].join(", ")}`);
    }
  }
}

// =====================================================================
// MAIN
// =====================================================================

function main() {
  console.log(`\nSEO Post-Build Validation`);
  console.log(`Build directory: ${DIST}`);

  if (!fs.existsSync(DIST)) {
    console.error(`ERROR: dist/client directory not found at ${DIST}`);
    process.exit(1);
  }

  validateHreflang();
  validateAllHreflangTargets();
  validateJsonLd();
  validateSchemaConnections();
  validateHubSchema();
  validateMeta();
  validateLlmsFullTxt();
  validateCanonicalCounts();
  validateComputedCounts();
  validateAdvisoryCoverage();
  validateAdvisoryIntegrity();
  validateDatasetDescriptionLength();
  validateSiteDatasetCompleteness();
  validateScoresCsv();
  validateNewsPages();
  validateCommunityVsDataPage();
  validateTravelSafetyIndexPage();

  // Summary
  console.log("\n========================================");
  console.log(`  Total checks: ${totalChecks}`);
  console.log(`  Passed:       ${passed}`);
  console.log(`  Failed:       ${failed}`);
  console.log("========================================");

  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
    console.log("");
    process.exit(1);
  } else {
    console.log("\nAll SEO checks passed.\n");
    process.exit(0);
  }
}

main();
