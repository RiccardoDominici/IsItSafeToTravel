# Phase 35: CI/CD Automation - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

All new advisory sources are fetched automatically via GitHub Actions daily with staggered scheduling and graceful failure handling.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints:
- GitHub Actions workflow triggers daily and fetches all 34+ advisory sources
- Sources fetched in staggered batches with delays between groups to respect rate limits and avoid IP blocking
- Individual source failures logged but don't block pipeline — produces valid scores using available data
- Workflow completes within GitHub Actions free-tier time limits (under 30 minutes total)

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
