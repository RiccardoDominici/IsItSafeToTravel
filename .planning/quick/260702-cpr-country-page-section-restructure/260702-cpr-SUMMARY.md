---
phase: quick-260702-cpr
plan: 01
subsystem: ia / country-page
tags: [ia, seo, geo, citability, reorder, dedupe, i18n]
requires:
  - src/components/country/PillarDetailTable.astro (source of transplanted render block; file kept, now unused)
  - src/i18n/ui.ts (routes + translation blocks)
provides:
  - Unified pillar block (bars + <details> indicator tables) in PillarBreakdown.astro
  - Citability-first section order, identical across 7 locales
affects:
  - src/components/country/PillarBreakdown.astro
  - src/i18n/ui.ts
  - all 7 locale [slug].astro country pages
tech-stack:
  added: []
  patterns:
    - native <details> for progressive disclosure (content stays in static HTML, zero client JS)
    - answer-cluster contiguity: AnswerFirst → Pillars → Sentiment → Advisories → FAQ unbroken for AI extraction
key-files:
  created: []
  modified:
    - src/components/country/PillarBreakdown.astro
    - src/i18n/ui.ts
    - src/pages/en/country/[slug].astro
    - src/pages/it/paese/[slug].astro
    - src/pages/es/pais/[slug].astro
    - src/pages/fr/pays/[slug].astro
    - src/pages/pt/pais/[slug].astro
    - src/pages/zh/country/[slug].astro
    - src/pages/de/land/[slug].astro
decisions:
  - "Only unanimous merge shipped: PillarDetailTable → single <details> under PillarBreakdown (identical props, reused sorted/pillarKeys, no second sort; grep-verified no #details anchor references exist)"
  - "FAQ moved up to #7 (after advisories): most citable schema-backed format was near the footer; answer cluster now contiguous"
  - "TrendChart moved down to evidence tail: heaviest lazy-D3 block out of the primary scroll path"
  - "TravelDealsWidget placed AFTER FAQ as cluster divider (not after advisories): FAQ collapsed by default ⇒ ~150px scroll difference, revenue near-neutral, but keeps monetization from splitting the two most citable blocks"
  - "ComparisonTable ⊕ NeighborComparison merge DEFERRED: render guards must become OR or micro-territories lose neighbor chips; adjacency captures most benefit at zero risk"
  - "Chapter names from the IA proposal are conceptual only — nothing rendered on the page (owner disliked the names; moot since they were never visible)"
metrics:
  files_changed: 9
  completed_date: "2026-07-02"
  commit: "a62ee02a"
  validate_seo: "2213/2213 pass"
---

# Quick Task 260702-cpr: Country Page Section Restructure

Reorganized the country page from 15 loose blocks to 13 in a citability-first order,
identical across all 7 locales (grep parity verified + live DOM check on /en/country/ita/).
Pillar data now renders once (bars + folded indicator detail), the answer cluster
(AnswerFirst → Pillars → Sentiment → Advisories → FAQ) is contiguous for AI answer
engines, internal-linking sections are grouped, and the heavy TrendChart sits in the
evidence tail before SourcesList.

New i18n key `country.pillars_detail_toggle` in 7 langs. No JSON-LD, <head>, heading-level
or content changes; no new client JS (native <details>). validate:seo 2213/2213.
Shipped in commit `a62ee02a`.

Follow-ups available: optional ComparisonTable⊕NeighborComparison merge (guard OR),
optional widget slot A/B based on revenue telemetry, sitewide polish backlog from the
design judge (semantic verdict-color tokens for ScoreHero, shared CTA/option-card
patterns, documented corner-radius scale).
