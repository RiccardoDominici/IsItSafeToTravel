---
phase: quick-260702-ctd
plan: 01
type: execute
wave: 1
depends_on: [quick-260702-cpr]
status: COMPLETED — approved and executed 2026-07-02 (commit 71594c13); commercial-use question resolved: route to feedback page
files_modified:
  - src/i18n/ui.ts
  - src/lib/seo.ts
  - src/components/CitePage.astro (new)
  - src/pages/en/cite-this-data/index.astro (new)
  - src/pages/it/cita-questi-dati/index.astro (new)
  - src/pages/es/citar-estos-datos/index.astro (new)
  - src/pages/fr/citer-ces-donnees/index.astro (new)
  - src/pages/pt/citar-estes-dados/index.astro (new)
  - src/pages/zh/cite-this-data/index.astro (new)
  - src/pages/de/daten-zitieren/index.astro (new)
  - src/components/country/AuthorityLinks.astro
  - src/components/Footer.astro
autonomous: false
requirements: [UX-CITE-PAGE, SEO-CITATION-SEEDING]
must_haves:
  truths:
    - "Dedicated cite page exists at localized slugs x7 (routes[lang].cite), with country selector + live preview + 6 copy formats (plain, HTML link, Markdown, APA, MLA, BibTeX)"
    - "Country pages keep the Rankings block but lose the cite sub-block; a single small link (localized) points to the cite page with #c=<iso3> deep-link preselecting the country"
    - "Footer gains a site-wide cite-page link in all 7 langs"
    - "JSON-LD @graph = WebPage + Dataset (reuse buildDatasetJsonLd) + FAQPage + BreadcrumbList via new buildCitePageJsonLd in src/lib/seo.ts; NO HowTo"
    - "hreflang + sitemap light up automatically from the routes map; no Base.astro/astro.config.mjs edits"
    - "SSR renders fully interpolated citations (snapshot date) for no-JS/crawlers; client JS updates access date to today and handles selector/copy (embed-badge [data-copy] pattern)"
    - "npm run validate:seo stays all-pass + manual grep of the 7 built cite pages for full hreflang set + self-canonical (gate does not sample new pages)"
  artifacts:
    - path: ".planning/quick/260702-ctd-cite-this-data-page/260702-ctd-FULL-SPEC.json"
      provides: "Complete judge-synthesized spec: page sections, exact citation template strings, 30-field copy map guidance, 10-task list, risks, rejected ideas"
---

<objective>
Owner request (2026-07-02): the "Cite this data" section on country pages is for
developers/press, not travelers — move it to a dedicated page linked from the bottom,
which handles WHAT to cite and HOW, with a live preview, consistent with the site's
design and SEO.

Plan produced by 3 Opus planning lenses (UX/content, SEO/i18n architecture,
integration/migration) + Opus judge synthesis. Full machine-readable spec in
260702-ctd-FULL-SPEC.json (sections, template strings, task list, risks).

KEY DECISIONS (judge):
- NEW dedicated sibling page (not extending embed-badge — different intent: widget
  for webmasters vs attribution for press/researchers); purely additive, no redirects.
- ONE shared CitePage.astro + 7 four-line page files (ApiDocs.astro precedent);
  inline Record<Lang> copy map instead of ~35 new ui.ts keys; only the routes slug
  goes in ui.ts.
- Slugs: en/zh cite-this-data, it cita-questi-dati, es citar-estos-datos,
  fr citer-ces-donnees, pt citar-estes-dados, de daten-zitieren.
- Country-page link uses hash deep-link #c=<iso3> (no crawlable param variants).
- APA/MLA/BibTeX templates identical across langs (English academic standards);
  only plain/HTML/Markdown connectives localized.
- Citation seeding net-improves vs today: contextual per-country link + site-wide
  footer link + 6 copy formats including a real HTML <a> backlink.

OPEN QUESTION for owner (asked 2026-07-02, no answer yet — default = option 1):
commercial-use requests under CC BY-NC: (1) route to existing Feedback page
[recommended default], (2) omit the sentence, (3) dedicated email.

NEXT STEP on approval: execute the 10-task list in FULL-SPEC.json (Sonnet executor,
Fable verification: astro build + validate:seo + hreflang grep + visual pass), then
commit/push and log SUMMARY.
</objective>
