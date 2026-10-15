import { describe, it, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MAX_FALLBACK_AGE_DAYS,
  isFallbackFresh,
  readAdvisoryFallbackReport,
  writeAdvisoryFallbackReport,
} from '../fetchers/advisory-fallback.js';
import { runWithFloor, selectFallback, type AdvisoryInfoMap } from '../fetchers/advisories.js';
import { writeJson } from '../utils/fs.js';
import type { RawIndicator } from '../types.js';

/**
 * The 7-day age limit on the base advisories' cache fallback (owner decision 2026-10-15).
 * Case it closes: travel.gc.ca changed on 2026-10-01, the CA parser read 0 countries, and
 * runWithFloor republished the 2026-10-01 Canadian levels every day until 2026-10-15 (the
 * 2026-10-15 advisories-info.json has 210 CA entries, all with restoredFrom 2026-10-01).
 */

/** 160 fake country codes: enough to clear the 150-country per-source floor. */
const ISO3S = Array.from({ length: 160 }, (_, i) => `X${String(i).padStart(3, '0')}`);

function caInfo(restoredFrom?: string): AdvisoryInfoMap {
  const map: AdvisoryInfoMap = {};
  for (const iso3 of ISO3S) {
    map[iso3] = {
      ca: {
        level: 2,
        text: 'Exercise a high degree of caution',
        source: 'Government of Canada',
        url: 'https://travel.gc.ca/destinations/x',
        ...(restoredFrom ? { restoredFrom } : {}),
      },
    };
  }
  return map;
}

function liveResult(count: number): { indicators: RawIndicator[]; advisoryInfo: AdvisoryInfoMap } {
  const indicators = ISO3S.slice(0, count).map((iso3) => ({
    countryIso3: iso3,
    indicatorName: 'advisory_level_ca',
    value: 1,
    year: 2026,
    source: 'advisories_ca',
  }));
  return { indicators, advisoryInfo: {} };
}

const failing = async (): Promise<never> => {
  throw new Error('HTTP 404');
};

const dirs: string[] = [];
function archive(files: Record<string, AdvisoryInfoMap>): string {
  const base = mkdtempSync(join(tmpdir(), 'advisory-fallback-test-'));
  dirs.push(base);
  for (const [date, info] of Object.entries(files)) writeJson(join(base, date, 'advisories-info.json'), info);
  return base;
}
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('fallback age rule', () => {
  it('is 7 days, inclusive', () => {
    assert.equal(MAX_FALLBACK_AGE_DAYS, 7);
    assert.equal(isFallbackFresh('2026-10-08', '2026-10-15'), true);
    assert.equal(isFallbackFresh('2026-10-07', '2026-10-15'), false);
  });

  it('selectFallback judges each entry by its propagated restoredFrom, not the cache file date', () => {
    const chained = selectFallback(caInfo('2026-10-01'), 'ca', '2026-10-14', '2026-10-15');
    assert.equal(chained.fresh.indicators.length, 0, 'a 2026-10-14 file republishing 2026-10-01 readings is 14 days old');
    assert.equal(chained.staleIso3.length, ISO3S.length);
    assert.equal(chained.newestStale, '2026-10-01');

    const recent = selectFallback(caInfo(), 'ca', '2026-10-12', '2026-10-15');
    assert.equal(recent.fresh.indicators.length, ISO3S.length);
    assert.equal(recent.oldestFresh, '2026-10-12');
    assert.equal(recent.fresh.advisoryInfo[ISO3S[0]]?.ca?.restoredFrom, '2026-10-12');
    assert.equal(recent.fresh.indicators[0].year, 2026, 'restored rows carry the run year');
  });
});

describe('runWithFloor', () => {
  it('a live fetch above the floor is "live" and never touches the cache', async () => {
    const base = archive({ '2026-10-14': caInfo() });
    const errors: string[] = [];
    const { result, status } = await runWithFloor('CA', 'ca', async () => liveResult(160), errors, '2026-10-15', base);
    assert.equal(status.state, 'live');
    assert.equal(status.liveCountries, 160);
    assert.equal(result.indicators.every((i) => i.value === 1), true);
    assert.deepEqual(errors, []);
  });

  it('restores a reading at most 7 days old and reports when it was last live', async () => {
    const base = archive({ '2026-10-08': caInfo() });
    const errors: string[] = [];
    const { result, status } = await runWithFloor('CA', 'ca', failing, errors, '2026-10-15', base);
    assert.equal(status.state, 'restored');
    assert.equal(status.restoredCountries, 160);
    assert.equal(status.lastLive, '2026-10-08');
    assert.equal(status.ageDays, 7);
    assert.equal(result.indicators.length, 160);
    assert.ok(errors.some((e) => e.includes('restored from cache dated 2026-10-08 (7d stale)')));
  });

  it('drops the issuer when its only cached reading is 8+ days old (the 2026-10-01 Canada case)', async () => {
    const base = archive({ '2026-10-14': caInfo('2026-10-01') });
    const errors: string[] = [];
    const { result, status } = await runWithFloor('CA', 'ca', failing, errors, '2026-10-15', base);
    assert.equal(status.state, 'dropped');
    assert.equal(status.reason, 'fallback too old');
    assert.equal(status.lastLive, '2026-10-01');
    assert.equal(status.ageDays, 14);
    assert.equal(status.droppedCountries, 160);
    assert.equal(result.indicators.length, 0);
    assert.deepEqual(result.advisoryInfo, {});
    assert.ok(errors.some((e) => e.includes('refused (14d old, max 7d)')));
  });

  it('keeps the countries fetched live today when the fallback is refused', async () => {
    const base = archive({ '2026-10-01': caInfo() });
    const { result, status } = await runWithFloor('CA', 'ca', async () => liveResult(20), [], '2026-10-15', base);
    assert.equal(status.state, 'dropped');
    assert.equal(status.liveCountries, 20);
    assert.equal(result.indicators.length, 20);
  });

  it('drops the issuer with "no cached reading" when nothing is cached, and ignores caches after the run date', async () => {
    const base = archive({ '2026-10-20': caInfo() });
    const { status } = await runWithFloor('CA', 'ca', failing, [], '2026-10-15', base);
    assert.equal(status.state, 'dropped');
    assert.equal(status.reason, 'no cached reading');
    assert.equal(status.lastLive, null);
  });
});

describe('advisories-fallback.json', () => {
  it('round-trips, and reads as null when absent', () => {
    const base = archive({});
    assert.equal(readAdvisoryFallbackReport(base), null);
    const report = {
      date: '2026-10-15',
      maxAgeDays: 7,
      issuers: [
        {
          issuer: 'ca',
          label: 'CA',
          state: 'dropped' as const,
          liveCountries: 0,
          restoredCountries: 0,
          droppedCountries: 210,
          lastLive: '2026-10-01',
          ageDays: 14,
          maxAgeDays: 7,
          reason: 'fallback too old',
        },
      ],
    };
    writeAdvisoryFallbackReport(base, report);
    assert.deepEqual(readAdvisoryFallbackReport(base), report);
  });
});
