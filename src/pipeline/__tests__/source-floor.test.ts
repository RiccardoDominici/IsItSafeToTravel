import { describe, it, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enforcePerSourceFloors, MAX_RESTORE_AGE_DAYS } from '../fetchers/source-floor.js';
import { writeJson } from '../utils/fs.js';
import type { RawIndicator } from '../types.js';
import type { AdvisoryInfoMap } from '../fetchers/advisories.js';

/**
 * source-floor.ts restore-policy tests (audit 2026-09-25, workstream B).
 *
 * Root cause under test: before this fix, a floor violation restored from
 * whichever cached file held the issuer's ALL-TIME MAXIMUM coverage, with no
 * age check. Nine issuers that died in the spring (it/pl/pt/be/ie among them)
 * kept republishing their pre-death historical-maximum snapshot every day
 * through 2026-09-25 — including flatly wrong entries like Italy/Ireland
 * showing "normal precautions" for Afghanistan from a 2026-03-27 cache. The
 * fix restores ONLY from the most recent healthy day, and only within
 * MAX_RESTORE_AGE_DAYS — otherwise it errors loudly instead of restoring.
 *
 * Fixtures live under a throwaway temp dir (rawBaseDir is injectable
 * specifically so these tests never touch the real data/raw archive).
 */

const INFO_FILE = 'test-tier-info.json';
const ISSUER = 'zz'; // fake 2-letter issuer key, never collides with a real one

function makeInfoMap(entries: Record<string, number>): AdvisoryInfoMap {
  const map: Record<string, unknown> = {};
  for (const [iso3, level] of Object.entries(entries)) {
    map[iso3] = { [ISSUER]: { level, text: `Level ${level}`, source: 'Test Issuer', url: 'https://example.test' } };
  }
  return map as AdvisoryInfoMap;
}

/** Fresh temp rawBaseDir per test — isolates the module-level archive-stats memo too. */
function makeFixtureDir(): string {
  return mkdtempSync(join(tmpdir(), 'source-floor-test-'));
}

const tempDirs: string[] = [];
function trackedFixtureDir(): string {
  const dir = makeFixtureDir();
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe('source-floor: restore policy', () => {
  it('restores a transient drop from yesterday\'s cache', () => {
    const rawBaseDir = trackedFixtureDir();
    const runDate = '2026-09-25';
    const yesterday = '2026-09-24';

    writeJson(
      join(rawBaseDir, yesterday, INFO_FILE),
      makeInfoMap({ AAA: 2, BBB: 3, CCC: 1 }),
    );

    const indicators: RawIndicator[] = []; // today's live fetch collapsed to zero
    const advisoryInfo: AdvisoryInfoMap = {};
    const errors: string[] = [];

    enforcePerSourceFloors({
      logPrefix: '[TEST]',
      infoFile: INFO_FILE,
      expectedIssuers: [ISSUER],
      floors: { [ISSUER]: 2 },
      indicators,
      advisoryInfo,
      errors,
      runDate,
      rawBaseDir,
    });

    const restored = indicators.filter((i) => i.source === `advisories_${ISSUER}`);
    assert.equal(restored.length, 3, 'all 3 countries from yesterday should be restored');
    assert.equal((advisoryInfo as any).AAA?.[ISSUER]?.level, 2);
    assert.equal(
      (advisoryInfo as any).AAA?.[ISSUER]?.restoredFrom,
      yesterday,
      'restored entries should be tagged with the source cache date',
    );
    assert.ok(
      errors.some((e) => /COLLAPSED TO ZERO/.test(e)),
      'the original floor violation should still be recorded',
    );
    assert.ok(
      !errors.some((e) => /not restored/.test(e)),
      'a successful restore should not also emit a "not restored" error',
    );
  });

  it('does not restore an issuer that has been dead for 30 days, and says so loudly', () => {
    const rawBaseDir = trackedFixtureDir();
    const runDate = '2026-09-25';
    const deadSince = '2026-08-26'; // 30 days before runDate — outside the 14-day window

    writeJson(
      join(rawBaseDir, deadSince, INFO_FILE),
      makeInfoMap({ AAA: 2, BBB: 3, CCC: 1 }),
    );

    const indicators: RawIndicator[] = [];
    const advisoryInfo: AdvisoryInfoMap = {};
    const errors: string[] = [];

    enforcePerSourceFloors({
      logPrefix: '[TEST]',
      infoFile: INFO_FILE,
      expectedIssuers: [ISSUER],
      floors: { [ISSUER]: 2 },
      indicators,
      advisoryInfo,
      errors,
      runDate,
      rawBaseDir,
    });

    assert.equal(
      indicators.filter((i) => i.source === `advisories_${ISSUER}`).length,
      0,
      'a cache older than MAX_RESTORE_AGE_DAYS must not be restored',
    );
    assert.equal((advisoryInfo as any).AAA, undefined);
    assert.ok(
      errors.some((e) => e.includes(`dead since ${deadSince}`) && e.includes('not restored') && e.includes(`older than ${MAX_RESTORE_AGE_DAYS} days`)),
      `expected a "dead since ${deadSince} — not restored" error, got: ${JSON.stringify(errors)}`,
    );
  });

  it('reports "dead since never" when the issuer has no healthy day in the archive', () => {
    const rawBaseDir = trackedFixtureDir();
    const runDate = '2026-09-25';

    // A cache file exists, but never had enough countries to meet the floor.
    writeJson(join(rawBaseDir, '2026-09-01', INFO_FILE), makeInfoMap({ AAA: 2 }));

    const indicators: RawIndicator[] = [];
    const errors: string[] = [];

    enforcePerSourceFloors({
      logPrefix: '[TEST]',
      infoFile: INFO_FILE,
      expectedIssuers: [ISSUER],
      floors: { [ISSUER]: 5 }, // the single fixture day (1 country) never meets this
      indicators,
      advisoryInfo: {},
      errors,
      runDate,
      rawBaseDir,
    });

    assert.ok(
      errors.some((e) => e.includes('dead since never') && e.includes('not restored')),
      `expected a "dead since never" error, got: ${JSON.stringify(errors)}`,
    );
  });

  it('restores from the most recent healthy day, not the all-time maximum', () => {
    const rawBaseDir = trackedFixtureDir();
    const runDate = '2026-09-25';
    const olderMaxDay = '2026-09-01';   // holds the ALL-TIME MAX count (5 countries)
    const recentHealthyDay = '2026-09-20'; // fewer countries, but more recent and still >= floor

    // Older day: the historical high-water mark. AAA is level 1 here.
    writeJson(
      join(rawBaseDir, olderMaxDay, INFO_FILE),
      makeInfoMap({ AAA: 1, BBB: 1, CCC: 1, DDD: 1, EEE: 1 }),
    );
    // More recent day: smaller coverage, but AAA's level changed to 4 — this
    // is the value that must win if "most recent" (not "maximum") is used.
    writeJson(
      join(rawBaseDir, recentHealthyDay, INFO_FILE),
      makeInfoMap({ AAA: 4, FFF: 4, GGG: 4, HHH: 4 }),
    );

    // floor = max(absoluteFloor, ceil(0.6 * historicalMax=5)) = max(2, 3) = 3
    // recentHealthyDay's count (4) still clears that floor.
    const indicators: RawIndicator[] = [];
    const advisoryInfo: AdvisoryInfoMap = {};
    const errors: string[] = [];

    enforcePerSourceFloors({
      logPrefix: '[TEST]',
      infoFile: INFO_FILE,
      expectedIssuers: [ISSUER],
      floors: { [ISSUER]: 2 },
      indicators,
      advisoryInfo,
      errors,
      runDate,
      rawBaseDir,
    });

    const restoredIso3s = indicators
      .filter((i) => i.source === `advisories_${ISSUER}`)
      .map((i) => i.countryIso3)
      .sort();

    assert.deepEqual(
      restoredIso3s,
      ['AAA', 'FFF', 'GGG', 'HHH'],
      'should restore the recent day\'s 4 countries, not the older max day\'s 5',
    );
    assert.equal(
      (advisoryInfo as any).AAA?.[ISSUER]?.level,
      4,
      'AAA should carry the MORE RECENT level (4), not the historical-max day\'s level (1)',
    );
    assert.equal((advisoryInfo as any).AAA?.[ISSUER]?.restoredFrom, recentHealthyDay);
    assert.equal((advisoryInfo as any).BBB, undefined, 'countries only present in the older max day must not appear');
  });

  it('a restored day never counts as healthy for a later run (no infinite restore chain)', () => {
    // Reproduces a chain found live on 2026-09-25: an issuer dead long before this
    // fix shipped had EVERY prior day's cache re-restored-and-rewritten daily by the
    // OLD (unbounded) code. Without excluding restored entries from the healthy-day
    // scan, day N's restore-from-day-(N-1) output would itself look "healthy" (full
    // count) to day (N+1)'s scan, which would restore from IT instead — an infinite
    // chain that never actually stops, defeating the whole point of the 14-day bound.
    const rawBaseDir = trackedFixtureDir();
    const runDate = '2026-09-25';
    const genuineDay = '2026-09-22';   // last GENUINE (non-restored) healthy day, 3 days old
    const restoredDay = '2026-09-24';  // yesterday — but its data was ITSELF a restore

    writeJson(join(rawBaseDir, genuineDay, INFO_FILE), makeInfoMap({ AAA: 2, BBB: 3, CCC: 1 }));

    // Simulate "yesterday's run already applied this fix and restored from genuineDay" —
    // same 3 countries, but every entry carries restoredFrom, exactly as enforcePerSourceFloors
    // itself would have written them.
    const restoredMap = makeInfoMap({ AAA: 2, BBB: 3, CCC: 1 });
    for (const iso3 of Object.keys(restoredMap)) {
      (restoredMap as any)[iso3][ISSUER].restoredFrom = genuineDay;
    }
    writeJson(join(rawBaseDir, restoredDay, INFO_FILE), restoredMap);

    const indicators: RawIndicator[] = []; // today's live fetch still collapsed to zero
    const advisoryInfo: AdvisoryInfoMap = {};
    const errors: string[] = [];

    enforcePerSourceFloors({
      logPrefix: '[TEST]',
      infoFile: INFO_FILE,
      expectedIssuers: [ISSUER],
      floors: { [ISSUER]: 2 },
      indicators,
      advisoryInfo,
      errors,
      runDate,
      rawBaseDir,
    });

    assert.equal(
      indicators.filter((i) => i.source === `advisories_${ISSUER}`).length,
      3,
      'should still restore (genuineDay is within the 14-day window)',
    );
    assert.equal(
      (advisoryInfo as any).AAA?.[ISSUER]?.restoredFrom,
      genuineDay,
      'must skip past the restored day and reach back to the last GENUINE healthy day',
    );
  });

  it('does not touch a healthy issuer (no violation, no restore, no error)', () => {
    const rawBaseDir = trackedFixtureDir();
    const runDate = '2026-09-25';

    const indicators: RawIndicator[] = [
      { countryIso3: 'AAA', indicatorName: `advisory_level_${ISSUER}`, value: 2, year: 2026, source: `advisories_${ISSUER}` },
      { countryIso3: 'BBB', indicatorName: `advisory_level_${ISSUER}`, value: 1, year: 2026, source: `advisories_${ISSUER}` },
      { countryIso3: 'CCC', indicatorName: `advisory_level_${ISSUER}`, value: 3, year: 2026, source: `advisories_${ISSUER}` },
    ];
    const errors: string[] = [];

    enforcePerSourceFloors({
      logPrefix: '[TEST]',
      infoFile: INFO_FILE,
      expectedIssuers: [ISSUER],
      floors: { [ISSUER]: 2 },
      indicators,
      advisoryInfo: {},
      errors,
      runDate,
      rawBaseDir,
    });

    assert.equal(indicators.length, 3, 'no restore should be appended when already above floor');
    assert.equal(errors.length, 0);
  });
});
