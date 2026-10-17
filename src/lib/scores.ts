import fs from 'node:fs';
import path from 'node:path';
import type { DailySnapshot, PillarName, ScoredCountry } from '../pipeline/types';
import type { Lang } from '../i18n/ui';
import { COUNTRIES } from '../pipeline/config/countries';

const DATA_DIR = path.join(process.cwd(), 'data', 'scores');
const HISTORY_INDEX_PATH = path.join(DATA_DIR, 'history-index.json');

/**
 * One day of a country's official score. Days without an official score (formula v10 grey
 * `insufficient_data`, stored as `score: null` in history-index.json) are left out when the
 * history is loaded: every consumer here (trend chart, 7-day deltas, movers) charts or compares
 * official scores only, and a grey day has none.
 */
export interface HistoryPoint {
  date: string;
  score: number;
  dc?: number; // dataCompleteness 0-1 (omitted = full data)
}

export type PillarHistoryData = Record<PillarName, HistoryPoint[]>;

interface HistoryIndex {
  generatedAt: string;
  global: Array<{ date: string; score: number }>;
  countries: Record<string, Array<{ date: string; score: number | null; dc?: number }>>;
  pillarHistory?: Record<string, Record<PillarName, Array<{ date: string; score: number }>>>;
}

/** A formula change visible in the score history (formula v10, SPEC §6: "the trend chart marks the v10 date"). */
export interface FormulaChange {
  /** First snapshot date computed with the new formula (YYYY-MM-DD). */
  date: string;
  /** Formula version from that snapshot's weightsVersion: the major, plus the minor when non-zero ("10", "10.1"). */
  version: string;
}

/**
 * Formula label of a snapshot's weightsVersion: "10.0.0" -> "10", "10.1.0" -> "10.1". null before
 * v10: the v9.x snapshots predate the switch markers (SPEC §6) and are never marked.
 */
export function formulaLabel(weightsVersion: string | undefined): string | null {
  const m = /^(\d+)\.(\d+)/.exec(weightsVersion ?? '');
  if (!m || Number(m[1]) < 10) return null;
  return m[2] === '0' ? m[1] : `${m[1]}.${m[2]}`;
}

/**
 * Every formula change in a date-ordered list of snapshot headers: the first v10+ snapshot, then
 * each snapshot whose formula label differs from the previous one (v10 on 2026-10-15, v10.1 on
 * 2026-10-17). A patch-level weightsVersion bump is not a formula change. Pure, for the tests.
 */
export function formulaChangesFromHeaders(
  headers: ReadonlyArray<{ date: string; weightsVersion?: string }>,
): FormulaChange[] {
  const changes: FormulaChange[] = [];
  let previous: string | null = null;
  for (const h of headers) {
    if (h.weightsVersion === undefined) continue; // unreadable header: keep the previous formula
    const label = formulaLabel(h.weightsVersion);
    if (label !== null && label !== previous) changes.push({ date: h.date, version: label });
    previous = label;
  }
  return changes;
}

let historyIndexCache: HistoryIndex | null | undefined;

/**
 * history-index.json, parsed once per build process. It is tens of MB and every country page
 * route (7 locales x 248 countries) reads pillar history from it: re-parsing it per call made
 * getStaticPaths alone cost minutes per build. Read-only for the whole build, so caching is safe.
 */
function readHistoryIndex(): HistoryIndex | null {
  if (historyIndexCache === undefined) {
    historyIndexCache = fs.existsSync(HISTORY_INDEX_PATH)
      ? (JSON.parse(fs.readFileSync(HISTORY_INDEX_PATH, 'utf-8')) as HistoryIndex)
      : null;
  }
  return historyIndexCache;
}

let formulaChangesCache: FormulaChange[] | undefined;

/**
 * Every formula change from v10 on, oldest first, read from the snapshot headers in data/scores
 * (each file starts with `{"date":…,"weightsVersion":"10.1.0",…}`, so only the first bytes of each
 * file are read, never the ~0.9 MB body). Empty while every snapshot is pre-v10.
 *
 * Data-driven rather than hard-coded dates: a switch happens on whichever day the first pipeline
 * run with the new weights lands, and past snapshots keep the formula they were computed with
 * (SPEC §6). The charts mark every change; the 7-day deltas start again after the latest one.
 */
export function getFormulaChanges(): FormulaChange[] {
  if (formulaChangesCache !== undefined) return formulaChangesCache;
  formulaChangesCache = [];
  if (!fs.existsSync(DATA_DIR)) return formulaChangesCache;
  const files = fs.readdirSync(DATA_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const buf = Buffer.alloc(512);
  const headers: Array<{ date: string; weightsVersion?: string }> = [];
  for (const file of files) {
    let head = '';
    const fd = fs.openSync(path.join(DATA_DIR, file), 'r');
    try {
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      head = buf.toString('utf-8', 0, n);
    } finally {
      fs.closeSync(fd);
    }
    headers.push({ date: file.slice(0, 10), weightsVersion: /"weightsVersion"\s*:\s*"([^"]+)"/.exec(head)?.[1] });
  }
  formulaChangesCache = formulaChangesFromHeaders(headers);
  return formulaChangesCache;
}

/**
 * The latest formula change, or null before v10. The 7-day deltas never reach back across it:
 * v10.1 (2026-10-17) moved Japan +0.3 and Cuba -0.35 overnight with nothing happening on the
 * ground, and the v10-only check of the first version showed that as a 7-day trend.
 */
export function getFormulaChange(): FormulaChange | null {
  const changes = getFormulaChanges();
  return changes.length > 0 ? changes[changes.length - 1] : null;
}

/**
 * Score change over the last ~7 days for one country's history (latest point minus the point
 * closest to 7 days earlier, which must lie within 14 days of that target), or null.
 *
 * Never across a formula change: when the latest point is on or after the switch date, earlier
 * points are ignored. On the day formula v10 replaced v9.1 most countries "moved" although nothing
 * happened on the ground; showing that as a 7-day trend (hero badge, improving/declining hubs,
 * biggest movers) would be false.
 */
export function sevenDayDelta(
  points: readonly HistoryPoint[] | undefined,
  formulaChange: FormulaChange | null = getFormulaChange(),
): number | null {
  if (!points || points.length < 2) return null;
  const latest = points[points.length - 1];
  const comparable =
    formulaChange && latest.date >= formulaChange.date ? points.filter((p) => p.date >= formulaChange.date) : points;
  if (comparable.length < 2) return null;

  const latestDate = new Date(latest.date).getTime();
  const targetDate = latestDate - 7 * 24 * 60 * 60 * 1000; // 7 days ago

  // Find the closest point to 7 days back
  let closestIdx = -1;
  let closestDiff = Infinity;
  for (let i = 0; i < comparable.length - 1; i++) {
    const diff = Math.abs(new Date(comparable[i].date).getTime() - targetDate);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIdx = i;
    }
  }

  // If no point exists within 14 days of the target, there is no 7-day delta
  if (closestIdx === -1 || closestDiff > 14 * 24 * 60 * 60 * 1000) return null;
  return latest.score - comparable[closestIdx].score;
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
  return readHistoryIndex()?.global ?? [];
}

/**
 * Load per-pillar historical scores for a specific country.
 * Returns pillar-keyed object with date/score arrays, or null if not available.
 */
export function loadPillarHistory(iso3: string): PillarHistoryData | null {
  const index = readHistoryIndex();
  if (!index?.pillarHistory || !index.pillarHistory[iso3]) return null;
  return index.pillarHistory[iso3];
}

/**
 * Compute the score delta for a country by comparing the latest score
 * with the score from approximately 7 days ago (sevenDayDelta: never across a formula change).
 * Returns null if insufficient history data.
 */
export function getScoreDelta(
  iso3: string,
  history: Map<string, HistoryPoint[]>
): { delta: number; period: string } | null {
  const delta = sevenDayDelta(history.get(iso3));
  return delta === null ? null : { delta, period: '7d' };
}

function loadFromHistoryIndex(days?: number): Map<string, HistoryPoint[]> {
  const history = new Map<string, HistoryPoint[]>();
  const index = readHistoryIndex();
  if (!index) return history;

  for (const [iso3, points] of Object.entries(index.countries)) {
    const filtered = days ? points.slice(-days) : points;
    // Grey days (formula v10, score null) carry no official score: left out (see HistoryPoint).
    const official: HistoryPoint[] = [];
    for (const p of filtered) {
      if (typeof p.score !== 'number' || !Number.isFinite(p.score)) continue;
      official.push(p.dc !== undefined ? { date: p.date, score: p.score, dc: p.dc } : { date: p.date, score: p.score });
    }
    if (official.length > 0) history.set(iso3, official);
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
      // Grey days (formula v10, no official score) are left out, as in loadFromHistoryIndex.
      if (typeof country.score !== 'number' || !Number.isFinite(country.score)) continue;
      const points = history.get(country.iso3) ?? [];
      points.push({ date: snapshot.date, score: country.score });
      history.set(country.iso3, points);
    }
  }
  return history;
}

// iso3 → iso2 map for Intl.DisplayNames lookup (region codes are alpha-2).
// iso3 -> full CountryEntry (name in en/it/es/fr/pt), for getLocalizedCountryName's
// first-priority lookup below -- see that function's docstring for why.
const COUNTRY_BY_ISO3: Record<string, (typeof COUNTRIES)[number]> = Object.fromEntries(
  COUNTRIES.map(c => [c.iso3, c]),
);

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
 *  1. Use \`COUNTRIES\` (src/pipeline/config/countries.ts) by iso3 when it has
 *     a translation. This is source code, live the moment it deploys; the
 *     snapshot below is data, committed once a day by the pipeline. A
 *     diacritics fix in COUNTRIES (e.g. "Japon" -> "Japón") would otherwise
 *     keep showing the old spelling on the live site for up to 24h, until
 *     the next scheduled pipeline run regenerates scores.json with it
 *     (2026-09-25 audit: es/pt/fr pages served "Japon"/"Mexico"/"Canada"
 *     from a stale snapshot after the fix had already shipped in source).
 *  2. Otherwise use \`country.name[lang]\` when the snapshot supplied a
 *     translation (covers iso3 codes absent from COUNTRIES, if any).
 *  3. Otherwise, fall back to \`Intl.DisplayNames\` (built-in ICU country
 *     names) keyed by the country's ISO-3166 alpha-2 code. This makes
 *     zh / de display correctly (e.g. JPN → 日本 / Japan) even though
 *     COUNTRIES and the snapshot only carry en/it/es/fr/pt.
 *  4. Final fallback: English name from the snapshot.
 */
export function getLocalizedCountryName(
  country: { iso3?: string; name: Record<string, string> },
  lang: Lang,
): string {
  if (country.iso3) {
    const entry = COUNTRY_BY_ISO3[country.iso3.toUpperCase()];
    const fromConfig = entry ? (entry.name as Record<string, string>)[lang] : undefined;
    if (fromConfig) return fromConfig;
  }

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
