import type { FetchResult, RawSourceData } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { discoverLatestInformEdition, INFORM_USER_AGENT } from './inform-discovery.js';
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
 * Failure handling:
 *  - discovery fails, a stored edition exists  -> use it, warn (success, with a note)
 *  - network / download failure                -> last cached inform-parsed.json (success, with a note)
 *  - layout change (expected header missing)   -> loud: success=false, cached data kept so the scores stay stable
 */

const DOWNLOAD_TIMEOUT_MS = 120_000;
/** An .xlsx file is a ZIP container: it starts with "PK\x03\x04". Anything else is an HTML error page. */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

interface InformLoad {
  parsed: InformParseResult;
  edition: StoredInformEdition;
  notes: string[];
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

/**
 * Resolve the edition for this run (discover, decide, download or reuse), then parse it.
 * Transient problems throw plain Errors. Layout problems throw InformSchemaError.
 */
async function loadInformEdition(storeDir: string): Promise<InformLoad> {
  const discovery = await discoverLatestInformEdition();
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
      const buffer = readFileSync(join(storeDir, decision.edition.file));
      const parsed = parseInformWorkbook(buffer);
      console.log(
        `[INFORM] Using stored edition ${decision.edition.file} (sheet "${parsed.sheetName}", edition year ${parsed.editionYear}, no download)`,
      );
      return { parsed, edition: decision.edition, notes };
    }

    case 'download': {
      const { link } = decision;
      console.log(`[INFORM] New edition ${link.file}: downloading ${link.url}`);
      const buffer = await downloadWorkbook(link.url);
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
      return { parsed, edition, notes };
    }
  }
}

export async function fetchInform(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  try {
    const { parsed, edition, notes } = await loadInformEdition(getInformStoreDir());

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
      success: true,
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
    if (cachedData) {
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
