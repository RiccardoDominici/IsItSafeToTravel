# Phase 21: Scoring Formula Redesign - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Redesign the scoring engine to use a tiered baseline+signal architecture. Annual indices (GPI, World Bank, INFORM) form the baseline tier (~70% weight). Existing realtime sources (ACLED, advisories) become signal tier (~30% max). New config files (sources.json) define tier membership, decay half-lives, and max-age per source. The FIPS-to-ISO3 mapping table is created as a prerequisite for GDELT in Phase 24.

The key change: replace the current equal-averaging within pillars (foundCount-based) with explicit per-indicator sub-weights, and add freshness-decay weighting so that stale data contributes less.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Key constraints from research:
- Baseline tier: GPI, World Bank WGI, INFORM Risk (annual sources)
- Signal tier: ACLED, advisories (existing), plus slots for future GDELT, ReliefWeb, GDACS, WHO DONs
- Blend ratio: ~70% baseline, max ~30% signal, with exponential decay freshness weighting
- Decay formula: weight = e^(-ln(2)/halfLifeDays * ageDays), clamped to zero at maxAgeDays
- Graceful degradation: when all signal data is missing/stale, fall back to pure baseline scoring
- Per-indicator sub-weights within pillars to prevent score inflation when adding indicators
- sources.json config format: tier, halfLifeDays, maxAgeDays, pillar, indicatorWeight per indicator
- FIPS-to-ISO3 mapping: static ~250-entry lookup table for GDELT country codes
- Max daily score change: research suggests capping at 0.3 points to prevent noise

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pipeline/scoring/engine.ts` — `computeCountryScore()` and `computeAllScores()` to be modified
- `src/pipeline/scoring/normalize.ts` — `INDICATOR_RANGES` with min/max/inverse per indicator, `normalizeIndicators()`
- `src/pipeline/config/weights.json` — v4.0.0, 5 pillars with weight + indicator list
- `src/pipeline/types.ts` — `PillarWeight`, `WeightsConfig`, `RawIndicator`, `IndicatorScore`, `PillarScore`, `ScoredCountry`

### Established Patterns
- Fetchers write `{source}-parsed.json` to `data/raw/{date}/`
- `RawSourceData` has `source`, `fetchedAt`, `indicators[]`
- `WeightsConfig` loaded from JSON file at runtime
- Equal averaging within pillars: `sum / foundCount` (this is what needs to change)
- Missing data default: 0.5 neutral score

### Integration Points
- `run.ts` loads `weights.json` and passes to `computeAllScores()`
- New `sources.json` will be loaded alongside `weights.json`
- `freshness.ts` new module for decay weight calculation
- `fips-to-iso3.ts` new static mapping module

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
