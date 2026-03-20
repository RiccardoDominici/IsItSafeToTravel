# IsItSafeToTravel.com

## What This Is

A multilingual web platform that tells travelers whether a destination is safe to visit. It combines multiple public safety indices (conflicts, governance, crime, health risks) into a single 1-10 safety score, displayed on an interactive color-coded world map. Users can compare countries side by side, explore historical safety trends, and see a global safety benchmark — all with a minimal, data-driven design.

## Core Value

Any traveler can instantly see how safe a destination is, backed by transparent, automatically-updated data from trusted public sources.

## Requirements

### Validated

- ✓ Multilingual support (English, Italian, Spanish) — v1.0 + v1.2
- ✓ Fast load times (static generation where possible) — v1.0
- ✓ Safety score 1-10 per destination, computed from public indices — v1.0
- ✓ Automatic daily data pipeline: fetch indices, news, recompute scores — v1.0
- ✓ Interactive world map color-coded by safety score — v1.0
- ✓ Detail page per destination explaining score breakdown — v1.0
- ✓ Formula transparency: every factor and weight explained — v1.0
- ✓ Sources section citing all indices and data origins — v1.0
- ✓ Search by city, country, or region with instant results — v1.0
- ✓ SEO-optimized pages for every destination — v1.0
- ✓ Mobile-responsive design with clear visual hierarchy — v1.0
- ✓ Global safety score as world benchmark — v1.1
- ✓ Historical safety trend chart per country with interactive tooltips — v1.1
- ✓ Country comparison page with side-by-side cards, pillar bars, overlay charts — v1.1
- ✓ Historical data collection and consolidated history index — v1.1
- ✓ Shareable comparison URLs — v1.1
- ✓ Correct UTC date parsing on trend chart axes — v1.2 Phase 11
- ✓ Comparison page search dropdown works reliably — v1.2 Phase 11
- ✓ Interactive drag-to-zoom on trend charts (country detail + comparison) — v1.2 Phase 12
- ✓ Expandable pillar explanations on methodology page (EN + IT) — v1.2 Phase 13
- ✓ Per-pillar category filtering on map and trend charts — v1.2 Phase 14
- ✓ Full Spanish language support (187 keys, 248 country names, 6 pages) — v1.2 Phase 15

### Active

## Current Milestone: v1.2 Improvements & Category Filtering

**Goal:** Enhance interactivity, fix bugs, add Spanish, and enable per-category exploration of safety data.

**Target features:**
- Interactive historical charts with zoom/scope control and date fixes
- Fix comparison page country search on web
- Spanish language support
- Detailed explanations for each safety pillar (health, conflict, governance, etc.)
- Category filtering for map and charts (view individual pillars instead of total score)

### Out of Scope

- Monetization (ads, affiliations) — not yet, revisit later
- User accounts / login — no personalization needed
- Real-time alerts / push notifications — daily updates are sufficient
- Mobile native app — web-first, responsive design covers mobile
- User-generated content / reviews — data-driven only, no UGC
- Hotel/flight booking integration — informational site only
- Pre-built SEO comparison pages for country pairs — deferred, assess SEO demand first
- Per-pillar historical trends in comparison page — already have pillar history, can add later if needed

## Context

Shipped v1.0 MVP and v1.1 Comparison & Historical Trends. The platform covers 248 countries with daily automated scoring from GPI, ACLED, World Bank, WHO, INFORM, and government advisories (US, UK). Built with Astro 6 SSG, D3.js, Tailwind CSS 4, deployed on Cloudflare Pages. Total ~8,200 LOC (TypeScript + Astro).

v1.1 introduced the first client-side JavaScript (comparison page selector, tooltip interactions) while keeping the majority of pages fully static. Historical data accumulates daily — trend charts will become more meaningful as snapshots accumulate over weeks/months.

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
| Daily updates (not real-time) | Budget constraint + most indices update weekly/monthly anyway | ✓ Good |
| Score 1-10 (not categories) | More granular, allows map color gradient, universally understood | ✓ Good |
| Country + regional granularity | Countries alone miss important nuances (e.g., safe north vs unsafe south) | — Pending (regional not yet built) |
| Multilingual from start | Domain is global, travelers speak many languages | ✓ Good |
| No user accounts | Reduces complexity, no PII to manage, faster to ship | ✓ Good |
| Astro SSG + D3 + zero client JS (v1.0) | Static-first, zero JS on content pages, fast Lighthouse scores | ✓ Good |
| Global score as simple arithmetic mean | Transparent, easy to explain; population-weighted is a future option | ✓ Good |
| Comparison page client-side rendered | C(248,2)=30K pairs impossible to pre-generate; single page + query params | ✓ Good |
| D3 sub-packages for client-side charts | Avoids ~250KB monolithic d3 bundle; tree-shaken imports | ✓ Good |
| 5-country max for comparison | OECD/Google Trends show >5 series creates visual noise | ✓ Good |
| Colorblind-accessible dash patterns | Color + dash pattern for trend lines ensures accessibility | ✓ Good |

---
*Last updated: 2026-03-20 after Phase 15 Spanish Language complete — v1.2 milestone complete*
