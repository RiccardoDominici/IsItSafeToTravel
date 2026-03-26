# Phase 31: Tier 2 HTML Sources Batch 2 - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add 8 more HTML-scraping advisory fetchers completing Tier 2 coverage. Each must parse HTML, extract advisory levels, normalize to unified 1-4 scale, and produce parsed JSON.

Sources:
- **Belgium** (diplomatie.belgium.be): HTML, text-based advisories, English available
- **Denmark** (um.dk): HTML, text-based, English available
- **Singapore** (MFA): HTML, 180+ advisory articles, English
- **Romania** (MAE): HTML, text-based, English available
- **Serbia** (MFA): HTML, traffic light system, English available
- **Estonia** (kriis.ee): HTML, text-based, English available
- **Croatia** (MVEP): HTML, text-based, English available
- **Argentina** (Cancilleria): HTML, text-based alerts, Spanish

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Key constraints:
- Create advisories-tier2b.ts following tier2a pattern
- Extend types/normalization/engine for 8 new sources
- Use cheerio (already installed in Phase 30)
- Handle 403s and page changes gracefully
- Total Tier 2 fetch time must stay under 10 minutes for CI

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
