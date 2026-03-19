import type { FetchResult } from '../types.js';
import { fetchInform } from './inform.js';
import { fetchGpi } from './gpi.js';
import { fetchAcled } from './acled.js';
import { fetchAdvisories } from './advisories.js';

export { fetchInform } from './inform.js';
export { fetchGpi } from './gpi.js';
export { fetchAcled } from './acled.js';
export { fetchAdvisories } from './advisories.js';

/**
 * Fetch all data sources in parallel using Promise.allSettled.
 * A failed fetcher does not prevent other fetchers from running.
 */
export async function fetchAllSources(date: string): Promise<FetchResult[]> {
  console.log(`[PIPELINE] Starting data fetch for ${date}...`);
  const startTime = Date.now();

  const results = await Promise.allSettled([
    fetchInform(date),
    fetchGpi(date),
    fetchAcled(date),
    fetchAdvisories(date),
  ]);

  const fetchResults: FetchResult[] = results.map((result, index) => {
    const sourceNames = ['inform', 'gpi', 'acled', 'advisories'];
    if (result.status === 'fulfilled') {
      return result.value;
    }
    // Promise rejection — unexpected error
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
    `[PIPELINE] Fetched ${successCount}/4 sources successfully in ${duration}s`
  );

  for (const result of fetchResults) {
    const status = result.success ? 'OK' : 'FAILED';
    const detail = result.error ? ` (${result.error})` : '';
    console.log(
      `  ${status}: ${result.source} — ${result.countriesFound} countries${detail}`
    );
  }

  return fetchResults;
}
