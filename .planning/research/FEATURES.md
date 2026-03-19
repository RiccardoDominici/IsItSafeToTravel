# Feature Landscape

**Domain:** Travel safety comparison, historical trends, global benchmark scoring
**Researched:** 2026-03-19
**Focus:** v1.1 milestone -- new features only (comparison page, historical trend charts, global safety score, multi-country overlay)
**Confidence:** HIGH

## Existing Infrastructure (already built, relevant to new features)

These existing pieces directly support what v1.1 needs:

| Asset | Location | How v1.1 Uses It |
|-------|----------|-------------------|
| `loadHistoricalScores(days)` | `src/lib/scores.ts` | Returns `Map<iso3, HistoryPoint[]>` -- backbone for trend charts |
| `loadLatestScores()` | `src/lib/scores.ts` | All country scores -- compute global average from this |
| `TrendSparkline.astro` | `src/components/country/` | D3 build-time SVG pattern to expand into full trend chart |
| `ScoreHero.astro` | `src/components/country/` | Score display card to adapt for comparison view |
| `PillarBreakdown.astro` | `src/components/country/` | Pillar bars to reuse in side-by-side comparison |
| `scoreToColor()` | `src/lib/colors.ts` | Color-coding for score displays |
| D3 v7 | `package.json` | Already installed -- use for all charting |
| Fuse.js | `package.json` | Already installed -- reuse for country selector search |
| `Search.astro` | `src/components/` | Fuzzy search component to adapt for country picker |
| `ScoredCountry` type | `src/pipeline/types.ts` | Has `score`, `pillars[]` (5 pillars with `name`, `score`, `weight`) |
| Daily snapshot files | `data/scores/YYYY-MM-DD.json` | Historical data storage (1 day so far, accumulating) |

## Table Stakes

Features users expect on a comparison and trends page. Missing any of these makes the product feel incomplete.

| Feature | Why Expected | Complexity | Depends On | Notes |
|---------|--------------|------------|------------|-------|
| **Country selector with search** | Every comparison tool (Numbeo, IndexMundi, OECD, Mappr, GlobalEDGE) uses searchable dropdowns. Users type country names to find them. | Low | Existing Fuse.js + Search.astro pattern | Show flag + name + current score in dropdown. Support 2-5 countries. |
| **Side-by-side score cards** | Numbeo, TravelSafe-Abroad, Mappr all display country scores prominently next to each other. Users need the headline number. | Low | Existing ScoreHero.astro, scoreToColor() | Large score number with color fill. Adapt existing component into a compact card variant. |
| **Pillar breakdown comparison** | Country detail already shows 5-pillar breakdown. Users comparing countries will expect per-pillar comparison, not just overall score. Standard on Healix, HelloSafe. | Medium | Existing PillarBreakdown.astro, PillarScore type | Grouped horizontal bars (not radar chart -- horizontal bars are more accessible per NN/g research and WCAG compliant). |
| **Line chart for historical trends** | Line charts are THE universal representation for "score over time." Google Trends, Our World in Data, OECD all use them. Existing sparkline sets the expectation of a fuller version. | Medium | Existing loadHistoricalScores(), D3, HistoryPoint type | Expand sparkline into full-size chart with axes, labels, and tooltips. Build SVG at build time, add thin client JS island for tooltip interactivity. |
| **Multi-country overlay on trend chart** | When users compare countries, they expect overlaid trend lines on the same chart. OECD "Compare Your Country" does this. Google Trends does this. Core value proposition of comparison + trends. | Medium | Trend chart component, color palette for distinct lines | Limit to 5 countries max (more = visual noise). Use both color AND dash patterns for colorblind accessibility. |
| **Global average reference line on charts** | Users need context: "Is 6.2 good or bad?" A world-average dashed line answers this instantly. HelloSafe and GPI both contextualize scores against global benchmarks. | Low | loadLatestScores() -- compute mean at build time | Dashed horizontal line labeled "World Average." Computed as population-weighted mean (if pop data available) or simple mean. |
| **Shareable comparison URLs** | Users expect to share comparisons. Every comparison tool encodes selection in the URL. Critical for SEO too -- search engines index comparison pages. | Low | Astro page routing, query params | Pattern: `/en/compare?c=ITA,FRA,DEU`. Parse on page load, update on selection change. |
| **Responsive comparison layout** | 60%+ of travel research on mobile. Comparison must work on small screens. | Medium | Existing Tailwind 4 with container queries | Side-by-side at desktop, stacked vertically on mobile. Charts use SVG viewBox (already proven in sparkline). |
| **"Best in category" highlighting** | When comparing 3+ countries, users need to quickly spot "which is safest for health?" Subtle visual emphasis on the winning score per pillar. | Low | Pillar comparison component | Bold or highlight the highest pillar score in each row. Simple conditional styling. |
| **i18n for all new UI strings** | Site already supports EN/IT. New features must maintain parity. | Low | Existing next-intl/i18n setup | Add translation keys for comparison UI, chart labels, global score descriptions. |

## Differentiators

Features that set the product apart from competitors. Not expected, but genuinely valuable.

| Feature | Value Proposition | Complexity | Depends On | Notes |
|---------|-------------------|------------|------------|-------|
| **Global Safety Score as homepage hero** | No competitor shows a single "state of the world" number. A bold "World Safety: 5.8/10" with trend arrow creates a unique, shareable, headline-worthy metric. Media-friendly. | Low | loadLatestScores() -- weighted mean computation | Weight by population for meaningful average. Display prominently above the map. Trend arrow based on 7-day delta. |
| **Pre-built comparison sets** | Curated one-click comparisons: "Mediterranean Countries," "Southeast Asia," "Schengen Zone." Reduces cognitive load. Each set = indexable page for SEO. No competitor does this. | Low | Static data, no pipeline changes needed | Pattern: `/en/compare/mediterranean`. Great for long-tail SEO queries like "safest Mediterranean country." |
| **Score change badges** | On comparison page, highlight countries with significant recent score changes: "Score changed: +0.3 this week." Makes the page feel alive and current vs static competitor sites. | Low | Historical data (7-day diff at build time) | Simple arithmetic. High signal for users deciding "is it getting safer?" |
| **Per-pillar historical trends** | Show not just overall score trend but per-pillar trends over time. "Crime improved but health worsened." No travel safety site does per-dimension historical tracking. | Medium | Requires storing per-pillar scores in daily snapshots (pipeline change) | HIGH value. Currently HistoryPoint only stores overall score. Pipeline needs update to include pillar scores. Defer to v1.1 stretch or v1.2 if pipeline change is too disruptive. |
| **"Add from map" interaction** | Click countries on the existing world map to add them to comparison. Unique interaction -- no competitor does this. | High | SafetyMap.astro, client-side state between map and comparison | Requires bidirectional client state. Cool but complex. Defer unless time permits. |
| **Comparison as shareable card image** | "Share this comparison" generates a social-media-ready image (OG image). | High | Server-side image generation (satori or similar) | Defer to v1.2+. Nice but not essential. |

## Anti-Features

Features to explicitly NOT build. Tempting but wrong for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-time chart updates / live WebSocket data** | Budget is near-zero (Cloudflare static hosting). Safety scores change at most once daily. WebSocket/polling adds infrastructure cost for zero user value. | Build-time SVG charts rendered during daily pipeline run. Static is fast, free, SEO-friendly. |
| **User-adjustable index weights** | Users don't know how to weight conflict vs health risk. Custom weighting creates a "spreadsheet" experience, not a "safety answer." Numbeo lets users sort but not re-weight -- and that works. | Show the 5-pillar breakdown so users can mentally prioritize. Keep the composite score opinionated and fixed. |
| **More than 5 countries in comparison** | 5+ lines on a chart is visual noise. OECD comparison becomes unreadable at high counts. GlobalEDGE allows 20 but the result is useless. | Hard cap at 5 countries. Clear message when limit reached: "Remove a country to add another." |
| **Historical data backfill / synthetic past data** | Pipeline started 2026-03-19 (1 day of data). Backfilling from GPI historical data mixes methodologies and undermines trust. "10-year trends" would be dishonest. | Show what exists honestly. Display "accumulating data" notice when <30 days (already in TrendSparkline). Charts fill up naturally over weeks. |
| **City-level comparison** | Out of scope per PROJECT.md. Country-level is current granularity. Adding cities doubles data complexity. | Keep country-level. UI note: "Regional drill-down coming in a future update." |
| **Fancy D3 animations / chart transitions** | Adds JS weight, breaks SSG model, doesn't help users understand safety data. Anti-performance. | Subtle CSS transitions on hover only. Keep charts as static build-time SVG. Thin client island for tooltips only. |
| **Login / saved comparisons** | Explicitly out of scope per PROJECT.md. No user accounts. | URL-based state (query params) lets users bookmark and share without accounts. |
| **Radar/spider charts for pillar comparison** | Look cool in mockups but are harder to read than bar charts. NN/g research shows bar charts are significantly easier for users to compare values accurately. Accessibility issues with radar charts. | Grouped horizontal bar chart. Each pillar as a row, countries as colored bars. Clear, scannable, accessible. |

## Feature Dependencies

```
loadLatestScores() [EXISTS]
    --> Global Safety Score computation (weighted mean)
        --> Homepage hero display
        --> Global average reference line on trend charts

loadHistoricalScores() [EXISTS]
    --> Full trend chart component (expand sparkline)
        --> Multi-country overlay (add series selection)
        --> Score change badges (7-day diff)

Fuse.js + Search.astro [EXISTS]
    --> Country selector component (adapted dropdown)
        --> Comparison page (uses selector)
            --> Shareable URLs (encode selection)
            --> Side-by-side score cards
            --> Pillar breakdown comparison

ScoreHero.astro + PillarBreakdown.astro [EXISTS]
    --> Compact score card variant
    --> Grouped pillar comparison bars
```

**Critical path:** Country selector --> Comparison page --> Trend chart overlay. These three form the backbone and must be built in sequence.

**Independent track:** Global Safety Score can be built in parallel -- depends only on existing `loadLatestScores()`.

**Independent track:** Full trend chart (single country) can be built in parallel -- extends existing sparkline pattern.

## MVP Recommendation

### Must Have for v1.1

Priority order based on dependencies:

1. **Global Safety Score** -- Population-weighted mean displayed on homepage. Independent of other features. Quick win, high differentiation value. Includes trend arrow if >7 days of data exist.

2. **Country selector with search** -- Adapted from existing Search.astro. Searchable dropdown with flag + name + current score. Supports selecting 2-5 countries. Foundation for the comparison page.

3. **Comparison page at `/compare`** -- New Astro page. Side-by-side score cards (adapted ScoreHero), grouped horizontal bar chart for pillar comparison, shareable URL via query params.

4. **Full historical trend chart** -- Expand TrendSparkline into a full-width D3 SVG chart. Fixed Y-axis (1-10). Date labels on X-axis. Global average reference line. Astro client island for tooltip interactivity.

5. **Multi-country overlay** -- Extend trend chart to render multiple colored/dashed lines. Legend below chart with country names and current scores. Max 5 series.

6. **Pre-built comparison sets** -- 5-8 curated sets (Mediterranean, Southeast Asia, Nordic, etc.) as static pages. Low effort, high SEO value.

### Defer to v1.2+

- **"Add from map" click** -- High complexity, requires complex bidirectional client state
- **Per-pillar historical trends** -- Requires pipeline data model change to store pillar scores in snapshots
- **Export as shareable image** -- Needs server-side image generation infrastructure
- **Score change badges** -- Easy but needs 7+ days of data to be meaningful (wait for data to accumulate)

## Complexity Estimates

| Feature | Effort | Reason |
|---------|--------|--------|
| Global Safety Score | Small (1-2 days) | Arithmetic on existing data + new homepage section + i18n keys |
| Country selector | Small (1-2 days) | Adapt existing Fuse.js search into dropdown with multi-select |
| Comparison page layout | Medium (2-3 days) | New Astro page, CSS grid, responsive breakpoints, URL param handling |
| Side-by-side score cards | Small (1 day) | Compact variant of existing ScoreHero component |
| Pillar comparison bars | Medium (2-3 days) | New D3 grouped horizontal bar chart, accessible colors, responsive |
| Full trend chart | Medium (3-4 days) | Expand sparkline: add axes, labels, reference line, responsive sizing |
| Multi-country overlay | Medium (2-3 days) | Extend trend chart: multiple series, color/dash assignment, legend |
| Tooltip interactivity | Small (1-2 days) | Astro client island, mouse events on SVG, crosshair + value display |
| Pre-built comparison sets | Small (1-2 days) | Static data file + templated pages |
| i18n for new features | Small (1 day) | Add keys to EN/IT translation files, established pattern |
| **Total estimate** | **~15-22 days** | |

## UX Patterns from Competitor Analysis

### Country Comparison Page

**Selection pattern (from IndexMundi, OECD, Mappr):**
- Searchable dropdown, not raw text input
- Show country flag + name + current score in options
- Pre-populate from URL query params on page load
- "Chip" pattern for selected countries: pill with flag + name + X to remove
- "Add country" button that opens dropdown
- Clear visual affordance for the 5-country limit

**Layout pattern (from Numbeo, Mappr):**
- 2 countries: true side-by-side columns
- 3-5 countries: responsive grid that wraps
- Mobile: vertical stack with sticky header showing country names/flags
- Overall score prominent at top, pillar breakdown below

**Comparison cues (from HelloSafe, Healix):**
- Highlight "best" score per pillar with subtle emphasis (bold or background)
- Use consistent left-to-right order (matches URL param order)
- Color-code each country's scores using the safety color scale

### Historical Trend Chart

**Chart design (from Google Trends, Our World in Data, OECD):**
- Line chart (not area chart) for multi-series
- Fixed Y-axis: 1-10 (never auto-scale -- prevents misleading visual amplification)
- X-axis: date labels, auto-thinned based on data density
- Multiple lines: distinct colors AND dash patterns (colorblind accessibility)
- Dashed reference line for global average, labeled

**Interaction (from Google Trends, OECD):**
- Vertical crosshair line follows mouse/touch position
- Tooltip shows: date + all visible country scores at that point
- Legend below chart: colored line swatch + country name + latest score
- Legend items clickable to toggle series visibility

**Empty/sparse state:**
- <7 data points: show "accumulating data" message (already in TrendSparkline)
- <2 data points: show placeholder with explanation, no chart
- Progressive enhancement: chart gets more useful over time as daily data accumulates

### Global Safety Score

**Display (novel -- no direct competitor does this):**
- Large hero number on homepage: "5.8 / 10"
- Trend arrow: up/down/stable based on 7-day change
- Color-coded background using existing safety color scale
- Brief explainer: "Population-weighted average across 195 countries. Updated daily."
- Position: above the map on homepage, framing the site's purpose

## Sources

- [Numbeo Safety Index 2026](https://www.numbeo.com/crime/rankings_by_country.jsp?displayColumn=1) -- Table ranking with historical year selector (2012-2026), geochart map
- [TravelSafe-Abroad Country Index](https://www.travelsafe-abroad.com/countries/) -- Tiered risk categories (Low/Moderate/High/Extreme), 0-100 scale
- [OECD Compare Your Country](https://www.compareyourcountry.org/) -- Multi-country selector, trend view, bubble map, multiple visualization modes, i18n
- [Mappr Country Comparison](https://www.mappr.co/country-comparison/) -- Two-country side-by-side with 6 metrics
- [IndexMundi Country Comparisons](https://www.indexmundi.com/factbook/compare) -- Dropdown-based two-country comparison across topics
- [HelloSafe Safety Index 2026](https://hellosafe.com/travel-insurance/safest-countries-in-the-world) -- 5-pillar weighted scoring, 0-100 scale, public methodology
- [GlobalEDGE Country Comparator](https://globaledge.msu.edu/comparator) -- Up to 20 countries, multiple indicators
- [UX Collective: Data Visualization for Comparison](https://uxdesign.cc/a-guide-to-data-visualization-comparison-part-2-80b99b91e461) -- Chart selection guidance for comparisons
- [NN/g: Choosing Chart Types](https://www.nngroup.com/articles/choosing-chart-types/) -- Bar charts easiest to comprehend for value comparison
- [UX for AI: Line Chart Definitive Guide](https://uxforai.com/p/line-chart-definitive-guide-part-1) -- Multi-series line chart best practices, tooltip patterns
- [Querio: Top React Chart Libraries 2026](https://querio.ai/articles/top-react-chart-libraries-data-visualization) -- Recharts vs Nivo vs D3 comparison (D3 already in use, no migration needed)

---
*Feature research for: IsItSafeToTravel.com v1.1 -- Comparison and Historical Trends*
*Researched: 2026-03-19*
