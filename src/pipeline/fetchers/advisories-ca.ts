import type { RawIndicator, AdvisoryInfo } from '../types.js';
import { getCountryByIso2, getCountryByName } from '../config/countries.js';

/**
 * Canada (Global Affairs Canada) travel advisories from the official open-data feed.
 *
 * Source: "Country Travel Advice and Advisories", open.canada.ca dataset
 * bef2ebb3-ca9a-485f-aaff-5dc36eb89426, published by Global Affairs Canada under the Open
 * Government Licence - Canada (https://open.canada.ca/en/open-government-licence-canada),
 * which allows reuse, including commercial reuse, with attribution. The JSON index is the
 * same data travel.gc.ca renders: one entry per destination, keyed by ISO 3166-1 alpha-2.
 *
 * Why this replaced the HTML scrape: on 2026-10-01 travel.gc.ca changed its markup. The
 * fetcher read the /destinations dropdown and each page's banner-* CSS class, and from
 * then on it found 0 destinations. Every run republished the 2026-10-01 levels until the
 * 7-day fallback rule (advisory-fallback.ts) stopped that. A documented data feed does not
 * depend on page markup.
 *
 * Level mapping: `advisory-state` is Canada's own 0-3 national risk level:
 *   0 "Take normal security precautions"  -> 1
 *   1 "Exercise a high degree of caution" -> 2
 *   2 "Avoid non-essential travel"        -> 3
 *   3 "Avoid all travel"                  -> 4
 * `has-regional-advisory` marks stricter advice for named regions (Mexico, Colombia,
 * India...). Per the project's standing rule, a regional advisory never becomes the
 * national level. It only appears in the label ("..., with regional advisories").
 */

export const CA_OPEN_DATA_URLS = [
  'https://data.international.gc.ca/travel-voyage/index-alpha-eng.json',
  // Same records, ordered by update date; tried only when the alphabetical index fails.
  'https://data.international.gc.ca/travel-voyage/index-updated.json',
] as const;

/** Identifies the project to Global Affairs Canada's servers, with a contact URL. */
export const CA_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; IsItSafeToTravelBot/1.0; +https://isitsafetotravel.org)',
};

/** Canada's own wording for each unified level (travel.gc.ca risk-level legend). */
export const CA_LEVEL_TEXT: Record<number, string> = {
  1: 'Take normal security precautions',
  2: 'Exercise a high degree of caution',
  3: 'Avoid non-essential travel',
  4: 'Avoid all travel',
};

/** The same four phrases, read back from `eng.advisory-text` as a cross-check. */
const CA_TEXT_TO_LEVEL: [RegExp, number][] = [
  [/avoid all travel/i, 4],
  [/avoid non-essential travel/i, 3],
  [/high degree of caution/i, 2],
  [/normal security precautions/i, 1],
];

export interface CaParseResult {
  indicators: RawIndicator[];
  advisoryInfo: Record<string, { ca: AdvisoryInfo }>;
  /** Keys that resolved to no country of ours (sub-national entries such as the Azores). */
  unmatched: string[];
  /** Entries whose structured level and label disagree, for the log. */
  mismatches: string[];
  /** Entries with neither a valid advisory-state nor a known label: skipped, never guessed. */
  unreadable: string[];
}

function levelFromText(text: string): number | null {
  for (const [re, level] of CA_TEXT_TO_LEVEL) if (re.test(text)) return level;
  return null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Parse the open-data index (`{ metadata, data: { <ISO2>: entry } }`). Pure.
 * `advisory-state` is the level; when it is missing or out of range, the English label
 * is used instead; when both are unusable, the entry is skipped.
 */
export function parseCaOpenData(json: unknown, currentYear: number): CaParseResult {
  const result: CaParseResult = { indicators: [], advisoryInfo: {}, unmatched: [], mismatches: [], unreadable: [] };
  const data = (json as { data?: unknown } | null)?.data;
  if (!data || typeof data !== 'object') return result;

  for (const [key, raw] of Object.entries(data as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const eng = (entry.eng ?? {}) as Record<string, unknown>;

    const iso2 = str(entry['country-iso']) || key;
    const name = str(eng.name) || str(entry['country-eng']);
    const country = (/^[A-Za-z]{2}$/.test(iso2) ? getCountryByIso2(iso2) : undefined) ?? (name ? getCountryByName(name) : undefined);
    if (!country) {
      result.unmatched.push(name ? `${key} (${name})` : key);
      continue;
    }
    if (result.advisoryInfo[country.iso3]) continue; // first record per country wins

    const state = Number(entry['advisory-state']);
    const stateLevel = Number.isInteger(state) && state >= 0 && state <= 3 ? state + 1 : null;
    const textLevel = levelFromText(str(eng['advisory-text']));
    const level = stateLevel ?? textLevel;
    if (level === null) {
      result.unreadable.push(`${country.iso3} (advisory-state ${String(entry['advisory-state'])})`);
      continue;
    }
    if (stateLevel !== null && textLevel !== null && stateLevel !== textLevel) {
      result.mismatches.push(`${country.iso3}: advisory-state ${state} vs "${str(eng['advisory-text'])}"`);
    }

    const regional = Number(entry['has-regional-advisory']) === 1;
    const published = (entry['date-published'] ?? {}) as Record<string, unknown>;
    const updatedAt = /^\d{4}-\d{2}-\d{2}/.exec(str(published.date))?.[0];
    const slug = str(eng['url-slug']);

    result.indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_ca',
      value: level,
      year: currentYear,
      source: 'advisories_ca',
    });
    result.advisoryInfo[country.iso3] = {
      ca: {
        level,
        text: `${CA_LEVEL_TEXT[level]}${regional ? ', with regional advisories' : ''}`,
        source: 'Government of Canada',
        url: slug ? `https://travel.gc.ca/destinations/${slug}` : 'https://travel.gc.ca/travelling/advisories',
        ...(updatedAt ? { updatedAt } : {}),
      },
    };
  }
  return result;
}

/** Compact per-destination record kept in data/raw/<date>/advisories-ca.json for audits. */
export function summarizeCaOpenData(json: unknown): { key: string; state: unknown; regional: unknown; published: string }[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data as Record<string, Record<string, unknown>>).map(([key, entry]) => ({
    key,
    state: entry?.['advisory-state'],
    regional: entry?.['has-regional-advisory'],
    published: str((entry?.['date-published'] as Record<string, unknown> | undefined)?.date),
  }));
}
