import type { RawIndicator, AdvisoryInfo } from '../types.js';
import { getCountryByIso2 } from '../config/countries.js';

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
 * Level mapping: `advisory-state` is Canada's own 0-3 national risk level, mapped one-to-one
 * (state + 1):
 *   0 "Exercise normal security precautions" -> 1 normal precautions
 *   1 "Exercise a high degree of caution"    -> 2 increased caution
 *   2 "Avoid non-essential travel"           -> 3 reconsider / avoid non-essential
 *   3 "Avoid all travel"                     -> 4 do not travel
 * Canada has four steps with the same meaning as our four, so the mapping keeps every
 * step and needs no shift. The old HTML parser read the same four banners into 1-4
 * (banner-normal-precautions ... banner-do-not-travel), so the levels carry on unchanged.
 * `has-regional-advisory` marks stricter advice for named regions (Mexico, Colombia,
 * India...). Per the project's standing rule, a regional advisory never becomes the
 * national level. It only appears in the label, in Canada's own form:
 * "Exercise a high degree of caution (with regional advisories)".
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

/** Canada's own wording for each unified level, as the feed's eng.advisory-text writes it. */
export const CA_LEVEL_TEXT: Record<number, string> = {
  1: 'Exercise normal security precautions',
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

/**
 * A payload has to resolve to at least this many of our countries. The feed covers ~227
 * (2025-03-07 copy) and the base advisories' per-source floor is 150 (advisories.ts). Fewer
 * means a truncated or reshaped feed, which is rejected, not partly published.
 */
export const CA_MIN_COUNTRIES = 150;

/**
 * Above this share of records whose advisory-state contradicts their own English label, the
 * payload is treated as garbage and rejected. Below it, each disagreement is logged and the
 * structured advisory-state is used. No real copy checked had one (2014, 2022, 2025).
 */
export const CA_MAX_MISMATCH_SHARE = 0.1;

export interface CaParseResult {
  indicators: RawIndicator[];
  advisoryInfo: Record<string, { ca: AdvisoryInfo }>;
  /**
   * Why the whole payload was rejected; empty when it was accepted. A rejected payload
   * yields no indicators at all: the caller fails loudly, and the 7-day fallback rule
   * decides whether yesterday's reading still counts.
   */
  problems: string[];
  /** Keys that resolve to no country of ours (sub-national entries such as the Azores). */
  unmatched: string[];
  /** Records whose advisory-state and English label disagree (advisory-state used). */
  mismatches: string[];
}

export interface CaParseOptions {
  /** Defaults to CA_MIN_COUNTRIES; tests of small fixtures lower it. */
  minCountries?: number;
}

function levelFromText(text: string): number | null {
  for (const [re, level] of CA_TEXT_TO_LEVEL) if (re.test(text)) return level;
  return null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Problems of one record against the published shape, or [] when it is well-formed. */
function recordProblems(key: string, raw: unknown): string[] {
  if (!isObject(raw)) return [`${key}: not an object`];
  const problems: string[] = [];
  const state = raw['advisory-state'];
  if (!(typeof state === 'number' && Number.isInteger(state) && state >= 0 && state <= 3)) {
    problems.push(`${key}: advisory-state ${JSON.stringify(state)} is not an integer 0-3`);
  }
  if (!('has-regional-advisory' in raw)) problems.push(`${key}: no has-regional-advisory`);
  if (!isObject(raw['date-published'])) problems.push(`${key}: no date-published`);
  const eng = raw.eng;
  if (!isObject(eng)) problems.push(`${key}: no eng block`);
  else if (!str(eng['url-slug']) || typeof eng['advisory-text'] !== 'string') problems.push(`${key}: eng block lacks url-slug or advisory-text`);
  return problems;
}

/**
 * Validate and parse the open-data index (`{ metadata, data: { <ISO2>: record } }`). Pure.
 *
 * Countries are matched by ISO code only (the record's `country-iso`, else its key), never
 * by name, so renaming a country in our list cannot break the match.
 *
 * The payload is rejected as a whole (problems non-empty, no indicators) when:
 * - `metadata.generated.date` or the `data` object is missing;
 * - any record lacks an expected key or has an advisory-state outside the integers 0-3;
 * - fewer than `minCountries` records resolve to our countries;
 * - more than CA_MAX_MISMATCH_SHARE of the records contradict their own label.
 * Strict on purpose: a half-read Canadian column is worse than none, and a rejection falls
 * back to the last reading under the 7-day rule (advisory-fallback.ts).
 */
export function parseCaOpenData(json: unknown, currentYear: number, options: CaParseOptions = {}): CaParseResult {
  const minCountries = options.minCountries ?? CA_MIN_COUNTRIES;
  const result: CaParseResult = { indicators: [], advisoryInfo: {}, problems: [], unmatched: [], mismatches: [] };
  const reject = (problems: string[]): CaParseResult => ({
    ...result,
    indicators: [],
    advisoryInfo: {},
    problems,
  });

  if (!isObject(json)) return reject(['payload is not a JSON object']);
  const generated = isObject(json.metadata) && isObject(json.metadata.generated) ? json.metadata.generated : null;
  const data = json.data;
  const topProblems: string[] = [];
  if (!generated || !str(generated.date)) topProblems.push('metadata.generated.date missing');
  if (!isObject(data)) topProblems.push('data object missing');
  if (topProblems.length > 0 || !isObject(data)) return reject(topProblems);

  const records = Object.entries(data);
  const shapeProblems = records.flatMap(([key, raw]) => recordProblems(key, raw));
  if (shapeProblems.length > 0) {
    return reject([`${shapeProblems.length} malformed record field(s): ${shapeProblems.slice(0, 10).join('; ')}`]);
  }

  for (const [key, raw] of records) {
    const entry = raw as Record<string, unknown>;
    const eng = entry.eng as Record<string, unknown>;
    const iso2 = str(entry['country-iso']) || key;
    const country = /^[A-Za-z]{2}$/.test(iso2) ? getCountryByIso2(iso2) : undefined;
    if (!country) {
      const name = str(eng.name);
      result.unmatched.push(name ? `${key} (${name})` : key);
      continue;
    }
    if (result.advisoryInfo[country.iso3]) {
      result.unmatched.push(`${key} (second record for ${country.iso3}, ignored)`);
      continue;
    }

    const state = entry['advisory-state'] as number;
    const level = state + 1;
    const textLevel = levelFromText(str(eng['advisory-text']));
    if (textLevel !== null && textLevel !== level) {
      result.mismatches.push(`${country.iso3}: advisory-state ${state} vs "${str(eng['advisory-text'])}"`);
    }

    const regional = Number(entry['has-regional-advisory']) === 1;
    const published = entry['date-published'] as Record<string, unknown>;
    const updatedAt = /^\d{4}-\d{2}-\d{2}/.exec(str(published.date))?.[0];

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
        text: `${CA_LEVEL_TEXT[level]}${regional ? ' (with regional advisories)' : ''}`,
        source: 'Government of Canada',
        url: `https://travel.gc.ca/destinations/${str(eng['url-slug'])}`,
        ...(updatedAt ? { updatedAt } : {}),
      },
    };
  }

  const problems: string[] = [];
  if (result.indicators.length < minCountries) {
    problems.push(`only ${result.indicators.length} records match our countries (< ${minCountries})`);
  }
  if (records.length > 0 && result.mismatches.length / records.length > CA_MAX_MISMATCH_SHARE) {
    problems.push(
      `${result.mismatches.length} of ${records.length} records contradict their own label (> ${CA_MAX_MISMATCH_SHARE * 100}%)`,
    );
  }
  return problems.length > 0 ? reject(problems) : result;
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
