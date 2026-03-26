# Phase 28: Cleanup - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Remove broken WHO DONs and GDELT sources from the codebase entirely. This includes fetchers, parsers, normalization config, weights references, source-tiers entries, CI workflow steps, and any documentation references. Pipeline must run cleanly after removal with stable scores.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints:
- Scores for all 248 countries must remain valid after removal
- No country score should deviate by more than 0.3 points from pre-removal values
- weights.json must be updated to redistribute weight among remaining indicators
- source-tiers.json must be updated to remove WHO DONs and GDELT entries
- Health pillar loses who_active_outbreaks indicator
- Conflict pillar loses gdelt_instability indicator

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
