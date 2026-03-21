# Roadmap: IsItSafeToTravel.com

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-19)
- ✅ **v1.1 Comparison & Historical Trends** — Phases 7-10 (shipped 2026-03-19)
- ✅ **v1.2 Improvements & Category Filtering** — Phases 11-15 (shipped 2026-03-20)
- 🚧 **v2.0 Production Ready** — Phases 16-20 (in progress)

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

### v2.0 Production Ready (In Progress)

**Milestone Goal:** Transform the site into a production-ready platform with legal compliance, SEO perfection, LLM readability, monitoring, and donation support.

- [x] **Phase 16: Production Foundation** — Security headers, robots.txt fix, llms.txt, analytics verification, FUNDING.yml, cache headers (completed 2026-03-21)
- [ ] **Phase 17: Legal Compliance** — Privacy policy in 5 languages, imprint page, legal research document
- [ ] **Phase 18: SEO Enhancement** — Breadcrumb UI and schema, Organization schema, FAQ schema, root redirect, semantic HTML audit
- [ ] **Phase 19: Donations and Error Pages** — Multilingual donations page, custom 404 pages, footer donation link
- [ ] **Phase 20: Accessibility and CSP Hardening** — Skip nav, focus indicators, ARIA labels, color contrast, heading hierarchy, Content-Security-Policy

## Phase Details

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
**Plans**: TBD

Plans:
- [ ] 17-01: TBD
- [ ] 17-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 18-01: TBD
- [ ] 18-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 19-01: TBD
- [ ] 19-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 20-01: TBD
- [ ] 20-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 16 → 17 → 18 → 19 → 20

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
| 16. Production Foundation | v2.0 | 2/2 | Complete   | 2026-03-21 |
| 17. Legal Compliance | v2.0 | 0/? | Not started | - |
| 18. SEO Enhancement | v2.0 | 0/? | Not started | - |
| 19. Donations and Error Pages | v2.0 | 0/? | Not started | - |
| 20. Accessibility and CSP Hardening | v2.0 | 0/? | Not started | - |
