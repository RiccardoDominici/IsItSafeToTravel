# Phase 23: ReliefWeb and GDACS Fetchers - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add two new fetchers to the pipeline: ReliefWeb (humanitarian disasters) and GDACS (natural disaster alerts). Both integrate as signal-tier sources in the existing tiered scoring engine. Follow the established fetcher pattern from acled.ts: write {source}-parsed.json to data/raw/{date}/, use findLatestCached fallback, produce RawIndicator arrays. Register new indicators in normalize.ts INDICATOR_RANGES and in source-tiers.json.

ReliefWeb API: https://api.reliefweb.int/v2/disasters — JSON, free, no auth (appname header recommended)
GDACS API: https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH — JSON, free, no auth, filter to orange/red alerts

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints from research:
- ReliefWeb: count active disasters per country, use ISO3 country codes from API response
- GDACS: filter to alertlevel=red;orange only, map events to countries, count active alerts
- Both fetchers must follow the acled.ts pattern (findLatestCached fallback, RawIndicator output)
- Add to fetchAllSources in fetchers/index.ts (Promise.allSettled)
- Register new indicators in normalize.ts INDICATOR_RANGES
- Update source-tiers.json to include the new indicators in appropriate pillars
- Update weights.json with indicator entries and sub-weights for new indicators
- ReliefWeb indicator: reliefweb_active_disasters (inverse, lower = safer)
- GDACS indicator: gdacs_disaster_alerts (inverse, lower = safer)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pipeline/fetchers/acled.ts` — established fetcher pattern to follow
- `src/pipeline/fetchers/index.ts` — fetchAllSources with Promise.allSettled
- `src/pipeline/utils/fs.ts` — writeJson, readJson, getRawDir, findLatestCached
- `src/pipeline/config/countries.ts` — getCountryByName, getCountryByIso3, COUNTRIES
- `src/pipeline/scoring/normalize.ts` — INDICATOR_RANGES to extend
- `src/pipeline/config/source-tiers.json` — tier config to update
- `src/pipeline/config/weights.json` — weights to update with new indicators

### Established Patterns
- Fetcher signature: `async function fetchX(date: string): Promise<FetchResult>`
- Output: write `{source}-parsed.json` to `getRawDir(date)`
- Fallback: `findLatestCached('{source}-parsed.json')` when API fails
- Indicators: `RawIndicator` with countryIso3, indicatorName, value, year, source
- All fetchers added to Promise.allSettled in index.ts

### Integration Points
- `src/pipeline/fetchers/index.ts` — add imports and calls
- `src/pipeline/scoring/normalize.ts` — add INDICATOR_RANGES entries
- `src/pipeline/config/source-tiers.json` — register as signal sources
- `src/pipeline/config/weights.json` — add indicator sub-weights

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
