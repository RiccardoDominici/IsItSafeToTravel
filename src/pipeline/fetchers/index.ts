import type { FetchResult } from '../types.js';
import { fetchWorldBank } from './worldbank.js';
import { fetchAcled } from './acled.js';
import { fetchAdvisories } from './advisories.js';
import { fetchGpi } from './gpi.js';
import { fetchInform } from './inform.js';
import { fetchReliefweb } from './reliefweb.js';
import { fetchGdacs } from './gdacs.js';
import { fetchGdelt } from './gdelt.js';

export { fetchWorldBank } from './worldbank.js';
export { fetchAcled } from './acled.js';
export { fetchAdvisories } from './advisories.js';
export { fetchGpi } from './gpi.js';
export { fetchInform } from './inform.js';
export { fetchReliefweb } from './reliefweb.js';
export { fetchGdacs } from './gdacs.js';
export { fetchGdelt } from './gdelt.js';

/**
 * Fetch all data sources in parallel using Promise.allSettled.
 * A failed fetcher does not prevent other fetchers from running.
 *
 * Sources:
 * - World Bank (governance, health, environment indicators) — free, no auth
 * - GPI (Global Peace Index) — free, Excel download
 * - INFORM (Risk Index) — free, JSON API
 * - ACLED (conflict events) — requires API key
 * - Advisories (US State Dept + UK FCDO) — free, no auth
 * - ReliefWeb (active humanitarian disasters) — free, no auth
 * - GDACS (natural disaster alerts) — free, no auth
 * - GDELT (media tone instability proxy) — free, no auth
 */
export async function fetchAllSources(date: string): Promise<FetchResult[]> {
  console.log(`[PIPELINE] Starting data fetch for ${date}...`);
  const startTime = Date.now();

  const results = await Promise.allSettled([
    fetchWorldBank(date),
    fetchGpi(date),
    fetchInform(date),
    fetchAcled(date),
    fetchAdvisories(date),
    fetchReliefweb(date),
    fetchGdacs(date),
    fetchGdelt(date),
  ]);

  const sourceNames = ['worldbank', 'gpi', 'inform', 'acled', 'advisories', 'reliefweb', 'gdacs', 'gdelt'];
  const fetchResults: FetchResult[] = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      source: sourceNames[index],
      success: false,
      countriesFound: 0,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      fetchedAt: new Date().toISOString(),
    };
  });

  const successCount = fetchResults.filter((r) => r.success).length;
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[PIPELINE] Fetched ${successCount}/${sourceNames.length} sources successfully in ${duration}s`,
  );

  for (const result of fetchResults) {
    const status = result.success ? 'OK' : 'FAILED';
    const detail = result.error ? ` (${result.error})` : '';
    console.log(
      `  ${status}: ${result.source} — ${result.countriesFound} countries${detail}`,
    );
  }

  return fetchResults;
}
