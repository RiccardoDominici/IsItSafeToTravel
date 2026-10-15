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
  carriedNotifiedKeys,
  newViolationKeys,
  runStalenessMonitor,
  worldbankIndicatorsUsedBy,
  type StalenessObservations,
} from '../staleness.js';
import { ntfyTopicFromEnv, pushNtfy } from '../utils/ntfy.js';
import { WB_INDICATOR_NAMES } from '../fetchers/worldbank.js';
import { writeAdvisoryFallbackReport } from '../fetchers/advisory-fallback.js';
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

/* -------------------------------------------------------------------------- */
/* Review fixes: no daily push for a persisting violation, and only the World  */
/* Bank series the engine reads are monitored.                                 */
/* -------------------------------------------------------------------------- */

describe('ntfy de-duplication across runs', () => {
  const report = (date: string, obs: Partial<StalenessObservations>) =>
    buildStalenessReport({
      date,
      generatedAt: `${date}T06:05:00.000Z`,
      observations: currentObservations(obs),
      informEdition: null,
      runStartedAt: `${date}T06:00:00.000Z`,
    });

  it('warns while a violation has not been pushed, then stays quiet while it persists', () => {
    const day1 = report('2026-10-14', { gpi: 2023 });
    assert.deepEqual(newViolationKeys(day1, []), ['gpi']);
    assert.equal(buildNtfyMessages(day1, []).length, 1, 'first sighting pushes');

    const day2 = report('2026-10-15', { gpi: 2023 });
    day1.notifiedViolationKeys = ['gpi'];
    const carried = carriedNotifiedKeys(day2, day1);
    assert.deepEqual(carried, ['gpi']);
    assert.deepEqual(buildNtfyMessages(day2, carried), [], 'the same violation the next day does not push again');
  });

  it('warns again when a different source falls behind, listing every current violation', () => {
    const day2 = report('2026-10-15', { gpi: 2023, ucdp: 2020 });
    assert.deepEqual(newViolationKeys(day2, ['gpi']), ['ucdp']);
    const [message] = buildNtfyMessages(day2, ['gpi']);
    assert.match(message.body, /Global Peace Index/);
    assert.match(message.body, /UCDP conflict deaths/);
  });

  it('forgets a violation once it clears, so it is pushed again if it comes back', () => {
    const resolved = report('2026-10-15', {});
    const previous = { ...report('2026-10-14', { gpi: 2023 }), notifiedViolationKeys: ['gpi'] };
    assert.deepEqual(carriedNotifiedKeys(resolved, previous), []);
    const back = report('2026-10-16', { gpi: 2023 });
    assert.deepEqual(newViolationKeys(back, carriedNotifiedKeys(resolved, previous)), ['gpi']);
  });

  it('runStalenessMonitor pushes once, then skips the repeat; an unset topic or a failed push does not count', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'staleness-dedupe-test-'));
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      const rawDataMap = new Map<string, RawSourceData>([
        ['gpi', { source: 'gpi', fetchedAt: '2026-10-14T06:00:00.000Z', indicators: [{ countryIso3: 'DEU', indicatorName: 'gpi_overall', value: 1.4, year: 2023, source: 'gpi' }] }],
      ]);
      const calls: string[] = [];
      const okFetch = (async (url: string) => {
        calls.push(String(url));
        return new Response('', { status: 200 });
      }) as unknown as typeof fetch;
      const failingFetch = (async (url: string) => {
        calls.push(String(url));
        return new Response('', { status: 500 });
      }) as unknown as typeof fetch;
      const env = { NTFY_TOPIC: 'riccardo-claude' };
      const run = (date: string, opts: { env?: NodeJS.ProcessEnv; fetchImpl: typeof fetch }) =>
        runStalenessMonitor({ date, rawDataMap, runStartedAt: new Date().toISOString(), ...opts });

      await run('2026-10-13', { env: {}, fetchImpl: okFetch });
      assert.equal(calls.length, 0, 'no topic: nothing sent');
      await run('2026-10-14', { env, fetchImpl: failingFetch });
      assert.equal(calls.length, 1, 'a previous run without a topic does not silence this one');
      await run('2026-10-15', { env, fetchImpl: okFetch });
      assert.equal(calls.length, 2, 'the failed push is retried on the next run');
      await run('2026-10-16', { env, fetchImpl: okFetch });
      assert.equal(calls.length, 2, 'same violation after a successful push: no push');
      await run('2026-10-16', { env, fetchImpl: okFetch });
      assert.equal(calls.length, 2, 'same-day rerun: no push');

      // Only GPI is loaded here, so every other source is a "no data" violation as well.
      const last = JSON.parse(readFileSync(join(dir, 'data', 'raw', '2026-10-16', 'staleness.json'), 'utf-8'));
      const failing = last.checks.filter((c: { ok: boolean }) => !c.ok).map((c: { key: string }) => c.key);
      assert.ok(failing.includes('gpi'));
      assert.deepEqual(last.notifiedViolationKeys, failing, 'the pushed set is recorded for the next run');
    } finally {
      process.chdir(previousCwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('World Bank scope', () => {
  it('monitors the series the engine reads (scored ones plus wb_population), not unscored ones', () => {
    const weights = {
      pillars: [
        { name: 'crime' as const, weight: 0.25, indicators: ['gpi_safety_security', 'wb_homicide'] },
        { name: 'health' as const, weight: 0.2, indicators: ['inform_health_access', 'inform_epidemic'] },
      ],
    };
    assert.deepEqual(worldbankIndicatorsUsedBy(weights).sort(), ['wb_homicide', 'wb_population']);
  });

  it('an unscored series falling behind is not a violation when the engine subset is passed', () => {
    const obs = currentObservations({ worldbank: { wb_homicide: 2023, wb_population: 2025, wb_air_pollution: 2015 } });
    const checks = evaluateStaleness(obs, ['wb_homicide', 'wb_population']);
    assert.equal(checks.some((c) => c.key === 'worldbank:wb_air_pollution'), false);
    assert.ok(checks.every((c) => c.ok));
    assert.equal(evaluateStaleness(obs).find((c) => c.key === 'worldbank:wb_air_pollution')?.ok, false, 'default still checks every fetched series');
  });
});

/* -------------------------------------------------------------------------- */
/* Base advisories: the 7-day fallback rule (fetchers/advisory-fallback.ts).   */
/* -------------------------------------------------------------------------- */

describe('advisory fallback checks', () => {
  const issuer = (label: string, state: 'live' | 'restored' | 'dropped', lastLive: string | null, ageDays: number | null) => ({
    issuer: label.toLowerCase(),
    label,
    state,
    liveCountries: state === 'live' ? 200 : 0,
    restoredCountries: state === 'restored' ? 200 : 0,
    droppedCountries: state === 'dropped' ? 210 : 0,
    lastLive,
    ageDays,
    maxAgeDays: 7,
    ...(state === 'dropped' ? { reason: lastLive ? 'fallback too old' : 'no cached reading' } : {}),
  });
  const fallback = (...issuers: ReturnType<typeof issuer>[]) => ({ date: '2026-10-15', maxAgeDays: 7, issuers });
  const report = (advisoryFallback: ReturnType<typeof fallback> | null) =>
    buildStalenessReport({
      date: '2026-10-15',
      generatedAt: '2026-10-15T06:05:00.000Z',
      observations: currentObservations(),
      informEdition: null,
      runStartedAt: '2026-10-15T06:00:00.000Z',
      advisoryFallback,
    });

  it('a dropped issuer is a violation that pushes; live and restored issuers are not', () => {
    const r = report(fallback(issuer('US', 'live', null, null), issuer('AU', 'restored', '2026-10-12', 3), issuer('CA', 'dropped', '2026-10-01', 14)));
    assert.deepEqual(r.violations, ['CA travel advisories: dropped on 2026-10-15, last live 2026-10-01 (14 days old, max 7)']);
    assert.deepEqual(newViolationKeys(r, []), ['advisory:ca']);
    const [message] = buildNtfyMessages(r, []);
    assert.equal(message.priority, 'high');
    assert.match(message.body, /CA travel advisories: dropped/);
  });

  it('logs every issuer, with the VIOLATION prefix the workflow greps for on the dropped one', () => {
    const lines = formatStalenessLines(
      report(fallback(issuer('US', 'live', null, null), issuer('AU', 'restored', '2026-10-12', 3), issuer('CA', 'dropped', null, null))),
    );
    assert.ok(lines.includes('[STALENESS] ok US travel advisories: fetched live'));
    assert.ok(lines.includes('[STALENESS] ok AU travel advisories: cache fallback, last live 2026-10-12 (3d old, max 7d)'));
    assert.ok(lines.includes('[STALENESS] VIOLATION CA travel advisories: dropped, no reading within 7d'));
  });

  it('no fallback file means no advisory checks, as before the rule', () => {
    const r = report(null);
    assert.deepEqual(r.advisoryChecks, []);
    assert.deepEqual(r.violations, []);
  });

  it('pushes once while the issuer stays dropped, and again after it recovered and broke again', () => {
    const day1 = report(fallback(issuer('CA', 'dropped', '2026-10-01', 14)));
    day1.notifiedViolationKeys = ['advisory:ca'];
    const day2 = report(fallback(issuer('CA', 'dropped', '2026-10-01', 15)));
    assert.deepEqual(buildNtfyMessages(day2, carriedNotifiedKeys(day2, day1)), []);
    const recovered = report(fallback(issuer('CA', 'live', null, null)));
    assert.deepEqual(carriedNotifiedKeys(recovered, day1), []);
  });

  it('runStalenessMonitor reads advisories-fallback.json from the run folder and pushes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'staleness-advisory-test-'));
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      writeAdvisoryFallbackReport(join(dir, 'data', 'raw', '2026-10-15'), fallback(issuer('CA', 'dropped', '2026-10-01', 14)));
      const rawDataMap = new Map<string, RawSourceData>(
        (['inform', 'gpi', 'vdem', 'ucdp'] as const).map((source) => [
          source,
          { source, fetchedAt: '2026-10-15T06:00:00.000Z', indicators: [{ countryIso3: 'DEU', indicatorName: `${source}_x`, value: 1, year: 2026, source }] },
        ]),
      );
      rawDataMap.set('worldbank', {
        source: 'worldbank',
        fetchedAt: '2026-10-15T06:00:00.000Z',
        indicators: WB_INDICATOR_NAMES.map((name) => ({ countryIso3: 'DEU', indicatorName: name, value: 1, year: 2024, source: 'worldbank' })),
      });
      const bodies: string[] = [];
      const spy = (async (_url: string, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ''));
        return new Response('', { status: 200 });
      }) as unknown as typeof fetch;

      const result = await runStalenessMonitor({
        date: '2026-10-15',
        rawDataMap,
        runStartedAt: new Date().toISOString(),
        env: { NTFY_TOPIC: 'riccardo-claude' },
        fetchImpl: spy,
      });
      assert.deepEqual(result.violations, ['CA travel advisories: dropped on 2026-10-15, last live 2026-10-01 (14 days old, max 7)']);
      assert.equal(bodies.length, 1);
      assert.match(bodies[0], /CA travel advisories/);
      const written = JSON.parse(readFileSync(join(dir, 'data', 'raw', '2026-10-15', 'staleness.json'), 'utf-8'));
      assert.deepEqual(written.notifiedViolationKeys, ['advisory:ca']);
    } finally {
      process.chdir(previousCwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
