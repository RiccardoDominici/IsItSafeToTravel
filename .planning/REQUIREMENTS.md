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

- [x] **BUG-01**: User sees correct dates on historical trend chart axes
- [x] **BUG-02**: User can search and select countries correctly on the comparison page

### Chart Interactivity

- [x] **CHART-01**: User can drag-to-zoom on historical trend charts to select a date range
- [x] **CHART-02**: User can reset zoom to see the full date range

### Category Filtering

- [x] **FILT-01**: User can filter the world map by individual safety pillar (conflict, health, governance, etc.)
- [x] **FILT-02**: User can filter historical trend charts by individual pillar (requires pipeline extension to store per-pillar history)
- [x] **FILT-03**: Map and chart filters show clear labels for the active category

### Parameter Explanations

- [x] **EXPL-01**: User can read detailed explanations of each safety pillar and its data sources in the methodology page

### Spanish Language

- [x] **LANG-01**: User can browse the full site in Spanish
- [x] **LANG-02**: All 248 country names are available in Spanish
- [x] **LANG-03**: Language switcher includes Spanish option

## v2.0 Requirements

Requirements for milestone v2.0: Production Ready.

### Production Foundation

- [ ] **PROD-01**: Site serves correct security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) via _headers file
- [ ] **PROD-02**: robots.txt has correct sitemap URL (fix domain typo) and AI crawler directives
- [ ] **PROD-03**: Site has /llms.txt file following llmstxt.org specification for LLM discoverability
- [ ] **PROD-04**: Cloudflare Web Analytics is verified active (free, cookie-free)
- [ ] **PROD-05**: Repository has FUNDING.yml for GitHub Sponsors visibility
- [ ] **PROD-06**: Cache-Control headers are set appropriately (long-lived for assets, short for HTML)

### Legal Compliance

- [ ] **LEGL-01**: User can read a comprehensive privacy policy in all 5 languages documenting data practices, analytics, and zero-cookie architecture
- [ ] **LEGL-02**: Legal/imprint page includes site operator identification and contact (GDPR Article 13)
- [ ] **LEGL-03**: Privacy policy accurately describes Cloudflare Web Analytics usage and data processing
- [ ] **LEGL-04**: Comprehensive legal research document created locally (not pushed to GitHub) covering GDPR, ePrivacy, Italian Garante requirements

### SEO Enhancement

- [ ] **SEO-01**: All pages display breadcrumb navigation UI component with locale-aware translated paths
- [ ] **SEO-02**: BreadcrumbList JSON-LD schema is present on all country detail, comparison, and methodology pages
- [ ] **SEO-03**: Organization JSON-LD schema is present on the homepage
- [ ] **SEO-04**: FAQPage JSON-LD schema is present on the methodology page (leveraging expandable Q&A)
- [ ] **SEO-05**: Root URL (/) redirects server-side via _redirects file instead of client-side JS

### LLM Readability

- [ ] **LLM-01**: /llms.txt exists with curated page list (homepage, methodology, sample countries)
- [ ] **LLM-02**: AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) are explicitly allowed in robots.txt
- [ ] **LLM-03**: Semantic HTML audit ensures proper heading hierarchy, landmarks (<main>, <nav>, <article>)

### Donations

- [ ] **DONA-01**: User can access a donations page in all 5 languages explaining what donations fund
- [ ] **DONA-02**: Donations page links to GitHub Sponsors (primary, 0% fee) and Ko-fi (secondary, 0% fee)
- [ ] **DONA-03**: Footer includes a donation link visible on all pages
- [ ] **DONA-04**: Donations page shows funding transparency (hosting costs, domain costs)

### Error Pages

- [ ] **ERR-01**: User sees a custom, branded 404 page with search suggestion and home link
- [ ] **ERR-02**: 404 page detects language from URL path and displays in the correct language

### Accessibility

- [ ] **A11Y-01**: Site has a skip navigation link visible on keyboard focus
- [ ] **A11Y-02**: All interactive elements have visible focus indicators
- [ ] **A11Y-03**: D3 charts and map have appropriate ARIA labels and role="img"
- [ ] **A11Y-04**: Color contrast meets WCAG 2.1 AA (4.5:1 normal text, 3:1 large text) in both light and dark mode
- [ ] **A11Y-05**: Search and comparison inputs have proper labels (label or aria-label)
- [ ] **A11Y-06**: Heading hierarchy is correct (one H1 per page, no skipped levels)

### CSP Hardening

- [ ] **CSP-01**: Content-Security-Policy header is deployed (report-only first, then enforced)
- [ ] **CSP-02**: CSP does not break D3 charts, map, or dark mode toggle

## v3 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Regional

- **REGL-01**: Sub-national/regional safety drill-down with map coloring
- **REGL-02**: Regional detail pages for areas with significantly different safety profiles

### Demographics

- **DEMO-01**: Women travelers safety sub-score using open indices
- **DEMO-02**: LGBTQ+ travelers safety sub-score using Equaldex data

### Features

- **FEAT-03**: Interactive weight adjustment sliders for personalized scoring
- **FEAT-04**: City-level safety pages for major cities
- **FEAT-05**: Embeddable map widget for travel blogs
- **FEAT-06**: RSS feed for score change notifications
- **FEAT-07**: D3 map full keyboard navigation (highest effort a11y item)
- **FEAT-08**: Dataset schema markup (schema.org/Dataset)
- **FEAT-09**: Static JSON data endpoint (/api/scores.json) for developers
- **FEAT-10**: /llms-full.txt auto-generated at build time

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
| Cookie consent banner | Site sets zero cookies; banner legally unnecessary and UX-damaging |
| Google Analytics | Italian Garante ruled non-compliant (June 2022); use CF Web Analytics instead |
| Custom 5xx error pages | Requires Cloudflare Business plan; accept CF default |
| Self-hosted analytics | Unnecessary given CF Web Analytics; exceeds budget |

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
| BUG-01 | Phase 11 | Complete |
| BUG-02 | Phase 11 | Complete |
| CHART-01 | Phase 12 | Complete |
| CHART-02 | Phase 12 | Complete |
| FILT-01 | Phase 14 | Complete |
| FILT-02 | Phase 14 | Complete |
| FILT-03 | Phase 14 | Complete |
| EXPL-01 | Phase 13 | Complete |
| LANG-01 | Phase 15 | Complete |
| LANG-02 | Phase 15 | Complete |
| LANG-03 | Phase 15 | Complete |

**Coverage (v1.2):**
- v1.2 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

### v2.0 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROD-01 | Phase 16 | Pending |
| PROD-02 | Phase 16 | Pending |
| PROD-03 | Phase 16 | Pending |
| PROD-04 | Phase 16 | Pending |
| PROD-05 | Phase 16 | Pending |
| PROD-06 | Phase 16 | Pending |
| LLM-01 | Phase 16 | Pending |
| LLM-02 | Phase 16 | Pending |
| LEGL-01 | Phase 17 | Pending |
| LEGL-02 | Phase 17 | Pending |
| LEGL-03 | Phase 17 | Pending |
| LEGL-04 | Phase 17 | Pending |
| SEO-01 | Phase 18 | Pending |
| SEO-02 | Phase 18 | Pending |
| SEO-03 | Phase 18 | Pending |
| SEO-04 | Phase 18 | Pending |
| SEO-05 | Phase 18 | Pending |
| LLM-03 | Phase 18 | Pending |
| DONA-01 | Phase 19 | Pending |
| DONA-02 | Phase 19 | Pending |
| DONA-03 | Phase 19 | Pending |
| DONA-04 | Phase 19 | Pending |
| ERR-01 | Phase 19 | Pending |
| ERR-02 | Phase 19 | Pending |
| A11Y-01 | Phase 20 | Pending |
| A11Y-02 | Phase 20 | Pending |
| A11Y-03 | Phase 20 | Pending |
| A11Y-04 | Phase 20 | Pending |
| A11Y-05 | Phase 20 | Pending |
| A11Y-06 | Phase 20 | Pending |
| CSP-01 | Phase 20 | Pending |
| CSP-02 | Phase 20 | Pending |

**Coverage (v2.0):**
- v2.0 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-21 after v2.0 roadmap creation*
