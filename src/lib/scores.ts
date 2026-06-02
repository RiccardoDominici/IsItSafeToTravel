import fs from 'node:fs';
import path from 'node:path';
import type { DailySnapshot, PillarName, ScoredCountry } from '../pipeline/types';
import type { Lang } from '../i18n/ui';
import { COUNTRIES } from '../pipeline/config/countries';

const DATA_DIR = path.join(process.cwd(), 'data', 'scores');
const HISTORY_INDEX_PATH = path.join(DATA_DIR, 'history-index.json');

export interface HistoryPoint {
  date: string;
  score: number;
  dc?: number; // dataCompleteness 0-1 (omitted = full data)
}

export type PillarHistoryData = Record<PillarName, HistoryPoint[]>;

interface HistoryIndex {
  generatedAt: string;
  global: Array<{ date: string; score: number }>;
  countries: Record<string, Array<{ date: string; score: number; dc?: number }>>;
  pillarHistory?: Record<string, Record<PillarName, Array<{ date: string; score: number }>>>;
}

/** Load the full latest snapshot (includes metadata + countries). */
export function loadLatestSnapshot(): DailySnapshot | null {
  const filePath = path.join(DATA_DIR, 'latest.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/** Load scored countries from the latest snapshot. Returns empty array if no data. */
export function loadLatestScores(): ScoredCountry[] {
  const snapshot = loadLatestSnapshot();
  return snapshot?.countries ?? [];
}

/**
 * Load historical score data.
 * Prefers history-index.json (consolidated) when available.
 * Falls back to reading individual dated snapshot files.
 * Returns a Map keyed by ISO3 code, with arrays of {date, score} points.
 */
export function loadHistoricalScores(days?: number): Map<string, HistoryPoint[]> {
  // Try consolidated history-index.json first
  if (fs.existsSync(HISTORY_INDEX_PATH)) {
    return loadFromHistoryIndex(days);
  }

  // Fallback: read individual snapshot files
  return loadFromIndividualSnapshots(days);
}

/**
 * Load global score history from history-index.json.
 * Returns array of {date, score} points, or empty array if file missing.
 */
export function loadGlobalHistory(): Array<{ date: string; score: number }> {
  if (!fs.existsSync(HISTORY_INDEX_PATH)) return [];
  const index: HistoryIndex = JSON.parse(fs.readFileSync(HISTORY_INDEX_PATH, 'utf-8'));
  return index.global ?? [];
}

/**
 * Load per-pillar historical scores for a specific country.
 * Returns pillar-keyed object with date/score arrays, or null if not available.
 */
export function loadPillarHistory(iso3: string): PillarHistoryData | null {
  if (!fs.existsSync(HISTORY_INDEX_PATH)) return null;
  const index: HistoryIndex = JSON.parse(fs.readFileSync(HISTORY_INDEX_PATH, 'utf-8'));
  if (!index.pillarHistory || !index.pillarHistory[iso3]) return null;
  return index.pillarHistory[iso3];
}

/**
 * Compute the score delta for a country by comparing the latest score
 * with the score from approximately 7 days ago.
 * Returns null if insufficient history data.
 */
export function getScoreDelta(
  iso3: string,
  history: Map<string, HistoryPoint[]>
): { delta: number; period: string } | null {
  const points = history.get(iso3);
  if (!points || points.length < 2) return null;

  const latest = points[points.length - 1];
  const latestDate = new Date(latest.date).getTime();
  const targetDate = latestDate - 7 * 24 * 60 * 60 * 1000; // 7 days ago

  // Find the closest point to 7 days back
  let closestIdx = -1;
  let closestDiff = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const pointDate = new Date(points[i].date).getTime();
    const diff = Math.abs(pointDate - targetDate);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIdx = i;
    }
  }

  // If no point exists within 14 days of the target, return null
  if (closestIdx === -1 || closestDiff > 14 * 24 * 60 * 60 * 1000) return null;

  const delta = latest.score - points[closestIdx].score;
  return { delta, period: '7d' };
}

function loadFromHistoryIndex(days?: number): Map<string, HistoryPoint[]> {
  const history = new Map<string, HistoryPoint[]>();
  const index: HistoryIndex = JSON.parse(fs.readFileSync(HISTORY_INDEX_PATH, 'utf-8'));

  for (const [iso3, points] of Object.entries(index.countries)) {
    const filtered = days ? points.slice(-days) : points;
    if (filtered.length > 0) {
      history.set(iso3, filtered.map(p => p.dc !== undefined ? { date: p.date, score: p.score, dc: p.dc } : { date: p.date, score: p.score }));
    }
  }

  return history;
}

function loadFromIndividualSnapshots(days?: number): Map<string, HistoryPoint[]> {
  const history = new Map<string, HistoryPoint[]>();

  if (!fs.existsSync(DATA_DIR)) return history;

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(days ? -days : undefined);

  for (const file of files) {
    const snapshot: DailySnapshot = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
    );
    for (const country of snapshot.countries) {
      const points = history.get(country.iso3) ?? [];
      points.push({ date: snapshot.date, score: country.score });
      history.set(country.iso3, points);
    }
  }
  return history;
}

// iso3 → iso2 map for Intl.DisplayNames lookup (region codes are alpha-2).
const ISO3_TO_ISO2: Record<string, string> = Object.fromEntries(
  COUNTRIES.map(c => [c.iso3, c.iso2]),
);

// Lang → Intl.DisplayNames BCP-47 locale tag.
const DISPLAY_NAMES_LOCALE: Record<Lang, string> = {
  en: 'en-US',
  it: 'it-IT',
  es: 'es-ES',
  fr: 'fr-FR',
  pt: 'pt-BR',
  zh: 'zh-CN',
  de: 'de-DE',
};

// Cache one Intl.DisplayNames instance per locale; construction is expensive.
const _displayNamesCache: Partial<Record<Lang, Intl.DisplayNames>> = {};
function getDisplayNames(lang: Lang): Intl.DisplayNames | null {
  if (_displayNamesCache[lang]) return _displayNamesCache[lang]!;
  try {
    const instance = new Intl.DisplayNames([DISPLAY_NAMES_LOCALE[lang]], { type: 'region' });
    _displayNamesCache[lang] = instance;
    return instance;
  } catch {
    return null;
  }
}

/**
 * Get a country's display name in the requested language.
 *
 * Resolution order:
 *  1. Use \`country.name[lang]\` when the snapshot supplied a translation.
 *  2. Otherwise, fall back to \`Intl.DisplayNames\` (built-in ICU country
 *     names) keyed by the country's ISO-3166 alpha-2 code. This makes
 *     zh / de display correctly (e.g. JPN → 日本 / Japan) even when the
 *     snapshot was generated before those locales were added to the
 *     pipeline.
 *  3. Final fallback: English name from the snapshot.
 */
export function getLocalizedCountryName(
  country: { iso3?: string; name: Record<string, string> },
  lang: Lang,
): string {
  const fromSnapshot = country.name[lang];
  if (fromSnapshot) return fromSnapshot;

  if (country.iso3) {
    const iso2 = ISO3_TO_ISO2[country.iso3];
    const dn = getDisplayNames(lang);
    if (iso2 && dn) {
      const localized = dn.of(iso2);
      // Intl.DisplayNames returns the input code if it cannot resolve;
      // treat that as a non-result so we fall through to English.
      if (localized && localized !== iso2) return localized;
    }
  }

  return country.name.en ?? '';
}
