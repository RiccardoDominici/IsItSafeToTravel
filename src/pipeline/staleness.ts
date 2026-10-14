import { join } from 'node:path';
import type { RawIndicator, RawSourceData } from './types.js';
import { getRawDir, writeJson } from './utils/fs.js';
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

/** Apply the max-lag rule to every slow source. Pure. */
export function evaluateStaleness(obs: StalenessObservations): StalenessCheck[] {
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
    ...WB_INDICATOR_NAMES.map((name) =>
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
}): StalenessReport {
  const checks = evaluateStaleness(input.observations);
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

/**
 * ntfy messages for this report: one warning when anything is behind, one info when
 * a new INFORM edition was stored. Titles are ASCII (they travel in headers).
 */
export function buildNtfyMessages(report: StalenessReport): NtfyMessage[] {
  const messages: NtfyMessage[] = [];

  if (report.violations.length > 0) {
    messages.push({
      title: `Data staleness: ${report.violations.length} source(s) behind (${report.date})`,
      body: report.violations.map((v) => `- ${v}`).join('\n'),
      priority: 'high',
      tags: ['warning', 'isitsafetotravel'],
    });
  }

  if (report.newInformEdition && report.informEdition) {
    messages.push({
      title: `New INFORM edition stored (${report.date})`,
      body: `${report.informEdition.file} (edition ${report.informEdition.editionYear}) is now the stored INFORM edition.`,
      priority: 'default',
      tags: ['information_source', 'isitsafetotravel'],
    });
  }

  return messages;
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
  });

  for (const line of formatStalenessLines(report)) {
    if (line.includes('VIOLATION')) console.warn(line);
    else console.log(line);
  }

  writeJson(join(getRawDir(params.date), 'staleness.json'), report);

  const messages = buildNtfyMessages(report);
  const topic = ntfyTopicFromEnv(params.env ?? process.env);
  if (messages.length === 0) {
    console.log('[STALENESS] All sources current, no notification');
  } else if (!topic) {
    console.log(`[STALENESS] NTFY_TOPIC not set, ${messages.length} notification(s) not sent`);
  } else {
    for (const message of messages) await pushNtfy(topic, message, params.fetchImpl);
  }

  console.log(
    `[STALENESS] Summary: ${report.violations.length} violation(s), new INFORM edition: ${report.newInformEdition ? 'yes' : 'no'} (report: ${join('data', 'raw', params.date, 'staleness.json')})`,
  );
  return report;
}
