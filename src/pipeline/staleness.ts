import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import type { RawIndicator, RawSourceData, WeightsConfig } from './types.js';
import { getRawDir, readJson, writeJson } from './utils/fs.js';
import { getInformStoreDir, readStoredInformEdition, type StoredInformEdition } from './fetchers/inform-edition.js';
import { WB_INDICATOR_NAMES } from './fetchers/worldbank.js';
import { ntfyTopicFromEnv, pushNtfy, type NtfyMessage } from './utils/ntfy.js';

/**
 * Staleness monitor (formula v10, SPEC §6).
 *
 * After fetching, each slow source's newest data year is compared with the cycle it
 * should be on. A source whose data falls behind is a violation: it gets a summary
 * line, a GitHub warning in the workflow, and an ntfy push. A newly stored INFORM
 * edition gets an info push. Nothing here changes a score. This is an alarm, not a
 * filter (the max-age rule belongs to the engine).
 *
 * Rules: newest data year >= run year - max lag.
 *   INFORM edition 1, GPI 1, V-Dem 2, UCDP 2, each World Bank indicator 3.
 *
 * Only the World Bank series the engine reads are checked (see
 * worldbankIndicatorsUsedBy): an unscored series falling behind is not a data
 * problem worth a push. The ntfy warning fires when a violation APPEARS (compared
 * with the previous report), not on every run while it persists: a World Bank
 * series can lag for months, and a daily high-priority push would be spam. The
 * workflow summary still lists every violation on every run.
 */

/** Maximum years a source may trail the run year (SPEC §6). */
export const MAX_LAG_YEARS = {
  inform: 1,
  gpi: 1,
  vdem: 2,
  ucdp: 2,
  worldbank: 3,
} as const;

export interface StalenessObservations {
  /** Year of the pipeline date (not the wall clock). */
  runYear: number;
  /** Edition year of the INFORM data. */
  inform: number | null;
  gpi: number | null;
  vdem: number | null;
  ucdp: number | null;
  /** Newest year across countries, per World Bank indicator name. A missing key means no data. */
  worldbank: Record<string, number>;
}

export interface StalenessCheck {
  /** Stable key: "inform", "gpi", "vdem", "ucdp" or "worldbank:<indicator>". */
  key: string;
  label: string;
  newestYear: number | null;
  maxLagYears: number;
  minYear: number;
  ok: boolean;
}

export interface StalenessReport {
  date: string;
  generatedAt: string;
  runYear: number;
  informEdition: StoredInformEdition | null;
  /** True when the stored INFORM edition was first stored during this run. */
  newInformEdition: boolean;
  checks: StalenessCheck[];
  /** One human-readable line per failed check. */
  violations: string[];
  /**
   * Keys of the current violations a successful ntfy push has covered, on this run or on
   * an earlier run while they persisted. Read by the next run to avoid repeating the push.
   * Absent in reports written before this field existed (treated as none notified).
   */
  notifiedViolationKeys?: string[];
}

/** Newest `year` in a list of indicators, or null when the list is empty. */
export function newestYearOf(indicators: readonly RawIndicator[] | undefined): number | null {
  let newest: number | null = null;
  for (const ind of indicators ?? []) {
    if (Number.isFinite(ind.year) && (newest === null || ind.year > newest)) newest = ind.year;
  }
  return newest;
}

/** Newest `year` per indicator name (across countries). */
export function newestYearByIndicator(indicators: readonly RawIndicator[] | undefined): Record<string, number> {
  const newest: Record<string, number> = {};
  for (const ind of indicators ?? []) {
    if (!Number.isFinite(ind.year)) continue;
    const current = newest[ind.indicatorName];
    if (current === undefined || ind.year > current) newest[ind.indicatorName] = ind.year;
  }
  return newest;
}

/**
 * The World Bank series the scoring engine reads: those listed in a pillar of the
 * weights config, plus wb_population, which damps wb_homicide's precision
 * (engine.ts, P_HALF) without being scored itself. Pure.
 */
export function worldbankIndicatorsUsedBy(weights: Pick<WeightsConfig, 'pillars'>): string[] {
  const used = new Set(weights.pillars.flatMap((pillar) => pillar.indicators));
  return WB_INDICATOR_NAMES.filter((name) => used.has(name) || name === 'wb_population');
}

/**
 * Apply the max-lag rule to every slow source. Pure. `worldbankIndicators` defaults to
 * every series the World Bank fetcher writes; the pipeline passes the engine's subset.
 */
export function evaluateStaleness(
  obs: StalenessObservations,
  worldbankIndicators: readonly string[] = WB_INDICATOR_NAMES,
): StalenessCheck[] {
  const check = (key: string, label: string, newestYear: number | null, maxLagYears: number): StalenessCheck => {
    const minYear = obs.runYear - maxLagYears;
    return {
      key,
      label,
      newestYear,
      maxLagYears,
      minYear,
      ok: newestYear !== null && newestYear >= minYear,
    };
  };

  return [
    check('inform', 'INFORM Risk edition', obs.inform, MAX_LAG_YEARS.inform),
    check('gpi', 'Global Peace Index', obs.gpi, MAX_LAG_YEARS.gpi),
    check('vdem', 'V-Dem governance', obs.vdem, MAX_LAG_YEARS.vdem),
    check('ucdp', 'UCDP conflict deaths', obs.ucdp, MAX_LAG_YEARS.ucdp),
    ...worldbankIndicators.map((name) =>
      check(`worldbank:${name}`, `World Bank ${name}`, obs.worldbank[name] ?? null, MAX_LAG_YEARS.worldbank),
    ),
  ];
}

function describeViolation(check: StalenessCheck): string {
  const found = check.newestYear === null ? 'no data' : `newest ${check.newestYear}`;
  const lag = `${check.maxLagYears} year${check.maxLagYears === 1 ? '' : 's'}`;
  return `${check.label}: ${found}, needs at least ${check.minYear} (max lag ${lag})`;
}

/**
 * True when the stored edition was first stored at or after the run started. The
 * comparison uses the full timestamp, so a second run on the same day does not
 * announce the edition again.
 */
export function isNewEditionSince(edition: StoredInformEdition | null, runStartedAt: string): boolean {
  if (!edition) return false;
  const firstSeen = Date.parse(edition.firstSeen);
  const started = Date.parse(runStartedAt);
  return Number.isFinite(firstSeen) && Number.isFinite(started) && firstSeen >= started;
}

export function buildStalenessReport(input: {
  date: string;
  generatedAt: string;
  observations: StalenessObservations;
  informEdition: StoredInformEdition | null;
  runStartedAt: string;
  worldbankIndicators?: readonly string[];
}): StalenessReport {
  const checks = evaluateStaleness(input.observations, input.worldbankIndicators);
  return {
    date: input.date,
    generatedAt: input.generatedAt,
    runYear: input.observations.runYear,
    informEdition: input.informEdition,
    newInformEdition: isNewEditionSince(input.informEdition, input.runStartedAt),
    checks,
    violations: checks.filter((c) => !c.ok).map(describeViolation),
  };
}

/** Pull the observations out of this run's loaded raw data. Call before any year-changing injection. */
export function collectObservations(
  date: string,
  rawDataMap: ReadonlyMap<string, RawSourceData>,
): StalenessObservations {
  return {
    runYear: parseInt(date.slice(0, 4), 10),
    inform: newestYearOf(rawDataMap.get('inform')?.indicators),
    gpi: newestYearOf(rawDataMap.get('gpi')?.indicators),
    vdem: newestYearOf(rawDataMap.get('vdem')?.indicators),
    ucdp: newestYearOf(rawDataMap.get('ucdp')?.indicators),
    worldbank: newestYearByIndicator(rawDataMap.get('worldbank')?.indicators),
  };
}

/** Log lines for the run. Violation lines start with "[STALENESS] VIOLATION" (the workflow greps for it). */
export function formatStalenessLines(report: StalenessReport): string[] {
  const lines = [
    `[STALENESS] Run year ${report.runYear} (${report.date}): ${report.checks.length} checks, ${report.violations.length} violation(s)`,
  ];
  for (const check of report.checks) {
    const newest = check.newestYear === null ? 'none' : String(check.newestYear);
    lines.push(
      check.ok
        ? `[STALENESS] ok ${check.label}: newest ${newest} (needs >= ${check.minYear})`
        : `[STALENESS] VIOLATION ${check.label}: newest ${newest} (needs >= ${check.minYear}, max lag ${check.maxLagYears})`,
    );
  }
  if (report.newInformEdition && report.informEdition) {
    lines.push(
      `[STALENESS] NEW INFORM edition stored: ${report.informEdition.file} (edition ${report.informEdition.editionYear})`,
    );
  }
  return lines;
}

/** Keys of the checks failing in this report. */
function violationKeys(report: Pick<StalenessReport, 'checks'>): string[] {
  return report.checks.filter((c) => !c.ok).map((c) => c.key);
}

/**
 * Keys of the checks failing now that no earlier push has covered. Pure.
 * `alreadyNotified` comes from the previous report's notifiedViolationKeys.
 */
export function newViolationKeys(
  report: Pick<StalenessReport, 'checks'>,
  alreadyNotified: readonly string[] = [],
): string[] {
  const covered = new Set(alreadyNotified);
  return violationKeys(report).filter((key) => !covered.has(key));
}

/**
 * The most recent staleness.json written for `date` or an earlier run date, or null.
 * Read BEFORE this run writes its own, so a same-day rerun sees the first run of the day.
 */
export function readPreviousStalenessReport(date: string): StalenessReport | null {
  const rawBase = join(process.cwd(), 'data', 'raw');
  if (!existsSync(rawBase)) return null;
  const dates = readdirSync(rawBase)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= date)
    .sort()
    .reverse();
  for (const d of dates) {
    const path = join(rawBase, d, 'staleness.json');
    if (!existsSync(path)) continue;
    const report = readJson<StalenessReport>(path);
    if (report && Array.isArray(report.checks)) return report;
  }
  return null;
}

/**
 * The violations of the previous report that a push covered AND that still fail now.
 * A violation that cleared drops out, so it is pushed again if it ever comes back.
 */
export function carriedNotifiedKeys(report: Pick<StalenessReport, 'checks'>, previous: StalenessReport | null): string[] {
  const current = new Set(violationKeys(report));
  return (previous?.notifiedViolationKeys ?? []).filter((key) => current.has(key));
}

/** The staleness warning, or null when every current violation was already pushed. */
export function buildStalenessWarning(report: StalenessReport, alreadyNotified: readonly string[] = []): NtfyMessage | null {
  if (report.violations.length === 0 || newViolationKeys(report, alreadyNotified).length === 0) return null;
  return {
    title: `Data staleness: ${report.violations.length} source(s) behind (${report.date})`,
    body: report.violations.map((v) => `- ${v}`).join('\n'),
    priority: 'high',
    tags: ['warning', 'isitsafetotravel'],
  };
}

/** The info message for an INFORM edition stored during this run, or null. */
export function buildEditionNotice(report: StalenessReport): NtfyMessage | null {
  if (!report.newInformEdition || !report.informEdition) return null;
  return {
    title: `New INFORM edition stored (${report.date})`,
    body: `${report.informEdition.file} (edition ${report.informEdition.editionYear}) is now the stored INFORM edition.`,
    priority: 'default',
    tags: ['information_source', 'isitsafetotravel'],
  };
}

/**
 * ntfy messages for this report: one warning when a violation is not yet covered by a
 * push (the body lists every current violation), one info when a new INFORM edition was
 * stored. Titles are ASCII (they travel in headers).
 */
export function buildNtfyMessages(report: StalenessReport, alreadyNotified: readonly string[] = []): NtfyMessage[] {
  return [buildStalenessWarning(report, alreadyNotified), buildEditionNotice(report)].filter(
    (m): m is NtfyMessage => m !== null,
  );
}

/**
 * Run the monitor for one pipeline date. Writes data/raw/<date>/staleness.json, logs
 * the summary, and pushes ntfy only when NTFY_TOPIC is set (the workflow sets it;
 * local runs and tests do not). Throws only on a disk error; run.ts catches it.
 */
export async function runStalenessMonitor(params: {
  date: string;
  rawDataMap: ReadonlyMap<string, RawSourceData>;
  runStartedAt: string;
  /** World Bank series to check; the pipeline passes worldbankIndicatorsUsedBy(weights). */
  worldbankIndicators?: readonly string[];
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): Promise<StalenessReport> {
  const observations = collectObservations(params.date, params.rawDataMap);
  const informEdition = readStoredInformEdition(getInformStoreDir());
  const report = buildStalenessReport({
    date: params.date,
    generatedAt: new Date().toISOString(),
    observations,
    informEdition,
    runStartedAt: params.runStartedAt,
    worldbankIndicators: params.worldbankIndicators,
  });
  const previous = readPreviousStalenessReport(params.date);
  const alreadyNotified = carriedNotifiedKeys(report, previous);

  for (const line of formatStalenessLines(report)) {
    if (line.includes('VIOLATION')) console.warn(line);
    else console.log(line);
  }

  const warning = buildStalenessWarning(report, alreadyNotified);
  const notice = buildEditionNotice(report);
  const topic = ntfyTopicFromEnv(params.env ?? process.env);
  let warningPushed = false;
  if (!warning && !notice) {
    console.log(
      report.violations.length > 0
        ? `[STALENESS] ${report.violations.length} violation(s) already notified on an earlier run, no new notification`
        : '[STALENESS] All sources current, no notification',
    );
  } else if (!topic) {
    console.log(`[STALENESS] NTFY_TOPIC not set, ${[warning, notice].filter(Boolean).length} notification(s) not sent`);
  } else {
    if (warning) warningPushed = await pushNtfy(topic, warning, params.fetchImpl);
    if (notice) await pushNtfy(topic, notice, params.fetchImpl);
  }

  // Only a push that actually went out silences the next run; an unset topic or a
  // failed push leaves the violation "not yet notified".
  report.notifiedViolationKeys = warningPushed ? violationKeys(report) : alreadyNotified;
  writeJson(join(getRawDir(params.date), 'staleness.json'), report);

  console.log(
    `[STALENESS] Summary: ${report.violations.length} violation(s), new INFORM edition: ${report.newInformEdition ? 'yes' : 'no'} (report: ${join('data', 'raw', params.date, 'staleness.json')})`,
  );
  return report;
}
