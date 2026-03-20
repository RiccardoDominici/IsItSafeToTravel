# Phase 11: Bug Fixes - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix two existing bugs: incorrect dates on trend chart x-axis and comparison page search dropdown race condition. No new features — restore correct behavior.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure bug fix phase.

</decisions>

<code_context>
## Existing Code Insights

### Bug 1: Trend Chart Date Axis (BUG-01)
- **File:** `src/components/country/TrendChart.astro`, line 42
- **Issue:** `new Date(d.date)` parses YYYY-MM-DD strings ambiguously across timezones
- **Result:** d3's `timeFormat('%b %d')` at line 73 renders shifted dates (previous day)
- **Fix approach:** Parse dates explicitly as UTC: `new Date(d.date + 'T00:00:00Z')` or use `d3.utcParse`

### Bug 2: Comparison Search Race Condition (BUG-02)
- **File:** `src/pages/en/compare.astro`, lines 255-258
- **Issue:** `setTimeout(() => dropdown.classList.add('hidden'), 200)` on blur — race condition with dropdown click
- **Result:** Dropdown hides before click event fires, preventing country selection
- **Fix approach:** Use `relatedTarget` check in blur handler, or `mousedown` instead of click on dropdown items

### Established Patterns
- Build-time D3 SVG rendering in TrendChart.astro
- Client-side D3 for comparison page
- Data passed via `data-*` attributes on container elements

### Integration Points
- TrendChart.astro used on all country detail pages and global safety page
- compare.astro is the sole comparison page (duplicated per locale: en/compare, it/compare)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward bug fixes with clear root causes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
