# IsItSafeToTravel

**Data-driven safety scores for every country in the world.**

[![Live Site](https://img.shields.io/badge/live-isitsafetotravels.com-0ea5e9)](https://isitsafetotravels.com)
[![Built with Astro](https://img.shields.io/badge/Astro-6-ff5d01?logo=astro&logoColor=white)](https://astro.build)
[![Styled with Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Deployed on Cloudflare](https://img.shields.io/badge/Cloudflare_Pages-f38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

---

## What It Does

IsItSafeToTravel combines **9 public data sources** -- conflict data, governance quality, health risks, crime indicators, environmental hazards, and near-realtime crisis signals -- into a single 1--10 safety score for **248 countries**. Scores are recomputed daily by an automated pipeline using a tiered baseline+signal architecture, and displayed on an interactive world map with country detail pages, historical trend charts, and a side-by-side comparison tool.

## Features

- **Interactive world map** -- Color-coded by safety score with hover tooltips, per-pillar category filtering, and click-through to country pages.
- **Country detail pages** -- Full score breakdown by pillar, individual indicator analysis, and historical trend chart with drag-to-zoom.
- **Global safety score** -- Arithmetic mean across all countries, serving as a world benchmark on a dedicated page.
- **Country comparison** -- Select up to 5 countries for side-by-side cards, pillar bar charts, overlay trend lines, and shareable URLs.
- **Historical trends** -- 14+ years of data from World Bank WGI with interactive tooltips; daily snapshots accumulate over time.
- **Tiered scoring** -- Baseline annual indices (~70%) blended with near-realtime signal sources (up to 30%) with exponential freshness decay.
- **Search** -- Fuzzy search across all 248 countries powered by Fuse.js.
- **Multilingual** -- English, Italian, Spanish, French, and Portuguese, with locale-prefixed routing and i18n-aware sitemap.
- **SEO optimized** -- JSON-LD structured data, meta tags, and auto-generated sitemap for every page.

## Data Sources

| Source | Covers | Provider | Tier | Update Frequency |
|--------|--------|----------|------|-----------------|
| World Bank WGI | Governance, political stability, rule of law, corruption, health, environment | World Bank | Baseline | Annual |
| INFORM Risk Index | Natural hazards, epidemics, conflict probability, governance | EU Joint Research Centre (JRC) | Baseline | Quarterly |
| Global Peace Index | Overall peacefulness, safety & security, militarisation | Institute for Economics & Peace | Baseline | Annual |
| UCDP | Conflict events and fatalities | Uppsala Conflict Data Program | Signal | Annual |
| US State Department | Travel advisory levels (1--4) | US Department of State | Signal | Varies |
| UK FCDO | Travel advisory levels | UK Foreign, Commonwealth & Development Office | Signal | Varies |
| ReliefWeb | Active humanitarian disasters | UN OCHA | Signal | Daily |
| GDACS | Natural disaster alerts (earthquakes, floods, cyclones, volcanoes) | EU JRC / UN | Signal | Daily |
| GDELT Project | Media-derived instability signal | GDELT | Signal | Daily |
| WHO Disease Outbreak News | Active disease outbreaks | World Health Organization | Signal | Weekly |

All sources are free and publicly available. The pipeline fetches them in parallel using `Promise.allSettled`, so a single source failure does not block the others.

## Scoring Methodology

Each country's safety score is computed from **5 pillars** (weights from `src/pipeline/config/weights.json` v5.3.0):

| Pillar | Weight | Key Indicators |
|--------|--------|----------------|
| Conflict | 30% | Political stability, GPI scores, UCDP events/fatalities, GDELT instability |
| Crime | 25% | Rule of law, US & UK advisory levels |
| Health | 20% | Child mortality, INFORM health & epidemic risk, WHO active outbreaks |
| Governance | 15% | Government effectiveness, corruption control, INFORM governance |
| Environment | 10% | Air pollution, natural hazard risk, climate risk, ReliefWeb disasters, GDACS alerts |

### Baseline + Signal Tiering

The 9 data sources are split into two tiers (configured in `src/pipeline/config/source-tiers.json`):

- **Baseline sources** (World Bank, INFORM, GPI): Updated annually/quarterly. Provide stable, long-term structural indicators. Contribute ~70% of the score.
- **Signal sources** (UCDP, advisories, GDELT, ReliefWeb, GDACS, WHO DONs): Updated daily/weekly/annually. Capture emerging crises -- armed conflicts, natural disasters, disease outbreaks. Contribute up to 30% of the score.

Signal influence is capped at 30% (`maxSignalInfluence: 0.30`) so that volatile short-term data cannot dominate long-term structural indicators.

### Freshness Decay

Each source has a configurable half-life for exponential freshness decay (see `source-tiers.json`). Data that is one half-life old contributes 50% of its weight; at two half-lives, 25%; and so on. Beyond a source's `maxAgeDays`, stale data is dropped entirely.

| Source | Half-Life | Max Age |
|--------|-----------|---------|
| World Bank / INFORM / GPI | 365 days | 730 days |
| UCDP | 180 days | 730 days |
| ReliefWeb | 14 days | 60 days |
| Advisories / GDACS | 7 days | 30 days |
| GDELT | 3 days | 14 days |
| WHO DONs | 30 days | 90 days |

### Per-Indicator Sub-Weights

Indicators within a pillar are not equally averaged. Pillars with `indicatorWeights` in `weights.json` use explicit sub-weights (e.g., Conflict: wb_political_stability 17%, gpi_overall 17%, gdelt_instability 15%, etc.). Pillars without explicit weights use equal averaging.

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

All data sources are free and require no authentication (UCDP replaced ACLED as the conflict data provider).

## Project Structure

```
src/
  pages/          Astro pages (EN, IT, ES, FR, PT locale routing)
  components/     Reusable Astro and client-side components
  pipeline/       Data fetchers, scoring engine, and config
    fetchers/     One module per data source (9 fetchers)
    scoring/      Tiered baseline+signal engine with freshness decay
    config/       weights.json, source-tiers.json, countries, normalization
  lib/            Shared utilities (scores, colors, SEO helpers)
  i18n/           Translation strings (en, it, es, fr, pt)
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
3. Runs `npx tsx src/pipeline/run.ts` to fetch all 9 data sources in parallel.
4. Validates that `data/scores/latest.json` was produced.
5. Copies scores to `public/scores.json` for the frontend.
6. Commits and pushes any data changes, which triggers a Cloudflare Pages redeploy.

The workflow can also be triggered manually from the GitHub Actions UI with an optional date override.

## Adding a New Data Source

1. **Create fetcher**: Add a new module in `src/pipeline/fetchers/` that exports a fetch function returning normalized data.
2. **Register**: Import and add the fetcher to `src/pipeline/fetchers/index.ts`.
3. **Configure tier**: Add an entry to `src/pipeline/config/source-tiers.json` with `tier` (baseline or signal), `maxAgeDays`, and `decayHalfLifeDays`.
4. **Add indicators**: Add the new indicator(s) to the relevant pillar in `src/pipeline/config/weights.json`. If the pillar has `indicatorWeights`, add an explicit sub-weight.
5. **Normalization**: Add normalization ranges for the new indicator(s) in the scoring engine.
6. **Translations**: Add `methodology.source.*` and `methodology.indicator.*` keys in `src/i18n/ui.ts` for all 5 languages.
7. **Methodology page**: Add the source to the `dataSources` array in all 5 methodology page templates.

## License

This project does not currently include a LICENSE file. All rights reserved by the author unless otherwise specified.
