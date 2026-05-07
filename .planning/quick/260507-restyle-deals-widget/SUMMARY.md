---
quick_id: 260507-restyle
slug: restyle-deals-widget
date: 2026-05-07
status: complete
---

# Restyle TravelDealsWidget — compact, beautiful, lower

## Outcome

The TravelDealsWidget is now a single-line horizontal banner using the site's sand/terracotta tokens. On country pages it now sits below the AdvisorySection (after ScoreHero -> AnswerFirstParagraph -> StatsSummary -> PillarBreakdown -> AdvisorySection) instead of dominating the top of the page. On home pages the wrapper was tightened from `max-w-4xl py-6` to `max-w-2xl py-3`.

## Changes

### Component restyle
- `src/components/TravelDealsWidget.astro` — replaced the bulky multi-row card (heading, three stacked input groups, large pill button) with a compact `<form>` flex row: terracotta plane icon, heading text (with optional ` · City (IATA)` suffix), optional 3-letter IATA input on `sm+`, and a small terracotta button with arrow. Removed verbose JSDoc/inline comments. Kept all hidden inputs (`marker`, `locale`, `adults`, `depart_date`) and target/rel attributes for Aviasales+Travelpayouts compatibility.

### Country page repositioning (7 files)
Moved `<TravelDealsWidget mode="country" />` from immediately after `<ScoreHero />` to immediately after `<AdvisorySection />`:
- `src/pages/en/country/[slug].astro`
- `src/pages/it/paese/[slug].astro`
- `src/pages/es/pais/[slug].astro`
- `src/pages/fr/pays/[slug].astro`
- `src/pages/pt/pais/[slug].astro`
- `src/pages/zh/country/[slug].astro`
- `src/pages/de/land/[slug].astro`

### Home wrapper tightening (7 files)
Changed `<section class="px-4 py-6 max-w-4xl mx-auto">` to `<section class="px-4 py-3 max-w-2xl mx-auto">` around `<TravelDealsWidget mode="home" />`:
- `src/pages/{en,it,es,fr,pt,zh,de}/index.astro`

## Commits

- `87bb219` feat(quick): restyle TravelDealsWidget to compact inline banner
- `3a59ef8` feat(quick): move travel deals widget below advisories on country pages
- `97bc70a` feat(quick): tighten home wrapper for compact deals widget

## Verification

`npm run build` — 1892 pages built in 430.58s, 2186/2186 SEO checks passed (hreflang, JSON-LD, meta, llms-full).
