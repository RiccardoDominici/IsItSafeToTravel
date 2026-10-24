import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { coverageFloors, fetchWorldBank } from '../fetchers/worldbank.js';
import { findLatestCached } from '../utils/fs.js';
import type { RawIndicator, RawSourceData } from '../types.js';

/**
 * World Bank coverage floor + retry (regression for the 2026-10-24 failure:
 * the API answered "200 OK" with homicide data for 1 country instead of ~194,
 * the fetcher accepted it, and the workflow's quality gate blocked the day).
 * The WB API is faked through globalThis.fetch — no network.
 */

const COUNTRIES = ['ITA', 'FRA', 'DEU', 'ESP', 'PRT', 'GBR', 'USA', 'CAN', 'BRA', 'ARG'];
const CODE_TO_NAME: Record<string, string> = {
  'SH.DYN.MORT': 'wb_child_mortality',
  'EN.ATM.PM25.MC.M3': 'wb_air_pollution',
  'VC.IHR.PSRC.P5': 'wb_homicide',
  'SP.POP.TOTL': 'wb_population',
};
const HOMICIDE = 'VC.IHR.PSRC.P5';
const RUN_DATE = '2026-10-24';
const NO_WAIT = [0, 0];

/** Live API values are 1, cached values are 42 — so a test can tell which one won. */
const LIVE_VALUE = 1;
const CACHED_VALUE = 42;

interface Reply {
  status: number;
  body: string;
}

function wbReply(iso3s: string[], value = LIVE_VALUE): Reply {
  const meta = { page: 1, pages: 1, per_page: 500, total: iso3s.length };
  const rows = iso3s.map((iso3) => ({ countryiso3code: iso3, date: '2023', value }));
  return { status: 200, body: JSON.stringify([meta, rows]) };
}

const HTML_502: Reply = { status: 502, body: '<!DOCTYPE html><title>5xx Error Page</title>' };

/**
 * Replace fetch with a scripted WB API. `script[code]` lists the replies for
 * successive calls to that indicator (the last one repeats); indicators not
 * scripted always answer with full coverage.
 */
function installFakeApi(script: Record<string, Reply[]>): Map<string, number> {
  const calls = new Map<string, number>();
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const code = /indicator\/([^?]+)\?/.exec(url)?.[1] ?? '';
    const n = calls.get(code) ?? 0;
    calls.set(code, n + 1);
    const queue = script[code];
    const reply = queue ? queue[Math.min(n, queue.length - 1)] : wbReply(COUNTRIES);
    return new Response(reply.body, { status: reply.status });
  }) as typeof fetch;
  return calls;
}

function cacheFile(counts: Partial<Record<string, number>>): RawSourceData {
  const indicators: RawIndicator[] = [];
  for (const name of Object.values(CODE_TO_NAME)) {
    const n = counts[name] ?? COUNTRIES.length;
    for (const iso3 of COUNTRIES.slice(0, n)) {
      indicators.push({ countryIso3: iso3, indicatorName: name, value: CACHED_VALUE, year: 2023, source: 'worldbank' });
    }
  }
  return { source: 'worldbank', fetchedAt: '2026-10-23T01:36:25.312Z', indicators };
}

function writeCache(date: string, data: RawSourceData): void {
  const dir = join(process.cwd(), 'data', 'raw', date);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'worldbank-parsed.json'), JSON.stringify(data));
}

function readOutput(): RawSourceData {
  return JSON.parse(readFileSync(join(process.cwd(), 'data', 'raw', RUN_DATE, 'worldbank-parsed.json'), 'utf-8'));
}

function rowsOf(data: RawSourceData, name: string): RawIndicator[] {
  return data.indicators.filter((i) => i.indicatorName === name);
}

describe('coverageFloors', () => {
  it('has no floor without a cache (first run behaves as before)', () => {
    assert.equal(coverageFloors(null).size, 0);
  });

  it('is 60% of the cached count, rounded up (194 homicide countries -> 117)', () => {
    const cached: RawSourceData = {
      source: 'worldbank',
      fetchedAt: '',
      indicators: Array.from({ length: 194 }, (_, i) => ({
        countryIso3: `C${i}`, indicatorName: 'wb_homicide', value: 1, year: 2023, source: 'worldbank',
      })),
    };
    assert.equal(coverageFloors(cached).get('wb_homicide'), 117);
  });
});

describe('fetchWorldBank coverage floor', () => {
  const originalCwd = process.cwd();
  const originalFetch = globalThis.fetch;
  let workDir = '';

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'wb-coverage-'));
    process.chdir(workDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    globalThis.fetch = originalFetch;
    rmSync(workDir, { recursive: true, force: true });
  });

  it('2026-10-24: a 200 OK with 1 homicide country is retried, then filled from the previous cache', async () => {
    writeCache('2026-10-23', cacheFile({}));
    const calls = installFakeApi({ [HOMICIDE]: [wbReply(['ITA'])] });

    const result = await fetchWorldBank(RUN_DATE, { retryDelaysMs: NO_WAIT });

    assert.equal(result.success, true);
    assert.equal(calls.get(HOMICIDE), 3, 'three attempts before giving up');
    assert.match(result.error ?? '', /coverage collapse — 1 countries, floor 6/);
    assert.match(result.error ?? '', /filled wb_homicide from cache/);

    const out = readOutput();
    const homicide = rowsOf(out, 'wb_homicide');
    assert.equal(homicide.length, COUNTRIES.length, 'full homicide coverage restored');
    assert.ok(homicide.every((r) => r.value === CACHED_VALUE), 'homicide values come from the cache');
    assert.ok(rowsOf(out, 'wb_child_mortality').every((r) => r.value === LIVE_VALUE), 'healthy indicators stay live');
  });

  it('a transient 502 HTML page is retried and the live answer is used', async () => {
    writeCache('2026-10-23', cacheFile({}));
    const calls = installFakeApi({ [HOMICIDE]: [HTML_502, wbReply(COUNTRIES)] });

    const result = await fetchWorldBank(RUN_DATE, { retryDelaysMs: NO_WAIT });

    assert.equal(calls.get(HOMICIDE), 2);
    assert.equal(result.error, undefined);
    assert.ok(rowsOf(readOutput(), 'wb_homicide').every((r) => r.value === LIVE_VALUE));
  });

  it("a same-day re-run measures against the previous day, not today's own collapsed file", async () => {
    writeCache('2026-10-23', cacheFile({}));
    writeCache(RUN_DATE, cacheFile({ wb_homicide: 1 }));
    installFakeApi({ [HOMICIDE]: [wbReply(['ITA'])] });

    await fetchWorldBank(RUN_DATE, { retryDelaysMs: NO_WAIT });

    assert.equal(rowsOf(readOutput(), 'wb_homicide').length, COUNTRIES.length);
  });

  it('without any cache the answer is accepted as-is, with no retries', async () => {
    const calls = installFakeApi({ [HOMICIDE]: [wbReply(['ITA'])] });

    const result = await fetchWorldBank(RUN_DATE, { retryDelaysMs: NO_WAIT });

    assert.equal(result.success, true);
    assert.equal(calls.get(HOMICIDE), 1);
    assert.equal(rowsOf(readOutput(), 'wb_homicide').length, 1);
  });

  it('a legitimate small dip (within 60% of the cache) is accepted live', async () => {
    writeCache('2026-10-23', cacheFile({}));
    const calls = installFakeApi({ [HOMICIDE]: [wbReply(COUNTRIES.slice(0, 7))] });

    const result = await fetchWorldBank(RUN_DATE, { retryDelaysMs: NO_WAIT });

    assert.equal(calls.get(HOMICIDE), 1);
    assert.equal(result.error, undefined);
    assert.equal(rowsOf(readOutput(), 'wb_homicide').length, 7);
  });
});

describe('findLatestCached beforeDate', () => {
  const originalCwd = process.cwd();
  let workDir = '';

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'wb-cache-'));
    process.chdir(workDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(workDir, { recursive: true, force: true });
  });

  it('skips the given day and later ones', () => {
    writeCache('2026-10-22', cacheFile({}));
    writeCache('2026-10-24', cacheFile({}));
    writeCache('2026-10-25', cacheFile({}));

    assert.match(findLatestCached('worldbank-parsed.json', '2026-10-24') ?? '', /2026-10-22/);
    assert.match(findLatestCached('worldbank-parsed.json') ?? '', /2026-10-25/);
  });
});
