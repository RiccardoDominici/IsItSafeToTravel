import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import * as XLSX from 'xlsx';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  INFORM_RESULTS_PAGES,
  INFORM_USER_AGENT,
  discoverLatestInformEdition,
  extractInformEditionLinks,
  parseInformEditionFileName,
  selectLatestInformEdition,
  type InformDiscoveryResult,
  type InformEditionLink,
} from '../fetchers/inform-discovery.js';
import { isV10InformCache, loadInformEdition } from '../fetchers/inform.js';
import { COUNTRIES } from '../config/countries.js';
import {
  InformSchemaError,
  parseInformEditionYear,
  parseInformWorkbook,
  resolveInformColumns,
} from '../fetchers/inform-parse.js';
import {
  decideInformEdition,
  informVersionNumber,
  readStoredInformEdition,
  storeInformEdition,
  type StoredInformEdition,
} from '../fetchers/inform-edition.js';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const DEFAULT_HEADERS = [
  'COUNTRY',
  'ISO3',
  'INFORM RISK',
  'Natural',
  'Human',
  'River Flood',
  'Epidemic',
  'Institutional',
  'Governance',
  'Access to health care',
  'LACK OF COPING CAPACITY',
];

interface SyntheticRow {
  iso3: string;
  values: Record<string, number>;
}

/**
 * Build a tiny INFORM-shaped workbook in memory: a cover sheet, then the main
 * "INFORM Risk YYYY (a-z)" sheet with a spacer row, the header row, a "(0-10)" scale
 * row and the data rows, which is the layout of the real JRC file.
 */
function buildInformWorkbook(opts: {
  headers?: string[];
  rows?: SyntheticRow[];
  sheetName?: string;
} = {}): Buffer {
  const headers = opts.headers ?? DEFAULT_HEADERS;
  const aoa: unknown[][] = [
    headers.map(() => ''),
    headers,
    headers.map((h, i) => (i < 2 ? '(a-z)' : '(0-10)')),
  ];
  for (const row of opts.rows ?? []) {
    aoa.push(
      headers.map((h) => {
        if (h === 'COUNTRY') return row.iso3;
        if (h === 'ISO3') return row.iso3;
        if (h in row.values) return row.values[h];
        return 0;
      }),
    );
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['About']]), 'About');
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(aoa),
    opts.sheetName ?? 'INFORM Risk 2026 (a-z)',
  );
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function edition(file: string, version: string, editionYear = 2026): StoredInformEdition {
  return {
    file,
    version,
    url: `https://example.org/${file}`,
    sheetName: `INFORM Risk ${editionYear} (a-z)`,
    editionYear,
    firstSeen: '2026-10-14T06:00:00.000Z',
  };
}

function link(file: string, version: string, versionNumber: number, fileYear: number): InformEditionLink {
  return { file, url: `https://example.org/${file}`, fileYear, version, versionNumber };
}

/** Fake fetch returning canned pages keyed by URL. A string value is a 200 page; an Error is a network failure. */
function fakeFetch(pages: Record<string, string | Error | number>, seenHeaders: Array<Record<string, string>> = []) {
  return async (input: string, init?: RequestInit): Promise<Response> => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    seenHeaders.push(headers);
    const page = pages[input];
    if (page instanceof Error) throw page;
    if (typeof page === 'number') return new Response('nope', { status: page });
    if (page === undefined) throw new Error(`unexpected URL in test: ${input}`);
    return new Response(page, { status: 200 });
  };
}

const RESULTS_PAGE_HTML = `
<html><body>
  <a href="/inform-index/Portals/0/InfoRM/2026/INFORM_Risk_Mid_2026_v073.xlsx">Mid 2026</a>
  <a href="https://drmkc.jrc.ec.europa.eu/inform-index/Portals/0/InfoRM/2026/INFORM_Risk_2026_v072.xlsx?ver=1">2026 v072</a>
  <a href="/inform-index/Portals/0/InfoRM/2026/INFORM2026_TREND_2017_2026_v72_ALL.xlsx">Trend</a>
  <a href="/inform-index/Portals/0/InfoRM/2026/INFORM_Risk_Severity_2026_v073.xlsx">Severity</a>
  <a href="/inform-index/Portals/0/InfoRM/2026/INFORM_Risk_Subnational_2026_v073.xlsx">Subnational</a>
  <a href="/inform-index/Portals/0/InfoRM/methodology.pdf">Methodology</a>
  <link href="/styles/site.css" rel="stylesheet">
</body></html>`;

/* -------------------------------------------------------------------------- */
/* Discovery                                                                   */
/* -------------------------------------------------------------------------- */

describe('INFORM discovery: link extraction', () => {
  it('keeps only edition workbooks and resolves relative and absolute hrefs', () => {
    const links = extractInformEditionLinks(RESULTS_PAGE_HTML, INFORM_RESULTS_PAGES[0]);
    const files = links.map((l) => l.file).sort();

    assert.deepEqual(files, ['INFORM_Risk_2026_v072.xlsx', 'INFORM_Risk_Mid_2026_v073.xlsx']);

    const mid = links.find((l) => l.file === 'INFORM_Risk_Mid_2026_v073.xlsx');
    assert.ok(mid, 'Mid 2026 link present');
    assert.equal(
      mid.url,
      'https://drmkc.jrc.ec.europa.eu/inform-index/Portals/0/InfoRM/2026/INFORM_Risk_Mid_2026_v073.xlsx',
    );
    assert.equal(mid.version, 'v073');
    assert.equal(mid.versionNumber, 73);
    assert.equal(mid.fileYear, 2026);
  });

  it('parses edition file names and rejects trend, severity and subnational files', () => {
    const parsed = parseInformEditionFileName('INFORM_Risk_Mid_2025_v071.xlsx');
    assert.deepEqual(parsed, {
      file: 'INFORM_Risk_Mid_2025_v071.xlsx',
      fileYear: 2025,
      version: 'v071',
      versionNumber: 71,
    });
    assert.equal(parseInformEditionFileName('INFORM2026_TREND_2017_2026_v72_ALL.xlsx'), null);
    assert.equal(parseInformEditionFileName('INFORM_Risk_Severity_2026_v073.xlsx'), null);
    assert.equal(parseInformEditionFileName('INFORM_Risk_Subnational_2026_v073.xlsx'), null);
    assert.equal(parseInformEditionFileName('INFORM_Risk_Mid_2026_v73.xlsx'), null);
  });
});

describe('INFORM discovery: version selection', () => {
  it('picks the highest version across editions listed on the fake page', () => {
    const page = `
      <a href="/Portals/0/InfoRM/2025/INFORM_Risk_Mid_2025_v071.xlsx">2025</a>
      <a href="/Portals/0/InfoRM/2026/INFORM_Risk_2026_v072.xlsx">2026 v072</a>
      <a href="/Portals/0/InfoRM/2026/INFORM_Risk_Mid_2026_v073.xlsx">2026 Mid</a>`;
    const newest = selectLatestInformEdition(extractInformEditionLinks(page, INFORM_RESULTS_PAGES[1]));
    assert.ok(newest);
    assert.equal(newest.file, 'INFORM_Risk_Mid_2026_v073.xlsx');
    assert.equal(newest.version, 'v073');
  });

  it('breaks an equal-version tie by the later file year, then by file name', () => {
    const tie = [
      link('INFORM_Risk_Mid_2025_v073.xlsx', 'v073', 73, 2025),
      link('INFORM_Risk_Mid_2026_v073.xlsx', 'v073', 73, 2026),
    ];
    assert.equal(selectLatestInformEdition(tie)?.file, 'INFORM_Risk_Mid_2026_v073.xlsx');
  });

  it('returns null when no edition link exists', () => {
    assert.equal(selectLatestInformEdition([]), null);
  });

  it('merges links across pages and keeps working when one page fails', async () => {
    const seenHeaders: Array<Record<string, string>> = [];
    const fetchImpl = fakeFetch(
      {
        [INFORM_RESULTS_PAGES[0]]: new TypeError('fetch failed: Connection reset by peer'),
        [INFORM_RESULTS_PAGES[1]]: RESULTS_PAGE_HTML,
      },
      seenHeaders,
    );

    const result = await discoverLatestInformEdition(fetchImpl, INFORM_RESULTS_PAGES);

    assert.equal(result.edition?.file, 'INFORM_Risk_Mid_2026_v073.xlsx');
    assert.deepEqual(result.pagesOk, [INFORM_RESULTS_PAGES[1]]);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Connection reset/);
    for (const headers of seenHeaders) {
      assert.equal(headers['User-Agent'], INFORM_USER_AGENT, 'every page request identifies the project bot');
    }
    assert.match(INFORM_USER_AGENT, /IsItSafeToTravelBot\/1\.0/);
  });

  it('treats an HTTP error page as a failed page, not as an empty result', async () => {
    const result = await discoverLatestInformEdition(
      fakeFetch({ [INFORM_RESULTS_PAGES[0]]: 503, [INFORM_RESULTS_PAGES[1]]: 503 }),
      INFORM_RESULTS_PAGES,
    );
    assert.equal(result.edition, null);
    assert.equal(result.pagesOk.length, 0);
    assert.equal(result.errors.length, 2);
    assert.match(result.errors[0], /HTTP 503/);
  });
});

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

describe('INFORM parsing: edition year from the sheet name', () => {
  it('reads the year from "INFORM Risk YYYY (a-z)" and "INFORM Risk Mid YYYY (a-z)"', () => {
    assert.deepEqual(parseInformEditionYear(['About', 'INFORM Risk 2026 (a-z)']), {
      sheetName: 'INFORM Risk 2026 (a-z)',
      editionYear: 2026,
    });
    assert.deepEqual(parseInformEditionYear(['INFORM Risk Mid 2025 (a-z)']), {
      sheetName: 'INFORM Risk Mid 2025 (a-z)',
      editionYear: 2025,
    });
  });

  it('returns null when no sheet carries an edition year', () => {
    assert.equal(parseInformEditionYear(['About', 'Hazard & Exposure', 'Vulnerability']), null);
  });
});

describe('INFORM parsing: exact header mapping', () => {
  it('maps Natural, Epidemic, Access to health care, Governance and LACK OF COPING CAPACITY, and nothing else', () => {
    const buffer = buildInformWorkbook({
      rows: [
        {
          iso3: 'DEU',
          values: { Natural: 2.1, Human: 9.9, 'River Flood': 7.7, Epidemic: 3.3, Institutional: 8.8, Governance: 0.9, 'Access to health care': 1.5, 'LACK OF COPING CAPACITY': 1.4 },
        },
        {
          iso3: 'ECU',
          values: { Natural: 5.5, Human: 4.4, 'River Flood': 6.6, Epidemic: 4.1, Institutional: 6.2, Governance: 5.8, 'Access to health care': 4.7, 'LACK OF COPING CAPACITY': 4.6 },
        },
        {
          iso3: 'ISR',
          values: { Natural: 3.0, Human: 8.0, 'River Flood': 1.0, Epidemic: 2.0, Institutional: 4.0, Governance: 4.5, 'Access to health care': 1.2, 'LACK OF COPING CAPACITY': 2.9 },
        },
      ],
    });

    const parsed = parseInformWorkbook(buffer, { minCountries: 1 });

    assert.equal(parsed.countries, 3);
    assert.equal(parsed.editionYear, 2026);
    assert.deepEqual(
      parsed.mapping.map((m) => m.indicator).sort(),
      ['inform_coping', 'inform_epidemic', 'inform_governance', 'inform_health_access', 'inform_natural'],
    );

    const deu = parsed.indicators.filter((i) => i.countryIso3 === 'DEU');
    const byName = Object.fromEntries(deu.map((i) => [i.indicatorName, i.value]));
    assert.deepEqual(byName, {
      inform_natural: 2.1,
      inform_epidemic: 3.3,
      inform_health_access: 1.5,
      inform_governance: 0.9,
      inform_coping: 1.4,
    });

    const names = new Set(parsed.indicators.map((i) => i.indicatorName));
    assert.equal(names.has('inform_health'), false, 'Human is not used for health');
    assert.equal(names.has('inform_climate'), false, 'River Flood is not used for climate');
    assert.equal(
      parsed.indicators.some((i) => i.indicatorName === 'inform_governance' && i.value === 8.8),
      false,
      'Institutional is never read as governance',
    );
  });

  it('stamps every indicator with the edition year and a year-start dataDate', () => {
    const buffer = buildInformWorkbook({
      rows: [{ iso3: 'DEU', values: { Natural: 2, Epidemic: 2, 'Access to health care': 2, Governance: 2 } }],
    });
    const [first] = parseInformWorkbook(buffer, { minCountries: 1 }).indicators;
    assert.equal(first.source, 'inform');
    assert.equal(first.year, 2026);
    assert.equal(first.dataDate, '2026-01-01T00:00:00.000Z');
  });

  it('skips unknown ISO3 codes, the scale row and out-of-range values', () => {
    const buffer = buildInformWorkbook({
      rows: [
        { iso3: 'XXX', values: { Natural: 2, Epidemic: 2, 'Access to health care': 2, Governance: 2 } },
        { iso3: 'DEU', values: { Natural: 12, Epidemic: 2, 'Access to health care': 2, Governance: -1 } },
      ],
    });
    const parsed = parseInformWorkbook(buffer, { minCountries: 1 });
    assert.equal(parsed.countries, 1);
    assert.equal(parsed.outOfRangeSkipped, 2);
    assert.deepEqual(
      parsed.indicators.map((i) => `${i.countryIso3}:${i.indicatorName}`).sort(),
      ['DEU:inform_coping', 'DEU:inform_epidemic', 'DEU:inform_health_access'],
    );
  });

  it('tolerates extra whitespace inside header labels', () => {
    const resolved = resolveInformColumns([
      'ISO3',
      'Natural',
      'Epidemic',
      '  Access   to health care ',
      'Governance',
      'LACK OF COPING CAPACITY',
    ]);
    assert.equal(resolved.find((r) => r.indicator === 'inform_health_access')?.column, 3);
  });
});

describe('INFORM parsing: missing or ambiguous headers fail loudly', () => {
  it('throws an InformSchemaError naming the missing header', () => {
    const buffer = buildInformWorkbook({
      headers: ['COUNTRY', 'ISO3', 'Natural', 'Epidemic', 'Governance'],
      rows: [{ iso3: 'DEU', values: { Natural: 2, Epidemic: 2, Governance: 2 } }],
    });
    assert.throws(
      () => parseInformWorkbook(buffer, { minCountries: 1 }),
      (err: unknown) =>
        err instanceof InformSchemaError && /"Access to health care" not found/.test((err as Error).message),
    );
  });

  it('throws when an expected header occurs twice instead of picking the first one', () => {
    const buffer = buildInformWorkbook({
      headers: ['COUNTRY', 'ISO3', 'Natural', 'Epidemic', 'Access to health care', 'Governance', 'Governance'],
      rows: [{ iso3: 'DEU', values: { Natural: 2, Epidemic: 2, 'Access to health care': 2, Governance: 2 } }],
    });
    assert.throws(
      () => parseInformWorkbook(buffer, { minCountries: 1 }),
      (err: unknown) => err instanceof InformSchemaError && /"Governance" is ambiguous/.test((err as Error).message),
    );
  });

  it('throws when the workbook has no "INFORM Risk YYYY" sheet', () => {
    const buffer = buildInformWorkbook({ sheetName: 'Hazard & Exposure' });
    assert.throws(
      () => parseInformWorkbook(buffer, { minCountries: 1 }),
      (err: unknown) => err instanceof InformSchemaError && /no sheet named "INFORM Risk YYYY"/.test((err as Error).message),
    );
  });

  it('throws when fewer countries than the floor are parsed', () => {
    const buffer = buildInformWorkbook({
      rows: [{ iso3: 'DEU', values: { Natural: 2, Epidemic: 2, 'Access to health care': 2, Governance: 2 } }],
    });
    assert.throws(
      () => parseInformWorkbook(buffer),
      (err: unknown) => err instanceof InformSchemaError && /only 1 countries parsed/.test((err as Error).message),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Edition policy and store                                                    */
/* -------------------------------------------------------------------------- */

describe('INFORM edition policy', () => {
  const stored = edition('INFORM_Risk_Mid_2026_v073.xlsx', 'v073');
  const newer = link('INFORM_Risk_Mid_2027_v074.xlsx', 'v074', 74, 2027);
  const same = link('INFORM_Risk_Mid_2026_v073.xlsx', 'v073', 73, 2026);
  const older = link('INFORM_Risk_Mid_2025_v071.xlsx', 'v071', 71, 2025);

  it('uses the stored edition without downloading when the discovered file is the same', () => {
    const decision = decideInformEdition({ discovered: same, discoveryErrors: [], stored });
    assert.deepEqual(decision, { action: 'use-stored', edition: stored });
  });

  it('downloads when a newer edition is discovered', () => {
    const decision = decideInformEdition({ discovered: newer, discoveryErrors: [], stored });
    assert.deepEqual(decision, { action: 'download', link: newer });
  });

  it('downloads the first edition when nothing is stored yet', () => {
    const decision = decideInformEdition({ discovered: same, discoveryErrors: [], stored: null });
    assert.deepEqual(decision, { action: 'download', link: same });
  });

  it('keeps the stored edition with a warning when discovery finds nothing', () => {
    const decision = decideInformEdition({
      discovered: null,
      discoveryErrors: ['https://x/a: HTTP 503'],
      stored,
    });
    assert.equal(decision.action, 'use-stored');
    assert.ok(decision.action === 'use-stored' && /discovery failed/.test(decision.warning ?? ''));
  });

  it('fails when discovery finds nothing and nothing is stored', () => {
    const decision = decideInformEdition({ discovered: null, discoveryErrors: ['boom'], stored: null });
    assert.equal(decision.action, 'fail');
    assert.ok(decision.action === 'fail' && /none stored/.test(decision.reason));
  });

  it('never downgrades: an older discovered edition keeps the stored one', () => {
    const decision = decideInformEdition({ discovered: older, discoveryErrors: [], stored });
    assert.equal(decision.action, 'use-stored');
    assert.ok(decision.action === 'use-stored' && /not downgrading/.test(decision.warning ?? ''));
  });

  it('parses version tags into numbers', () => {
    assert.equal(informVersionNumber('v073'), 73);
    assert.ok(Number.isNaN(informVersionNumber('073')));
  });
});

describe('INFORM edition store', () => {
  it('stores the workbook and edition.json, and reads them back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inform-store-test-'));
    try {
      const meta = edition('INFORM_Risk_Mid_2026_v073.xlsx', 'v073');
      const workbook = buildInformWorkbook({
        rows: [{ iso3: 'DEU', values: { Natural: 2, Epidemic: 2, 'Access to health care': 2, Governance: 2 } }],
      });

      assert.equal(readStoredInformEdition(dir), null, 'nothing stored yet');

      storeInformEdition(dir, meta, workbook);

      assert.ok(existsSync(join(dir, meta.file)));
      assert.equal(existsSync(join(dir, `${meta.file}.tmp`)), false, 'temp file renamed away');
      const onDisk = JSON.parse(readFileSync(join(dir, 'edition.json'), 'utf-8')) as StoredInformEdition;
      assert.deepEqual(onDisk, meta);
      assert.deepEqual(readStoredInformEdition(dir), meta);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('treats edition.json whose workbook is missing as nothing stored', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inform-store-test-'));
    try {
      storeInformEdition(dir, edition('INFORM_Risk_Mid_2026_v073.xlsx', 'v073'), buildInformWorkbook({
        rows: [{ iso3: 'DEU', values: { Natural: 2, Epidemic: 2, 'Access to health care': 2, Governance: 2 } }],
      }));
      rmSync(join(dir, 'INFORM_Risk_Mid_2026_v073.xlsx'));
      assert.equal(readStoredInformEdition(dir), null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Fallback paths (review fix): the stored edition stands in for a new edition */
/* that cannot be downloaded or read, and a pre-v10 per-date cache is refused. */
/* -------------------------------------------------------------------------- */

describe('INFORM discovery: Mid edition tie-break', () => {
  it('prefers the Mid edition over the annual one of the same year and version', () => {
    const tie = [
      link('INFORM_Risk_2026_v073.xlsx', 'v073', 73, 2026),
      link('INFORM_Risk_Mid_2026_v073.xlsx', 'v073', 73, 2026),
    ];
    // A plain name sort would pick INFORM_Risk_2026 ("2" sorts before "M"), the older release.
    assert.equal(selectLatestInformEdition(tie)?.file, 'INFORM_Risk_Mid_2026_v073.xlsx');
    assert.equal(selectLatestInformEdition([...tie].reverse())?.file, 'INFORM_Risk_Mid_2026_v073.xlsx');
  });

  it('still lets a newer annual edition beat an older Mid edition', () => {
    const links = [
      link('INFORM_Risk_Mid_2026_v073.xlsx', 'v073', 73, 2026),
      link('INFORM_Risk_2027_v073.xlsx', 'v073', 73, 2027),
    ];
    assert.equal(selectLatestInformEdition(links)?.file, 'INFORM_Risk_2027_v073.xlsx');
  });
});

/** A workbook with enough real countries to pass the production MIN_INFORM_COUNTRIES floor. */
function fullSizeWorkbook(value: number, headers?: string[]): Buffer {
  const rows = COUNTRIES.slice(0, 160).map((c) => ({
    iso3: c.iso3,
    values: { Natural: value, Epidemic: value, 'Access to health care': value, Governance: value, 'LACK OF COPING CAPACITY': value },
  }));
  return buildInformWorkbook({ rows, headers });
}

function discoveryOf(file: string, version: string, versionNumber: number, fileYear: number): InformDiscoveryResult {
  return { edition: link(file, version, versionNumber, fileYear), pagesOk: ['https://example.org/page'], errors: [] };
}

describe('INFORM fetcher: a new edition that fails falls back to the stored one', () => {
  function withStore(fn: (dir: string) => Promise<void>): () => Promise<void> {
    return async () => {
      const dir = mkdtempSync(join(tmpdir(), 'inform-fallback-test-'));
      try {
        storeInformEdition(dir, edition('INFORM_Risk_Mid_2026_v073.xlsx', 'v073'), fullSizeWorkbook(2));
        await fn(dir);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    };
  }

  it('keeps the stored edition when the new workbook cannot be downloaded', withStore(async (dir) => {
    const load = await loadInformEdition(dir, {
      discover: async () => discoveryOf('INFORM_Risk_2027_v074.xlsx', 'v074', 74, 2027),
      download: async () => {
        throw new Error('download HTTP 503');
      },
    });
    assert.equal(load.edition.file, 'INFORM_Risk_Mid_2026_v073.xlsx');
    assert.equal(load.layoutFailure, false);
    assert.equal(load.parsed.countries, 160);
    assert.match(load.notes.join(' '), /could not be downloaded \(download HTTP 503\); kept stored edition/);
    assert.equal(readStoredInformEdition(dir)?.file, 'INFORM_Risk_Mid_2026_v073.xlsx', 'store untouched');
  }));

  it('keeps the stored edition and flags a layout failure when the new workbook has a changed layout', withStore(async (dir) => {
    const broken = fullSizeWorkbook(3, ['COUNTRY', 'ISO3', 'Natural', 'Epidemic', 'Governance']);
    const load = await loadInformEdition(dir, {
      discover: async () => discoveryOf('INFORM_Risk_2027_v074.xlsx', 'v074', 74, 2027),
      download: async () => broken,
    });
    assert.equal(load.edition.file, 'INFORM_Risk_Mid_2026_v073.xlsx');
    assert.equal(load.layoutFailure, true, 'the run summary must still show INFORM as failed');
    assert.match(load.notes.join(' '), /failed the layout check/);
    assert.ok(load.parsed.indicators.every((i) => i.value === 2), 'values come from the stored workbook');
    assert.equal(existsSync(join(dir, 'INFORM_Risk_2027_v074.xlsx')), false, 'the broken edition is never stored');
  }));

  it('stores and uses a new edition that downloads and parses cleanly', withStore(async (dir) => {
    const load = await loadInformEdition(dir, {
      discover: async () => discoveryOf('INFORM_Risk_2027_v074.xlsx', 'v074', 74, 2027),
      download: async () => fullSizeWorkbook(4),
    });
    assert.equal(load.edition.file, 'INFORM_Risk_2027_v074.xlsx');
    assert.equal(load.layoutFailure, false);
    assert.deepEqual(load.notes, []);
    assert.equal(readStoredInformEdition(dir)?.file, 'INFORM_Risk_2027_v074.xlsx');
  }));

  it('rethrows when a new edition fails and nothing is stored', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'inform-fallback-test-'));
    try {
      await assert.rejects(
        loadInformEdition(dir, {
          discover: async () => discoveryOf('INFORM_Risk_2027_v074.xlsx', 'v074', 74, 2027),
          download: async () => {
            throw new Error('fetch failed');
          },
        }),
        /fetch failed/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('INFORM fetcher: per-date cache guard', () => {
  const row = (indicatorName: string) => ({ countryIso3: 'DEU', indicatorName, value: 2, year: 2026, source: 'inform' });

  it('accepts a cache written by the v10 parser', () => {
    assert.equal(
      isV10InformCache({ source: 'inform', fetchedAt: '2026-10-14T06:00:00Z', indicators: [row('inform_natural'), row('inform_health_access')] }),
      true,
    );
  });

  it('refuses a v9.1 cache (same names, wrong columns) and a missing cache', () => {
    assert.equal(
      isV10InformCache({ source: 'inform', fetchedAt: '2026-10-13T06:00:00Z', indicators: [row('inform_health'), row('inform_governance')] }),
      false,
    );
    assert.equal(isV10InformCache(null), false);
  });
});
