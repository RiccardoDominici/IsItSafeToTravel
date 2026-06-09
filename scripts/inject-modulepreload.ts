/**
 * Post-build: inject <link rel="modulepreload"> for the static import graph of
 * each page's module scripts.
 *
 * Astro emits <script type="module" src="/_astro/entry.js"> but no modulepreload
 * hints, so chunks the entry statically imports (e.g. the shared d3 chunks used
 * by the homepage map) are only discovered after the entry downloads and parses —
 * a full extra network round-trip before the map can render. This script walks
 * each entry's static imports in dist and preloads the whole graph from the HTML.
 *
 * Dynamic imports (fuse.js, the TrendChart d3 chunk) are intentionally NOT
 * preloaded — they are lazy by design.
 */

import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve(import.meta.dirname ?? ".", "../dist/client");
const ASTRO_DIR = path.join(DIST, "_astro");

// --- Build static-import map for every /_astro/*.js chunk ---

// Matches static imports in minified bundles:
//   import{a as b}from"./chunk.js"   import x from"./chunk.js"
//   export{a}from"./chunk.js"        import"./side-effect.js"
// Does NOT match dynamic import("./chunk.js") — the paren breaks both patterns.
const FROM_RE = /from\s*["'](\.\/[^"']+\.m?js)["']/g;
const BARE_IMPORT_RE = /\bimport\s*["'](\.\/[^"']+\.m?js)["']/g;

function getStaticImports(jsFile: string, cache: Map<string, string[]>): string[] {
  const cached = cache.get(jsFile);
  if (cached) return cached;

  const fullPath = path.join(ASTRO_DIR, jsFile);
  let deps: string[] = [];
  if (fs.existsSync(fullPath)) {
    const code = fs.readFileSync(fullPath, "utf-8");
    const found = new Set<string>();
    for (const re of [FROM_RE, BARE_IMPORT_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        // Imports are relative to /_astro/, e.g. "./transform.HASH.js"
        found.add(path.posix.normalize(m[1]));
      }
    }
    deps = [...found];
  }
  cache.set(jsFile, deps);
  return deps;
}

function collectTransitiveDeps(entry: string, cache: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const dep of getStaticImports(current, cache)) {
      if (!seen.has(dep)) {
        seen.add(dep);
        queue.push(dep);
      }
    }
  }
  return seen;
}

// --- Walk dist for HTML files ---

function* walkHtml(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkHtml(full);
    } else if (entry.name.endsWith(".html")) {
      yield full;
    }
  }
}

const SCRIPT_SRC_RE = /<script\s+type="module"\s+src="\/_astro\/([^"]+\.m?js)"/g;

function main() {
  if (!fs.existsSync(DIST) || !fs.existsSync(ASTRO_DIR)) {
    console.error(`inject-modulepreload: ${DIST} not found — run astro build first`);
    process.exit(1);
  }

  const importCache = new Map<string, string[]>();
  let pagesTouched = 0;
  let linksInjected = 0;

  for (const htmlPath of walkHtml(DIST)) {
    const html = fs.readFileSync(htmlPath, "utf-8");

    SCRIPT_SRC_RE.lastIndex = 0;
    const deps = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = SCRIPT_SRC_RE.exec(html)) !== null) {
      for (const dep of collectTransitiveDeps(`./${m[1]}`, importCache)) {
        deps.add(dep);
      }
    }
    if (deps.size === 0) continue;

    const links: string[] = [];
    for (const dep of deps) {
      const href = `/_astro/${dep.replace(/^\.\//, "")}`;
      if (html.includes(`href="${href}"`)) continue; // idempotent / already referenced
      links.push(`<link rel="modulepreload" href="${href}">`);
    }
    if (links.length === 0) continue;

    const headEnd = html.indexOf("</head>");
    if (headEnd === -1) continue;

    const updated = html.slice(0, headEnd) + links.join("") + html.slice(headEnd);
    fs.writeFileSync(htmlPath, updated);
    pagesTouched++;
    linksInjected += links.length;
  }

  console.log(`inject-modulepreload: ${linksInjected} preload links injected across ${pagesTouched} pages`);
}

main();
