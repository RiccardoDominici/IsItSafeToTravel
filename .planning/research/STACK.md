# Technology Stack

**Project:** IsItSafeToTravel.com
**Researched:** 2026-03-19

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | 16.2 | Full-stack React framework | Current stable. Turbopack default (5x faster builds). SSG + ISR for daily data refreshes. App Router with React Server Components for SEO. Partial Pre-rendering for map pages (static shell + dynamic map). next-intl has confirmed Next.js 16 support. | HIGH |
| React | 19.2 | UI library | Ships with Next.js 16. React Compiler (stable) auto-memoizes components. View Transitions API for smooth page navigation. | HIGH |
| TypeScript | 5.x | Type safety | Non-negotiable for data-heavy project. Catches score calculation bugs at compile time. Next.js 16 has first-class TS support. | HIGH |

### Styling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | 4.2 | Utility-first CSS | CSS-first config (no tailwind.config.js). 5x faster full builds. Container queries built-in (useful for responsive map panels). OKLCH color space ideal for safety score gradients (perceptually uniform green-to-red). | HIGH |
| shadcn/ui | latest | Component library | Not a dependency -- copies components into your project. Full Tailwind v4 + React 19 support. Accessible (WCAG AA). Only add what you use = minimal bundle. | HIGH |

### Interactive Map

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Leaflet | 1.9.x | Map rendering engine | 42KB, zero dependencies, 1.4M+ weekly npm downloads. Best documented map library. Handles choropleth (color-coded countries) natively with GeoJSON. Works with free OSM raster tiles -- no API key needed. | HIGH |
| react-leaflet | 5.0 | React bindings for Leaflet | Peer dependency on React 19. Requires `dynamic(() => import(...), { ssr: false })` in Next.js -- Leaflet needs DOM. Well-documented SSR workaround pattern. | MEDIUM |
| OpenStreetMap tiles | - | Base map tiles | Completely free, no API key, no account. Fair use policy (not rate-limited for reasonable traffic). For a travel info site with ~200 country polygons, raster tiles are sufficient. | HIGH |

**Why NOT MapLibre GL:** Vector tiles look nicer but require a tile server or paid provider. OpenFreeMap exists but is a single-maintainer project -- risky dependency for production. Leaflet + OSM raster tiles = zero cost, zero risk, proven at scale.

**Why NOT Google Maps / Mapbox:** Both require API keys and charge after free tier. Budget constraint eliminates them.

### Internationalization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| next-intl | 4.x | i18n framework | 931K weekly downloads. Built for App Router + Server Components. ~2KB bundle. Static rendering support via `setRequestLocale()` + `generateStaticParams()`. Locale-based routing (`/en/country/italy`, `/it/paese/italia`). TypeScript-safe message keys. | HIGH |

**Why NOT next-i18next:** Not compatible with the App Router. Flat/declining adoption since 2024. next-intl is the clear community standard for modern Next.js.

**Why NOT Intlayer:** Newer entrant, smaller community, less battle-tested. next-intl has 4x more downloads.

### Data Pipeline

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| GitHub Actions | - | Cron-based automation | 2,000 free minutes/month on private repos. Unlimited on public repos. Cron schedule syntax (`0 6 * * *` for daily at 6am UTC). No server needed. Runs Node.js/Python scripts. | HIGH |
| Node.js scripts | 22.x LTS | Data fetching + processing | Same language as the app. Fetch APIs, parse CSV/JSON, compute safety scores, write output to repo. Can use `fetch()` natively. | HIGH |
| JSON files in repo | - | Data storage | No database needed. Daily pipeline writes computed scores to `/data/scores.json` and per-country files. Next.js reads at build time. Git provides version history of all score changes for free. | HIGH |

**Why NOT a database:** The data changes once per day, for ~200 countries. This is ~50KB of JSON. A database adds complexity, cost, and a runtime dependency. JSON files committed to the repo are simpler, free, version-controlled, and work perfectly with static generation.

**Why NOT Cloudflare D1 / KV:** Would work, but adds platform lock-in and complexity. JSON-in-repo is the simplest possible solution for daily-updated reference data. Upgrade to D1 later only if sub-national regions push data size beyond what's practical in files.

### Hosting & Deployment

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Cloudflare Workers | - | Hosting (primary recommendation) | **Unlimited free bandwidth.** No commercial use restriction. 100K requests/day free. Global edge network. Next.js 16 supported via OpenNext adapter (`@opennextjs/cloudflare`). ISR works on Workers (unlike static export). | HIGH |
| GitHub | - | Source code + CI/CD | Free for public repos. GitHub Actions for data pipeline. | HIGH |

**Why NOT Vercel (free tier):** Vercel Hobby plan **prohibits commercial use**. Even an ad-free informational site that might later monetize would violate ToS. Pro plan is $20/month -- exceeds budget. Cloudflare Workers has no such restriction and offers unlimited bandwidth.

**Why NOT pure static export (`output: 'export'`):** Loses ISR capability. With daily data updates, you want ISR so pages revalidate without full rebuilds. Static export means every data update = full site rebuild of 200+ country pages x N locales. ISR on Cloudflare Workers handles this gracefully.

**Why NOT Netlify:** Free tier limited to 100GB bandwidth. Cloudflare is unlimited. Netlify's Next.js support has historically lagged behind Vercel and Cloudflare.

### SEO & Structured Data

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js Metadata API | built-in | Meta tags, Open Graph | App Router `generateMetadata()` per page. Dynamic titles per country/locale. No extra library needed. | HIGH |
| next-sitemap | 4.x | Sitemap generation | Generates sitemap.xml and robots.txt. Handles multilingual alternate URLs (`hreflang`). Works with ISR. | MEDIUM |
| JSON-LD | built-in | Structured data | Embed `<script type="application/ld+json">` in country pages. Use `Place`, `Country`, `WebPage` schemas. No library needed -- just TypeScript objects serialized to JSON. | HIGH |

### Data Sources (Free/Open Access)

| Source | Access | Data Provided | Update Frequency | Confidence |
|--------|--------|---------------|-------------------|------------|
| INFORM Risk Index | Open download (CSV/API) | Composite risk scores, hazard/exposure/vulnerability for 191 countries | Annual (with mid-year updates) | HIGH |
| Global Peace Index | Open download (PDF/datasets) | Peace scores for 163 countries across 23 indicators | Annual (June) | HIGH |
| ACLED | Free API (requires registration) | Conflict event data, geo-located | Daily/weekly | MEDIUM |
| World Bank WGI | Open API | Governance indicators (6 dimensions) for 200+ economies | Annual | HIGH |
| WHO GHO | Open API | Health risk indicators per country | Varies by indicator | MEDIUM |
| Government Travel Advisories | Scraping / RSS | US State Dept, UK FCDO, Italian Farnesina advisory levels | As issued | MEDIUM |
| Natural Earth | Open download | GeoJSON country/region boundaries for the map | Static (geographic data) | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | Schema validation | Validate API responses from data sources. Validate computed score shapes. |
| date-fns | 4.x | Date formatting | Format "last updated" dates per locale. Lightweight vs. moment/dayjs. |
| papaparse | 5.x | CSV parsing | Parse CSV data from INFORM, GPI downloads in the pipeline. |
| sharp | 0.33.x | Image optimization | Next.js image optimization. Auto-installed by Next.js. |
| @vercel/og | latest | OG image generation | Dynamic social share images per country ("Italy: Safety Score 7.2"). |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 16 | Astro 5 | Astro is great for static content but weaker for interactive features (map). Next.js handles the hybrid static + interactive pattern better. |
| Framework | Next.js 16 | Nuxt 4 | Vue ecosystem. Smaller community for map/i18n integrations. No strong reason to pick over Next.js for this use case. |
| Map | Leaflet | MapLibre GL | Requires tile server or paid provider for vector tiles. Overkill for country-level choropleth. |
| Map | Leaflet | deck.gl | WebGL-based, heavy. Designed for massive datasets (millions of points). We have ~200 polygons. |
| Styling | Tailwind CSS 4 | CSS Modules | More verbose. No design system. Tailwind's utility classes are faster for prototyping and responsive design. |
| Hosting | Cloudflare Workers | AWS Amplify | More complex setup. Free tier has lower limits. Not worth the complexity. |
| i18n | next-intl | Paraglide.js | Newer, less ecosystem support. next-intl is the proven choice. |
| Data storage | JSON in repo | SQLite (Turso) | Unnecessary complexity. Upgrade path exists if needed later. |

## Architecture Decision: Build + Deploy Flow

```
Daily Pipeline (GitHub Actions cron):
  1. Fetch data from INFORM, ACLED, WB, WHO APIs
  2. Parse, normalize, compute composite safety scores
  3. Write JSON files to /data/ directory
  4. Commit to repo
  5. Push triggers Cloudflare Workers deployment
  6. ISR revalidates country pages on next request

Development:
  next dev (Turbopack) -> localhost:3000

Production:
  next build -> @opennextjs/cloudflare -> Cloudflare Workers
```

## Installation

```bash
# Initialize project
npx create-next-app@latest isitsafetotravel --typescript --tailwind --app --turbopack

# Core dependencies
npm install next-intl react-leaflet leaflet zod date-fns

# Dev dependencies
npm install -D @types/leaflet @opennextjs/cloudflare next-sitemap papaparse @types/papaparse

# Data pipeline (can also be devDependencies)
npm install -D tsx  # For running TypeScript pipeline scripts
```

## Version Verification Status

| Technology | Stated Version | Verified Via | Verification Date |
|------------|---------------|--------------|-------------------|
| Next.js | 16.2 | WebSearch (nextjs.org/blog/next-16-2, March 18 2026) | 2026-03-19 |
| Tailwind CSS | 4.2 | WebSearch (github.com/tailwindlabs releases) | 2026-03-19 |
| react-leaflet | 5.0 | WebSearch (npm registry) | 2026-03-19 |
| next-intl | 4.x | WebSearch (next-intl.dev, confirmed Next.js 16 support) | 2026-03-19 |
| shadcn/ui | latest (copies, not versioned) | WebSearch (ui.shadcn.com Tailwind v4 docs) | 2026-03-19 |
| Leaflet | 1.9.x | WebSearch (leafletjs.com/download) | 2026-03-19 |

## Cost Analysis

| Service | Free Tier | Our Usage | Monthly Cost |
|---------|-----------|-----------|--------------|
| Cloudflare Workers | 100K requests/day, unlimited bandwidth | ~10K requests/day initially | $0 |
| GitHub (public repo) | Unlimited repos, unlimited Actions minutes | 1 repo, ~30 min/day pipeline | $0 |
| Domain (.com) | N/A | isitsafetotravel.com | ~$10/year (~0.83/month) |
| OpenStreetMap tiles | Fair use (free) | Map tile requests | $0 |
| ACLED API | Free registration | Daily fetch | $0 |
| INFORM / WB / WHO | Open data | Daily/weekly fetch | $0 |
| **Total** | | | **~0.83/month** |

Well within the 10 EUR/month budget. Domain is the only cost.

## Sources

- [Next.js 16.2 Release Blog](https://nextjs.org/blog/next-16-2)
- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16)
- [Next.js ISR Guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4)
- [shadcn/ui Tailwind v4 Docs](https://ui.shadcn.com/docs/tailwind-v4)
- [MapLibre vs Leaflet Comparison (jawg.io)](https://blog.jawg.io/maplibre-gl-vs-leaflet-choosing-the-right-tool-for-your-interactive-map/)
- [Map Libraries Popularity (geoapify.com)](https://www.geoapify.com/map-libraries-comparison-leaflet-vs-maplibre-gl-vs-openlayers-trends-and-statistics/)
- [next-intl Official Docs](https://next-intl.dev/docs/getting-started/app-router)
- [next-intl vs next-i18next (i18nexus)](https://i18nexus.com/posts/i18next-vs-next-intl)
- [GitHub Actions Billing](https://docs.github.com/en/actions/concepts/billing-and-usage)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Vercel Hobby Plan (commercial use prohibited)](https://vercel.com/docs/plans/hobby)
- [OpenNext for Cloudflare](https://opennext.js.org/cloudflare)
- [Vercel vs Netlify vs Cloudflare Pages 2025](https://www.digitalapplied.com/blog/vercel-vs-netlify-vs-cloudflare-pages-comparison)
- [react-leaflet npm](https://www.npmjs.com/package/react-leaflet)
- [ACLED API Documentation](https://acleddata.com/acled-api-documentation)
- [INFORM Risk Index](https://repository.gheli.harvard.edu/repository/12774/)
