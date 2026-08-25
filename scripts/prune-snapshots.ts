/**
 * Retention policy for data/scores/YYYY-MM-DD.json daily snapshots.
 *
 * history-index.json consolidates every point (score + pillars) of every
 * snapshot, and the pipeline now folds new days in INCREMENTALLY — so old
 * per-day snapshot files are redundant weight: 700+ files / ~600 MB tracked in
 * git, growing forever. This script prunes them:
 *
 *   - keeps the last KEEP_DAILY_DAYS days as daily snapshots
 *   - older: keeps only the FIRST snapshot of each calendar month
 *     (downsampled long-term archive; trend charts read the index, not these)
 *   - always keeps latest.json
 *
 * DRY-RUN by default. Pass --execute to actually delete.
 * Run AFTER the index is committed/updated — it is the surviving archive.
 *
 * Usage:
 *   npx tsx scripts/prune-snapshots.ts            # dry-run
 *   npx tsx scripts/prune-snapshots.ts --execute  # delete for real
 */
import { readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SCORES_DIR = process.env.SCORES_DIR ?? join(process.cwd(), 'data', 'scores');
const KEEP_DAILY_DAYS = 120;
const DATE_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function main(): void {
  const execute = process.argv.includes('--execute');
  if (!existsSync(SCORES_DIR)) {
    console.error(`No scores dir at ${SCORES_DIR}`);
    process.exit(1);
  }

  const cutoff = isoDaysAgo(KEEP_DAILY_DAYS);
  const files = readdirSync(SCORES_DIR).filter((f) => DATE_FILE.test(f)).sort();

  // Keep everything inside the daily window; outside it, only the first
  // snapshot of each calendar month (files are sorted, so this is the
  // earliest surviving day of the month).
  const seenMonths = new Set<string>();
  const keep = new Set<string>();
  for (const f of files) {
    const date = f.replace('.json', '');
    if (date >= cutoff) { keep.add(f); continue; }
    const month = date.slice(0, 7);
    if (!seenMonths.has(month)) {
      seenMonths.add(month);
      keep.add(f); // first-of-month anchor
    }
  }

  const toDelete = files.filter((f) => !keep.has(f));
  let freedBytes = 0;
  console.log(`Snapshots on disk: ${files.length} | window >= ${cutoff}: keep all | older: keep ${keep.size} monthly anchors`);
  for (const f of toDelete) {
    const p = join(SCORES_DIR, f);
    try { freedBytes += statSync(p).size; } catch { /* raced */ }
    if (execute) unlinkSync(p);
  }
  const mb = (freedBytes / 1024 / 1024).toFixed(1);
  console.log(`${toDelete.length} file(s) ${execute ? 'DELETED' : 'would be deleted'} (~${mb} MB ${execute ? 'freed' : 'freable'})`);
  if (!execute) console.log('Dry-run only — re-run with --execute to apply.');
}

main();
