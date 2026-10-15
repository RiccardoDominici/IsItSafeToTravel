import * as cheerio from 'cheerio';

/**
 * UK FCDO advisory level and label from one country's gov.uk content-API document
 * (https://www.gov.uk/api/content/foreign-travel-advice/<slug>). Pure: the fetch lives in
 * advisories.ts (fetchUkAdvisories).
 *
 * Two fixes from the 2026-10-15 consistency database:
 *
 * I45: the label used to be the page's `description` whenever that did not start with
 * "FCDO travel advice". "Latest FCDO travel advice for Costa Rica. Includes safety an..."
 * and Laos's flood-update note passed that test and were shown, cut, as the level label.
 * The label now always describes the level and how FCDO scoped it.
 *
 * I46: `alert_status` has only four values, and "avoid_all_travel_to_parts" was shown as
 * "Advise against all but essential travel", level 3, for Sudan and Somalia, where FCDO
 * advises against all travel to the whole country with a few named exceptions. The
 * "Warnings and insurance" part states the verdict in prose. A sentence whose object is
 * the country itself is a national verdict: "all travel to Sudan because...", "all travel
 * to Somalia, including Somaliland, except for...", "the whole of the Central African
 * Republic", "all other regions of Ukraine", "the rest of Chad", "the remaining areas of
 * Venezuela". This is the same rule the other parsers follow: a whole-country sentence
 * with named exceptions is the national level (DE, CZ, FR). A sentence about named regions
 * keeps the alert_status mapping below.
 */

/**
 * FCDO alert_status values mapped to 1-4 levels. The "parts" values are unchanged from the
 * pre-2026-10-15 mapping (all travel to parts = 3, all but essential to parts = 2). A
 * stricter reading would cap any regional status at 2, like the other parsers' regional
 * doctrine. That would also lower Iraq, whose FCDO page covers every province piecemeal
 * without a "rest of Iraq" sentence, so it is left as an open owner decision, not changed
 * here.
 */
export const UK_ALERT_LEVEL: Record<string, number> = {
  avoid_all_travel_to_whole_country: 4,
  avoid_all_but_essential_travel_to_whole_country: 3,
  avoid_all_travel_to_parts: 3,
  avoid_all_but_essential_travel_to_parts: 2,
};

export interface UkAdvisory {
  level: number;
  text: string;
}

/** The "Warnings and insurance" part as plain text, one block element per line. */
export function ukWarningsText(doc: Record<string, unknown>): string {
  const details = doc.details as Record<string, unknown> | undefined;
  const parts = (details?.parts ?? []) as { slug?: string; body?: string }[];
  const body = parts.find((p) => p?.slug === 'warnings-and-insurance')?.body ?? '';
  if (!body) return '';
  const withBreaks = body.replace(/<\/(?:p|li|h[1-6]|div)>|<br\s*\/?>/gi, '\n');
  const text = cheerio.load(`<div>${withBreaks}</div>`)('div').first().text();
  return text
    .replace(/[‘’]/g, "'")
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Lowercase, straight apostrophes, single spaces, no leading "the ". */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Does a verdict's object (the words after "travel to") name the country as a whole?
 * Accepts the country itself, optionally followed by exceptions or a reason, and the
 * "whole of / all other regions of / rest of" catch-alls. Rejects a name used as a
 * modifier: "the Djibouti-Eritrea border", "Iraq's borders", "Somalia border areas".
 */
export function isWholeCountryObject(object: string, countryNames: readonly string[]): boolean {
  const obj = normalizeName(object);
  const names = [...new Set(countryNames.map(normalizeName).filter(Boolean))];
  if (names.length === 0) return false;
  const name = `(?:the )?(?:${names.map(escapeRegex).join('|')})`;
  const end = `(?=$|[\\s,;:.(])(?!\\s+(?:border|boundary|frontier)s?\\b)`;
  const patterns = [
    `^${name}${end}`,
    `^(?:the )?whole of ${name}${end}`,
    `^all (?:of |other (?:regions|areas|parts) of )${name}${end}`,
    `^(?:the )?(?:rest|remainder|remaining areas|remaining parts) of (?:${name}|the country)${end}`,
  ];
  return patterns.some((p) => new RegExp(p).test(obj));
}

/**
 * The national-level verdicts in the warnings text: 4 for "all travel" to the country as a
 * whole, 3 for "all but essential travel". 0 when every verdict names a region only.
 * Matches both "FCDO advises against all travel to X" and the list form "FCDO advises
 * against:" followed by "all travel to X" lines (Saudi Arabia's page).
 */
export function ukWholeCountryVerdict(text: string, countryNames: readonly string[]): number {
  let level = 0;
  const verdict = /(?:advises?\s+against\s+|^)(all but essential|all)\s+travel\s+to\s+([^\n]*)/gim;
  let m: RegExpExecArray | null;
  while ((m = verdict.exec(text)) !== null) {
    const object = m[2].slice(0, 120);
    if (!isWholeCountryObject(object, countryNames)) continue;
    level = Math.max(level, m[1].toLowerCase() === 'all' ? 4 : 3);
  }
  return level;
}

/**
 * Level and label for one FCDO country document. `countryNames` are the names the page can
 * use for the country (FCDO's own title name and ours). An empty alert_status is FCDO's
 * own "no advice against travel", level 1, not a parse failure.
 */
export function parseUkAdvisory(doc: Record<string, unknown>, countryNames: readonly string[]): UkAdvisory {
  const details = doc.details as Record<string, unknown> | undefined;
  const statuses = ((details?.alert_status ?? []) as unknown[]).map(String);

  let statusLevel = 1;
  for (const status of statuses) statusLevel = Math.max(statusLevel, UK_ALERT_LEVEL[status] ?? 1);

  const whole = statuses.some((s) => s.endsWith('_whole_country'));
  const allTravelToParts = statuses.includes('avoid_all_travel_to_parts');
  const textLevel = whole || statuses.length === 0 ? 0 : ukWholeCountryVerdict(ukWarningsText(doc), countryNames);
  const level = Math.max(statusLevel, textLevel);
  const andParts = allTravelToParts ? ', and all travel to parts' : '';

  let text: string;
  if (level === 1) text = 'No advice against travel';
  else if (whole) text = level === 4 ? 'Advise against all travel' : `Advise against all but essential travel${andParts}`;
  else if (textLevel === level && level === 4) text = 'Advise against all travel to most of the country';
  else if (textLevel === level && level === 3) text = `Advise against all but essential travel to most of the country${andParts}`;
  else if (allTravelToParts) text = 'Advise against all travel to parts of the country';
  else text = 'Advise against all but essential travel to parts of the country';

  return { level, text };
}
