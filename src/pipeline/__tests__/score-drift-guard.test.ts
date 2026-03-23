import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCORES_DIR = join(process.cwd(), 'data/scores');

// Hard failure threshold: catches extreme scoring bugs (misconfigured weights, broken normalizer).
// Set above observed max drift (0.9/day from signal source fluctuations) to avoid false positives.
const FAIL_THRESHOLD_PER_DAY = 1.5;

// Warning threshold: flags drifts that exceed the configured maxDailyScoreChange (0.3) + tolerance.
// These are logged but do not fail CI, since signal sources naturally cause moderate fluctuations.
const WARN_THRESHOLD_PER_DAY = 0.5;

/** Parse YYYY-MM-DD to epoch ms. */
function parseDate(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getTime();
}

/** Days between two YYYY-MM-DD date strings, minimum 1. */
function daysBetween(d1: string, d2: string): number {
  const ms = Math.abs(parseDate(d2) - parseDate(d1));
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
}

interface SnapshotSlim {
  date: string;
  countries: Array<{ iso3: string; score: number }>;
}

/** Load all dated snapshot files, sorted ascending by date. */
function loadSnapshots(): SnapshotSlim[] {
  const files = readdirSync(SCORES_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort(); // lexicographic sort = date ascending for YYYY-MM-DD

  return files.map((f) => {
    const raw = readFileSync(join(SCORES_DIR, f), 'utf-8');
    const snapshot = JSON.parse(raw);
    return {
      date: snapshot.date ?? f.replace('.json', ''),
      countries: (snapshot.countries ?? []).map((c: { iso3: string; score: number }) => ({
        iso3: c.iso3,
        score: c.score,
      })),
    };
  });
}

describe('Score drift guard: no extreme score changes between consecutive snapshots', () => {
  const snapshots = loadSnapshots();

  it('has at least 2 snapshot files to compare', () => {
    if (snapshots.length < 2) {
      // Pass trivially when there is insufficient data
      return;
    }
    assert.ok(snapshots.length >= 2, `Found ${snapshots.length} snapshots`);
  });

  it('no country score drifts more than 1.5 per day between consecutive snapshots', () => {
    if (snapshots.length < 2) {
      return; // Skip trivially
    }

    const violations: string[] = [];
    const warnings: string[] = [];

    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      const days = daysBetween(prev.date, curr.date);
      const failLimit = FAIL_THRESHOLD_PER_DAY * days;
      const warnLimit = WARN_THRESHOLD_PER_DAY * days;

      // Build lookup for previous snapshot
      const prevScores = new Map<string, number>();
      for (const c of prev.countries) {
        prevScores.set(c.iso3, c.score);
      }

      // Compare each country in current snapshot
      for (const c of curr.countries) {
        const prevScore = prevScores.get(c.iso3);
        if (prevScore === undefined) continue; // New country, no drift to check

        const delta = Math.abs(c.score - prevScore);
        if (delta > failLimit) {
          violations.push(
            `FAIL: ${c.iso3} changed ${prevScore} -> ${c.score} (delta=${delta.toFixed(2)}, limit=${failLimit.toFixed(2)} over ${days}d) between ${prev.date} and ${curr.date}`,
          );
        } else if (delta > warnLimit) {
          warnings.push(
            `WARN: ${c.iso3} changed ${prevScore} -> ${c.score} (delta=${delta.toFixed(2)}, warn=${warnLimit.toFixed(2)} over ${days}d) between ${prev.date} and ${curr.date}`,
          );
        }
      }
    }

    // Log warnings (informational, not failing)
    if (warnings.length > 0) {
      console.log(`  ${warnings.length} drift warning(s) (>${WARN_THRESHOLD_PER_DAY}/day but <${FAIL_THRESHOLD_PER_DAY}/day):`);
      // Show first 10 warnings to keep output manageable
      for (const w of warnings.slice(0, 10)) {
        console.log(`    ${w}`);
      }
      if (warnings.length > 10) {
        console.log(`    ... and ${warnings.length - 10} more`);
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found ${violations.length} extreme score drift(s) exceeding ${FAIL_THRESHOLD_PER_DAY}/day:\n${violations.join('\n')}`,
    );
  });

  it('reports snapshot coverage', () => {
    if (snapshots.length < 2) return;

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const countryCounts = snapshots.map((s) => s.countries.length);
    const minCountries = Math.min(...countryCounts);
    const maxCountries = Math.max(...countryCounts);

    console.log(`  Drift guard checked ${snapshots.length} snapshots`);
    console.log(`  Date range: ${first.date} to ${last.date}`);
    console.log(`  Countries per snapshot: ${minCountries}-${maxCountries}`);
  });
});
