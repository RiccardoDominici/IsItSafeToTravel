# Requirements: IsItSafeToTravel.com

**Defined:** 2026-03-19
**Core Value:** Any traveler can instantly see how safe a destination is, backed by transparent, automatically-updated data from trusted public sources.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Pipeline

- [ ] **DATA-01**: System fetches safety indices from 3+ public sources daily (GPI, INFORM, ACLED, gov advisories)
- [ ] **DATA-02**: System computes composite 1-10 safety score for 200+ countries
- [ ] **DATA-03**: Score breaks down into category sub-scores (conflict, crime, health, governance, environment)
- [ ] **DATA-04**: Pipeline runs automatically via GitHub Actions cron every 24h
- [ ] **DATA-05**: System stores historical scores to enable trend analysis

### Map

- [ ] **MAP-01**: Homepage displays interactive world map color-coded green-to-red by safety score
- [ ] **MAP-02**: User can zoom and pan the map smoothly on desktop and mobile
- [ ] **MAP-03**: User can click any country on the map to navigate to its detail page

### Search

- [ ] **SRCH-01**: User can search for any country or city with autocomplete suggestions
- [ ] **SRCH-02**: Search results link directly to the destination detail page

### Country Detail

- [ ] **CTRY-01**: Each country has a dedicated page showing its safety score (1-10)
- [ ] **CTRY-02**: Detail page shows sub-score breakdown by category with visual indicators
- [ ] **CTRY-03**: Detail page shows historical trend (score evolution over time as sparkline)
- [ ] **CTRY-04**: Detail page shows government advisory levels (US, UK, EU) alongside composite score
- [ ] **CTRY-05**: Detail page lists all data sources used with links to originals
- [ ] **CTRY-06**: Each page has unique, auto-generated content explaining the safety assessment

### Transparency

- [ ] **TRNS-01**: Dedicated methodology page explains the scoring formula, weights, and rationale
- [ ] **TRNS-02**: Legal disclaimer on every page clarifying informational nature of the data
- [ ] **TRNS-03**: Sources section at bottom of detail pages with linked citations

### Technical

- [ ] **TECH-01**: Site is mobile-responsive with touch-friendly map interaction
- [ ] **TECH-02**: All destination pages are statically generated for SEO (JSON-LD, meta tags, sitemap)
- [ ] **TECH-03**: Multilingual support with English + Italian from launch
- [ ] **TECH-04**: Lighthouse performance score 90+ on mobile
- [ ] **TECH-05**: Site deploys on free-tier hosting (Cloudflare Workers/Pages)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Regional

- **REGL-01**: Sub-national/regional safety drill-down with map coloring
- **REGL-02**: Regional detail pages for areas with significantly different safety profiles

### Demographics

- **DEMO-01**: Women travelers safety sub-score using open indices
- **DEMO-02**: LGBTQ+ travelers safety sub-score using Equaldex data

### Features

- **FEAT-01**: Comparison tool for side-by-side country safety comparison
- **FEAT-02**: Additional languages (Spanish, French, German)
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

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| MAP-01 | Phase 3 | Pending |
| MAP-02 | Phase 3 | Pending |
| MAP-03 | Phase 3 | Pending |
| SRCH-01 | Phase 5 | Pending |
| SRCH-02 | Phase 5 | Pending |
| CTRY-01 | Phase 4 | Pending |
| CTRY-02 | Phase 4 | Pending |
| CTRY-03 | Phase 4 | Pending |
| CTRY-04 | Phase 4 | Pending |
| CTRY-05 | Phase 4 | Pending |
| CTRY-06 | Phase 4 | Pending |
| TRNS-01 | Phase 5 | Pending |
| TRNS-02 | Phase 5 | Pending |
| TRNS-03 | Phase 4 | Pending |
| TECH-01 | Phase 6 | Pending |
| TECH-02 | Phase 6 | Pending |
| TECH-03 | Phase 1 | Pending |
| TECH-04 | Phase 6 | Pending |
| TECH-05 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
