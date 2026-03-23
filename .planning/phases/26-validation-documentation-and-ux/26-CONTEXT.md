# Phase 26: Validation, Documentation, and UX - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped in autonomous)

<domain>
## Phase Boundary

Final phase of v3.0: validate the new formula against historical crises, add CI drift guard, update methodology page in all 5 languages, update repo docs, and add score change delta indicators and data freshness badges to the UI.

This phase spans: validation (CI test + crisis comparison), documentation (site methodology + repo), and UX (score delta indicator + freshness badges on country cards).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints:
- CI drift guard: test that catches >0.5 point single-day score changes
- Crisis validation: compare old vs new formula against 3+ known crises
- Methodology page: update in EN/IT/ES/FR/PT with new formula, sources, weights
- Pillar explanations: update to reflect new realtime indicators
- Each new source must be listed with update frequency and role
- README: document new data architecture and source list
- Pipeline docs: explain baseline+signal scoring, tiers, decay parameters
- Score delta indicator: arrow/badge on country cards showing recent score movement
- Data freshness badges: show when each source was last updated per country
- Source list in methodology page should ideally be generated from weights.json/source-tiers.json

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/i18n/` — translation files for EN/IT/ES/FR/PT
- `src/pages/[lang]/methodology.astro` — methodology page to update
- `src/components/` — existing Astro components
- Country detail pages showing score cards — where to add delta/freshness

### Integration Points
- Methodology page content (all 5 languages)
- Country detail page components
- CI pipeline (GitHub Actions)
- README.md

</code_context>

<specifics>
## Specific Ideas

No specific requirements.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
