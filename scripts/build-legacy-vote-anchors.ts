#!/usr/bin/env node
/**
 * scripts/build-legacy-vote-anchors.ts
 *
 * FROZEN ONE-OFF TABLE for the community votes recorded before the vote API stored
 * `official_score` (formula v10, SPEC §5). Writes data/sentiment/legacy-anchors.json: for each such
 * row, the score that was LIVE on the site when the vote was cast. The pipeline prefers this table
 * over the per-day snapshots (src/pipeline/sentiment/legacy-scores.ts) and falls back to them only
 * for rows the table does not have. It is not pipeline output: nothing regenerates it on its own.
 *
 * Re-runnable: the history it reads does not change, so existing entries come out identical and a
 * re-run only adds the legacy rows recorded since. Run it once more after the API that stores
 * `official_score` is live (the rows cast until then are legacy too), then leave it alone.
 *
 * WHY: a relative vote is placed at S_shown + 0.5 * delta. Legacy rows store no S_shown, and the
 * per-day snapshots that stood in for it were regenerated under formula v9, then v9.1, on
 * 2026-07-08. So the first votes were anchored on scores no voter saw: China was live at 2.66 in
 * early July, its regenerated snapshots say 6.51. A per-day file also cannot tell a vote cast before
 * that day's deploy (it saw the previous day's score) from one cast after it.
 *
 * WHAT "LIVE" MEANS (checked 2026-10-14):
 *  - The file: data/scores/latest.json. The country pages render from it (src/lib/scores.ts), and
 *    deploy.yml copies it over public/scores.json before every build (since 2026-03-19), so the
 *    committed public/scores.json is not what was served. (For every legacy vote the two agreed.)
 *  - The moment: a master commit counts as live from its commit time + LIVE_LAG_MINUTES (20).
 *    deploy.yml runs on every push to master and after every pipeline commit; since July a run
 *    took 18 min median (9.5-23 min) from start to live. Commits come from master's first-parent
 *    chain, which has been linear (no merge commits) since June, so commit time is push time:
 *    master's commits are rebased before they are pushed, and the pipeline bot pushes as soon as
 *    it commits. A side-branch commit's own time would be wrong (it went live only when merged),
 *    hence --first-parent.
 *  - The check: unless --skip-deploy-check, each anchor's latest.json is compared with the ground
 *    truth, the latest.json of the last successful deploy.yml run on master that had completed
 *    before the vote (gh run list; a run's completion is within a minute of its deploy step). Any
 *    disagreement aborts without writing. On 2026-10-14 all 322 legacy rows agreed, and no anchor
 *    changed for any lag between 0 and 45 min.
 *
 * READS: D1 (read-only SELECT of iso3 and created_at; never a voter hash), the git history of
 *        origin/master, GitHub Actions run metadata. WRITES: data/sentiment/legacy-anchors.json
 *        only, and nothing with --dry-run.
 *
 * Usage (from the repository root):
 *   npx tsx scripts/build-legacy-vote-anchors.ts [--dry-run] [--votes <file.json>] [--no-fetch] [--skip-deploy-check]
 *     --votes <file>       rows from a file instead of D1: the JSON that `wrangler d1 execute --json`
 *                          prints, or a plain array of { iso3, created_at }
 *     --no-fetch           skip `git fetch origin master` (offline only: a stale origin/master
 *                          would anchor recent votes on an old score; the deploy check catches it)
 *     --skip-deploy-check  skip the GitHub Actions cross-check (needs an authenticated `gh`)
 *     --dry-run            print the summary, write nothing
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSnapshot } from '../src/pipeline/scoring/snapshot.js';
import { LEGACY_ANCHORS_PATH, legacyAnchorKey, type LegacyAnchorsFile } from '../src/pipeline/sentiment/legacy-anchors.js';
import { isScore, utcDateOf } from '../src/pipeline/sentiment/perceive.js';
import { writeJson } from '../src/pipeline/utils/fs.js';

const LOG = '[LEGACY-ANCHORS]';
const DB_NAME = 'isitsafetotravel-sentiment';
const REF = 'origin/master';
/** The file the deployed site was built from (see header). */
const SERVED_FILE = 'data/scores/latest.json';
/** A commit is treated as live this long after its commit time (deploy.yml run time, see header). */
const LIVE_LAG_MINUTES = 20;
/** Legacy rows: no stored score. Read-only, and no voter hash is selected. */
const LEGACY_VOTES_SQL = 'SELECT iso3, created_at FROM votes WHERE official_score IS NULL ORDER BY created_at';
/** Gaps below this are display rounding, not a different score. */
const SNAPSHOT_GAP_EPSILON = 0.005;

interface Args {
  dryRun: boolean;
  votesFile: string | null;
  fetch: boolean;
  deployCheck: boolean;
}

interface LegacyVote {
  iso3: string;
  createdAt: number; // unix seconds
}

/** One state of the site: the commit whose latest.json was served from `liveFrom` (epoch ms) on. */
interface LiveState {
  sha: string;
  liveFrom: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, votesFile: null, fetch: true, deployCheck: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--no-fetch') args.fetch = false;
    else if (arg === '--skip-deploy-check') args.deployCheck = false;
    else if (arg === '--votes' && argv[i + 1]) args.votesFile = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

// ---------------------------------------------------------------------------------------------
// Legacy votes
// ---------------------------------------------------------------------------------------------

/** Rows of `wrangler d1 execute --json` output ([{ results: [...] }]) or of a plain array. */
function rowsOf(data: unknown): unknown[] {
  if (!Array.isArray(data)) return [];
  const first: unknown = data[0];
  if (typeof first === 'object' && first !== null && 'results' in first) {
    if ((first as { success?: unknown }).success === false) throw new Error('D1 query reported success:false');
    const results = (first as { results?: unknown }).results;
    return Array.isArray(results) ? results : [];
  }
  return data;
}

function toLegacyVotes(rows: unknown[]): LegacyVote[] {
  const votes: LegacyVote[] = [];
  for (const row of rows) {
    const { iso3, created_at: createdAt } = (row ?? {}) as { iso3?: unknown; created_at?: unknown };
    if (typeof iso3 === 'string' && /^[A-Z]{3}$/.test(iso3) && typeof createdAt === 'number' && Number.isInteger(createdAt)) {
      votes.push({ iso3, createdAt });
    } else {
      console.warn(`${LOG} Skipped a malformed row: ${JSON.stringify(row)}`);
    }
  }
  return votes.sort((a, b) => a.createdAt - b.createdAt || a.iso3.localeCompare(b.iso3));
}

function readLegacyVotes(votesFile: string | null): LegacyVote[] {
  if (votesFile) return toLegacyVotes(rowsOf(JSON.parse(readFileSync(votesFile, 'utf8'))));

  // Same credential convention as scripts/send-daily-digest.ts: the least-privilege D1 token wins
  // when it is set; otherwise wrangler uses its own login.
  const env = { ...process.env };
  if (process.env.CLOUDFLARE_D1_TOKEN) env.CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_D1_TOKEN;
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--json', '--command', LEGACY_VOTES_SQL],
    { encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 },
  );
  return toLegacyVotes(rowsOf(JSON.parse(out)));
}

// ---------------------------------------------------------------------------------------------
// What was live, when
// ---------------------------------------------------------------------------------------------

/** States of master that changed the served file, oldest first, each with the moment it went live. */
function historyStates(): LiveState[] {
  const lines = git('log', '--first-parent', '--format=%H %cI', REF, '--', SERVED_FILE)
    .trim()
    .split('\n')
    .filter(Boolean)
    .reverse();

  const states: LiveState[] = [];
  let previous = -Infinity;
  for (const line of lines) {
    const [sha, committedAt] = line.split(' ');
    const at = Date.parse(committedAt) + LIVE_LAG_MINUTES * 60_000;
    // A commit cannot go live before its parent did. Keep the order if two clocks disagree.
    if (at < previous) console.warn(`${LOG} ${sha.slice(0, 8)} is dated before its parent; kept in commit order`);
    const liveFrom = Math.max(at, previous);
    states.push({ sha, liveFrom });
    previous = liveFrom;
  }
  return states;
}

/**
 * Ground truth: successful production deploys (deploy.yml on master), ordered by completion. The
 * last deploy to finish is the one serving, whichever commit it built.
 */
function deployedStates(): LiveState[] {
  const out = execFileSync(
    'gh',
    ['run', 'list', '--workflow', 'deploy.yml', '--branch', 'master', '--status', 'success', '--limit', '5000', '--json', 'headSha,headBranch,conclusion,updatedAt'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const runs = JSON.parse(out) as Array<{ headSha: string; headBranch: string; conclusion: string; updatedAt: string }>;
  return runs
    .filter((run) => run.conclusion === 'success' && run.headBranch === 'master')
    .map((run) => ({ sha: run.headSha, liveFrom: Date.parse(run.updatedAt) }))
    .sort((a, b) => a.liveFrom - b.liveFrom);
}

/** The last state live at `epochMs` (states ascending by liveFrom), or null before the first. */
function liveAt(states: readonly LiveState[], epochMs: number): LiveState | null {
  let lo = 0;
  let hi = states.length - 1;
  let hit: LiveState | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (states[mid].liveFrom <= epochMs) {
      hit = states[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return hit;
}

const blobByCommit = new Map<string, string | null>();
/** Blob id of the served file at `sha`, or null when the commit is not available locally. */
function servedBlob(sha: string): string | null {
  if (!blobByCommit.has(sha)) {
    let blob: string | null = null;
    try {
      blob = git('rev-parse', '--verify', '--quiet', `${sha}:${SERVED_FILE}`).trim() || null;
    } catch {
      blob = null;
    }
    blobByCommit.set(sha, blob);
  }
  return blobByCommit.get(sha) ?? null;
}

const scoresByBlob = new Map<string, Map<string, unknown>>();
/** iso3 -> score of one version of the served file. */
function scoresIn(blob: string): Map<string, unknown> {
  let scores = scoresByBlob.get(blob);
  if (!scores) {
    const snapshot = JSON.parse(git('cat-file', 'blob', blob)) as { countries?: Array<{ iso3: string; score: unknown }> };
    scores = new Map((snapshot.countries ?? []).map((country): [string, unknown] => [country.iso3, country.score]));
    scoresByBlob.set(blob, scores);
  }
  return scores;
}

const snapshotByDate = new Map<string, Map<string, unknown> | null>();
/** What the pipeline used before this table: the per-day snapshot of the vote's UTC date. */
function snapshotScore(iso3: string, date: string): unknown {
  if (!snapshotByDate.has(date)) {
    const snapshot = loadSnapshot(date);
    snapshotByDate.set(date, snapshot ? new Map(snapshot.countries.map((c): [string, unknown] => [c.iso3, c.score])) : null);
  }
  return snapshotByDate.get(date)?.get(iso3) ?? null;
}

// ---------------------------------------------------------------------------------------------

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.fetch) git('fetch', '--quiet', 'origin', 'master');
  const ref = git('rev-parse', REF).trim();

  const votes = readLegacyVotes(args.votesFile);
  const history = historyStates();
  const deployed = args.deployCheck ? deployedStates() : null;
  console.log(
    `${LOG} ${votes.length} legacy row(s); ${history.length} state(s) of ${SERVED_FILE} on ${REF} @ ${ref.slice(0, 8)}` +
      (deployed ? `; ${deployed.length} successful production deploy(s)` : '; deploy check SKIPPED'),
  );

  const anchors: Record<string, number> = {};
  const commitsUsed = new Set<string>();
  const unresolved: string[] = [];
  const disagreements: string[] = [];
  let agreed = 0;
  let differFromSnapshot = 0;
  let largestGap = { gap: 0, line: '' };

  for (const vote of votes) {
    const key = legacyAnchorKey(vote.iso3, vote.createdAt);
    const epochMs = vote.createdAt * 1000;

    const live = liveAt(history, epochMs);
    const blob = live ? servedBlob(live.sha) : null;
    if (!live || !blob) {
      unresolved.push(`${key}: no ${SERVED_FILE} on ${REF} before the vote`);
      continue;
    }

    if (deployed) {
      const truth = liveAt(deployed, epochMs);
      const truthBlob = truth ? servedBlob(truth.sha) : null;
      if (truthBlob === blob) agreed++;
      else disagreements.push(`${key}: history says ${live.sha.slice(0, 8)}, deploy runs say ${truth ? truth.sha.slice(0, 8) : 'no deploy yet'}`);
    }

    const score = scoresIn(blob).get(vote.iso3);
    if (!isScore(score)) {
      // A grey country (no number) or a country missing from the file: nothing to anchor on.
      unresolved.push(`${key}: no score live for ${vote.iso3} at ${live.sha.slice(0, 8)} (${String(score)})`);
      continue;
    }
    anchors[key] = score;
    commitsUsed.add(live.sha);

    const before = snapshotScore(vote.iso3, utcDateOf(vote.createdAt));
    const gap = isScore(before) ? Math.abs(before - score) : Infinity;
    if (gap > SNAPSHOT_GAP_EPSILON) {
      differFromSnapshot++;
      if (gap > largestGap.gap) largestGap = { gap, line: `${key} live ${score.toFixed(2)} vs snapshot ${String(isScore(before) ? before.toFixed(2) : before)}` };
    }
  }

  const anchored = Object.keys(anchors).length;
  console.log(`${LOG} ${anchored} row(s) anchored, from ${commitsUsed.size} distinct commit(s); ${unresolved.length} left to the snapshot fallback`);
  for (const line of unresolved) console.warn(`${LOG}   unresolved ${line}`);
  console.log(
    `${LOG} vs the per-day snapshot the pipeline used before: ${differFromSnapshot} row(s) differ by more than ${SNAPSHOT_GAP_EPSILON}` +
      (largestGap.line ? ` (largest: ${largestGap.line})` : ''),
  );

  if (deployed) {
    console.log(`${LOG} deploy check: ${agreed} of ${agreed + disagreements.length} row(s) agree with the GitHub Actions deploy runs`);
    if (disagreements.length > 0) {
      for (const line of disagreements) console.error(`${LOG}   DISAGREES ${line}`);
      console.error(`${LOG} The git history and the deploy runs disagree: nothing written. Investigate before re-running.`);
      process.exit(1);
    }
  }

  if (args.dryRun) {
    console.log(`${LOG} --dry-run: nothing written`);
    return;
  }

  const file: LegacyAnchorsFile = {
    note:
      'Frozen one-off table: the score that was live on the site when each community vote recorded before the vote API ' +
      'stored official_score was cast. Written by scripts/build-legacy-vote-anchors.ts (never edit by hand); read by ' +
      'src/pipeline/sentiment/legacy-scores.ts, which falls back to the per-day snapshots only for rows not listed here.',
    rule:
      `Key ISO3|created_at (UTC). Value: the score in ${SERVED_FILE} at the last first-parent commit of master touching it ` +
      `whose commit time + ${LIVE_LAG_MINUTES} min (deploy lag) precedes the vote` +
      (deployed ? '; every entry cross-checked against the GitHub Actions deploy.yml runs.' : '; NOT cross-checked against the deploy runs.'),
    ref,
    anchors,
  };
  writeJson(join(process.cwd(), LEGACY_ANCHORS_PATH), file);
  console.log(`${LOG} Wrote ${LEGACY_ANCHORS_PATH} (${anchored} anchors)`);
}

main();
