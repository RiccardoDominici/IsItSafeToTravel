import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';

/** Files serialized larger than this are written without indentation (halves disk/git size). */
const COMPACT_THRESHOLD_BYTES = 256_000;

export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

/**
 * Atomic JSON writer.
 *
 * Writes to a temp file in the same directory, then renames over the target —
 * POSIX rename is atomic, so a crash mid-write can never leave a truncated
 * JSON behind (a truncated *-parsed.json used to abort the whole pipeline
 * stage on the next run). Large payloads (snapshots, history-index.json) are
 * serialized without indentation to roughly halve their size.
 */
export function writeJson(filePath: string, data: unknown): void {
  ensureDir(dirname(filePath));
  let json = JSON.stringify(data);
  if (Buffer.byteLength(json, 'utf-8') <= COMPACT_THRESHOLD_BYTES) {
    json = JSON.stringify(data, null, 2);
  }
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, json + '\n', 'utf-8');
  renameSync(tmpPath, filePath);
}

/**
 * Read a JSON file, returning null for both missing and CORRUPT files instead
 * of throwing — callers already handle null ("skip / fall back"), so one bad
 * file can no longer abort an entire stage. Corruption is logged loudly.
 */
export function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fs] Corrupt/unreadable JSON treated as missing: ${filePath} (${msg})`);
    return null;
  }
}

export function getRawDir(date: string): string {
  return join(process.cwd(), 'data', 'raw', date);
}

export function getScoresDir(): string {
  // SCORES_DIR override lets tests write snapshot fixtures to an isolated temp
  // dir instead of the real data/scores (which they used to corrupt).
  return process.env.SCORES_DIR ?? join(process.cwd(), 'data', 'scores');
}

export function getNewsDir(): string {
  return join(process.cwd(), 'data', 'news');
}

/**
 * Find the most recent cached file matching a pattern in data/raw/YYYY-MM-DD/ directories.
 * Returns the full path to the file, or null if not found.
 */
export function findLatestCached(filename: string): string | null {
  const rawBase = join(process.cwd(), 'data', 'raw');
  if (!existsSync(rawBase)) return null;

  const dateDirs = readdirSync(rawBase)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();

  for (const dateDir of dateDirs) {
    const filePath = join(rawBase, dateDir, filename);
    if (existsSync(filePath)) return filePath;
  }

  return null;
}
