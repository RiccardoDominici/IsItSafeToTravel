import * as cheerio from 'cheerio';

/**
 * INFORM Risk edition discovery (formula v10, SPEC §6).
 *
 * The JRC publishes a new INFORM Risk workbook a few times a year, under a new
 * file name (e.g. INFORM_Risk_Mid_2025_v071.xlsx -> INFORM_Risk_Mid_2026_v073.xlsx).
 * The fetcher therefore reads the official Results-and-data page(s) on every run,
 * collects the edition workbook links, and keeps the one with the highest version.
 *
 * Parsing (link extraction, version selection) is kept pure so it can be unit
 * tested against a fake HTML page; only discoverLatestInformEdition() touches the
 * network.
 */

/** Project bot identity: the same string the SG tier2b fetcher uses (SG_BOT_UA). */
export const INFORM_USER_AGENT =
  'Mozilla/5.0 (compatible; IsItSafeToTravelBot/1.0; +https://isitsafetotravel.org)';

/** Official Results-and-data pages. Both are tried; links from every reachable page are merged. */
export const INFORM_RESULTS_PAGES: readonly string[] = [
  'https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Results-and-data/moduleId/1782/id/453/controller/Admin/action/Results',
  'https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Results-and-data',
];

/**
 * Edition workbooks only: INFORM_Risk_(Mid_)?YYYY_vNNN.xlsx. The Trend, Severity
 * and Subnational workbooks published next to them do not match and are ignored.
 */
export const INFORM_EDITION_FILE_RE = /^INFORM_Risk_(?:Mid_)?(\d{4})_v(\d{3})\.xlsx$/i;

const PAGE_TIMEOUT_MS = 30_000;

export interface InformEditionLink {
  /** File name, e.g. INFORM_Risk_Mid_2026_v073.xlsx (the store key). */
  file: string;
  /** Absolute download URL. */
  url: string;
  /** Year taken from the file name. The sheet year is authoritative for data; this is only a sanity hint. */
  fileYear: number;
  /** Version tag as published, e.g. "v073". */
  version: string;
  /** Numeric version, e.g. 73. */
  versionNumber: number;
}

export interface InformDiscoveryResult {
  /** Highest-version edition found across all reachable pages, or null. */
  edition: InformEditionLink | null;
  /** Pages that were fetched and parsed successfully. */
  pagesOk: string[];
  /** One human-readable entry per failed page. */
  errors: string[];
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Parse an edition workbook file name. Returns null for anything that is not an edition file. */
export function parseInformEditionFileName(name: string): Omit<InformEditionLink, 'url'> | null {
  const match = INFORM_EDITION_FILE_RE.exec(name);
  if (!match) return null;
  return {
    file: name,
    fileYear: Number(match[1]),
    version: `v${match[2]}`,
    versionNumber: Number(match[2]),
  };
}

/**
 * Collect every edition workbook link on one HTML page. Relative and absolute
 * hrefs are both resolved against the page URL; the file name is taken from the
 * URL path (query strings and percent-encoding are ignored).
 */
export function extractInformEditionLinks(html: string, pageUrl: string): InformEditionLink[] {
  const $ = cheerio.load(html);
  const byUrl = new Map<string, InformEditionLink>();

  $('[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    let absolute: URL;
    try {
      absolute = new URL(href, pageUrl);
    } catch {
      return; // malformed href: not a link we can follow
    }

    let fileName: string;
    try {
      fileName = decodeURIComponent(absolute.pathname.split('/').pop() ?? '');
    } catch {
      return; // malformed percent-encoding
    }

    const parsed = parseInformEditionFileName(fileName);
    if (!parsed) return;
    byUrl.set(absolute.href, { ...parsed, url: absolute.href });
  });

  return [...byUrl.values()];
}

/** "INFORM_Risk_Mid_2026_v073.xlsx" -> true. The Mid edition of a year follows its annual edition. */
function isMidEdition(file: string): boolean {
  return /^INFORM_Risk_Mid_/i.test(file);
}

/**
 * Highest version wins (v073 over v072 over v071). Ties go to the later file
 * year, then to the Mid edition over the annual one of the same year (the JRC
 * publishes "INFORM Risk YYYY" first and "INFORM Risk Mid YYYY" after it), then
 * to file name, so the choice is deterministic. Without the Mid rule a plain
 * name sort would pick INFORM_Risk_2026 over INFORM_Risk_Mid_2026 ("2" < "M").
 */
export function selectLatestInformEdition(links: readonly InformEditionLink[]): InformEditionLink | null {
  if (links.length === 0) return null;
  const sorted = [...links].sort(
    (a, b) =>
      b.versionNumber - a.versionNumber ||
      b.fileYear - a.fileYear ||
      Number(isMidEdition(b.file)) - Number(isMidEdition(a.file)) ||
      a.file.localeCompare(b.file),
  );
  return sorted[0];
}

/**
 * Fetch every results page (never throws), merge the edition links they list and
 * return the newest edition. A page that fails is recorded in `errors` and the
 * remaining pages are still used.
 */
export async function discoverLatestInformEdition(
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  pages: readonly string[] = INFORM_RESULTS_PAGES,
): Promise<InformDiscoveryResult> {
  const linksByFile = new Map<string, InformEditionLink>();
  const pagesOk: string[] = [];
  const errors: string[] = [];

  for (const pageUrl of pages) {
    try {
      const response = await fetchImpl(pageUrl, {
        headers: { 'User-Agent': INFORM_USER_AGENT, Accept: 'text/html' },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      pagesOk.push(pageUrl);
      for (const link of extractInformEditionLinks(html, pageUrl)) {
        if (!linksByFile.has(link.file)) linksByFile.set(link.file, link);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${pageUrl}: ${message}`);
    }
  }

  return {
    edition: selectLatestInformEdition([...linksByFile.values()]),
    pagesOk,
    errors,
  };
}
