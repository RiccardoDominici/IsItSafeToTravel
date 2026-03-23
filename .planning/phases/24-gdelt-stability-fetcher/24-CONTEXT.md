# Phase 24: GDELT Stability Fetcher - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add GDELT Stability Timeline API fetcher as a near-realtime conflict signal. This is the highest-impact new source — 15min updates, per-country instability scores. Key challenge: GDELT uses FIPS country codes (not ISO), requiring the mapping table created in Phase 21. Media bias must be contained by capping GDELT's contribution to 15% of the conflict pillar.

API endpoint: https://api.gdeltproject.org/api/v1/dash_stabilitytimeline/dash_stabilitytimeline?LOC={fips}&VAR=instability&OUTPUT=csv&TIMERES=day&SMOOTH=3
Returns CSV with date + instability ratio per country.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints from research:
- Use FIPS-to-ISO3 mapping from src/pipeline/config/fips-to-iso3.ts (Phase 21)
- Fetch per-country sequentially (GDELT doesn't support batch) with ~500ms spacing
- Parse CSV using papaparse (already installed)
- Cap GDELT's contribution at 15% of conflict pillar (indicatorWeight in weights.json)
- Use SMOOTH=3 parameter for 3-day rolling average to reduce noise
- Indicator name: gdelt_instability (inverse — higher instability = less safe)
- Follow the established fetcher pattern (findLatestCached fallback)
- Register in fetchers/index.ts, normalize.ts, weights.json, source-tiers.json
- Rate limits undocumented — may need to reduce scope if throttled
- Consider fetching only top ~100 countries by significance if 248 takes too long

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pipeline/config/fips-to-iso3.ts` — 267-entry FIPS mapping from Phase 21
- `src/pipeline/fetchers/acled.ts` — fetcher pattern
- `src/pipeline/fetchers/gdacs.ts` — newest fetcher from Phase 23
- `papaparse` — CSV parser, already in package.json

### Integration Points
- `src/pipeline/fetchers/index.ts` — add to Promise.allSettled
- `src/pipeline/scoring/normalize.ts` — add gdelt_instability range
- `src/pipeline/config/weights.json` — add to conflict pillar indicators
- `src/pipeline/config/source-tiers.json` — already has gdelt entry

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
