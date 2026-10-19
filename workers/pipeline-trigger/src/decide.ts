/**
 * Pure decision logic for the daily pipeline trigger: given today's runs of
 * data-pipeline.yml, should the Worker dispatch a new run?
 *
 * Kept free of I/O so it can be unit-tested and shared in spirit with the
 * workflow's own `guard` job, which applies the same "is today's daily run
 * done?" rule to GitHub's (late) scheduled fallback run.
 */

/** The subset of a GitHub workflow run that the decision needs. */
export interface WorkflowRun {
  id: number;
  event: string;
  status: string;
  conclusion: string | null;
  display_title: string;
  created_at: string;
}

export type Decision =
  | { action: 'skip'; reason: string }
  | { action: 'dispatch'; reason: string; retry: boolean }
  | { action: 'give_up'; reason: string };

/**
 * Today's daily run is the first one dispatched at or after this time (UTC).
 * Manual runs started earlier in the night (corrective runs, backfills) do not
 * count as the day's run.
 */
export const WINDOW_START_UTC = '05:55:00';

/**
 * Hard cap on daily-run attempts per UTC day. Three Worker slots plus GitHub's
 * own late scheduled fallback make four. Beyond that, something is
 * deterministically broken and more runs only add noise.
 */
export const MAX_DAILY_ATTEMPTS = 4;

/** Statuses of a run that has not finished yet (GitHub REST `status` values). */
const ACTIVE_STATUSES = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);

/**
 * A "daily" run is one that produces today's data AND may email the digest.
 * The workflow's `run-name` marks the two kinds of manual run that are not:
 * - a backfill for another date ("Daily Data Pipeline for 2026-10-18");
 * - a corrective run that skips the newsletter ("… (no digest)").
 * Neither one may stand in for the day's run, or the digest would never go out.
 */
export function isDailyRun(displayTitle: string): boolean {
  return !/ for \d{4}-\d{2}-\d{2}|\(no digest\)/.test(displayTitle);
}

/** ISO timestamp where today's window opens, e.g. "2026-10-19T05:55:00Z". */
export function windowStart(now: Date): string {
  return `${now.toISOString().slice(0, 10)}T${WINDOW_START_UTC}Z`;
}

/**
 * Decide what to do in one cron slot.
 * `runs` must be the workflow's runs created since `windowStart(now)`.
 */
export function decide(runs: WorkflowRun[]): Decision {
  // Something is still running (ours, a manual run or GitHub's fallback). The
  // workflow's concurrency group would queue a new run behind it anyway; wait
  // for the next slot instead and look at its outcome then.
  const active = runs.find((r) => ACTIVE_STATUSES.has(r.status));
  if (active) {
    return { action: 'skip', reason: `run ${active.id} (${active.event}) is ${active.status}` };
  }

  const daily = runs.filter((r) => isDailyRun(r.display_title));
  const ok = daily.find((r) => r.conclusion === 'success');
  if (ok) {
    return { action: 'skip', reason: `today's run ${ok.id} (${ok.event}) already succeeded` };
  }

  if (daily.length >= MAX_DAILY_ATTEMPTS) {
    return {
      action: 'give_up',
      reason: `${daily.length} daily runs today, none succeeded (last: ${daily[0].conclusion ?? 'unknown'})`,
    };
  }

  if (daily.length > 0) {
    const outcomes = daily.map((r) => r.conclusion ?? r.status).join(', ');
    return { action: 'dispatch', reason: `retry after ${daily.length} unsuccessful run(s): ${outcomes}`, retry: true };
  }
  return { action: 'dispatch', reason: 'no daily run yet today', retry: false };
}
