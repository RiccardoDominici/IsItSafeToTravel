# Phase 33: Tier 3 Complex Sources Batch 2 - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add 7 more complex advisory fetchers completing the full 30+ source expansion. All European sources with various text-based advisory systems.

Sources:
- **Switzerland** (EDA): German/French/Italian/English, text-based
- **Sweden** (regeringen.se): Swedish text, "UD avråder" = advises against travel
- **Norway** (regjeringen.no): Norwegian text, ~50 countries covered
- **Poland** (MSZ): Polish text, "nie planuj podróży" = don't plan travel
- **Czech Republic** (MZV): Czech text, per-country advisories
- **Hungary** (KKM): Hungarian text
- **Portugal** (MNE): Portuguese text, per-country advisories

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints:
- Create advisories-tier3b.ts following tier3a pattern
- Extend types/normalization/engine for 7 new sources
- Use cheerio for HTML parsing
- Text pattern matching in 7 different languages
- All sources will produce sparse results — acceptable
- Total source count should reach 33+ after this phase

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
