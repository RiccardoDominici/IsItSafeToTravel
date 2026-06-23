---
phase: quick-260623-wd6
plan: 01
subsystem: on-site-seo / internal-linking
tags: [seo, internal-linking, i18n, astro-component, citation, authority]
requires:
  - src/i18n/ui.ts (routes map)
  - src/lib/scores.ts (getLocalizedCountryName)
  - src/pipeline/types.ts (ScoredCountry)
provides:
  - src/components/country/AuthorityLinks.astro (ranking up-links + cite/embed CTA)
  - AuthorityLinks rendered on every country page across all 7 locales
affects:
  - src/pages/en/country/[slug].astro
  - src/pages/it/paese/[slug].astro
  - src/pages/es/pais/[slug].astro
  - src/pages/fr/pays/[slug].astro
  - src/pages/pt/pais/[slug].astro
  - src/pages/zh/country/[slug].astro
  - src/pages/de/land/[slug].astro
tech-stack:
  added: []
  patterns:
    - localized-labels-map (Record<Lang, {...}>) mirroring RelatedCountries.astro
    - routes[lang] slug lookup as single source of truth (no hardcoded slugs)
    - self-contained per-component clipboard <script> (Astro-scoped)
key-files:
  created:
    - src/components/country/AuthorityLinks.astro
  modified:
    - src/pages/en/country/[slug].astro
    - src/pages/it/paese/[slug].astro
    - src/pages/es/pais/[slug].astro
    - src/pages/fr/pays/[slug].astro
    - src/pages/pt/pais/[slug].astro
    - src/pages/zh/country/[slug].astro
    - src/pages/de/land/[slug].astro
decisions:
  - "URLs built from routes[lang]['safest-countries' | 'most-dangerous-countries' | 'embed-badge'] — no hardcoded slug value literals"
  - "Band-matching link order: safest-first when country.score >= 6, else dangerous-first"
  - "AuthorityLinks placed after RelatedCountries and before FaqSection so FAQPage-schema source is untouched; no JSON-LD added (country @graph invariant unchanged)"
  - "Deferred full npm run build + npm run validate:seo gate to orchestrator per task constraints; ran fast astro check static sanity instead"
metrics:
  duration_seconds: 292
  tasks_completed: 2
  files_changed: 8
  completed_date: "2026-06-23"
---

# Quick Task 260623-wd6: On-site SEO Authority Concentration (Ranking Up-links + Cite/Embed CTA) Summary

Added one reusable `AuthorityLinks.astro` component to every country page across all 7 locales,
delivering two on-site SEO changes: (1) a "Rankings" block with two localized keyword-anchor links
to the locale's safest-countries and most-dangerous-countries hubs (band-matching link first), and
(2) a "Cite this data" block with a copy-paste citation line, copy button, and a link to the locale
embed-badge page — concentrating internal crawl equity on the under-linked ranking hubs and seeding
external citations/backlinks.

## What Was Built

### Task 1 — `AuthorityLinks.astro` component (commit 1f8c0341)
- Props: `{ country: ScoredCountry; lang: Lang; canonicalUrl: string }`.
- Imports `routes` and `getLocalizedCountryName`, matching the RelatedCountries import style.
- Builds `safestUrl` / `dangerousUrl` / `embedUrl` by reading `routes[lang]` slug keys — no
  hardcoded slug value literals anywhere in the file.
- Single localized labels map `Record<Lang, {...}>` covering all 7 langs (en/it/es/fr/pt/zh/de)
  with no fallback and no missing keys. Latin accents written literally as UTF-8 (più, Países,
  sûrs, données, sécurité, segurança, Länder, ¡Copiado!), CJK literal.
- Band-matching order: `safestFirst = country.score >= 6` → safest link first for high scorers,
  dangerous first otherwise.
- Citation line: `${getLocalizedCountryName(country, lang)} safety score — isitsafetotravel.org — ${canonicalUrl} — updated daily` rendered in a selectable `<code id="cite-line">`.
- Copy button (`data-cite-copy` + `data-copied`) with a self-contained Astro-scoped `<script>`
  using `navigator.clipboard.writeText`, switching to the localized "Copied!" text for 1.5s.
- Embed-badge link styled with the seeAll inline-link classes + `→` arrow.
- Container/heading styling mirrors RelatedCountries/FaqSection. No JSON-LD / schema added.

### Task 2 — Wire into all 7 locale country templates (commit 1a441ab2)
- Added `import AuthorityLinks from '../../../components/country/AuthorityLinks.astro';`
  immediately after the existing RelatedCountries import in each of the 7 `[slug].astro` files.
- Rendered `<AuthorityLinks country={country} lang={lang} canonicalUrl={canonicalUrl} />`
  immediately after `<RelatedCountries .../>` and before `<FaqSection .../>` in each file.
- `canonicalUrl` was already computed (line 65/67) in every template — reused, not re-added.
- `grep` finds `AuthorityLinks` ≥2 times (import + render) in all 7 templates.

## Verification

- Task 1 verify: `AuthorityLinks.astro` exists; `tsc --noEmit` grep for AuthorityLinks → 0 errors → OK.
- Task 2 verify: all 7 templates wired → "ALL 7 WIRED".
- `astro check` reports **0 errors located inside `AuthorityLinks.astro`** (the component itself is
  clean).
- Component references `routes[lang]` only via key lookups (`r['safest-countries']`,
  `r['most-dangerous-countries']`, `r['embed-badge']`); no hardcoded slug **value** literals.
- All 7 lang label blocks present; band-matching ordering present.
- Only 8 source files changed; no generated files (public/llms*, public/scores.json, data/**,
  dist/**, public/og/**) touched.

## Deviations from Plan

None — plan executed as written, with the constraint-mandated checkpoint handling below.

## Checkpoint Handling (Task 3 — checkpoint:human-verify)

- Auto-mode is active (`workflow.auto_advance = true`) and this checkpoint is
  `gate="blocking"` (NOT `gate="blocking-human"`, not a package-legitimacy check), so per
  auto-mode policy the human-verify checkpoint was **auto-approved**.
- Per the task constraints, the full `npm run build` (~400s) + `npm run validate:seo` gate from
  the checkpoint's how-to-verify was **deferred to the orchestrator**. A fast static sanity check
  (`npx astro check`) was run instead to catch type/template errors in the touched files.

## Deferred / Notes for Orchestrator

- **DEFERRED GATE (must run before deploy):** `npm run build` then `npm run validate:seo`.
  Expect: build with no missing-i18n-key warnings, and validate:seo ALL-PASS with the country
  `@graph` invariant (WebPage + Place + FAQPage + TouristDestination + Dataset) unchanged
  (this task added no JSON-LD, so the invariant should be intact).
- **Pre-existing astro check noise (NOT introduced by this task):** `astro check` reports many
  `'country' is of type 'unknown'` / `'Props' is declared but never used` errors in every
  `[slug].astro` file. These pre-date this task — they stem from Astro's `astro check` not
  inferring `Astro.props` from the `Props` interface in `getStaticPaths` files, and affect all
  pre-existing component renders (Base, ScoreHero, RelatedCountries, etc.) identically. They do
  not block `astro build`. Confirmed against `HEAD~2` (the pre-change EN template has the same
  `interface Props` + destructure pattern). Out of scope for this task; logged here, not fixed.

## Known Stubs

None. The component renders real localized links and a real citation line wired to live props.

## Self-Check: PASSED

- `src/components/country/AuthorityLinks.astro` — FOUND
- Commit `1f8c0341` (component) — FOUND
- Commit `1a441ab2` (wiring) — FOUND
- All 7 `[slug].astro` templates contain `AuthorityLinks` ≥2 times — VERIFIED
