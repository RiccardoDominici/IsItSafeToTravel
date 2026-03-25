---
phase: 27-seo-ai-search-optimization
verified: 2026-03-25T12:37:21Z
status: gaps_found
score: 12/14 must-haves verified
gaps:
  - truth: "Every country page has a unique og:image showing country name, score, and color badge"
    status: partial
    reason: "OG image generator exists and is wired into build, but About pages (5 files) are missing the ogImage prop and will have no og:image tag at runtime"
    artifacts:
      - path: "src/pages/en/about/index.astro"
        issue: "Missing ogImage prop on <Base> component — About page has no og:image meta tag"
      - path: "src/pages/it/chi-siamo/index.astro"
        issue: "Missing ogImage prop on <Base> component"
      - path: "src/pages/es/acerca-de/index.astro"
        issue: "Missing ogImage prop on <Base> component"
      - path: "src/pages/fr/a-propos/index.astro"
        issue: "Missing ogImage prop on <Base> component"
      - path: "src/pages/pt/sobre/index.astro"
        issue: "Missing ogImage prop on <Base> component"
    missing:
      - "Add ogImage=\"/og/default.png\" to the <Base> component call in all 5 About pages"
  - truth: "ROADMAP.md reflects Phase 27 completion (all 3 plans checked)"
    status: failed
    reason: "ROADMAP.md still shows Plan 03 as unchecked ([ ]) even though all commits for Plan 03 are present (d723c8b, 56f65b3, 062ea44)"
    artifacts:
      - path: ".planning/ROADMAP.md"
        issue: "Line shows '- [ ] 27-03-PLAN.md' — checkbox not updated after Plan 03 completion"
    missing:
      - "Update ROADMAP.md Plan 03 checkbox from [ ] to [x]"
      - "Update ROADMAP.md phase plans count from '2/3 plans executed' to '3/3 plans executed'"
human_verification:
  - test: "Open a country page (e.g., /en/country/ita/) in browser and check og:image meta tag renders the correct country PNG (country-ita.png)"
    expected: "Page has <meta property=\"og:image\" content=\"https://isitsafetotravel.org/og/country-ita.png\"> and the PNG is served by the CDN"
    why_human: "Cannot verify deployed CDN serves generated PNGs without running a build"
  - test: "Share a country page URL on a platform with link preview (Slack, Twitter, etc.) and verify the preview card shows the country name and score badge"
    expected: "1200x630 preview image with country name, color-coded score badge, and 'Updated Daily' tagline"
    why_human: "Visual appearance of OG image requires human inspection"
  - test: "Fetch the live sitemap (https://isitsafetotravel.org/sitemap-0.xml) and verify <lastmod> entries appear on all URLs"
    expected: "Every <url> entry has a <lastmod>2026-03-25</lastmod> (or current date)"
    why_human: "Requires deployed build — cannot verify from local sitemap"
---

# Phase 27: SEO & AI Search Optimization — Verification Report

**Phase Goal:** Maximize visibility in Google Search and AI chatbot citations through OG images, enriched structured data, About page with E-E-A-T signals, crawlable static content, and sitemap improvements
**Verified:** 2026-03-25T12:37:21Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                | Status       | Evidence                                                                           |
| --- | -------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| 1   | Country meta descriptions show rounded scores (7.4 not 7.406...)    | VERIFIED  | `seo.ts:51` `score.toFixed(1)` in `buildCountryMetaDescription()`                 |
| 2   | All JSON-LD schemas include dateModified and datePublished           | VERIFIED  | `seo.ts` lines 66, 92, 128, 174 — all 4 builders accept optional `dateModified`   |
| 3   | Organization schema includes logo, sameAs, and foundingDate          | VERIFIED  | `seo.ts:213-215` — `logo`, `sameAs`, `foundingDate: '2026'` all present           |
| 4   | FAQ schema uses natural language question format                     | VERIFIED  | EN: "What does the Conflict category measure..." IT: "Cosa misura la categoria..." |
| 5   | llms.txt uses correct ISO3 country URLs                              | VERIFIED  | `/en/country/ita/`, `/en/country/usa/`, `/en/country/jpn/`, `/en/country/bra/`, `/en/country/zaf/` |
| 6   | All pages include meta robots max-snippet:-1 and preload hints       | VERIFIED  | `Base.astro:73-76` — robots meta tag + favicon preload present                    |
| 7   | About page accessible in all 5 languages from header and footer      | VERIFIED  | All 5 About pages exist; Header and Footer both contain `r.about` links           |
| 8   | About page shows author bio (Riccardo Dominici)                      | VERIFIED  | `i18n/ui.ts` `about.author_text` key contains "Riccardo Dominici" in all 5 langs |
| 9   | All About pages include Author/Person JSON-LD schema                 | VERIFIED  | `buildPersonJsonLd()` exported in seo.ts; used in all 5 About page @graph arrays  |
| 10  | Country detail pages have a static HTML table showing all 5 pillar scores | VERIFIED | `PillarBreakdown.astro:32-54` — `<table>` with thead/tbody before SVG bar chart  |
| 11  | Homepage has a collapsed details element listing all 248 countries   | VERIFIED  | `en/index.astro:42` — `<details>` with `loadLatestScores()` country links         |
| 12  | Every country page has a unique og:image (country-specific PNG)      | VERIFIED  | `[slug].astro:51` passes `ogImage={\`/og/country-${country.iso3.toLowerCase()}.png\`}` |
| 13  | Non-country pages have a generic branded og:image                    | PARTIAL  | Homepages, methodology, compare, global-safety, legal all have `ogImage="/og/default.png"` — but 5 About pages are missing ogImage prop entirely |
| 14  | Sitemap URLs include lastmod dates reflecting daily updates           | VERIFIED  | `astro.config.mjs:22-24` — `serialize()` function sets `item.lastmod` to build date |

**Score:** 13/14 truths verified (truth 13 is partial)

---

### Required Artifacts

| Artifact                                           | Expected                                      | Status    | Details                                                                          |
| -------------------------------------------------- | --------------------------------------------- | --------- | -------------------------------------------------------------------------------- |
| `src/lib/seo.ts`                                   | JSON-LD builders with dateModified, complete Org schema, natural FAQ | VERIFIED | Contains `dateModified` (8 occurrences), `foundingDate`, `sameAs`, `logo`, `buildPersonJsonLd` |
| `src/layouts/Base.astro`                           | meta robots directive and preload hints        | VERIFIED  | Lines 73-76: robots meta + favicon preload                                       |
| `public/llms.txt`                                  | Fixed country URLs with ISO3 codes             | VERIFIED  | Contains `/en/country/ita/`, `/en/country/usa/`, `/en/country/jpn/`, `/en/country/bra/`, `/en/country/zaf/` |
| `src/pages/en/about/index.astro`                   | English About page with E-E-A-T content        | VERIFIED  | Exists, uses `about.author_text` translation key = "Riccardo Dominici..."       |
| `src/components/country/PillarBreakdown.astro`     | Static HTML table before D3 chart              | VERIFIED  | `<table>` at line 32, SVG bars at line 56 — correct order                       |
| `src/pages/en/index.astro`                         | Country listing in details/summary element     | VERIFIED  | `<details>` at line 42, `loadLatestScores()` at line 10                         |
| `src/components/Header.astro`                      | About link in navigation                       | VERIFIED  | Lines 38, 84 — desktop and mobile nav both have `r.about` links                 |
| `src/components/Footer.astro`                      | About link in footer                           | VERIFIED  | Line 32 — footer has `r.about` link                                              |
| `scripts/generate-og-images.ts`                    | Build-time OG image generator using resvg      | VERIFIED  | Exists, imports `Resvg`, reads `data/scores/latest.json`, writes to `public/og/` |
| `public/og/`                                       | Generated OG images directory                  | PARTIAL   | Directory exists but only 2 files locally (country-usa.png, default.png) — full set generated at build time from latest.json (248 countries when pipeline has run) |
| `astro.config.mjs`                                 | Sitemap config with lastmod and language coverage | VERIFIED | `serialize()` function with `item.lastmod`, i18n with all 5 locales              |

---

### Key Link Verification

| From                              | To                          | Via                                       | Status    | Details                                                           |
| --------------------------------- | --------------------------- | ----------------------------------------- | --------- | ----------------------------------------------------------------- |
| `src/lib/seo.ts`                  | methodology pages           | `buildFaqPageJsonLd` + natural language Qs | VERIFIED  | EN: "What does the..." IT: "Cosa misura la..." FR/ES/PT present  |
| `src/layouts/Base.astro`          | all pages                   | meta robots in `<head>`                   | VERIFIED  | `max-snippet:-1` present at line 73                              |
| `src/components/Header.astro`     | About pages                 | `r.about` nav link                        | VERIFIED  | Both desktop (line 38) and mobile (line 84) nav contain link     |
| `src/components/Footer.astro`     | About pages                 | `r.about` footer link                     | VERIFIED  | Line 32 contains `r.about` link                                  |
| `src/pages/en/index.astro`        | country pages               | country listing links with iso3           | VERIFIED  | `/${lang}/country/${c.iso3.toLowerCase()}/` in details element   |
| `scripts/generate-og-images.ts`   | `public/og/`                | `writeFileSync` PNG generation            | VERIFIED  | Line 137: `fs.writeFileSync(path.join(OUTPUT_DIR, filename), png)` |
| `src/pages/*/country/[slug].astro` | `public/og/`               | `ogImage` prop referencing generated PNGs | VERIFIED  | `ogImage={\`/og/country-${country.iso3.toLowerCase()}.png\`}`    |
| `astro.config.mjs`                | sitemap output              | `serialize` function with `lastmod`       | VERIFIED  | `item.lastmod = new Date().toISOString().split('T')[0]`           |

---

### Data-Flow Trace (Level 4)

| Artifact                            | Data Variable | Source                             | Produces Real Data | Status       |
| ----------------------------------- | ------------- | ---------------------------------- | ------------------ | ------------ |
| `src/pages/en/index.astro` details  | `countries`   | `loadLatestScores()` -> `data/scores/latest.json` | Yes (248 countries in committed HEAD, stub in working copy due to test run) | VERIFIED (at HEAD) |
| `scripts/generate-og-images.ts`     | `countries`   | `data/scores/latest.json`          | NOTE: working copy has stub (1 country); committed HEAD has 248 | VERIFIED (at HEAD) |
| `PillarBreakdown.astro` table       | `pillars` prop | country page passes `country.pillars` from loadLatestScores | Yes                | VERIFIED     |

**Note on `data/scores/latest.json`:** The working copy file has been overwritten with a test stub (date 2099-01-01, 1 country). The committed HEAD version at 73b4f55 contains 248 countries (date 2026-03-25). This is a local environment issue — `git diff HEAD` shows the divergence. At deploy time (GitHub Actions), the pipeline runs first and writes the correct `latest.json` before `npm run build`. The OG image generator will produce all 249 images correctly in production.

---

### Behavioral Spot-Checks

| Behavior                                      | Command                                                                          | Result                               | Status |
| --------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------ | ------ |
| seo.ts has score rounding                     | `grep -c "toFixed(1)" src/lib/seo.ts`                                            | 6 matches                            | PASS   |
| seo.ts has dateModified in 4 builders         | `grep -c "dateModified" src/lib/seo.ts`                                          | 8 matches                            | PASS   |
| Organization schema complete                  | `grep "foundingDate" src/lib/seo.ts`                                             | `foundingDate: '2026'`               | PASS   |
| FAQ natural language EN                       | `grep "What does the" src/pages/en/methodology/index.astro`                      | 5 FAQ questions found                | PASS   |
| FAQ natural language IT                       | `grep "Cosa misura" src/pages/it/metodologia/index.astro`                        | 5 FAQ questions found                | PASS   |
| meta robots in Base.astro                     | `grep "max-snippet" src/layouts/Base.astro`                                      | `max-snippet:-1, max-image-preview:large` | PASS |
| preload hint in Base.astro                    | `grep "preload" src/layouts/Base.astro`                                          | favicon SVG preload present          | PASS   |
| llms.txt ISO3 URLs                            | `grep "/en/country/ita/" public/llms.txt`                                        | Italy at `/en/country/ita/`          | PASS   |
| About page exists (EN)                        | `test -f src/pages/en/about/index.astro`                                         | exists                               | PASS   |
| About page has author text in i18n            | `grep "Riccardo Dominici" src/i18n/ui.ts`                                        | 5 language entries                   | PASS   |
| buildPersonJsonLd exported                    | `grep "export function buildPersonJsonLd" src/lib/seo.ts`                        | line 161                             | PASS   |
| Header has About link                         | `grep "r\.about" src/components/Header.astro`                                    | desktop + mobile nav                 | PASS   |
| PillarBreakdown has table                     | `grep "<table" src/components/country/PillarBreakdown.astro`                     | line 32                              | PASS   |
| Table before SVG bar chart                    | table at line 32, SVG at line 72                                                 | correct order                        | PASS   |
| Homepage details element                      | `grep "<details" src/pages/en/index.astro`                                       | line 42                              | PASS   |
| Country page ogImage                          | `grep "ogImage" src/pages/en/country/[slug].astro`                               | country-specific path                | PASS   |
| About page ogImage (EN)                       | `grep "ogImage" src/pages/en/about/index.astro`                                  | NOT FOUND                            | FAIL   |
| About page ogImage (IT)                       | `grep "ogImage" src/pages/it/chi-siamo/index.astro`                              | NOT FOUND                            | FAIL   |
| OG script uses resvg                          | `grep "resvg" scripts/generate-og-images.ts`                                     | imports `Resvg` from `@resvg/resvg-js` | PASS |
| generate:og in package.json                   | `grep "generate:og" package.json`                                                | line 11                              | PASS   |
| build script includes OG generation           | build script = `npm run generate:og && astro build`                              | correct                              | PASS   |
| sitemap lastmod                               | `grep "lastmod" astro.config.mjs`                                                | serialize function sets lastmod      | PASS   |
| ROADMAP Plan 03 checkbox                      | `grep "27-03-PLAN" .planning/ROADMAP.md`                                         | `- [ ]` (unchecked)                  | FAIL   |

---

### Requirements Coverage

The requirement IDs `SEO27-01` through `SEO27-14` referenced in Plan frontmatter and ROADMAP.md do **not** appear in `.planning/REQUIREMENTS.md`. This is expected — they are phase-internal requirement labels defined in the ROADMAP for Phase 27 only, not added to the formal requirements register. No entries in REQUIREMENTS.md are mapped to Phase 27, and no REQUIREMENTS.md requirements are orphaned with respect to this phase.

| Requirement | Source Plan | Description                                           | Status    | Evidence                                                   |
| ----------- | ----------- | ----------------------------------------------------- | --------- | ---------------------------------------------------------- |
| SEO27-01    | 27-01       | Score rounding in meta descriptions                   | SATISFIED | `seo.ts:51` `score.toFixed(1)`                             |
| SEO27-02    | 27-01       | dateModified/datePublished in all JSON-LD schemas     | SATISFIED | 4 builder functions have optional dateModified param       |
| SEO27-03    | 27-01       | Complete Organization schema                          | SATISFIED | logo, sameAs, foundingDate in buildOrganizationJsonLd      |
| SEO27-04    | 27-01       | Natural language FAQ questions                        | SATISFIED | 5 languages have natural language questions                |
| SEO27-05    | 27-01       | Fix llms.txt ISO3 URLs                                | SATISFIED | All 5 example countries use ISO3 codes                     |
| SEO27-06    | 27-01       | meta robots max-snippet + preload hints               | SATISFIED | Base.astro lines 73-76                                     |
| SEO27-07    | 27-02       | About page in 5 languages with E-E-A-T                | SATISFIED | 5 About pages created with author bio                      |
| SEO27-08    | 27-02       | Author/Person JSON-LD schema                          | SATISFIED | buildPersonJsonLd() in @graph on all About pages           |
| SEO27-09    | 27-02       | Static HTML pillar table on country pages             | SATISFIED | PillarBreakdown.astro has <table> before SVG chart         |
| SEO27-10    | 27-02       | FAQ natural language questions (same as SEO27-04)     | SATISFIED | Covered by SEO27-04 verification                           |
| SEO27-11    | 27-02       | Crawlable country listing on homepage                 | SATISFIED | <details> with 248 country links on all 5 homepages        |
| SEO27-12    | 27-03       | OG images for all pages                               | PARTIAL   | Country + generic pages have ogImage; 5 About pages missing ogImage prop |
| SEO27-13    | 27-03       | Sitemap lastmod dates                                 | SATISFIED | astro.config.mjs serialize() function sets lastmod         |
| SEO27-14    | 27-03       | Sitemap language variants coverage                    | SATISFIED | i18n config with all 5 locales in sitemap integration      |

---

### Anti-Patterns Found

| File                               | Line | Pattern                        | Severity | Impact                                                                          |
| ---------------------------------- | ---- | ------------------------------ | -------- | ------------------------------------------------------------------------------- |
| `src/pages/en/about/index.astro`   | 27   | Missing `ogImage` prop on Base | Warning  | About page renders no og:image meta tag — poor social sharing preview          |
| `src/pages/it/chi-siamo/index.astro` | similar | Missing `ogImage` prop    | Warning  | Same issue in Italian                                                           |
| `src/pages/es/acerca-de/index.astro` | similar | Missing `ogImage` prop   | Warning  | Same issue in Spanish                                                           |
| `src/pages/fr/a-propos/index.astro`  | similar | Missing `ogImage` prop   | Warning  | Same issue in French                                                            |
| `src/pages/pt/sobre/index.astro`     | similar | Missing `ogImage` prop   | Warning  | Same issue in Portuguese                                                        |
| `.planning/ROADMAP.md`             | 285  | Plan 03 checkbox unchecked     | Info     | Administrative inconsistency — commits exist but ROADMAP not updated            |

---

### Human Verification Required

#### 1. OG Image Visual Quality

**Test:** Run `npm run generate:og` locally (after ensuring `data/scores/latest.json` contains real data — either restore from git HEAD or run the pipeline), then open `public/og/country-ita.png` in an image viewer.
**Expected:** 1200x630 PNG showing "Italy" country name in large bold text, color-coded score badge (green/amber/red based on score), "IsItSafeToTravel" site branding at top, "Safety Score - Updated Daily" tagline.
**Why human:** Visual quality and readability of generated PNG cannot be asserted programmatically.

#### 2. Deployed OG Image Social Preview

**Test:** Share a country page URL (e.g., `https://isitsafetotravel.org/en/country/ita/`) in a Slack message or use https://www.opengraph.xyz/ to preview it.
**Expected:** Preview card shows the country-specific OG image (not a blank card).
**Why human:** Requires CDN to serve the generated PNGs — cannot verify from source code.

#### 3. Sitemap lastmod in Production

**Test:** Fetch `https://isitsafetotravel.org/sitemap-0.xml` and inspect a few `<url>` entries.
**Expected:** Each entry has `<lastmod>2026-03-25</lastmod>` (or current build date).
**Why human:** Sitemap XML output requires deployed build.

---

### Gaps Summary

Two gaps were found:

**Gap 1 (Warning): 5 About pages missing ogImage prop.**
The About pages (`/en/about/`, `/it/chi-siamo/`, `/es/acerca-de/`, `/fr/a-propos/`, `/pt/sobre/`) were created in Plan 02. Plan 03 added `ogImage="/og/default.png"` to methodology, compare, global-safety, legal, and homepage pages — but missed the About pages. Since `Base.astro` renders `og:image` only when the `ogImage` prop is provided, these 5 pages will have no `og:image` meta tag, meaning no social sharing preview card. Fix is trivial: add `ogImage="/og/default.png"` to the `<Base>` call in each About page.

**Gap 2 (Info): ROADMAP.md Plan 03 checkbox not updated.**
All 3 commits for Plan 03 are present in git (`d723c8b`, `56f65b3`, `062ea44`). The ROADMAP.md still shows `- [ ] 27-03-PLAN.md`. This is an administrative inconsistency that does not affect functionality but misrepresents phase completion state.

**Environmental note (not a code gap):** `data/scores/latest.json` in the working copy is a test stub (1 country, date 2099-01-01). The committed HEAD version has 248 countries. This was overwritten by a test run. In production, GitHub Actions runs the pipeline before `npm run build`, so the OG image generator will produce all 249 images correctly. Restoring: `git checkout HEAD -- data/scores/latest.json`.

---

_Verified: 2026-03-25T12:37:21Z_
_Verifier: Claude (gsd-verifier)_
