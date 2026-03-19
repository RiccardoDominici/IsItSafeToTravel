# Roadmap: IsItSafeToTravel.com

## Overview

This roadmap delivers a travel safety information platform in six phases, following the natural dependency chain: foundation and hosting first, then the data pipeline that powers everything, then the interactive map and country pages that users see, then search/transparency features, and finally SEO optimization and launch readiness. Every phase delivers a coherent, verifiable capability. The data pipeline must exist before any frontend work produces meaningful output.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Project Foundation** - Astro scaffold with i18n routing, Cloudflare deployment, and dev tooling
- [ ] **Phase 2: Data Pipeline and Scoring Engine** - Fetch public indices, compute composite safety scores for 200+ countries
- [ ] **Phase 3: Interactive Map** - Color-coded world map with zoom, pan, and click-to-navigate
- [ ] **Phase 4: Country Detail Pages** - Per-country pages with score breakdowns, trends, advisories, and sources
- [ ] **Phase 5: Search and Transparency** - Autocomplete search, methodology page, and legal disclaimers
- [ ] **Phase 6: SEO, Performance, and Launch** - Static generation, structured data, mobile polish, and Lighthouse 90+

## Phase Details

### Phase 1: Project Foundation
**Goal**: A deployable Astro site with i18n routing and CI/CD, ready to receive content
**Depends on**: Nothing (first phase)
**Requirements**: TECH-03, TECH-05
**Success Criteria** (what must be TRUE):
  1. Astro project builds and deploys to Cloudflare Workers/Pages on push to main
  2. Visiting /en/ and /it/ renders locale-appropriate placeholder pages
  3. Path-based locale routing works with correct hreflang tags between languages
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Astro scaffold with Tailwind design system, i18n routing, placeholder pages, and hreflang
- [ ] 01-02-PLAN.md — Cloudflare Pages adapter and CI/CD deployment pipeline

### Phase 2: Data Pipeline and Scoring Engine
**Goal**: Automated daily pipeline that fetches public safety indices and produces composite 1-10 scores for 200+ countries
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. GitHub Actions cron fetches data from 3+ public sources and stores raw JSON
  2. Scoring engine produces a 1-10 composite score for every country with data available
  3. Each country score breaks down into category sub-scores (conflict, crime, health, governance, environment)
  4. Historical scores are stored so that previous days' scores are retrievable
  5. Pipeline runs end-to-end without manual intervention on a 24h schedule
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Pipeline type contracts, scoring config, country mapping, and data source fetchers
- [ ] 02-02-PLAN.md — Scoring engine with normalization, weighted aggregation, and daily snapshot storage
- [ ] 02-03-PLAN.md — Pipeline orchestrator script and GitHub Actions cron workflow

### Phase 3: Interactive Map
**Goal**: Users land on a color-coded world map and can explore safety scores visually
**Depends on**: Phase 2
**Requirements**: MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. Homepage displays a world map where every scored country is colored green-to-red by safety score
  2. User can zoom and pan the map smoothly on both desktop and mobile (touch-friendly)
  3. Clicking any country on the map navigates to that country's detail page
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — D3/topojson map component with color scale, zoom/pan, tooltips, and dark mode
- [ ] 03-02-PLAN.md — Homepage integration with score data loading and visual verification

### Phase 4: Country Detail Pages
**Goal**: Every country has a dedicated page that explains its safety score with full transparency and sourcing
**Depends on**: Phase 2
**Requirements**: CTRY-01, CTRY-02, CTRY-03, CTRY-04, CTRY-05, CTRY-06, TRNS-03
**Success Criteria** (what must be TRUE):
  1. Each country has a unique URL (per locale) showing its composite safety score (1-10)
  2. Score breakdown by category is displayed with visual indicators (bars, colors, or similar)
  3. Historical trend is visible as a sparkline or chart showing score evolution over time
  4. Government advisory levels (US, UK, EU) are shown alongside the composite score
  5. All data sources are listed with links to originals at the bottom of each page
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Shared color scale, data loading utilities, i18n strings, and 7 country page components
- [ ] 04-02-PLAN.md — EN and IT country page routes with getStaticPaths and visual verification

### Phase 5: Search and Transparency
**Goal**: Users can find any destination instantly and understand exactly how scores are computed
**Depends on**: Phase 4
**Requirements**: SRCH-01, SRCH-02, TRNS-01, TRNS-02
**Success Criteria** (what must be TRUE):
  1. User can type a country or city name and see autocomplete suggestions
  2. Selecting a search result navigates directly to the destination detail page
  3. A dedicated methodology page explains the scoring formula, all weights, and the rationale behind them
  4. Every page displays a legal disclaimer clarifying the informational nature of the data
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: SEO, Performance, and Launch
**Goal**: The site is discoverable by search engines, fast on mobile, and ready for public traffic
**Depends on**: Phase 5
**Requirements**: TECH-01, TECH-02, TECH-04
**Success Criteria** (what must be TRUE):
  1. All destination pages are statically generated with JSON-LD structured data and unique meta descriptions
  2. XML sitemap with hreflang annotations is generated and submitted
  3. Mobile-responsive layout works correctly across phone, tablet, and desktop breakpoints
  4. Lighthouse mobile performance score is 90+ on representative pages
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Foundation | 0/2 | Planning complete | - |
| 2. Data Pipeline and Scoring Engine | 0/3 | Planning complete | - |
| 3. Interactive Map | 0/2 | Planning complete | - |
| 4. Country Detail Pages | 0/2 | Planning complete | - |
| 5. Search and Transparency | 0/TBD | Not started | - |
| 6. SEO, Performance, and Launch | 0/TBD | Not started | - |
