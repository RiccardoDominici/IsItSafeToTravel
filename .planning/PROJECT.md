# IsItSafeToTravel.com

## What This Is

A multilingual web platform (English, Italian, Spanish, French, Portuguese) that tells travelers whether a destination is safe to visit. It combines multiple public safety indices (conflicts, governance, crime, health risks, environment) into a single 1-10 safety score, displayed on an interactive color-coded world map with per-pillar filtering. Users can compare countries side by side, explore historical safety trends with drag-to-zoom, filter by individual safety categories, and see a global safety benchmark — all with a minimal, data-driven design.

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
- ✓ Correct UTC date parsing on trend chart axes — v1.2
- ✓ Comparison page search dropdown works reliably — v1.2
- ✓ Interactive drag-to-zoom on trend charts (country detail + comparison) — v1.2
- ✓ Expandable pillar explanations on methodology page — v1.2
- ✓ Per-pillar category filtering on map and trend charts — v1.2
- ✓ Full Spanish language support (187 keys, 248 country names) — v1.2

### Active

#### Current Milestone: v4.0 Global Advisory Sources Expansion

**Goal:** Eliminate anglophone bias by integrating government travel advisories from 30+ countries worldwide, covering all continents and geopolitical perspectives.

**Target features:**
- Tier 1 (API-based): Germany, Netherlands, Japan, Slovakia advisory fetchers
- Tier 2 (Structured HTML): France, New Zealand, Ireland, Finland, Hong Kong, Brazil, Austria, Philippines + 8 more
- Tier 3 (Complex scraping): Italy, Spain, South Korea, Taiwan, China, India, Switzerland + 6 more
- Scoring engine: normalize diverse level systems (3/4/5/6-level, color-coded, text-based) to unified 1-4 scale
- GitHub Actions CI: daily automated fetching for all new sources
- Methodology page & documentation updates in all 5 languages
- Fix broken sources (WHO DONs, GDELT coverage)

### Out of Scope

- Monetization (ads, affiliations) — not yet, revisit later
- User accounts / login — no personalization needed
- Real-time alerts / push notifications — daily updates are sufficient
- Mobile native app — web-first, responsive design covers mobile
- User-generated content / reviews — data-driven only, no UGC
- Hotel/flight booking integration — informational site only
- Pre-built SEO comparison pages for country pairs — deferred, assess SEO demand first
- Per-pillar historical trends in comparison page — pillar history exists, can add later

## Context

Shipped v1.0 MVP, v1.1 Comparison & Historical Trends, v1.2 Improvements & Category Filtering, and v3.0 Data Sources & Scoring Overhaul. The platform covers 248 countries in 5 languages (EN, IT, ES, FR, PT) with daily automated scoring from 9 sources: GPI, World Bank WGI, INFORM Risk Index, GDELT, ReliefWeb, GDACS, WHO DONs, and government advisories (US, UK, CA, AU). Uses tiered baseline+signal scoring architecture with freshness decay. Built with Astro 6 SSG, D3.js, Tailwind CSS 4, deployed on Cloudflare Pages.

v3.0 introduced tiered scoring (baseline 70% + signal 30%), added ReliefWeb, GDACS, GDELT, WHO DONs as realtime signal sources, historical re-scoring, and comprehensive SEO optimization including Schema.org, OG images, and sitemap. Current advisory sources are limited to Five Eyes anglophone countries (US, UK, CA, AU), creating geographic and geopolitical bias.

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
| TrendChart client-side rendering (v1.2) | Required for brush zoom; matches comparison page pattern | ✓ Good |
| Per-pillar history in history-index.json (v1.2) | Enables chart category filtering; retroactive from existing snapshots | ✓ Good |
| Native HTML details/summary for explanations (v1.2) | No JS needed, accessible by default, progressive enhancement | ✓ Good |
| CountryEntry.name extended with es field (v1.2) | Simple, type-safe; Record<Lang, string> considered but explicit fields clearer | ✓ Good |

---
## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-26 after v4.0 milestone start*
