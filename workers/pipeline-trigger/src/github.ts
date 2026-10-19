/**
 * Minimal GitHub REST client for the pipeline trigger: list today's workflow
 * runs, dispatch a run, and probe that the token may dispatch at all.
 *
 * The token is a fine-grained PAT limited to this one repository with
 * "Actions: read and write" — nothing else.
 */
import type { WorkflowRun } from './decide';

export interface GitHubConfig {
  token: string;
  /** "owner/repo" */
  repo: string;
  /** Workflow file name, e.g. "data-pipeline.yml". */
  workflow: string;
  /** Branch the dispatched run checks out, e.g. "master". */
  ref: string;
}

/** Ref used by the permission probe. It must never exist in the repository. */
export const PROBE_REF = 'pipeline-trigger-permission-probe';

/** Thrown for any non-2xx answer, so the caller can report status and body. */
export class GitHubError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    what: string,
  ) {
    super(`GitHub ${what} failed: HTTP ${status} ${body.slice(0, 300)}`);
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function headers(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    // GitHub rejects API calls without a User-Agent.
    'User-Agent': 'isitsafetotravel-pipeline-trigger',
  };
}

function workflowUrl(cfg: GitHubConfig, suffix: string): string {
  return `https://api.github.com/repos/${cfg.repo}/actions/workflows/${encodeURIComponent(cfg.workflow)}/${suffix}`;
}

/**
 * When the token expires, as reported by GitHub on every authenticated answer
 * (`github-authentication-token-expiration: 2027-10-19 06:05:00 UTC`).
 * Null for a token without expiry, or when the header is missing or unreadable.
 */
export function tokenExpiry(res: Response): Date | null {
  const raw = res.headers.get('github-authentication-token-expiration');
  if (!raw) return null;
  const parsed = new Date(raw.trim().replace(' UTC', 'Z').replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Runs of the workflow created at or after `sinceIso`, newest first. */
export async function listRunsSince(
  cfg: GitHubConfig,
  sinceIso: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ runs: WorkflowRun[]; expiresAt: Date | null }> {
  const url = workflowUrl(cfg, `runs?per_page=100&created=${encodeURIComponent(`>=${sinceIso}`)}`);
  const res = await fetchImpl(url, { headers: headers(cfg.token), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new GitHubError(res.status, await res.text(), 'list runs');
  const body = (await res.json()) as { workflow_runs?: WorkflowRun[] };
  return { runs: body.workflow_runs ?? [], expiresAt: tokenExpiry(res) };
}

/** Start a run on `cfg.ref` with no inputs: a normal daily run, digest included. */
export async function dispatchRun(cfg: GitHubConfig, fetchImpl: FetchLike = fetch, ref = cfg.ref): Promise<Response> {
  return fetchImpl(workflowUrl(cfg, 'dispatches'), {
    method: 'POST',
    headers: { ...headers(cfg.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref }),
    signal: AbortSignal.timeout(20_000),
  });
}

/**
 * Check, without starting anything, that the token may dispatch the workflow.
 * GitHub checks permissions before it resolves the ref, so a dispatch to a
 * branch that does not exist answers 422 "No ref found" when the token is
 * allowed, and 403/404 when it is not. Checked by hand on 2026-10-19.
 */
export async function probeDispatchPermission(cfg: GitHubConfig, fetchImpl: FetchLike = fetch): Promise<void> {
  const res = await dispatchRun(cfg, fetchImpl, PROBE_REF);
  const body = await res.text();
  if (res.status === 422 && body.includes('No ref found')) return;
  throw new GitHubError(res.status, body, 'dispatch permission probe');
}
