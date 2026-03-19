# Architecture Patterns

**Domain:** Travel safety information platform
**Researched:** 2026-03-19

## Recommended Architecture

The system is a **data pipeline feeding a static site generator**, with a single interactive component (the map). This is not a traditional web application -- it is closer to a publishing system that happens to have one rich widget.

```
                        +-------------------+
                        |  External Sources  |
                        |  (APIs / CSV / RSS)|
                        +--------+----------+
                                 |
                          [1] INGEST (daily cron)
                                 |
                        +--------v----------+
                        |  Raw Data Store   |
                        |  (JSON files/git) |
                        +--------+----------+
                                 |
                          [2] TRANSFORM & SCORE
                                 |
                        +--------v----------+
                        |  Scored Data Store |
                        |  (JSON per country)|
                        +--------+----------+
                                 |
                     +-----------+-----------+
                     |                       |
              [3] GENERATE SITE        [4] GENERATE MAP DATA
                     |                       |
              +------v-------+       +-------v--------+
              | Astro SSG    |       | GeoJSON +      |
              | HTML pages   |       | score overlay  |
              | per locale   |       +-------+--------+
              +------+-------+               |
                     |                       |
                     +----------+------------+
                                |
                         [5] DEPLOY (CDN)
                                |
                        +-------v--------+
                        |  Cloudflare    |
                        |  Pages / CF    |
                        +----------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Technology |
|-----------|---------------|-------------------|------------|
| **Data Ingester** | Fetches raw data from external APIs/CSV/RSS on a daily schedule | Raw Data Store | Node.js scripts, GitHub Actions cron |
| **Raw Data Store** | Stores fetched data in version-controlled JSON files | Scoring Engine | JSON files in git repo |
| **Scoring Engine** | Normalizes indicators, applies weights, computes 1-10 scores per destination | Scored Data Store | Node.js/TypeScript module |
| **Scored Data Store** | Structured JSON per country/region with scores, breakdowns, metadata | Site Generator, Map Data Generator | JSON files in `data/scored/` |
| **Site Generator** | Builds static HTML pages per destination per locale | CDN | Astro SSG with content collections |
| **Map Data Generator** | Merges scored data into GeoJSON for choropleth rendering | CDN | Node.js script, Natural Earth GeoJSON |
| **Map Widget** | Client-side interactive choropleth map with zoom, click, search | Site Generator (embedded as Astro island) | Leaflet or MapLibre GL JS |
| **CDN / Host** | Serves static files globally with edge caching | End users | Cloudflare Pages (free tier) |

### Data Flow

**Daily pipeline (automated via GitHub Actions cron):**

1. **Ingest** -- Cron triggers scripts that fetch data from each source (INFORM Risk Index CSV, Global Peace Index data, ACLED API, WHO health data, government advisory RSS feeds). Each source has its own fetcher module. Raw responses are saved as timestamped JSON/CSV in `data/raw/`.

2. **Transform & Score** -- A single scoring script reads all raw data, normalizes each indicator to a 0-1 scale, applies weighted aggregation across five pillars (conflict, governance, crime, health, environment), and produces a composite 1-10 score per destination. Output: one JSON file per country in `data/scored/{iso3}.json` containing the score, pillar breakdown, source citations, and last-updated timestamp.

3. **Generate Site** -- Astro reads scored JSON via content collections' `file()` loader. Using `getStaticPaths()`, it generates one detail page per destination per locale. Pages include: score display, pillar breakdown chart, source citations, and structured data (JSON-LD) for SEO.

4. **Generate Map Data** -- A script merges scored data into Natural Earth GeoJSON boundaries, producing a single `world-scores.geojson` file with ISO codes, scores, and color values baked in. This file is optimized (simplified geometries, TopoJSON compression) to stay under 500KB.

5. **Deploy** -- `astro build` output is deployed to Cloudflare Pages. The GeoJSON and map assets are part of the static output. Zero server-side runtime needed.

**User request flow:**

1. User hits homepage -- static HTML loads instantly from CDN edge.
2. Map widget (Astro island) hydrates client-side, fetches `world-scores.geojson` (cached by CDN).
3. User clicks a country -- client-side routing navigates to `/en/country/{slug}` (pre-built static page).
4. Detail page shows score breakdown, all pre-rendered at build time.

## Key Architecture Decisions

### Why Astro (not Next.js)

Astro is the right framework because this is a content-heavy, mostly-static site with one interactive widget:

- **Zero JS by default** -- detail pages ship no JavaScript, maximizing Lighthouse scores.
- **Islands architecture** -- the map is the only interactive component; it hydrates independently without bloating every page.
- **Native i18n routing** -- built-in support for `/en/`, `/it/` locale prefixes with fallback configuration.
- **Content collections from JSON** -- the `file()` loader reads scored JSON directly at build time with type safety.
- **Build performance** -- generates thousands of static pages efficiently.

Next.js would add unnecessary complexity (React runtime on every page, SSR infrastructure) for what is fundamentally a publishing problem.

**Confidence:** HIGH (verified via Astro docs and multiple comparisons)

### Why JSON Files in Git (not a database)

For ~200 countries and ~1000 sub-regions, the total data volume is tiny (< 5MB). A database adds cost, complexity, and a runtime dependency. JSON files in git provide:

- **Free storage** -- no database hosting costs.
- **Version history** -- every data change is tracked via git commits.
- **No runtime dependency** -- all data is consumed at build time.
- **Easy debugging** -- scores are human-readable files you can inspect.
- **Atomic updates** -- a pipeline run commits new data, triggers rebuild.

**Confidence:** HIGH (this is a well-established pattern for data-driven static sites)

### Why Leaflet (not MapLibre GL JS)

For a choropleth world map with click-to-navigate behavior:

- **Leaflet** is lighter (~40KB), simpler API, excellent choropleth tutorial/docs, SVG rendering sufficient for country-level polygons.
- **MapLibre GL JS** is heavier (~200KB+), WebGL-based, better for vector tiles and smooth zooming but overkill for a country-level choropleth.

Leaflet with GeoJSON overlay is the simplest path to a color-coded world map that responds to clicks. If sub-regional drill-down requires smooth vector tile zooming later, MapLibre can replace it.

**Confidence:** MEDIUM (Leaflet is simpler for v1, but MapLibre may be needed for regional zoom -- revisit in later phase)

### Why GitHub Actions for Pipeline (not a server)

- **Free** -- GitHub Actions provides 2000 minutes/month on free tier.
- **Scheduled** -- native cron syntax for daily triggers.
- **No server** -- no VPS to maintain, no uptime concerns.
- **Pipeline as code** -- the workflow YAML is versioned alongside the data scripts.

A single daily Action: fetch data, run scoring, build site, deploy. Total runtime estimate: 3-5 minutes.

**Confidence:** HIGH

## Scoring Engine Architecture

### Pillar Structure

The safety score uses a hierarchical weighted aggregation model (consistent with how INFORM Risk Index and HelloSafe Safety Index work):

```
Overall Score (1-10)
  |-- Conflict & Security (weight: 0.30)
  |     |-- Armed conflict intensity (ACLED)
  |     |-- Political stability (World Bank WGI)
  |     |-- Terrorism risk (Global Terrorism Index)
  |
  |-- Crime & Personal Safety (weight: 0.25)
  |     |-- Homicide rate (UNODC)
  |     |-- Theft/robbery rates (where available)
  |     |-- Government advisory level (US State Dept, UK FCDO)
  |
  |-- Health Risks (weight: 0.20)
  |     |-- Disease outbreak risk (WHO)
  |     |-- Healthcare quality (WHO UHC index)
  |     |-- Required vaccinations count
  |
  |-- Governance & Rule of Law (weight: 0.15)
  |     |-- Rule of law index (World Bank WGI)
  |     |-- Corruption perception (Transparency International CPI)
  |
  |-- Natural Disaster & Environment (weight: 0.10)
        |-- Natural hazard exposure (INFORM)
        |-- Climate-related risk
```

### Normalization Algorithm

```typescript
// Each raw indicator is normalized to 0-1 scale
function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// Pillar score = weighted average of normalized indicators within pillar
// Overall score = weighted average of pillar scores, mapped to 1-10
function computeOverallScore(pillars: PillarScore[]): number {
  const weightedSum = pillars.reduce(
    (sum, p) => sum + p.score * p.weight, 0
  );
  return Math.round(weightedSum * 9 + 1); // Maps 0-1 to 1-10
}
```

### Data File Structure

```
data/
  raw/                          # Fetched from APIs (gitignored or LFS)
    acled/2026-03-19.json
    inform/2026-03-19.csv
    gpi/2026.json
    who/2026-03-19.json
    advisories/us-state-dept.json
  scored/                       # Computed scores (committed to git)
    AFG.json                    # Afghanistan
    FRA.json                    # France
    ...
  geo/
    world-scores.geojson        # Merged boundaries + scores
    world-scores.topojson        # Compressed version
  meta/
    sources.json                # Source metadata, URLs, update dates
    weights.json                # Current weight configuration
```

Each scored file (`scored/FRA.json`):

```json
{
  "iso3": "FRA",
  "name": { "en": "France", "it": "Francia" },
  "score": 8.2,
  "pillars": {
    "conflict": { "score": 0.85, "weight": 0.30, "indicators": [...] },
    "crime": { "score": 0.78, "weight": 0.25, "indicators": [...] },
    "health": { "score": 0.92, "weight": 0.20, "indicators": [...] },
    "governance": { "score": 0.88, "weight": 0.15, "indicators": [...] },
    "environment": { "score": 0.70, "weight": 0.10, "indicators": [...] }
  },
  "advisories": {
    "us": { "level": 2, "text": "Exercise increased caution" },
    "uk": { "level": "normal", "text": "..." }
  },
  "lastUpdated": "2026-03-19T06:00:00Z",
  "sources": [
    { "name": "ACLED", "url": "...", "fetchedAt": "..." }
  ]
}
```

## Astro Site Structure

```
src/
  pages/
    index.astro                     # Homepage with map
    [locale]/
      index.astro                   # Localized homepage
      country/
        [slug].astro                # Detail page (getStaticPaths from scored JSON)
      region/
        [country]/[slug].astro      # Sub-region detail (phase 2+)
      about.astro
      methodology.astro
  components/
    Map.tsx                         # Leaflet map (React island, client:visible)
    ScoreCard.astro                 # Score display component (static)
    PillarBreakdown.astro           # Pillar chart (static, CSS-only or SVG)
    SearchBar.tsx                   # Search widget (React island, client:idle)
    LanguageSwitcher.astro          # Locale toggle (static with links)
  content/
    config.ts                       # Content collection definitions
  layouts/
    Base.astro                      # HTML shell, meta, structured data
    Country.astro                   # Detail page layout
  i18n/
    en.json                         # UI string translations
    it.json
  styles/
    global.css                      # Design tokens, base styles
```

### Astro Islands Strategy

Only two components need client-side JavaScript:

| Component | Hydration Directive | Rationale |
|-----------|-------------------|-----------|
| `Map.tsx` | `client:visible` | Only hydrate when scrolled into view; heavyweight Leaflet bundle (~40KB) |
| `SearchBar.tsx` | `client:idle` | Hydrate after page idle; needs JS for autocomplete/filtering |

Everything else (score cards, pillar breakdowns, navigation, language switcher) is **static HTML** with zero JavaScript.

## Patterns to Follow

### Pattern 1: Pipeline as Idempotent Script
**What:** Each pipeline stage is a standalone script that reads input files and writes output files. Running it twice with the same input produces the same output.
**When:** Always -- this is the core architecture.
**Why:** Makes debugging trivial. You can re-run any stage independently. Failed runs leave no corrupt state.

```typescript
// scripts/ingest-acled.ts
// Input: ACLED API credentials, date range
// Output: data/raw/acled/{date}.json
// Idempotent: same date always fetches same data

// scripts/compute-scores.ts
// Input: data/raw/*
// Output: data/scored/*.json
// Idempotent: same raw data always produces same scores
```

### Pattern 2: Scored Data as the Single Source of Truth
**What:** The scored JSON files are the contract between the pipeline and the frontend. Nothing else feeds the site generator.
**When:** Always.
**Why:** Clear boundary. The pipeline team and the frontend team (even if it is one person) have a stable interface.

### Pattern 3: GeoJSON Pre-computation
**What:** Merge scores into GeoJSON at build time, not at runtime. The map widget receives a single file with everything it needs.
**When:** Always for the choropleth layer.
**Why:** Eliminates client-side data joining. The GeoJSON file includes `score`, `color`, `name`, and `slug` per feature -- the map just renders and links.

### Pattern 4: SEO-First Page Generation
**What:** Every destination page is a full static HTML page with meta tags, Open Graph, JSON-LD structured data, canonical URLs per locale, and a complete sitemap.
**When:** Every build.
**Why:** Search traffic is the primary acquisition channel for a zero-budget informational site.

```typescript
// JSON-LD structured data for each country page
{
  "@context": "https://schema.org",
  "@type": "Place",
  "name": "France",
  "description": "France safety score: 8.2/10...",
  "additionalProperty": {
    "@type": "PropertyValue",
    "name": "Safety Score",
    "value": "8.2"
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Data Fetching for Scores
**What:** Fetching score data via API calls from the browser.
**Why bad:** Adds latency, requires a runtime API server (cost), breaks SEO (content not in HTML), creates a single point of failure.
**Instead:** Pre-render all score data into static HTML at build time.

### Anti-Pattern 2: Single Monolithic GeoJSON
**What:** Shipping high-resolution (10m scale) Natural Earth data to every user.
**Why bad:** Natural Earth 10m countries GeoJSON is ~24MB. Even simplified, it can be several MB. Mobile users on poor connections will suffer.
**Instead:** Use 110m or 50m resolution for the world view (~500KB-1MB). Simplify geometries with mapshaper. Use TopoJSON compression. Lazy-load higher resolution only on zoom.

### Anti-Pattern 3: Over-Engineering the Score Formula
**What:** Building a complex ML model or dynamic weighting system before validating the product.
**Why bad:** Users care about the output (clear safety signal), not the sophistication of the algorithm. A simple weighted average is transparent and debuggable.
**Instead:** Start with fixed weights, document them on the methodology page. Allow weight tuning via a config file. Add complexity only if user feedback demands it.

### Anti-Pattern 4: Database for 200 Records
**What:** Setting up PostgreSQL or MongoDB for country-level data.
**Why bad:** Adds hosting cost (~$0-15/month), operational complexity, and a runtime dependency -- all for a dataset that fits in a single JSON file.
**Instead:** JSON files in git. If the dataset grows to tens of thousands of records (city-level), consider SQLite as a build-time-only query engine.

## Scalability Considerations

| Concern | At 200 countries | At 2K sub-regions | At 20K cities |
|---------|-----------------|-------------------|---------------|
| Data storage | ~1MB JSON, trivial | ~10MB, still fine in git | ~100MB, consider git LFS or SQLite at build time |
| Build time | ~30s Astro build | ~2-3min, acceptable for daily builds | ~10-15min, may need incremental builds |
| GeoJSON size | ~500KB (50m res) | ~5MB, need tiling or lazy loading | Not feasible as single file, need vector tiles (MapLibre) |
| Map rendering | Leaflet fine | Leaflet still OK with clustering | Must switch to MapLibre + vector tiles |
| i18n pages | 200 x 2 locales = 400 pages | 2K x 2 = 4K pages, Astro handles this | 20K x 2 = 40K pages, may need on-demand rendering |
| Pipeline runtime | ~2min fetch + score | ~3min | ~10min, may hit GitHub Actions limits |

**Key threshold:** The architecture shifts at city-level granularity. The JSON-in-git + Leaflet + full-SSG approach works excellently for countries + sub-regions (up to ~2-5K destinations). Beyond that, introduce vector tiles (MapLibre), SQLite, and on-demand rendering.

## Suggested Build Order (Dependencies)

```
Phase 1: Foundation
  [A] Data schema design (scored JSON format)      -- no dependencies
  [B] Astro project scaffold + i18n setup           -- no dependencies
  [C] Leaflet map component prototype               -- no dependencies
  A, B, C can be built in parallel.

Phase 2: Pipeline
  [D] Source fetchers (one per data source)          -- depends on A (schema)
  [E] Scoring engine                                 -- depends on A (schema) + D (raw data)
  [F] GeoJSON merger                                 -- depends on A (schema) + E (scored data)

Phase 3: Frontend
  [G] Homepage + map integration                     -- depends on B + C + F
  [H] Country detail pages from content collections  -- depends on B + E
  [I] Search functionality                           -- depends on H (needs page slugs)

Phase 4: Polish & SEO
  [J] Structured data / JSON-LD                      -- depends on H
  [K] Sitemap generation                             -- depends on H
  [L] Methodology / about pages                      -- depends on B

Phase 5: Automation
  [M] GitHub Actions daily cron pipeline             -- depends on D + E + F
  [N] Deploy to Cloudflare Pages                     -- depends on G + H
  [O] Monitoring (build failure alerts)              -- depends on M + N
```

**Critical path:** A -> D -> E -> F -> G (data schema through to working map). The detail pages (H) can proceed in parallel once the schema (A) and Astro scaffold (B) exist.

## Sources

- [Astro Content Collections docs](https://docs.astro.build/en/guides/content-collections/)
- [Astro i18n Routing docs](https://docs.astro.build/en/guides/internationalization/)
- [Leaflet Choropleth Tutorial](https://leafletjs.com/examples/choropleth/)
- [Natural Earth Data - Country Boundaries](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/)
- [INFORM Risk Index on HDX](https://data.humdata.org/organization/inform)
- [ACLED API Documentation](https://acleddata.com/acled-api-documentation)
- [Global Peace Index](https://www.economicsandpeace.org/global-peace-index/)
- [HelloSafe Safety Index Methodology](https://hellosafe.com/travel-insurance/safest-countries-in-the-world)
- [Building Static Websites from JSON with Astro](https://dev.solita.fi/2024/12/02/building-static-websites-with-astro.html)
- [Natural Earth GeoJSON on GitHub](https://github.com/martynafford/natural-earth-geojson)
- [Astro Islands Architecture](https://strapi.io/blog/astro-islands-architecture-explained-complete-guide)
- [Astro vs Next.js Comparison (2026)](https://pagepro.co/blog/astro-nextjs/)
