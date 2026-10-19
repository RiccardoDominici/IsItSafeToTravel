import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAX_DAILY_ATTEMPTS, decide, isDailyRun, windowStart, type WorkflowRun } from '../src/decide';
import { PROBE_REF, tokenExpiry } from '../src/github';
import { DAILY_CRONS, runDailySlot, runSelfCheck, runSlot, type Env } from '../src/trigger';

const ENV: Env = {
  GITHUB_TOKEN: 'test-token',
  GITHUB_REPO: 'owner/repo',
  WORKFLOW_FILE: 'data-pipeline.yml',
  GITHUB_REF: 'master',
  NTFY_TOPIC: 'test-topic',
};
const NOW = new Date('2026-10-20T06:05:00Z');

function run(over: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 1,
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    display_title: 'Daily Data Pipeline',
    created_at: '2026-10-20T06:05:10Z',
    ...over,
  };
}

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Fake fetch for GitHub + ntfy. `runs` feeds the list endpoint; `dispatch`
 * answers POST …/dispatches (per ref); `listHeaders` adds response headers.
 */
function fakeFetch(opts: {
  runs?: WorkflowRun[];
  listStatus?: number;
  listHeaders?: Record<string, string>;
  dispatch?: (ref: string) => { status: number; body?: string };
}) {
  const calls: Call[] = [];
  const impl = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method ?? 'GET', headers: (init.headers ?? {}) as Record<string, string>, body });
    if (url.startsWith('https://ntfy.sh/')) return new Response('{}', { status: 200 });
    if (url.includes('/runs?')) {
      const status = opts.listStatus ?? 200;
      const payload = status === 200 ? JSON.stringify({ workflow_runs: opts.runs ?? [] }) : '{"message":"Bad credentials"}';
      return new Response(payload, { status, headers: opts.listHeaders });
    }
    if (url.endsWith('/dispatches')) {
      const answer = opts.dispatch ? opts.dispatch((body as { ref: string }).ref) : { status: 204 };
      return new Response(answer.status === 204 ? null : (answer.body ?? ''), { status: answer.status });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const ntfy = () => calls.filter((c) => c.url.startsWith('https://ntfy.sh/'));
  const dispatches = () => calls.filter((c) => c.url.endsWith('/dispatches'));
  return { impl, calls, ntfy, dispatches };
}

describe('pipeline trigger: which runs count as the daily run', () => {
  it('counts plain scheduled/dispatched runs, not backfills or no-digest corrective runs', () => {
    assert.equal(isDailyRun('Daily Data Pipeline'), true);
    assert.equal(isDailyRun('Daily Data Pipeline for 2026-10-18'), false);
    assert.equal(isDailyRun('Daily Data Pipeline (no digest)'), false);
    assert.equal(isDailyRun('Daily Data Pipeline for 2026-10-18 (no digest)'), false);
  });

  it('opens the window at 05:55 UTC of the same day', () => {
    assert.equal(windowStart(NOW), '2026-10-20T05:55:00Z');
  });

  it('keeps the workflow run-name markers in sync with isDailyRun', () => {
    // The markers come from data-pipeline.yml `run-name`; if they change there,
    // the Worker and the guard job would count corrective runs as the daily run.
    const yml = readFileSync(fileURLToPath(new URL('../../../.github/workflows/data-pipeline.yml', import.meta.url)), 'utf8');
    const runName = yml.match(/^run-name:.*(?:\n {2}.*)*/m)?.[0] ?? '';
    assert.match(runName, /format\(' for \{0\}', inputs\.date\)/);
    assert.match(runName, /' \(no digest\)'/);
  });
});

describe('pipeline trigger: decide()', () => {
  it('dispatches when nothing ran yet today', () => {
    assert.deepEqual(decide([]), { action: 'dispatch', reason: 'no daily run yet today', retry: false });
  });

  it('waits while any run is still going', () => {
    assert.equal(decide([run({ status: 'in_progress', conclusion: null })]).action, 'skip');
    assert.equal(decide([run({ status: 'queued', conclusion: null, display_title: 'Daily Data Pipeline (no digest)' })]).action, 'skip');
  });

  it("skips once today's daily run succeeded, whoever started it", () => {
    assert.equal(decide([run({ event: 'schedule' })]).action, 'skip');
    assert.equal(decide([run({ conclusion: 'failure', id: 2 }), run()]).action, 'skip');
  });

  it('does not let a no-digest or backfill run stand in for the daily run', () => {
    const d = decide([run({ display_title: 'Daily Data Pipeline (no digest)' }), run({ display_title: 'Daily Data Pipeline for 2026-10-18' })]);
    assert.equal(d.action, 'dispatch');
    assert.equal(d.action === 'dispatch' && d.retry, false);
  });

  it('retries after a failed daily run', () => {
    const d = decide([run({ conclusion: 'failure' })]);
    assert.equal(d.action, 'dispatch');
    assert.equal(d.action === 'dispatch' && d.retry, true);
  });

  it(`gives up after ${MAX_DAILY_ATTEMPTS} failed daily runs`, () => {
    const failed = Array.from({ length: MAX_DAILY_ATTEMPTS }, (_, i) => run({ id: i, conclusion: 'failure' }));
    assert.equal(decide(failed).action, 'give_up');
  });
});

describe('pipeline trigger: daily slot', () => {
  it('dispatches a plain run on master with the token, and stays quiet', async () => {
    const f = fakeFetch({ runs: [] });
    const result = await runDailySlot(ENV, NOW, DAILY_CRONS[0], f.impl);
    assert.equal(result.outcome, 'dispatched');
    const [list] = f.calls;
    assert.match(list.url, /\/repos\/owner\/repo\/actions\/workflows\/data-pipeline\.yml\/runs\?per_page=100&created=%3E%3D2026-10-20T05%3A55%3A00Z$/);
    assert.equal(list.headers.Authorization, 'Bearer test-token');
    assert.ok(list.headers['User-Agent']);
    const [dispatch] = f.dispatches();
    assert.equal(dispatch.method, 'POST');
    // No inputs: a normal daily run, newsletter included.
    assert.deepEqual(dispatch.body, { ref: 'master' });
    assert.equal(f.ntfy().length, 0);
  });

  it('does nothing when today already succeeded', async () => {
    const f = fakeFetch({ runs: [run()] });
    const result = await runDailySlot(ENV, NOW, DAILY_CRONS[1], f.impl);
    assert.equal(result.outcome, 'skipped');
    assert.equal(f.dispatches().length, 0);
    assert.equal(f.ntfy().length, 0);
  });

  it('re-dispatches after a failure and tells the phone', async () => {
    const f = fakeFetch({ runs: [run({ conclusion: 'failure' })] });
    const result = await runDailySlot(ENV, NOW, DAILY_CRONS[1], f.impl);
    assert.equal(result.outcome, 'dispatched');
    assert.equal(f.dispatches().length, 1);
    assert.equal(f.ntfy().length, 1);
    assert.equal((f.ntfy()[0].body as { topic: string }).topic, 'test-topic');
  });

  it('alerts when GitHub refuses the dispatch', async () => {
    const f = fakeFetch({ runs: [], dispatch: () => ({ status: 403, body: '{"message":"Resource not accessible by personal access token"}' }) });
    const result = await runDailySlot(ENV, NOW, DAILY_CRONS[0], f.impl);
    assert.equal(result.outcome, 'error');
    const msg = (f.ntfy()[0].body as { message: string }).message;
    assert.match(msg, /HTTP 403/);
    assert.match(msg, /token is probably expired/);
  });

  it('alerts when the token is rejected while listing runs', async () => {
    const f = fakeFetch({ listStatus: 401 });
    const result = await runDailySlot(ENV, NOW, DAILY_CRONS[0], f.impl);
    assert.equal(result.outcome, 'error');
    assert.equal(f.dispatches().length, 0);
    assert.equal(f.ntfy().length, 1);
  });

  it('alerts when the secret is missing, without calling GitHub', async () => {
    const f = fakeFetch({});
    const result = await runDailySlot({ ...ENV, GITHUB_TOKEN: undefined }, NOW, DAILY_CRONS[0], f.impl);
    assert.equal(result.outcome, 'error');
    assert.equal(f.calls.filter((c) => c.url.includes('api.github.com')).length, 0);
    assert.equal(f.ntfy().length, 1);
  });

  it('warns about an expiring token in the first slot only', async () => {
    const listHeaders = { 'github-authentication-token-expiration': '2026-10-25 06:00:00 UTC' };
    const first = fakeFetch({ runs: [run()], listHeaders });
    await runDailySlot(ENV, NOW, DAILY_CRONS[0], first.impl);
    assert.equal(first.ntfy().length, 1);
    assert.match((first.ntfy()[0].body as { message: string }).message, /expires in 4 day/);
    const later = fakeFetch({ runs: [run()], listHeaders });
    await runDailySlot(ENV, NOW, DAILY_CRONS[1], later.impl);
    assert.equal(later.ntfy().length, 0);
  });
});

describe('pipeline trigger: self-check', () => {
  it('passes on 422 "No ref found" for the probe ref, and starts nothing real', async () => {
    const refs: string[] = [];
    const f = fakeFetch({
      runs: [run()],
      dispatch: (ref) => {
        refs.push(ref);
        return { status: 422, body: `{"message":"No ref found for: ${ref}"}` };
      },
    });
    const result = await runSelfCheck(ENV, NOW, f.impl);
    assert.equal(result.outcome, 'ok');
    assert.deepEqual(refs, [PROBE_REF]);
    assert.equal(f.ntfy().length, 0);
  });

  it('fails and alerts when the token may not dispatch', async () => {
    const f = fakeFetch({ runs: [], dispatch: () => ({ status: 403, body: '{"message":"Resource not accessible by personal access token"}' }) });
    const result = await runSelfCheck(ENV, NOW, f.impl);
    assert.equal(result.outcome, 'error');
    assert.equal(f.ntfy().length, 1);
  });
});

describe('pipeline trigger: cron routing and config', () => {
  it('routes daily crons to the daily job and anything else to the self-check', async () => {
    const daily = fakeFetch({ runs: [] });
    await runSlot(ENV, DAILY_CRONS[0], NOW.getTime(), daily.impl);
    assert.deepEqual(daily.dispatches()[0].body, { ref: 'master' });

    const weekly = fakeFetch({ runs: [], dispatch: (ref) => ({ status: 422, body: `No ref found for: ${ref}` }) });
    const result = await runSlot(ENV, '20 12 * * 1', NOW.getTime(), weekly.impl);
    assert.equal(result.kind, 'self-check');
    assert.deepEqual(weekly.dispatches()[0].body, { ref: PROBE_REF });
  });

  it('declares every daily slot, plus the weekly self-check, in wrangler.toml', () => {
    const toml = readFileSync(fileURLToPath(new URL('../wrangler.toml', import.meta.url)), 'utf8');
    const line = toml.match(/^crons\s*=\s*\[(.*)\]/m)?.[1] ?? '';
    const crons = [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    for (const c of DAILY_CRONS) assert.ok(crons.includes(c), `wrangler.toml is missing daily cron "${c}"`);
    assert.deepEqual(
      crons.filter((c) => !(DAILY_CRONS as readonly string[]).includes(c)),
      ['20 12 * * 1'],
    );
  });

  it('reads the token expiry header GitHub sends', () => {
    const res = new Response('', { headers: { 'github-authentication-token-expiration': '2027-10-19 06:05:00 UTC' } });
    assert.equal(tokenExpiry(res)?.toISOString(), '2027-10-19T06:05:00.000Z');
    assert.equal(tokenExpiry(new Response('')), null);
  });
});
