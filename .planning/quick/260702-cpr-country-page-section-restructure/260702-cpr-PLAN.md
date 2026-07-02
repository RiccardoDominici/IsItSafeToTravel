---
phase: quick-260702-cpr
plan: 01
type: execute
wave: 1
depends_on: [quick-260702-svw]
files_modified:
  - src/components/country/PillarBreakdown.astro
  - src/i18n/ui.ts
  - src/pages/en/country/[slug].astro
  - src/pages/it/paese/[slug].astro
  - src/pages/es/pais/[slug].astro
  - src/pages/fr/pays/[slug].astro
  - src/pages/pt/pais/[slug].astro
  - src/pages/zh/country/[slug].astro
  - src/pages/de/land/[slug].astro
autonomous: false
requirements: [IA-COUNTRY-PAGE-CLEANUP]
must_haves:
  truths:
    - "PillarDetailTable's full indicator content (per-pillar h3 + name/value/source/year tables) lives inside a single native <details> under PillarBreakdown's bars — zero content loss, content stays in crawlable HTML"
    - "PillarDetailTable no longer imported/rendered by any locale page; one duplicate H2 removed sitewide"
    - "New i18n key country.pillars_detail_toggle present in all 7 langs (no fallback)"
    - "All 7 locale [slug].astro files render the identical section sequence: ScoreHero, AnswerFirstParagraph, PillarBreakdown, SentimentPillar, AdvisorySection, FaqSection, TravelDealsWidget, ComparisonTable, NeighborComparison, RelatedCountries, AuthorityLinks, TrendChart, SourcesList"
    - "AnswerFirstParagraph stays in top-3 content blocks; FaqSection stays visible (FAQPage JSON-LD backing); no JSON-LD/<head>/heading-level changes; no new client JS"
    - "npm run validate:seo stays all-pass"
  artifacts:
    - path: "src/components/country/PillarBreakdown.astro"
      provides: "Pillar bars + folded indicator-level detail in one <details>"
      contains: "pillars_detail_toggle"
---

<objective>
Declutter the country page (15 → 13 blocks) with a citability-first section order.

Proposal produced by 3 Opus IA lenses (reader-narrative / SEO+GEO / engagement+revenue)
+ Opus judge synthesis; owner approved (chapter names were conceptual only — nothing
rendered). Executed by 2 parallel Sonnet engineers on disjoint file sets
(component+i18n / 7-file mechanical reorder), verified by Fable orchestrator.

Key moves: dedupe pillar data (PillarDetailTable folded into PillarBreakdown as native
<details>), FAQ up after advisories (answer cluster contiguous for AI extraction),
TrendChart (heavy lazy D3) down into the evidence tail, comparison/related/authority
links grouped as one internal-linking block, TravelDealsWidget kept as the divider
after the answer cluster (revenue-neutral vs the after-advisories slot; one-line move
if telemetry disagrees).

DEFERRED: ComparisonTable ⊕ NeighborComparison merge — requires OR-ing their render
guards or micro-territories silently lose neighbor chips; adjacency already captures
~90% of the benefit.
</objective>
