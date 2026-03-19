# Roadmap: IsItSafeToTravel.com

## Milestones

- **v1.0 MVP** - Phases 1-6 (shipped 2026-03-19)
- **v1.1 Comparison & Historical Trends** - Phases 7-10 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-6) - SHIPPED 2026-03-19</summary>

- [x] **Phase 1: Project Foundation** - Astro scaffold with i18n routing, Cloudflare deployment, and dev tooling
- [x] **Phase 2: Data Pipeline and Scoring Engine** - Fetch public indices, compute composite safety scores for 200+ countries
- [x] **Phase 3: Interactive Map** - Color-coded world map with zoom, pan, and click-to-navigate
- [x] **Phase 4: Country Detail Pages** - Per-country pages with score breakdowns, trends, advisories, and sources
- [x] **Phase 5: Search and Transparency** - Autocomplete search, methodology page, and legal disclaimers
- [x] **Phase 6: SEO, Performance, and Launch** - Static generation, structured data, mobile polish, and Lighthouse 90+

</details>

### v1.1 Comparison & Historical Trends (In Progress)

**Milestone Goal:** Enable travelers to compare safety across countries and track safety trends over time, with a global benchmark score.

- [ ] **Phase 7: Pipeline Extensions** - Global score computation and consolidated history index for efficient build-time loading
- [ ] **Phase 8: Global Safety Score UI** - Homepage banner and dedicated global safety page with trend chart
- [ ] **Phase 9: Enhanced History Charts** - Full-size interactive trend charts on country detail pages
- [ ] **Phase 10: Country Comparison** - Side-by-side country comparison with score cards, bar charts, and overlay trends

## Phase Details

### Phase 7: Pipeline Extensions
**Goal**: The data pipeline produces a global safety score and a consolidated history index that all v1.1 UI features depend on
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: PIPE-01, PIPE-02
**Success Criteria** (what must be TRUE):
  1. Running the pipeline produces a global safety score (arithmetic mean of all country scores) in the output data
  2. A single history-index.json file exists containing all historical daily snapshots consolidated for efficient loading
  3. Both global score and history index update automatically on the daily pipeline run without manual intervention
**Plans**: 1 plan
Plans:
- [ ] 07-01-PLAN.md -- Global score computation and history index consolidation

### Phase 8: Global Safety Score UI
**Goal**: Users can see and explore a global safety benchmark that contextualizes individual country scores
**Depends on**: Phase 7
**Requirements**: GLOB-01, GLOB-02, GLOB-03, GLOB-04
**Success Criteria** (what must be TRUE):
  1. User sees a global safety score banner on the homepage that displays the current world safety benchmark
  2. User can click the global score banner to navigate to a dedicated global safety page
  3. Global safety page displays a historical trend chart showing the global score over time
  4. Global safety page includes a clear explanation of how the global score is calculated (methodology)
**Plans**: 2 plans
Plans:
- [ ] 08-01-PLAN.md -- Homepage banner component, i18n keys, and route slugs
- [ ] 08-02-PLAN.md -- Global safety page with trend chart, methodology, and SEO

### Phase 9: Enhanced History Charts
**Goal**: Users can explore detailed safety trends over time on each country's detail page with interactive charts
**Depends on**: Phase 7
**Requirements**: HIST-01, HIST-02
**Success Criteria** (what must be TRUE):
  1. Each country detail page displays a full-size trend chart showing safety score evolution over time (replacing or augmenting the existing sparkline)
  2. User sees interactive tooltips on hover (desktop) or tap (mobile) showing the exact score and date for each data point
**Plans**: 1 plan
Plans:
- [ ] 09-01-PLAN.md -- Full-size TrendChart component with interactive tooltips, replacing sparkline

### Phase 10: Country Comparison
**Goal**: Users can compare safety scores and trends across multiple countries on a single page
**Depends on**: Phase 8, Phase 9
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05
**Success Criteria** (what must be TRUE):
  1. User can select 2 or more countries via a searchable selector on the comparison page
  2. User sees side-by-side score cards showing the composite score for each selected country
  3. User sees grouped horizontal bars comparing pillar sub-scores across all selected countries
  4. User sees an overlay trend chart with historical score lines for all selected countries
  5. User can share a specific comparison via URL (e.g., /compare?c=IT,FR,DE) and the recipient sees the same comparison
**Plans**: 2 plans
Plans:
- [ ] 10-01-PLAN.md -- Page scaffolding, i18n, country selector, score cards, and URL sharing
- [ ] 10-02-PLAN.md -- Grouped pillar bars and overlay trend chart with D3

## Progress

**Execution Order:**
Phases execute in numeric order: 7 -> 8 -> 9 -> 10
(Phases 8 and 9 can run in parallel after 7; Phase 10 depends on both)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Foundation | v1.0 | 2/2 | Complete | 2026-03-19 |
| 2. Data Pipeline and Scoring Engine | v1.0 | 3/3 | Complete | 2026-03-19 |
| 3. Interactive Map | v1.0 | 2/2 | Complete | 2026-03-19 |
| 4. Country Detail Pages | v1.0 | 2/2 | Complete | 2026-03-19 |
| 5. Search and Transparency | v1.0 | 2/2 | Complete | 2026-03-19 |
| 6. SEO, Performance, and Launch | v1.0 | 2/2 | Complete | 2026-03-19 |
| 7. Pipeline Extensions | v1.1 | 0/1 | In progress | - |
| 8. Global Safety Score UI | v1.1 | 0/2 | Not started | - |
| 9. Enhanced History Charts | v1.1 | 0/1 | Not started | - |
| 10. Country Comparison | 1/2 | In Progress|  | - |
