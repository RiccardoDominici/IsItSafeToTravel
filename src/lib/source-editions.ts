/**
 * Editions of the slow sources, read from the data the site is built from (formula v10, SPEC §7:
 * "Sources page: show each source's edition"). Used by the methodology indicator table and the
 * sources pages, so "INFORM Risk 2026" or "GPI 2026" is never typed by hand and goes stale.
 *
 *  - INFORM: data/raw/inform/edition.json, written by the pipeline when it stores a new edition
 *    (sheet "INFORM Risk 2026 (a-z)", version "v073" -> "INFORM Risk 2026 (v0.7.3)"); falls back
 *    to the newest INFORM indicator year in the snapshot.
 *  - GPI, UCDP, V-Dem: the newest data year of their indicators in data/scores/latest.json.
 *  - World Bank: no single edition; the latest published year varies by country (the copy says so).
 *
 * Build-time only (Node fs); cached per process.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadLatestScores } from './scores';

export interface SourceEditions {
  /** e.g. "INFORM Risk 2026 (v0.7.3)" */
  inform: string;
  /** e.g. "2026" (GPI edition year) */
  gpi: string;
  /** e.g. "2025" (newest UCDP data year) */
  ucdp: string;
  /** e.g. "2025" (newest V-Dem data year) */
  vdem: string;
}

let cache: SourceEditions | null = null;

function newestYear(source: string): number | null {
  let max: number | null = null;
  for (const country of loadLatestScores()) {
    for (const pillar of country.pillars) {
      for (const ind of pillar.indicators) {
        if (ind.source === source && Number.isFinite(ind.year) && (max === null || ind.year > max)) max = ind.year;
      }
    }
  }
  return max;
}

/** "v073" -> "v0.7.3"; anything else is returned unchanged. */
function formatInformVersion(version: string): string {
  const m = /^v(\d)(\d)(\d)$/.exec(version);
  return m ? `v${m[1]}.${m[2]}.${m[3]}` : version;
}

function readInformEdition(): string | null {
  const file = path.join(process.cwd(), 'data', 'raw', 'inform', 'edition.json');
  if (!fs.existsSync(file)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(file, 'utf-8')) as { sheetName?: string; editionYear?: number; version?: string };
    const fromSheet = /INFORM Risk(?: Mid)? \d{4}/.exec(meta.sheetName ?? '')?.[0];
    const name = fromSheet ?? (meta.editionYear ? `INFORM Risk ${meta.editionYear}` : null);
    if (!name) return null;
    return meta.version ? `${name} (${formatInformVersion(meta.version)})` : name;
  } catch {
    return null;
  }
}

export function getSourceEditions(): SourceEditions {
  if (cache) return cache;
  const informYear = newestYear('inform');
  cache = {
    inform: readInformEdition() ?? (informYear ? `INFORM Risk ${informYear}` : 'INFORM Risk'),
    gpi: String(newestYear('gpi') ?? ''),
    ucdp: String(newestYear('ucdp') ?? ''),
    vdem: String(newestYear('vdem') ?? ''),
  };
  return cache;
}
