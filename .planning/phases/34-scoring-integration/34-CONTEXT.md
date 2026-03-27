# Phase 34: Scoring Integration - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Scoring engine properly weights all 34+ advisory sources in the Conflict pillar, with source-tiers configuration reflecting the expanded source set.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints:
- weights.json must assign sub-weights to all 34+ advisory sources within the Conflict pillar
- Diminishing per-source weight as count increases (no single advisory dominates)
- source-tiers.json must list all new advisory sources as signal tier with appropriate decay half-life and max-age parameters
- Countries covered by more advisory sources should show greater score stability (consensus effect)
- Full pipeline must produce valid scores for all 248 countries

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
