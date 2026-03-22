# Technology Stack: v3.0 Near-Realtime Data Sources & Scoring Overhaul

**Project:** IsItSafeToTravel.com
**Researched:** 2026-03-22
**Scope:** Stack additions for near-realtime data sources, new fetchers, RSS/XML parsing, and scoring formula changes. Focused ONLY on pipeline additions -- no frontend changes.

## TL;DR

Add 4 new data sources to the existing TypeScript pipeline: **GDELT** (near-realtime conflict/instability via free CSV API), **ReliefWeb** (humanitarian crises via free JSON API), **HDX HAPI** (conflict events + displacement via free JSON API), and **WHO DONs** (disease outbreaks via free JSON API). One new npm dependency: `rss-parser` for potential RSS fallback. Everything else uses native `fetch()` + the existing `papaparse` (already installed) for CSV parsing. No paid APIs. No new auth credentials beyond a free ReliefWeb appname and a free HDX HAPI app_identifier.

## Existing Stack (validated, DO NOT change)

| Technology | Version | Role |
|------------|---------|------|
| Astro | ^6.0.6 | SSG framework |
| TypeScript | ^5.9.3 | Type safety |
| tsx | ^4.21.0 | Pipeline runner |
| papaparse | ^5.5.3 | CSV parser (devDep, already installed) |
| xlsx | ^0.18.5 | Excel parser (devDep, already installed) |
| Node 22 native fetch | - | HTTP requests in pipeline fetchers |

## Existing Pipeline Pattern (follow this exactly)

Each fetcher follows the same pattern established in `src/pipeline/fetchers/acled.ts`:

1. Export an async function `fetchX(date: string): Promise<FetchResult>`
2. Fetch raw data from API, save to `data/raw/{date}/` as raw JSON/CSV
3. Parse into `RawIndicator[]` with `{ countryIso3, indicatorName, value, year, source }`
4. Save parsed data as `{source}-parsed.json`
5. Fallback to cached data from `findLatestCached()` on failure
6. Return `FetchResult` with success/failure status

New fetchers MUST follow this pattern. No architectural changes needed.

## New Data Sources: Recommended

### 1. GDELT Stability Timeline API

**Purpose:** Near-realtime instability/conflict signal, updated every 15 minutes. Complements ACLED (which covers last 30 days) with a faster signal.

**Why GDELT:** Only free source providing near-realtime, country-level instability metrics derived from global news media. No registration required. No API key. The Stability Dashboard API distills billions of news articles into a single "instability" score per country.

| Property | Detail |
|----------|--------|
| API endpoint | `https://api.gdeltproject.org/api/v1/dash_stabilitytimeline/dash_stabilitytimeline` |
| Auth | **None** -- completely open |
| Rate limits | **Undocumented** -- but responses are lightweight CSV. Use conservative 1 req/sec pacing. |
| Data format | CSV (via `OUTPUT=csv`) |
| Country format | FIPS 2-letter codes (NOT ISO). Requires FIPS-to-ISO3 mapping. |
| Update frequency | Every 15 minutes (we only need daily) |
| Key params | `LOC={fips_code}`, `VAR=instability`, `TIMERES=day`, `SMOOTH=3`, `OUTPUT=csv` |
| Indicators produced | `gdelt_instability` (daily instability score per country) |
| Pillar mapping | `conflict` pillar |
| Confidence | **MEDIUM** -- API is undocumented regarding rate limits; data quality well-established |

**Integration approach:**
- Fetch one CSV per country (batch with 500ms delays to avoid hammering)
- Parse CSV with `papaparse` (already installed)
- Take the most recent day's value as the indicator
- Need a FIPS-to-ISO3 mapping utility (~250 country mappings, static lookup table)

**Concern:** Fetching 248 countries individually at 500ms spacing = ~2 minutes. Acceptable in a daily cron pipeline. Could batch into regional queries if needed later.

**Alternative considered:** GDELT DOC 2.0 API (full-text search). Rejected: requires building custom query logic to derive a "safety score" from article counts. The Stability API already computes this.

### 2. ReliefWeb API v2

**Purpose:** Active humanitarian crises and disaster reports by country. Captures ongoing emergencies (earthquakes, floods, outbreaks) that annual indices miss entirely.

**Why ReliefWeb:** UN OCHA's official platform. Free JSON API. Structured disaster data with country tagging. Only requires a free appname (approved within 1 business day).

| Property | Detail |
|----------|--------|
| API endpoint | `https://api.reliefweb.int/v2/disasters` and `/v2/reports` |
| Auth | **Appname required** (free, register at reliefweb.int). Pass as `appname` query param. |
| Rate limits | **1,000 calls/day** (sufficient -- we need ~5 calls total per pipeline run) |
| Data format | JSON |
| Country format | ISO3 in nested objects |
| Update frequency | Continuous (new reports posted as events happen) |
| Key params | `filter[field]=status&filter[value]=current` for active disasters; `filter[field]=country.iso3` for by-country |
| Indicators produced | `reliefweb_active_disasters` (count of active disasters per country), `reliefweb_severity` (max severity level) |
| Pillar mapping | `environment` pillar (natural disasters), `conflict` pillar (conflict-related crises) |
| Confidence | **HIGH** -- well-documented API, UN-backed, stable for 10+ years |

**Integration approach:**
- Single API call to `/v2/disasters?filter[field]=status&filter[value]=current&limit=1000` to get all active disasters
- Parse country associations from response, count per country
- Extract severity levels where available
- Env var: `RELIEFWEB_APPNAME` (register at reliefweb.int/help/api)

### 3. HDX HAPI (Humanitarian API)

**Purpose:** Conflict event aggregates and displacement data (refugees, IDPs) by country. Consolidates ACLED data + UNHCR data + other humanitarian sources into a single standardized API.

**Why HDX HAPI:** Single API for conflict events AND displacement data. ISO3 country codes native. Free. JSON response. Maintained by UN OCHA. Replaces the need to call UNHCR API separately.

| Property | Detail |
|----------|--------|
| API endpoint (v2) | `https://hapi.humdata.org/api/v2/coordination-context/conflict-events` |
| API endpoint (v2) | `https://hapi.humdata.org/api/v2/affected-people/refugees-persons-of-concern` |
| Auth | **app_identifier** -- base64 of `appname:email`. Free, no approval needed. Pass as `X-HDX-HAPI-APP-IDENTIFIER` header or query param. |
| Rate limits | **Undocumented** but generous. Max 10,000 records per request with pagination. |
| Data format | JSON (also supports CSV) |
| Country format | ISO3 natively |
| Update frequency | Monthly aggregation, updated regularly |
| Key params | `location_code={iso3}`, `limit=10000`, `output_format=json` |
| Indicators produced | `hdx_conflict_events` (monthly event count), `hdx_conflict_fatalities`, `hdx_displaced_persons` |
| Pillar mapping | `conflict` pillar (events/fatalities), `governance` pillar (displacement as governance failure signal) |
| Confidence | **MEDIUM** -- API is v0.9.x (beta). Endpoints may change. But data is solid (sourced from ACLED + UNHCR). |

**Integration approach:**
- 2 API calls: one for conflict events, one for refugees/displaced persons
- Both return data aggregated by country with ISO3 codes
- Generate app_identifier: `Buffer.from('isitsafetotravel:email@example.com').toString('base64')`
- Env vars: `HDX_HAPI_APP_NAME`, `HDX_HAPI_EMAIL`

**Note:** HDX HAPI conflict data is sourced from ACLED. This creates overlap with the existing ACLED fetcher. Options: (a) use HDX HAPI as the single conflict source and drop direct ACLED, or (b) use both but weight accordingly. Recommend option (b) initially -- ACLED direct gives 30-day granularity while HDX HAPI gives monthly aggregates. Evaluate overlap during scoring formula design.

### 4. WHO Disease Outbreak News (DONs) API

**Purpose:** Active disease outbreaks by country. Captures epidemics (Ebola, cholera, MERS, etc.) that affect travel safety and are missed by annual health indices.

**Why WHO DONs:** Official WHO source. Free JSON API. No auth required. Directly relevant to traveler health safety.

| Property | Detail |
|----------|--------|
| API endpoint | `https://www.who.int/api/news/diseaseoutbreaknews` |
| Auth | **None** |
| Rate limits | **Undocumented** -- be conservative (max 2-3 requests per pipeline run) |
| Data format | JSON |
| Country format | Country names in text fields (requires name-to-ISO3 mapping, reuse existing `getCountryByName()`) |
| Update frequency | As outbreaks occur (irregular, typically 2-10 per month) |
| Key params | OData-style filtering (exact filter syntax poorly documented) |
| Indicators produced | `who_active_outbreaks` (count of active outbreak reports per country in last 90 days) |
| Pillar mapping | `health` pillar |
| Confidence | **MEDIUM** -- API exists and returns JSON, but filtering by country is not well-documented. May need to fetch all DONs and parse country from title/text. |

**Integration approach:**
- Fetch all recent DONs (last 90 days) in a single request
- Parse country names from titles (format: "Disease name - Country") using regex + `getCountryByName()`
- Count active outbreaks per country
- No env vars needed

## Data Sources: Evaluated and NOT Recommended

### EM-DAT (Emergency Events Database)

**Why NOT:** No REST API. Requires manual registration, login, and Excel download from web portal. Cannot be automated in a daily pipeline. The HDX platform hosts weekly EM-DAT country profile exports as XLSX, but these are annual aggregates (useless for near-realtime). ReliefWeb already covers active disasters better.

### UNHCR Refugee Statistics API (standalone)

**Why NOT:** HDX HAPI already includes UNHCR displacement data through its `/affected-people/refugees-persons-of-concern` endpoint. Adding the standalone UNHCR API (`api.unhcr.org/population/v1/`) would duplicate this data. If HDX HAPI proves unreliable (it is beta), UNHCR standalone is the fallback.

**UNHCR fallback details (if needed later):**
- Endpoint: `https://api.unhcr.org/population/v1/`
- Auth: None
- Format: JSON
- Good: ISO3 natively, no registration
- Bad: Annual data only (mid-year statistics), so no near-realtime advantage

### RSS Feeds (generic news)

**Why NOT as primary source:** RSS feeds from news outlets require NLP to extract safety-relevant signals from unstructured text. GDELT already does this processing at scale. Adding raw RSS parsing adds complexity without clear value over GDELT's curated instability metrics.

**Exception:** WHO DONs may have an RSS feed as fallback if the JSON API proves unreliable. Keep `rss-parser` as optional dependency for this edge case.

### GDELT Events Database (raw events, not Stability API)

**Why NOT:** Raw GDELT event data requires downloading 15-minute CSV dumps (~100MB each) and computing aggregate metrics. The Stability Timeline API already computes the country-level instability metric. Use the pre-computed API instead of raw event data.

### Global Terrorism Database (GTD)

**Why NOT:** Annual release only (1-2 year lag). Not near-realtime. ACLED + GDELT already cover terrorism events.

## New Dependencies

### Required: None (zero new npm packages for core functionality)

The existing stack already has everything needed:
- **`fetch()`** -- Node 22 native, used by all existing fetchers
- **`papaparse`** ^5.5.3 -- Already installed, handles GDELT CSV parsing
- **`AbortSignal.timeout()`** -- Node 22 native, used by all existing fetchers

### Optional: rss-parser (fallback only)

| Package | Version | Purpose | When to Add |
|---------|---------|---------|-------------|
| `rss-parser` | ^3.13.0 | Parse RSS/Atom feeds | Only if WHO DONs JSON API proves unreliable and RSS fallback is needed |

**Why rss-parser over alternatives:** 1.5M weekly downloads, TypeScript types included, lightweight (~25KB), actively maintained, well-tested. `feedsmith` (v2.8.0) is newer and faster with native TypeScript, but has only 2 dependents -- too early to trust for production. `rss-parser` is battle-tested.

Install only when needed:
```bash
npm install -D rss-parser
```

## New Environment Variables

| Variable | Source | Required | How to Get |
|----------|--------|----------|------------|
| `RELIEFWEB_APPNAME` | ReliefWeb API | Yes (for ReliefWeb) | Register free at https://reliefweb.int/help/api |
| `HDX_HAPI_APP_NAME` | HDX HAPI | Yes (for HDX HAPI) | Choose any descriptive name |
| `HDX_HAPI_EMAIL` | HDX HAPI | Yes (for HDX HAPI) | Your email for app_identifier generation |

**Existing env vars (no changes):**
- `ACLED_API_KEY` -- Already configured
- `ACLED_EMAIL` -- Already configured

**GitHub Actions secrets to add:** `RELIEFWEB_APPNAME`, `HDX_HAPI_APP_NAME`, `HDX_HAPI_EMAIL`

## New Utility: FIPS-to-ISO3 Country Code Mapping

GDELT uses FIPS 10-4 country codes (2-letter), not ISO. The pipeline needs a static mapping table.

**Implementation:** Add `src/pipeline/config/fips-to-iso3.ts` exporting a `Map<string, string>` with ~250 FIPS-to-ISO3 mappings. This is a static lookup -- no external dependency needed. Source the mapping from the GNS country codes file referenced in GDELT docs.

## Pipeline Integration Summary

### New Fetcher Files to Create

| File | Source | Data Format | Auth | Indicators |
|------|--------|-------------|------|------------|
| `src/pipeline/fetchers/gdelt.ts` | GDELT Stability API | CSV | None | `gdelt_instability` |
| `src/pipeline/fetchers/reliefweb.ts` | ReliefWeb API v2 | JSON | Appname | `reliefweb_active_disasters`, `reliefweb_severity` |
| `src/pipeline/fetchers/hdx.ts` | HDX HAPI v2 | JSON | App identifier | `hdx_conflict_events`, `hdx_conflict_fatalities`, `hdx_displaced_persons` |
| `src/pipeline/fetchers/who-dons.ts` | WHO DONs API | JSON | None | `who_active_outbreaks` |

### Changes to Existing Files

| File | Change |
|------|--------|
| `src/pipeline/fetchers/index.ts` | Import and add 4 new fetchers to `fetchAllSources()` |
| `src/pipeline/config/weights.json` | Add new indicators to appropriate pillars, bump version to 5.0.0 |
| `src/pipeline/scoring/normalize.ts` | Add normalization ranges for new indicators |
| `src/pipeline/scoring/engine.ts` | Add new sources to `SOURCE_CATALOG` |

### Updated `fetchAllSources()` (9 sources total)

```typescript
const results = await Promise.allSettled([
  fetchWorldBank(date),     // existing - annual
  fetchGpi(date),           // existing - annual
  fetchInform(date),        // existing - annual
  fetchAcled(date),         // existing - 30-day window
  fetchAdvisories(date),    // existing - daily
  fetchGdelt(date),         // NEW - daily (15-min resolution)
  fetchReliefWeb(date),     // NEW - continuous
  fetchHdx(date),           // NEW - monthly aggregates
  fetchWhoDons(date),       // NEW - as outbreaks occur
]);
```

### Updated Weights Config (proposed indicator additions)

```json
{
  "version": "5.0.0",
  "pillars": [
    {
      "name": "conflict",
      "weight": 0.30,
      "indicators": [
        "wb_political_stability", "gpi_overall", "gpi_safety_security",
        "gpi_militarisation", "acled_fatalities", "acled_events",
        "gdelt_instability", "hdx_conflict_events", "hdx_conflict_fatalities"
      ]
    },
    {
      "name": "crime",
      "weight": 0.25,
      "indicators": ["wb_rule_of_law", "advisory_level_us", "advisory_level_uk"]
    },
    {
      "name": "health",
      "weight": 0.20,
      "indicators": [
        "wb_child_mortality", "inform_health", "inform_epidemic",
        "who_active_outbreaks"
      ]
    },
    {
      "name": "governance",
      "weight": 0.15,
      "indicators": [
        "wb_gov_effectiveness", "wb_corruption_control", "inform_governance",
        "hdx_displaced_persons"
      ]
    },
    {
      "name": "environment",
      "weight": 0.10,
      "indicators": [
        "wb_air_pollution", "inform_natural", "inform_climate",
        "reliefweb_active_disasters"
      ]
    }
  ]
}
```

## Data Freshness After v3.0

| Source | Update Frequency | Latency |
|--------|-----------------|---------|
| GDELT | 15 min | Same day |
| ReliefWeb | Continuous | Same day |
| WHO DONs | Days | 1-3 days |
| ACLED | Weekly | ~7 days |
| HDX HAPI | Monthly | ~30 days |
| Advisories (US/UK) | As issued | 1-7 days |
| World Bank | Annual | 6-18 months |
| GPI | Annual | 6-12 months |
| INFORM | Annual | 6-12 months |

**Result:** Crises like a sudden conflict in Cuba or an earthquake in Turkey will now be reflected within the same day via GDELT + ReliefWeb, rather than waiting for the next annual index update.

## Scoring Formula Implications

The current scoring engine averages all indicators within a pillar equally. With 9 indicators in the `conflict` pillar (after adding GDELT + HDX), the near-realtime signals risk being diluted by 6 annual/monthly baselines.

**Recommendation for scoring overhaul (separate from stack):**
- Introduce a **recency weight** multiplier: indicators from sources updated daily/weekly get a 1.5x-2x weight relative to annual baselines
- Or split each pillar into `baseline` (annual) + `signal` (near-realtime) sub-components with configurable blend ratio (e.g., 60% baseline, 40% signal)
- This is a scoring formula design question, not a stack question. Document in ARCHITECTURE.md.

## Installation

```bash
# No new production dependencies needed

# Optional (only if WHO DONs RSS fallback needed):
npm install -D rss-parser
```

**GitHub Actions secrets to add:**
```
RELIEFWEB_APPNAME=isitsafetotravel-pipeline
HDX_HAPI_APP_NAME=isitsafetotravel
HDX_HAPI_EMAIL=your-email@example.com
```

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| GDELT Stability API | MEDIUM | API works and is free, but rate limits undocumented. FIPS codes add mapping complexity. |
| ReliefWeb API | HIGH | Well-documented, UN-backed, 10+ years stable. Appname requirement is trivial. |
| HDX HAPI | MEDIUM | API is beta (v0.9.x). Endpoints may change. Data quality is solid (ACLED + UNHCR sourced). |
| WHO DONs API | MEDIUM | API exists but country filtering is poorly documented. May need text parsing fallback. |
| Pipeline integration | HIGH | Existing fetcher pattern is clean and extensible. Adding 4 fetchers is straightforward. |
| Zero new npm deps | HIGH | papaparse already handles CSV, native fetch handles HTTP, no XML sources in recommended set. |

## Sources

- GDELT Stability Dashboard API: https://blog.gdeltproject.org/announcing-the-gdelt-stability-dashboard-api-stability-timeline/
- GDELT DOC 2.0 API: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
- GDELT Data Access: https://www.gdeltproject.org/data.html
- ReliefWeb API Documentation: https://apidoc.reliefweb.int/
- ReliefWeb API Help: https://reliefweb.int/help/api
- HDX HAPI Documentation: https://hdx-hapi.readthedocs.io/
- HDX HAPI OpenAPI: https://hapi.humdata.org/docs
- WHO Disease Outbreak News API: https://www.who.int/api/news/diseaseoutbreaknews/sfhelp
- WHO Outbreaks API: https://www.who.int/api/news/outbreaks/sfhelp
- UNHCR Refugee Statistics API: https://api.unhcr.org/docs/refugee-statistics.html
- EM-DAT Data Accessibility: https://doc.emdat.be/docs/data-accessibility/
- rss-parser npm: https://www.npmjs.com/package/rss-parser
- feedsmith npm: https://www.npmjs.com/package/feedsmith
