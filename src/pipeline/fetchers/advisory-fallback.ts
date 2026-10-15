import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readJson, writeJson } from '../utils/fs.js';

/**
 * Age limit for the base advisories' cache fallback (US/UK/CA/AU, runWithFloor in
 * advisories.ts). Owner decision, 2026-10-15.
 *
 * When an issuer's fetch breaks, runWithFloor republishes that issuer's last good
 * reading. That fallback had no age limit. On 2026-10-01 travel.gc.ca changed, the CA
 * parser started to read 0 countries, and every daily run until 2026-10-15 published
 * the 2026-10-01 Canadian levels as if they were current. Nothing alerted on it.
 *
 * The rule: a fallback reading counts only while its last live date is at most
 * MAX_FALLBACK_AGE_DAYS before the run date. After that the issuer is dropped for the
 * day: none of its restored entries is written. advisories-fallback.json records
 * each issuer's state, and the staleness monitor (staleness.ts) turns a dropped issuer
 * into a violation, which fires the ntfy alert. A missed run or a short site outage
 * fits inside 7 days. A broken parser shows up within a week instead of never.
 *
 * The tier 1-3b issuers keep their own restore bound (MAX_RESTORE_AGE_DAYS in
 * source-floor.ts), which this rule does not touch.
 */
export const MAX_FALLBACK_AGE_DAYS = 7;

/** Per-run status file, next to advisories-info.json in data/raw/<date>/. */
export const ADVISORY_FALLBACK_FILE = 'advisories-fallback.json';

/**
 * - live: today's fetch met the per-source floor, no fallback used.
 * - restored: below the floor; the fallback filled the gap with a reading at most
 *   MAX_FALLBACK_AGE_DAYS old.
 * - dropped: below the floor and no usable fallback (too old, or none cached). The issuer
 *   keeps only whatever it fetched live today, often nothing.
 */
export type AdvisoryIssuerState = 'live' | 'restored' | 'dropped';

export interface AdvisoryIssuerStatus {
  /** Issuer key, e.g. "ca". */
  issuer: string;
  /** Log label, e.g. "CA". */
  label: string;
  state: AdvisoryIssuerState;
  /** Countries fetched live today. */
  liveCountries: number;
  /** Countries filled from the fallback (state "restored" only). */
  restoredCountries: number;
  /** Cached countries refused because their reading was too old. */
  droppedCountries: number;
  /** Last date the restored or refused reading was fetched live (YYYY-MM-DD), or null. */
  lastLive: string | null;
  /** Run date minus lastLive, in days, or null. */
  ageDays: number | null;
  maxAgeDays: number;
  /** Why the issuer was dropped (state "dropped" only). */
  reason?: string;
}

export interface AdvisoryFallbackReport {
  date: string;
  maxAgeDays: number;
  issuers: AdvisoryIssuerStatus[];
}

/** Whole-day difference (laterYmd - earlierYmd) between two YYYY-MM-DD strings,
 *  computed via Date.UTC so it never shifts with the running process's timezone. */
export function daysBetween(laterYmd: string, earlierYmd: string): number {
  const toUtcMs = (ymd: string): number => {
    const [y, m, d] = ymd.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtcMs(laterYmd) - toUtcMs(earlierYmd)) / 86_400_000);
}

/** True when a reading last fetched live on `lastLive` still counts on `runDate`. */
export function isFallbackFresh(lastLive: string, runDate: string, maxAgeDays = MAX_FALLBACK_AGE_DAYS): boolean {
  return daysBetween(runDate, lastLive) <= maxAgeDays;
}

export function writeAdvisoryFallbackReport(rawDir: string, report: AdvisoryFallbackReport): void {
  writeJson(join(rawDir, ADVISORY_FALLBACK_FILE), report);
}

/** This run's status file, or null when the base advisories fetcher wrote none. */
export function readAdvisoryFallbackReport(rawDir: string): AdvisoryFallbackReport | null {
  const path = join(rawDir, ADVISORY_FALLBACK_FILE);
  if (!existsSync(path)) return null;
  const report = readJson<AdvisoryFallbackReport>(path);
  return report && Array.isArray(report.issuers) ? report : null;
}
