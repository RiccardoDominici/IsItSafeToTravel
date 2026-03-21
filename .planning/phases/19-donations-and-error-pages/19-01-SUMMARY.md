---
phase: 19
plan: 01
subsystem: donations, error-pages
tags: [i18n, donations, 404, footer, github-sponsors, ko-fi]
dependency_graph:
  requires: [phase-17-legal]
  provides: [donate-pages, 404-page, footer-donate-link]
  affects: [footer, i18n-ui, routes]
tech_stack:
  added: []
  patterns: [client-side-language-detection, external-donation-links]
key_files:
  created:
    - src/pages/en/donate/index.astro
    - src/pages/it/dona/index.astro
    - src/pages/es/donar/index.astro
    - src/pages/fr/faire-un-don/index.astro
    - src/pages/pt/doar/index.astro
    - src/pages/404.astro
  modified:
    - src/i18n/ui.ts
    - src/components/Footer.astro
decisions:
  - Single 404.astro with client-side language detection (Cloudflare Pages uses static 404.html)
  - Donation link uses terracotta color in footer to stand out from other links
  - Search on 404 redirects to homepage with query param (leverages existing search)
metrics:
  duration: ~23 minutes
  completed: 2026-03-21
---

# Phase 19 Plan 01: Donations and Error Pages Summary

Multilingual donation pages linking to GitHub Sponsors and Ko-fi with funding transparency, plus a custom 404 page with client-side language detection

## What Was Done

### Task 1: i18n Keys (commit e8f6f27)
Added 23 new translation keys per language (115 total across 5 languages):
- `donate.*` keys: title, description, heading, intro, costs breakdown (4 items), GitHub Sponsors CTA, Ko-fi CTA, thank you message
- `error.404_*` keys: title, heading, text, home link, search prompt
- `nav.donate` key for footer link text
- Added `donate` route slugs to routes object for all 5 languages

### Task 2: Donation Pages (commit 2da1d3f)
Created 5 donation pages with localized routes:
- `/en/donate/` - English
- `/it/dona/` - Italian
- `/es/donar/` - Spanish
- `/fr/faire-un-don/` - French
- `/pt/doar/` - Portuguese

Each page includes:
- Breadcrumb navigation (Home > Support Us)
- WebPage JSON-LD structured data
- Intro explaining the project is free and open-source
- Cost transparency section (domain, hosting, APIs, development)
- Two cards: GitHub Sponsors (primary, zero fees) and Ko-fi (secondary, zero fees)
- Terracotta CTA buttons linking externally (no iframes, no cookies)
- Thank you message

### Task 3: Footer Donation Link (commit cfe964c)
Added a donation link to the Footer component visible on every page. Uses localized route slugs via `routes[lang].donate`. Styled with terracotta color and font-medium to differentiate from other footer links.

### Task 4: Custom 404 Page (commit 5601130)
Created `src/pages/404.astro` that generates a single `404.html`:
- Client-side JavaScript detects language from URL path prefix (`/it/`, `/es/`, `/fr/`, `/pt/`)
- Dynamically updates heading, text, home link, and search placeholder to detected language
- Defaults to English for unrecognized paths
- Includes search input that redirects to homepage with `?search=` query parameter
- All 5 language translations embedded as inline script data (no additional network requests)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Build succeeds: 1272 pages generated in 387s
- All 5 donate pages exist in dist/client output
- 404.html exists in dist/client root
- Footer link renders on all pages via Footer component
- TypeScript type-check passes (no errors)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e8f6f27 | i18n keys for donations and 404 in all 5 languages |
| 2 | 2da1d3f | Multilingual donation pages |
| 3 | cfe964c | Footer donation link |
| 4 | 5601130 | Custom 404 page with language detection |
