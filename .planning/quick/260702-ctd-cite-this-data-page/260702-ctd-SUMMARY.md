---
phase: quick-260702-ctd
plan: 01
subsystem: content / citation-seeding
tags: [cite, seo, geo, i18n, new-page, backlinks]
requires:
  - src/i18n/ui.ts routes map (new 'cite' key x7)
  - src/lib/seo.ts buildDatasetJsonLd (reused inside new builder)
  - /badge/[iso3].svg endpoint (preview; 404s on dev server only, fine in build)
provides:
  - src/components/CitePage.astro — shared cite page (ApiDocs pattern, inline Record<Lang> copy)
  - 7 locale pages: en+zh cite-this-data, it cita-questi-dati, es citar-estos-datos, fr citer-ces-donnees, pt citar-estes-dados, de daten-zitieren
  - buildCitePageJsonLd in src/lib/seo.ts (WebPage+Dataset+FAQPage+BreadcrumbList, no HowTo)
affects:
  - src/components/country/AuthorityLinks.astro (cite sub-block + script removed; Rankings untouched; deep-linked #c=iso3 text link added)
  - src/components/Footer.astro (site-wide cite link, all ~1900 pages)
tech-stack:
  added: []
  patterns:
    - shared page component + 7 thin locale files (ApiDocs precedent) instead of ~35 ui.ts keys
    - JSON template island (script type=application/json) so client JS interpolates the same strings SSR uses
    - hash deep-link (#c=iso3) instead of query param — no crawlable URL variants
    - dedicated whole-dataset templates per language (NOT subject substitution — avoids "scores travel-safety score" duplication; fixed by orchestrator post-execution, verified live)
key-files:
  created:
    - src/components/CitePage.astro
    - src/pages/{en,zh}/cite-this-data/index.astro + 5 localized twins
  modified:
    - src/i18n/ui.ts (routes 'cite' x7)
    - src/lib/seo.ts (buildCitePageJsonLd)
    - src/components/country/AuthorityLinks.astro
    - src/components/Footer.astro
decisions:
  - "New dedicated page, not an embed-badge extension (different intent: attribution vs widget); purely additive, no redirects"
  - "Commercial-use requests route to the feedback page (owner-approved default); FAQ answer split (faqA1Lead + linked faqA1Commercial) to hyperlink without hardcoding slugs"
  - "APA/MLA/BibTeX identical across langs (English academic standards); only plain/HTML/Markdown connectives localized"
  - "canonicalUrl prop kept on AuthorityLinks though unused — avoids touching 7 hot country templates (astro build does not typecheck)"
  - "Global-variant redundant phrasing found in live verification and fixed with per-lang globalPlain/Markdown/Html templates + shared global APA/MLA/BibTeX; dropScoreClause removed"
metrics:
  files_changed: 12
  completed_date: "2026-07-02"
  commit: "71594c13"
  validate_seo: "2213/2213 pass; hreflang (7+x-default), self-canonical, unique titles and sitemap entries grep-verified on all 7 built pages (gate does not sample new pages)"
---

# Quick Task 260702-ctd: Dedicated "Cite this data" Page

Shipped the owner-approved plan: a dedicated citation page in 7 locales (country/whole-dataset
selector, live badge preview, plain/HTML/Markdown/APA/MLA/BibTeX with auto access date,
FAQ + license), country pages decluttered to a single deep-linked text link, site-wide
footer link. Citation seeding net-improved vs the old in-page code line.

Verified live: per-country and global citations byte-correct (BibTeX braces, \url),
#c=ita deep-link on fresh load, copy buttons (7), badge hidden on global, old block
fully removed, Rankings intact. Deferred idea available: move the cite link near
SourcesList if footer+AuthorityLinks placement proves redundant.
