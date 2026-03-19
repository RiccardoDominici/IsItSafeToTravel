# IsItSafeToTravel

**Data-driven safety scores for every country in the world.**

[![Live Site](https://img.shields.io/badge/live-isitsafetotravels.com-0ea5e9)](https://isitsafetotravels.com)
[![Built with Astro](https://img.shields.io/badge/Astro-6-ff5d01?logo=astro&logoColor=white)](https://astro.build)
[![Styled with Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Deployed on Cloudflare](https://img.shields.io/badge/Cloudflare_Pages-f38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

---

## What It Does

IsItSafeToTravel combines multiple public safety indices -- conflict data, governance quality, health risks, crime indicators, and environmental hazards -- into a single 1--10 safety score for **248 countries**. Scores are recomputed daily by an automated pipeline and displayed on an interactive world map with country detail pages, historical trend charts, and a side-by-side comparison tool.

## Features

- **Interactive world map** -- Color-coded by safety score with hover tooltips and click-through to country pages.
- **Country detail pages** -- Full score breakdown by pillar, individual indicator analysis, and historical trend chart.
- **Global safety score** -- Arithmetic mean across all countries, serving as a world benchmark on a dedicated page.
- **Country comparison** -- Select up to 5 countries for side-by-side cards, pillar bar charts, overlay trend lines, and shareable URLs.
- **Historical trends** -- 14+ years of data from World Bank WGI with interactive tooltips; daily snapshots accumulate over time.
- **Search** -- Fuzzy search across all 248 countries powered by Fuse.js.
- **Multilingual** -- English and Italian, with locale-prefixed routing and i18n-aware sitemap.
- **SEO optimized** -- JSON-LD structured data, meta tags, and auto-generated sitemap for every page.

## Data Sources

| Source | Covers | Provider |
|--------|--------|----------|
| World Bank WGI | Governance, political stability, rule of law, corruption, health, environment | World Bank |
| INFORM Risk Index | Natural hazards, epidemics, conflict probability, governance | EU Joint Research Centre (JRC) |
| US State Department | Travel advisory levels (1--4) | US Department of State |
| UK FCDO | Travel advisory levels | UK Foreign, Commonwealth & Development Office |
| Global Peace Index | Overall peacefulness, safety & security, militarisation | Institute for Economics & Peace (configured, pending URL update) |
| ACLED | Conflict events and fatalities | Armed Conflict Location & Event Data (requires API key) |

All sources are free and publicly available. The pipeline fetches them in parallel using `Promise.allSettled`, so a single source failure does not block the others.

## Scoring Methodology

Each country's safety score is computed from **5 pillars**, each a weighted average of its underlying indicators:

| Pillar | Weight | Key Indicators |
|--------|--------|----------------|
| Conflict | 25% | Political stability, GPI scores, ACLED events/fatalities |
| Crime | 20% | Rule of law, US & UK advisory levels |
| Health | 20% | Child mortality, INFORM health & epidemic risk |
| Governance | 20% | Government effectiveness, corruption control, INFORM governance |
| Environment | 15% | Air pollution, natural hazard risk, climate risk |

Raw indicator values are normalized to a 0--1 scale (higher = safer) using known min/max ranges, then aggregated into the final 1--10 score.

For full details, see the [Methodology page](https://isitsafetotravels.com/en/methodology/) on the live site.

## Tech Stack

| Tool | Role |
|------|------|
| [Astro 6](https://astro.build) | Static site generation (SSG) |
| [D3.js](https://d3js.org) | World map rendering and trend charts |
| [Tailwind CSS 4](https://tailwindcss.com) | Styling |
| [TypeScript](https://www.typescriptlang.org) | Type safety across the entire codebase |
| [Cloudflare Pages](https://pages.cloudflare.com) | Hosting and deployment |
| [Fuse.js](https://www.fusejs.io) | Client-side fuzzy search |

## Getting Started

### Prerequisites

- Node.js 20+ (22 recommended)
- npm

### Install and run

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Production build
npm run build

# Preview the production build locally
npm run preview
```

### Run the data pipeline

```bash
# Fetch latest data and recompute scores (uses today's date)
npx tsx src/pipeline/run.ts

# Fetch data for a specific date
npx tsx src/pipeline/run.ts 2026-03-20
```

ACLED data requires the `ACLED_API_KEY` and `ACLED_EMAIL` environment variables to be set.

## Project Structure

```
src/
  pages/          Astro pages (EN + IT locale routing)
  components/     Reusable Astro and client-side components
  pipeline/       Data fetchers, scoring engine, and config
    fetchers/     One module per data source
    scoring/      Normalization, pillar aggregation, engine
    config/       weights.json and indicator definitions
  lib/            Shared utilities (scores, colors, SEO helpers)
  i18n/           Translation strings (en, it)
data/
  scores/         Historical score snapshots + latest.json
  raw/            Raw fetched data (gitignored where appropriate)
public/           Static assets (map topojson, scores.json, images)
.github/
  workflows/      CI/CD: deploy.yml + data-pipeline.yml
.planning/        GSD planning documents
```

## Daily Pipeline

A GitHub Actions workflow (`data-pipeline.yml`) runs every day at **06:00 UTC**:

1. Checks out the repository.
2. Installs dependencies with `npm ci`.
3. Runs `npx tsx src/pipeline/run.ts` to fetch all data sources in parallel.
4. Validates that `data/scores/latest.json` was produced.
5. Copies scores to `public/scores.json` for the frontend.
6. Commits and pushes any data changes, which triggers a Cloudflare Pages redeploy.

The workflow can also be triggered manually from the GitHub Actions UI with an optional date override.

## License

This project does not currently include a LICENSE file. All rights reserved by the author unless otherwise specified.
