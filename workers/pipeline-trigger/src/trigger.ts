/**
 * What each cron firing does. Two jobs:
 * - daily slots: start today's data-pipeline run if it has not run or has
 *   failed (see decide.ts), and retry in the later slots;
 * - self-check (any other cron, used on demand after setup or a token change):
 *   prove that the token still reads runs and may dispatch, without starting
 *   a run. Day to day the morning dispatch itself proves the token works, and
 *   the expiry warning below covers tokens that expire.
 *
 * Why this exists: GitHub's own `schedule` trigger fired the 06:00 UTC run
 * 4–8 hours late through Sept–Oct 2026 (10:13–14:34 UTC in October) and is
 * documented as best-effort. A Cloudflare cron calling `workflow_dispatch`
 * starts the run within seconds.
 */
import { decide, windowStart } from './decide';
import { GitHubError, dispatchRun, listRunsSince, probeDispatchPermission, type GitHubConfig } from './github';
import { notify } from './notify';

export interface Env {
  /** Secret: fine-grained PAT, this repo only, "Actions: read and write". */
  GITHUB_TOKEN?: string;
  GITHUB_REPO: string;
  WORKFLOW_FILE: string;
  GITHUB_REF: string;
  NTFY_TOPIC?: string;
}

/**
 * Cron expression (UTC) of the daily slots, ONE trigger firing three times:
 * - 06:05: the run itself (the old GitHub schedule was 06:00);
 * - 07:05: retry if it failed (a run takes ~16 minutes, at most 45);
 * - 08:05: last retry, still hours ahead of GitHub's late fallback.
 * One expression, not three, because the Workers Free plan allows 5 cron
 * triggers per ACCOUNT and another project already uses 3 of them.
 * Must match `[triggers]` in wrangler.toml (a unit test checks this).
 * Any other cron runs the self-check.
 */
export const DAILY_CRON = '5 6-8 * * *';

/** UTC hour of the first daily slot: the only one that sends the expiry reminder. */
const FIRST_SLOT_HOUR_UTC = 6;

/** Warn this many days before the token expires (only if it has an expiry). */
export const EXPIRY_WARNING_DAYS = 14;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SlotResult {
  kind: 'daily' | 'self-check';
  outcome: 'skipped' | 'dispatched' | 'gave_up' | 'ok' | 'error';
  detail: string;
}

const DAY_MS = 86_400_000;

function config(env: Env): GitHubConfig | null {
  if (!env.GITHUB_TOKEN) return null;
  return { token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, workflow: env.WORKFLOW_FILE, ref: env.GITHUB_REF };
}

function actionsUrl(env: Env): string {
  return `https://github.com/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW_FILE}`;
}

async function warnIfExpiring(env: Env, expiresAt: Date | null, now: Date, fetchImpl: FetchLike): Promise<void> {
  if (!expiresAt) return;
  const daysLeft = Math.floor((expiresAt.getTime() - now.getTime()) / DAY_MS);
  if (daysLeft > EXPIRY_WARNING_DAYS) return;
  await notify(
    env.NTFY_TOPIC,
    {
      title: 'Pipeline trigger: GitHub token expiring',
      message: `The token that starts the daily data pipeline expires in ${daysLeft} day(s) (${expiresAt.toISOString().slice(0, 10)}). Create a new one and run: npx wrangler secret put GITHUB_TOKEN --config workers/pipeline-trigger/wrangler.toml`,
      priority: 4,
      tags: ['warning'],
    },
    fetchImpl,
  );
}

async function reportError(env: Env, kind: SlotResult['kind'], err: unknown, fetchImpl: FetchLike): Promise<SlotResult> {
  const detail = err instanceof Error ? err.message : String(err);
  const hint =
    err instanceof GitHubError && (err.status === 401 || err.status === 403 || err.status === 404)
      ? ' The GitHub token is probably expired, revoked or missing "Actions: read and write" on the repository.'
      : '';
  console.error(`[pipeline-trigger] ${kind} error: ${detail}`);
  await notify(
    env.NTFY_TOPIC,
    {
      title: `Pipeline trigger ${kind} failed`,
      message: `${detail}.${hint} GitHub's own late scheduled run is still the fallback. ${actionsUrl(env)}`,
      priority: 4,
      tags: ['rotating_light'],
    },
    fetchImpl,
  );
  return { kind, outcome: 'error', detail };
}

function missingToken(env: Env, kind: SlotResult['kind'], fetchImpl: FetchLike): Promise<SlotResult> {
  return reportError(env, kind, new Error('GITHUB_TOKEN secret is not set'), fetchImpl);
}

/** One daily slot: look at today's runs, then dispatch, wait or give up. */
export async function runDailySlot(env: Env, now: Date, fetchImpl: FetchLike = fetch): Promise<SlotResult> {
  const cfg = config(env);
  if (!cfg) return missingToken(env, 'daily', fetchImpl);
  try {
    const { runs, expiresAt } = await listRunsSince(cfg, windowStart(now), fetchImpl);
    // Expiry reminder once a day, in the first slot only.
    if (now.getUTCHours() === FIRST_SLOT_HOUR_UTC) await warnIfExpiring(env, expiresAt, now, fetchImpl);

    const decision = decide(runs);
    console.log(`[pipeline-trigger] ${now.toISOString()}: ${runs.length} run(s) since ${windowStart(now)} → ${decision.action} (${decision.reason})`);

    if (decision.action === 'skip') return { kind: 'daily', outcome: 'skipped', detail: decision.reason };

    if (decision.action === 'give_up') {
      await notify(
        env.NTFY_TOPIC,
        {
          title: 'Daily pipeline: giving up for today',
          message: `${decision.reason}. No more automatic retries today. ${actionsUrl(env)}`,
          priority: 4,
          tags: ['rotating_light'],
        },
        fetchImpl,
      );
      return { kind: 'daily', outcome: 'gave_up', detail: decision.reason };
    }

    const res = await dispatchRun(cfg, fetchImpl);
    if (!res.ok) throw new GitHubError(res.status, await res.text(), 'dispatch');
    console.log(`[pipeline-trigger] dispatched ${cfg.workflow} on ${cfg.ref} (HTTP ${res.status})`);
    // A first dispatch is routine and the pipeline sends its own notification
    // when it ends. A retry means the morning run failed, which is news.
    if (decision.retry) {
      await notify(
        env.NTFY_TOPIC,
        {
          title: 'Daily pipeline re-started',
          message: `${decision.reason}. Started a new run. ${actionsUrl(env)}`,
          tags: ['repeat'],
        },
        fetchImpl,
      );
    }
    return { kind: 'daily', outcome: 'dispatched', detail: decision.reason };
  } catch (err) {
    return reportError(env, 'daily', err, fetchImpl);
  }
}

/** Prove the token can still read runs and dispatch, without starting a run. */
export async function runSelfCheck(env: Env, now: Date, fetchImpl: FetchLike = fetch): Promise<SlotResult> {
  const cfg = config(env);
  if (!cfg) return missingToken(env, 'self-check', fetchImpl);
  try {
    const { runs, expiresAt } = await listRunsSince(cfg, windowStart(now), fetchImpl);
    await probeDispatchPermission(cfg, fetchImpl);
    await warnIfExpiring(env, expiresAt, now, fetchImpl);
    const expiry = expiresAt ? `expires ${expiresAt.toISOString().slice(0, 10)}` : 'no expiry';
    const detail = `token can read (${runs.length} run(s) today) and dispatch; ${expiry}`;
    console.log(`[pipeline-trigger] self-check OK: ${detail}`);
    return { kind: 'self-check', outcome: 'ok', detail };
  } catch (err) {
    return reportError(env, 'self-check', err, fetchImpl);
  }
}

/** Route a cron firing to its job. */
export function runSlot(env: Env, cron: string, scheduledTime: number, fetchImpl: FetchLike = fetch): Promise<SlotResult> {
  const now = new Date(scheduledTime);
  return cron === DAILY_CRON
    ? runDailySlot(env, now, fetchImpl)
    : runSelfCheck(env, now, fetchImpl);
}
