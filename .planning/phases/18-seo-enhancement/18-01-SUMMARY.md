---
phase: "18"
plan: "01"
subsystem: seo
tags: [breadcrumbs, json-ld, structured-data, schema-org, semantic-html, redirects]
dependency-graph:
  requires: [phase-16-robots-txt, phase-17-legal]
  provides: [breadcrumb-navigation, organization-schema, faq-schema, server-redirect]
  affects: [all-country-pages, all-methodology-pages, all-compare-pages, all-homepages, all-legal-pages]
tech-stack:
  added: []
  patterns: [json-ld-graph-merge, breadcrumb-component, cloudflare-redirects]
key-files:
  created:
    - src/components/Breadcrumb.astro
    - public/_redirects
  modified:
    - src/lib/seo.ts
    - src/i18n/ui.ts
    - src/pages/en/country/[slug].astro
    - src/pages/it/paese/[slug].astro
    - src/pages/es/pais/[slug].astro
    - src/pages/fr/pays/[slug].astro
    - src/pages/pt/pais/[slug].astro
    - src/pages/en/methodology/index.astro
    - src/pages/it/metodologia/index.astro
    - src/pages/es/metodologia/index.astro
    - src/pages/fr/methodologie/index.astro
    - src/pages/pt/metodologia/index.astro
    - src/pages/en/compare.astro
    - src/pages/it/confronta.astro
    - src/pages/es/comparar.astro
    - src/pages/fr/comparer.astro
    - src/pages/pt/comparar.astro
    - src/pages/en/index.astro
    - src/pages/it/index.astro
    - src/pages/es/index.astro
    - src/pages/fr/index.astro
    - src/pages/pt/index.astro
    - src/pages/en/legal/index.astro
    - src/pages/it/note-legali/index.astro
    - src/pages/es/terminos-legales/index.astro
    - src/pages/fr/mentions-legales/index.astro
    - src/pages/pt/termos-legais/index.astro
decisions:
  - Used @graph pattern to merge multiple JSON-LD schemas on same page
  - Breadcrumb "Countries" link points to homepage since there is no countries listing page
  - Server-side _redirects supplements (not replaces) client-side index.astro for fallback
key-decisions:
  - "@graph JSON-LD merge pattern for pages with multiple schemas"
  - "Cloudflare _redirects file for server-side root redirect"
metrics:
  duration: "32 minutes"
  completed: "2026-03-21"
---

# Phase 18 Plan 01: SEO Enhancement Summary

Breadcrumb navigation with BreadcrumbList JSON-LD, Organization and FAQPage schemas, server-side root redirect, and heading hierarchy audit across all 5 languages.

## What Was Done

### Task 1: JSON-LD Schema Builders (d7ca3b4)
Added three new functions to `src/lib/seo.ts`:
- `buildBreadcrumbJsonLd()` - BreadcrumbList schema with ListItem positions
- `buildOrganizationJsonLd()` - Organization schema for homepage
- `buildFaqPageJsonLd()` - FAQPage schema for methodology Q&A sections

### Task 2: Breadcrumb Component (69ea48f)
Created `src/components/Breadcrumb.astro` with:
- Accessible nav element with `aria-label="Breadcrumb"` and `aria-current="page"`
- Ordered list with chevron separators
- Embedded BreadcrumbList JSON-LD with full absolute URLs
- Sand/terracotta design token styling matching existing theme

### Task 3: Country Page Breadcrumbs (badd315)
Added breadcrumbs to all 5 language variants of country detail pages:
- Path: Home > Countries > [Country Name]
- Added `nav.countries` i18n key in EN, IT, ES, FR, PT
- Uses locale-aware route paths (e.g., /it/paese/, /fr/pays/)

### Task 4: Methodology and Comparison Breadcrumbs (7050587)
Added breadcrumbs to all 10 pages (5 methodology + 5 compare):
- Methodology path: Home > Methodology
- Compare path: Home > Compare
- All using localized route segments

### Task 5: Organization JSON-LD on Homepages (38b01c3)
Merged Organization schema with existing WebSite schema via `@graph`:
- Organization includes name, URL, and description
- Applied to all 5 language homepage variants

### Task 6: FAQPage JSON-LD on Methodology Pages (bea87c0)
Added FAQPage schema derived from the expandable pillar details sections:
- 5 Q&A pairs (one per safety pillar) using existing i18n keys
- Merged with WebPage schema via `@graph`
- Applied to all 5 language methodology pages

### Task 7: Server-Side Root Redirect (581d265)
Created `public/_redirects` with Cloudflare Pages convention:
- `/ /en/ 302` for server-side redirect
- Client-side `index.astro` remains as fallback for static hosting

### Task 8: Heading Hierarchy Audit (7670b51)
Fixed heading hierarchy issues in legal pages across all 5 languages:
- Changed second H1 (Privacy Policy) to H2
- Changed privacy subsection H2s (Cookies, Analytics, Data, Hosting, Rights) to H3
- Also fixed pre-existing bug: added missing FR/PT translations in seo.ts for meta descriptions, risk levels, and global safety JSON-LD

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing FR/PT SEO translations in seo.ts**
- **Found during:** Task 8 (heading audit)
- **Issue:** `buildCountryMetaDescription`, `buildHomepageJsonLd`, and `buildGlobalSafetyJsonLd` only had EN/IT/ES translations, missing FR/PT added in Phase 15
- **Fix:** Added FR/PT entries to all Record<Lang, string> maps
- **Files modified:** src/lib/seo.ts
- **Commit:** 7670b51

## Verification

- Build succeeds: 1266 pages generated
- BreadcrumbList JSON-LD present in country detail pages
- Organization JSON-LD present in homepage
- FAQPage JSON-LD present in methodology pages
- `_redirects` file present in build output
- All legal pages have single H1 with proper H2/H3 hierarchy
- Breadcrumb nav elements have correct ARIA attributes

## Self-Check: PASSED

All 2 created files verified present. All 8 commits verified in git log.
