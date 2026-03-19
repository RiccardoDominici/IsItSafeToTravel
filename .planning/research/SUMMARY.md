# Project Research Summary

**Project:** IsItSafeToTravel.com
**Domain:** Travel safety information platform (composite score aggregator with interactive map)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

IsItSafeToTravel.com is fundamentally a **data pipeline feeding a static publishing system**, with one interactive widget (the world map). Experts building similar products treat this as a content generation problem, not a web application problem: the pipeline fetches and scores data, the build system produces static HTML pages, and the map hydrates client-side. The entire product can be delivered for under 1 EUR/month (domain only) using Cloudflare Workers for hosting, GitHub Actions for the pipeline cron, and free public data sources for the underlying indices.

The recommended approach is to build the data pipeline first, then the static site around it. The scoring engine — a hierarchical weighted aggregation across five pillars (conflict, crime, health, governance, environment) — must be designed with full transparency before any page is shown to users. This is not just a UX decision; it is the primary credibility mechanism for a product that makes safety claims. The closest competitor, TravelSafe-Abroad, has strong SEO but no interactive map, irregular updates, and partially user-generated data. The project can differentiate on three axes: full methodology transparency, daily automated updates, and multilingual support from launch.

The primary risks are not technical. Score methodology credibility, data source fragility (most indices are annual, not real-time), legal liability from safety ratings, and SEO thin-content penalties are the four failure modes that sink comparable projects. Each must be addressed before launch, not after. A critical framework conflict also exists between research files: STACK.md recommends Next.js 16, while ARCHITECTURE.md recommends Astro. **The recommendation is Astro**, which is architecturally correct for a content-heavy static site with one interactive island. Next.js adds unnecessary React runtime overhead to pages that have no interactivity beyond the map.

## Key Findings

### Recommended Stack

The project can be built entirely on free-tier infrastructure. Cloudflare Workers hosts the site with unlimited bandwidth (no commercial use restriction, unlike Vercel Hobby). GitHub Actions runs the daily data pipeline on public repo unlimited minutes. All data sources (INFORM Risk, Global Peace Index, World Bank WGI, WHO, government advisories) are open access at zero cost.

**Core technologies:**
- **Astro** (latest): Full static site generator with islands architecture — zero JS on most pages, React island only for map and search
- **React + TypeScript**: Used only for the two interactive components (Map, SearchBar); Astro handles everything else as static HTML
- **Tailwind CSS 4.2**: CSS-first config, OKLCH color space ideal for safety score green-to-red gradients
- **shadcn/ui**: Accessible components copied into project, not a dependency; full Tailwind v4 support
- **Leaflet 1.9.x**: 42KB map library, zero dependencies, native choropleth support with GeoJSON; adequate for country-level polygons
- **next-intl 4.x** (or Astro's built-in i18n): Path-based locale routing (`/en/country/italy`, `/it/paese/italia`)
- **GitHub Actions + Node.js 22 LTS**: Daily cron pipeline fetching, normalizing, and scoring data from public sources
- **JSON files in git**: Data store for ~200 countries (~50KB total); no database needed at country scale
- **Cloudflare Workers via @opennextjs/cloudflare**: Free unlimited bandwidth hosting, global edge network

**Note on STACK.md vs ARCHITECTURE.md conflict:** STACK.md recommends Next.js 16; ARCHITECTURE.md recommends Astro. Astro is correct for this use case. Next.js adds a React runtime to every page; this product has 200+ content pages with no interactivity beyond the map. Astro's islands architecture ships zero JS to detail pages by default, maximizing Lighthouse scores critical for SEO.

**Full stack detail:** See `.planning/research/STACK.md`

### Expected Features

The feature landscape is well-researched against five direct competitors (TravelSafe-Abroad, SafeTravy, GeoSure, Safeture, Healix). The market gap is clear: no free tool combines daily updates, full methodology transparency, an interactive map, and multilingual support simultaneously.

**Must have (table stakes):**
- Interactive color-coded world map — this IS the product; every competitor has one
- Country-level safety score (1-10 scale) — simpler and more intuitive than competitors' 0-100
- Country detail pages with score breakdown by category — the SEO traffic driver
- Search with autocomplete — users arrive with a destination in mind
- Mobile-responsive design — 60%+ of travel research happens on mobile
- Source attribution and transparency — primary credibility mechanism; users and press cite these scores
- Government advisory integration (US State Dept, UK FCDO) — the baseline travelers already check
- SEO-optimized static pages — primary organic acquisition channel for a zero-budget product
- i18n framework baked in from day one — retrofitting locale-based URLs after launch breaks all links

**Should have (competitive differentiators):**
- Sub-national / regional drill-down — the project's stated strongest differentiator; most free competitors show only country-level
- Multilingual launch (English + Italian) — competitors are English-only; Italian fills an underserved market
- Historical trend indicators — "getting safer or more dangerous?" adds analytical depth competitors lack
- Comparison tool — side-by-side country comparison; cheap once detail pages exist
- Demographic-specific scores — women travelers and LGBTQ+ sub-scores using Equaldex (open data)

**Defer (v2+):**
- City-level pages (requires paid or scarce data; country + region already differentiates)
- Interactive weight adjustment sliders (v2 engagement feature)
- Additional languages beyond English + Italian (add based on analytics)
- Embeddable map widget, RSS/API for scores, email digest

**Anti-features (explicitly excluded):** User accounts, user-generated reviews, real-time alerts, native mobile app, AI chatbot, hotel/flight booking integration. Each adds complexity or cost that contradicts the zero-budget constraint and data-integrity commitment.

**Full feature detail:** See `.planning/research/FEATURES.md`

### Architecture Approach

The system architecture is a data pipeline feeding a static site generator. This is not a traditional web application; it is closer to a publishing system where all dynamic behavior happens at build time, not at request time. The only client-side JavaScript is the map widget (Leaflet, hydrated `client:visible`) and the search autocomplete (`client:idle`). Every other page element — score cards, pillar breakdowns, language switcher, navigation — is static HTML with zero JavaScript.

**Major components:**
1. **Data Ingester** (GitHub Actions cron, Node.js) — fetches raw data from INFORM, ACLED, GPI, WHO, government advisories on a daily schedule; saves timestamped JSON to `data/raw/`
2. **Scoring Engine** (TypeScript module) — normalizes each indicator to 0-1, applies weighted aggregation across five pillars, outputs one `data/scored/{ISO3}.json` per country
3. **GeoJSON Merger** (Node.js script) — merges scored data into simplified Natural Earth boundaries to produce a single `world-scores.geojson` (<200KB using 1:110m resolution)
4. **Astro Site Generator** — reads scored JSON via content collections, generates 200+ static HTML pages per locale with JSON-LD structured data, sitemap, and hreflang tags
5. **Map Widget** (React island, Leaflet) — hydrates client-side; receives pre-computed GeoJSON with scores and colors baked in; click navigates to pre-built static detail page
6. **Cloudflare Workers** — serves static output at edge; CDN caches GeoJSON and assets globally

**Scoring pillar weights:** Conflict & Security (0.30), Crime & Personal Safety (0.25), Health Risks (0.20), Governance & Rule of Law (0.15), Natural Disaster & Environment (0.10)

**Full architecture detail:** See `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

1. **Score methodology credibility failure** — Weights chosen intuitively without grounding conflate resident risk with traveler risk. Prevention: publish the full formula on every detail page; show pillar breakdowns visually; include a methodology page explaining each weight. Design the scoring model before displaying any data.

2. **Data source availability is not what you expect** — Most safety indices (GPI, World Bank WGI, Fragile States) are annual CSV/Excel downloads with no API. ACLED's free tier gives aggregated dashboards, not granular event data. Prevention: audit every source before writing code — verify actual access with a personal email and zero budget. Design the pipeline for heterogeneous update frequencies: advisories update daily, ACLED weekly, most indices annually.

3. **Legal liability from safety ratings** — A numeric score creates implied authority. Users treat "7/10" as a recommendation. Prevention: frame every score as informational aggregation ("based on available indices, this destination scores X"), add a prominent disclaimer on every page, always link to official government advisories, and avoid absolute language ("safe", "dangerous").

4. **SEO thin content penalty** — 200 template-generated pages where only the country name changes get deindexed by Google as "doorway pages." Prevention: each detail page must have genuinely unique content — specific risk factors, comparison to regional averages, recent advisory changes, unique meta descriptions referencing specific score factors.

5. **Map GeoJSON performance degradation** — Natural Earth full-resolution data is 10-50MB; loading this into Leaflet kills mobile performance. Prevention: use 1:110m resolution for the world overview (~500KB), simplify further with mapshaper, target <200KB TopoJSON, and lazy-load the map component entirely.

6. **i18n URL structure locked in at launch** — Adding locale prefixes to URLs after launch breaks all existing links and loses SEO equity. Prevention: implement path-based locale routing (`/en/`, `/it/`) from day one, with correct reciprocal hreflang tags on every page.

**Full pitfall detail:** See `.planning/research/PITFALLS.md`

## Implications for Roadmap

Based on combined research, the dependency graph is clear: everything requires scored data, scored data requires the pipeline, the pipeline requires source verification, and all of this must be in place before any frontend work produces meaningful output.

### Phase 0: Data Source Audit and Pipeline Spike

**Rationale:** PITFALLS.md identifies data source fragility as a critical risk that must be resolved before any code is written. Verify actual access to every planned source with a personal email and zero budget. Failure here invalidates the entire pipeline design.
**Delivers:** Verified list of accessible sources with confirmed formats, update frequencies, and access tiers. Raw data samples for 10-20 countries stored locally. No production code.
**Avoids:** Pitfall 2 (data source fragility); building a pipeline architecture around sources that require institutional credentials or paid access.
**Research flag:** NEEDS RESEARCH — verify ACLED free tier actual data granularity, GPI annual CSV location and format, INFORM API authentication requirements, US State Dept and UK FCDO machine-readable advisory formats.

### Phase 1: Foundation — Schema, Scaffold, and Tooling

**Rationale:** Three parallel workstreams can proceed simultaneously after Phase 0 confirms data sources. Architecture research identifies these as having no inter-dependencies: (A) data schema design, (B) Astro project scaffold with i18n, (C) Leaflet map component prototype.
**Delivers:** Scored JSON schema (`data/scored/{ISO3}.json` format), Astro project with `/en/` and `/it/` locale routing, and a standalone map component that renders color-coded polygons from a sample GeoJSON.
**Addresses:** i18n baked in from day one (Features MVP requirement), URL structure that supports locales from launch (Pitfall 7 prevention).
**Avoids:** Pitfall 7 (i18n URL restructuring after launch); Anti-Pattern: client-side score computation.
**Research flag:** Standard patterns — Astro i18n routing and Leaflet choropleth are both well-documented with official tutorials. Skip research-phase.

### Phase 2: Data Pipeline — Ingest, Score, and Geo-merge

**Rationale:** The scoring engine is the heart of the product. It must exist before any frontend work produces real output. Depends on Phase 0 (verified sources) and Phase 1 (schema).
**Delivers:** Working GitHub Actions cron that fetches from INFORM, GPI, government advisories; scoring engine producing 200+ `scored/{ISO3}.json` files; GeoJSON merger producing `world-scores.geojson` (<200KB).
**Addresses:** Data pipeline (P1 feature), government advisory integration, source attribution.
**Avoids:** Pitfall 1 (score methodology credibility) — methodology page and weight documentation are built alongside the engine, not added later. Pitfall 5 (GeoJSON performance) — use 1:110m resolution from the start.
**Key decision:** Score weights (Conflict 0.30, Crime 0.25, Health 0.20, Governance 0.15, Environment 0.10) should be externalized to `data/meta/weights.json` from day one, not hardcoded.
**Research flag:** NEEDS RESEARCH — scoring normalization edge cases (missing data for some countries on some indices), ACLED aggregation approach for the free tier, government advisory parsing for each source's specific format.

### Phase 3: MVP Frontend — Map, Detail Pages, Search

**Rationale:** With real scored data and GeoJSON available, build the full frontend. These three components can be built in parallel within the phase.
**Delivers:** Homepage with interactive color-coded world map, 200+ static country detail pages with pillar breakdown, search with autocomplete, mobile-responsive layout, legal disclaimers on every page.
**Addresses:** All P1 features from FEATURES.md: interactive map, country detail pages, search, SEO-optimized pages, mobile-responsive design, source attribution.
**Avoids:** Pitfall 3 (legal liability) — disclaimers and framing language built in from first deploy. Pitfall 1 — methodology page published before any score is visible publicly. Anti-Pattern 2 (monolithic GeoJSON) — pre-simplified TopoJSON used from start.
**Research flag:** Standard patterns — Astro content collections from JSON, Leaflet choropleth with click navigation, shadcn/ui components. Skip research-phase.

### Phase 4: SEO and Launch Readiness

**Rationale:** SEO work requires detail pages to exist (Phase 3) but must be done before indexing begins. Thin content risk is high if not addressed before Google crawls the site.
**Delivers:** JSON-LD structured data on every page, unique meta descriptions per country referencing specific score factors, XML sitemap with hreflang annotations, robots.txt, Cloudflare Workers deployment.
**Addresses:** SEO-optimized destination pages (P1 feature), structured data, sitemap generation.
**Avoids:** Pitfall 6 (SEO thin content) — unique content requirements enforced at this phase. Pitfall 7 (hreflang errors) — verified with hreflang checker tool before launch.
**Research flag:** NEEDS RESEARCH — Astro + Cloudflare Workers deployment via @opennextjs/cloudflare, sitemap generation with per-locale hreflang; moderately documented but some edge cases in Astro integration.

### Phase 5: v1.x — Differentiators

**Rationale:** After validating core product with real traffic, add the features that differentiate from competitors. Regional drill-down is the stated primary differentiator and highest-effort item.
**Delivers:** Italian language support (translate UI strings), regional/sub-national safety scores for high-variation countries using ACLED geocoded conflict data, historical trend sparklines on detail pages, country comparison tool.
**Addresses:** All P2 features from FEATURES.md.
**Avoids:** Pitfall 4 (political sensitivity) — sub-national granularity reduces over-generalization ("all of Mexico is dangerous" vs "Sinaloa: 2/10, Cancun: 7/10").
**Research flag:** NEEDS RESEARCH — sub-national data sources (ACLED geocoded events at region level, sub-national indices), regional GeoJSON boundaries and how to merge with country pages, performance implications of adding 1K+ region polygons to Leaflet (may require upgrade to MapLibre GL JS with vector tiles).

### Phase 6: v2+ — Future Consideration

**Rationale:** Features that require product-market fit validation before committing to the implementation effort.
**Delivers:** City-level pages (for major cities with available data), interactive weight adjustment sliders, additional languages (Spanish, French, German based on analytics), RSS/API for score data, embeddable map widget.
**Research flag:** NEEDS RESEARCH at planning time — city-level data sourcing, MapLibre GL JS migration for vector tile support at city scale, on-demand rendering for 40K+ city pages.

### Phase Ordering Rationale

- **Phase 0 before all code:** Data source verification is the most common failure mode for this type of project. One week of verification prevents months of rework.
- **Scoring engine before frontend:** The map and detail pages are meaningless without real scored data. Mocking scores creates false confidence.
- **i18n from Phase 1:** URL structure changes after launch are catastrophic for SEO. The cost of adding i18n routing later (broken links, 3-6 months of SEO recovery) vastly exceeds the cost of adding it upfront.
- **SEO as its own phase before launch:** SEO is not polish; it is the primary acquisition channel for a zero-budget product. Thin content penalties take months to recover from.
- **Regional drill-down after launch validation:** Sub-national data is the hardest engineering problem. Deferring it until v1.x lets the core product prove value before taking on that complexity.

### Research Flags

Phases needing deeper research during planning:
- **Phase 0:** Data source verification — ACLED free tier granularity, GPI CSV format, INFORM API auth, government advisory machine-readable formats
- **Phase 2:** Scoring normalization edge cases, missing data handling, ACLED data structure for free tier users
- **Phase 4:** Astro + Cloudflare Workers deployment via @opennextjs/cloudflare — integration is newer and documentation has gaps
- **Phase 5:** Sub-national data sources and regional GeoJSON; Leaflet vs MapLibre GL JS decision threshold for regional zoom performance

Phases with standard patterns (skip research-phase):
- **Phase 1:** Astro i18n routing and Leaflet choropleth — official tutorials cover both completely
- **Phase 3:** Astro content collections from JSON, shadcn/ui, Leaflet click navigation — well-documented
- **Phase 6:** Defer research until phase planning

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Framework conflict between STACK.md (Next.js) and ARCHITECTURE.md (Astro) resolved in favor of Astro; versions verified via web search as of 2026-03-19; @opennextjs/cloudflare integration is newer and less battle-tested |
| Features | HIGH | Grounded in direct competitor analysis across 5 platforms; feature expectations well-established; MVP scope is realistic |
| Architecture | HIGH | Data pipeline + static site pattern is well-established; component boundaries are clear; scalability thresholds are explicitly documented |
| Pitfalls | HIGH | Most pitfalls verified through multiple sources and real-world examples; legal and political risks are qualitative but well-supported |

**Overall confidence:** HIGH

### Gaps to Address

- **ACLED free tier actual granularity:** The research flags that free myACLED may give only aggregated dashboards, not event-level data. This must be verified in Phase 0 before designing the conflict pillar of the scoring engine. Fallback: use INFORM's conflict sub-score, which is available at country level.
- **Framework choice:** The roadmap should explicitly call for an Astro implementation, reconciling the Next.js recommendation in STACK.md. If the team has a strong existing Next.js preference, ARCHITECTURE.md's case for Astro must be re-evaluated and the map component's SSR-exclusion pattern (Next.js requires `dynamic(() => import(...), { ssr: false })`) must be verified as sufficient.
- **Government advisory machine-readable access:** US State Dept and UK FCDO have machine-readable formats, but specifics need verification. Italian Farnesina advisory format is unverified — scraping may be required.
- **Scoring weight validation:** The proposed weights (Conflict 0.30, Crime 0.25, Health 0.20, Governance 0.15, Environment 0.10) are grounded in expert indices but not empirically validated for traveler relevance specifically. Build in a configuration file and methodology changelog from the start; expect to adjust weights based on feedback.

## Sources

### Primary (HIGH confidence)
- [Next.js 16.2 Release Blog](https://nextjs.org/blog/next-16-2) — Next.js versions and ISR
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) — Tailwind v4 features
- [Astro Content Collections docs](https://docs.astro.build/en/guides/content-collections/) — Astro architecture
- [Astro i18n Routing docs](https://docs.astro.build/en/guides/internationalization/) — multilingual routing
- [Leaflet Choropleth Tutorial](https://leafletjs.com/examples/choropleth/) — map implementation
- [next-intl Official Docs](https://next-intl.dev/docs/getting-started/app-router) — i18n library
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) — hosting cost
- [Vercel Hobby Plan (commercial use prohibited)](https://vercel.com/docs/plans/hobby) — why not Vercel
- [OpenNext for Cloudflare](https://opennext.js.org/cloudflare) — deployment adapter
- [INFORM Risk Index Portal](https://drmkc.jrc.ec.europa.eu/inform-index) — primary data source
- [Natural Earth Data](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/) — GeoJSON boundaries

### Secondary (MEDIUM confidence)
- [TravelSafe-Abroad](https://www.travelsafe-abroad.com/countries/) — competitor feature analysis
- [SafeTravy Maps](https://www.safetravy.com/maps/travel-and-maps) — competitor analysis
- [GeoSure](https://geosure.ai) — competitor analysis (neighborhood-level scores)
- [Healix Risk Map 2026](https://healix.com/international/reports/risk-radar-26/risk-map-2026) — competitor analysis
- [HelloSafe Safety Index](https://hellosafe.com/travel-insurance/safest-countries-in-the-world) — methodology transparency model
- [ACLED API Documentation](https://acleddata.com/acled-api-documentation) — conflict data source
- [ACLED myACLED FAQs](https://acleddata.com/myacled-faqs) — free tier access details
- [MapLibre vs Leaflet Comparison](https://blog.jawg.io/maplibre-gl-vs-leaflet-choosing-the-right-tool-for-your-interactive-map/) — map library selection
- [Hreflang Common Mistakes](https://434group.com/blog/hreflang-cok-dilli-seo.php?lang=en) — i18n SEO pitfalls
- [Baymard Institute Travel UX](https://baymard.com/blog/travel-site-ux-best-practices) — mobile UX requirements

### Tertiary (LOW confidence — needs validation)
- [Global Peace Index Data on Kaggle](https://www.kaggle.com/datasets/ddosad/global-peace-index-2023) — GPI annual CSV format (needs direct access verification)
- [ICRG Methodology](https://www.prsgroup.com/wp-content/uploads/2012/11/icrgmethodology.pdf) — composite risk scoring methodology limitations

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
