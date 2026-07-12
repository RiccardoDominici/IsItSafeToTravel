// Daily News / "Safety Movers" — persistence: data/news/YYYY-MM-DD.json + data/news/index.json.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { writeJson, getNewsDir } from '../utils/fs.js';
import type { NewsEvent, NewsDayFile, NewsIndex } from './types.js';
import { ARCHIVE_DAYS, daysBetween } from './types.js';

function emptyIndex(): NewsIndex {
  return { generatedAt: '', lastProcessedDate: '', cooldowns: {}, recentEvents: [] };
}

/** Returns a graceful empty index if the file is missing or unparseable (first-ever run). */
export function readNewsIndex(): NewsIndex {
  const p = join(getNewsDir(), 'index.json');
  if (!existsSync(p)) return emptyIndex();
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as NewsIndex;
  } catch {
    return emptyIndex();
  }
}

/** Sorted `YYYY-MM-DD.json` filenames under data/news/, ascending. */
export function listNewsDates(): string[] {
  const dir = getNewsDir();
  if (!existsSync(dir)) return [];
  const datePattern = /^\d{4}-\d{2}-\d{2}\.json$/;
  return readdirSync(dir)
    .filter((f) => datePattern.test(f))
    .map((f) => f.replace('.json', ''))
    .sort();
}

export function writeNewsDay(date: string, events: NewsEvent[]): void {
  const day: NewsDayFile = { date, generatedAt: new Date().toISOString(), events };
  writeJson(join(getNewsDir(), `${date}.json`), day);
}

export function loadNewsDay(date: string): NewsDayFile | null {
  const p = join(getNewsDir(), `${date}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as NewsDayFile;
  } catch {
    return null;
  }
}

/**
 * Denormalized feed for the build + email digest: concat events from the last ARCHIVE_DAYS
 * day-files at or before `date`, sorted date desc then priority desc then id (deterministic).
 */
export function rebuildRecent(date: string): NewsEvent[] {
  const dates = listNewsDates()
    .filter((d) => d <= date)
    .slice(-ARCHIVE_DAYS);

  const out: NewsEvent[] = [];
  for (const d of dates) {
    const day = loadNewsDay(d);
    if (day) out.push(...day.events);
  }

  out.sort((a, b) => b.date.localeCompare(a.date) || b.priority - a.priority || a.id.localeCompare(b.id));
  return out;
}

export function writeNewsIndex(index: NewsIndex): void {
  writeJson(join(getNewsDir(), 'index.json'), index);
}

/** Drop cooldown entries older than maxAgeDays so index.json growth stays bounded over time. */
export function pruneCooldowns(cooldowns: Record<string, string>, today: string, maxAgeDays: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, stamped] of Object.entries(cooldowns)) {
    if (daysBetween(stamped, today) <= maxAgeDays) out[key] = stamped;
  }
  return out;
}
