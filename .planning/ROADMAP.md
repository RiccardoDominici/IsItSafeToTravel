# Roadmap: IsItSafeToTravel.com

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-6 (shipped 2026-03-19)
- ✅ **v1.1 Comparison & Historical Trends** -- Phases 7-10 (shipped 2026-03-19)
- [ ] **v1.2 Improvements & Category Filtering** -- Phases 11-15 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-6) -- SHIPPED 2026-03-19</summary>

- [x] **Phase 1: Project Foundation** -- Astro scaffold with i18n routing, Cloudflare deployment, and dev tooling
- [x] **Phase 2: Data Pipeline and Scoring Engine** -- Fetch public indices, compute composite safety scores for 200+ countries
- [x] **Phase 3: Interactive Map** -- Color-coded world map with zoom, pan, and click-to-navigate
- [x] **Phase 4: Country Detail Pages** -- Per-country pages with score breakdowns, trends, advisories, and sources
- [x] **Phase 5: Search and Transparency** -- Autocomplete search, methodology page, and legal disclaimers
- [x] **Phase 6: SEO, Performance, and Launch** -- Static generation, structured data, mobile polish, and Lighthouse 90+

</details>

<details>
<summary>v1.1 Comparison & Historical Trends (Phases 7-10) -- SHIPPED 2026-03-19</summary>

- [x] **Phase 7: Pipeline Extensions** -- Global score computation and consolidated history index
- [x] **Phase 8: Global Safety Score UI** -- Homepage banner and dedicated global safety page with trend chart
- [x] **Phase 9: Enhanced History Charts** -- Full-size interactive trend charts on country detail pages
- [x] **Phase 10: Country Comparison** -- Side-by-side country comparison with score cards, bar charts, and overlay trends

</details>

### v1.2 Improvements & Category Filtering (In Progress)

**Milestone Goal:** Enhance interactivity, fix bugs, add Spanish language support, and enable per-category exploration of safety data.

- [x] **Phase 11: Bug Fixes** -- Fix comparison page search and trend chart date axis (completed 2026-03-20)
- [x] **Phase 12: Interactive Charts** -- Client-side TrendChart refactor with drag-to-zoom (completed 2026-03-20)
- [ ] **Phase 13: Pillar Explanations** -- Detailed safety pillar descriptions on methodology page
- [ ] **Phase 14: Category Filtering** -- Filter map and charts by individual safety pillar
- [ ] **Phase 15: Spanish Language** -- Full Spanish locale with translated UI and country names

## Phase Details

### Phase 11: Bug Fixes
**Goal**: Existing features work correctly -- users can compare countries and trust chart dates
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: BUG-01, BUG-02
**Success Criteria** (what must be TRUE):
  1. User sees correct, properly formatted dates on all historical trend chart axes
  2. User can type a country name in the comparison page search box and select it from dropdown results without the dropdown closing prematurely
**Plans**: 1 plan
Plans:
- [x] 11-01-PLAN.md — Fix trend chart UTC dates and comparison dropdown race condition

### Phase 12: Interactive Charts
**Goal**: Users can explore historical trends at any time scale using drag-to-zoom
**Depends on**: Phase 11
**Requirements**: CHART-01, CHART-02
**Success Criteria** (what must be TRUE):
  1. User can click and drag on a trend chart to zoom into a specific date range
  2. User can see a visible reset button after zooming and click it to return to the full date range
  3. Chart transitions animate smoothly when zooming in or resetting
  4. Interactive charts work on both country detail pages and the comparison page
**Plans**: 2 plans
Plans:
- [ ] 12-01-PLAN.md — Convert TrendChart to client-side D3 with brush zoom and reset
- [ ] 12-02-PLAN.md — Add brush zoom to comparison page trend charts (en + it)

### Phase 13: Pillar Explanations
**Goal**: Users understand what each safety pillar measures and why it matters for travel decisions
**Depends on**: Nothing (independent)
**Requirements**: EXPL-01
**Success Criteria** (what must be TRUE):
  1. User can see an expandable section for each safety pillar on the methodology page
  2. Each pillar explanation describes what it measures, which data sources feed into it, and what low/high scores mean for travelers
  3. Explanations are available in all supported languages (English, Italian)
**Plans**: 1 plan
Plans:
- [ ] 13-01-PLAN.md — Add pillar explanation sections with i18n to methodology pages (EN + IT)

### Phase 14: Category Filtering
**Goal**: Users can view safety data through the lens of individual pillars instead of only the composite score
**Depends on**: Phase 12 (client-side chart patterns established)
**Requirements**: FILT-01, FILT-02, FILT-03
**Success Criteria** (what must be TRUE):
  1. User can select a safety pillar from a filter control on the map and see all countries recolored by that pillar's score
  2. User can select a safety pillar on a trend chart and see historical data for that specific pillar
  3. Active filter label is clearly visible on both the map and chart, showing which pillar is currently displayed
  4. User can switch back to the composite "Overall" view from any pillar filter
**Plans**: 1 plan
Plans:
- [ ] 11-01-PLAN.md — Fix trend chart UTC dates and comparison dropdown race condition

### Phase 15: Spanish Language
**Goal**: Spanish-speaking travelers can use the full site in their language
**Depends on**: Nothing (independent of other v1.2 phases)
**Requirements**: LANG-01, LANG-02, LANG-03
**Success Criteria** (what must be TRUE):
  1. User can browse all pages under the /es/ path with fully translated UI text
  2. All 248 country names display correctly in Spanish throughout the site (map tooltips, search, detail pages)
  3. Language switcher in the header includes a Spanish option and switches to the Spanish version of the current page
  4. Spanish pages have correct SEO metadata (hreflang tags, localized meta descriptions)
**Plans**: 1 plan
Plans:
- [ ] 11-01-PLAN.md — Fix trend chart UTC dates and comparison dropdown race condition

## Progress

**Execution Order:**
Phases execute in numeric order: 11 -> 12 -> 13 -> 14 -> 15
Note: Phases 13 and 15 are independent and could execute in parallel with other phases.

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
| 13. Pillar Explanations | v1.2 | 0/1 | Not started | - |
| 14. Category Filtering | v1.2 | 0/? | Not started | - |
| 15. Spanish Language | v1.2 | 0/? | Not started | - |
