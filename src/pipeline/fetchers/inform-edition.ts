import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, readJson, writeJson } from '../utils/fs.js';
import type { InformEditionLink } from './inform-discovery.js';

/**
 * The INFORM edition store (formula v10, SPEC §6). A workbook is stored ONCE under
 * data/raw/inform/ together with edition.json, instead of being copied into every
 * date folder. The daily run downloads only when the discovered file name differs
 * from the stored one, and the stored copy is the fallback when discovery fails.
 */

export interface StoredInformEdition {
  /** Stored workbook file name, e.g. INFORM_Risk_Mid_2026_v073.xlsx. */
  file: string;
  /** Version tag, e.g. "v073". */
  version: string;
  /** Official download URL the workbook was fetched from. */
  url: string;
  /** Main sheet name, e.g. "INFORM Risk 2026 (a-z)". */
  sheetName: string;
  /** Edition year parsed from the sheet name. */
  editionYear: number;
  /** ISO 8601 instant the edition was first stored (a timestamp, so "stored during this run" is decidable). */
  firstSeen: string;
}

/** Store directory: data/raw/inform (not a date folder, so the date-based readers skip it). */
export function getInformStoreDir(): string {
  return join(process.cwd(), 'data', 'raw', 'inform');
}

/** "v073" -> 73. Returns NaN for anything that is not a version tag. */
export function informVersionNumber(version: string): number {
  const match = /^v(\d{3})$/i.exec(version);
  return match ? Number(match[1]) : Number.NaN;
}

/**
 * Read edition.json. Returns null when it is missing, unreadable or points at a
 * workbook that is not on disk, so callers treat that case as "nothing stored".
 */
export function readStoredInformEdition(storeDir: string): StoredInformEdition | null {
  const meta = readJson<StoredInformEdition>(join(storeDir, 'edition.json'));
  if (!meta || typeof meta.file !== 'string' || meta.file.length === 0) return null;
  if (!existsSync(join(storeDir, meta.file))) return null;
  return meta;
}

/**
 * Persist a workbook and its edition.json. The workbook is written first (via a temp
 * file and rename) and edition.json last, so edition.json only ever points at a
 * complete workbook.
 */
export function storeInformEdition(
  storeDir: string,
  edition: StoredInformEdition,
  workbook: Buffer,
): void {
  ensureDir(storeDir);
  const target = join(storeDir, edition.file);
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, workbook);
  renameSync(tmp, target);
  writeJson(join(storeDir, 'edition.json'), edition);
}

export type InformEditionDecision =
  | { action: 'use-stored'; edition: StoredInformEdition; warning?: string }
  | { action: 'download'; link: InformEditionLink }
  | { action: 'fail'; reason: string };

/**
 * Decide what to do with the INFORM workbook for this run. Pure, so every branch is
 * unit-tested without touching the network or the disk.
 *
 *  - discovery found nothing, a workbook is stored -> keep the stored one (warning)
 *  - discovery found nothing, nothing stored       -> fail (the caller falls back to cache)
 *  - discovered file equals the stored file        -> use stored, no download
 *  - discovered version is OLDER than stored       -> keep stored (never downgrade)
 *  - otherwise (new edition)                       -> download and store it
 */
export function decideInformEdition(params: {
  discovered: InformEditionLink | null;
  discoveryErrors: readonly string[];
  stored: StoredInformEdition | null;
}): InformEditionDecision {
  const { discovered, discoveryErrors, stored } = params;
  const errorSummary = discoveryErrors.length > 0 ? discoveryErrors.join('; ') : 'no edition links found';

  if (!discovered) {
    if (stored) {
      return {
        action: 'use-stored',
        edition: stored,
        warning: `discovery failed (${errorSummary}); kept stored edition ${stored.file}`,
      };
    }
    return { action: 'fail', reason: `no INFORM edition discovered (${errorSummary}) and none stored` };
  }

  if (stored && stored.file === discovered.file) {
    return { action: 'use-stored', edition: stored };
  }

  if (stored) {
    const discoveredVersion = informVersionNumber(discovered.version);
    const storedVersion = informVersionNumber(stored.version);
    if (Number.isFinite(discoveredVersion) && Number.isFinite(storedVersion) && discoveredVersion < storedVersion) {
      return {
        action: 'use-stored',
        edition: stored,
        warning: `discovered ${discovered.file} is older than stored ${stored.file}; not downgrading`,
      };
    }
  }

  return { action: 'download', link: discovered };
}
