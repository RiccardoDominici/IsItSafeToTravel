# IsItSafeToTravel

**Data-driven safety scores for every country in the world.**

[![Live Site](https://img.shields.io/badge/live-isitsafetotravels.com-0ea5e9)](https://isitsafetotravels.com)
[![Built with Astro](https://img.shields.io/badge/Astro-6-ff5d01?logo=astro&logoColor=white)](https://astro.build)
[![Styled with Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Deployed on Cloudflare](https://img.shields.io/badge/Cloudflare_Pages-f38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

---

## What It Does

IsItSafeToTravel combines **7 public data sources** -- conflict data, governance quality, health risks, crime indicators, environmental hazards, and near-realtime crisis signals -- into a single 1--10 safety score for **248 countries**. Scores are recomputed daily by an automated pipeline using an uncertainty-weighted (Bayesian shrinkage) scoring formula, and displayed on an interactive world map with country detail pages, historical trend charts, and a side-by-side comparison tool.

## Features

- **Interactive world map** -- Color-coded by safety score with hover tooltips, per-pillar category filtering, and click-through to country pages.
- **Country detail pages** -- Full score breakdown by pillar, individual indicator analysis, and historical trend chart with drag-to-zoom.
- **Global safety score** -- Arithmetic mean across all countries, serving as a world benchmark on a dedicated page.
- **Country comparison** -- Select up to 5 countries for side-by-side cards, pillar bar charts, overlay trend lines, and shareable URLs.
- **Historical trends** -- 14+ years of data from World Bank WGI with interactive tooltips; daily snapshots accumulate over time.
- **Uncertainty-weighted scoring** -- Bayesian shrinkage blends each pillar's raw data toward a conservative regional prior based on how much fresh evidence backs it, with exponential freshness decay.
- **Search** -- Fuzzy search across all 248 countries powered by Fuse.js.
- **Multilingual** -- English, Italian, Spanish, French, and Portuguese, with locale-prefixed routing and i18n-aware sitemap.
- **SEO optimized** -- JSON-LD structured data, meta tags, and auto-generated sitemap for every page.

## Data Sources

| Source | Covers | Provider | Tier | Update Frequency |
|--------|--------|----------|------|-----------------|
| World Bank WGI | Governance, political stability, rule of law, corruption, health, environment | World Bank | Baseline | Annual |
| INFORM Risk Index | Natural hazards, epidemics, conflict probability, governance | EU Joint Research Centre (JRC) | Baseline | Quarterly |
| Global Peace Index | Overall peacefulness, safety & security, militarisation | Institute for Economics & Peace | Baseline | Annual |
| US State Department | Travel advisory levels (1--4) | US Department of State | Signal | Varies |
| UK FCDO | Travel advisory levels | UK Foreign, Commonwealth & Development Office | Signal | Varies |
| ReliefWeb | Active humanitarian disasters | UN OCHA | Signal | Daily |
| GDACS | Natural disaster alerts (earthquakes, floods, cyclones, volcanoes) | EU JRC / UN | Signal | Daily |

All sources are free and publicly available. The pipeline fetches them in parallel using `Promise.allSettled`, so a single source failure does not block the others. GDELT and WHO Disease Outbreak News were previously included but have been removed due to reliability issues.

## Scoring Methodology

Each country's safety score is computed from **5 pillars** (weights from `src/pipeline/config/weights.json` v9.0.0):

| Pillar | Weight | Key Indicators |
|--------|--------|----------------|
| Conflict | 30% | GPI overall peacefulness, GPI militarisation, calibrated advisory consensus |
| Crime | 25% | GPI Safety & Security -- homicide rate, violent crime, perceived criminality |
| Health | 20% | Child mortality, INFORM health & epidemic risk |
| Governance | 15% | V-Dem rule of law, government effectiveness, corruption control, INFORM governance |
| Environment | 10% | Air pollution, natural hazard risk, climate risk, ReliefWeb disasters, GDACS alerts |

### Formula v9: Uncertainty-Weighted (Bayesian Shrinkage) Scoring

Formula v9 replaced the earlier baseline+signal tiering (~70%/30%) with a single, continuous shrinkage mechanism. For each pillar, a raw value `p` is combined from its present indicators via explicit sub-weights, and a precision `n` is computed from how much fresh data backs it (freshness-decayed per source, see below). The pillar's final (shrunk) value is:

```
p_hat = (n * p + K * mu) / (n + K)
```

where `mu` is a conservative, region-anchored prior (nudged by a calibrated, importance-weighted consensus of 37 government travel advisories) and `K` is a fixed shrinkage constant. A well-measured pillar sits close to its raw data; a thin or stale pillar is pulled toward the cautious regional baseline instead of guessing.

The five shrunk pillars are combined with a **weighted geometric mean** -- unlike an arithmetic mean, a single dangerously low pillar drags the overall score down more than a strong one can lift it. Two continuous refinements apply, with no thresholds or hard cutoffs: a down-only acute term gives Conflict and Crime extra weight when either is severely low, and a count-damped severe-advisory modifier gently discounts the score when advisories broadly agree on "Do Not Travel" (a single thin record carries far less weight than a broad multi-government consensus). There are **no hard score caps or critical floors** -- the earlier mechanisms (majority-Level-4 cap, critical-pillar floor, sparse-data advisory blend) were all removed in v9 because they made the score jump discontinuously around single thresholds.

Each `ScoredCountry` also carries a `confidence` field (0--1): a precision-weighted measure of how much fresh, present data backs the score across all five pillars. Low confidence means the score sits closer to the conservative regional prior than to hard local evidence.

### Score Bands

Formula v9 compresses the practical score range to roughly **3.7--8.9** (global mean ~6.75), because uncertainty-aware scoring makes fewer extreme claims. Bands: `<5.0` danger, `5.0--6.0` high caution, `6.0--7.0` moderate, `7.0--8.0` good, `>=8.0` excellent.

### Freshness Decay

Each source has a configurable half-life for exponential freshness decay (see `source-tiers.json`). Data that is one half-life old contributes roughly half of its statistical precision; at two half-lives, roughly a quarter; and so on. Beyond a source's `maxAgeDays`, its precision drops to zero and the affected pillar shrinks further toward the conservative regional prior rather than relying on stale evidence.

| Source | Half-Life | Max Age |
|--------|-----------|---------|
| World Bank / INFORM / GPI / V-Dem | 365 days | 730 days |
| ReliefWeb | 14 days | 60 days |
| Advisories / GDACS | 7 days | 30 days |

### Per-Indicator Sub-Weights

Indicators within a pillar are not equally averaged. Pillars with `indicatorWeights` in `weights.json` use explicit sub-weights (e.g., Conflict: `gpi_overall` 45%, `gpi_militarisation` 15%, and the synthetic advisory-consensus indicator `A` 40%). Pillars without explicit weights use equal averaging.

Raw indicator values are normalized to a 0--1 scale (higher = safer) using known min/max ranges, then aggregated into the final 1--10 score via `score = 1 + 9 * composite^0.79`.

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

All data sources used are free and publicly available. No API keys are required except for ReliefWeb (`RELIEFWEB_APPNAME`).

## Project Structure

```
src/
  pages/          Astro pages (EN, IT, ES, FR, PT locale routing)
  components/     Reusable Astro and client-side components
  pipeline/       Data fetchers, scoring engine, and config
    fetchers/     One module per data source (7 fetchers)
    scoring/      Uncertainty-weighted (Bayesian shrinkage) engine with freshness decay
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
3. Runs `npx tsx src/pipeline/run.ts` to fetch all data sources in parallel.
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
