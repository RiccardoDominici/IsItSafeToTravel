# Phase 30: Tier 2 HTML Sources Batch 1 - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add 8 HTML-scraping advisory fetchers for countries with structured but non-API data. Each must parse HTML/RSS, extract advisory levels, normalize to unified 1-4 scale using the module from Phase 29, and produce parsed JSON.

Sources:
- **France** (diplomatie.gouv.fr): RSS feed + HTML, color-coded (vert/jaune/orange/rouge)
- **New Zealand** (SafeTravel.govt.nz): HTML, 4-level system like US
- **Ireland** (DFA): HTML, 4-level security ratings
- **Finland** (um.fi): HTML, 4-level system
- **Hong Kong** (Security Bureau OTA): HTML, 3-level (Amber/Red/Black), covers ~88 countries
- **Brazil** (Itamaraty): HTML, 5-level system (needs normalization to 1-4)
- **Austria** (BMEIA): HTML, 6-level system (needs normalization to 1-4)
- **Philippines** (DFA): HTML, 4-level alert system

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Key constraints:
- Follow the pattern established in Phase 29 (advisories-tier1.ts)
- Create advisories-tier2a.ts for this batch
- Use cheerio or similar for HTML parsing (check what's already in project deps)
- Each fetcher must handle page changes gracefully (log warning, use cache)
- Country name to ISO3 mapping required for each source
- Reuse normalization module from Phase 29

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
