# Phase 29: Tier 1 API Sources - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add 4 API-based advisory fetchers (Germany, Netherlands, Japan, Slovakia) and create a shared normalization module that maps diverse level systems to a unified 1-4 advisory scale. This normalization foundation will be reused by all subsequent Tier 2 and Tier 3 sources.

API endpoints:
- **Germany** (Auswaertiges Amt): REST API at auswaertiges-amt.de/opendata — text-based levels (Reisewarnung/Teilreisewarnung/Sicherheitshinweis)
- **Netherlands**: JSON API at opendata.nederlandwereldwijd.nl — color-coded (Green/Yellow/Orange/Red)
- **Japan** (MOFA): XML open data at ezairyu.mofa.go.jp — 4 numeric levels (1-4)
- **Slovakia** (MZV): Open data portal at opendata.mzv.sk — TSV/CSV format

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Key constraints:
- Each fetcher must produce a parsed JSON file in data/raw/{date}/ following existing advisory fetcher patterns
- Shared normalization module must map: 3-level, 4-level, 5-level, 6-level, color-coded, and text-based systems to unified 1-4 scale
- Country names from each source must be mapped to ISO3 codes
- Each fetcher must handle API failures gracefully (log warning, continue pipeline)
- Follow existing fetcher patterns from src/pipeline/fetchers/advisories.ts

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
