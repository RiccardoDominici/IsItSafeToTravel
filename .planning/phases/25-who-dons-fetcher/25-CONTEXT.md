# Phase 25: WHO DONs Fetcher - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add WHO Disease Outbreak News fetcher as a realtime signal for the health pillar. The WHO DONs API returns semi-structured text about active disease outbreaks. Strategy: count active outbreaks per country in the last 90 days as a simple numeric signal. No NLP severity parsing in v3.0.

API endpoint: https://www.who.int/api/news/diseaseoutbreaknews
Returns JSON with title, summary, regions, publication date.
Country extraction: parse from title ("Disease - Country" format) using existing getCountryByName.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints:
- Simple approach: count active outbreaks per country in last 90 days
- Parse country from DON title ("Disease - Country" format)
- Use getCountryByName for country lookup
- Indicator name: who_active_outbreaks (inverse — more outbreaks = less safe)
- Follow established fetcher pattern (findLatestCached fallback)
- Register in index.ts, normalize.ts, weights.json, source-tiers.json already has who_dons entry
- Add to health pillar with appropriate sub-weight

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pipeline/fetchers/gdacs.ts` — newest fetcher pattern
- `src/pipeline/config/countries.ts` — getCountryByName for country extraction
- `src/pipeline/fetchers/index.ts` — 8 fetchers currently

### Integration Points
- `src/pipeline/fetchers/index.ts` — add as 9th source
- `src/pipeline/scoring/normalize.ts` — add who_active_outbreaks range
- `src/pipeline/config/weights.json` — add to health pillar

</code_context>

<specifics>
## Specific Ideas

No specific requirements.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
