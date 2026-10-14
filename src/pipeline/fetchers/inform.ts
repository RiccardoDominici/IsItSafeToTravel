import type { FetchResult, RawSourceData } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { discoverLatestInformEdition, INFORM_USER_AGENT, type InformDiscoveryResult } from './inform-discovery.js';
import { parseInformWorkbook, InformSchemaError, type InformParseResult } from './inform-parse.js';
import {
  decideInformEdition,
  getInformStoreDir,
  readStoredInformEdition,
  storeInformEdition,
  type StoredInformEdition,
} from './inform-edition.js';

/**
 * INFORM Risk Index fetcher (formula v10, SPEC §2 and §6).
 *
 * Every run discovers the newest edition (highest vNNN on the official page). The
 * workbook is downloaded only when that edition is not already stored under
 * data/raw/inform/ (see inform-edition.ts). The per-date output is still
 * data/raw/<date>/inform-parsed.json, which run.ts and backfill.ts read.
 *
 * Failure handling, in order of preference:
 *  - discovery fails, a stored edition exists      -> use it, warn (success, with a note)
 *  - a NEW edition cannot be downloaded            -> keep the stored edition, warn (success, with a note)
 *  - a NEW edition fails the layout check          -> keep the stored edition, LOUD (success=false)
 *  - nothing usable stored                         -> last cached inform-parsed.json, but only one
 *                                                     written with the v10 column mapping
 *  - none of the above                             -> failed source, no INFORM data for the run
 *
 * The stored edition is preferred over the per-date cache because it is the parsed
 * source of truth: a cache file can predate the v10 mapping (the v9.1 files read
 * "Human" as health and "Institutional" as governance under the same names).
 */

const DOWNLOAD_TIMEOUT_MS = 120_000;
/** An .xlsx file is a ZIP container: it starts with "PK\x03\x04". Anything else is an HTML error page. */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Only the v10 parser emits this indicator. A cached inform-parsed.json without it was
 * written by the v9.1 parser, whose inform_governance came from the wrong column.
 */
const V10_INFORM_MARKER = 'inform_health_access';

export interface InformLoad {
  parsed: InformParseResult;
  edition: StoredInformEdition;
  notes: string[];
  /** True when a newly discovered edition failed the layout check (the stored one was used instead). */
  layoutFailure: boolean;
}

/** Network seams, injectable so the fallback paths are unit-tested without the JRC site. */
export interface InformDeps {
  discover: () => Promise<InformDiscoveryResult>;
  download: (url: string) => Promise<Buffer>;
}

async function downloadWorkbook(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { 'User-Agent': INFORM_USER_AGENT, Accept: '*/*' },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`download HTTP ${response.status}: ${url}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
    throw new Error(`download is not an xlsx workbook (${buffer.length} bytes): ${url}`);
  }
  return buffer;
}

const DEFAULT_DEPS: InformDeps = {
  discover: () => discoverLatestInformEdition(),
  download: downloadWorkbook,
};

function parseStoredEdition(storeDir: string, edition: StoredInformEdition): InformParseResult {
  return parseInformWorkbook(readFileSync(join(storeDir, edition.file)));
}

/**
 * True when a cached inform-parsed.json was written by the v10 parser (exact column
 * mapping). Older files must not be reused: same indicator names, wrong columns.
 */
export function isV10InformCache(data: RawSourceData | null): data is RawSourceData {
  return Boolean(data?.indicators?.some((ind) => ind.indicatorName === V10_INFORM_MARKER));
}

/**
 * Resolve the edition for this run (discover, decide, download or reuse), then parse it.
 * Transient problems throw plain Errors and layout problems throw InformSchemaError, but
 * only when no stored edition can stand in.
 */
export async function loadInformEdition(storeDir: string, deps: InformDeps = DEFAULT_DEPS): Promise<InformLoad> {
  const discovery = await deps.discover();
  for (const error of discovery.errors) console.warn(`[INFORM] Discovery page failed: ${error}`);
  if (discovery.edition) {
    console.log(
      `[INFORM] Discovered ${discovery.edition.file} (${discovery.edition.version}) from ${discovery.pagesOk.length} page(s)`,
    );
  }

  const stored = readStoredInformEdition(storeDir);
  const decision = decideInformEdition({
    discovered: discovery.edition,
    discoveryErrors: discovery.errors,
    stored,
  });

  const notes: string[] = [];

  switch (decision.action) {
    case 'fail':
      throw new Error(decision.reason);

    case 'use-stored': {
      if (decision.warning) {
        console.warn(`[INFORM] ${decision.warning}`);
        notes.push(decision.warning);
      }
      const parsed = parseStoredEdition(storeDir, decision.edition);
      console.log(
        `[INFORM] Using stored edition ${decision.edition.file} (sheet "${parsed.sheetName}", edition year ${parsed.editionYear}, no download)`,
      );
      return { parsed, edition: decision.edition, notes, layoutFailure: false };
    }

    case 'download': {
      const { link } = decision;
      console.log(`[INFORM] New edition ${link.file}: downloading ${link.url}`);
      try {
        const buffer = await deps.download(link.url);
        const parsed = parseInformWorkbook(buffer); // layout problems are rejected BEFORE the edition is stored
        const edition: StoredInformEdition = {
          file: link.file,
          version: link.version,
          url: link.url,
          sheetName: parsed.sheetName,
          editionYear: parsed.editionYear,
          firstSeen: new Date().toISOString(),
        };
        storeInformEdition(storeDir, edition, buffer);
        console.log(
          `[INFORM] Stored ${link.file} in ${storeDir} (sheet "${parsed.sheetName}", edition year ${parsed.editionYear})`,
        );
        return { parsed, edition, notes, layoutFailure: false };
      } catch (error) {
        // A new edition that cannot be fetched or read must not take the stored, still
        // valid edition down with it: the per-date cache would be the next fallback, and
        // on the first v10 day that cache predates the v10 column mapping.
        if (!stored) throw error;
        const layoutFailure = error instanceof InformSchemaError;
        const message = error instanceof Error ? error.message : String(error);
        const warning =
          `new edition ${link.file} ${layoutFailure ? 'failed the layout check' : 'could not be downloaded'} ` +
          `(${message}); kept stored edition ${stored.file}`;
        console.warn(`[INFORM] ${layoutFailure ? 'LAYOUT CHECK FAILED: ' : ''}${warning}`);
        const parsed = parseStoredEdition(storeDir, stored);
        return { parsed, edition: stored, notes: [warning], layoutFailure };
      }
    }
  }
}

export async function fetchInform(date: string, deps: InformDeps = DEFAULT_DEPS): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  try {
    const { parsed, edition, notes, layoutFailure } = await loadInformEdition(getInformStoreDir(), deps);

    console.log(
      `[INFORM] Mapped ${parsed.mapping.map((m) => `"${m.header}" -> ${m.indicator}`).join(', ')}`,
    );
    if (parsed.outOfRangeSkipped > 0) {
      console.warn(`[INFORM] Skipped ${parsed.outOfRangeSkipped} value(s) outside the 0-10 scale`);
    }
    console.log(
      `[INFORM] Parsed ${parsed.countries} countries, ${parsed.indicators.length} indicators (edition ${edition.editionYear}, ${edition.file})`,
    );

    const sourceData: RawSourceData = { source: 'inform', fetchedAt, indicators: parsed.indicators };
    writeJson(join(rawDir, 'inform-parsed.json'), sourceData);

    return {
      source: 'inform',
      // A new edition with a broken layout stays a failed source in the run summary even
      // though the stored edition still feeds the engine, so the layout change gets noticed.
      success: !layoutFailure,
      countriesFound: parsed.countries,
      ...(notes.length > 0 ? { error: notes.join('; ') } : {}),
      fetchedAt,
    };
  } catch (error) {
    const layoutFailure = error instanceof InformSchemaError;
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[INFORM] ${layoutFailure ? 'LAYOUT CHECK FAILED' : 'Fetch failed'}: ${message}`);

    const cached = findLatestCached('inform-parsed.json');
    const cachedData = cached ? readJson<RawSourceData>(cached) : null;
    if (cachedData && !isV10InformCache(cachedData)) {
      console.warn(
        `[INFORM] Cached ${cached} predates the v10 column mapping (no ${V10_INFORM_MARKER}); not reused`,
      );
    }
    if (isV10InformCache(cachedData)) {
      console.warn(`[INFORM] Using cached data from ${cached}`);
      writeJson(join(rawDir, 'inform-parsed.json'), cachedData);
      const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
      return {
        source: 'inform',
        // A layout failure stays a failed source in the run summary, while the cached
        // scores still feed the engine so a broken download cannot move every country.
        success: !layoutFailure,
        countriesFound: uniqueCountries.size,
        error: `${layoutFailure ? 'Layout check failed, cached data kept' : 'Used cached data'}. Original error: ${message}`,
        fetchedAt: cachedData.fetchedAt,
      };
    }

    return {
      source: 'inform',
      success: false,
      countriesFound: 0,
      error: message,
      fetchedAt,
    };
  }
}
