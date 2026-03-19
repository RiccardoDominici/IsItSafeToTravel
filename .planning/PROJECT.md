# IsItSafeToTravel.com

## What This Is

A multilingual web platform that tells travelers whether a destination is safe to visit. It combines multiple public safety indices (conflicts, governance, crime, health risks) into a single 1-10 safety score, displayed on an interactive color-coded world map. Users can search any country, region, or city and get a clear, sourced explanation of why a place is rated the way it is.

## Core Value

Any traveler can instantly see how safe a destination is, backed by transparent, automatically-updated data from trusted public sources.

## Requirements

### Validated

- [x] Multilingual support (English primary, Italian, expandable i18n) — Validated in Phase 1: Project Foundation
- [x] Fast load times (static generation where possible) — Validated in Phase 1: Project Foundation
- [x] Safety score 1-10 per destination, computed from public indices — Validated in Phase 2: Data Pipeline and Scoring Engine
- [x] Automatic daily data pipeline: fetch indices, news, recompute scores — Validated in Phase 2: Data Pipeline and Scoring Engine

### Active

- [x] Interactive world map color-coded by safety score (green to red) — Validated in Phase 3: Interactive Map
- [x] Detail page per destination explaining the score breakdown by criteria — Validated in Phase 4: Country Detail Pages
- [x] Formula transparency: every factor and weight explained on the detail page — Validated in Phase 4: Country Detail Pages
- [x] Sources section citing all indices and data origins — Validated in Phase 4: Country Detail Pages
- [ ] Country-level safety view as default, with regional drill-down on zoom
- [x] Search by city, country, or region with instant results — Validated in Phase 5: Search and Transparency
- [ ] Multilingual support (English primary, Italian, expandable i18n)
- [ ] SEO-optimized pages for every destination (meta, structured data, sitemap)
- [ ] Mobile-responsive design with clear visual hierarchy
- [ ] Fast load times (static generation where possible)

### Out of Scope

- Monetization (ads, affiliations) — not in v1, revisit later
- User accounts / login — no personalization needed
- Real-time alerts / push notifications — daily updates are sufficient
- Mobile native app — web-first, responsive design covers mobile
- User-generated content / reviews — data-driven only, no UGC
- Hotel/flight booking integration — informational site only

## Context

The travel safety information space is dominated by government advisories (US State Dept, UK FCDO, Italian Farnesina) which are often political, slow to update, and hard to compare across countries. Existing indices like the Global Peace Index or Fragile States Index are academic and not traveler-friendly. There's a gap for a simple, visual, automatically-updated tool that synthesizes multiple sources into an actionable safety score.

Key data sources to research: Global Peace Index, ACLED conflict data, World Bank governance indicators, WHO health data, INFORM Risk Index, government travel advisories APIs. All must be free or open-access given the near-zero budget constraint.

The site needs to handle ~200 countries and potentially thousands of sub-national regions. Static generation with incremental updates fits the daily refresh model and keeps hosting costs minimal.

## Constraints

- **Budget**: Near-zero (~10€/month max) — free-tier hosting, open-source tools, free APIs only
- **Data freshness**: Daily automated updates — not real-time, but no stale data older than 24h
- **Data sources**: Only publicly available, free indices and APIs — no paid data subscriptions
- **Impartiality**: Score formula must be transparent and politically neutral — no editorial bias
- **Performance**: Fast load times essential for SEO and mobile users — target Lighthouse 90+
- **Accessibility**: WCAG 2.1 AA compliance for inclusive access

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Daily updates (not real-time) | Budget constraint + most indices update weekly/monthly anyway | — Pending |
| Score 1-10 (not categories) | More granular, allows map color gradient, universally understood | — Pending |
| Country + regional granularity | Countries alone miss important nuances (e.g., safe north vs unsafe south) | — Pending |
| Multilingua from start | Domain is global, travelers speak many languages | — Pending |
| No user accounts | Reduces complexity, no PII to manage, faster to ship | — Pending |

---
*Last updated: 2026-03-19 — Phase 5 (Search and Transparency) complete: Fuse.js autocomplete search in header, methodology page auto-generated from weights.json, legal disclaimer page, footer link fix*
