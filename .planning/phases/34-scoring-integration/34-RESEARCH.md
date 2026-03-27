# Phase 34: Scoring Integration - Research

**Researched:** 2026-03-27
**Domain:** Scoring engine configuration and advisory source weighting
**Confidence:** HIGH

## Summary

Phase 34 integrates all 37 advisory sources into the scoring engine. Currently, only 8 advisory sources (US, UK, CA, AU + tier-1: DE, NL, JP, SK) are registered in `weights.json` and `normalize.ts`. The tier-2a (8 sources), tier-2b (8 sources), and tier-3 (13 sources) advisory indicators exist as fetchers and are loaded into `advisoryInfoMap`, but they are NOT wired into the scoring pipeline's weights, normalization ranges, or indicator-source mappings.

There are exactly 4 files that need changes, plus the `computeCountryScore` function signature and advisory level aggregation array need extending to include the 13 tier-3 source keys.

**Primary recommendation:** Add all 29 missing advisory sources to weights.json, source-tiers.json, normalize.ts INDICATOR_RANGES, and engine.ts (INDICATOR_SOURCE_MAP + function signature + advisoryLevels array). Use diminishing per-source sub-weights so no single advisory dominates.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked -- all implementation choices at Claude's discretion.

### Claude's Discretion
- weights.json must assign sub-weights to all 34+ advisory sources within the Conflict pillar
- Diminishing per-source weight as count increases (no single advisory dominates)
- source-tiers.json must list all new advisory sources as signal tier with appropriate decay half-life and max-age parameters
- Countries covered by more advisory sources should show greater score stability (consensus effect)
- Full pipeline must produce valid scores for all 248 countries

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NORM-02 | Scoring engine weights updated to include all new advisory sources in Conflict pillar | weights.json indicatorWeights, engine.ts INDICATOR_SOURCE_MAP, function signature, advisoryLevels array |
| NORM-03 | Source-tiers.json updated with all new sources as signal tier | source-tiers.json sources entries with signal tier, 7-day half-life, 30-day max-age |
</phase_requirements>

## Architecture Patterns

### Current Scoring Architecture

The scoring pipeline follows a clear data flow:

1. **Fetchers** produce `RawIndicator[]` with `indicatorName` like `advisory_level_XX`
2. **normalize.ts** `INDICATOR_RANGES` maps indicator names to min/max/inverse for normalization
3. **engine.ts** `INDICATOR_SOURCE_MAP` maps indicator names to source names for tier classification
4. **weights.json** lists indicators in the `conflict` pillar with `indicatorWeights` sub-weights
5. **source-tiers.json** classifies each source as baseline/signal with decay parameters
6. **engine.ts** `computeCountryScore` receives advisory info as typed parameter and builds `advisoryLevels` array for hard-cap logic

### What Exists vs What Is Missing

#### Complete inventory of all 37 advisory sources:

| Source | Code | In weights.json | In source-tiers.json | In normalize.ts | In INDICATOR_SOURCE_MAP | In computeCountryScore sig | In advisoryLevels array |
|--------|------|-----------------|---------------------|-----------------|------------------------|---------------------------|------------------------|
| US | us | YES | YES | YES | YES | YES | YES |
| UK | uk | YES | YES | YES | YES | YES | YES |
| Canada | ca | YES | YES | YES | YES | YES | YES |
| Australia | au | YES | YES | YES | YES | YES | YES |
| Germany | de | YES | YES | YES | YES | YES | YES |
| Netherlands | nl | YES | YES | YES | YES | YES | YES |
| Japan | jp | YES | YES | YES | YES | YES | YES |
| Slovakia | sk | YES | YES | YES | YES | YES | YES |
| France | fr | NO | NO | NO | YES | YES | YES |
| New Zealand | nz | NO | NO | NO | YES | YES | YES |
| Ireland | ie | NO | NO | NO | YES | YES | YES |
| Finland | fi | NO | NO | NO | YES | YES | YES |
| Hong Kong | hk | NO | NO | NO | YES | YES | YES |
| Brazil | br | NO | NO | NO | YES | YES | YES |
| Austria | at | NO | NO | NO | YES | YES | YES |
| Philippines | ph | NO | NO | NO | YES | YES | YES |
| Belgium | be | NO | NO | NO | YES | YES | YES |
| Denmark | dk | NO | NO | NO | YES | YES | YES |
| Singapore | sg | NO | NO | NO | YES | YES | YES |
| Romania | ro | NO | NO | NO | YES | YES | YES |
| Serbia | rs | NO | NO | NO | YES | YES | YES |
| Estonia | ee | NO | NO | NO | YES | YES | YES |
| Croatia | hr | NO | NO | NO | YES | YES | YES |
| Argentina | ar | NO | NO | NO | YES | YES | YES |
| Italy | it | NO | NO | NO | NO | NO | NO |
| Spain | es | NO | NO | NO | NO | NO | NO |
| South Korea | kr | NO | NO | NO | NO | NO | NO |
| Taiwan | tw | NO | NO | NO | NO | NO | NO |
| China | cn | NO | NO | NO | NO | NO | NO |
| India | in | NO | NO | NO | NO | NO | NO |
| Switzerland | ch | NO | NO | NO | NO | NO | NO |
| Sweden | se | NO | NO | NO | NO | NO | NO |
| Norway | no | NO | NO | NO | NO | NO | NO |
| Poland | pl | NO | NO | NO | NO | NO | NO |
| Czech Rep | cz | NO | NO | NO | NO | NO | NO |
| Hungary | hu | NO | NO | NO | NO | NO | NO |
| Portugal | pt | NO | NO | NO | NO | NO | NO |

**Summary of gaps:**
- **weights.json**: 29 advisory indicators missing (all except us/uk/ca/au/de/nl/jp/sk)
- **source-tiers.json**: 29 source entries missing
- **normalize.ts INDICATOR_RANGES**: 29 entries missing
- **engine.ts INDICATOR_SOURCE_MAP**: 13 entries missing (tier-3a/3b only; tier-2a/2b already mapped)
- **engine.ts computeCountryScore signature**: 13 keys missing (tier-3a/3b)
- **engine.ts advisoryLevels array**: 13 entries missing (tier-3a/3b)

### Files to Modify

```
src/pipeline/config/weights.json          # Add 29 advisory indicators + sub-weights
src/pipeline/config/source-tiers.json     # Add 29 source entries
src/pipeline/scoring/normalize.ts         # Add 29 INDICATOR_RANGES entries
src/pipeline/scoring/engine.ts            # Add 13 INDICATOR_SOURCE_MAP entries
                                          # Extend computeCountryScore signature (13 keys)
                                          # Extend advisoryLevels array (13 entries)
```

### Weight Calculation Strategy

Current conflict pillar has 8 indicators with these weights:
- Baseline indicators (4): wb_political_stability 0.17, gpi_overall 0.17, gpi_safety_security 0.16, gpi_militarisation 0.14 = **0.64 total**
- Advisory signals (4): us 0.11, uk 0.10, ca 0.08, au 0.07 = **0.36 total**

With 37 advisory sources, the advisory portion of the conflict pillar should remain at roughly the same proportion (~36%) to avoid advisory signals overwhelming baseline indices. The key constraint is "diminishing per-source weight" -- each additional advisory source adds decreasing marginal weight.

**Recommended approach:** Keep baseline indicators at 0.64 total. Distribute 0.36 across all 37 advisory sources with diminishing weights:

Tier grouping for weight assignment:
- **Original 4** (US, UK, CA, AU): highest individual weights -- these have the longest track record
- **Tier-1 API** (DE, NL, JP, SK): slightly lower
- **Tier-2a HTML** (FR, NZ, IE, FI, HK, BR, AT, PH): medium
- **Tier-2b HTML** (BE, DK, SG, RO, RS, EE, HR, AR): medium-low
- **Tier-3a complex** (IT, ES, KR, TW, CN, IN): lower
- **Tier-3b complex** (CH, SE, NO, PL, CZ, HU, PT): lowest

Example weight distribution (must sum to 0.36):
- Original 4: ~0.025 each = 0.10
- Tier-1 (4): ~0.018 each = 0.072
- Tier-2a (8): ~0.010 each = 0.080
- Tier-2b (8): ~0.007 each = 0.056
- Tier-3a (6): ~0.005 each = 0.030
- Tier-3b (7): ~0.003 each = 0.021
- Total: 0.10 + 0.072 + 0.080 + 0.056 + 0.030 + 0.021 = 0.359

Fine-tune to sum exactly to 0.36. The baseline weights (0.64) stay unchanged.

### Consensus / Stability Effect

The scoring engine already achieves the "consensus effect" naturally through the tiered scoring architecture:
- `signalCompleteness` = foundSignals / expectedSignals
- `effectiveSignalInfluence` = maxSignalInfluence * signalCompleteness
- Countries with MORE advisory data have HIGHER signalCompleteness, meaning advisory data contributes more to their score -- which is a stabilizing effect since advisory consensus converges

No additional code logic needed for the stability requirement; it is an emergent property of the existing architecture once all advisory sources are registered as expected signals.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weight normalization | Manual sum-to-1 checking | Calculate programmatically or verify with a test | Floating point rounding across 41 indicators is error-prone |
| Advisory source registration | One-off additions | Systematic batch: all 29 in one pass per file | Missing even one creates silent scoring gaps |

## Common Pitfalls

### Pitfall 1: Weights Don't Sum to 1.0
**What goes wrong:** indicatorWeights in weights.json don't sum to exactly 1.0 due to floating point
**Why it happens:** 41 indicators with small weights
**How to avoid:** Use values that sum cleanly. Verify sum in a test or by calculation.
**Warning signs:** Score drift, unexpected pillar scores

### Pitfall 2: Missing normalize.ts Entry Causes Silent Data Loss
**What goes wrong:** An indicator without an INDICATOR_RANGES entry is silently skipped by `normalizeIndicators()` (line 77: `if (!range) continue`)
**Why it happens:** Easy to add to weights.json but forget normalize.ts
**How to avoid:** Add to ALL 4 files in lockstep
**Warning signs:** Advisory indicators present in raw data but missing from pillar scores

### Pitfall 3: INDICATOR_SOURCE_MAP Missing Entry
**What goes wrong:** Without a mapping, `indicatorToSource()` returns undefined, and `computeTieredPillarScore` defaults the indicator to baseline tier instead of signal
**Why it happens:** The fallback is `'baseline'` not an error
**How to avoid:** Add all 13 missing tier-3 entries to INDICATOR_SOURCE_MAP
**Warning signs:** Advisory indicators treated as baseline (no freshness decay, no signal influence cap)

### Pitfall 4: computeCountryScore Signature Not Extended
**What goes wrong:** Tier-3 advisory info is loaded into advisoryInfoMap but never passed to computeCountryScore, so tier-3 advisories don't participate in hard-cap logic
**Why it happens:** The function signature explicitly lists advisory keys, and tier-3 keys are absent
**How to avoid:** Add it/es/kr/tw/cn/in/ch/se/no/pl/cz/hu/pt to the advisories parameter type and to the advisoryLevels array
**Warning signs:** Countries with only tier-3 advisory data at level 4 not getting hard-capped

### Pitfall 5: AdvisoryInfoMap Type vs computeCountryScore Type Mismatch
**What goes wrong:** The local `AdvisoryInfoMap` type in `computeAllScores` (line 431) already has all 37 keys. But `computeCountryScore` parameter type (line 48) only has 24. The `countryAdvisories` object passed at line 524 includes tier-3 keys that TypeScript quietly passes through but are never read.
**How to avoid:** Ensure both types match exactly.

## Code Examples

### weights.json conflict pillar (target structure)
```json
{
  "name": "conflict",
  "weight": 0.30,
  "indicators": [
    "wb_political_stability", "gpi_overall", "gpi_safety_security", "gpi_militarisation",
    "advisory_level_us", "advisory_level_uk", "advisory_level_ca", "advisory_level_au",
    "advisory_level_de", "advisory_level_nl", "advisory_level_jp", "advisory_level_sk",
    "advisory_level_fr", "advisory_level_nz", "advisory_level_ie", "advisory_level_fi",
    "advisory_level_hk", "advisory_level_br", "advisory_level_at", "advisory_level_ph",
    "advisory_level_be", "advisory_level_dk", "advisory_level_sg", "advisory_level_ro",
    "advisory_level_rs", "advisory_level_ee", "advisory_level_hr", "advisory_level_ar",
    "advisory_level_it", "advisory_level_es", "advisory_level_kr", "advisory_level_tw",
    "advisory_level_cn", "advisory_level_in",
    "advisory_level_ch", "advisory_level_se", "advisory_level_no", "advisory_level_pl",
    "advisory_level_cz", "advisory_level_hu", "advisory_level_pt"
  ],
  "indicatorWeights": {
    "wb_political_stability": 0.17,
    "gpi_overall": 0.17,
    "gpi_safety_security": 0.16,
    "gpi_militarisation": 0.14,
    "advisory_level_us": 0.025,
    "advisory_level_uk": 0.025,
    "advisory_level_ca": 0.025,
    "advisory_level_au": 0.025,
    "...remaining advisories with diminishing weights..."
  }
}
```

### normalize.ts entry pattern (all identical)
```typescript
advisory_level_XX: { min: 1, max: 4, inverse: true },
```

### source-tiers.json entry pattern
```json
"advisories_XX": { "tier": "signal", "maxAgeDays": 30, "decayHalfLifeDays": 7 }
```

### INDICATOR_SOURCE_MAP entry pattern
```typescript
advisory_level_XX: 'advisories_XX',
```

### computeCountryScore advisory parameter extension
```typescript
advisories: {
  us?: AdvisoryInfo; uk?: AdvisoryInfo; ca?: AdvisoryInfo; au?: AdvisoryInfo;
  de?: AdvisoryInfo; nl?: AdvisoryInfo; jp?: AdvisoryInfo; sk?: AdvisoryInfo;
  fr?: AdvisoryInfo; nz?: AdvisoryInfo; ie?: AdvisoryInfo; fi?: AdvisoryInfo;
  hk?: AdvisoryInfo; br?: AdvisoryInfo; at?: AdvisoryInfo; ph?: AdvisoryInfo;
  be?: AdvisoryInfo; dk?: AdvisoryInfo; sg?: AdvisoryInfo; ro?: AdvisoryInfo;
  rs?: AdvisoryInfo; ee?: AdvisoryInfo; hr?: AdvisoryInfo; ar?: AdvisoryInfo;
  // NEW: tier-3a
  it?: AdvisoryInfo; es?: AdvisoryInfo; kr?: AdvisoryInfo;
  tw?: AdvisoryInfo; cn?: AdvisoryInfo; in?: AdvisoryInfo;
  // NEW: tier-3b
  ch?: AdvisoryInfo; se?: AdvisoryInfo; no?: AdvisoryInfo;
  pl?: AdvisoryInfo; cz?: AdvisoryInfo; hu?: AdvisoryInfo; pt?: AdvisoryInfo;
},
```

## Verification Approach

After changes, run the full pipeline to verify:
```bash
npx tsx src/pipeline/main.ts
```

Check that:
1. All 248 countries produce valid scores (1-10 range)
2. No NaN or undefined scores
3. Conflict pillar `dataCompleteness` increases for countries with many advisory sources
4. Console output shows tier contribution percentages reflecting the new signal sources

## Sources

### Primary (HIGH confidence)
- `src/pipeline/config/weights.json` - current weight configuration (v7.0.0)
- `src/pipeline/config/source-tiers.json` - current tier configuration
- `src/pipeline/scoring/engine.ts` - scoring engine with INDICATOR_SOURCE_MAP, computeCountryScore, computeAllScores
- `src/pipeline/scoring/normalize.ts` - INDICATOR_RANGES for normalization
- `src/pipeline/types.ts` - TypeScript types including AdvisoryInfoMap, ScoredCountry
- `src/pipeline/fetchers/advisories-tier3a.ts` - tier-3a fetcher (IT, ES, KR, TW, CN, IN)
- `src/pipeline/fetchers/advisories-tier3b.ts` - tier-3b fetcher (CH, SE, NO, PL, CZ, HU, PT)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pure configuration changes, no new dependencies
- Architecture: HIGH - existing patterns are clear and consistent
- Pitfalls: HIGH - verified by reading actual code, all gaps confirmed

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable infrastructure)
