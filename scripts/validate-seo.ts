/**
 * Post-build SEO validation script.
 * Runs against dist/client output and validates hreflang tags,
 * JSON-LD structured data, meta tags, and llms-full.txt.
 *
 * Exit code 0 = all checks pass, 1 = at least one failure.
 */

import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve(import.meta.dirname ?? ".", "../dist/client");

const LANGUAGES = ["en", "it", "es", "fr", "pt", "zh", "de"] as const;

// ISO3 → Wikidata/Wikipedia entity mapping used for Place.sameAs grounding.
// Loaded leniently: if the file is missing, the sameAs checks are skipped.
const WIKIDATA_MAP_PATH = path.resolve(
  import.meta.dirname ?? ".",
  "../src/data/countries-wikidata.json"
);
const WIKIDATA_MAP: Record<string, { qid?: string; wikipedia?: string }> = (() => {
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
  validateJsonLd();
  validateMeta();
  validateLlmsFullTxt();
  validateAdvisoryCoverage();
  validateAdvisoryIntegrity();
  validateDatasetDescriptionLength();

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
