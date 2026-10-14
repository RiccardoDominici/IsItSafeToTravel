import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MAX_LAG_YEARS,
  buildNtfyMessages,
  buildStalenessReport,
  collectObservations,
  evaluateStaleness,
  formatStalenessLines,
  isNewEditionSince,
  newestYearByIndicator,
  newestYearOf,
  runStalenessMonitor,
  type StalenessObservations,
} from '../staleness.js';
import { ntfyTopicFromEnv, pushNtfy } from '../utils/ntfy.js';
import { WB_INDICATOR_NAMES } from '../fetchers/worldbank.js';
import type { RawIndicator, RawSourceData } from '../types.js';
import type { StoredInformEdition } from '../fetchers/inform-edition.js';

/** Observations where every source is current for run year 2026. */
function currentObservations(overrides: Partial<StalenessObservations> = {}): StalenessObservations {
  const worldbank = Object.fromEntries(WB_INDICATOR_NAMES.map((name) => [name, 2024]));
  return {
    runYear: 2026,
    inform: 2026,
    gpi: 2026,
    vdem: 2025,
    ucdp: 2025,
    worldbank,
    ...overrides,
  };
}

function statusOf(obs: StalenessObservations, key: string): boolean {
  const check = evaluateStaleness(obs).find((c) => c.key === key);
  assert.ok(check, `check ${key} exists`);
  return check.ok;
}

function edition(firstSeen: string): StoredInformEdition {
  return {
    file: 'INFORM_Risk_Mid_2026_v073.xlsx',
    version: 'v073',
    url: 'https://example.org/INFORM_Risk_Mid_2026_v073.xlsx',
    sheetName: 'INFORM Risk 2026 (a-z)',
    editionYear: 2026,
    firstSeen,
  };
}

describe('staleness rules (SPEC §6 max lags)', () => {
  it('uses the agreed lags: INFORM 1, GPI 1, V-Dem 2, UCDP 2, World Bank 3', () => {
    assert.deepEqual(MAX_LAG_YEARS, { inform: 1, gpi: 1, vdem: 2, ucdp: 2, worldbank: 3 });
  });

  it('INFORM needs an edition of run year minus 1 or newer', () => {
    assert.equal(statusOf(currentObservations({ inform: 2026 }), 'inform'), true);
    assert.equal(statusOf(currentObservations({ inform: 2025 }), 'inform'), true);
    assert.equal(statusOf(currentObservations({ inform: 2024 }), 'inform'), false);
  });

  it('GPI needs a year of run year minus 1 or newer', () => {
    assert.equal(statusOf(currentObservations({ gpi: 2025 }), 'gpi'), true);
    assert.equal(statusOf(currentObservations({ gpi: 2024 }), 'gpi'), false);
  });

  it('V-Dem and UCDP need a year of run year minus 2 or newer', () => {
    assert.equal(statusOf(currentObservations({ vdem: 2024 }), 'vdem'), true);
    assert.equal(statusOf(currentObservations({ vdem: 2023 }), 'vdem'), false);
    assert.equal(statusOf(currentObservations({ ucdp: 2024 }), 'ucdp'), true);
    assert.equal(statusOf(currentObservations({ ucdp: 2023 }), 'ucdp'), false);
  });

  it('checks every World Bank indicator separately against run year minus 3', () => {
    const obs = currentObservations({
      worldbank: { ...Object.fromEntries(WB_INDICATOR_NAMES.map((n) => [n, 2024])), wb_homicide: 2022 },
    });
    assert.equal(statusOf(obs, 'worldbank:wb_homicide'), false, '2022 < 2023');
    assert.equal(statusOf(obs, 'worldbank:wb_population'), true, 'other indicators still current');

    const edge = currentObservations({
      worldbank: { ...Object.fromEntries(WB_INDICATOR_NAMES.map((n) => [n, 2023])) },
    });
    assert.equal(WB_INDICATOR_NAMES.every((n) => statusOf(edge, `worldbank:${n}`)), true, '2023 is the floor');
  });

  it('a source with no data at all is a violation, and a missing World Bank indicator is reported', () => {
    const obs = currentObservations({ gpi: null, worldbank: {} });
    const checks = evaluateStaleness(obs);
    assert.equal(checks.find((c) => c.key === 'gpi')?.ok, false);
    const wbChecks = checks.filter((c) => c.key.startsWith('worldbank:'));
    assert.equal(wbChecks.length, WB_INDICATOR_NAMES.length, 'every expected WB indicator is checked');
    assert.ok(wbChecks.every((c) => c.ok === false && c.newestYear === null));
  });

  it('lists four fixed checks plus one per World Bank indicator', () => {
    const keys = evaluateStaleness(currentObservations()).map((c) => c.key);
    assert.deepEqual(keys.slice(0, 4), ['inform', 'gpi', 'vdem', 'ucdp']);
    assert.equal(keys.length, 4 + WB_INDICATOR_NAMES.length);
  });
});

describe('staleness helpers', () => {
  const rows: RawIndicator[] = [
    { countryIso3: 'DEU', indicatorName: 'wb_homicide', value: 1, year: 2021, source: 'worldbank' },
    { countryIso3: 'ECU', indicatorName: 'wb_homicide', value: 2, year: 2023, source: 'worldbank' },
    { countryIso3: 'ECU', indicatorName: 'wb_population', value: 3, year: 2024, source: 'worldbank' },
    { countryIso3: 'ISR', indicatorName: 'wb_homicide', value: 4, year: Number.NaN, source: 'worldbank' },
  ];

  it('newestYearOf returns the maximum finite year, or null for no data', () => {
    assert.equal(newestYearOf(rows), 2024);
    assert.equal(newestYearOf([]), null);
    assert.equal(newestYearOf(undefined), null);
  });

  it('newestYearByIndicator groups the newest year by indicator name', () => {
    assert.deepEqual(newestYearByIndicator(rows), { wb_homicide: 2023, wb_population: 2024 });
  });

  it('collectObservations reads each source from the loaded raw data', () => {
    const raw = (source: string, indicators: RawIndicator[]): RawSourceData => ({
      source,
      fetchedAt: '2026-10-14T06:00:00.000Z',
      indicators,
    });
    const rawDataMap = new Map<string, RawSourceData>([
      ['gpi', raw('gpi', [{ countryIso3: 'DEU', indicatorName: 'gpi_overall', value: 1.4, year: 2026, source: 'gpi' }])],
      ['vdem', raw('vdem', [{ countryIso3: 'DEU', indicatorName: 'vdem_rule_of_law', value: 0.9, year: 2025, source: 'vdem' }])],
      ['ucdp', raw('ucdp', [{ countryIso3: 'DEU', indicatorName: 'ucdp_conflict_deaths', value: 0, year: 2025, source: 'ucdp' }])],
      ['inform', raw('inform', [{ countryIso3: 'DEU', indicatorName: 'inform_natural', value: 2, year: 2026, source: 'inform' }])],
      ['worldbank', raw('worldbank', rows)],
    ]);

    const obs = collectObservations('2026-10-14', rawDataMap);
    assert.deepEqual(
      { runYear: obs.runYear, inform: obs.inform, gpi: obs.gpi, vdem: obs.vdem, ucdp: obs.ucdp },
      { runYear: 2026, inform: 2026, gpi: 2026, vdem: 2025, ucdp: 2025 },
    );
    assert.equal(obs.worldbank.wb_homicide, 2023);
  });
});

describe('staleness report and log lines', () => {
  it('lists one violation per failed check and flags a new INFORM edition', () => {
    const report = buildStalenessReport({
      date: '2026-10-14',
      generatedAt: '2026-10-14T06:05:00.000Z',
      observations: currentObservations({ gpi: 2023, vdem: 2025 }),
      informEdition: edition('2026-10-14T06:03:00.000Z'),
      runStartedAt: '2026-10-14T06:00:00.000Z',
    });

    assert.equal(report.runYear, 2026);
    assert.equal(report.newInformEdition, true);
    assert.equal(report.violations.length, 1);
    assert.match(report.violations[0], /^Global Peace Index: newest 2023, needs at least 2025/);
  });

  it('does not flag a new edition for one that was stored before the run started', () => {
    const report = buildStalenessReport({
      date: '2026-10-14',
      generatedAt: '2026-10-14T06:05:00.000Z',
      observations: currentObservations(),
      informEdition: edition('2026-10-13T06:03:00.000Z'),
      runStartedAt: '2026-10-14T06:00:00.000Z',
    });
    assert.equal(report.newInformEdition, false);
    assert.equal(report.violations.length, 0);
  });

  it('isNewEditionSince is false without an edition or with an unreadable timestamp', () => {
    assert.equal(isNewEditionSince(null, '2026-10-14T06:00:00.000Z'), false);
    assert.equal(isNewEditionSince(edition('not-a-date'), '2026-10-14T06:00:00.000Z'), false);
  });

  it('formats violation lines with the prefix the workflow greps for', () => {
    const report = buildStalenessReport({
      date: '2026-10-14',
      generatedAt: '2026-10-14T06:05:00.000Z',
      observations: currentObservations({ inform: 2024 }),
      informEdition: null,
      runStartedAt: '2026-10-14T06:00:00.000Z',
    });
    const lines = formatStalenessLines(report);
    assert.match(lines[0], /^\[STALENESS\] Run year 2026/);
    assert.ok(lines.some((l) => l.startsWith('[STALENESS] VIOLATION INFORM Risk edition')));
    assert.ok(lines.some((l) => l.startsWith('[STALENESS] ok Global Peace Index')));
  });
});

describe('ntfy notifications', () => {
  it('sends nothing when every source is current and there is no new edition', () => {
    const report = buildStalenessReport({
      date: '2026-10-14',
      generatedAt: '2026-10-14T06:05:00.000Z',
      observations: currentObservations(),
      informEdition: null,
      runStartedAt: '2026-10-14T06:00:00.000Z',
    });
    assert.deepEqual(buildNtfyMessages(report), []);
  });

  it('builds one high-priority warning listing every violation, with an ASCII title', () => {
    const report = buildStalenessReport({
      date: '2026-10-14',
      generatedAt: '2026-10-14T06:05:00.000Z',
      observations: currentObservations({ gpi: 2023, ucdp: null }),
      informEdition: null,
      runStartedAt: '2026-10-14T06:00:00.000Z',
    });
    const messages = buildNtfyMessages(report);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].priority, 'high');
    assert.ok(messages[0].tags.includes('warning'));
    assert.equal(/^[\x20-\x7e]+$/.test(messages[0].title), true, 'title is ASCII');
    assert.match(messages[0].body, /Global Peace Index/);
    assert.match(messages[0].body, /UCDP conflict deaths: no data/);
  });

  it('builds a separate info message when a new INFORM edition is stored', () => {
    const report = buildStalenessReport({
      date: '2026-10-14',
      generatedAt: '2026-10-14T06:05:00.000Z',
      observations: currentObservations(),
      informEdition: edition('2026-10-14T06:03:00.000Z'),
      runStartedAt: '2026-10-14T06:00:00.000Z',
    });
    const messages = buildNtfyMessages(report);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].priority, 'default');
    assert.match(messages[0].body, /INFORM_Risk_Mid_2026_v073\.xlsx \(edition 2026\)/);
  });

  it('reads the topic from NTFY_TOPIC only, and treats blank as unset', () => {
    assert.equal(ntfyTopicFromEnv({}), null);
    assert.equal(ntfyTopicFromEnv({ NTFY_TOPIC: '' }), null);
    assert.equal(ntfyTopicFromEnv({ NTFY_TOPIC: '   ' }), null);
    assert.equal(ntfyTopicFromEnv({ NTFY_TOPIC: ' riccardo-claude ' }), 'riccardo-claude');
  });

  it('pushNtfy posts the message to the topic and never throws', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const okFetch = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init });
      return new Response('', { status: 200 });
    }) as unknown as typeof fetch;

    const sent = await pushNtfy(
      'riccardo-claude',
      { title: 'T', body: 'B', priority: 'high', tags: ['warning', 'x'] },
      okFetch,
    );
    assert.equal(sent, true);
    assert.equal(seen[0].url, 'https://ntfy.sh/riccardo-claude');
    assert.equal(seen[0].init?.method, 'POST');
    const headers = seen[0].init?.headers as Record<string, string>;
    assert.equal(headers.Title, 'T');
    assert.equal(headers.Priority, 'high');
    assert.equal(headers.Tags, 'warning,x');
    assert.equal(seen[0].init?.body, 'B');

    const failingStatus = (async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    assert.equal(await pushNtfy('t', { title: 'T', body: 'B', priority: 'low', tags: [] }, failingStatus), false);

    const throwing = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    assert.equal(await pushNtfy('t', { title: 'T', body: 'B', priority: 'low', tags: [] }, throwing), false);
  });
});

describe('runStalenessMonitor: gating and output', () => {
  it('writes staleness.json and pushes only when NTFY_TOPIC is set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'staleness-test-'));
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      const rawDataMap = new Map<string, RawSourceData>([
        [
          'gpi',
          {
            source: 'gpi',
            fetchedAt: '2026-10-14T06:00:00.000Z',
            indicators: [{ countryIso3: 'DEU', indicatorName: 'gpi_overall', value: 1.4, year: 2023, source: 'gpi' }],
          },
        ],
      ]);
      const calls: string[] = [];
      const spy = (async (url: string) => {
        calls.push(String(url));
        return new Response('', { status: 200 });
      }) as unknown as typeof fetch;

      const runStartedAt = new Date().toISOString();
      const report = await runStalenessMonitor({
        date: '2026-10-14',
        rawDataMap,
        runStartedAt,
        env: {},
        fetchImpl: spy,
      });

      assert.ok(report.violations.length > 0, 'GPI 2023 is behind run year 2026');
      assert.equal(calls.length, 0, 'no push without NTFY_TOPIC (local runs and tests)');
      const written = JSON.parse(readFileSync(join(dir, 'data', 'raw', '2026-10-14', 'staleness.json'), 'utf-8'));
      assert.equal(written.runYear, 2026);
      assert.equal(existsSync(join(dir, 'data', 'raw', 'inform')), false, 'the monitor never creates the INFORM store');

      await runStalenessMonitor({
        date: '2026-10-14',
        rawDataMap,
        runStartedAt,
        env: { NTFY_TOPIC: 'riccardo-claude' },
        fetchImpl: spy,
      });
      assert.deepEqual(calls, ['https://ntfy.sh/riccardo-claude']);
    } finally {
      process.chdir(previousCwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
