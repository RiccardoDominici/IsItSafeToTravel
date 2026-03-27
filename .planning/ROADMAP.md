# Roadmap: IsItSafeToTravel.com

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-19)
- ✅ **v1.1 Comparison & Historical Trends** — Phases 7-10 (shipped 2026-03-19)
- ✅ **v1.2 Improvements & Category Filtering** — Phases 11-15 (shipped 2026-03-20)
- ✅ **v2.0 Production Ready** — Phases 16-20 (shipped 2026-03-21)
- ✅ **v3.0 Data Sources & Scoring Overhaul** — Phases 21-27 (shipped 2026-03-25)
- 🚧 **v4.0 Global Advisory Sources Expansion** — Phases 28-37 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-6) — SHIPPED 2026-03-19</summary>

- [x] **Phase 1: Project Foundation** — Astro scaffold with i18n routing, Cloudflare deployment, and dev tooling
- [x] **Phase 2: Data Pipeline and Scoring Engine** — Fetch public indices, compute composite safety scores for 200+ countries
- [x] **Phase 3: Interactive Map** — Color-coded world map with zoom, pan, and click-to-navigate
- [x] **Phase 4: Country Detail Pages** — Per-country pages with score breakdowns, trends, advisories, and sources
- [x] **Phase 5: Search and Transparency** — Autocomplete search, methodology page, and legal disclaimers
- [x] **Phase 6: SEO, Performance, and Launch** — Static generation, structured data, mobile polish, and Lighthouse 90+

</details>

<details>
<summary>v1.1 Comparison & Historical Trends (Phases 7-10) — SHIPPED 2026-03-19</summary>

- [x] **Phase 7: Pipeline Extensions** — Global score computation and consolidated history index
- [x] **Phase 8: Global Safety Score UI** — Homepage banner and dedicated global safety page with trend chart
- [x] **Phase 9: Enhanced History Charts** — Full-size interactive trend charts on country detail pages
- [x] **Phase 10: Country Comparison** — Side-by-side country comparison with score cards, bar charts, and overlay trends

</details>

<details>
<summary>v1.2 Improvements & Category Filtering (Phases 11-15) — SHIPPED 2026-03-20</summary>

- [x] **Phase 11: Bug Fixes** — Fix comparison page search and trend chart date axis (completed 2026-03-20)
- [x] **Phase 12: Interactive Charts** — Client-side TrendChart refactor with drag-to-zoom (completed 2026-03-20)
- [x] **Phase 13: Pillar Explanations** — Detailed safety pillar descriptions on methodology page (completed 2026-03-20)
- [x] **Phase 14: Category Filtering** — Filter map and charts by individual safety pillar (completed 2026-03-20)
- [x] **Phase 15: Spanish Language** — Full Spanish locale with translated UI and country names (completed 2026-03-20)

</details>

<details>
<summary>v2.0 Production Ready (Phases 16-20) — SHIPPED 2026-03-21</summary>

- [x] **Phase 16: Production Foundation** — Security headers, robots.txt fix, llms.txt, analytics verification, FUNDING.yml, cache headers (completed 2026-03-21)
- [x] **Phase 17: Legal Compliance** — Privacy policy in 5 languages, imprint page, legal research document (completed 2026-03-21)
- [x] **Phase 18: SEO Enhancement** — Breadcrumb UI and schema, Organization schema, FAQ schema, root redirect, semantic HTML audit (completed 2026-03-21)
- [x] **Phase 19: Donations and Error Pages** — Multilingual donations page, custom 404 pages, footer donation link (completed 2026-03-21)
- [x] **Phase 20: Accessibility and CSP Hardening** — Skip nav, focus indicators, ARIA labels, color contrast, heading hierarchy, Content-Security-Policy (completed 2026-03-21)

</details>

<details>
<summary>v3.0 Data Sources & Scoring Overhaul (Phases 21-27) — SHIPPED 2026-03-25</summary>

- [x] **Phase 21: Scoring Formula Redesign** — Tiered baseline+signal scoring engine, source config, freshness decay, FIPS mapping
- [x] **Phase 22: Historical Backfill** — Recalculate all scores back to 2012 with the new formula
- [x] **Phase 23: ReliefWeb and GDACS Fetchers** — Humanitarian and environment realtime signal sources
- [x] **Phase 24: GDELT Stability Fetcher** — Near-realtime conflict instability signal
- [x] **Phase 25: WHO DONs Fetcher** — Disease outbreak tracking for health pillar
- [x] **Phase 26: Validation, Documentation, and UX** — Score drift CI guard, crisis validation, methodology update, score indicators
- [x] **Phase 27: SEO & AI Search Optimization** — OG images, structured data, About page, sitemap improvements

</details>

### v4.0 Global Advisory Sources Expansion (In Progress)

**Milestone Goal:** Eliminate anglophone bias by integrating government travel advisories from 30+ countries worldwide, covering all continents and geopolitical perspectives, with proper normalization, CI automation, documentation, and calibration.

- [x] **Phase 28: Cleanup** — Remove WHO DONs and GDELT broken sources to simplify codebase before expansion
- [ ] **Phase 29: Tier 1 API Sources** — Germany, Netherlands, Japan, Slovakia advisory fetchers plus normalization foundation
- [ ] **Phase 30: Tier 2 HTML Sources Batch 1** — France, New Zealand, Ireland, Finland, Hong Kong, Brazil, Austria, Philippines
- [ ] **Phase 31: Tier 2 HTML Sources Batch 2** — Belgium, Denmark, Singapore, Romania, Serbia, Estonia, Croatia, Argentina
- [ ] **Phase 32: Tier 3 Complex Sources Batch 1** — Italy, Spain, South Korea, Taiwan, China, India
- [ ] **Phase 33: Tier 3 Complex Sources Batch 2** — Switzerland, Sweden, Norway, Poland, Czech Republic, Hungary, Portugal
- [ ] **Phase 34: Scoring Integration** — Update weights, source tiers, and scoring engine for all new advisory sources
- [ ] **Phase 35: CI/CD Automation** — GitHub Actions workflows for daily advisory fetching across 30+ sources
- [ ] **Phase 36: Documentation** — Methodology page, country pages, and sources page updated in all 5 languages
- [ ] **Phase 37: Calibration & Validation** — Reference scores, deviation analysis, bias detection, weight balancing proposals

## Phase Details

<details>
<summary>v2.0 Phase Details (Phases 16-20) — SHIPPED</summary>

### Phase 16: Production Foundation
**Goal**: Site serves with correct security posture, accurate robots.txt, LLM discoverability, verified analytics, and proper cache behavior
**Depends on**: Phase 15 (v1.2 complete)
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04, PROD-05, PROD-06, LLM-01, LLM-02
**Success Criteria** (what must be TRUE):
  1. Browser DevTools shows HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy headers on every page response
  2. robots.txt contains the correct domain in the sitemap URL and explicitly allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot)
  3. /llms.txt is accessible and contains a curated page list following the llmstxt.org specification
  4. Cloudflare Web Analytics dashboard shows active data collection for the site
  5. Static assets (JS, CSS, images) return long-lived Cache-Control headers; HTML pages return short-lived cache headers
**Plans**: 2 plans

Plans:
- [x] 16-01-PLAN.md — Security headers, cache-control, robots.txt fix, AI crawler directives, domain URL fix
- [x] 16-02-PLAN.md — llms.txt for LLM discoverability, FUNDING.yml, analytics verification

### Phase 17: Legal Compliance
**Goal**: Users in any language can read an accurate, complete privacy policy and identify the site operator, satisfying GDPR requirements
**Depends on**: Phase 16 (analytics confirmed, so privacy policy can accurately describe data practices)
**Requirements**: LEGL-01, LEGL-02, LEGL-03, LEGL-04
**Success Criteria** (what must be TRUE):
  1. User can navigate to a privacy policy page in each of the 5 languages (EN, IT, ES, FR, PT) from the footer
  2. Privacy policy accurately documents the zero-cookie architecture, Cloudflare Web Analytics usage, and all data processing practices
  3. User can find site operator identification and contact information on a legal/imprint page (GDPR Article 13)
  4. A comprehensive local-only legal research document exists covering GDPR, ePrivacy, and Italian Garante requirements (not pushed to GitHub)
**Plans**: 1 plan

Plans:
- [x] 17-01-PLAN.md — Privacy policy, imprint sections, and legal research document

### Phase 18: SEO Enhancement
**Goal**: All pages have breadcrumb navigation and structured data schemas that maximize rich snippet eligibility in search results
**Depends on**: Phase 16 (domain verified in robots.txt before any schema URLs are generated)
**Requirements**: SEO-01, SEO-02, SEO-03, SEO-04, SEO-05, LLM-03
**Success Criteria** (what must be TRUE):
  1. Every country detail, comparison, and methodology page displays a breadcrumb navigation bar with locale-aware translated paths
  2. Google Rich Results Test validates BreadcrumbList JSON-LD on country detail pages and Organization JSON-LD on the homepage
  3. FAQPage JSON-LD schema is present on the methodology page, leveraging the existing expandable Q&A content
  4. Root URL (/) performs a server-side redirect via _redirects instead of client-side JavaScript
  5. All pages use correct heading hierarchy (one H1, no skipped levels) and semantic landmarks (main, nav, article)
**Plans**: 1 plan

Plans:
- [x] 18-01-PLAN.md — Breadcrumb navigation, Organization/FAQ JSON-LD, _redirects, heading hierarchy audit

### Phase 19: Donations and Error Pages
**Goal**: Users can support the project through donations and see helpful branded pages when encountering missing content
**Depends on**: Phase 17 (donation pages link to privacy policy; legal foundation established first)
**Requirements**: DONA-01, DONA-02, DONA-03, DONA-04, ERR-01, ERR-02
**Success Criteria** (what must be TRUE):
  1. User can access a donations page in each of the 5 languages explaining what donations fund and showing funding transparency (hosting costs, domain costs)
  2. Donations page links to GitHub Sponsors (primary) and Ko-fi (secondary) with no embedded iframes or cookies
  3. Footer on every page includes a visible donation link
  4. Visiting a non-existent URL shows a custom branded 404 page with search suggestion and home link
  5. 404 page displays in the correct language based on the URL path prefix (e.g., /it/xyz shows Italian 404)
**Plans**: 1 plan

Plans:
- [x] 19-01-PLAN.md — Multilingual donation pages, footer link, custom 404 with language detection

### Phase 20: Accessibility and CSP Hardening
**Goal**: Site meets WCAG 2.1 AA accessibility baseline and serves a Content-Security-Policy that hardens against injection without breaking functionality
**Depends on**: Phase 19 (all pages exist; CSP finalized after all inline scripts are stable)
**Requirements**: A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-06, CSP-01, CSP-02
**Success Criteria** (what must be TRUE):
  1. Keyboard user sees a "Skip to content" link on focus that jumps past navigation on every page
  2. All interactive elements (links, buttons, inputs, map controls) show visible focus indicators when navigated via keyboard
  3. D3 charts and the SVG map have ARIA labels and role="img" so screen readers announce their purpose
  4. Color contrast meets WCAG 2.1 AA ratios (4.5:1 normal text, 3:1 large text) in both light and dark mode
  5. Content-Security-Policy is deployed (report-only first, then enforced) without breaking D3 charts, the map, or dark mode toggle
**Plans**: 1 plan

Plans:
- [x] 20-01-PLAN.md — Skip nav, focus indicators, ARIA labels, form labels, heading hierarchy, CSP report-only

</details>

<details>
<summary>v3.0 Phase Details (Phases 21-27) — SHIPPED</summary>

### Phase 21: Scoring Formula Redesign
**Goal**: Scoring engine uses a tiered baseline+signal architecture with freshness decay so that realtime sources can be integrated without destabilizing existing scores
**Depends on**: Phase 20 (v2.0 complete)
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, SRC-05
**Success Criteria** (what must be TRUE):
  1. Running the pipeline produces scores where annual indices (GPI, INFORM, World Bank) contribute approximately 70% and existing signal sources (ACLED, advisories) contribute the remainder, verified by logging tier contributions
  2. A sources.json config file defines tier (baseline/signal), decay half-life, and max-age for every data source, and the scoring engine reads it at runtime
  3. When all realtime source data is missing or stale beyond max-age, the engine falls back to pure baseline scoring and produces valid scores for all 248 countries
  4. Adding or removing an indicator does not silently change the effective weight of other indicators in the same pillar (per-indicator sub-weights enforce this)
  5. A static FIPS-to-ISO3 mapping file exists with coverage for all GDELT country codes needed in Phase 24
**Plans**: 3 plans

Plans:
- [x] 21-01-PLAN.md — Types, sources.json config, FIPS-to-ISO3 mapping, weights.json v5.0.0 with per-indicator sub-weights
- [x] 21-02-PLAN.md — Freshness decay module and scoring engine rewrite with tiered baseline+signal blending
- [x] 21-03-PLAN.md — Pipeline integration wiring and end-to-end verification

### Phase 22: Historical Backfill
**Goal**: All historical scores from 2012 onward are recalculated with the new formula so trend charts show smooth continuity instead of a v3 cliff
**Depends on**: Phase 21 (new formula must exist before recalculating history)
**Requirements**: HIST-01, HIST-02
**Success Criteria** (what must be TRUE):
  1. User views any country's trend chart and sees a smooth score line from 2012 to present with no abrupt discontinuity at the v3 formula change date
  2. history-index.json contains recalculated scores for every historical snapshot using the new tiered formula, with per-pillar breakdowns consistent across all dates
**Plans**: 1 plan

Plans:
- [x] 22-01-PLAN.md — Backfill script to re-score all ~566 historical snapshots with v5.0.0 tiered engine and rebuild history-index.json

### Phase 23: ReliefWeb and GDACS Fetchers
**Goal**: Pipeline ingests humanitarian disaster data from ReliefWeb and natural disaster alerts from GDACS as the first two realtime signal sources
**Depends on**: Phase 22 (backfill complete so new source data flows into a stable historical baseline)
**Requirements**: SRC-02, SRC-03
**Success Criteria** (what must be TRUE):
  1. After a pipeline run, data/raw/{date}/ contains reliefweb-parsed.json with active disaster counts and severity per country, sourced from the ReliefWeb API
  2. After a pipeline run, data/raw/{date}/ contains gdacs-parsed.json with orange/red severity disaster alerts (earthquakes, floods, cyclones, volcanoes) mapped to affected countries
  3. Countries with active humanitarian crises or major natural disasters show measurably higher signal-tier contributions in their scores compared to countries without active events
  4. When ReliefWeb or GDACS API is unreachable, the pipeline completes successfully using cached data or pure baseline fallback
**Plans**: 2 plans

Plans:
- [x] 23-01-PLAN.md — ReliefWeb and GDACS fetcher modules (API integration, parsing, caching)
- [x] 23-02-PLAN.md — Pipeline wiring (index registration, normalization ranges, weights config, e2e test)

### Phase 24: GDELT Stability Fetcher
**Goal**: Pipeline ingests GDELT instability scores as a near-realtime conflict signal, with media bias explicitly contained through self-relative spike detection
**Depends on**: Phase 23 (fetcher pattern validated with simpler sources first)
**Requirements**: SRC-01
**Success Criteria** (what must be TRUE):
  1. After a pipeline run, data/raw/{date}/ contains gdelt-parsed.json with per-country instability scores fetched via the GDELT Stability Timeline API using the FIPS-to-ISO3 mapping
  2. GDELT's contribution is capped (no more than 15% of the conflict pillar) so media volume bias cannot dominate a country's safety score
  3. The pipeline completes its full GDELT fetch within the GitHub Actions CI time budget (under 5 minutes for all countries)
**Plans**: 2 plans

Plans:
- [x] 24-01-PLAN.md — GDELT Stability Timeline API fetcher module (FIPS mapping, CSV parsing, sequential fetch with rate limiting)
- [x] 24-02-PLAN.md — Pipeline wiring (index registration, normalization range, conflict pillar weights with 15% cap)

### Phase 25: WHO DONs Fetcher
**Goal**: Pipeline ingests WHO Disease Outbreak News to give the health pillar a realtime signal for active epidemics and disease events
**Depends on**: Phase 24 (all simpler fetchers validated; health pillar baseline already strong)
**Requirements**: SRC-04
**Success Criteria** (what must be TRUE):
  1. After a pipeline run, data/raw/{date}/ contains who-dons-parsed.json with active outbreak counts per country from the last 90 days
  2. Countries with WHO-declared disease outbreaks show a measurable increase in their health pillar signal contribution
  3. When the WHO DONs API is unreachable or returns unparseable data, the pipeline completes successfully and the health pillar falls back to baseline-only scoring
**Plans**: 2 plans

Plans:
- [x] 25-01-PLAN.md — WHO DONs fetcher module (API integration, title parsing, country extraction, caching)
- [x] 25-02-PLAN.md — Pipeline wiring (index registration, normalization range, health pillar weights v5.3.0)

### Phase 26: Validation, Documentation, and UX
**Goal**: All sources are validated against known crises, score drift is guarded in CI, methodology and repo documentation reflect the new architecture, and users see dynamic score indicators
**Depends on**: Phase 25 (all sources flowing before validation and documentation)
**Requirements**: VALID-01, VALID-02, DOC-01, DOC-02, DOC-03, REPO-01, REPO-02, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. A CI test fails the build if any country's score changes by more than 0.5 points in a single day, catching unexpected drift from source anomalies
  2. Running the new formula against at least 3 known historical crises (e.g., 2023 Turkey earthquake, 2024 Sudan conflict, a major disease outbreak) produces scores that reflect the crisis more accurately than the old formula
  3. User can read the methodology page in any of the 5 languages and find explanations of the baseline+signal formula, every data source, its update frequency, and its role in scoring
  4. README and pipeline documentation explain the new data architecture, source tiers, decay parameters, and how to add a new source
  5. User sees a score change delta indicator (arrow or badge) on country cards showing recent score movement, and data freshness badges showing when each source was last updated
**Plans**: 3 plans

Plans:
- [x] 26-01-PLAN.md — Score drift CI guard and crisis validation tests
- [x] 26-02-PLAN.md — Methodology page update (5 languages) and README/pipeline documentation
- [x] 26-03-PLAN.md — Score delta indicators and data freshness badges on country detail pages

### Phase 27: SEO & AI Search Optimization
**Goal**: Maximize visibility in Google Search and AI chatbot citations through OG images, enriched structured data, About page with E-E-A-T signals, crawlable static content, and sitemap improvements
**Depends on**: Phase 26
**Requirements**: SEO27-01, SEO27-02, SEO27-03, SEO27-04, SEO27-05, SEO27-06, SEO27-07, SEO27-08, SEO27-09, SEO27-10, SEO27-11, SEO27-12, SEO27-13, SEO27-14
**Plans**: 3 plans

Plans:
- [x] 27-01-PLAN.md — SEO metadata fixes: score rounding, dateModified/datePublished, Organization schema, FAQ natural language, meta robots, preload, llms.txt
- [x] 27-02-PLAN.md — About page (5 languages) with E-E-A-T, Person schema, static pillar table, homepage country listing
- [x] 27-03-PLAN.md — OG image generation at build time, sitemap lastmod and language coverage

</details>

### Phase 28: Cleanup
**Goal**: Broken WHO DONs and GDELT sources are fully removed from the codebase so the pipeline is clean and stable before adding 30+ new sources
**Depends on**: Phase 27 (v3.0 complete)
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03
**Success Criteria** (what must be TRUE):
  1. Pipeline runs successfully with no references to WHO DONs fetcher, parser, or normalization code anywhere in the codebase
  2. Pipeline runs successfully with no references to GDELT fetcher, parser, FIPS mapping usage, or normalization code anywhere in the codebase
  3. Scores for all 248 countries are recalculated after source removal and weights.json reflects the updated configuration without WHO DONs or GDELT indicators
  4. No country scores deviate by more than 0.3 points from pre-removal scores (since these sources contributed minimal signal)
**Plans**: 2 plans

Plans:
- [x] 28-01-PLAN.md — Remove GDELT and WHO DONs fetchers, update weights/config/normalize/engine, fix tests
- [x] 28-02-PLAN.md — Update i18n strings, methodology pages, docs, verify score stability

### Phase 29: Tier 1 API Sources
**Goal**: Pipeline fetches advisory data from 4 countries with clean REST/JSON/XML APIs and establishes the normalization foundation that all subsequent sources will use
**Depends on**: Phase 28 (clean codebase before adding new sources)
**Requirements**: API-01, API-02, API-03, API-04, NORM-01
**Success Criteria** (what must be TRUE):
  1. After a pipeline run, data/raw/{date}/ contains parsed advisory JSON for Germany (Auswaertiges Amt), Netherlands (nederlandwereldwijd.nl), Japan (MOFA), and Slovakia (MZV) with per-country advisory levels
  2. A shared normalization module maps each source's native level system (3-level, 4-level, 5-level, color-coded) to the unified 1-4 advisory scale
  3. When any individual API is unreachable, the pipeline completes successfully and that source falls back gracefully without blocking other sources
  4. Each fetcher includes country name-to-ISO3 mapping so advisory levels are correctly assigned to the right countries in the scoring engine
**Plans**: 2 plans

Plans:
- [x] 29-01-PLAN.md — Normalization module, type extensions, config updates for DE/NL/JP/SK advisory sources
- [x] 29-02-PLAN.md — Tier 1 fetchers (Germany, Netherlands, Japan, Slovakia) and pipeline registration

### Phase 30: Tier 2 HTML Sources Batch 1
**Goal**: Pipeline scrapes advisory data from 8 countries with structured HTML pages, expanding geographic coverage to Western Europe, Oceania, South America, and Asia
**Depends on**: Phase 29 (normalization foundation established)
**Requirements**: HTML-01, HTML-02, HTML-03, HTML-04, HTML-05, HTML-06, HTML-07, HTML-08
**Success Criteria** (what must be TRUE):
  1. After a pipeline run, data/raw/{date}/ contains parsed advisory JSON for France, New Zealand, Ireland, Finland, Hong Kong, Brazil, Austria, and Philippines with per-country advisory levels
  2. All 8 sources normalize to the unified 1-4 scale via the shared normalization module from Phase 29
  3. HTML parsing is resilient to minor page structure changes (uses semantic selectors, not brittle positional selectors)
  4. When any individual source page is unreachable or has changed structure, the fetcher logs a warning and the pipeline continues without that source
**Plans**: 2 plans

Plans:
- [x] 30-01-PLAN.md — Install cheerio, extend types/normalization/engine for 8 Tier 2a sources
- [x] 30-02-PLAN.md — Create advisories-tier2a.ts with 8 sub-fetchers and pipeline registration

### Phase 31: Tier 2 HTML Sources Batch 2
**Goal**: Pipeline scrapes advisory data from 8 more countries, completing Tier 2 coverage across Northern Europe, Southeast Asia, Eastern Europe, and South America
**Depends on**: Phase 30 (HTML scraping patterns validated)
**Requirements**: HTML-09, HTML-10, HTML-11, HTML-12, HTML-13, HTML-14, HTML-15, HTML-16
**Success Criteria** (what must be TRUE):
  1. After a pipeline run, data/raw/{date}/ contains parsed advisory JSON for Belgium, Denmark, Singapore, Romania, Serbia, Estonia, Croatia, and Argentina with per-country advisory levels
  2. All 8 sources normalize to the unified 1-4 scale via the shared normalization module
  3. Fetcher code reuses the HTML scraping infrastructure from Phase 30, minimizing code duplication
  4. Total Tier 2 fetch time (16 sources) stays within GitHub Actions CI budget (under 10 minutes)
**Plans**: 2 plans

Plans:
- [x] 31-01-PLAN.md — Extend types/normalization/engine/config for 8 Tier 2b sources
- [x] 31-02-PLAN.md — Create advisories-tier2b.ts with 8 sub-fetchers and pipeline wiring

### Phase 32: Tier 3 Complex Sources Batch 1
**Goal**: Pipeline extracts advisory data from 6 countries with complex scraping challenges (dynamic rendering, non-Latin scripts, text-based levels requiring pattern matching)
**Depends on**: Phase 31 (simpler HTML patterns validated before tackling complex sources)
**Requirements**: CPLX-01, CPLX-02, CPLX-03, CPLX-04, CPLX-05, CPLX-06
**Success Criteria** (what must be TRUE):
  1. After a pipeline run, data/raw/{date}/ contains parsed advisory JSON for Italy, Spain, South Korea, Taiwan, China, and India with per-country advisory levels
  2. Non-Latin scripts (Korean, Chinese) and text-based advisory descriptions are correctly mapped to the unified 1-4 scale
  3. Complex sources that require multi-step navigation or JavaScript rendering use appropriate techniques (static HTML snapshots, API discovery, or cached fallbacks)
  4. Each complex fetcher documents its fragility level and expected failure modes in code comments
**Plans**: 2 plans

Plans:
- [x] 32-01-PLAN.md — Extend types/normalization/config for 6 Tier 3a complex sources (IT, ES, KR, TW, CN, IN)
- [x] 32-02-PLAN.md — Create advisories-tier3a.ts with 6 sub-fetchers and pipeline wiring

### Phase 33: Tier 3 Complex Sources Batch 2
**Goal**: Pipeline extracts advisory data from 7 more European countries with complex source structures, completing the full 30+ source expansion
**Depends on**: Phase 32 (complex scraping techniques validated)
**Requirements**: CPLX-07, CPLX-08, CPLX-09, CPLX-10, CPLX-11, CPLX-12, CPLX-13
**Success Criteria** (what must be TRUE):
  1. After a pipeline run, data/raw/{date}/ contains parsed advisory JSON for Switzerland, Sweden, Norway, Poland, Czech Republic, Hungary, and Portugal with per-country advisory levels
  2. All 7 sources normalize to the unified 1-4 scale via the shared normalization module
  3. The total advisory source count is 34+ (4 existing Five Eyes + 4 Tier 1 + 16 Tier 2 + 13 Tier 3 - 3 removed = 34)
  4. A summary log after pipeline run reports fetch success/failure for all 34+ advisory sources
**Plans**: 2 plans

Plans:
- [x] 33-01-PLAN.md
- [x] 33-02-PLAN.md

### Phase 34: Scoring Integration
**Goal**: Scoring engine properly weights all 34+ advisory sources in the Conflict pillar, with source-tiers configuration reflecting the expanded source set
**Depends on**: Phase 33 (all sources must be fetching before scoring integration)
**Requirements**: NORM-02, NORM-03
**Success Criteria** (what must be TRUE):
  1. weights.json assigns sub-weights to all 34+ advisory sources within the Conflict pillar, with diminishing per-source weight as count increases (no single advisory dominates)
  2. source-tiers.json lists all new advisory sources as signal tier with appropriate decay half-life and max-age parameters
  3. Countries covered by more advisory sources show greater score stability (consensus effect) compared to countries with sparse coverage
  4. Running the full pipeline produces valid scores for all 248 countries with the expanded advisory set
**Plans**: 2 plans

Plans:
- [ ] 34-01-PLAN.md
- [x] 34-02-PLAN.md

### Phase 35: CI/CD Automation
**Goal**: All new advisory sources are fetched automatically via GitHub Actions daily with staggered scheduling and graceful failure handling
**Depends on**: Phase 34 (scoring integration complete so CI runs produce valid scores)
**Requirements**: CI-01, CI-02, CI-03
**Success Criteria** (what must be TRUE):
  1. GitHub Actions workflow triggers daily and fetches all 34+ advisory sources
  2. Sources are fetched in staggered batches with delays between groups to respect rate limits and avoid IP blocking
  3. When individual sources fail, the workflow logs the failure, continues with remaining sources, and the pipeline produces valid scores using available data
  4. Workflow completes within GitHub Actions free-tier time limits (under 30 minutes total)
**Plans**: 2 plans

Plans:
- [x] 35-01-PLAN.md — Staggered batch fetching and enhanced workflow reporting
- [ ] 35-02-PLAN.md

### Phase 36: Documentation
**Goal**: Users can understand where scores come from, see which advisories apply to each country, and find all advisory sources listed on the sources page
**Depends on**: Phase 35 (CI running so documentation reflects final production state)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. Methodology page in all 5 languages explains the expanded advisory source set, how normalization works, and how advisory consensus affects scoring
  2. Country detail pages display advisory information from the new sources (showing which governments have issued advisories for that country)
  3. Sources page lists all 34+ government advisory sources with country of origin, data format, and update frequency
**Plans**: 2 plans

Plans:
- [x] 36-01-PLAN.md — i18n keys, advisory component refactor, methodology page updates (DOC-01, DOC-02)
- [x] 36-02-PLAN.md — Sources page in 5 languages, footer link (DOC-03)
**UI hint**: yes

### Phase 37: Calibration & Validation
**Goal**: Scores are validated against real-world safety perceptions, systematic biases are identified, and weight adjustments are proposed based on data
**Depends on**: Phase 36 (full pipeline running with documentation before calibration)
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04
**Success Criteria** (what must be TRUE):
  1. A reference score dataset exists with research-backed expected safety scores (1-10) for at least 50 representative countries across all regions
  2. A deviation report shows per-country delta between site scores and reference scores, with global mean absolute deviation computed
  3. Systematic bias patterns are identified and documented (e.g., "European countries score 0.4 higher than expected" or "conflict zones show adequate differentiation")
  4. At least 2 concrete weight adjustment proposals are documented with projected impact on deviation metrics
**Plans**: 2 plans

Plans:
- [x] 37-01-PLAN.md — Reference scores, deviation analysis, calibration report (CAL-01, CAL-02, CAL-03, CAL-04)
- [ ] 37-02-PLAN.md

## Progress

**Execution Order:**
Phases execute in numeric order: 28 → 29 → 30 → 31 → 32 → 33 → 34 → 35 → 36 → 37

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Foundation | v1.0 | 2/2 | Complete | 2026-03-19 |
| 2. Data Pipeline and Scoring Engine | v1.0 | 3/3 | Complete | 2026-03-19 |
| 3. Interactive Map | v1.0 | 2/2 | Complete | 2026-03-19 |
| 4. Country Detail Pages | v1.0 | 2/2 | Complete | 2026-03-19 |
| 5. Search and Transparency | v1.0 | 2/2 | Complete | 2026-03-19 |
| 6. SEO, Performance, and Launch | v1.0 | 2/2 | Complete | 2026-03-19 |
| 7. Pipeline Extensions | v1.1 | 1/1 | Complete | 2026-03-19 |
| 8. Global Safety Score UI | v1.1 | 2/2 | Complete | 2026-03-19 |
| 9. Enhanced History Charts | v1.1 | 1/1 | Complete | 2026-03-19 |
| 10. Country Comparison | v1.1 | 2/2 | Complete | 2026-03-19 |
| 11. Bug Fixes | v1.2 | 1/1 | Complete | 2026-03-20 |
| 12. Interactive Charts | v1.2 | 2/2 | Complete | 2026-03-20 |
| 13. Pillar Explanations | v1.2 | 1/1 | Complete | 2026-03-20 |
| 14. Category Filtering | v1.2 | 2/2 | Complete | 2026-03-20 |
| 15. Spanish Language | v1.2 | 2/2 | Complete | 2026-03-20 |
| 16. Production Foundation | v2.0 | 2/2 | Complete | 2026-03-21 |
| 17. Legal Compliance | v2.0 | 1/1 | Complete | 2026-03-21 |
| 18. SEO Enhancement | v2.0 | 1/1 | Complete | 2026-03-21 |
| 19. Donations and Error Pages | v2.0 | 1/1 | Complete | 2026-03-21 |
| 20. Accessibility and CSP Hardening | v2.0 | 1/1 | Complete | 2026-03-21 |
| 21. Scoring Formula Redesign | v3.0 | 3/3 | Complete | 2026-03-22 |
| 22. Historical Backfill | v3.0 | 1/1 | Complete | 2026-03-23 |
| 23. ReliefWeb and GDACS Fetchers | v3.0 | 2/2 | Complete | 2026-03-23 |
| 24. GDELT Stability Fetcher | v3.0 | 2/2 | Complete | 2026-03-23 |
| 25. WHO DONs Fetcher | v3.0 | 2/2 | Complete | 2026-03-23 |
| 26. Validation, Documentation, and UX | v3.0 | 3/3 | Complete | 2026-03-23 |
| 27. SEO & AI Search Optimization | v3.0 | 3/3 | Complete | 2026-03-25 |
| 28. Cleanup | v4.0 | 2/2 | Complete    | 2026-03-26 |
| 29. Tier 1 API Sources | v4.0 | 2/2 | Complete    | 2026-03-26 |
| 30. Tier 2 HTML Sources Batch 1 | v4.0 | 2/2 | Complete    | 2026-03-26 |
| 31. Tier 2 HTML Sources Batch 2 | v4.0 | 2/2 | Complete    | 2026-03-26 |
| 32. Tier 3 Complex Sources Batch 1 | v4.0 | 2/2 | Complete    | 2026-03-26 |
| 33. Tier 3 Complex Sources Batch 2 | v4.0 | 2/2 | Complete    | 2026-03-27 |
| 34. Scoring Integration | v4.0 | 0/2 | Complete    | 2026-03-27 |
| 35. CI/CD Automation | v4.0 | 1/2 | Complete    | 2026-03-27 |
| 36. Documentation | v4.0 | 2/2 | Complete    | 2026-03-27 |
| 37. Calibration & Validation | v4.0 | 1/2 | Complete    | 2026-03-27 |
