# Architecture Patterns

**Domain:** Travel safety scoring platform -- near-realtime data integration
**Researched:** 2026-03-22

## Current Architecture Summary

The existing pipeline follows a clean 5-stage sequential pattern:

```
Fetch (parallel) -> Load Raw -> Score -> Snapshot -> History Index
```

- **Fetchers** (`src/pipeline/fetchers/`): 5 sources (WorldBank, GPI, INFORM, ACLED, Advisories), all parallel via `Promise.allSettled`, each writes `{source}-parsed.json` to `data/raw/{date}/`
- **Scoring** (`src/pipeline/scoring/engine.ts`): Merges all `RawIndicator[]`, normalizes via hardcoded `INDICATOR_RANGES`, averages indicators per pillar, computes weighted composite 1-10
- **Output**: `data/scores/{date}.json` (~1MB) + `data/scores/latest.json` + `data/scores/history-index.json`
- **Trigger**: Daily at 06:00 UTC via GitHub Actions, commits to repo, Cloudflare Pages auto-deploys
- **Data volume**: 529MB scores (568 snapshots since 2012), 1.5GB raw data

Key architectural properties to preserve:
- `RawIndicator` as universal data contract between fetch and score stages
- `Promise.allSettled` fault isolation per source
- Cached fallback via `findLatestCached()` for failed fetches
- Static file output compatible with Astro SSG build

## Recommended Architecture

### Principle: Baseline + Signal Adjustment

The core insight: annual indices (GPI, World Bank WGI, INFORM) provide stable baselines that change slowly. Near-realtime sources (GDELT, ReliefWeb, HDX HAPI, WHO DONs, advisory changes) provide fast-moving signals. The scoring formula should blend these two tiers rather than treating all indicators equally.

```
                    +------------------+
                    |  Annual Sources   |  (GPI, WorldBank, INFORM)
                    |  Tier: BASELINE   |  Updated: yearly/quarterly
                    +--------+---------+
                             |
                             v
+------------------+   +----+--------+   +------------------+
| Realtime Sources |-->| Score Engine|-->| Daily Snapshot   |
| Tier: SIGNAL     |   | (Baseline + |   | data/scores/     |
| (GDELT, Relief-  |   |  Signal     |   | {date}.json      |
|  Web, HDX, WHO,  |   |  Adjustment)|   +------------------+
|  ACLED, Advisory) |   +-------------+
+------------------+
```

### Component Boundaries

| Component | Responsibility | Status | Communicates With |
|-----------|---------------|--------|-------------------|
| `fetchers/gdelt.ts` | Fetch GDELT Stability Timeline instability scores per country | NEW | Raw data dir, scoring engine |
| `fetchers/reliefweb.ts` | Fetch ReliefWeb active disasters and severity by country | NEW | Raw data dir, scoring engine |
| `fetchers/hdx.ts` | Fetch HDX HAPI conflict events + displacement data by country | NEW | Raw data dir, scoring engine |
| `fetchers/who-dons.ts` | Fetch WHO Disease Outbreak News | NEW | Raw data dir, scoring engine |
| `fetchers/index.ts` | Orchestrate all fetchers in parallel | MODIFY | Add 4 new fetchers to `Promise.allSettled` array |
| `scoring/normalize.ts` | Normalize indicators to 0-1 | MODIFY | Add ranges for 8 new indicator names |
| `scoring/engine.ts` | Compute country scores with baseline+signal formula | MODIFY | Core formula change |
| `scoring/freshness.ts` | Track per-indicator data age, compute decay weights | NEW | Used by engine.ts |
| `config/weights.json` | Pillar weights and indicator assignments | MODIFY | Add new indicators to pillars, bump to v5.0.0 |
| `config/sources.json` | Source metadata: tier, freshness expectations, decay params | NEW | Used by engine.ts, freshness.ts |
| `config/fips-to-iso3.ts` | Static FIPS 10-4 to ISO3 country code mapping for GDELT | NEW | Used by fetchers/gdelt.ts |
| `types.ts` | Type definitions | MODIFY | Add tier, freshness fields |

### Data Flow (Modified Pipeline)

```
Stage 1: Fetch (parallel, unchanged pattern)
  +-- WorldBank       -> data/raw/{date}/worldbank-parsed.json    [BASELINE]
  +-- GPI             -> data/raw/{date}/gpi-parsed.json          [BASELINE]
  +-- INFORM          -> data/raw/{date}/inform-parsed.json       [BASELINE]
  +-- ACLED           -> data/raw/{date}/acled-parsed.json        [SIGNAL]
  +-- Advisories      -> data/raw/{date}/advisories-parsed.json   [SIGNAL]
  +-- GDELT [NEW]     -> data/raw/{date}/gdelt-parsed.json        [SIGNAL]
  +-- ReliefWeb [NEW] -> data/raw/{date}/reliefweb-parsed.json    [SIGNAL]
  +-- HDX HAPI [NEW]  -> data/raw/{date}/hdx-parsed.json          [SIGNAL]
  +-- WHO DONs [NEW]  -> data/raw/{date}/who-dons-parsed.json     [SIGNAL]

Stage 2: Load raw data (unchanged)
  +-- Read all *-parsed.json, build Map<string, RawSourceData>

Stage 3: Score [MODIFIED]
  +-- Load source tier config from sources.json
  +-- Separate indicators into BASELINE tier and SIGNAL tier
  +-- Compute baseline pillar scores (annual indices, slow-moving)
  +-- Compute signal adjustments (realtime sources, with freshness decay)
  +-- Blend: final_score = baseline * (1 - signal_influence) + signal * signal_influence

Stage 4: Snapshot (unchanged structure, enriched metadata)
Stage 5: History Index (unchanged)
```

## Scoring Formula Architecture

### Current Formula (to be replaced)

```
pillar_score = average(normalize(indicators_in_pillar))
composite = sum(pillar_score * pillar_weight) * 9 + 1
```

All indicators are treated equally regardless of freshness or source type.

### New Formula: Baseline + Signal with Freshness Decay

#### Step 1: Indicator Classification

Each indicator is classified by its source's tier (from `sources.json`):

```typescript
// NEW: src/pipeline/config/sources.json
{
  "sources": {
    "worldbank":  { "tier": "baseline", "maxAgeDays": 730,  "decayHalfLifeDays": 365 },
    "gpi":        { "tier": "baseline", "maxAgeDays": 730,  "decayHalfLifeDays": 365 },
    "inform":     { "tier": "baseline", "maxAgeDays": 730,  "decayHalfLifeDays": 365 },
    "acled":      { "tier": "signal",   "maxAgeDays": 60,   "decayHalfLifeDays": 14  },
    "advisories": { "tier": "signal",   "maxAgeDays": 30,   "decayHalfLifeDays": 7   },
    "gdelt":      { "tier": "signal",   "maxAgeDays": 14,   "decayHalfLifeDays": 3   },
    "reliefweb":  { "tier": "signal",   "maxAgeDays": 60,   "decayHalfLifeDays": 14  },
    "hdx":        { "tier": "signal",   "maxAgeDays": 90,   "decayHalfLifeDays": 30  },
    "who-dons":   { "tier": "signal",   "maxAgeDays": 90,   "decayHalfLifeDays": 30  }
  }
}
```

**Why these decay values**: GDELT updates every 15 minutes so 3-day half-life keeps only the last week relevant. ACLED and ReliefWeb update weekly so 14-day half-life gives two weeks of high relevance. WHO DONs and HDX update less frequently so 30-day half-life. Annual baselines get 365-day half-life meaning they lose 50% weight after a year of no update, but never fully disappear within 2 years.

#### Step 2: Freshness Weight Computation

```typescript
// NEW: src/pipeline/scoring/freshness.ts

/**
 * Compute a freshness weight for an indicator based on its age.
 * Uses exponential decay: weight = e^(-lambda * ageDays)
 * where lambda = ln(2) / halfLifeDays
 *
 * Returns 1.0 for fresh data, approaches 0.0 for stale data.
 * Clamped to 0 if age exceeds maxAgeDays.
 */
export function freshnessWeight(
  dataAgeMs: number,
  halfLifeDays: number,
  maxAgeDays: number,
): number {
  const ageDays = dataAgeMs / (1000 * 60 * 60 * 24);

  if (ageDays > maxAgeDays) return 0;
  if (ageDays <= 0) return 1;

  const lambda = Math.LN2 / halfLifeDays;
  return Math.exp(-lambda * ageDays);
}
```

**Why exponential decay over linear**: Linear decay creates an arbitrary cliff where data goes from "slightly useful" to "zero" in one day. Exponential decay naturally models information relevance -- yesterday's crisis matters a lot, last month's matters some, last year's barely registers. The half-life parameter makes this tunable per source type without changing the formula.

#### Step 3: Per-Pillar Baseline + Signal Blending

```typescript
// MODIFIED: src/pipeline/scoring/engine.ts (conceptual)

interface WeightedIndicator {
  normalizedValue: number;  // 0-1, higher = safer
  freshnessWeight: number;  // 0-1, from decay function
}

function computePillarScore(
  pillarDef: PillarWeight,
  baselineIndicators: WeightedIndicator[],
  signalIndicators: WeightedIndicator[],
  maxSignalInfluence: number,  // from config, e.g., 0.30
  expectedSignalCount: number, // how many signal indicators this pillar expects
): number {
  // Baseline: freshness-weighted average of baseline indicators
  const baselineScore = freshWeightedAverage(baselineIndicators) ?? 0.5;

  // If no signals, use pure baseline (graceful degradation)
  if (signalIndicators.length === 0) {
    return baselineScore;
  }

  // Signal: freshness-weighted average of signal indicators
  const signalScore = freshWeightedAverage(signalIndicators);

  // Signal influence scales with data completeness
  // More signal sources available = more influence, up to maxSignalInfluence
  const signalCompleteness = Math.min(1, signalIndicators.length / expectedSignalCount);
  const signalInfluence = maxSignalInfluence * signalCompleteness;

  // Blend
  return baselineScore * (1 - signalInfluence) + signalScore * signalInfluence;
}

function freshWeightedAverage(indicators: WeightedIndicator[]): number | null {
  if (indicators.length === 0) return null;
  const totalWeight = indicators.reduce((sum, i) => sum + i.freshnessWeight, 0);
  if (totalWeight === 0) return null;
  return indicators.reduce(
    (sum, i) => sum + i.normalizedValue * i.freshnessWeight,
    0,
  ) / totalWeight;
}
```

**Why 70/30 baseline-to-signal max blend**: Baseline indices are peer-reviewed, comprehensive, and authoritative. Signals are timely but noisy. A 70/30 split means signals can meaningfully move a score (e.g., drop a country from 7.0 to 5.5 during a major crisis) without a single bad news day causing wild swings. The influence also scales with data availability -- if only 1 of 4 signal sources has data for a country, it gets proportionally less influence (~7.5% instead of 30%).

**Key property**: When all signal sources fail, the formula degrades to pure baseline scoring. This is identical to current behavior, making the migration safe.

#### Step 4: Composite Score (unchanged)

```
composite = sum(pillar_score * pillar_weight) * 9 + 1
```

The 1-10 mapping stays the same. Only the per-pillar scoring changes.

### Type Extensions

```typescript
// MODIFIED: src/pipeline/types.ts additions

export interface RawIndicator {
  countryIso3: string;
  indicatorName: string;
  value: number;
  year: number;
  source: string;
  fetchedAt?: string;  // NEW: ISO 8601 when this data was fetched
  dataDate?: string;   // NEW: ISO 8601 when the underlying data was published/valid
}

export type SourceTier = 'baseline' | 'signal';

export interface SourceConfig {
  tier: SourceTier;
  maxAgeDays: number;
  decayHalfLifeDays: number;
}

export interface SourcesConfig {
  maxSignalInfluence: number;  // e.g., 0.30
  sources: Record<string, SourceConfig>;
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Treating Realtime Sources as Equal to Annual Indices
**What**: Adding GDELT/ReliefWeb indicators to `INDICATOR_RANGES` and pillar assignments without tier separation, relying on the existing simple average.
**Why bad**: With 9 indicators in the conflict pillar, a single GDELT instability spike would be diluted to ~11% influence, making the whole realtime effort pointless. Conversely, if you over-weight signal indicators by giving them 2x-3x within the average, a false positive tanks a country's score for a day.
**Instead**: Use the tiered baseline+signal architecture where signals have bounded influence (max 30%) proportional to data completeness.

### Anti-Pattern 2: Separate "Realtime Pipeline" Running on Different Schedule
**What**: Running a second pipeline every hour for realtime sources, merging with daily baseline.
**Why bad**: Doubles complexity, introduces race conditions between two pipelines writing to the same output files, and exceeds the zero-budget constraint (GitHub Actions minutes). Also creates confusing history-index.json entries.
**Instead**: Keep single daily pipeline. Add all fetchers to the same `Promise.allSettled` call. The freshness decay handles the temporal difference naturally.

### Anti-Pattern 3: Storing Realtime Data in a Database
**What**: Adding SQLite/Postgres to store event-level realtime data between pipeline runs.
**Why bad**: Violates the static-files-only architecture, adds deployment complexity, and is unnecessary when the pipeline runs daily and sources provide their own lookback windows (GDELT: 7 days, ACLED: 30 days, ReliefWeb: active disasters).
**Instead**: Each fetcher queries its source's built-in lookback window. No inter-run state needed.

### Anti-Pattern 4: Per-Event Granularity in Scored Output
**What**: Including individual disaster events or GDELT articles in the country score output.
**Why bad**: The ~1MB daily snapshot would balloon. GDELT processes billions of articles.
**Instead**: Fetchers aggregate to country-level indicators (event counts, instability scores, max severity) before writing parsed JSON. Only aggregates enter the scoring pipeline.

### Anti-Pattern 5: Recency-Weighted Simple Average (instead of tier separation)
**What**: Keeping the current `average(indicators)` formula but multiplying realtime indicators by 1.5x-2x.
**Why bad**: Multipliers within an average are fragile. The effective weight depends on how many other indicators exist in the pillar. Adding or removing one indicator changes the balance of all others. Hard to reason about and explain on the methodology page.
**Instead**: Explicit tier separation with clear, configurable blend ratio. Easy to explain: "70% of your score comes from established annual indices, 30% from near-realtime signals."

## Scalability Considerations

| Concern | Current (5 sources) | After (9 sources) | At 20+ sources |
|---------|---------------------|---------------------|----------------|
| **Fetch time** | ~30s (parallel) | ~2.5min (GDELT fetches 248 countries at 500ms spacing) | Batch GDELT queries by region |
| **Raw data volume** | 1.5GB (2+ years) | ~2.5GB/year (GDELT CSV + ReliefWeb JSON) | Prune raw data older than 90 days |
| **Snapshot size** | ~1MB/day | ~1.1MB/day (more indicators per country) | Consider splitting history-index.json by year |
| **Build time** | ~2min (Astro SSG) | Unchanged (reads latest.json only) | Unchanged |
| **GitHub repo size** | 2GB+ (data/) | ~4GB in 1 year | Add `data/raw/` to .gitignore, store in artifact/release |
| **GitHub Actions** | ~3min/run | ~5min/run (GDELT sequential fetching) | Still within 15min timeout |

### GDELT Fetch Time Concern

GDELT's Stability Timeline API requires one request per country (~248 countries). At 500ms spacing to avoid rate limiting, this takes ~2 minutes. This is the bottleneck.

**Mitigation**: Run GDELT fetch concurrently with other fetchers via `Promise.allSettled`. The 2-minute GDELT fetch runs in parallel with other sources. Total pipeline time increases from ~3min to ~5min, well within the 15min GitHub Actions timeout.

**Future optimization**: If GDELT adds a bulk/batch endpoint, switch to that. Or reduce to top-100 countries by travel volume.

### Data Volume Management

The repo is already at 2GB+ from historical raw data. Adding 4 new daily sources will add approximately 200KB/day raw data. This is manageable short-term.

**Recommended approach**:
1. Short-term: No change needed. 200KB/day is trivial.
2. Medium-term (6+ months): Add a cleanup step to the pipeline that removes `data/raw/` directories older than 90 days. The scored snapshots in `data/scores/` preserve all historical information needed.
3. Long-term: Move `data/raw/` out of git entirely (GitHub Releases artifacts or external storage).

## Integration Points Summary

### Files to Create (NEW)

| File | Purpose |
|------|---------|
| `src/pipeline/fetchers/gdelt.ts` | GDELT Stability Timeline API fetcher (CSV, per-country) |
| `src/pipeline/fetchers/reliefweb.ts` | ReliefWeb API v2 active disasters fetcher (JSON) |
| `src/pipeline/fetchers/hdx.ts` | HDX HAPI conflict events + displacement fetcher (JSON) |
| `src/pipeline/fetchers/who-dons.ts` | WHO Disease Outbreak News fetcher (JSON) |
| `src/pipeline/scoring/freshness.ts` | Freshness decay weight calculator |
| `src/pipeline/config/sources.json` | Source tier config, decay parameters |
| `src/pipeline/config/fips-to-iso3.ts` | FIPS 10-4 to ISO3 country code mapping for GDELT |

### Files to Modify (EXISTING)

| File | Change |
|------|--------|
| `src/pipeline/fetchers/index.ts` | Add 4 new fetcher imports and calls to `Promise.allSettled` |
| `src/pipeline/scoring/normalize.ts` | Add `INDICATOR_RANGES` entries for 8 new indicators |
| `src/pipeline/scoring/engine.ts` | Implement baseline+signal blending formula; add sources to `SOURCE_CATALOG` |
| `src/pipeline/types.ts` | Add `fetchedAt?`, `dataDate?` to `RawIndicator`; add `SourceTier`, `SourceConfig`, `SourcesConfig` types |
| `src/pipeline/config/weights.json` | Add new indicator names to pillar assignments; bump version to 5.0.0 |

### Files Unchanged

| File | Why |
|------|-----|
| `src/pipeline/run.ts` | Pipeline stages unchanged; calls same `fetchAllSources()` and `computeAllScores()` |
| `src/pipeline/scoring/snapshot.ts` | Output format unchanged |
| `src/pipeline/scoring/history.ts` | Reads snapshots unchanged |
| `src/pipeline/utils/fs.ts` | Utility functions unchanged |
| `.github/workflows/data-pipeline.yml` | Only needs new env vars for ReliefWeb and HDX HAPI secrets |

## Suggested Build Order

Based on dependency analysis:

1. **Phase 1: Types and Config** -- Extend `types.ts` with `fetchedAt`, `dataDate`, `SourceTier`, `SourceConfig`. Create `sources.json`. Create `fips-to-iso3.ts`. Zero-risk, no behavior change.
2. **Phase 2: Freshness Module** -- Build `freshness.ts` with unit tests. Independent, testable in isolation.
3. **Phase 3: New Fetchers (one at a time)**:
   - ReliefWeb first (cleanest API, ISO3 native, well-documented, HIGH confidence)
   - WHO DONs second (no auth, test country name parsing)
   - HDX HAPI third (needs app_identifier, beta API)
   - GDELT last (most complex: per-country fetching, FIPS mapping, CSV parsing)
   - Wire each into `fetchers/index.ts` as ready
4. **Phase 4: Normalize Expansion** -- Add `INDICATOR_RANGES` for new indicators. Add to `weights.json` pillar assignments. At this point, new data flows but scoring still uses old formula (indicators are just averaged in).
5. **Phase 5: Scoring Engine Overhaul** -- Implement baseline+signal blending in `engine.ts`. This is the riskiest change and should come last, after all data is flowing correctly.
6. **Phase 6: Validation and Tuning** -- Run pipeline with both old and new formula, compare outputs. Tune decay parameters and signal influence weight. Test edge cases (country with only baseline data, country with only signal data, all signals failed).

**Rationale**: This order minimizes risk. Phases 1-4 add data without changing scoring behavior (new indicators participate in simple average, which is a minor improvement already). Phase 5 changes the formula only after all inputs are verified. Phase 6 validates the whole system.

## Caching Strategy

### Fetcher-Level Caching (Existing Pattern -- reuse exactly)

The existing `findLatestCached()` pattern works well and must be reused for all new fetchers:
- Each fetcher writes `{source}-parsed.json` to `data/raw/{date}/`
- On failure, falls back to the most recent cached version from any previous date
- This provides graceful degradation: if ReliefWeb is down today, yesterday's ReliefWeb data is used with appropriate freshness decay reducing its influence

### No Additional Caching Layer Needed

The daily pipeline pattern means each run starts fresh. Sources like ACLED and ReliefWeb provide their own lookback windows, so there is no need to maintain state between pipeline runs. The freshness decay system handles staleness naturally.

### Build-Time Caching

The Astro SSG build reads `data/scores/latest.json` only. No change needed. The snapshot format is unchanged, just richer indicator data inside the same structure.

## Failure Mode Analysis

| Failure | Impact | Mitigation |
|---------|--------|------------|
| GDELT API down | No instability signal for conflict pillar | Cached fallback + ACLED still provides daily conflict data |
| ReliefWeb API down | No active disaster signal | Cached fallback; INFORM natural/climate baselines still active |
| HDX HAPI down (beta) | No displacement or additional conflict data | Cached fallback; ACLED covers conflict events directly |
| WHO DONs API down | No outbreak signal | Cached fallback; INFORM health/epidemic baselines still active |
| All 4 new sources fail | No new signal tier data | ACLED + Advisories still provide some signal; formula degrades gracefully toward baseline |
| All signal sources fail | Zero signal influence | Formula returns pure baseline scoring, identical to current behavior |
| GDELT returns extreme instability | Signal overweights one country | 30% max signal influence caps the damage; freshness-weighted average across multiple signals dampens outliers |
| Stale baseline (GPI not updated in 2 years) | Baseline doesn't reflect reality | Freshness decay at 365-day half-life reduces GPI weight to ~25% after 2 years; signal sources compensate |
| FIPS-to-ISO3 mapping mismatch | GDELT data for some countries dropped | Log warnings, country still scored from other sources |

## Sources

- [GDELT Project](https://www.gdeltproject.org/) -- free, no auth, 15-minute updates
- [GDELT Stability Dashboard API](https://blog.gdeltproject.org/announcing-the-gdelt-stability-dashboard-api-stability-timeline/)
- [ReliefWeb API](https://apidoc.reliefweb.int/) -- free, requires appname, well-documented
- [HDX HAPI](https://hdx-hapi.readthedocs.io/) -- free, beta, ISO3 native
- [WHO Disease Outbreak News API](https://www.who.int/api/news/outbreaks/sfhelp) -- free, no auth
- [GDACS API](https://www.gdacs.org/gdacsapi/swagger/index.html) -- free, no auth (backup for natural disasters if ReliefWeb insufficient)
- [USGS Earthquake API](https://earthquake.usgs.gov/fdsnws/event/1/) -- free, no auth (backup for earthquakes)
