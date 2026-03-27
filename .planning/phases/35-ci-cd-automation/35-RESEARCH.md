# Phase 35: CI/CD Automation - Research

**Researched:** 2026-03-27
**Domain:** GitHub Actions workflow for daily data pipeline with staggered fetching
**Confidence:** HIGH

## Summary

The project already has a working GitHub Actions data pipeline workflow (`.github/workflows/data-pipeline.yml`) that runs daily at 06:00 UTC with a 20-minute timeout. It currently executes `npx tsx src/pipeline/run.ts` which calls `fetchAllSources()` -- this function launches ALL 11 source fetchers in parallel via `Promise.allSettled`. The problem is that all 34+ advisory sources (spanning 11 fetcher groups) hit external government websites simultaneously, risking rate-limiting, IP blocking, and exceeding GitHub Actions resource limits.

The core change needed is replacing the parallel `Promise.allSettled` in `fetchAllSources()` with staggered batch execution -- fetching source groups sequentially with delays between batches. Each individual tier fetcher already handles its own internal sources sequentially with try/catch per source (graceful degradation is already built in at the per-source level). The workflow YAML needs minor updates for the new timeout and better error reporting, but the heavy lifting is in `src/pipeline/fetchers/index.ts`.

**Primary recommendation:** Modify `fetchAllSources()` in `src/pipeline/fetchers/index.ts` to execute fetchers in sequential batches with configurable delays between groups, keeping the existing per-fetcher `Promise.allSettled` for error isolation. Update the workflow timeout from 20 to 30 minutes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion.

### Claude's Discretion
All implementation choices, constrained by:
- GitHub Actions workflow triggers daily and fetches all 34+ advisory sources
- Sources fetched in staggered batches with delays between groups to respect rate limits and avoid IP blocking
- Individual source failures logged but don't block pipeline -- produces valid scores using available data
- Workflow completes within GitHub Actions free-tier time limits (under 30 minutes total)

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CI-01 | GitHub Actions workflow fetches all new advisory sources daily | Existing workflow already runs daily; needs timeout increase and better logging |
| CI-02 | Staggered fetching to respect rate limits across 30+ sources | Modify `fetchAllSources()` to run fetcher groups in sequential batches with delays |
| CI-03 | Graceful degradation: individual source failures don't block pipeline | Already implemented: each tier fetcher has per-source try/catch, `Promise.allSettled` at top level, `continue-on-error` in workflow |
</phase_requirements>

## Architecture Patterns

### Current Pipeline Architecture
```
.github/workflows/data-pipeline.yml
  -> npx tsx src/pipeline/run.ts
    -> fetchAllSources(date)          # src/pipeline/fetchers/index.ts
      -> Promise.allSettled([         # ALL 11 fetchers in PARALLEL
           fetchWorldBank(date),
           fetchGpi(date),
           fetchInform(date),
           fetchAdvisories(date),     # US, UK, CA, AU (sequential internally)
           fetchTier1Advisories(date), # DE, NL, JP, SK (sequential internally)
           fetchTier2aAdvisories(date),# FR, NZ, IE, FI, HK, BR, AT, PH (sequential)
           fetchTier2bAdvisories(date),# BE, DK, SG, RO, RS, EE, HR, AR (sequential)
           fetchTier3aAdvisories(date),# IT, ES, KR, TW, CN, IN (sequential)
           fetchTier3bAdvisories(date),# CH, SE, NO, PL, CZ, HU, PT (sequential)
           fetchReliefweb(date),
           fetchGdacs(date),
         ])
    -> computeAllScores(rawDataMap, weightsConfig)
    -> writeSnapshot(date, ...)
    -> writeHistoryIndex()
```

### Recommended Staggered Architecture
```
fetchAllSources(date)
  -> Batch 1 (baseline indices -- slow but independent APIs):
       fetchWorldBank, fetchGpi, fetchInform
     [delay 5s]
  -> Batch 2 (core advisories -- US, UK, CA, AU + GDACS/ReliefWeb):
       fetchAdvisories, fetchReliefweb, fetchGdacs
     [delay 5s]
  -> Batch 3 (tier 1+2a advisories):
       fetchTier1Advisories, fetchTier2aAdvisories
     [delay 5s]
  -> Batch 4 (tier 2b+3a advisories):
       fetchTier2bAdvisories, fetchTier3aAdvisories
     [delay 5s]
  -> Batch 5 (tier 3b advisories):
       fetchTier3bAdvisories
```

### Key Design Decisions

**Batching strategy:** Group fetchers that hit different servers together. Each tier fetcher already hits multiple government sites sequentially -- so two tier fetchers in the same batch won't overload any single server.

**Delay between batches:** 5 seconds is sufficient. The concern is not rate-limiting a single server (each tier handles that internally) but rather not opening 34+ concurrent HTTP connections from one GitHub Actions runner IP.

**Within-tier behavior unchanged:** Each `fetchTierXAdvisories()` already runs its per-country fetchers sequentially with try/catch. No changes needed inside tier fetchers.

### Source Inventory (11 fetcher groups, 34+ external sources)

| Fetcher | Sources | Internal Pattern | Output Files |
|---------|---------|-----------------|--------------|
| `fetchWorldBank` | World Bank API (6 indicators) | Parallel per indicator | worldbank-parsed.json |
| `fetchGpi` | Vision of Humanity (1 Excel) | Single download | gpi.xlsx, gpi-parsed.json |
| `fetchInform` | INFORM Risk Index (1 Excel) | Single download | inform.xlsx, inform-parsed.json |
| `fetchAdvisories` | US, UK, CA, AU (4 sources) | Sequential with workers | advisories-*.json, advisories-parsed.json |
| `fetchTier1Advisories` | DE, NL, JP, SK (4 sources) | Sequential with workers | advisories-tier1-*.json |
| `fetchTier2aAdvisories` | FR, NZ, IE, FI, HK, BR, AT, PH (8 sources) | Sequential per source | advisories-tier2a-*.json |
| `fetchTier2bAdvisories` | BE, DK, SG, RO, RS, EE, HR, AR (8 sources) | Sequential per source | advisories-tier2b-*.json |
| `fetchTier3aAdvisories` | IT, ES, KR, TW, CN, IN (6 sources) | Sequential per source | advisories-tier3a-*.json |
| `fetchTier3bAdvisories` | CH, SE, NO, PL, CZ, HU, PT (7 sources) | Sequential per source | advisories-tier3b-*.json |
| `fetchReliefweb` | ReliefWeb API (1 source) | Single API call | reliefweb.json, reliefweb-parsed.json |
| `fetchGdacs` | GDACS RSS (1 source) | Single fetch | gdacs.json, gdacs-parsed.json |

### Anti-Patterns to Avoid
- **Running all 11 fetchers in parallel:** Current behavior; risks IP blocking from GitHub Actions shared IPs
- **Adding per-source delays inside existing tier fetchers:** They already run sequentially; adding artificial delays would bloat runtime unnecessarily
- **Separate workflow per fetcher group:** Over-engineers the solution; a single workflow with staggered batches is simpler and stays within free tier

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Batch execution with delays | Custom scheduler | Simple async loop with `setTimeout` wrapped in Promise | Few lines, no dependency needed |
| Error aggregation | Custom error tracker | Existing `FetchResult[]` pattern | Already returns success/failure per source |
| Caching/fallback | Custom cache | Existing `findLatestCached()` | Already falls back to previous day's data |

## Common Pitfalls

### Pitfall 1: GitHub Actions Shared IP Rate Limiting
**What goes wrong:** Multiple GitHub Actions runners share IP ranges. Government sites may rate-limit or block these IPs if too many concurrent connections arrive.
**Why it happens:** All 11 fetchers launch simultaneously, opening 30+ HTTP connections in parallel.
**How to avoid:** Sequential batch execution with 5-second delays between batches.
**Warning signs:** HTTP 429, 503, or connection timeout errors in CI logs.

### Pitfall 2: Timeout Exceeding Free Tier
**What goes wrong:** Workflow exceeds the 20-minute timeout (currently set) or GitHub Actions free-tier limits.
**Why it happens:** Sequential fetching takes longer than parallel. Some government sites are slow (especially tier 3 complex scraping).
**How to avoid:** Increase timeout to 30 minutes. Keep batch-internal parallelism where fetchers hit different servers. Monitor actual runtime.
**Warning signs:** Workflow cancelled due to timeout.

### Pitfall 3: Git Push Conflict on Data Commit
**What goes wrong:** The pipeline's `git push` fails because another workflow (e.g., deploy) pushed between checkout and push.
**Why it happens:** Race condition between scheduled pipeline and manual pushes.
**How to avoid:** The existing workflow already handles this correctly (only pushes if there are changes). The `git push` is the last step. No changes needed.

### Pitfall 4: Missing Environment Variables
**What goes wrong:** Pipeline fails because `RELIEFWEB_APPNAME` secret is not configured.
**Why it happens:** Secret not set in GitHub repo settings.
**How to avoid:** Already configured (existing workflow uses it). Document the required secrets.

### Pitfall 5: Stale xlsx Dependencies in CI
**What goes wrong:** `npm ci` fails or `xlsx` package doesn't work on ubuntu-latest.
**Why it happens:** `xlsx` is a devDependency used by GPI and INFORM fetchers.
**How to avoid:** Already works -- existing pipeline uses `npm ci` which installs devDependencies by default. No changes needed.

## Code Examples

### Staggered Batch Execution Pattern
```typescript
// In src/pipeline/fetchers/index.ts

interface FetchBatchConfig {
  name: string;
  fetchers: Array<() => Promise<FetchResult>>;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const BATCH_DELAY_MS = 5000;

export async function fetchAllSources(date: string): Promise<FetchResult[]> {
  console.log(`[PIPELINE] Starting staggered fetch for ${date}...`);
  const startTime = Date.now();

  const batches: FetchBatchConfig[] = [
    {
      name: 'Batch 1: Baseline indices',
      fetchers: [
        () => fetchWorldBank(date),
        () => fetchGpi(date),
        () => fetchInform(date),
      ],
    },
    {
      name: 'Batch 2: Core advisories + disasters',
      fetchers: [
        () => fetchAdvisories(date),
        () => fetchReliefweb(date),
        () => fetchGdacs(date),
      ],
    },
    {
      name: 'Batch 3: Tier 1+2a advisories',
      fetchers: [
        () => fetchTier1Advisories(date),
        () => fetchTier2aAdvisories(date),
      ],
    },
    {
      name: 'Batch 4: Tier 2b+3a advisories',
      fetchers: [
        () => fetchTier2bAdvisories(date),
        () => fetchTier3aAdvisories(date),
      ],
    },
    {
      name: 'Batch 5: Tier 3b advisories',
      fetchers: [
        () => fetchTier3bAdvisories(date),
      ],
    },
  ];

  const allResults: FetchResult[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\n[PIPELINE] ${batch.name}`);

    const results = await Promise.allSettled(
      batch.fetchers.map(fn => fn())
    );

    // Process results same as current pattern...

    if (i < batches.length - 1) {
      console.log(`[PIPELINE] Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`);
      await delay(BATCH_DELAY_MS);
    }
  }

  return allResults;
}
```

### Updated Workflow YAML
```yaml
# Key changes to .github/workflows/data-pipeline.yml
jobs:
  pipeline:
    runs-on: ubuntu-latest
    timeout-minutes: 30  # Increased from 20

    steps:
      # ... (checkout, setup, install same as current)

      - name: Run data pipeline
        run: npx tsx src/pipeline/run.ts ${{ github.event.inputs.date || '' }}
        env:
          RELIEFWEB_APPNAME: ${{ secrets.RELIEFWEB_APPNAME }}
        continue-on-error: true
        id: pipeline

      - name: Check pipeline output
        run: |
          if [ -f "data/scores/latest.json" ]; then
            echo "Pipeline produced output"
            COUNTRY_COUNT=$(node -e "const d=JSON.parse(require('fs').readFileSync('data/scores/latest.json','utf8')); console.log(d.countries.length)")
            echo "Countries scored: $COUNTRY_COUNT"
            if [ "$COUNTRY_COUNT" -lt 100 ]; then
              echo "::warning::Only $COUNTRY_COUNT countries scored (expected 180+)"
            fi
          else
            echo "::warning::Pipeline did not produce output"
            exit 1
          fi
```

## Existing Infrastructure Analysis

### What Already Works (No Changes Needed)
1. **Workflow trigger:** Daily cron at 06:00 UTC + manual dispatch -- correct
2. **Git commit/push:** Auto-commits data changes with bot identity -- correct
3. **Deploy chain:** Push to master triggers Cloudflare Pages deploy -- correct
4. **Graceful degradation:** Each tier fetcher has per-source try/catch -- CI-03 already mostly met
5. **Caching:** `findLatestCached()` falls back to previous day's data if fetch fails
6. **`continue-on-error: true`** on pipeline step -- workflow doesn't fail on partial fetch failure
7. **Node 22 + npm ci** -- matches local development setup

### What Needs Changing
1. **`src/pipeline/fetchers/index.ts`:** Replace `Promise.allSettled` parallel execution with staggered batch execution (5 batches with delays)
2. **`.github/workflows/data-pipeline.yml`:** Increase `timeout-minutes` from 20 to 30
3. **Optional:** Add summary step showing per-source success/failure in workflow output

### Secrets Already Configured
| Secret | Used By | Status |
|--------|---------|--------|
| `GITHUB_TOKEN` | Git push in pipeline | Auto-provided |
| `RELIEFWEB_APPNAME` | ReliefWeb API | Must be configured in repo settings |
| `CLOUDFLARE_API_TOKEN` | Deploy workflow | Already configured (separate workflow) |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy workflow | Already configured (separate workflow) |

## Open Questions

1. **Actual runtime of staggered fetching**
   - What we know: Current parallel execution takes under 20 minutes. Staggered will take longer due to sequential batching + delays.
   - What's unclear: Exact runtime of staggered approach. 5 batches * ~3-5 min each + 4 * 5s delays = ~15-25 min estimated.
   - Recommendation: Set timeout to 30 minutes, monitor first few runs, adjust batch grouping if needed.

2. **RELIEFWEB_APPNAME secret**
   - What we know: The workflow references it. The existing workflow uses it.
   - What's unclear: Whether it's already configured in the GitHub repo settings.
   - Recommendation: Verify during implementation. If not set, the ReliefWeb fetcher will fall back to cached data.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `.github/workflows/data-pipeline.yml` (existing workflow)
- Direct codebase analysis of `src/pipeline/fetchers/index.ts` (current parallel execution)
- Direct codebase analysis of all 7 tier fetcher files (internal sequential + try/catch patterns)
- Direct codebase analysis of `src/pipeline/run.ts` (pipeline orchestration)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, existing GitHub Actions + Node.js + tsx
- Architecture: HIGH - minimal change to existing working pipeline
- Pitfalls: HIGH - well-understood domain (CI rate limiting, timeouts)

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable infrastructure, unlikely to change)
