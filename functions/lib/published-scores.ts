// Formula v10 (SPEC §5): the vote endpoint records the published score itself. The widget never
// sends one, so a forged score cannot move the community signal.
//
// Pages Functions reach the project's static files through env.ASSETS, a Fetcher bound to the
// same deployment that served the page, so the score read here is the score that page showed.
//
// Source: /published-scores.json, a ~5 KB iso3 -> score map generated in the same `astro build`
// as the pages (src/pages/published-scores.json.ts). Not /scores.json: parsing that 1.6 MB file
// measured 8-17 ms of CPU, and votes are sparse enough that nearly every vote hits a cold isolate,
// so the parse would land on most votes against the Workers Free plan's 10 ms CPU budget.
//
// Cached per isolate: an isolate belongs to one deployment, whose static files never change.
// Failures are never cached, so a transient asset error cannot pin the cache.
//
// House style: functions/ does not import from src/ (see vote.ts). The payload shape mirrors
// PublishedScoresPayload in src/lib/published-scores.ts; functions/__tests__/published-scores.test.ts
// feeds this parser the output of that builder, so the two cannot drift apart unnoticed.

/** Static file carrying the published country scores (built by src/pages/published-scores.json.ts). */
export const PUBLISHED_SCORES_PATH = '/published-scores.json';

/** Minimal shape of the Pages assets binding (env.ASSETS). */
export interface AssetsBinding {
  fetch(input: URL | string): Promise<Response>;
}

/** iso3 -> published score. `null` marks a grey country (no official score). Absent = unknown. */
export type PublishedScoreIndex = ReadonlyMap<string, number | null>;

/** The vote type a country accepts: a relative delta (scored) or an absolute rating (grey). */
export type CountryKind = 'scored' | 'grey';

let cachedIndex: PublishedScoreIndex | null = null;

/** Test hook: forget the per-isolate cache. */
export function resetPublishedScoreCache(): void {
  cachedIndex = null;
}

/**
 * Classify a country from the index. `null` means the country is absent or its entry is
 * malformed: the vote type cannot be verified, so the caller must refuse the vote rather than
 * guess and store an unclassifiable row.
 */
export function classifyCountry(index: PublishedScoreIndex, iso3: string): CountryKind | null {
  if (!index.has(iso3)) return null;
  return index.get(iso3) === null ? 'grey' : 'scored';
}

/**
 * Build the index from a parsed /published-scores.json body (`{ date, scores: { ISO3: n | null } }`).
 * A finite number is a scored country, null a grey one; any other value is skipped and therefore
 * classifies as unknown. Returns null when the body has no usable countries at all.
 */
export function buildPublishedScoreIndex(body: unknown): PublishedScoreIndex | null {
  const scores = (body as { scores?: unknown } | null)?.scores;
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) return null;

  const index = new Map<string, number | null>();
  for (const [iso3, score] of Object.entries(scores as Record<string, unknown>)) {
    if (score === null) index.set(iso3, null);
    else if (typeof score === 'number' && Number.isFinite(score)) index.set(iso3, score);
  }
  return index.size > 0 ? index : null;
}

/**
 * Load the published score index through env.ASSETS, reusing the per-isolate cache when filled.
 * Never throws: any failure resolves to null, and the caller answers the vote as unavailable.
 */
export async function loadPublishedScoreIndex(
  assets: AssetsBinding | undefined,
  requestUrl: string,
): Promise<PublishedScoreIndex | null> {
  if (cachedIndex) return cachedIndex;
  if (!assets || typeof assets.fetch !== 'function') {
    console.warn('[vote] env.ASSETS binding missing; cannot read published scores');
    return null;
  }
  try {
    const res = await assets.fetch(new URL(PUBLISHED_SCORES_PATH, requestUrl));
    if (!res.ok) {
      console.warn(`[vote] ${PUBLISHED_SCORES_PATH} returned HTTP ${res.status}`);
      return null;
    }
    const index = buildPublishedScoreIndex(await res.json());
    if (!index) {
      console.warn(`[vote] ${PUBLISHED_SCORES_PATH} has no usable countries`);
      return null;
    }
    cachedIndex = index;
    return index;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[vote] reading ${PUBLISHED_SCORES_PATH} failed: ${message}`);
    return null;
  }
}
