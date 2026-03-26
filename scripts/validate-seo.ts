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

const LANGUAGES = ["en", "it", "es", "fr", "pt"] as const;

// Language-specific path segments for "country"
const COUNTRY_SEGMENT: Record<string, string> = {
  en: "country",
  it: "paese",
  es: "pais",
  fr: "pays",
  pt: "pais",
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

  // Check all 5 languages are present
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
  const descriptions = new Map<string, string>(); // description -> page label

  // Collect pages to check: homepages + country samples
  const pages: Array<{ path: string; label: string }> = [];

  for (const lang of LANGUAGES) {
    pages.push({
      path: path.join(DIST, lang, "index.html"),
      label: `${lang}/index.html`,
    });
  }

  for (const code of sample) {
    for (const lang of LANGUAGES) {
      const seg = COUNTRY_SEGMENT[lang];
      pages.push({
        path: path.join(DIST, lang, seg, code, "index.html"),
        label: `${lang}/${seg}/${code}`,
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

      // Check for duplicates (only within same language to be fair)
      const key = desc.toLowerCase();
      if (descriptions.has(key)) {
        check(
          `meta(${page.label}): unique description`,
          false,
          `duplicate of ${descriptions.get(key)}`
        );
      } else {
        check(`meta(${page.label}): unique description`, true);
        descriptions.set(key, page.label);
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
