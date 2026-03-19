import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath: string, data: unknown): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

export function getRawDir(date: string): string {
  return join(process.cwd(), 'data', 'raw', date);
}

export function getScoresDir(): string {
  return join(process.cwd(), 'data', 'scores');
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
