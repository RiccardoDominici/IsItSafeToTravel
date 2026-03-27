import type { FetchResult } from '../types.js';
import { fetchWorldBank } from './worldbank.js';

import { fetchAdvisories } from './advisories.js';
import { fetchGpi } from './gpi.js';
import { fetchInform } from './inform.js';
import { fetchReliefweb } from './reliefweb.js';
import { fetchGdacs } from './gdacs.js';
import { fetchTier1Advisories } from './advisories-tier1.js';
import { fetchTier2aAdvisories } from './advisories-tier2a.js';
import { fetchTier2bAdvisories } from './advisories-tier2b.js';
import { fetchTier3aAdvisories } from './advisories-tier3a.js';
import { fetchTier3bAdvisories } from './advisories-tier3b.js';

export { fetchWorldBank } from './worldbank.js';

export { fetchAdvisories } from './advisories.js';
export { fetchTier1Advisories } from './advisories-tier1.js';
export { fetchTier2aAdvisories } from './advisories-tier2a.js';
export { fetchTier2bAdvisories } from './advisories-tier2b.js';
export { fetchTier3aAdvisories } from './advisories-tier3a.js';
export { fetchTier3bAdvisories } from './advisories-tier3b.js';
export { fetchGpi } from './gpi.js';
export { fetchInform } from './inform.js';
export { fetchReliefweb } from './reliefweb.js';
export { fetchGdacs } from './gdacs.js';

/** Delay between advisory batch fetches (ms) to avoid rate limiting */
const BATCH_DELAY_MS = 3000;

/**
 * Settle a batch of fetcher promises and convert to FetchResult[].
 * Each failed fetcher is captured — never blocks the batch.
 */
async function settleBatch(
  fetchers: Array<{ name: string; fn: () => Promise<FetchResult> }>,
): Promise<FetchResult[]> {
  const results = await Promise.allSettled(fetchers.map((f) => f.fn()));
  return results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      source: fetchers[i].name,
      success: false,
      countriesFound: 0,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      fetchedAt: new Date().toISOString(),
    };
  });
}

/** Simple async delay helper */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch all data sources with staggered advisory batching.
 *
 * Non-advisory sources (World Bank, GPI, INFORM, ReliefWeb, GDACS) are fetched
 * in parallel first. Advisory sources are then fetched in staggered batches
 * with a configurable delay between groups to prevent rate limiting when
 * hitting 34+ government websites.
 *
 * A failed fetcher never blocks other fetchers from running.
 *
 * Batch order:
 *   1. Base sources (worldbank, gpi, inform, reliefweb, gdacs) — parallel
 *   2. Base advisories (US, UK, CA, AU) — after base sources
 *   3. Tier 1 (DE, NL, JP, SK) — +3s delay
 *   4. Tier 2a (FR, NZ, IE, FI, HK, BR, AT, PH) — +3s delay
 *   5. Tier 2b (BE, DK, SG, RO, RS, EE, HR, AR) — +3s delay
 *   6. Tier 3a (IT, ES, KR, TW, CN, IN) — +3s delay
 *   7. Tier 3b (CH, SE, NO, PL, CZ, HU, PT) — +3s delay
 */
export async function fetchAllSources(date: string): Promise<FetchResult[]> {
  console.log(`[PIPELINE] Starting data fetch for ${date}...`);
  const startTime = Date.now();
  const allResults: FetchResult[] = [];

  // Batch 1: Non-advisory base sources (fetched in parallel)
  console.log(`\n[PIPELINE] Batch 1/7: Base sources (worldbank, gpi, inform, reliefweb, gdacs)`);
  const batchStart1 = Date.now();
  const batch1 = await settleBatch([
    { name: 'worldbank', fn: () => fetchWorldBank(date) },
    { name: 'gpi', fn: () => fetchGpi(date) },
    { name: 'inform', fn: () => fetchInform(date) },
    { name: 'reliefweb', fn: () => fetchReliefweb(date) },
    { name: 'gdacs', fn: () => fetchGdacs(date) },
  ]);
  allResults.push(...batch1);
  console.log(`  Batch 1 complete in ${((Date.now() - batchStart1) / 1000).toFixed(1)}s`);

  // Advisory batches — staggered with delays
  const advisoryBatches: Array<{
    label: string;
    fetchers: Array<{ name: string; fn: () => Promise<FetchResult> }>;
  }> = [
    {
      label: 'Batch 2/7: Base advisories (US, UK, CA, AU)',
      fetchers: [{ name: 'advisories', fn: () => fetchAdvisories(date) }],
    },
    {
      label: 'Batch 3/7: Tier 1 advisories (DE, NL, JP, SK)',
      fetchers: [{ name: 'advisories_tier1', fn: () => fetchTier1Advisories(date) }],
    },
    {
      label: 'Batch 4/7: Tier 2a advisories (FR, NZ, IE, FI, HK, BR, AT, PH)',
      fetchers: [{ name: 'advisories_tier2a', fn: () => fetchTier2aAdvisories(date) }],
    },
    {
      label: 'Batch 5/7: Tier 2b advisories (BE, DK, SG, RO, RS, EE, HR, AR)',
      fetchers: [{ name: 'advisories_tier2b', fn: () => fetchTier2bAdvisories(date) }],
    },
    {
      label: 'Batch 6/7: Tier 3a advisories (IT, ES, KR, TW, CN, IN)',
      fetchers: [{ name: 'advisories_tier3a', fn: () => fetchTier3aAdvisories(date) }],
    },
    {
      label: 'Batch 7/7: Tier 3b advisories (CH, SE, NO, PL, CZ, HU, PT)',
      fetchers: [{ name: 'advisories_tier3b', fn: () => fetchTier3bAdvisories(date) }],
    },
  ];

  for (let i = 0; i < advisoryBatches.length; i++) {
    const batch = advisoryBatches[i];
    if (i > 0) {
      console.log(`  Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`);
      await delay(BATCH_DELAY_MS);
    }
    console.log(`\n[PIPELINE] ${batch.label}`);
    const batchStart = Date.now();
    const batchResults = await settleBatch(batch.fetchers);
    allResults.push(...batchResults);
    console.log(`  ${batch.label.split(':')[0]} complete in ${((Date.now() - batchStart) / 1000).toFixed(1)}s`);
  }

  // Summary
  const successCount = allResults.filter((r) => r.success).length;
  const failedCount = allResults.length - successCount;
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n[PIPELINE] ========== FETCH SUMMARY ==========`);
  console.log(`[PIPELINE] Total: ${allResults.length} sources | Succeeded: ${successCount} | Failed: ${failedCount} | Duration: ${totalDuration}s`);
  console.log(`[PIPELINE] ====================================`);

  for (const result of allResults) {
    const status = result.success ? 'OK' : 'FAILED';
    const detail = result.error ? ` (${result.error})` : '';
    console.log(
      `  ${status}: ${result.source} — ${result.countriesFound} countries${detail}`,
    );
  }

  if (failedCount > 0) {
    console.log(`\n[PIPELINE] WARNING: ${failedCount} source(s) failed — pipeline continues with available data`);
  }

  return allResults;
}
