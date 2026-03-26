# Phase 32: Tier 3 Complex Sources Batch 1 - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add 6 complex advisory fetchers requiring non-Latin script handling, text-based level extraction, and multi-step navigation.

Sources:
- **Italy** (Viaggiare Sicuri): Italian text, no formal level system, pattern matching needed
- **Spain** (exteriores.gob.es): Spanish text, no formal levels
- **South Korea** (0404.go.kr): Korean, 4-level system
- **Taiwan** (BOCA): Chinese, 3-color system (Red/Orange/Yellow)
- **China** (cs.mfa.gov.cn): Chinese text, no formal levels, ad-hoc safety alerts
- **India** (MEA): English, ad-hoc advisories only

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints:
- Create advisories-tier3a.ts following tier2a/tier2b pattern
- Use cheerio for HTML parsing
- Non-Latin scripts (Korean, Chinese) need careful pattern matching
- Text-based sources may produce sparse results — acceptable
- Graceful failure on all sources

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
