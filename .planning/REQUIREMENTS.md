# Requirements: IsItSafeToTravel.com

**Defined:** 2026-03-19
**Core Value:** Any traveler can instantly see how safe a destination is, backed by transparent, automatically-updated data from trusted public sources.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Pipeline

- [x] **DATA-01**: System fetches safety indices from 3+ public sources daily (GPI, INFORM, ACLED, gov advisories)
- [x] **DATA-02**: System computes composite 1-10 safety score for 200+ countries
- [x] **DATA-03**: Score breaks down into category sub-scores (conflict, crime, health, governance, environment)
- [x] **DATA-04**: Pipeline runs automatically via GitHub Actions cron every 24h
- [x] **DATA-05**: System stores historical scores to enable trend analysis

### Map

- [x] **MAP-01**: Homepage displays interactive world map color-coded green-to-red by safety score
- [x] **MAP-02**: User can zoom and pan the map smoothly on desktop and mobile
- [x] **MAP-03**: User can click any country on the map to navigate to its detail page

### Search

- [x] **SRCH-01**: User can search for any country or city with autocomplete suggestions
- [x] **SRCH-02**: Search results link directly to the destination detail page

### Country Detail

- [x] **CTRY-01**: Each country has a dedicated page showing its safety score (1-10)
- [x] **CTRY-02**: Detail page shows sub-score breakdown by category with visual indicators
- [x] **CTRY-03**: Detail page shows historical trend (score evolution over time as sparkline)
- [x] **CTRY-04**: Detail page shows government advisory levels (US, UK, EU) alongside composite score
- [x] **CTRY-05**: Detail page lists all data sources used with links to originals
- [x] **CTRY-06**: Each page has unique, auto-generated content explaining the safety assessment

### Transparency

- [x] **TRNS-01**: Dedicated methodology page explains the scoring formula, weights, and rationale
- [x] **TRNS-02**: Legal disclaimer on every page clarifying informational nature of the data
- [x] **TRNS-03**: Sources section at bottom of detail pages with linked citations

### Technical

- [x] **TECH-01**: Site is mobile-responsive with touch-friendly map interaction
- [x] **TECH-02**: All destination pages are statically generated for SEO (JSON-LD, meta tags, sitemap)
- [x] **TECH-03**: Multilingual support with English + Italian from launch
- [x] **TECH-04**: Lighthouse performance score 90+ on mobile
- [x] **TECH-05**: Site deploys on free-tier hosting (Cloudflare Workers/Pages)

## v1.1 Requirements

Requirements for milestone v1.1: Comparison & Historical Trends.

### Data Pipeline

- [x] **PIPE-01**: Pipeline computes a global safety score (arithmetic mean of all country scores) daily
- [x] **PIPE-02**: Pipeline consolidates daily snapshots into a single history-index.json for efficient build-time loading

### Global Safety Score

- [x] **GLOB-01**: User sees a global safety score banner on the homepage (clickable)
- [x] **GLOB-02**: User can click the global score banner to navigate to a dedicated global safety page
- [x] **GLOB-03**: Global safety page shows a historical trend chart of the global score over time
- [x] **GLOB-04**: Global safety page includes an explanation of how the global score is calculated

### Historical Trends

- [x] **HIST-01**: User can view a full-size trend chart on each country's detail page showing safety score over time
- [x] **HIST-02**: User sees interactive tooltips on hover/tap showing exact score and date

### Country Comparison

- [x] **COMP-01**: User can select 2 or more countries to compare via a searchable selector
- [x] **COMP-02**: User sees side-by-side score cards for selected countries
- [x] **COMP-03**: User sees grouped horizontal bars comparing pillar scores across selected countries
- [x] **COMP-04**: User sees an overlay trend chart with historical lines for all selected countries
- [x] **COMP-05**: User can share comparison via URL (e.g., /compare?c=IT,FR,DE)

## v1.2 Requirements

Requirements for milestone v1.2: Improvements & Category Filtering.

### Bug Fixes

- [ ] **BUG-01**: User sees correct dates on historical trend chart axes
- [ ] **BUG-02**: User can search and select countries correctly on the comparison page

### Chart Interactivity

- [ ] **CHART-01**: User can drag-to-zoom on historical trend charts to select a date range
- [ ] **CHART-02**: User can reset zoom to see the full date range

### Category Filtering

- [ ] **FILT-01**: User can filter the world map by individual safety pillar (conflict, health, governance, etc.)
- [ ] **FILT-02**: User can filter historical trend charts by individual pillar (requires pipeline extension to store per-pillar history)
- [ ] **FILT-03**: Map and chart filters show clear labels for the active category

### Parameter Explanations

- [ ] **EXPL-01**: User can read detailed explanations of each safety pillar and its data sources in the methodology page

### Spanish Language

- [ ] **LANG-01**: User can browse the full site in Spanish
- [ ] **LANG-02**: All 248 country names are available in Spanish
- [ ] **LANG-03**: Language switcher includes Spanish option

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Regional

- **REGL-01**: Sub-national/regional safety drill-down with map coloring
- **REGL-02**: Regional detail pages for areas with significantly different safety profiles

### Demographics

- **DEMO-01**: Women travelers safety sub-score using open indices
- **DEMO-02**: LGBTQ+ travelers safety sub-score using Equaldex data

### Features

- **FEAT-02**: Additional languages (French, German)
- **FEAT-03**: Interactive weight adjustment sliders for personalized scoring
- **FEAT-04**: City-level safety pages for major cities
- **FEAT-05**: Embeddable map widget for travel blogs
- **FEAT-06**: RSS feed for score change notifications

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / login | No personalization needed, avoids PII/GDPR complexity |
| User-generated content / reviews | Moderation nightmare, subjective bias conflicts with data-driven approach |
| Real-time alerts / push notifications | Daily updates sufficient, avoids notification infrastructure costs |
| Mobile native app | Responsive web covers the use case, avoids double dev effort |
| Hotel/flight booking | Conflicts with impartiality, massive scope expansion |
| AI chatbot | Hallucination risk for safety-critical info, API costs exceed budget |
| Neighborhood-level granularity | Requires paid/proprietary data, free sources operate at country/region level |
| Scope buttons (7d/30d/90d/All) for charts | User chose drag-to-zoom instead; buttons can be added later if needed |
| Per-pillar historical trends in comparison page | Comparison page already groups bars by pillar; limited added value |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v1 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| DATA-03 | Phase 2 | Complete |
| DATA-04 | Phase 2 | Complete |
| DATA-05 | Phase 2 | Complete |
| MAP-01 | Phase 3 | Complete |
| MAP-02 | Phase 3 | Complete |
| MAP-03 | Phase 3 | Complete |
| SRCH-01 | Phase 5 | Complete |
| SRCH-02 | Phase 5 | Complete |
| CTRY-01 | Phase 4 | Complete |
| CTRY-02 | Phase 4 | Complete |
| CTRY-03 | Phase 4 | Complete |
| CTRY-04 | Phase 4 | Complete |
| CTRY-05 | Phase 4 | Complete |
| CTRY-06 | Phase 4 | Complete |
| TRNS-01 | Phase 5 | Complete |
| TRNS-02 | Phase 5 | Complete |
| TRNS-03 | Phase 4 | Complete |
| TECH-01 | Phase 6 | Complete |
| TECH-02 | Phase 6 | Complete |
| TECH-03 | Phase 1 | Complete |
| TECH-04 | Phase 6 | Complete |
| TECH-05 | Phase 1 | Complete |

**Coverage (v1):**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

### v1.1 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 7 | Complete |
| PIPE-02 | Phase 7 | Complete |
| GLOB-01 | Phase 8 | Complete |
| GLOB-02 | Phase 8 | Complete |
| GLOB-03 | Phase 8 | Complete |
| GLOB-04 | Phase 8 | Complete |
| HIST-01 | Phase 9 | Complete |
| HIST-02 | Phase 9 | Complete |
| COMP-01 | Phase 10 | Complete |
| COMP-02 | Phase 10 | Complete |
| COMP-03 | Phase 10 | Complete |
| COMP-04 | Phase 10 | Complete |
| COMP-05 | Phase 10 | Complete |

**Coverage (v1.1):**
- v1.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

### v1.2 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | — | Pending |
| BUG-02 | — | Pending |
| CHART-01 | — | Pending |
| CHART-02 | — | Pending |
| FILT-01 | — | Pending |
| FILT-02 | — | Pending |
| FILT-03 | — | Pending |
| EXPL-01 | — | Pending |
| LANG-01 | — | Pending |
| LANG-02 | — | Pending |
| LANG-03 | — | Pending |

**Coverage (v1.2):**
- v1.2 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11 ⚠️

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-20 after v1.2 requirements definition*
